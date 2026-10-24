import { describe, expect, it } from "vitest";
import { TAILWIND_UTILITIES } from "./tailwind-data";
import {
  borderRadiusCss,
  borderRadiusValue,
  boxShadowCss,
  boxShadowValue,
  buildFlexGridCss,
  contrastRatio,
  convertLengthBatch,
  DEFAULT_FLEX_GRID_CONFIG,
  formatHex,
  formatHsl,
  formatHsv,
  formatOklch,
  formatRgb,
  gradientCss,
  gradientToCss,
  hslToRgb,
  hsvToRgb,
  minifyCss,
  oklchToRgb,
  parseColor,
  parseHex,
  parseLengthToken,
  pxToRem,
  readableTextColor,
  remToPx,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  searchTailwindUtilities,
  shadowLayerToCss,
  wcagLevels,
  type BorderRadiusConfig,
  type FlexGridConfig,
  type ShadowLayer,
} from "./logic";

const RED = { r: 255, g: 0, b: 0, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const WHITE = { r: 255, g: 255, b: 255, a: 1 };

function layer(overrides: Partial<ShadowLayer> = {}): ShadowLayer {
  return {
    x: 0,
    y: 4,
    blur: 8,
    spread: 0,
    color: "#000000",
    opacity: 50,
    inset: false,
    ...overrides,
  };
}

function radius(overrides: Partial<BorderRadiusConfig> = {}): BorderRadiusConfig {
  return {
    uniform: false,
    horizontal: [1, 2, 3, 4],
    vertical: [5, 6, 7, 8],
    elliptical: false,
    ...overrides,
  };
}

function flexConfig(overrides: Partial<FlexGridConfig> = {}): FlexGridConfig {
  return { ...DEFAULT_FLEX_GRID_CONFIG, ...overrides };
}

describe("parseHex", () => {
  it("parses six-digit hex", () => {
    expect(parseHex("#ff0000")).toEqual(RED);
  });

  it("expands three-digit hex", () => {
    expect(parseHex("#0f0")).toEqual({ r: 0, g: 255, b: 0, a: 1 });
  });

  it("reads the alpha channel from eight-digit hex", () => {
    const color = parseHex("#ff000080");
    expect(color?.a).toBeCloseTo(0.502, 3);
  });

  it("returns null for invalid values", () => {
    expect(parseHex("#gg0000")).toBeNull();
    expect(parseHex("red")).toBeNull();
    expect(parseHex("#ff000")).toBeNull();
  });
});

describe("parseColor", () => {
  it("parses rgb comma syntax", () => {
    expect(parseColor("rgb(255, 0, 0)")).toEqual(RED);
  });

  it("parses rgba with alpha", () => {
    const color = parseColor("rgba(255, 0, 0, 0.5)");
    expect(color?.a).toBe(0.5);
    expect(color?.r).toBe(255);
  });

  it("parses hsl", () => {
    expect(parseColor("hsl(120, 100%, 50%)")).toEqual({ r: 0, g: 255, b: 0, a: 1 });
  });

  it("parses hsv and hsb aliases", () => {
    expect(parseColor("hsv(240, 100%, 100%)")).toEqual({ r: 0, g: 0, b: 255, a: 1 });
    expect(parseColor("hsb(240, 100%, 100%)")).toEqual({ r: 0, g: 0, b: 255, a: 1 });
  });

  it("parses oklch percentages and slash alpha", () => {
    const color = parseColor("oklch(62.8% 0.2577 29.23 / 50%)");
    expect(color).not.toBeNull();
    expect(color?.r).toBeCloseTo(255, 0);
    expect(color?.g).toBeCloseTo(0, 0);
    expect(color?.b).toBeCloseTo(0, 0);
    expect(color?.a).toBe(0.5);
  });

  it("parses space syntax with slash alpha", () => {
    const color = parseColor("rgb(0 128 255 / 25%)");
    expect(color?.g).toBe(128);
    expect(color?.a).toBe(0.25);
  });

  it("returns null for unsupported or malformed values", () => {
    expect(parseColor("not-a-color")).toBeNull();
    expect(parseColor("rgb(1, 2)")).toBeNull();
    expect(parseColor("hsl(120, 50%)")).toBeNull();
    expect(parseColor("rgb(0 0 0 / 1 / 2)")).toBeNull();
  });
});

describe("color conversions", () => {
  it("converts red to HSL", () => {
    expect(rgbToHsl(RED)).toEqual({ h: 0, s: 100, l: 50, a: 1 });
  });

  it("converts HSL back to RGB", () => {
    expect(hslToRgb(120, 1, 0.5)).toEqual({ r: 0, g: 255, b: 0, a: 1 });
  });

  it("converts red to HSV", () => {
    expect(rgbToHsv(RED)).toEqual({ h: 0, s: 100, v: 100, a: 1 });
  });

  it("converts HSV back to RGB", () => {
    expect(hsvToRgb(240, 1, 1)).toEqual({ r: 0, g: 0, b: 255, a: 1 });
  });

  it("round-trips through OKLCH", () => {
    const oklch = rgbToOklch(RED);
    expect(oklch.l).toBeCloseTo(0.628, 2);
    const back = oklchToRgb(oklch.l, oklch.c, oklch.h);
    expect(back.r).toBeCloseTo(255, 0);
    expect(back.g).toBeCloseTo(0, 0);
    expect(back.b).toBeCloseTo(0, -1);
  });

  it("formats each notation", () => {
    expect(formatHex(RED)).toBe("#ff0000");
    expect(formatHex({ ...RED, a: 0.5 })).toBe("#ff000080");
    expect(formatRgb(RED)).toBe("rgb(255, 0, 0)");
    expect(formatRgb({ ...RED, a: 0.5 })).toBe("rgba(255, 0, 0, 0.5)");
    expect(formatHsl(RED)).toBe("hsl(0, 100%, 50%)");
    expect(formatHsv(RED)).toBe("hsv(0, 100%, 100%)");
    expect(formatOklch(RED)).toMatch(/^oklch\(62\.8% 0\.2577 29\.2/);
  });
});

describe("contrast", () => {
  it("computes the maximum ratio for black on white", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
  });

  it("computes 1 for identical colors", () => {
    expect(contrastRatio(RED, RED)).toBeCloseTo(1, 5);
  });

  it("picks readable text colors", () => {
    expect(readableTextColor(WHITE)).toBe("#000000");
    expect(readableTextColor(BLACK)).toBe("#ffffff");
  });

  it("reports WCAG levels at their thresholds", () => {
    expect(wcagLevels(4.5)).toEqual({ aa: true, aaa: false, aaLarge: true, aaaLarge: true });
    expect(wcagLevels(7)).toEqual({ aa: true, aaa: true, aaLarge: true, aaaLarge: true });
    expect(wcagLevels(2.9).aa).toBe(false);
  });
});

describe("box shadows", () => {
  it("serializes offsets, blur, spread, and color", () => {
    expect(shadowLayerToCss(layer())).toBe("0px 4px 8px 0px rgba(0, 0, 0, 0.5)");
  });

  it("prefixes inset shadows", () => {
    expect(shadowLayerToCss(layer({ inset: true }))).toMatch(/^inset 0px/);
  });

  it("joins multiple layers", () => {
    expect(boxShadowValue([layer(), layer({ x: 2, opacity: 100 })])).toBe(
      "0px 4px 8px 0px rgba(0, 0, 0, 0.5), 2px 4px 8px 0px rgb(0, 0, 0)",
    );
  });

  it("emits a CSS rule", () => {
    expect(boxShadowCss([layer()])).toBe(
      ".shadow {\n  box-shadow: 0px 4px 8px 0px rgba(0, 0, 0, 0.5);\n}",
    );
  });

  it("rejects empty, negative, and out-of-range values", () => {
    expect(() => boxShadowValue([])).toThrow("Add at least one shadow layer.");
    expect(() => shadowLayerToCss(layer({ blur: -1 }))).toThrow("Blur radius cannot be negative.");
    expect(() => shadowLayerToCss(layer({ opacity: 101 }))).toThrow(
      "Opacity must be between 0 and 100.",
    );
    expect(() => shadowLayerToCss(layer({ color: "nope" }))).toThrow(/Invalid shadow color/);
  });
});

describe("gradients", () => {
  it("serializes a linear gradient and sorts stops by position", () => {
    expect(
      gradientToCss({
        type: "linear",
        angle: 90,
        shape: "circle",
        positionX: 50,
        positionY: 50,
        stops: [
          { color: "#ff0000", position: 100 },
          { color: "#0000ff", position: 0 },
        ],
      }),
    ).toBe("linear-gradient(90deg, #0000ff 0%, #ff0000 100%)");
  });

  it("normalizes negative angles", () => {
    const css = gradientToCss({
      type: "linear",
      angle: -90,
      shape: "circle",
      positionX: 50,
      positionY: 50,
      stops: [
        { color: "#000", position: 0 },
        { color: "#fff", position: 100 },
      ],
    });
    expect(css.startsWith("linear-gradient(270deg,")).toBe(true);
  });

  it("serializes a radial gradient with shape and position", () => {
    const css = gradientToCss({
      type: "radial",
      angle: 0,
      shape: "circle",
      positionX: 25,
      positionY: 75,
      stops: [
        { color: "#ffffff", position: 0 },
        { color: "#111111", position: 100 },
      ],
    });
    expect(css).toBe(
      "radial-gradient(circle at 25% 75%, #ffffff 0%, #111111 100%)",
    );
  });

  it("emits a CSS rule", () => {
    expect(
      gradientCss({
        type: "linear",
        angle: 0,
        shape: "circle",
        positionX: 50,
        positionY: 50,
        stops: [
          { color: "#000", position: 0 },
          { color: "#fff", position: 100 },
        ],
      }),
    ).toContain("background-image: linear-gradient(");
  });

  it("rejects too few stops, invalid positions, and bad colors", () => {
    const base = {
      type: "linear" as const,
      angle: 0,
      shape: "circle" as const,
      positionX: 50,
      positionY: 50,
    };
    expect(() =>
      gradientToCss({ ...base, stops: [{ color: "#000", position: 0 }] }),
    ).toThrow("Add at least two color stops.");
    expect(() =>
      gradientToCss({
        ...base,
        stops: [
          { color: "#000", position: 0 },
          { color: "#fff", position: 101 },
        ],
      }),
    ).toThrow("Stop positions must be between 0% and 100%.");
    expect(() =>
      gradientToCss({
        ...base,
        stops: [
          { color: "nope", position: 0 },
          { color: "#fff", position: 100 },
        ],
      }),
    ).toThrow(/Invalid stop color/);
  });
});

describe("minifyCss", () => {
  it("removes comments and collapses whitespace", () => {
    expect(minifyCss("/* c */\n.a {\n  color: red;\n  margin: 0  auto;\n}\n")).toBe(
      ".a{color:red;margin:0 auto;}",
    );
  });

  it("preserves quoted strings", () => {
    expect(minifyCss('.a { content: "a  b; /* x */"; }')).toBe(
      '.a{content:"a  b; /* x */";}',
    );
  });

  it("preserves url() contents", () => {
    expect(minifyCss(".a { background: url( 'a  b.png' ); }")).toBe(
      ".a{background:url( 'a  b.png' );}",
    );
  });

  it("keeps spaces around calc operators", () => {
    expect(minifyCss(".a{width:calc(100% - 20px)}")).toBe(".a{width:calc(100% - 20px)}");
  });

  it("returns an empty string for blank input", () => {
    expect(minifyCss("  \n\t ")).toBe("");
  });

  it("reports unterminated constructs", () => {
    expect(() => minifyCss('.a{content:"oops}')).toThrow(/Unterminated string/);
    expect(() => minifyCss(".a{background:url(oops}")).toThrow(/Unterminated url/);
    expect(() => minifyCss("/* oops")).toThrow(/Unterminated comment/);
  });
});

describe("px and rem", () => {
  it("converts in both directions", () => {
    expect(pxToRem(16, 16)).toBe(1);
    expect(pxToRem(24, 16)).toBe(1.5);
    expect(remToPx(1.5, 16)).toBe(24);
  });

  it("rejects invalid base sizes", () => {
    expect(() => pxToRem(16, 0)).toThrow("Base font size must be a positive number.");
    expect(() => remToPx(1, Number.NaN)).toThrow("Base font size must be a positive number.");
  });

  it("parses length tokens", () => {
    expect(parseLengthToken("1.5rem")).toEqual({ value: 1.5, unit: "rem" });
    expect(parseLengthToken("24 px")).toEqual({ value: 24, unit: "px" });
    expect(parseLengthToken("12")).toEqual({ value: 12, unit: "unitless" });
    expect(parseLengthToken("nope")).toBeNull();
  });

  it("converts a batch and reports bad lines", () => {
    const result = convertLengthBatch("16px\n2rem\n\n24\nabc", 16, "px-to-rem");
    expect(result.rows).toEqual([
      { input: "16px", px: 16, rem: 1 },
      { input: "2rem", px: 32, rem: 2 },
      { input: "24", px: 24, rem: 1.5 },
    ]);
    expect(result.errors).toEqual(['Line 5: "abc" is not a px or rem value.']);
  });

  it("treats unitless values as the input unit in rem-to-px mode", () => {
    const result = convertLengthBatch("2", 16, "rem-to-px");
    expect(result.rows[0]).toEqual({ input: "2", px: 32, rem: 2 });
  });

  it("reports invalid base and oversized batches", () => {
    expect(convertLengthBatch("16", 0, "px-to-rem").errors).toEqual([
      "Base font size must be a positive number.",
    ]);
    const oversized = Array.from({ length: 501 }, () => "16").join("\n");
    expect(convertLengthBatch(oversized, 16, "px-to-rem").errors).toEqual([
      "Limit each batch to 500 values.",
    ]);
  });
});

describe("border radius", () => {
  it("uses a single value in uniform mode", () => {
    expect(borderRadiusValue(radius({ uniform: true }))).toBe("1px");
  });

  it("writes per-corner values", () => {
    expect(borderRadiusValue(radius())).toBe("1px 2px 3px 4px");
  });

  it("writes elliptical slash syntax", () => {
    expect(borderRadiusValue(radius({ elliptical: true }))).toBe(
      "1px 2px 3px 4px / 5px 6px 7px 8px",
    );
  });

  it("emits a CSS rule", () => {
    expect(borderRadiusCss(radius())).toBe(
      ".radius {\n  border-radius: 1px 2px 3px 4px;\n}",
    );
  });

  it("rejects negative radii", () => {
    expect(() => borderRadiusValue(radius({ horizontal: [-1, 2, 3, 4] }))).toThrow(
      "Radii cannot be negative.",
    );
  });
});

describe("flex and grid CSS", () => {
  it("builds flex container and item rules", () => {
    const result = buildFlexGridCss(flexConfig());
    expect(result.errors).toEqual([]);
    expect(result.css).toContain("display: flex;");
    expect(result.css).toContain("justify-content: center;");
    expect(result.css).toContain("align-items: center;");
    expect(result.css).toContain("gap: 16px;");
    expect(result.css).toContain("flex: 1 1 auto;");
  });

  it("builds grid template rules", () => {
    const result = buildFlexGridCss(flexConfig({ display: "grid" }));
    expect(result.css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(result.css).toContain("grid-auto-flow: row;");
    expect(result.css).not.toContain("flex-direction");
  });

  it("truncates the item order", () => {
    const result = buildFlexGridCss(flexConfig({ order: 2.9 }));
    expect(result.css).toContain("order: 2;");
  });

  it("reports invalid numbers", () => {
    const result = buildFlexGridCss(flexConfig({ gap: -1, itemGrow: -2, order: Number.NaN }));
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Gap must be zero or greater.",
        "Item grow must be zero or greater.",
        "Item order must be a number.",
      ]),
    );
    expect(result.css).toBe("");
  });

  it("rejects empty and unsafe template values", () => {
    expect(buildFlexGridCss(flexConfig({ gridTemplateColumns: "  " })).errors).toEqual([
      "Grid columns cannot be empty.",
    ]);
    expect(
      buildFlexGridCss(flexConfig({ gridTemplateColumns: "1fr; color:red" })).errors,
    ).toEqual(["Grid columns cannot contain ; { } < > or comments."]);
  });
});

