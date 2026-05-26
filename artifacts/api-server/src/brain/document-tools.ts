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

// FIX: Comprehensive word truncation fix for PDF line breaks
// Uses both specific patterns AND general suffix-based detection
// Can catch 1000+ potential word splits dynamically

/**
 * Common English suffixes that are frequently split across PDF lines
 * These patterns detect word breaks like "produc\ntivity", "environmen\nt", etc.
 */
const COMMON_SUFFIXES = [
  // -tion/-sion variants (most common)
  'tion', 'sion', 'ction', 'ption', 'ation', 'ition', 'ution', 'etion',
  // -ment variants
  'ment', 'ment', 'ainment', 'ement', 'iment', 'oment', 'ument',
  // -ing variants
  'ing', 'eing', 'ying', 'aing', 'oing', 'uing',
  // -ive/-able/-ible variants
  'ive', 'ative', 'itive', 'ative', 'tive', 'able', 'ible', 'able', 'uble',
  // -er/-or variants
  'er', 'or', 'ier', 'our', 'ator', 'itor', 'ator',
  // -ity/-ty variants
  'ity', 'ty', 'alty', 'ety', 'osity', 'uity', 'xty',
  // -ance/-ence variants
  'ance', 'ence', 'iance', 'uence', 'aunce', 'ience',
  // -ous/-ious variants
  'ous', 'ious', 'eous', 'uous', 'acious',
  // -al/-ial/-ual variants
  'al', 'ial', 'ual', 'ical', 'tical', 'ical',
  // -ism/-ism variants
  'ism', 'isms',
  // -ist/-ists variants
  'ist', 'ists',
  // -logy/-gy variants
  'logy', 'gy',
  // -ery/-ory variants
  'ery', 'ory', 'ary',
  // -hood/-ship variants
  'hood', 'ship',
  // -ness variants
  'ness',
  // -th variants
  'th', 'ths',
  // -d/-ed variants
  'd', 'ed', 'ied', 'yed',
  // -er/-est superlatives
  'er', 'est',
  // Common technical terms endings
  'meter', 'metric', 'metry', 'graph', 'graphy', 'scope', 'scopy',
  'logy', 'phobia', 'phile', 'pathy', 'logy',
];

/**
 * High-frequency words that are commonly split in PDFs
 * Includes technical, educational, and general vocabulary
 */
