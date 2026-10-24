import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Alert,
  Button,
  CodeOutput,
  Panel,
  Segmented,
  Slider,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { ColorField, NumberField } from "./fields";
import {
  gradientCss,
  gradientToCss,
  type GradientConfig,
  type GradientType,
} from "./logic";

const INITIAL: GradientConfig = {
  type: "linear",
  angle: 135,
  shape: "circle",
  positionX: 50,
  positionY: 50,
  stops: [
    { color: "#8b5cf6", position: 0 },
    { color: "#06b6d4", position: 100 },
  ],
};

export default function GradientTool() {
  const [config, setConfig] = useState<GradientConfig>(INITIAL);

  const result = useMemo(() => {
    try {
      return {
        value: gradientToCss(config),
        css: gradientCss(config),
        error: "",
      };
    } catch (error) {
      return {
        value: "",
        css: "",
        error: error instanceof Error ? error.message : "Could not build the gradient.",
      };
    }
  }, [config]);

  function update(patch: Partial<GradientConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  function updateStop(index: number, patch: Partial<GradientConfig["stops"][number]>) {
    setConfig((current) => ({
      ...current,
      stops: current.stops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, ...patch } : stop,
      ),
    }));
  }

  function addStop() {
    setConfig((current) => ({
      ...current,
      stops: [...current.stops, { color: "#ffffff", position: 50 }],
    }));
  }

  return (
    <ToolGrid>
      <Panel
        title="Gradient"
        description="Stops are written in ascending position order."
        actions={
          <Button variant="secondary" size="sm" onClick={addStop}>
            <Plus className="size-3.5" aria-hidden />
            Add stop
          </Button>
        }
      >
        <div className="space-y-4">
          <Segmented<GradientType>
            label="Type"
            value={config.type}
            onChange={(type) => update({ type })}
            options={[
              { value: "linear", label: "Linear" },
              { value: "radial", label: "Radial" },
            ]}
          />

          {config.type === "linear" ? (
            <Slider
              label="Angle"
              value={config.angle}
              min={0}
              max={360}
              onChange={(angle) => update({ angle })}
              format={(angle) => `${angle}deg`}
            />
          ) : (
            <div className="space-y-3">
              <Segmented<GradientConfig["shape"]>
                label="Shape"
                value={config.shape}
                onChange={(shape) => update({ shape })}
                options={[
                  { value: "ellipse", label: "Ellipse" },
                  { value: "circle", label: "Circle" },
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                <Slider
                  label="Position X"
                  value={config.positionX}
                  min={0}
                  max={100}
                  onChange={(positionX) => update({ positionX })}
                  format={(positionX) => `${positionX}%`}
                />
                <Slider
                  label="Position Y"
                  value={config.positionY}
                  min={0}
                  max={100}
                  onChange={(positionY) => update({ positionY })}
                  format={(positionY) => `${positionY}%`}
                />
              </div>
            </div>
          )}

          {result.error ? <Alert tone="danger">{result.error}</Alert> : null}

          <div className="space-y-2">
            {config.stops.map((stop, index) => (
              <div
                key={index}
                className="space-y-2 rounded-xl border border-line bg-surface-2 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-text">
                    Stop {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        stops: current.stops.filter(
                          (_, stopIndex) => stopIndex !== index,
                        ),
                      }))
                    }
                    disabled={config.stops.length <= 2}
                    aria-label={`Remove stop ${index + 1}`}
                    title={`Remove stop ${index + 1}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_6rem] gap-2">
                  <ColorField
                    label="Color"
                    value={stop.color}
                    onChange={(color) => updateStop(index, { color })}
                  />
                  <NumberField
                    label="Position"
                    value={stop.position}
                    min={0}
                    max={100}
                    onChange={(position) => updateStop(index, { position })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <ToolStack>
        <Panel title="Preview" description="The gradient fills the preview surface.">
          <div
            className="h-64 rounded-xl border border-line bg-surface-2"
            style={result.value ? { backgroundImage: result.value } : undefined}
          />
        </Panel>
        <Panel title="CSS" flush>
          <div className="p-4">
            <CodeOutput
              value={result.css}
              language="css"
              filename="gradient.css"
              placeholder="Fix the gradient values to generate CSS"
              maxHeight={240}
            />
          </div>
        </Panel>
      </ToolStack>
    </ToolGrid>
  );
}
