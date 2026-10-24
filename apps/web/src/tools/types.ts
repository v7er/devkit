import type { ComponentType, LazyExoticComponent } from "react";
import type { LucideIcon } from "lucide-react";

export type ToolCategory =
  | "image"
  | "security"
  | "encoding"
  | "data"
  | "text"
  | "web"
  | "css"
  | "datetime"
  | "code"
  | "misc";

export interface ToolDefinition {
  /** Stable kebab-case identifier, also used in the URL. */
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  keywords: string[];
  component: LazyExoticComponent<ComponentType>;
  featured?: boolean;
}

export interface CategoryInfo {
  id: ToolCategory;
  name: string;
  description: string;
  icon: LucideIcon;
}

export interface SearchEntry {
  tool: ToolDefinition;
  score: number;
}
