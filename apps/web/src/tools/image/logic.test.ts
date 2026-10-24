import { describe, expect, it } from "vitest";
import { bytesToBase64 } from "@/lib/encoding";
import {
  MAX_CANVAS_DIMENSION,
  buildIco,
  centerCrop,
  clampCropArea,
  containRect,
  cropFromDrag,
  cropFromPixels,
  cropPixels,
  describeOrientation,
  detectImageMime,
  extensionForMime,
  fileBaseName,
  fitToMaxEdge,
  fitWithin,
  formatSignedPercent,
  isLossyFormat,
  mimeForFormat,
  optimizeSvg,
  parseDimension,
  parseExif,
  parseImageBase64,
  placeholderFontSize,
  quantizePalette,
  savingsPercent,
  scaleByPercent,
  validateCanvasSize,
  withExtension,
} from "./logic";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngBytes(extra = 4): Uint8Array {
  return new Uint8Array([...PNG_SIGNATURE, ...new Array<number>(extra).fill(0)]);
}

describe("format and dimension helpers", () => {
  it("maps formats to MIME types and extensions", () => {
    expect(mimeForFormat("jpeg")).toEqual({ mime: "image/jpeg", extension: "jpg" });
    expect(mimeForFormat("webp")).toEqual({ mime: "image/webp", extension: "webp" });
    expect(isLossyFormat("jpeg")).toBe(true);
    expect(isLossyFormat("png")).toBe(false);
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/svg+xml")).toBe("svg");
    expect(extensionForMime("image/avif")).toBe("avif");
    expect(extensionForMime("application/octet-stream")).toBe("bin");
  });

  it("derives file names without touching the parent path", () => {
    expect(fileBaseName("/tmp/photo.final.png")).toBe("photo.final");
    expect(fileBaseName("C:\\images\\photo.jpg")).toBe("photo");
    expect(fileBaseName(".hidden")).toBe("image");
    expect(fileBaseName("")).toBe("image");
    expect(withExtension("photo.png", "webp")).toBe("photo.webp");
  });

  it("parses pixel input strictly", () => {
    expect(parseDimension("1200")).toBe(1200);
    expect(parseDimension(" 42 ")).toBe(42);
    expect(parseDimension("")).toBeNull();
    expect(parseDimension("0")).toBeNull();
    expect(parseDimension("-1")).toBeNull();
    expect(parseDimension("1.5")).toBeNull();
    expect(parseDimension("abc")).toBeNull();
  });

  it("rejects canvas sizes beyond the caps", () => {
    expect(validateCanvasSize(800, 600)).toBeNull();
    expect(validateCanvasSize(0, 600)).toMatch(/positive whole numbers/);
    expect(validateCanvasSize(MAX_CANVAS_DIMENSION + 1, 10)).toMatch(/capped/);
    expect(validateCanvasSize(8000, 8000)).toMatch(/too large/);
  });

  it("fits images inside a box with optional upscaling", () => {
    expect(fitWithin(400, 200, 100, 100)).toEqual({ width: 100, height: 50 });
    expect(fitWithin(100, 50, 200, 200)).toEqual({ width: 100, height: 50 });
    expect(fitWithin(100, 50, 200, 200, true)).toEqual({ width: 200, height: 100 });
    expect(fitToMaxEdge(400, 200, 100)).toEqual({ width: 100, height: 50 });
    expect(fitToMaxEdge(400, 200, 1000)).toEqual({ width: 400, height: 200 });
    expect(fitToMaxEdge(400, 200, 1000, true)).toEqual({ width: 1000, height: 500 });
    expect(() => fitWithin(0, 100, 10, 10)).toThrow(/positive/);
    expect(() => fitToMaxEdge(100, 100, 0)).toThrow(/positive/);
  });

  it("scales by percentage", () => {
    expect(scaleByPercent(400, 200, 25)).toEqual({ width: 100, height: 50 });
    expect(scaleByPercent(400, 200, 200)).toEqual({ width: 800, height: 400 });
    expect(() => scaleByPercent(400, 200, 0)).toThrow(/greater than zero/);
    expect(() => scaleByPercent(0, 200, 50)).toThrow(/positive/);
  });

  it("centers a contained rectangle", () => {
    expect(containRect(200, 100, 100, 100)).toEqual({ x: 0, y: 25, width: 100, height: 50 });
    expect(containRect(100, 200, 100, 100)).toEqual({ x: 25, y: 0, width: 50, height: 100 });
    expect(() => containRect(100, 100, 0, 100)).toThrow(/positive/);
  });

  it("formats byte savings", () => {
    expect(savingsPercent(1000, 400)).toBe(60);
    expect(savingsPercent(1000, 1250)).toBe(-25);
    expect(savingsPercent(0, 100)).toBe(0);
    expect(savingsPercent(Number.NaN, 100)).toBe(0);
    expect(formatSignedPercent(12.34)).toBe("+12.3%");
    expect(formatSignedPercent(-5.26)).toBe("-5.3%");
    expect(formatSignedPercent(-0.01)).toBe("0.0%");
    expect(formatSignedPercent(0)).toBe("0.0%");
  });
});

