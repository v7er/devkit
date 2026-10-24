import { lazyTool } from "../lazy";
import type { ToolDefinition } from "../types";

export const cssTools: ToolDefinition[] = [
  {
    id: "box-shadow",
    name: "Box Shadow Generator",
    description: "Compose stacked and inset box shadows with a live preview and copyable CSS.",
    category: "css",
    keywords: ["elevation", "inset", "drop shadow", "blur", "spread", "css"],
    component: lazyTool(() => import("./box-shadow")),
  },
  {
    id: "gradient",
    name: "Gradient Generator",
    description: "Build linear and radial gradients with sortable stops, live preview, and CSS output.",
    category: "css",
    keywords: ["linear", "radial", "color stops", "background", "css"],
    component: lazyTool(() => import("./gradient")),
  },
  {
    id: "flexbox-grid",
    name: "Flexbox & Grid Playground",
    description: "Tune flex and grid properties with a live preview and generated container and item CSS.",
    category: "css",
    keywords: ["flex", "grid", "layout", "justify", "align", "gap", "columns"],
    component: lazyTool(() => import("./flexbox-grid")),
  },
  {
    id: "color-converter",
    name: "Color Converter",
    description: "Convert colors between HEX, RGB, HSL, HSV, and OKLCH, with alpha and contrast checks.",
    category: "css",
    keywords: ["hex", "rgb", "hsl", "hsv", "oklch", "contrast", "accessibility", "alpha"],
    component: lazyTool(() => import("./color-converter")),
  },
  {
    id: "css-minifier",
    name: "CSS Minifier",
    description: "Strip comments and extra whitespace while preserving strings, url() contents, and calc spacing.",
    category: "css",
    keywords: ["minify", "compress", "optimize", "whitespace", "comments"],
    component: lazyTool(() => import("./css-minifier")),
  },
  {
    id: "px-rem",
    name: "px ↔ rem Converter",
    description: "Convert px and rem values in batches against a configurable root font size.",
    category: "css",
    keywords: ["pixels", "root font size", "typography", "units", "batch"],
    component: lazyTool(() => import("./px-rem")),
  },
  {
    id: "border-radius",
    name: "Border Radius Generator",
    description: "Set per-corner or uniform radii, add elliptical corners, and copy the generated CSS.",
    category: "css",
    keywords: ["corners", "ellipse", "round", "radius", "css"],
    component: lazyTool(() => import("./border-radius")),
  },
  {
    id: "tailwind-search",
    name: "Tailwind Class Search",
    description: "Search a curated Tailwind utility reference with class names, CSS, and copy controls.",
    category: "css",
    keywords: ["tailwind", "utility", "classes", "reference", "lookup"],
    component: lazyTool(() => import("./tailwind-search")),
  },
];
