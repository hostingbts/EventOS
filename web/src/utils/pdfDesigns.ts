import jsPDF from 'jspdf';
import type { EventDesignSetup, DesignAttendee } from './designStore';

// ── Helpers ────────────────────────────────────────────────────────────────

function hex(h: string): [number, number, number] {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function addLogoSafe(doc: jsPDF, url: string, x: number, y: number, w: number, h: number) {
  try { doc.addImage(url, 'JPEG', x, y, w, h); } catch {
    try { doc.addImage(url, 'PNG', x, y, w, h); } catch { /* skip */ }
  }
}

// Lay out logos evenly across a horizontal band, centred vertically within it.
function drawLogos(
  doc: jsPDF,
  logos: string[],
  zoneX: number, zoneY: number, zoneW: number, zoneH: number,
  maxLogoH = zoneH - 4,
) {
  if (!logos.length) return;
  const maxLogoW = maxLogoH * 2.8;          // assume roughly 2.8:1 aspect ratio
  const totalW   = logos.length * maxLogoW + (logos.length - 1) * 6;
  let curX = zoneX + (zoneW - totalW) / 2;
  const logoY = zoneY + (zoneH - maxLogoH) / 2;
  for (const url of logos) {
    addLogoSafe(doc, url, curX, logoY, maxLogoW, maxLogoH);
    curX += maxLogoW + 6;
  }
}

function eventLine(setup: EventDesignSetup): string {
  return [setup.title, setup.cityCountry, setup.dateStr].filter(Boolean).join('  ·  ');
}

// ── NAME BADGES ─────────────────────────────────────────────────────────────
//
// Multiple badges per sheet — A4 (210×297mm portrait) or A3 (297×420mm portrait).
// Badges are centred on the sheet with equal gutters.

export async function exportNameBadges(
  setup: EventDesignSetup,
  attendees: DesignAttendee[],
  sheet: 'A4' | 'A3',
): Promise<void> {
  const [pR, pG, pB] = hex(setup.primaryColor);
  const [aR, aG, aB] = hex(setup.accentColor);

  const bw = setup.badgeWidthMm;
  const bh = setup.badgeHeightMm;
  const margin = 12;
  const gap = 5;

  const pageW = sheet === 'A4' ? 210 : 297;
  const pageH = sheet === 'A4' ? 297 : 420;

  const cols = Math.max(1, Math.floor((pageW - 2 * margin + gap) / (bw + gap)));
  const rows = Math.max(1, Math.floor((pageH - 2 * margin + gap) / (bh + gap)));
  const perPage = cols * rows;

  // Centre the grid on the page
  const gridW = cols * bw + (cols - 1) * gap;
  const gridH = rows * bh + (rows - 1) * gap;
  const startX = (pageW - gridW) / 2;
  const startY = (pageH - gridH) / 2;

  const doc = new jsPDF({ unit: 'mm', format: sheet.toLowerCase() as 'a4' | 'a3', orientation: 'portrait' });

  for (let i = 0; i < attendees.length; i++) {
    if (i > 0 && i % perPage === 0) doc.addPage();
    const idx = i % perPage;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = startX + col * (bw + gap);
    const y = startY + row * (bh + gap);
    drawBadge(doc, attendees[i], setup, x, y, bw, bh, pR, pG, pB, aR, aG, aB);
  }

  doc.save(`${setup.eventCode}_Name_Badges_${sheet}.pdf`);
}

// Badge layout (top → bottom):
//  1. Logo zone  — white background, primary + secondary logos
//  2. Title strip — navy, event title in white
//  3. Body        — white, name (bold large) / title / organisation in navy/dark
//  4. Info strip  — navy, "Date | City, Country" in white
function drawBadge(
  doc: jsPDF,
  a: DesignAttendee,
  setup: EventDesignSetup,
  x: number, y: number, bw: number, bh: number,
  pR: number, pG: number, pB: number,
  _aR: number, _aG: number, _aB: number,
): void {
  // Zone heights (proportional to badge height)
  const logoH   = Math.round(bh * 0.24);   // logo zone
  const titleH  = Math.round(bh * 0.14);   // title strip
  const infoH   = Math.round(bh * 0.14);   // bottom info strip
  const bodyH   = bh - logoH - titleH - infoH;

  // ── 1. Logo zone (white) ─────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, bw, logoH, 'F');

  drawLogos(doc, setup.logos, x, y, bw, logoH);
  // Thin divider below logo zone
  doc.setDrawColor(pR, pG, pB);
  doc.setLineWidth(0.3);
  doc.line(x, y + logoH, x + bw, y + logoH);

  // ── 2. Title strip (navy) ─────────────────────────────────────
  doc.setFillColor(pR, pG, pB);
  doc.rect(x, y + logoH, bw, titleH, 'F');
  doc.setFontSize(Math.min(9, Math.max(6, titleH * 0.46)));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(setup.title, x + bw / 2, y + logoH + titleH / 2 + 1.5, { align: 'center', maxWidth: bw - 6 });

  // ── 3. Body (white) — name / title / organisation ─────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y + logoH + titleH, bw, bodyH, 'F');

  const namePt = Math.min(16, Math.max(9, bh * 0.20));
  const titlePt = Math.min(9, Math.max(6, bh * 0.11));
  const orgPt   = Math.min(8, Math.max(5.5, bh * 0.10));
  const lineGap = (bodyH - namePt * 0.5 - (a.title ? titlePt * 0.5 : 0) - (a.organization ? orgPt * 0.5 : 0)) / 2;
  const bodyTop = y + logoH + titleH + lineGap + namePt * 0.35;

  // Name
  doc.setFontSize(namePt);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(pR, pG, pB);
  doc.text(a.name, x + bw / 2, bodyTop, { align: 'center', maxWidth: bw - 6 });

  // Title
  if (a.title) {
    doc.setFontSize(titlePt);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 50);
    doc.text(a.title, x + bw / 2, bodyTop + namePt * 0.44, { align: 'center', maxWidth: bw - 6 });
  }

  // Organisation
  if (a.organization) {
    doc.setFontSize(orgPt);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(90, 90, 100);
    const orgOffset = (a.title ? namePt * 0.44 + titlePt * 0.42 : namePt * 0.44);
    doc.text(a.organization, x + bw / 2, bodyTop + orgOffset, { align: 'center', maxWidth: bw - 6 });
  }

  // ── 4. Info strip (navy) — "Date | City, Country" ─────────────
  const infoY = y + logoH + titleH + bodyH;
  doc.setFillColor(pR, pG, pB);
  doc.rect(x, infoY, bw, infoH, 'F');
  const parts = [setup.dateStr, setup.cityCountry].filter(Boolean);
  doc.setFontSize(Math.min(7.5, Math.max(5.5, infoH * 0.40)));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(parts.join('  |  '), x + bw / 2, infoY + infoH / 2 + 1.5, { align: 'center', maxWidth: bw - 6 });

  // Outer border
  doc.setDrawColor(pR, pG, pB);
  doc.setLineWidth(0.4);
  doc.rect(x, y, bw, bh, 'S');
}

