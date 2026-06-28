import { describe, expect, it } from "vitest";
import { createCode128SvgMarkup } from "@/lib/barcode";

describe("createCode128SvgMarkup", () => {
  it("generates Code 128 SVG markup for a printable tag id", () => {
    const svg = createCode128SvgMarkup("IT-LAP-00002-TAG");

    expect(svg).toContain("<svg");
    expect(svg).toContain("Code 128 barcode");
    expect(svg).toContain("<rect");
  });

  it("encodes different tag ids into different bar patterns", () => {
    const first = createCode128SvgMarkup("IT-LAP-00001-TAG");
    const second = createCode128SvgMarkup("IT-LAP-00002-TAG");

    expect(first).not.toEqual(second);
  });

  it("returns no markup for unsupported values", () => {
    expect(createCode128SvgMarkup("")).toBe("");
    expect(createCode128SvgMarkup("TAG-اردو")).toBe("");
  });
});
