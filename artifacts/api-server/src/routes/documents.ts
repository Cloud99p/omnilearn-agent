import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../lib/logger.js";

const execAsync = promisify(exec);
const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Supported document types and extraction methods
const SUPPORTED_TYPES = {
  // Text documents
  "text/plain": { extension: ".txt", method: "text" },
  "text/markdown": { extension: ".md", method: "text" },
  "text/html": { extension: ".html", method: "html" },
  
  // Office documents
  "application/pdf": { extension: ".pdf", method: "pdf" },
  "application/msword": { extension: ".doc", method: "doc" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: ".docx", method: "docx" },
  "application/vnd.ms-excel": { extension: ".xls", method: "excel" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { extension: ".xlsx", method: "excel" },
  "application/vnd.ms-powerpoint": { extension: ".ppt", method: "ppt" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { extension: ".pptx", method: "ppt" },
  
  // Code/structured
  "application/json": { extension: ".json", method: "json" },
  "application/xml": { extension: ".xml", method: "xml" },
  "text/csv": { extension: ".csv", method: "csv" },
  
  // Images (OCR)
  "image/jpeg": { extension: ".jpg", method: "ocr" },
  "image/png": { extension: ".png", method: "ocr" },
  "image/gif": { extension: ".gif", method: "ocr" },
  "image/webp": { extension: ".webp", method: "ocr" },
  
  // Audio (transcription)
  "audio/mpeg": { extension: ".mp3", method: "transcribe" },
  "audio/wav": { extension: ".wav", method: "transcribe" },
  "audio/ogg": { extension: ".ogg", method: "transcribe" },
};

/**
 * Extract text from file based on type
 */
async function extractText(filePath: string, mimeType: string, originalName: string): Promise<{ text: string; metadata: Record<string, any> }> {
  const fileInfo = SUPPORTED_TYPES[mimeType as keyof typeof SUPPORTED_TYPES];
  
  if (!fileInfo) {
    // Fallback: try to read as plain text
    const text = await fs.readFile(filePath, "utf-8");
    return { text, metadata: { method: "fallback" } };
  }
  
  const { method } = fileInfo;
  
  try {
    switch (method) {
      case "text":
      case "html":
      case "json":
      case "xml":
      case "csv": {
        const text = await fs.readFile(filePath, "utf-8");
        return { text, metadata: { method, originalName } };
      }
      
      case "pdf": {
        // Use pdftotext (poppler-utils)
        const { stdout } = await execAsync(`pdftotext -layout "${filePath}" -`);
        return { text: stdout, metadata: { method, originalName, type: "pdf" } };
      }
      
      case "docx":
      case "doc": {
        // Use pandoc if available, otherwise try mammoth
        try {
          const { stdout } = await execAsync(`pandoc -f docx -t plain "${filePath}"`);
          return { text: stdout, metadata: { method: "pandoc", originalName, type: "word" } };
        } catch {
          // Fallback: try to read as zip and extract text
          const text = await fs.readFile(filePath, "utf-8");
          return { text: `[Binary DOC/DOCX file: ${originalName}]`, metadata: { method: "binary", originalName } };
        }
      }
      
      case "excel":
      case "xlsx":
      case "xls": {
        // Use ssconvert or python
        try {
          const { stdout } = await execAsync(`ssconvert "${filePath}" -`);
          return { text: stdout, metadata: { method: "ssconvert", originalName, type: "excel" } };
        } catch {
          return { text: `[Excel file: ${originalName} - install gnumeric for extraction]`, metadata: { method: "binary", originalName } };
        }
      }
      
      case "ppt":
      case "pptx": {
        try {
          const { stdout } = await execAsync(`pandoc -f pptx -t plain "${filePath}"`);
          return { text: stdout, metadata: { method: "pandoc", originalName, type: "powerpoint" } };
        } catch {
          return { text: `[PowerPoint file: ${originalName}]`, metadata: { method: "binary", originalName } };
        }
      }
      
      case "ocr": {
        // Use tesseract OCR
        try {
          const { stdout } = await execAsync(`tesseract "${filePath}" stdout`);
          return { text: stdout, metadata: { method: "tesseract", originalName, type: "image" } };
        } catch (err) {
          return { text: `[Image file: ${originalName} - install tesseract for OCR]`, metadata: { method: "binary", originalName } };
        }
      }
      
      case "transcribe": {
        // Placeholder for audio transcription (would need Whisper or similar)
        return { 
          text: `[Audio file: ${originalName} - transcription not yet implemented]`, 
          metadata: { method: "audio", originalName, type: "audio" } 
        };
      }
      
      default: {
        const text = await fs.readFile(filePath, "utf-8");
        return { text, metadata: { method: "fallback", originalName } };
      }
    }
  } catch (err) {
    logger.error({ err, filePath, method }, "Text extraction failed");
    return { 
      text: `[Failed to extract from ${originalName}: ${err instanceof Error ? err.message : String(err)}]`, 
      metadata: { method: "error", originalName, error: String(err) } 
    };
  }
}

/**
 * Split text into knowledge-worthy chunks
 */
function chunkText(text: string, metadata: Record<string, any>): Array<{ content: string; type: string; tags: string[] }> {
  const chunks: Array<{ content: string; type: string; tags: string[] }> = [];
  
  // Clean and split by paragraphs/sections
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
  
  for (const para of paragraphs.slice(0, 50)) { // Limit to prevent overload
    const cleanPara = para.trim().replace(/\s+/g, " ");
    
    if (cleanPara.length < 20 || cleanPara.length > 2000) continue;
    
    // Determine type based on content patterns
    let type = "fact";
    if (cleanPara.includes("how to") || cleanPara.includes("steps") || cleanPara.includes("procedure")) {
      type = "procedure";
    } else if (cleanPara.includes("definition") || cleanPara.includes("means") || cleanPara.includes("refers to")) {
      type = "concept";
    } else if (cleanPara.includes("opinion") || cleanPara.includes("I think") || cleanPara.includes("believe")) {
      type = "opinion";
    }
    
    // Extract tags from metadata and content
    const tags = [
      metadata.originalName?.replace(/\.[^.]+$/, "") || "document",
      metadata.type || "unknown",
      metadata.method || "extracted",
    ];
    
    chunks.push({
      content: cleanPara,
      type,
      tags,
    });
  }
  
  return chunks;
}

// POST /api/documents/upload - Upload and process document
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    
    const { mode = "extract" } = req.body as { mode?: "extract" | "full" };
    const file = req.file;
    const mimeType = file.mimetype;
    const originalName = file.originalname;
    
    logger.info({ file: file.filename, originalName, mimeType, mode }, "Processing document upload");
    
    // Extract text
    const { text, metadata } = await extractText(file.path, mimeType, originalName);
    
    // Clean up uploaded file
    await fs.unlink(file.path).catch(() => {});
    
    // Chunk and extract knowledge
    const chunks = chunkText(text, metadata);
    
    if (chunks.length === 0) {
      res.status(400).json({ 
        error: "No extractable content found",
        metadata,
        textLength: text.length,
      });
      return;
    }
    
    // Save to knowledge graph
    const savedNodes = [];
    for (const chunk of chunks) {
      const tokens = chunk.content.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length > 3);
      
      const [node] = await db.insert(knowledgeNodes).values({
        content: chunk.content,
        type: chunk.type,
        tags: chunk.tags,
        source: `document:${originalName}`,
        confidence: 0.8,
        tokens,
        clerkId: null,
      }).returning();
      
      savedNodes.push(node);
    }
    
    res.json({
      success: true,
      file: {
        name: originalName,
        type: mimeType,
        size: file.size,
      },
      extraction: {
        method: metadata.method,
        textLength: text.length,
        chunksExtracted: chunks.length,
        nodesCreated: savedNodes.length,
      },
      nodes: savedNodes.map(n => ({
        id: n.id,
        content: n.content.slice(0, 100) + "...",
        type: n.type,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Document upload failed");
    res.status(500).json({ 
      error: "Document processing failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// POST /api/documents/extract - Extract from text/URL
router.post("/extract", async (req, res) => {
  try {
    const { text, url, source = "manual" } = req.body as { 
      text?: string; 
      url?: string;
      source?: string;
    };
    
    let content = text;
    
    // Fetch from URL if provided
    if (url && !text) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        content = await response.text();
      } catch (err) {
        res.status(400).json({ error: `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}` });
        return;
      }
    }
    
    if (!content?.trim()) {
      res.status(400).json({ error: "No content provided" });
      return;
    }
    
    const metadata = { source, url };
    const chunks = chunkText(content, metadata);
    
    const savedNodes = [];
    for (const chunk of chunks) {
      const tokens = chunk.content.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length > 3);
      
      const [node] = await db.insert(knowledgeNodes).values({
        content: chunk.content,
        type: chunk.type,
        tags: [...chunk.tags, source],
        source: source === "url" ? `url:${url}` : "manual",
        confidence: 0.75,
        tokens,
        clerkId: null,
      }).returning();
      
      savedNodes.push(node);
    }
    
    res.json({
      success: true,
      nodesCreated: savedNodes.length,
      nodes: savedNodes.map(n => ({
        id: n.id,
        content: n.content.slice(0, 100) + "...",
        type: n.type,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Extraction failed");
    res.status(500).json({ error: "Extraction failed", details: String(err) });
  }
});

// GET /api/documents/supported - List supported formats
router.get("/supported", async (req, res) => {
  const formats = Object.entries(SUPPORTED_TYPES).map(([mime, info]) => ({
    mimeType: mime,
    extension: info.extension,
    method: info.method,
    description: getFormatDescription(info.method),
  }));
  
  res.json({
    supported: formats,
    total: formats.length,
    maxFileSize: "50MB",
  });
});

function getFormatDescription(method: string): string {
  const descriptions: Record<string, string> = {
    text: "Plain text extraction",
    html: "HTML text extraction",
    pdf: "PDF text extraction (requires pdftotext)",
    docx: "Word document extraction (requires pandoc)",
    doc: "Legacy Word document",
    excel: "Excel spreadsheet (requires gnumeric)",
    ppt: "PowerPoint presentation (requires pandoc)",
    json: "JSON parsing",
    xml: "XML parsing",
    csv: "CSV parsing",
    ocr: "Image OCR (requires tesseract)",
    transcribe: "Audio transcription (not yet implemented)",
    fallback: "Fallback text reading",
    binary: "Binary file (no extraction)",
  };
  return descriptions[method] || method;
}

export default router;