// ── TABLE TENTS ─────────────────────────────────────────────────────────────
//
// A4 landscape (297 × 210 mm), fold at 105 mm.
// Bottom half → faces the audience (draws normally).
// Top half    → back of tent (draws rotated 180° — reads correctly when folded).

export async function exportTableTents(
  setup: EventDesignSetup,
  attendees: DesignAttendee[],
): Promise<void> {
  const [pR, pG, pB] = hex(setup.primaryColor);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  // A4 landscape: 297 × 210 mm, fold at y = 105 mm
  for (let i = 0; i < attendees.length; i++) {
    if (i > 0) doc.addPage();
    drawTableTent(doc, attendees[i], setup, pR, pG, pB);
  }
  doc.save(`${setup.eventCode}_Table_Tents.pdf`);
}

// ── Table tent layout (derived from K697 template) ─────────────────────────
//
//  Page: A4 landscape 297 × 210 mm, fold at y = 105 mm (centre).
//
//  FRONT (bottom half, y 105 → 210 — audience-facing):
//   ┌──────────────────────────────────────┐  y = 105 (fold)
//   │  [navy]  EVENT TITLE  (white bold)   │  titleStripH ≈ 14 mm
//   ├──────────────────────────────────────┤
//   │  [white] logos / flags (centred)     │  logoZoneH ≈ 22 mm
//   │  [white] NAME SURNAME (navy bold)    │
//   │  [white] Title        (dark)         │
//   │  [white] Organization (grey italic)  │
//   ├──────────────────────────────────────┤
//   │  [navy]  Date | City, Country        │  infoStripH ≈ 12 mm
//   └──────────────────────────────────────┘  y = 210 (bottom)
//
//  BACK (top half, y 0 → 105 — person-facing, rotated 180°):
//   exact mirror drawn upside-down so it reads correctly when folded.
//
function drawTableTent(
  doc: jsPDF,
  a: DesignAttendee,
  setup: EventDesignSetup,
  pR: number, pG: number, pB: number,
): void {
  const pw = 297, fold = 105;
  const titleStripH = 14;
  const infoStripH  = 12;
  const logoZoneH   = setup.logos.length ? 20 : 0;
  // body fills the rest of each half
  const bodyH = fold - titleStripH - infoStripH - logoZoneH;

  const dateCity = [setup.dateStr, setup.cityCountry].filter(Boolean).join('  |  ');

  // helper: draw one half starting at yBase (top of that half), direction = 1 (normal) or -1 (mirrored)
  function drawHalf(yBase: number, angle: 0 | 180) {
    const flip = angle === 180;

    // Offset helpers so we can write top-to-bottom for both halves
    // For the flipped half, "top of half" is at yBase and content builds toward fold
    const ts  = yBase;                                     // title strip start
    const lz  = yBase + titleStripH;                       // logo zone start
    const by  = yBase + titleStripH + logoZoneH;           // body start
    const is  = yBase + titleStripH + logoZoneH + bodyH;   // info strip start

    const textOpts = (maxW = pw - 24) => ({ align: 'center' as const, maxWidth: maxW, angle });

    // ── title strip ──
    doc.setFillColor(pR, pG, pB);
    doc.rect(0, ts, pw, titleStripH, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    // text baseline sits at strip centre; for flip the anchor is mirrored
    const titleTextY = flip
      ? ts + titleStripH * 0.35
      : ts + titleStripH * 0.65;
    doc.text(setup.title, pw / 2, titleTextY, textOpts());

    // ── logo zone ──
    if (setup.logos.length && logoZoneH) {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, lz, pw, logoZoneH, 'F');
      drawLogos(doc, setup.logos, 0, lz, pw, logoZoneH, logoZoneH - 4);
    }

    // ── body (white) ──
    doc.setFillColor(255, 255, 255);
    doc.rect(0, by, pw, bodyH, 'F');

    // vertical text stack within body
    const namePt = 28, titlePt = 14, orgPt = 12;
    const hasTitle = Boolean(a.title);
    const hasOrg   = Boolean(a.organization);
    const usedH = namePt * 0.35 + (hasTitle ? titlePt * 0.42 : 0) + (hasOrg ? orgPt * 0.4 : 0);
    const pad   = (bodyH - usedH) / 2;

    const nameY  = flip
      ? by + bodyH - pad - namePt * 0.1
      : by + pad + namePt * 0.35;

    doc.setFontSize(namePt);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(pR, pG, pB);
    doc.text(a.name, pw / 2, nameY, textOpts());

    const step1 = namePt * 0.38 + 1;
    if (hasTitle) {
      const ty = flip ? nameY - step1 : nameY + step1;
      doc.setFontSize(titlePt);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 50);
      doc.text(a.title, pw / 2, ty, textOpts());
      if (hasOrg) {
        const step2 = titlePt * 0.38 + 1;
        const oy = flip ? ty - step2 : ty + step2;
        doc.setFontSize(orgPt);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(90, 90, 100);
        doc.text(a.organization, pw / 2, oy, textOpts());
      }
    } else if (hasOrg) {
      const step2 = namePt * 0.38 + 1;
      const oy = flip ? nameY - step2 : nameY + step2;
      doc.setFontSize(orgPt);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(90, 90, 100);
      doc.text(a.organization, pw / 2, oy, textOpts());
    }

    // ── info strip ──
    doc.setFillColor(pR, pG, pB);
    doc.rect(0, is, pw, infoStripH, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const infoTextY = flip
      ? is + infoStripH * 0.35
      : is + infoStripH * 0.65;
    doc.text(dateCity, pw / 2, infoTextY, textOpts(pw - 20));

    // thin border around the half
    doc.setDrawColor(pR, pG, pB);
    doc.setLineWidth(0.3);
    doc.rect(0, yBase, pw, fold, 'S');
  }

  // Draw front (bottom half: y = fold → ph)
  drawHalf(fold, 0);

  // Draw back (top half: y = 0 → fold, content upside-down)
  // Mirror the top half so it reads correctly when folded:
  // we draw everything from y=0 downward but with angle=180 text
  drawHalf(0, 180);

  // Dashed fold line
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.3);
  // @ts-expect-error jsPDF types missing setLineDash
  doc.setLineDash([4, 3], 0);
  doc.line(0, fold, pw, fold);
  // @ts-expect-error
  doc.setLineDash([], 0);
  // Small "fold" label
  doc.setFontSize(6);
  doc.setTextColor(160, 160, 160);
  doc.text('— fold —', pw / 2, fold - 0.5, { align: 'center' });
}

