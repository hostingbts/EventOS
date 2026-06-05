/**
 * Shared PDF text extraction for SOW and ticket parsers.
 *
 * Uses pdfjs-dist/legacy — the standard build relies on Promise.withResolvers,
 * URL.parse, etc. inside a Web Worker where our main-thread polyfills do not
 * apply (Safari throws "undefined is not a function" on GitHub Pages).
 */

let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

async function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjsLib) => {
      const base = import.meta.env.BASE_URL || '/';
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.mjs`;
      return pdfjsLib;
    });
  }
  return pdfjsPromise;
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await getPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    parts.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
    );
    parts.push('\n');
  }
  return parts.join('');
}
