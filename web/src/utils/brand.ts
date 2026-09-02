/** Public asset paths (respect GitHub Pages base URL). */
const base = import.meta.env.BASE_URL;

/** Primary mark — dark tile, white bars, emerald live row. For light backgrounds. */
export const EVENTOS_ICON = `${base}eventos-icon.svg`;

/** Reversed mark — white tile, dark bars, emerald live row. For dark backgrounds
 * (the app's own dark navy UI — sidebar, dark-mode login card). */
export const EVENTOS_ICON_REVERSED = `${base}eventos-icon-reversed.svg`;