describe("tailwind search", () => {
  it("ships unique class names with descriptions and CSS", () => {
    const names = TAILWIND_UTILITIES.map((utility) => utility.className);
    expect(new Set(names).size).toBe(names.length);
    for (const utility of TAILWIND_UTILITIES) {
      expect(utility.description.length).toBeGreaterThan(0);
      expect(utility.css.length).toBeGreaterThan(0);
    }
  });

  it("ranks an exact class name first", () => {
    const results = searchTailwindUtilities(TAILWIND_UTILITIES, "flex");
    expect(results[0]?.className).toBe("flex");
  });

  it("matches keywords and is case insensitive", () => {
    const results = searchTailwindUtilities(TAILWIND_UTILITIES, "FLEXBOX");
    expect(results.some((utility) => utility.className === "flex")).toBe(true);
  });

  it("filters by category", () => {
    const results = searchTailwindUtilities(TAILWIND_UTILITIES, "", "borders");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((utility) => utility.category === "borders")).toBe(true);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchTailwindUtilities(TAILWIND_UTILITIES, "zzzznotautility")).toEqual([]);
  });

  it("returns every utility for an empty query", () => {
    expect(searchTailwindUtilities(TAILWIND_UTILITIES, " ")).toHaveLength(
      TAILWIND_UTILITIES.length,
    );
  });
});
