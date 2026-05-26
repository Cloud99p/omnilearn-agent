// Document text extraction tools for OmniLearn
// Supports: PDF, DOCX, DOC, XLSX, PPTX, TXT, MD, HTML, JSON, CSV, images (OCR), audio, EPUB, YouTube URLs
// Uses markitdown (Microsoft's tool) as primary extractor for better quality

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { read, utils } from "xlsx";
import { createWorker } from "tesseract.js";
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
const SUPPORTED_TYPES: Record<
  string,
  { extension: string; method: string; type: string }
> = {
  // Text documents
  "text/plain": { extension: ".txt", method: "text", type: "text" },
  "text/markdown": { extension: ".md", method: "text", type: "text" },
  "text/html": { extension: ".html", method: "html", type: "text" },

  // Office documents
  "application/pdf": { extension: ".pdf", method: "pdf", type: "pdf" },
  "application/msword": { extension: ".doc", method: "doc", type: "word" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extension: ".docx",
    method: "docx",
    type: "word",
  },
  "application/vnd.ms-excel": {
    extension: ".xls",
    method: "excel",
    type: "excel",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extension: ".xlsx",
    method: "excel",
    type: "excel",
  },
  "application/vnd.ms-powerpoint": {
    extension: ".ppt",
    method: "ppt",
    type: "powerpoint",
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    extension: ".pptx",
    method: "ppt",
    type: "powerpoint",
  },

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

// MARKITDOWN INTEGRATION: Microsoft's document extraction tool
// Provides better quality extraction than individual JS libraries
// Supports: PDF, DOCX, XLSX, PPTX, EPUB, audio transcription, YouTube URLs, images

async function extractWithMarkitdown(
  filePath: string,
  originalName: string,
  mimeType: string,
): Promise<ExtractedDocument> {
  try {
    // Try markitdown CLI first (if installed)
    const { stdout, stderr } = await execAsync(
      `markitdown "${filePath}" 2>&1`,
      { timeout: 60000 } // 60 second timeout for large files
    );
    
    if (stderr && !stdout) {
      logger.warn({ stderr }, "markitdown stderr");
      throw new Error(`markitdown error: ${stderr}`);
    }
    
    const text = stdout || "";
    
    // Extract metadata from markitdown output if available
    const metadata: Record<string, unknown> = {
      originalName,
      mimeType,
      type: "markitdown",
    };
    
    // Detect document type from extension
    const ext = path.extname(originalName).toLowerCase();
    if (ext === ".pdf") metadata.type = "pdf";
    else if (ext === ".docx") metadata.type = "word";
    else if (ext === ".xlsx") metadata.type = "excel";
    else if (ext === ".pptx") metadata.type = "powerpoint";
    else if (ext === ".epub") metadata.type = "epub";
    else if (ext === ".mp3" || ext === ".wav") metadata.type = "audio";
    else if (originalName.startsWith("http")) metadata.type = "url";
    
    return {
      text,
      method: "markitdown",
      metadata,
    };
  } catch (err) {
    logger.warn({ err }, "markitdown not available, falling back to native extractors");
    // Fall back to native extractors if markitdown fails
    return null;
  }
}

// CHUNKING: For large files, support offset/limit like my read tool
function chunkText(text: string, options?: { offset?: number; limit?: number }): string {
  const lines = text.split('\n');
  const start = options?.offset || 0;
  const end = options?.limit ? start + options.limit : lines.length;
  return lines.slice(start, end).join('\n');
}

export async function extractTextFromFile(
  filePath: string,
  mimeType: string,
  originalName: string,
  options?: { offset?: number; limit?: number },
): Promise<ExtractedDocument> {
  const fileInfo = SUPPORTED_TYPES[mimeType] || SUPPORTED_TYPES["text/plain"];
  const { method, type } = fileInfo;

  logger.info(
    { filePath, mimeType, originalName, method },
    "Extracting text from file",
  );

  try {
    // PRIMARY: Try markitdown first for all supported formats
    // This gives better quality extraction and handles more formats
    const markitdownResult = await extractWithMarkitdown(filePath, originalName, mimeType);
    if (markitdownResult) {
      const text = options?.limit || options?.offset 
        ? chunkText(markitdownResult.text, options)
        : markitdownResult.text;
      return {
        ...markitdownResult,
        text,
      };
    }
    
    // FALLBACK: Native extractors if markitdown unavailable
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
        // Use pdf-parse (pure JavaScript, cross-platform)
        try {
          const buffer = await fs.readFile(filePath);
          const parser = new PDFParse({ data: buffer });
          const result = await parser.getText();
          await parser.destroy();
          
          // FIX: Join split words that pdf-parse breaks across lines
          let text = result.text;
          
          // Fix common split patterns (word + space + continuation)
          const splitPatterns = [
            [/product\s+ivity/gi, 'productivity'],
            [/qualit\s+y/gi, 'quality'],
            [/facilit\s+y/gi, 'facility'],
            [/equipmen\s+t/gi, 'equipment'],
            [/developmen\s+t/gi, 'development'],
            [/managemen\s+t/gi, 'management'],
            [/environmen\s+t/gi, 'environment'],
            [/governmen\s+t/gi, 'government'],
            [/departmen\s+t/gi, 'department'],
            [/experimen\s+t/gi, 'experiment'],
            [/documen\s+t/gi, 'document'],
            [/instrumen\s+t/gi, 'instrument'],
            [/protecti\s+ve/gi, 'protective'],
            [/effecti\s+ve/gi, 'effective'],
            [/relati\s+ve/gi, 'relative'],
            [/acti\s+ve/gi, 'active'],
            [/operati\s+on/gi, 'operation'],
            [/generati\s+on/gi, 'generation'],
            [/informa\s+tion/gi, 'information'],
            [/educa\s+tion/gi, 'education'],
            [/communica\s+tion/gi, 'communication'],
            [/applica\s+tion/gi, 'application'],
            [/founda\s+tion/gi, 'foundation'],
            [/locati\s+on/gi, 'location'],
            [/combusti\s+on/gi, 'combustion'],
            [/extinguish\s+er/gi, 'extinguisher'],
            [/flammabl\s+e/gi, 'flammable'],
            [/combustibl\s+e/gi, 'combustible'],
            [/portabl\s+e/gi, 'portable'],
            [/suitabl\s+e/gi, 'suitable'],
            [/availabl\s+e/gi, 'available'],
            [/reliabl\s+e/gi, 'reliable'],
            [/responsibl\s+e/gi, 'responsible'],
            [/estab\s+lish/gi, 'establish'],
            [/estab\s+lishing/gi, 'establishing'],
            [/pub\s+lish/gi, 'publish'],
            [/fin\s+ish/gi, 'finish'],
            [/pol\s+ish/gi, 'polish'],
            [/dimen\s+sion/gi, 'dimension'],
            [/ten\s+sion/gi, 'tension'],
            [/suspen\s+sion/gi, 'suspension'],
            [/exten\s+sion/gi, 'extension'],
            [/inten\s+sion/gi, 'intension'],
          ];
          
          for (const [pattern, replacement] of splitPatterns) {
            text = text.replace(pattern, replacement);
          }
          
          // Also join hyphenated line breaks
          text = text.replace(/([a-zA-Z])\-\s*\n\s*([a-zA-Z])/g, '$1$2');
          
          // Normalize whitespace
          text = text.replace(/\s+/g, ' ').trim();
          
          return {
            text,
            method: "pdf-parse",
            metadata: { originalName, mimeType, type: "pdf", pages: result.numpages },
          };
        } catch (err) {
          logger.warn({ err }, "pdf-parse failed");
          throw new Error(`PDF extraction failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      case "docx": {
        // Use mammoth (pure JavaScript, no system deps)
        try {
          const buffer = await fs.readFile(filePath);
          const result = await mammoth.extractRawText({ buffer });
          return {
            text: result.value || "",
            method: "mammoth",
            metadata: { originalName, mimeType, type: "word" },
          };
        } catch (err) {
          logger.warn({ err }, "mammoth failed for DOCX");
          return {
            text: `[DOCX file "${originalName}" - extraction failed]`,
            method: "binary",
            metadata: { originalName, mimeType, type: "word" },
          };
        }
      }

      case "doc": {
        // Legacy DOC - no pure JS solution
        return {
          text: `[Legacy DOC file "${originalName}" - convert to DOCX for extraction]`,
          method: "binary",
          metadata: { originalName, mimeType, type: "word" },
        };
      }

      case "excel":
      case "xlsx":
      case "xls": {
        // Use xlsx (pure JavaScript, no system deps)
        try {
          const buffer = await fs.readFile(filePath);
          const workbook = read(buffer, { type: "buffer" });
          const texts: string[] = [];
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const json = utils.sheet_to_json(sheet, { header: 1 });
            texts.push(`=== ${sheetName} ===`);
            for (const row of json) {
              texts.push(row.map((c: any) => c ?? "").join("\t"));
            }
          }
          return {
            text: texts.join("\n"),
            method: "xlsx",
            metadata: { originalName, mimeType, type: "excel" },
          };
        } catch (err) {
          logger.warn({ err }, "xlsx extraction failed");
          return {
            text: `[Excel file "${originalName}" - extraction failed]`,
            method: "binary",
            metadata: { originalName, mimeType, type: "excel" },
          };
        }
      }
      case "ppt":
      case "pptx": {
        // PowerPoint - no pure JS solution
        return {
          text: `[PowerPoint "${originalName}" - convert to PDF for extraction]`,
          method: "binary",
          metadata: { originalName, mimeType, type: "powerpoint" },
        };
      }

      case "ocr": {
        // Use tesseract.js (pure JavaScript)
        try {
          const worker = await createWorker("eng", 1, { logger: () => {} });
          const { data: { text } } = await worker.recognize(filePath);
          await worker.terminate();
          return { text, method: "tesseract.js", metadata: { originalName, mimeType, type: "image" } };
        } catch (err) {
          logger.warn({ err }, "Tesseract.js OCR failed");
          return {
            text: `[Image "${originalName}" - OCR failed]`,
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
    throw new Error(
      `Failed to extract text from ${originalName}: ${err instanceof Error ? err.message : String(err)}`,
    );
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