// ── CERTIFICATES ─────────────────────────────────────────────────────────────
//
// A4 landscape (297 × 210 mm). One certificate per page.
// Only the attendee's name is personalised; title/org are not shown.

export async function exportCertificates(
  setup: EventDesignSetup,
  attendees: DesignAttendee[],
): Promise<void> {
  const [pR, pG, pB] = hex(setup.primaryColor);
  const [aR, aG, aB] = hex(setup.accentColor);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

  for (let i = 0; i < attendees.length; i++) {
    if (i > 0) doc.addPage();
    drawCertificate(doc, attendees[i].name, setup, pR, pG, pB, aR, aG, aB);
  }

  doc.save(`${setup.eventCode}_Certificates.pdf`);
}

function drawCertificate(
  doc: jsPDF,
  name: string,
  setup: EventDesignSetup,
  pR: number, pG: number, pB: number,
  aR: number, aG: number, aB: number,
): void {
  const pw = 297, ph = 210;

  // Outer + inner border
  doc.setDrawColor(pR, pG, pB);
  doc.setLineWidth(3);
  doc.rect(8, 8, pw - 16, ph - 16, 'S');
  doc.setLineWidth(0.5);
  doc.rect(12, 12, pw - 24, ph - 24, 'S');

  // Top banner
  doc.setFillColor(pR, pG, pB);
  doc.rect(8, 8, pw - 16, 20, 'F');

  // Bottom banner
  doc.setFillColor(aR, aG, aB);
  doc.rect(8, ph - 28, pw - 16, 20, 'F');

  // Logos in top banner
  drawLogos(doc, setup.logos, 14, 11, pw - 28, 14);

  // "CERTIFICATE OF PARTICIPATION"
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(pR, pG, pB);
  doc.text('Certificate of Participation', pw / 2, 46, { align: 'center' });

  // Thin decorative line
  doc.setDrawColor(aR, aG, aB);
  doc.setLineWidth(0.7);
  doc.line(pw / 2 - 55, 50, pw / 2 + 55, 50);

  // "This is to certify that"
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 100);
  doc.text('This is to certify that', pw / 2, 63, { align: 'center' });

  // Name
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 30);
  const nameLines = doc.splitTextToSize(name, pw - 60) as string[];
  doc.text(nameLines, pw / 2, 79, { align: 'center' });
  const nameBottom = 79 + (nameLines.length - 1) * 28 * 0.35;

  // "has successfully participated in"
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 100);
  doc.text('has successfully participated in', pw / 2, nameBottom + 12, { align: 'center' });

  // Event title
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(pR, pG, pB);
  const titleLines = doc.splitTextToSize(setup.title, pw - 60) as string[];
  doc.text(titleLines, pw / 2, nameBottom + 24, { align: 'center' });
  const titleBottom = nameBottom + 24 + (titleLines.length - 1) * 15 * 0.35;

  // Location + date
  const locDate = [setup.cityCountry, setup.dateStr].filter(Boolean).join('  ·  ');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 100);
  doc.text(locDate, pw / 2, titleBottom + 11, { align: 'center' });

  // Signature lines
  const signers = setup.signers.length > 0 ? setup.signers : [{ id: 'default', name: '', title: 'Authorized Signature' }];
  const sigW = 58;
  const sigBaseY = ph - 30;
  const spread = Math.min((pw - 40) / signers.length, 110);
  const firstX = (pw - spread * (signers.length - 1)) / 2;

  signers.forEach((signer, i) => {
    const sx = firstX + i * spread;
    doc.setDrawColor(130, 130, 140);
    doc.setLineWidth(0.3);
    doc.line(sx - sigW / 2, sigBaseY, sx + sigW / 2, sigBaseY);
    if (signer.name) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 25, 35);
      doc.text(signer.name, sx, sigBaseY + 5, { align: 'center' });
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(85, 85, 95);
    doc.text(signer.title, sx, sigBaseY + (signer.name ? 10 : 5), { align: 'center' });
  });

  // Event info in bottom banner
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(eventLine(setup), pw / 2, ph - 15, { align: 'center', maxWidth: pw - 30 });
}