describe("crop math", () => {
  it("centers a crop for an aspect ratio", () => {
    expect(centerCrop(null)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(centerCrop(1)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(centerCrop(2)).toEqual({ x: 0, y: 0.25, width: 1, height: 0.5 });
    expect(centerCrop(0.5)).toEqual({ x: 0.25, y: 0, width: 0.5, height: 1 });
    expect(() => centerCrop(0)).toThrow(/greater than zero/);
  });

  it("clamps crop areas to the unit square", () => {
    expect(clampCropArea({ x: 1.2, y: -0.2, width: 0.5, height: 2 })).toEqual({
      x: 1,
      y: 0,
      width: 0,
      height: 1,
    });
    expect(clampCropArea({ x: Number.NaN, y: 0.5, width: 0.5, height: 0.5 })).toEqual({
      x: 0,
      y: 0.5,
      width: 0.5,
      height: 0.5,
    });
  });

  it("builds drag rectangles in either direction", () => {
    const forward = cropFromDrag({ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.8 }, null);
    expect(forward.x).toBeCloseTo(0.2);
    expect(forward.y).toBeCloseTo(0.2);
    expect(forward.width).toBeCloseTo(0.4);
    expect(forward.height).toBeCloseTo(0.6);
    const backward = cropFromDrag({ x: 0.6, y: 0.8 }, { x: 0.2, y: 0.2 }, null);
    expect(backward.x).toBeCloseTo(0.2);
    expect(backward.y).toBeCloseTo(0.2);
    expect(backward.width).toBeCloseTo(0.4);
    expect(backward.height).toBeCloseTo(0.6);
    const square = cropFromDrag({ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.8 }, 1);
    expect(square.x).toBeCloseTo(0.2);
    expect(square.y).toBeCloseTo(0.2);
    expect(square.width).toBeCloseTo(0.6);
    expect(square.height).toBeCloseTo(0.6);
  });

  it("converts normalized and pixel rectangles", () => {
    expect(cropPixels({ x: 0.25, y: 0.5, width: 0.5, height: 0.5 }, 400, 200)).toEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    expect(cropFromPixels({ x: 100, y: 100, width: 200, height: 100 }, 400, 200)).toEqual({
      x: 0.25,
      y: 0.5,
      width: 0.5,
      height: 0.5,
    });
    expect(() => cropPixels({ x: 0, y: 0, width: 0, height: 0.5 }, 400, 200)).toThrow(
      /Select a crop area/,
    );
    expect(() => cropPixels({ x: 0, y: 0, width: 0.5, height: 0.5 }, 0, 200)).toThrow(
      /positive/,
    );
    expect(() => cropFromPixels({ x: 390, y: 0, width: 20, height: 20 }, 400, 200)).toThrow(
      /inside the image/,
    );
    expect(() => cropFromPixels({ x: 0, y: 0, width: 0, height: 20 }, 400, 200)).toThrow(
      /greater than zero/,
    );
  });
});

describe("placeholder sizing", () => {
  it("scales text with the canvas and clamps the result", () => {
    expect(placeholderFontSize(1200, 630, 10)).toBe(189);
    expect(placeholderFontSize(100, 100, 100)).toBe(8);
    expect(placeholderFontSize(4000, 4000, 1)).toBe(360);
    expect(() => placeholderFontSize(0, 100, 3)).toThrow(/positive/);
  });
});

describe("SVG optimization", () => {
  const source = `<?xml version="1.0" encoding="UTF-8"?>
<!-- keep out -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" inkscape:version="1.0" viewBox="0 0 10 10">
  <metadata><title>Editor metadata</title></metadata>
  <sodipodi:namedview id="base"/>
  <g>
    <path d="M 0 0 L 10 10 Z" fill="#ff0000"/>
  </g>
  <text xml:space="preserve">  hello  </text>
  <style>.a { fill: red; }</style>
</svg>`;

  it("removes comments, metadata, editor data, and indentation", () => {
    const { output, stats } = optimizeSvg(source);
    expect(output).not.toContain("<!--");
    expect(output).not.toContain("<metadata");
    expect(output).not.toContain("inkscape");
    expect(output).not.toContain("sodipodi");
    expect(output).not.toContain("<?xml");
    expect(output).toContain("M 0 0 L 10 10 Z");
    expect(output).toContain("  hello  ");
    expect(output).toContain('fill="#ff0000"');
    expect(stats.comments).toBe(1);
    expect(stats.metadata).toBe(1);
    expect(stats.editorNodes).toBe(1);
    expect(stats.editorAttributes).toBeGreaterThanOrEqual(1);
    expect(stats.whitespaceNodes).toBeGreaterThan(0);
  });

  it("keeps path data byte-for-byte identical", () => {
    const { output } = optimizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1.5,2.5C3,4 5,6 7,8z"/></svg>',
    );
    expect(output).toContain('d="M1.5,2.5C3,4 5,6 7,8z"');
  });

  it("rejects empty, malformed, and non-SVG documents", () => {
    expect(() => optimizeSvg("   ")).toThrow(/Load or paste/);
    expect(() => optimizeSvg("<svg><g></svg>")).toThrow(/not valid SVG/);
    expect(() => optimizeSvg("<root><child/></root>")).toThrow(/not <svg>/);
  });
});

describe("palette quantization", () => {
  it("returns dominant colors with percentages", () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,
      255, 0, 0, 255,
      0, 0, 255, 255,
      0, 0, 255, 255,
    ]);
    const palette = quantizePalette(pixels, 2);
    expect(palette).toHaveLength(2);
    expect(palette.map((color) => color.hex).sort()).toEqual(["#0000ff", "#ff0000"]);
    expect(palette.every((color) => color.percentage === 50)).toBe(true);
    expect(palette.reduce((total, color) => total + color.count, 0)).toBe(4);
  });

  it("ignores transparent pixels and merges duplicate colors", () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 0,
      0, 255, 0, 255,
      0, 255, 0, 255,
    ]);
    const palette = quantizePalette(pixels, 8);
    expect(palette).toHaveLength(1);
    expect(palette[0]).toMatchObject({ hex: "#00ff00", count: 2, percentage: 100 });
  });

  it("rejects malformed pixel buffers and counts", () => {
    expect(() => quantizePalette(new Uint8ClampedArray(5), 4)).toThrow(/RGBA/);
    expect(() => quantizePalette(new Uint8ClampedArray(4), 1)).toThrow(/between 2 and 32/);
    expect(() => quantizePalette(new Uint8ClampedArray(4), 64)).toThrow(/between 2 and 32/);
    expect(() => quantizePalette(new Uint8ClampedArray([0, 0, 0, 0]), 4)).toThrow(
      /no visible pixels/,
    );
  });
});

