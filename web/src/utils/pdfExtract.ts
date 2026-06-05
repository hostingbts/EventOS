/**
 * Shared PDF text extraction for SOW and ticket parsers.
 *
 * Uses unpdf — ships a serverless pdf.js build with the worker inlined, so
 * Safari on GitHub Pages never loads a separate module Web Worker.
 */
import { extractText, getDocumentProxy } from 'unpdf';

export async function extractPdfText(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
