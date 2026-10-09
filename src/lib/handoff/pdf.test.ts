import { afterEach, describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import { stressDocument, SPECIAL } from "@/test/pdf-stress";
import { PAGE, pdfSafe, renderBriefPdf } from "./pdf";
import { BRIEF_DISCLAIMER } from "./technical";

type Call = { text: string; x: number; y: number; page: number; width: number };

/** Instrument a jsPDF instance: record every text line (page, position, width) and rect height. */
function recorder() {
  const calls: Call[] = [];
  const rects: number[] = [];
  const onCreate = (pdf: jsPDF) => {
    const text = pdf.text.bind(pdf);
    pdf.text = ((t: string | string[], x: number, y: number, ...rest: unknown[]) => {
      const lines = Array.isArray(t) ? t : [t];
      const fs = pdf.getFontSize();
      lines.forEach((line, i) => calls.push({ text: line, x, y: y + (i * fs * 1.2 * 25.4) / 72, page: pdf.getCurrentPageInfo().pageNumber, width: pdf.getTextWidth(line) }));
      return (text as (...a: unknown[]) => jsPDF)(t, x, y, ...rest);
    }) as typeof pdf.text;
    const rect = pdf.rect.bind(pdf);
    pdf.rect = ((x: number, y: number, w: number, h: number, style?: string | null) => {
      rects.push(h);
      return rect(x, y, w, h, style);
    }) as typeof pdf.rect;
  };
  return { calls, rects, onCreate };
}

afterEach(() => vi.restoreAllMocks());

describe("PDF text safety", () => {
  it("keeps WinAnsi typography, maps common symbols and flags the rest", () => {
    expect(pdfSafe("Crêpe — “soft” ± ½ • … Ñandú")).toEqual({ text: "Crêpe — “soft” ± ½ • … Ñandú", replaced: false });
    expect(pdfSafe("A → B ★ ≤ 2")).toEqual({ text: "A -> B * <= 2", replaced: false });
    expect(pdfSafe("中文 Ω")).toEqual({ text: "?? ?", replaced: true });
  });
});

describe("PDF layout (stress brief)", () => {
  it("never draws outside the page or body area, across multiple pages", async () => {
    const { calls, onCreate } = recorder();
    const pdf = await renderBriefPdf(stressDocument(), [], { onCreate });
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    const { width, margin, bodyBottom, footerY } = PAGE;
    for (const c of calls) {
      expect(c.x, c.text).toBeGreaterThanOrEqual(margin - 0.01);
      expect(c.x + c.width, c.text).toBeLessThanOrEqual(width - margin + 0.5);
      const isFooter = Math.abs(c.y - footerY) < 0.01;
      if (!isFooter) expect(c.y, c.text).toBeLessThanOrEqual(bodyBottom + 0.01);
    }
  });

  it("wraps long labels inside the label column instead of overlapping values", async () => {
    const { calls, onCreate } = recorder();
    await renderBriefPdf(stressDocument(), [], { onCreate });
    const label = calls.filter((c) => c.x === PAGE.margin && c.text.startsWith("Across back"));
    expect(label).toHaveLength(1);
    expect(label[0].width).toBeLessThanOrEqual(46.5);
  });

  it("continues long sections and warnings on new pages with a heading", async () => {
    const { calls, onCreate } = recorder();
    await renderBriefPdf(stressDocument(), [], { onCreate });
    expect(calls.some((c) => c.text === "Construction (continued)" && c.page > 1)).toBe(true);
    const continued = calls.filter((c) => c.text.endsWith("(continued)"));
    for (const c of continued) expect(c.y).toBeLessThan(PAGE.margin + 1); // always at the top of a page
  });

  it("sizes the disclaimer box to its wrapped text", async () => {
    const { rects, onCreate } = recorder();
    const doc = stressDocument();
    await renderBriefPdf(doc, [], { onCreate });
    await renderBriefPdf({ ...doc, disclaimer: `${BRIEF_DISCLAIMER} ${BRIEF_DISCLAIMER} ${BRIEF_DISCLAIMER}` }, [], { onCreate });
    expect(rects[1]).toBeGreaterThan(rects[0]);
  });

  it("reports replaced characters and lists every missing-information warning", async () => {
    const doc = stressDocument();
    expect(doc.sections.flatMap((s) => s.rows).some(([, v]) => v.includes(SPECIAL))).toBe(true);
    const raw = (await renderBriefPdf(doc, [], { compress: false })).output();
    expect(raw).toContain("replaced with");
    expect(raw).not.toContain("中");
    for (const w of doc.warnings) expect(raw).toContain(pdfSafe(w).text.slice(0, 30));
  });

  it("compresses output", async () => {
    const pdf = await renderBriefPdf(stressDocument(), []);
    expect(pdf.output("arraybuffer").byteLength).toBeLessThan(60_000);
  });
});
