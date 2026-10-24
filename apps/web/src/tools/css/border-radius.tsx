import { useMemo, useState } from "react";
import {
  Alert,
  CodeOutput,
  Panel,
  Slider,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { NumberField } from "./fields";
import {
  borderRadiusCss,
  borderRadiusValue,
  type BorderRadiusConfig,
  type RadiusCorners,
} from "./logic";

const CORNER_LABELS = ["Top left", "Top right", "Bottom right", "Bottom left"] as const;

const INITIAL: BorderRadiusConfig = {
  uniform: true,
  horizontal: [12, 12, 12, 12],
  vertical: [12, 12, 12, 12],
  elliptical: false,
};

export default function BorderRadiusTool() {
  const [config, setConfig] = useState<BorderRadiusConfig>(INITIAL);

  const result = useMemo(() => {
    try {
      return {
        value: borderRadiusValue(config),
        css: borderRadiusCss(config),
        error: "",
      };
    } catch (error) {
      return {
        value: "",
        css: "",
        error: error instanceof Error ? error.message : "Could not build the radii.",
      };
    }
  }, [config]);

  function updateCorners(
    axis: "horizontal" | "vertical",
    index: number,
    value: number,
  ) {
    setConfig((current) => {
      const corners = [...current[axis]] as [number, number, number, number];
      corners[index] = value;
      return { ...current, [axis]: corners };
    });
  }

  function setUniform(value: number) {
    const corners: RadiusCorners = [value, value, value, value];
    setConfig((current) => ({ ...current, horizontal: corners }));
  }

  return (
    <ToolGrid>
      <Panel title="Corners" description="Values apply clockwise from the top left.">
        <div className="space-y-4">
          <Toggle
            label="Uniform radius"
            description="Use one value for every corner."
            checked={config.uniform}
            onChange={(uniform) => setConfig((current) => ({ ...current, uniform }))}
          />

          {config.uniform ? (
            <Slider
              label="Radius"
              value={config.horizontal[0]}
              min={0}
              max={128}
              onChange={setUniform}
              format={(value) => `${value}px`}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {CORNER_LABELS.map((label, index) => (
                  <NumberField
                    key={label}
                    label={label}
                    value={config.horizontal[index] ?? 0}
                    min={0}
                    onChange={(value) => updateCorners("horizontal", index, value)}
                  />
                ))}
              </div>

              <Toggle
                label="Elliptical corners"
                description="Add vertical radii using the slash syntax."
                checked={config.elliptical}
                onChange={(elliptical) =>
                  setConfig((current) => ({ ...current, elliptical }))
                }
              />

              {config.elliptical ? (
                <div className="grid grid-cols-2 gap-3">
                  {CORNER_LABELS.map((label, index) => (
                    <NumberField
                      key={`vertical-${label}`}
                      label={`Vertical ${label.toLowerCase()}`}
                      value={config.vertical[index] ?? 0}
                      min={0}
                      onChange={(value) => updateCorners("vertical", index, value)}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}

          {result.error ? <Alert tone="danger">{result.error}</Alert> : null}
        </div>
      </Panel>

      <ToolStack>
        <Panel title="Preview" description="The box uses the generated border-radius value.">
          <div className="flex h-64 items-center justify-center rounded-xl border border-line bg-surface-2">
            <div
              className="flex size-48 items-center justify-center border border-accent/30 bg-accent-soft text-sm font-medium text-accent"
              style={result.value ? { borderRadius: result.value } : undefined}
            >
              border-radius
            </div>
          </div>
        </Panel>
        <Panel title="CSS" flush>
          <div className="p-4">
            <CodeOutput
              value={result.css}
              language="css"
              filename="border-radius.css"
              placeholder="Fix the radius values to generate CSS"
              maxHeight={240}
            />
          </div>
        </Panel>
      </ToolStack>
    </ToolGrid>
  );
}
