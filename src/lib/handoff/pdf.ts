"use client";
// Renders a BriefDocument to PDF in the browser. jsPDF is imported lazily so it
// only loads when someone exports. Schematic views are rasterised from the
// on-page SVGs; object URLs are revoked immediately after use.
import type { BriefDocument } from "./technical";

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

/** Builds the PDF without saving it (testable); exportBriefPdf triggers the download. */
export async function renderBriefPdf(doc: BriefDocument, views: { label: string; png: string }[]) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16, inner = W - 2 * M;
  let y = M;
  const ensure = (h: number) => { if (y + h > 280) { pdf.addPage(); y = M; } };

  pdf.setFont("times", "normal").setFontSize(22).setTextColor(23, 23, 23);
  pdf.text(doc.title, M, y + 6);
  y += 12;
  pdf.setFillColor(243, 230, 230).setDrawColor(140, 47, 55).rect(M, y, inner, 12, "FD");
  pdf.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(140, 47, 55);
  pdf.text(pdf.splitTextToSize(doc.disclaimer, inner - 6), M + 3, y + 5);
  y += 18;

  if (views.length) {
    const w = 38, h = 53;
    views.forEach((v, i) => {
      pdf.addImage(v.png, "PNG", M + i * (w + 6), y, w, h);
      pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(110, 105, 98);
      pdf.text(v.label, M + i * (w + 6), y + h + 4);
    });
    pdf.text("Conceptual illustrations — not manufacturing patterns.", M + views.length * (w + 6), y + 6, { maxWidth: inner - views.length * (w + 6) });
    y += h + 10;
  }

  for (const section of doc.sections) {
    ensure(14);
    pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(23, 23, 23);
    pdf.text(section.heading.toUpperCase(), M, y);
    pdf.setDrawColor(226, 221, 213).line(M, y + 1.5, W - M, y + 1.5);
    y += 6;
    for (const [k, v] of section.rows) {
      const lines = pdf.splitTextToSize(v, inner - 52);
      ensure(lines.length * 4 + 2);
      pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(90, 86, 80).text(k, M, y);
      pdf.setFont("helvetica", "normal").setTextColor(23, 23, 23).text(lines, M + 52, y);
      y += lines.length * 4 + 1.5;
    }
    y += 4;
  }

  if (doc.warnings.length) {
    ensure(12);
    pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(140, 47, 55).text(`MISSING INFORMATION (${doc.warnings.length})`, M, y);
    y += 6;
    pdf.setFont("helvetica", "normal").setFontSize(8);
    for (const w of doc.warnings) { ensure(5); pdf.text(`• ${w}`, M, y); y += 4.2; }
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(138, 133, 125);
    pdf.text(`${doc.footer} · page ${i}/${pages}`, M, 290);
  }
  return pdf;
}

export async function exportBriefPdf(doc: BriefDocument, views: { label: string; png: string }[], fileName: string) {
  (await renderBriefPdf(doc, views)).save(fileName);
}
