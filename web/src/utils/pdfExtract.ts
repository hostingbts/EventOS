/**
 * Shared PDF text extraction for SOW and ticket parsers.
 *
 * pdfjs-dist v6 relies on Promise.withResolvers and URL.parse, which are
 * missing on Safari < 17.4 / < 18. Polyfill before loading the library.
 *
 * The worker is copied to public/ on install so GitHub Pages serves it at a
 * stable path under BASE_URL (avoids hashed-asset worker resolution issues).
 */

if (typeof (Promise as PromiseConstructor & { withResolvers?: unknown }).withResolvers !== 'function') {
  (Promise as PromiseConstructor & {
    withResolvers: <T>() => {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }).withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof URL.parse !== 'function') {
  URL.parse = function parseUrl(url: string, base?: string | URL) {
    try {
      return base !== undefined ? new URL(url, base) : new URL(url);
    } catch {
      return null;
    }
  } as typeof URL.parse;
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjsLib) => {
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
