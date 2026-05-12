// Document text extraction tools for OmniLearn
// Supports: PDF, DOCX, DOC, XLSX, PPTX, TXT, MD, HTML, JSON, CSV, images (OCR), audio (placeholder)

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { logger } from "../lib/logger.js";

const execAsync = promisify(exec);

export interface ExtractedDocument {
  text: string;
  method: string;
  metadata: {
    originalName: string;
    mimeType: string;
    type?: string;
    [key: string]: unknown;
  };
}

// Supported document types
const SUPPORTED_TYPES: Record<string, { extension: string; method: string; type: string }> = {
  // Text documents
  "text/plain": { extension: ".txt", method: "text", type: "text" },
  "text/markdown": { extension: ".md", method: "text", type: "text" },
  "text/html": { extension: ".html", method: "html", type: "text" },
  
  // Office documents
  "application/pdf": { extension: ".pdf", method: "pdf", type: "pdf" },
  "application/msword": { extension: ".doc", method: "doc", type: "word" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: ".docx", method: "docx", type: "word" },
  "application/vnd.ms-excel": { extension: ".xls", method: "excel", type: "excel" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { extension: ".xlsx", method: "excel", type: "excel" },
  "application/vnd.ms-powerpoint": { extension: ".ppt", method: "ppt", type: "powerpoint" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { extension: ".pptx", method: "ppt", type: "powerpoint" },
  
  // Code/structured
  "application/json": { extension: ".json", method: "json", type: "json" },
  "application/xml": { extension: ".xml", method: "xml", type: "xml" },
  "text/csv": { extension: ".csv", method: "csv", type: "csv" },
  
  // Images (OCR)
  "image/jpeg": { extension: ".jpg", method: "ocr", type: "image" },
  "image/png": { extension: ".png", method: "ocr", type: "image" },
  "image/gif": { extension: ".gif", method: "ocr", type: "image" },
  "image/webp": { extension: ".webp", method: "ocr", type: "image" },
  
  // Audio (transcription - placeholder)
  "audio/mpeg": { extension: ".mp3", method: "transcribe", type: "audio" },
  "audio/wav": { extension: ".wav", method: "transcribe", type: "audio" },
  "audio/ogg": { extension: ".ogg", method: "transcribe", type: "audio" },
};

export async function extractTextFromFile(filePath: string, mimeType: string, originalName: string): Promise<ExtractedDocument> {
  const fileInfo = SUPPORTED_TYPES[mimeType] || SUPPORTED_TYPES["text/plain"];
  const { method, type } = fileInfo;
  
  logger.info({ filePath, mimeType, originalName, method }, "Extracting text from file");
  
  try {
    switch (method) {
      case "text":
      case "html":
      case "json":
      case "xml":
      case "csv": {
        const text = await fs.readFile(filePath, "utf-8");
        return { 
          text, 
          method,
          metadata: { originalName, mimeType, type },
        };
      }
      
      case "pdf": {
        // Use pdftotext (poppler-utils)
        try {
          const { stdout } = await execAsync(`pdftotext -layout "${filePath}" -`);
          return { 
            text: stdout, 
            method: "pdftotext",
            metadata: { originalName, mimeType, type: "pdf" },
          };
        } catch (err) {
          logger.warn({ err }, "pdftotext failed, trying pdfinfo + pdftotext");
          // Fallback: try with pdfinfo first
          const { stdout: pdfinfo } = await execAsync(`pdfinfo "${filePath}"`).catch(() => ({ stdout: "" }));
          const { stdout } = await execAsync(`pdftotext "${filePath}" -`);
          return { 
            text: pdfinfo ? `${pdfinfo}\n\n---\n\n${stdout}` : stdout,
            method: "pdftotext",
            metadata: { originalName, mimeType, type: "pdf" },
          };
        }
      }
      
      case "docx": {
        // Use pandoc for DOCX
        try {
          const { stdout } = await execAsync(`pandoc -f docx -t plain "${filePath}"`);
          return { 
            text: stdout, 
            method: "pandoc",
            metadata: { originalName, mimeType, type: "word" },
          };
        } catch (err) {
          logger.warn({ err }, "pandoc failed for DOCX");
          // Try mammoth.js if available
          try {
            const { stdout } = await execAsync(`mammoth "${filePath}" --output-format=txt`);
            return { 
              text: stdout, 
              method: "mammoth",
              metadata: { originalName, mimeType, type: "word" },
            };
          } catch {
            // Last resort: read as binary and return placeholder
            return { 
              text: `[DOCX file "${originalName}" - install pandoc or mammoth for full extraction]`,
              method: "binary",
              metadata: { originalName, mimeType, type: "word" },
            };
          }
        }
      }
      
      case "doc": {
        // Legacy DOC - try abiword or antiword
        try {
          const { stdout } = await execAsync(`abiword --to=text "${filePath}" --to-name=stdout 2>/dev/null || antiword "${filePath}"`);
          return { 
            text: stdout, 
            method: "abiword/antiword",
            metadata: { originalName, mimeType, type: "word" },
          };
        } catch {
          return { 
            text: `[Legacy DOC file "${originalName}" - install abiword or antiword for extraction]`,
            method: "binary",
            metadata: { originalName, mimeType, type: "word" },
          };
        }
      }
      
      case "excel":
      case "xlsx":
      case "xls": {
        // Use ssconvert (gnumeric) or python
        try {
          const { stdout } = await execAsync(`ssconvert "${filePath}" -`);
          return { 
            text: stdout, 
            method: "ssconvert",
            metadata: { originalName, mimeType, type: "excel" },
          };
        } catch {
          // Try python with openpyxl
          try {
            const pythonScript = `
import sys
try:
    import openpyxl
    wb = openpyxl.load_workbook("${filePath.replace(/"/g, '\\"')}")
    for sheet in wb.worksheets:
        for row in sheet.iter_rows(values_only=True):
            print("\\t".join(str(c) if c is not None else "" for c in row))
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;
            const { stdout } = await execAsync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`);
            return { 
              text: stdout, 
              method: "openpyxl",
              metadata: { originalName, mimeType, type: "excel" },
            };
          } catch {
            return { 
              text: `[Excel file "${originalName}" - install gnumeric or openpyxl for extraction]`,
              method: "binary",
              metadata: { originalName, mimeType, type: "excel" },
            };
          }
        }
      }
      
      case "ppt":
      case "pptx": {
        // Use pandoc for PowerPoint
        try {
          const { stdout } = await execAsync(`pandoc -f pptx -t plain "${filePath}"`);
          return { 
            text: stdout, 
            method: "pandoc",
            metadata: { originalName, mimeType, type: "powerpoint" },
          };
        } catch {
          return { 
            text: `[PowerPoint file "${originalName}" - install pandoc for extraction]`,
            method: "binary",
            metadata: { originalName, mimeType, type: "powerpoint" },
          };
        }
      }
      
      case "ocr": {
        // Use tesseract OCR
        try {
          const { stdout } = await execAsync(`tesseract "${filePath}" stdout`);
          return { 
            text: stdout, 
            method: "tesseract",
            metadata: { originalName, mimeType, type: "image" },
          };
        } catch (err) {
          logger.warn({ err }, "Tesseract OCR failed");
          return { 
            text: `[Image "${originalName}" - install tesseract-ocr for text extraction]`,
            method: "binary",
            metadata: { originalName, mimeType, type: "image" },
          };
        }
      }
      
      case "transcribe": {
        // Placeholder for audio transcription
        return { 
          text: `[Audio file "${originalName}" - transcription requires Whisper or similar service]`,
          method: "audio",
          metadata: { originalName, mimeType, type: "audio" },
        };
      }
      
      default: {
        // Fallback: try to read as plain text
        const text = await fs.readFile(filePath, "utf-8");
        return { 
          text, 
          method: "fallback",
          metadata: { originalName, mimeType, type: "unknown" },
        };
      }
    }
  } catch (err) {
    logger.error({ err, filePath, method }, "Text extraction failed");
    throw new Error(`Failed to extract text from ${originalName}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function getSupportedFormats() {
  return Object.entries(SUPPORTED_TYPES).map(([mime, info]) => ({
    mimeType: mime,
    extension: info.extension,
    method: info.method,
    type: info.type,
  }));
}
