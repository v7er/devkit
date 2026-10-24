import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  Alert,
  CodeOutput,
  Field,
  Input,
  Panel,
  Segmented,
  Select,
  Slider,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { NumberField } from "./fields";
import {
  buildFlexGridCss,
  DEFAULT_FLEX_GRID_CONFIG,
  type FlexGridConfig,
  type FlexGridDisplay,
} from "./logic";

const DIRECTIONS = ["row", "row-reverse", "column", "column-reverse"];
const WRAP = ["nowrap", "wrap", "wrap-reverse"];
const JUSTIFY = ["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"];
const ALIGN = ["stretch", "flex-start", "flex-end", "center", "baseline"];
const ALIGN_CONTENT = ["stretch", "flex-start", "flex-end", "center", "space-between", "space-around"];
const AUTO_FLOW = ["row", "column", "dense", "row dense", "column dense"];
const JUSTIFY_ITEMS = ["start", "end", "center", "stretch"];
const SELF = ["auto", "flex-start", "flex-end", "center", "baseline", "stretch"];
const JUSTIFY_SELF = ["auto", "start", "end", "center", "stretch"];
const ITEM_COUNT = 6;

function options(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

export default function FlexboxGridTool() {
  const [config, setConfig] = useState<FlexGridConfig>({ ...DEFAULT_FLEX_GRID_CONFIG });

  const result = useMemo(() => buildFlexGridCss(config), [config]);

  const previewStyle = useMemo<CSSProperties>(() => {
    const gap = Number.isFinite(config.gap) ? config.gap : 0;
    if (config.display === "flex") {
      return {
        display: "flex",
        flexDirection: config.flexDirection as CSSProperties["flexDirection"],
        flexWrap: config.flexWrap as CSSProperties["flexWrap"],
        justifyContent: config.justifyContent as CSSProperties["justifyContent"],
        alignItems: config.alignItems as CSSProperties["alignItems"],
        alignContent: config.alignContent as CSSProperties["alignContent"],
        gap: `${gap}px`,
      };
    }
    return {
      display: "grid",
      gridTemplateColumns: config.gridTemplateColumns,
      gridTemplateRows: config.gridTemplateRows,
      gridAutoFlow: config.gridAutoFlow as CSSProperties["gridAutoFlow"],
      justifyItems: config.justifyItems as CSSProperties["justifyItems"],
      alignItems: config.alignItems as CSSProperties["alignItems"],
      gap: `${gap}px`,
    };
  }, [config]);

  const itemStyle: CSSProperties = {
    flexGrow: Number.isFinite(config.itemGrow) ? config.itemGrow : undefined,
    flexShrink: Number.isFinite(config.itemShrink) ? config.itemShrink : undefined,
    flexBasis: config.itemBasis,
    alignSelf: config.alignSelf as CSSProperties["alignSelf"],
    justifySelf: config.justifySelf as CSSProperties["justifySelf"],
    order: Number.isFinite(config.order) ? Math.trunc(config.order) : undefined,
  };

  function update(patch: Partial<FlexGridConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  return (
    <ToolGrid>
      <ToolStack>
        <Panel title="Container" description="Layout settings for the parent element.">
          <div className="space-y-3">
            <Segmented<FlexGridDisplay>
              label="Display"
              value={config.display}
              onChange={(display) => update({ display })}
              options={[
                { value: "flex", label: "Flexbox" },
                { value: "grid", label: "CSS Grid" },
              ]}
            />

            {config.display === "flex" ? (
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Direction"
                  value={config.flexDirection}
                  onChange={(flexDirection) => update({ flexDirection })}
                  options={options(DIRECTIONS)}
                />
                <Select
                  label="Wrap"
                  value={config.flexWrap}
                  onChange={(flexWrap) => update({ flexWrap })}
                  options={options(WRAP)}
                />
                <Select
                  label="Justify content"
                  value={config.justifyContent}
                  onChange={(justifyContent) => update({ justifyContent })}
                  options={options(JUSTIFY)}
                />
                <Select
                  label="Align items"
                  value={config.alignItems}
                  onChange={(alignItems) => update({ alignItems })}
                  options={options(ALIGN)}
                />
                <Select
                  label="Align content"
                  value={config.alignContent}
                  onChange={(alignContent) => update({ alignContent })}
                  options={options(ALIGN_CONTENT)}
                  className="col-span-2"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Columns" hint="Any valid grid-template-columns value." className="col-span-2">
                  <Input
                    value={config.gridTemplateColumns}
                    onChange={(event) => update({ gridTemplateColumns: event.target.value })}
                    aria-label="Grid template columns"
                    spellCheck={false}
                    className="font-mono text-[13px]"
                  />
                </Field>
                <Field label="Rows" hint="Any valid grid-template-rows value." className="col-span-2">
                  <Input
                    value={config.gridTemplateRows}
                    onChange={(event) => update({ gridTemplateRows: event.target.value })}
                    aria-label="Grid template rows"
                    spellCheck={false}
                    className="font-mono text-[13px]"
                  />
                </Field>
                <Select
                  label="Auto flow"
                  value={config.gridAutoFlow}
                  onChange={(gridAutoFlow) => update({ gridAutoFlow })}
                  options={options(AUTO_FLOW)}
                />
                <Select
                  label="Justify items"
                  value={config.justifyItems}
                  onChange={(justifyItems) => update({ justifyItems })}
                  options={options(JUSTIFY_ITEMS)}
                />
                <Select
                  label="Align items"
                  value={config.alignItems}
                  onChange={(alignItems) => update({ alignItems })}
                  options={options(ALIGN)}
                  className="col-span-2"
                />
              </div>
            )}

            <Slider
              label="Gap"
              value={Number.isFinite(config.gap) ? config.gap : 0}
              min={0}
              max={64}
              onChange={(gap) => update({ gap })}
              format={(gap) => `${gap}px`}
            />
          </div>
        </Panel>

        <Panel title="Item" description="Shared settings for the preview children.">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <NumberField
                label="Grow"
                value={config.itemGrow}
                min={0}
                onChange={(itemGrow) => update({ itemGrow })}
              />
              <NumberField
                label="Shrink"
                value={config.itemShrink}
                min={0}
                onChange={(itemShrink) => update({ itemShrink })}
              />
              <NumberField
                label="Order"
                value={config.order}
                onChange={(order) => update({ order })}
              />
            </div>
            <Field label="Basis" hint="Width, min-content, or another flex-basis value.">
              <Input
                value={config.itemBasis}
                onChange={(event) => update({ itemBasis: event.target.value })}
                aria-label="Item basis"
                spellCheck={false}
                className="font-mono text-[13px]"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Align self"
                value={config.alignSelf}
                onChange={(alignSelf) => update({ alignSelf })}
                options={options(SELF)}
              />
              <Select
                label="Justify self"
                value={config.justifySelf}
                onChange={(justifySelf) => update({ justifySelf })}
                options={options(JUSTIFY_SELF)}
              />
            </div>
          </div>
        </Panel>
      </ToolStack>

      <ToolStack>
        <Panel title="Preview" description="Six items rendered with the selected properties.">
          <div
            className="min-h-64 rounded-xl border border-line bg-surface-2 p-4"
            style={previewStyle}
          >
            {Array.from({ length: ITEM_COUNT }, (_, index) => (
              <div
                key={index}
                className="flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-xs font-semibold text-accent"
                style={itemStyle}
              >
                {index + 1}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Generated CSS" flush>
          <div className="space-y-3 p-4">
            {result.errors.length > 0 ? (
              <Alert tone="danger" title="Check these values">
                <ul className="list-disc pl-4">
                  {result.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
            <CodeOutput
              value={result.css}
              language="css"
              filename="layout.css"
              placeholder="Fix the values above to generate CSS"
              maxHeight={320}
            />
          </div>
        </Panel>
      </ToolStack>
    </ToolGrid>
  );
}
