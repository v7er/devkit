import { useMemo, useState } from "react";
import { Container, Sparkles } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  CodeOutput,
  Field,
  Input,
  Panel,
  TextArea,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import { COMPOSE_PRESETS, generateCompose, validateCompose } from "./logic";

const SAMPLE = `services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: devkit
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
`;

export default function DockerComposeTool() {
  const [source, setSource] = useState(SAMPLE);
  const [selected, setSelected] = useState<string[]>(["postgres", "redis", "adminer"]);
  const [projectName, setProjectName] = useState("my-stack");

  const validation = useMemo(() => validateCompose(source), [source]);
  const generation = useMemo(() => generateCompose(selected, projectName), [selected, projectName]);

  const togglePreset = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Compose file"
          description="Parsed with the YAML parser in your browser; nothing is uploaded."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setSource(SAMPLE)}>
              <Sparkles className="size-3.5" aria-hidden />
              Sample
            </Button>
          }
        >
          <Field label="docker-compose.yml" htmlFor="compose-source">
            <TextArea
              id="compose-source"
              mono
              rows={22}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="services:\n  web:\n    image: nginx:alpine"
              aria-label="Compose YAML"
            />
          </Field>
        </Panel>

        <Panel title="Validation" description="Checks the top-level shape and the keys a service needs.">
          <div className="space-y-3">
            {validation.ok ? (
              <Alert tone="success" title="Compose file looks valid">
                Found {validation.services.length} {validation.services.length === 1 ? "service" : "services"}.
              </Alert>
            ) : (
              <Alert tone="danger" title="Problems found">
                <ul className="list-disc space-y-1 pl-4">
                  {validation.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {validation.warnings.map((warning) => (
              <Alert key={warning} tone="warning">
                {warning}
              </Alert>
            ))}

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                <p className="text-faint">Services</p>
                <p className="mt-0.5 font-mono text-text">{validation.services.length}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                <p className="text-faint">Volumes</p>
                <p className="mt-0.5 font-mono text-text">{validation.volumes.length}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                <p className="text-faint">Networks</p>
                <p className="mt-0.5 font-mono text-text">{validation.networks.length}</p>
              </div>
            </div>

            {validation.services.length > 0 ? (
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted">Detected services</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {validation.services.map((service) => (
                    <Badge key={service}>{service}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Panel>
      </ToolGrid>

      <Panel
        title="Starter generator"
        description="Pick services to produce a small, valid compose file."
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(COMPOSE_PRESETS.map((preset) => preset.id))}
            >
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted">
              <Container className="size-3.5" aria-hidden />
              Services
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {COMPOSE_PRESETS.map((preset) => (
                <label
                  key={preset.id}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-surface-2 p-2.5 transition-colors hover:border-line-strong"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(preset.id)}
                    onChange={() => togglePreset(preset.id)}
                    aria-label={preset.label}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text">{preset.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-faint">
                      {preset.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Field
              label="Project name"
              htmlFor="compose-project"
              hint="Optional. Adds a top-level name key."
            >
              <Input
                id="compose-project"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="my-stack"
                className="font-mono"
                aria-label="Compose project name"
              />
            </Field>

            {generation.error ? (
              <Alert tone="danger" title="Cannot generate a file">
                {generation.error}
              </Alert>
            ) : (
              <CodeOutput
                value={generation.text}
                language="yaml"
                filename="docker-compose.yml"
                placeholder="Select services to generate a starter file"
                maxHeight={360}
              />
            )}

            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                disabled={!generation.text}
                onClick={() => setSource(generation.text)}
              >
                Load into validator
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </ToolStack>
  );
}