// ── BANNER ───────────────────────────────────────────────────────────────────
//
// Roll-up banner: 85×200 cm = 850×2000 mm  (or 80×200 cm = 800×2000 mm)
// No attendee list — purely event branding.

export async function exportBanner(setup: EventDesignSetup): Promise<void> {
  const [pR, pG, pB] = hex(setup.primaryColor);
  const [aR, aG, aB] = hex(setup.accentColor);

  const widthMm  = setup.bannerSize === '85x200' ? 850 : 800;
  const heightMm = 2000;

  const doc = new jsPDF({ unit: 'mm', format: [widthMm, heightMm], orientation: 'portrait' });
  drawBannerContent(doc, setup, widthMm, heightMm, pR, pG, pB, aR, aG, aB);
  doc.save(`${setup.eventCode}_Banner_${setup.bannerSize}cm.pdf`);
}

function drawBannerContent(
  doc: jsPDF,
  setup: EventDesignSetup,
  w: number, h: number,
  pR: number, pG: number, pB: number,
  aR: number, aG: number, aB: number,
): void {
  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, 'F');

  // Top colour band
  doc.setFillColor(pR, pG, pB);
  doc.rect(0, 0, w, h * 0.07, 'F');

  // Bottom accent band
  doc.setFillColor(aR, aG, aB);
  doc.rect(0, h - h * 0.05, w, h * 0.05, 'F');

  // Logos (centred, upper zone)
  const logoAreaTop = h * 0.1;
  const logoZoneH   = h * 0.16;
  drawLogos(doc, setup.logos, 40, logoAreaTop, w - 80, logoZoneH, logoZoneH - 4);

  // Event title
  doc.setFontSize(80);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 30);
  const titleLines = doc.splitTextToSize(setup.title, w - 80) as string[];
  doc.text(titleLines, w / 2, h * 0.48, { align: 'center' });

  // City + Country
  doc.setFontSize(52);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 80);
  doc.text(setup.cityCountry, w / 2, h * 0.62, { align: 'center' });

  // Dates
  doc.setFontSize(46);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(pR, pG, pB);
  doc.text(setup.dateStr, w / 2, h * 0.70, { align: 'center' });

  // Bottom banner text
  doc.setFontSize(32);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(eventLine(setup), w / 2, h - h * 0.025, { align: 'center', maxWidth: w - 60 });
}