describe("ICO container", () => {
  const png = pngBytes();

  it("writes an ICONDIR with little-endian entries", () => {
    const ico = buildIco([
      { size: 16, png },
      { size: 256, png },
    ]);
    const view = new DataView(ico.buffer);
    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(2);
    expect(view.getUint8(6)).toBe(16);
    expect(view.getUint8(22)).toBe(0);
    expect(view.getUint8(23)).toBe(0);
    expect(view.getUint16(22 + 4, true)).toBe(1);
    expect(view.getUint16(22 + 6, true)).toBe(32);
    expect(view.getUint32(6 + 8, true)).toBe(png.length);
    expect(view.getUint32(6 + 12, true)).toBe(38);
    expect(view.getUint32(22 + 12, true)).toBe(50);
    expect(Array.from(ico.slice(38, 38 + png.length))).toEqual(Array.from(png));
    expect(Array.from(ico.slice(50, 50 + png.length))).toEqual(Array.from(png));
  });

  it("rejects empty, oversized, and non-PNG input", () => {
    expect(() => buildIco([])).toThrow(/At least one image/);
    expect(() => buildIco([{ size: 0, png }])).toThrow(/between 1 and 256/);
    expect(() => buildIco([{ size: 257, png }])).toThrow(/between 1 and 256/);
    expect(() => buildIco([{ size: 16, png: new Uint8Array(8) }])).toThrow(/PNG encoded/);
    expect(() => buildIco([{ size: 16, png: new Uint8Array(4) }])).toThrow(/empty/);
  });
});