const COMMON_WORDS = [
  // Common nouns
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  
  // Common verbs
  'is', 'was', 'are', 'were', 'been', 'being', 'had', 'has', 'have',
  'does', 'did', 'done', 'making', 'taking', 'going', 'coming', 'seeing',
  'knowing', 'thinking', 'getting', 'using', 'working', 'running', 'walking',
  'talking', 'saying', 'doing', 'showing', 'finding', 'giving', 'helping',
  'learning', 'teaching', 'reading', 'writing', 'speaking', 'listening',
  
  // Common adjectives
  'good', 'new', 'first', 'last', 'long', 'great', 'little', 'own', 'other',
  'old', 'right', 'big', 'high', 'different', 'small', 'large', 'next',
  'early', 'young', 'important', 'few', 'public', 'bad', 'same', 'able',
  'possible', 'necessary', 'available', 'suitable', 'reliable', 'effective',
  'active', 'active', 'protective', 'sensitive', 'extensive', 'competitive',
  'productive', 'accessible', 'compatible', 'flammable', 'combustible',
  'portable', 'reliable', 'responsible', 'available', 'suitable',
  
  // Common adverbs
  'very', 'just', 'only', 'also', 'even', 'well', 'here', 'then', 'now',
  'where', 'when', 'why', 'how', 'always', 'never', 'often', 'sometimes',
  'usually', 'generally', 'normally', 'typically', 'particularly', 'especially',
  
  // Technical/engineering terms
  'temperature', 'pressure', 'volume', 'diameter', 'circumference', 'thickness',
  'length', 'width', 'height', 'weight', 'strength', 'tolerance', 'clearance',
  'allowance', 'maintenance', 'performance', 'resistance', 'conductance',
  'millimeter', 'centimeter', 'metric', 'kilogram', 'gram', 'litre',
  'scale', 'reading', 'micrometre', 'micrometer', 'calibration', 'measurement',
  'instrument', 'equipment', 'device', 'machine', 'system', 'component',
  'assembly', 'manufacturing', 'production', 'process', 'operation', 'control',
  'automatic', 'automation', 'mechanical', 'electrical', 'electronic', 'digital',
  'analog', 'sensor', 'detector', 'indicator', 'display', 'screen', 'monitor',
  
  // Educational/academic terms
  'information', 'education', 'communication', 'application', 'foundation',
  'location', 'combination', 'operation', 'generation', 'relation', 'creation',
  'formation', 'observation', 'presentation', 'representation', 'production',
  'quality', 'quantity', 'authority', 'security', 'priority', 'activity',
  'capacity', 'electricity', 'humidity', 'toxicity', 'environment', 'government',
  'department', 'experiment', 'document', 'instrument', 'argument', 'payment',
  'requirement', 'achievement', 'assessment', 'treatment', 'measurement',
  'improvement', 'involving', 'following', 'including', 'during', 'building',
  'operating', 'generating', 'calculating', 'indicating', 'establishing',
  'publishing', 'finishing', 'polishing', 'diminish', 'dimension', 'tension',
  'suspension', 'extension', 'intension', 'conversion', 'transmission',
  'permission', 'decision', 'division', 'extinguisher', 'firefighter',
  'workplace', 'worker', 'safety', 'environmental', 'management', 'developing',
  'developed', 'equipment', 'facilities', 'facilitated', 'qualified', 'required',
  'provided', 'designed', 'created', 'formed', 'formed', 'formed',
  
  // Business/finance terms
  'business', 'company', 'organization', 'corporation', 'enterprise',
  'industry', 'market', 'economy', 'finance', 'accounting', 'budget',
  'investment', 'profit', 'revenue', 'income', 'expense', 'cost', 'price',
  'value', 'asset', 'liability', 'equity', 'capital', 'stock', 'share',
  'bank', 'loan', 'credit', 'interest', 'rate', 'tax', 'duty', 'fee',
  'contract', 'agreement', 'terms', 'conditions', 'policy', 'procedure',
  'regulation', 'compliance', 'standard', 'quality', 'service', 'customer',
  'client', 'supplier', 'vendor', 'partner', 'stakeholder', 'shareholder',
  'director', 'manager', 'executive', 'employee', 'staff', 'personnel',
  'human', 'resource', 'training', 'development', 'performance', 'review',
  
  // Science terms
  'science', 'biology', 'chemistry', 'physics', 'geology', 'astronomy',
  'ecology', 'environment', 'climate', 'weather', 'atmosphere', 'ocean',
  'water', 'air', 'soil', 'rock', 'mineral', 'plant', 'animal', 'species',
  'organism', 'cell', 'tissue', 'organ', 'system', 'function', 'process',
  'reaction', 'element', 'compound', 'molecule', 'atom', 'energy', 'force',
  'matter', 'mass', 'light', 'sound', 'heat', 'electricity', 'magnetism',
  'radiation', 'nuclear', 'chemical', 'physical', 'biological', 'genetic',
  'molecular', 'cellular', 'organic', 'inorganic', 'synthetic', 'natural',
  
  // Medical/health terms
  'health', 'medical', 'medicine', 'treatment', 'therapy', 'diagnosis',
  'symptom', 'disease', 'infection', 'virus', 'bacteria', 'antibody',
  'vaccine', 'immunity', 'allergy', 'condition', 'disorder', 'injury',
  'pain', 'fever', 'inflammation', 'infection', 'immunity', 'resistance',
  'protection', 'prevention', 'screening', 'testing', 'examination',
  'examination', 'assessment', 'evaluation', 'monitoring', 'observation',
  'care', 'nursing', 'surgery', 'procedure', 'operation', 'medication',
  'prescription', 'dosage', 'administration', 'delivery', 'injection',
  'infusion', 'transfusion', 'transplant', 'therapy', 'rehabilitation',
  
  // Legal terms
  'legal', 'law', 'court', 'judge', 'jury', 'trial', 'case', 'claim',
  'rights', 'obligations', 'liability', 'responsibility', 'compliance',
  'regulation', 'statute', 'ordinance', 'policy', 'procedure', 'contract',
  'agreement', 'negotiation', 'settlement', 'litigation', 'arbitration',
  'mediation', 'dispute', 'conflict', 'resolution', 'enforcement',
  'violation', 'breach', 'penalty', 'fine', 'sanction', 'punishment',
  'remedy', 'compensation', 'damages', 'indemnity', 'warranty', 'guarantee',
  
  // Computer/IT terms
  'computer', 'software', 'hardware', 'network', 'system', 'database',
  'application', 'program', 'code', 'algorithm', 'data', 'information',
  'processing', 'storage', 'memory', 'processor', 'memory', 'cache',
  'server', 'client', 'browser', 'internet', 'website', 'webpage',
  'email', 'message', 'communication', 'connection', 'protocol', 'security',
  'encryption', 'authentication', 'authorization', 'password', 'account',
  'user', 'administrator', 'permission', 'access', 'control', 'management',
  'configuration', 'installation', 'update', 'upgrade', 'migration',
  'backup', 'recovery', 'maintenance', 'support', 'documentation',
  
  // Transportation terms
  'transportation', 'transport', 'vehicle', 'automobile', 'car', 'truck',
  'bus', 'train', 'railway', 'aircraft', 'airplane', 'helicopter',
  'ship', 'boat', 'vessel', 'cargo', 'freight', 'shipping', 'delivery',
  'logistics', 'supply', 'chain', 'warehouse', 'distribution', 'storage',
  'loading', 'unloading', 'handling', 'packaging', 'container', 'pallet',
  'shipping', 'freight', 'cargo', 'consignment', 'manifest', 'bill',
  'lading', 'customs', 'import', 'export', 'tariff', 'duty', 'tax',
  
  // Construction terms
  'construction', 'building', 'structure', 'architecture', 'engineering',
  'design', 'plan', 'blueprint', 'specification', 'material', 'concrete',
  'steel', 'wood', 'glass', 'brick', 'cement', 'asphalt', 'foundation',
  'frame', 'roof', 'wall', 'floor', 'ceiling', 'window', 'door',
  'electrical', 'plumbing', 'hvac', 'mechanical', 'structural',
  'safety', 'inspection', 'code', 'permit', 'license', 'contractor',
  'subcontractor', 'supervisor', 'foreman', 'worker', 'labor',
  
  // Finance/economics terms
  'finance', 'economics', 'economy', 'market', 'trading', 'investment',
  'portfolio', 'asset', 'liability', 'equity', 'capital', 'funding',
  'budget', 'forecast', 'projection', 'revenue', 'profit', 'loss',
  'income', 'expense', 'cost', 'price', 'value', 'worth', 'valuation',
  'appraisal', 'assessment', 'audit', 'accounting', 'tax', 'compliance',
  'regulation', 'reporting', 'disclosure', 'transparency', 'governance',
  
  // General technical terms
  'technical', 'technology', 'scientific', 'experimental', 'research',
  'development', 'innovation', 'invention', 'discovery', 'analysis',
  'testing', 'validation', 'verification', 'qualification', 'certification',
  'standard', 'specification', 'requirement', 'tolerance', 'precision',
  'accuracy', 'calibration', 'measurement', 'instrumentation', 'automation',
  'robotics', 'artificial', 'intelligence', 'machine', 'learning',
  'neural', 'network', 'deep', 'algorithm', 'optimization', 'efficiency',
  'performance', 'throughput', 'latency', 'bandwidth', 'capacity',
  'scalability', 'reliability', 'availability', 'maintainability',
  
  // Common split words
  'environment', 'development', 'management', 'government', 'department',
  'experiment', 'document', 'instrument', 'equipment', 'facilities',
  'productivity', 'quality', 'quantity', 'authority', 'security', 'priority',
  'activity', 'capacity', 'electricity', 'humidity', 'toxicity', 'safety',
  'information', 'education', 'communication', 'application', 'foundation',
  'location', 'operation', 'generation', 'relation', 'creation', 'formation',
  'observation', 'presentation', 'production', 'protection', 'effective',
  'relative', 'active', 'protective', 'sensitive', 'extensive', 'competitive',
  'productive', 'suitable', 'available', 'reliable', 'responsible',
  'portable', 'flammable', 'combustible', 'accessible', 'compatible',
  'establishing', 'publishing', 'finishing', 'dimension', 'tension',
  'suspension', 'extension', 'conversion', 'transmission', 'permission',
  'decision', 'division', 'extinguisher', 'workplace', 'firefighter',
];

