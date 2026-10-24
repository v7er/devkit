import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Panel,
  Slider,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { ColorField, NumberField } from "./fields";
import { boxShadowValue, type ShadowLayer } from "./logic";

const DEFAULT_LAYER: ShadowLayer = {
  x: 0,
  y: 12,
  blur: 32,
  spread: -8,
  color: "#0f172a",
  opacity: 25,
  inset: false,
};

export default function BoxShadowTool() {
  const [layers, setLayers] = useState<ShadowLayer[]>([DEFAULT_LAYER]);

  const result = useMemo(() => {
    try {
      return { value: boxShadowValue(layers), error: "" };
    } catch (error) {
      return {
        value: "",
        error: error instanceof Error ? error.message : "Could not build the shadow.",
      };
    }
  }, [layers]);

  const css = result.value
    ? `.shadow {\n  box-shadow: ${result.value};\n}`
    : "";

  function updateLayer(index: number, patch: Partial<ShadowLayer>) {
    setLayers((current) =>
      current.map((layer, layerIndex) =>
        layerIndex === index ? { ...layer, ...patch } : layer,
      ),
    );
  }

  function addLayer() {
    setLayers((current) => [
      ...current,
      { ...DEFAULT_LAYER, y: 24, blur: 48, spread: 0, opacity: 15 },
    ]);
  }

  return (
    <ToolGrid>
      <Panel
        title="Layers"
        description="Each layer is drawn in order, top to bottom."
        actions={
          <Button variant="secondary" size="sm" onClick={addLayer}>
            <Plus className="size-3.5" aria-hidden />
            Add layer
          </Button>
        }
      >
        <div className="space-y-3">
          {result.error ? <Alert tone="danger">{result.error}</Alert> : null}
          {layers.map((layer, index) => (
            <div
              key={index}
              className="space-y-3 rounded-xl border border-line bg-surface-2 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text">Layer {index + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setLayers((current) =>
                      current.filter((_, layerIndex) => layerIndex !== index),
                    )
                  }
                  disabled={layers.length === 1}
                  aria-label={`Remove layer ${index + 1}`}
                  title={`Remove layer ${index + 1}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="X offset"
                  value={layer.x}
                  onChange={(x) => updateLayer(index, { x })}
                  step={1}
                />
                <NumberField
                  label="Y offset"
                  value={layer.y}
                  onChange={(y) => updateLayer(index, { y })}
                  step={1}
                />
                <NumberField
                  label="Blur"
                  value={layer.blur}
                  min={0}
                  onChange={(blur) => updateLayer(index, { blur })}
                  step={1}
                />
                <NumberField
                  label="Spread"
                  value={layer.spread}
                  onChange={(spread) => updateLayer(index, { spread })}
                  step={1}
                />
              </div>
              <ColorField
                label="Color"
                value={layer.color}
                onChange={(color) => updateLayer(index, { color })}
              />
              <Slider
                label="Opacity"
                value={layer.opacity}
                min={0}
                max={100}
                onChange={(opacity) => updateLayer(index, { opacity })}
                format={(opacity) => `${opacity}%`}
              />
              <Toggle
                label="Inset"
                description="Draw the shadow inside the element."
                checked={layer.inset}
                onChange={(inset) => updateLayer(index, { inset })}
              />
            </div>
          ))}
        </div>
      </Panel>

      <ToolStack>
        <Panel title="Preview" description="Rendered with the generated box-shadow value.">
          <div className="flex h-64 items-center justify-center rounded-xl border border-line bg-surface-2">
            <div
              className="flex size-40 items-center justify-center rounded-2xl bg-white text-sm font-medium text-black/50"
              style={result.value ? { boxShadow: result.value } : undefined}
            >
              box-shadow
            </div>
          </div>
        </Panel>
        <Panel title="CSS" flush>
          <div className="p-4">
            <CodeOutput
              value={css}
              language="css"
              filename="box-shadow.css"
              placeholder="Add a valid layer to generate CSS"
              maxHeight={240}
            />
          </div>
        </Panel>
      </ToolStack>
    </ToolGrid>
  );
}
