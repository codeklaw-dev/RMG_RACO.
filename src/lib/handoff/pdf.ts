"use client";
// Renders a BriefDocument to PDF in the browser. jsPDF is imported lazily so it
// only loads when someone exports. Schematic views are rasterised from the
// on-page SVGs; object URLs are revoked immediately after use.
import type { BriefDocument } from "./technical";

// ── Text safety ───────────────────────────────────────────────
// jsPDF's built-in Helvetica/Times use WinAnsi encoding. Anything outside it
// renders as garbage, so map common symbols and replace the rest visibly.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const MAP: Record<string, string> = {
  "→": "->", "←": "<-", "↔": "<->", "★": "*", "☆": "*", "✓": "v", "✔": "v", "✗": "x", "≈": "~", "≤": "<=", "≥": ">=",
  "×": "x", "−": "-", "\u2011": "-", "\u2010": "-", "\u202f": " ", "\u2009": " ", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8",
};
const isWinAnsi = (ch: string) => {
  const c = ch.codePointAt(0)!;
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.has(ch) || ch === "\n";
};

/** Returns PDF-safe text and whether any character had to be replaced with "?". */
export function pdfSafe(text: string): { text: string; replaced: boolean } {
  let replaced = false;
  const out = Array.from(text.normalize("NFC"))
    .map((ch) => {
      if (isWinAnsi(ch)) return ch;
      if (MAP[ch]) return MAP[ch];
      replaced = true;
      return "?";
    })
    .join("");
  return { text: out, replaced };
}

export async function svgToPng(svg: SVGSVGElement, width: number, height: number): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not render schematic view"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#EFEBE4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── Layout (A4, millimetres) ─────────────────────────────────
export const PAGE = { width: 210, height: 297, margin: 16, bodyBottom: 280, footerY: 290 } as const;
const PT = 25.4 / 72;
const lineHeight = (fontSize: number) => fontSize * 1.2 * PT;
const KEY_W = 46;
const GAP = 4;

/** Builds the PDF without saving it (testable); exportBriefPdf triggers the download. */
export async function renderBriefPdf(
  doc: BriefDocument,
  views: { label: string; png: string }[],
  opts: { compress?: boolean; onCreate?: (pdf: import("jspdf").jsPDF) => void } = {},
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: opts.compress ?? true });
  opts.onCreate?.(pdf);
  pdf.setLineHeightFactor(1.2);
  const { width: W, margin: M, bodyBottom } = PAGE;
  const inner = W - 2 * M;
  const valueX = M + KEY_W + GAP;
  const valueW = W - M - valueX;
  let replacedAny = false;
  const safe = (s: string) => {
    const r = pdfSafe(s);
    replacedAny ||= r.replaced;
    return r.text;
  };
  let y = M;
  const newPage = () => { pdf.addPage(); y = M; };
  const ensure = (h: number) => { if (y + h > bodyBottom) newPage(); };

  // Title + disclaimer (box sized to its wrapped text).
  pdf.setFont("times", "normal").setFontSize(22).setTextColor(23, 23, 23);
  const titleLines = pdf.splitTextToSize(safe(doc.title), inner) as string[];
  pdf.text(titleLines, M, y + 6);
  y += 6 + titleLines.length * lineHeight(22) - 2;
  pdf.setFont("helvetica", "bold").setFontSize(8.5);
  const disc = pdf.splitTextToSize(safe(doc.disclaimer), inner - 6) as string[];
  const discH = disc.length * lineHeight(8.5) + 5;
  pdf.setFillColor(243, 230, 230).setDrawColor(140, 47, 55).rect(M, y, inner, discH, "FD");
  pdf.setTextColor(140, 47, 55).text(disc, M + 3, y + 3 + lineHeight(8.5) * 0.75);
  y += discH + 6;

  if (views.length) {
    const w = 38, h = 53;
    ensure(h + 8);
    views.forEach((v, i) => {
      pdf.addImage(v.png, "PNG", M + i * (w + 6), y, w, h, undefined, "FAST");
      pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(110, 105, 98);
      pdf.text(safe(v.label), M + i * (w + 6), y + h + 4);
    });
    const noteX = M + views.length * (w + 6);
    pdf.text(pdf.splitTextToSize("Conceptual illustrations — not manufacturing patterns.", W - M - noteX) as string[], noteX, y + 6);
    y += h + 10;
  }

  const lh = lineHeight(8);
  for (const section of doc.sections) {
    const heading = () => {
      pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(23, 23, 23);
      pdf.text(safe(section.heading.toUpperCase()), M, y);
      pdf.setDrawColor(226, 221, 213).line(M, y + 1.5, W - M, y + 1.5);
      y += 6;
    };
    ensure(6 + lh * 2);
    heading();
    for (const [k, v] of section.rows) {
      pdf.setFontSize(8);
      const keyLines = pdf.setFont("helvetica", "bold").splitTextToSize(safe(k), KEY_W) as string[];
      const valLines = pdf.setFont("helvetica", "normal").splitTextToSize(safe(v), valueW) as string[];
      const rows = Math.max(keyLines.length, valLines.length);
      // Short rows stay together; long ones flow line by line across pages.
      if (rows <= 6) ensure(rows * lh);
      for (let i = 0; i < rows; i++) {
        if (y + lh > bodyBottom) {
          newPage();
          pdf.setFont("helvetica", "italic").setFontSize(7).setTextColor(138, 133, 125);
          pdf.text(safe(`${section.heading} (continued)`), M, y);
          y += lh + 1;
        }
        pdf.setFontSize(8);
        if (keyLines[i]) pdf.setFont("helvetica", "bold").setTextColor(90, 86, 80).text(keyLines[i], M, y);
        if (valLines[i]) pdf.setFont("helvetica", "normal").setTextColor(23, 23, 23).text(valLines[i], valueX, y);
        y += lh;
      }
      y += 1.5;
    }
    y += 4;
  }

  const warnings = [...doc.warnings];
  if (replacedAny) warnings.push("Some characters are not supported by the PDF font and were replaced with “?”. Check the brief in the app.");
  if (warnings.length) {
    const title = `MISSING INFORMATION & WARNINGS (${warnings.length})`;
    ensure(6 + lh * 2);
    pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(140, 47, 55).text(title, M, y);
    y += 6;
    for (const w of warnings) {
      pdf.setFont("helvetica", "normal").setFontSize(8);
      const lines = pdf.splitTextToSize(`• ${safe(w)}`, inner) as string[];
      if (y + lines.length * lh > bodyBottom) {
        newPage();
        pdf.setFont("helvetica", "italic").setFontSize(7).setTextColor(138, 133, 125).text("Missing information & warnings (continued)", M, y);
        y += lh + 1;
        pdf.setFont("helvetica", "normal").setFontSize(8);
      }
      pdf.setTextColor(140, 47, 55).text(lines, M, y);
      y += lines.length * lh + 0.8;
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(138, 133, 125);
    pdf.text(safe(`${doc.footer} · page ${i}/${pages}`), M, PAGE.footerY);
  }
  return pdf;
}

export async function exportBriefPdf(doc: BriefDocument, views: { label: string; png: string }[], fileName: string) {
  (await renderBriefPdf(doc, views)).save(fileName);
}