describe("image MIME detection and Base64 parsing", () => {
  it("detects common image signatures and SVG text", () => {
    expect(detectImageMime(pngBytes())).toEqual({ mime: "image/png", extension: "png" });
    expect(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
      mime: "image/jpeg",
      extension: "jpg",
    });
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(detectImageMime(webp)).toEqual({ mime: "image/webp", extension: "webp" });
    expect(detectImageMime(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toEqual({
      mime: "image/svg+xml",
      extension: "svg",
    });
    expect(detectImageMime(new TextEncoder().encode("hello"))).toBeNull();
    expect(detectImageMime(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("parses raw Base64 and data URLs", () => {
    const bytes = pngBytes();
    const base64 = bytesToBase64(bytes);
    const parsed = parseImageBase64(base64);
    expect(parsed.bytes).toEqual(bytes);
    expect(parsed.base64).toBe(base64);
    expect(parsed.mime).toBe("image/png");
    expect(parsed.extension).toBe("png");
    expect(parsed.declaredMime).toBeNull();
    expect(parsed.dataUrl).toBe(`data:image/png;base64,${base64}`);

    const fromUrl = parseImageBase64(`data:image/jpeg;base64,${base64}`);
    expect(fromUrl.declaredMime).toBe("image/jpeg");
    expect(fromUrl.mime).toBe("image/png");
  });

  it("rejects empty, non-base64, non-image, and oversized payloads", () => {
    const base64 = bytesToBase64(pngBytes());
    expect(() => parseImageBase64("")).toThrow(/Paste Base64/);
    expect(() => parseImageBase64("data:image/png,abc")).toThrow(/Only base64/);
    expect(() => parseImageBase64("data:image/png;base64")).toThrow(/missing its comma/);
    expect(() => parseImageBase64("!!!!")).toThrow(/valid Base64/);
    expect(() => parseImageBase64(bytesToBase64(new TextEncoder().encode("hello")))).toThrow(
      /not a recognized image format/,
    );
    expect(() => parseImageBase64(base64, 4)).toThrow(/larger than/);
  });
});

describe("EXIF parsing", () => {
  function buildExifJpeg(): Uint8Array {
    const tiff = new Uint8Array(334);
    const view = new DataView(tiff.buffer);
    const encoder = new TextEncoder();

    const entry = (offset: number, tag: number, type: number, count: number, value: number) => {
      view.setUint16(offset, tag, true);
      view.setUint16(offset + 2, type, true);
      view.setUint32(offset + 4, count, true);
      view.setUint32(offset + 8, value, true);
    };
    const rational = (offset: number, numerator: number, denominator: number) => {
      view.setUint32(offset, numerator, true);
      view.setUint32(offset + 4, denominator, true);
    };

    tiff[0] = 0x49;
    tiff[1] = 0x49;
    view.setUint16(2, 42, true);
    view.setUint32(4, 8, true);

    view.setUint16(8, 5, true);
    entry(10, 0x0112, 3, 1, 6);
    entry(22, 0x010f, 2, 8, 74);
    entry(34, 0x0110, 2, 8, 82);
    entry(46, 0x8769, 4, 1, 90);
    entry(58, 0x8825, 4, 1, 200);
    view.setUint32(70, 0, true);
    tiff.set(encoder.encode("TestCam\0"), 74);
    tiff.set(encoder.encode("Model X\0"), 82);

    view.setUint16(90, 5, true);
    entry(92, 0x829a, 5, 1, 156);
    entry(104, 0x829d, 5, 1, 164);
    entry(116, 0x8827, 3, 1, 200);
    entry(128, 0x920a, 5, 1, 172);
    entry(140, 0x9003, 2, 20, 180);
    view.setUint32(152, 0, true);
    rational(156, 1, 250);
    rational(164, 28, 10);
    rational(172, 50, 1);
    tiff.set(encoder.encode("2024:05:06 07:08:09\0"), 180);

    view.setUint16(200, 6, true);
    entry(202, 0x0001, 2, 2, 0);
    tiff[210] = 0x4e;
    entry(214, 0x0002, 5, 3, 278);
    entry(226, 0x0003, 2, 2, 0);
    tiff[234] = 0x57;
    entry(238, 0x0004, 5, 3, 302);
    entry(250, 0x0005, 1, 1, 0);
    entry(262, 0x0006, 5, 1, 326);
    view.setUint32(274, 0, true);
    rational(278, 37, 1);
    rational(286, 46, 1);
    rational(294, 2964, 100);
    rational(302, 122, 1);
    rational(310, 25, 1);
    rational(318, 912, 100);
    rational(326, 100, 1);

    const app1Length = 2 + 6 + tiff.length;
    const file = new Uint8Array(2 + 2 + app1Length + 2);
    const fileView = new DataView(file.buffer);
    file[0] = 0xff;
    file[1] = 0xd8;
    file[2] = 0xff;
    file[3] = 0xe1;
    fileView.setUint16(4, app1Length, false);
    file.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 6);
    file.set(tiff, 12);
    file[file.length - 2] = 0xff;
    file[file.length - 1] = 0xd9;
    return file;
  }

  it("decodes camera, exposure, and GPS fields", () => {
    const result = parseExif(buildExifJpeg());
    expect(result.hasExif).toBe(true);
    expect(result.orientation).toBe(6);
    expect(result.note).toMatch(/untrusted/i);

    const valueOf = (label: string) => result.entries.find((entry) => entry.label === label)?.value;
    expect(valueOf("Make")).toBe("TestCam");
    expect(valueOf("Model")).toBe("Model X");
    expect(valueOf("Orientation")).toContain("90° clockwise");
    expect(valueOf("Exposure time")).toBe("1/250 s");
    expect(valueOf("Aperture")).toBe("f/2.8");
    expect(valueOf("ISO")).toBe("200");
    expect(valueOf("Focal length")).toBe("50 mm");
    expect(valueOf("Captured")).toBe("2024:05:06 07:08:09");

    expect(result.gps?.latitude).toBeCloseTo(37.7749, 4);
    expect(result.gps?.longitude).toBeCloseTo(-122.4192, 4);
    expect(result.gps?.altitude).toBe(100);
  });

  it("reports non-JPEG, missing, and malformed EXIF without throwing", () => {
    expect(parseExif(new TextEncoder().encode("not a jpeg")).note).toMatch(/Not a JPEG/);
    expect(parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])).note).toMatch(/No EXIF/);

    const valid = buildExifJpeg();
    const malformed = buildExifJpeg();
    malformed[12] = 0x58;
    malformed[13] = 0x58;
    const broken = parseExif(malformed);
    expect(broken.hasExif).toBe(false);
    expect(broken.entries).toEqual([]);
    expect(broken.note).toMatch(/malformed/);

    expect(() => parseExif(valid.subarray(0, 20))).not.toThrow();
    expect(() => parseExif(new ArrayBuffer(0))).not.toThrow();
  });

  it("describes orientation values", () => {
    expect(describeOrientation(1)).toBe("Normal");
    expect(describeOrientation(6)).toMatch(/90° clockwise/);
    expect(describeOrientation(99)).toBe("Unknown");
  });
});