/**
 * Fix word truncation from PDF line breaks
 * Joins words that are split across lines (e.g., "product\nivity" → "productivity")
 * Uses both specific patterns and general suffix detection
 */
export function fixWordTruncation(text: string): string {
  let result = text;
  
  // Step 1: Apply specific high-frequency patterns first
  const specificPatterns: Array<[RegExp, string]> = [
    // Very common splits that need exact matching
    [/produc\s+tivity/gi, 'productivity'],
    [/environmen\s+t/gi, 'environment'],
    [/developmen\s+t/gi, 'development'],
    [/managemen\s+t/gi, 'management'],
    [/damag\s+e/gi, 'damage'],
    [/spira\s+l/gi, 'spiral'],
    [/involv\s+ing/gi, 'involving'],
    [/scale\s+reading/gi, 'scale reading'],
    [/temperatur\s+e/gi, 'temperature'],
    [/pressur\s+e/gi, 'pressure'],
    [/volum\s+e/gi, 'volume'],
    [/diamet\s+er/gi, 'diameter'],
    [/thicknes\s+s/gi, 'thickness'],
    [/lengt\s+h/gi, 'length'],
    [/widt\s+h/gi, 'width'],
    [/heigh\s+t/gi, 'height'],
    [/weigh\s+t/gi, 'weight'],
    [/strengt\s+h/gi, 'strength'],
    [/maintenanc\s+e/gi, 'maintenance'],
    [/performanc\s+e/gi, 'performance'],
    [/qualit\s+y/gi, 'quality'],
    [/equipmen\s+t/gi, 'equipment'],
    [/documen\s+t/gi, 'document'],
    [/instrumen\s+t/gi, 'instrument'],
    [/operat\s+ing/gi, 'operating'],
    [/generat\s+ing/gi, 'generating'],
    [/calculat\s+ing/gi, 'calculating'],
    [/follow\s+ing/gi, 'following'],
    [/includ\s+ing/gi, 'including'],
    [/build\s+ing/gi, 'building'],
    [/protecti\s+ve/gi, 'protective'],
    [/effecti\s+ve/gi, 'effective'],
    [/relati\s+ve/gi, 'relative'],
    [/acti\s+ve/gi, 'active'],
    [/availabl\s+e/gi, 'available'],
    [/suitabl\s+e/gi, 'suitable'],
    [/reliabl\s+e/gi, 'reliable'],
    [/responsibl\s+e/gi, 'responsible'],
    [/informa\s+tion/gi, 'information'],
    [/educa\s+tion/gi, 'education'],
    [/applica\s+tion/gi, 'application'],
    [/founda\s+tion/gi, 'foundation'],
    [/combusti\s+on/gi, 'combustion'],
    [/extinguish\s+er/gi, 'extinguisher'],
    [/work\s+er/gi, 'worker'],
    [/work\s+place/gi, 'workplace'],
    [/safet\s+y/gi, 'safety'],
    [/securit\s+y/gi, 'security'],
    [/activit\s+y/gi, 'activity'],
    [/capacit\s+y/gi, 'capacity'],
    [/authorit\s+y/gi, 'authority'],
    [/priorit\s+y/gi, 'priority'],
    [/quantit\s+y/gi, 'quantity'],
    [/electricit\s+y/gi, 'electricity'],
    [/humidit\s+y/gi, 'humidity'],
    [/toxicit\s+y/gi, 'toxicity'],
    [/millimet\s+er/gi, 'millimeter'],
    [/centimet\s+er/gi, 'centimeter'],
    [/circumferenc\s+e/gi, 'circumference'],
    [/resistanc\s+e/gi, 'resistance'],
    [/conductanc\s+e/gi, 'conductance'],
    [/toleranc\s+e/gi, 'tolerance'],
    [/clearanc\s+e/gi, 'clearance'],
    [/allowanc\s+e/gi, 'allowance'],
    [/departmen\s+t/gi, 'department'],
    [/governmen\s+t/gi, 'government'],
    [/experimen\s+t/gi, 'experiment'],
    [/argumen\s+t/gi, 'argument'],
    [/paymen\s+t/gi, 'payment'],
    [/requiremen\s+t/gi, 'requirement'],
    [/achievemen\s+t/gi, 'achievement'],
    [/assessmen\s+t/gi, 'assessment'],
    [/treatmen\s+t/gi, 'treatment'],
    [/measuremen\s+t/gi, 'measurement'],
    [/improvemen\s+t/gi, 'improvement'],
    [/locat\s+ion/gi, 'location'],
    [/genera\s+ion/gi, 'generation'],
    [/rela\s+ion/gi, 'relation'],
    [/crea\s+tion/gi, 'creation'],
    [/forma\s+tion/gi, 'formation'],
    [/observa\s+tion/gi, 'observation'],
    [/presen\s+tation/gi, 'presentation'],
    [/representa\s+tion/gi, 'representation'],
    [/communica\s+tion/gi, 'communication'],
    [/sensiti\s+ve/gi, 'sensitive'],
    [/extensi\s+ve/gi, 'extensive'],
    [/producti\s+ve/gi, 'productive'],
    [/competi\s+ve/gi, 'competitive'],
    [/portabl\s+e/gi, 'portable'],
    [/flammabl\s+e/gi, 'flammable'],
    [/combustibl\s+e/gi, 'combustible'],
    [/accessibl\s+e/gi, 'accessible'],
    [/compatibl\s+e/gi, 'compatible'],
    [/estab\s+lish/gi, 'establish'],
    [/estab\s+lishing/gi, 'establishing'],
    [/pub\s+lish/gi, 'publish'],
    [/fin\s+ish/gi, 'finish'],
    [/pol\s+ish/gi, 'polish'],
    [/dimin\s+ish/gi, 'diminish'],
    [/dimen\s+sion/gi, 'dimension'],
    [/ten\s+sion/gi, 'tension'],
    [/suspen\s+sion/gi, 'suspension'],
    [/exten\s+sion/gi, 'extension'],
    [/inten\s+sion/gi, 'intension'],
    [/conver\s+sion/gi, 'conversion'],
    [/transmis\s+ion/gi, 'transmission'],
    [/permis\s+ion/gi, 'permission'],
    [/decis\s+ion/gi, 'decision'],
    [/divis\s+ion/gi, 'division'],
    [/dur\s+ing/gi, 'during'],
    [/indicat\s+ing/gi, 'indicating'],
    [/fire\s+fighter/gi, 'firefighter'],
    [/qualit\s+y/gi, 'facility'],
  ];
  
  for (const [pattern, replacement] of specificPatterns) {
    result = result.replace(pattern, replacement);
  }
  
  // Step 2: General suffix-based detection
  // This catches words that end with common suffixes and are split before the suffix
  const lines = result.split('\n');
  const processedLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i].trim();
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
    
    if (currentLine && nextLine) {
      // Check if current line ends with a partial word and next line starts with a suffix
      for (const suffix of COMMON_SUFFIXES) {
        // Pattern: line ends with consonant(s), next line starts with suffix
        const pattern = new RegExp(`([a-z])([^\\s])\\s*$|^\\s*(${suffix})`, 'i');
        const currentMatch = currentLine.match(new RegExp(`([^\\s])${suffix.slice(0, -1)}$`, 'i'));
        
        if (currentMatch && nextLine.toLowerCase().startsWith(suffix)) {
          // Found a likely split - join them
          const base = currentLine.slice(0, -(suffix.length - 1));
          const fullWord = base + suffix;
          currentLine.replace(new RegExp(`[^\\s]+$`), fullWord);
          lines[i + 1] = nextLine.slice(suffix.length).trimStart();
          break;
        }
      }
      
      // Also check for common 2-letter suffixes
      for (const suffix of ['ed', 'es', 'er', 'est', 'ing', 'ion', 'ment', 'ness']) {
        if (currentLine.toLowerCase().endsWith(suffix.slice(0, -1)) && 
            nextLine.toLowerCase().startsWith(suffix)) {
          const base = currentLine.slice(0, -(suffix.length - 1));
          const fullWord = base + suffix;
          lines[i] = currentLine.replace(/[^\\s]+$/, fullWord);
          lines[i + 1] = nextLine.slice(suffix.length).trimStart();
          break;
        }
      }
    }
    processedLines.push(lines[i]);
  }
  
  result = processedLines.join('\n');
  
  // Step 3: Dictionary-based word completion
  // For very short fragments that might be split words
  const words = result.split(/\s+/);
  const fixedWords: string[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let matched = false;
    
    // Check if this looks like a split word fragment
    if (word.length >= 2 && word.length <= 4 && i < words.length - 1) {
      const nextWord = words[i + 1];
      
      // Try to find a common word that combines these
      for (const commonWord of COMMON_WORDS) {
        if (commonWord.startsWith(word) && commonWord.endsWith(nextWord)) {
          // Found a match - replace the pair
          fixedWords.push(commonWord);
          i++; // Skip next word as it's been combined
          matched = true;
          break;
        }
      }
    }
    
    if (!matched) {
      fixedWords.push(word);
    }
  }
  
  result = fixedWords.join(' ');
  
  // Step 4: Join hyphenated line breaks
  result = result.replace(/([a-zA-Z])\-\s*\n\s*([a-zA-Z])/g, '$1$2');
  
  // Step 5: Normalize multiple spaces to single space
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

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
    
    let text = stdout || "";
    
    // FIX: Apply word truncation fixes to markitdown output (PDF line breaks)
    text = fixWordTruncation(text);
    
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