// ── SCREEN BANNER ───────────────────────────────────────────────────────────
//
// 16:9 presentation slide — 338 × 190 mm (arbitrary 16:9 close to A3 width)

export async function exportScreenBanner(setup: EventDesignSetup): Promise<void> {
  const [pR, pG, pB] = hex(setup.primaryColor);
  const [aR, aG, aB] = hex(setup.accentColor);

  const sw = 338, sh = 190;
  const doc = new jsPDF({ unit: 'mm', format: [sw, sh], orientation: 'landscape' });

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, sw, sh, 'F');

  // Left accent stripe
  doc.setFillColor(pR, pG, pB);
  doc.rect(0, 0, 14, sh, 'F');

  // Right accent stripe
  doc.setFillColor(aR, aG, aB);
  doc.rect(sw - 14, 0, 14, sh, 'F');

  // Logo zone (centred top)
  drawLogos(doc, setup.logos, 22, 12, sw - 44, 32, 28);

  // Divider
  doc.setDrawColor(pR, pG, pB);
  doc.setLineWidth(1);
  doc.line(22, 55, sw - 22, 55);

  // Event title (centred)
  doc.setFontSize(34);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 30);
  const titleLines = doc.splitTextToSize(setup.title, sw - 60) as string[];
  doc.text(titleLines, sw / 2, sh * 0.47, { align: 'center' });

  // City + dates
  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(pR, pG, pB);
  doc.text(`${setup.cityCountry}  ·  ${setup.dateStr}`, sw / 2, sh * 0.68, { align: 'center' });

  doc.save(`${setup.eventCode}_Screen_Banner.pdf`);
}
