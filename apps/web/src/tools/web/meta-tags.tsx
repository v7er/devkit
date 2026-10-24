import { useMemo, useState } from "react";
import {
  Alert,
  CodeOutput,
  Field,
  Input,
  Panel,
  Select,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { generateMetaTags, textLength, type MetaInput } from "./logic";

const EMPTY: MetaInput = {
  title: "",
  description: "",
  canonical: "",
  robots: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  ogUrl: "",
  ogType: "",
  ogSiteName: "",
  twitterCard: "",
  twitterSite: "",
  twitterCreator: "",
  twitterTitle: "",
  twitterDescription: "",
  twitterImage: "",
  themeColor: "",
};

const ROBOTS_OPTIONS = [
  { value: "", label: "Omit robots tag" },
  { value: "index,follow", label: "index, follow" },
  { value: "index,nofollow", label: "index, nofollow" },
  { value: "noindex,follow", label: "noindex, follow" },
  { value: "noindex,nofollow", label: "noindex, nofollow" },
];

const OG_TYPES = [
  { value: "", label: "Omit og:type" },
  { value: "website", label: "website" },
  { value: "article", label: "article" },
  { value: "profile", label: "profile" },
  { value: "product", label: "product" },
  { value: "video.other", label: "video.other" },
];

const CARD_TYPES = [
  { value: "", label: "Omit twitter:card" },
  { value: "summary", label: "summary" },
  { value: "summary_large_image", label: "summary_large_image" },
  { value: "app", label: "app" },
  { value: "player", label: "player" },
];

function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <Field label={label}>
      {multiline ? (
        <TextArea
          value={value}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
      ) : (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
      )}
    </Field>
  );
}

export default function MetaTagsTool() {
  const [form, setForm] = useState<MetaInput>(EMPTY);
  const output = useMemo(() => generateMetaTags(form), [form]);

  function update<K extends keyof MetaInput>(key: K, value: MetaInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Core metadata" description="Search-facing title, description, canonical URL, and robots policy.">
          <div className="space-y-3">
            <Field
              label="Title"
              action={
                <span className="text-[10px] text-faint">{textLength(form.title)}/60</span>
              }
              hint="Shown as the search result headline. Keep it under about 60 characters."
            >
              <Input
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="Fast local developer tools"
                aria-label="Page title"
              />
            </Field>
            <Field
              label="Description"
              action={
                <span className="text-[10px] text-faint">{textLength(form.description)}/160</span>
              }
              hint="Often used as the search snippet. Aim for 50–160 characters."
            >
              <TextArea
                value={form.description}
                rows={3}
                onChange={(event) => update("description", event.target.value)}
                placeholder="A short sentence describing the page."
                aria-label="Meta description"
              />
            </Field>
            <TextField
              label="Canonical URL"
              value={form.canonical}
              onChange={(value) => update("canonical", value)}
              placeholder="https://example.com/page"
            />
            <Select
              label="Robots"
              value={form.robots}
              onChange={(value) => update("robots", value)}
              options={ROBOTS_OPTIONS}
            />
            <TextField
              label="Theme color"
              value={form.themeColor}
              onChange={(value) => update("themeColor", value)}
              placeholder="#0f172a"
            />
          </div>
        </Panel>

        <Panel title="Social cards" description="Open Graph and Twitter card metadata for shared links.">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">Open Graph</p>
            <TextField
              label="og:title"
              value={form.ogTitle}
              onChange={(value) => update("ogTitle", value)}
              placeholder="Defaults to the page title when left empty"
            />
            <TextField
              label="og:description"
              value={form.ogDescription}
              onChange={(value) => update("ogDescription", value)}
              placeholder="Short description for social previews"
              multiline
            />
            <TextField
              label="og:image"
              value={form.ogImage}
              onChange={(value) => update("ogImage", value)}
              placeholder="https://example.com/card.png"
            />
            <TextField
              label="og:url"
              value={form.ogUrl}
              onChange={(value) => update("ogUrl", value)}
              placeholder="https://example.com/page"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="og:type"
                value={form.ogType}
                onChange={(value) => update("ogType", value)}
                options={OG_TYPES}
              />
              <TextField
                label="og:site_name"
                value={form.ogSiteName}
                onChange={(value) => update("ogSiteName", value)}
                placeholder="Example"
              />
            </div>

            <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Twitter</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="twitter:card"
                value={form.twitterCard}
                onChange={(value) => update("twitterCard", value)}
                options={CARD_TYPES}
              />
              <TextField
                label="twitter:site"
                value={form.twitterSite}
                onChange={(value) => update("twitterSite", value)}
                placeholder="@site"
              />
              <TextField
                label="twitter:creator"
                value={form.twitterCreator}
                onChange={(value) => update("twitterCreator", value)}
                placeholder="@author"
              />
              <TextField
                label="twitter:title"
                value={form.twitterTitle}
                onChange={(value) => update("twitterTitle", value)}
                placeholder="Card title"
              />
            </div>
            <TextField
              label="twitter:description"
              value={form.twitterDescription}
              onChange={(value) => update("twitterDescription", value)}
              placeholder="Card description"
              multiline
            />
            <TextField
              label="twitter:image"
              value={form.twitterImage}
              onChange={(value) => update("twitterImage", value)}
              placeholder="https://example.com/card.png"
            />
          </div>
        </Panel>
      </ToolGrid>

      <Panel
        title="Generated HTML"
        description="Values are HTML-escaped. Empty fields are omitted."
      >
        <div className="space-y-3">
          {output.hints.length > 0 ? (
            <div className="space-y-2">
              {output.hints.map((hint) => (
                <Alert
                  key={`${hint.field}-${hint.message}`}
                  tone={hint.tone === "warning" ? "warning" : "info"}
                  title={hint.field}
                >
                  {hint.message}
                </Alert>
              ))}
            </div>
          ) : null}
          <CodeOutput
            value={output.html}
            language="html"
            filename="meta-tags.html"
            placeholder="Fill in the fields to generate meta tags"
            maxHeight={360}
          />
        </div>
      </Panel>
    </ToolStack>
  );
}
