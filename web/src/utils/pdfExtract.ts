/**
 * Shared PDF text extraction for SOW and ticket parsers.
 *
 * Uses pdfjs-dist/legacy and runs the worker on the main thread via
 * globalThis.pdfjsWorker. Safari on GitHub Pages fails when pdf.js spins up
 * a module Web Worker ("undefined is not a function"); local dev often falls
 * back to the main thread automatically, which is why it works offline.
 */

declare global {
  // eslint-disable-next-line no-var
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

async function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjsLib, workerMod] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        // @ts-expect-error — no types published for the worker entry
        import('pdfjs-dist/legacy/build/pdf.worker.mjs') as Promise<{ WorkerMessageHandler: unknown }>,
      ]);
      globalThis.pdfjsWorker = workerMod;
      return pdfjsLib;
    })();
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
