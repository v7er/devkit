import { useMemo, useState } from "react";
import { ExternalLink, Scale } from "lucide-react";
import {
  Alert,
  Badge,
  Panel,
  Select,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  LICENSES,
  LICENSE_ORDER,
  recommendLicense,
  type AttributionAnswer,
  type CopyleftAnswer,
  type LicenseAnswers,
  type PatentAnswer,
  type SimplicityAnswer,
} from "./logic";

export default function LicenseSelectorTool() {
  const [answers, setAnswers] = useState<LicenseAnswers>({
    attribution: "require",
    patent: "not-important",
    copyleft: "allow-proprietary",
    simplicity: "simple",
  });

  const recommendation = useMemo(() => recommendLicense(answers), [answers]);
  const info = LICENSES[recommendation.recommended];
  const topScore = Math.max(1, ...recommendation.ranked.map((item) => item.score));

  function update<K extends keyof LicenseAnswers>(key: K, value: LicenseAnswers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Questionnaire"
          description="Four answers narrow the choice among five common open-source licenses."
        >
          <div className="space-y-4">
            <Select
              label="Attribution"
              value={answers.attribution}
              onChange={(value) => update("attribution", value as AttributionAnswer)}
              options={[
                { value: "require", label: "Licensees must keep my copyright notice" },
                { value: "optional", label: "No attribution required" },
              ]}
            />
            <Select
              label="Patent grant"
              value={answers.patent}
              onChange={(value) => update("patent", value as PatentAnswer)}
              options={[
                { value: "not-important", label: "Not important for this project" },
                { value: "important", label: "Important: include an explicit patent grant" },
              ]}
            />
            <Select
              label="Copyleft"
              value={answers.copyleft}
              onChange={(value) => update("copyleft", value as CopyleftAnswer)}
              options={[
                { value: "allow-proprietary", label: "Allow closed-source derivatives" },
                { value: "share-alike", label: "Modified files must stay open" },
                { value: "must-share", label: "All distributed derivatives must stay open" },
              ]}
            />
            <Select
              label="Terms"
              value={answers.simplicity}
              onChange={(value) => update("simplicity", value as SimplicityAnswer)}
              options={[
                { value: "simple", label: "Short and plain" },
                { value: "thorough", label: "Detailed and explicit" },
              ]}
            />
            <Alert tone="info" title="Informational guide">
              This is not legal advice. Read the full license text and consult a lawyer for
              commercial or high-risk projects.
            </Alert>
          </div>
        </Panel>

        <Panel
          title="Recommendation"
          description="The best match for the selected answers."
          actions={<Badge>{info.id}</Badge>}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-lg bg-accent-soft p-2 text-accent">
                <Scale className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-text">{info.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{info.summary}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <p className="text-xs font-semibold tracking-wide text-muted">Permissions</p>
                <ul className="mt-2 space-y-1 text-xs text-text">
                  {info.permissions.map((permission) => (
                    <li key={permission}>• {permission}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <p className="text-xs font-semibold tracking-wide text-muted">Conditions</p>
                <ul className="mt-2 space-y-1 text-xs text-text">
                  {info.conditions.map((condition) => (
                    <li key={condition}>• {condition}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-wide text-muted">Why this match</p>
              <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted">
                {recommendation.reasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            </div>

            <a
              href={info.link}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-xs font-medium text-text transition-colors hover:border-line-strong hover:bg-surface-3"
            >
              Read the full license
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </Panel>
      </ToolGrid>

      <Panel title="How the five licenses scored" description="Higher is a better fit for your answers.">
        <div className="space-y-2.5">
          {recommendation.ranked.map((item, index) => {
            const license = LICENSES[item.id];
            const width = `${Math.max(0, (item.score / topScore) * 100)}%`;
            return (
              <div key={item.id} className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem] sm:items-center">
                <div className="flex items-center gap-2">
                  <span className="w-4 font-mono text-[11px] text-faint">{index + 1}</span>
                  <span className="text-xs font-medium text-text">{license.name}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={index === 0 ? "h-full rounded-full bg-accent" : "h-full rounded-full bg-line-strong"}
                    style={{ width }}
                  />
                </div>
                <span className="text-right font-mono text-xs text-muted">{item.score}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="All five licenses" description="Short summaries of each candidate.">
        <div className="grid gap-2 sm:grid-cols-2">
          {LICENSE_ORDER.map((id) => {
            const license = LICENSES[id];
            return (
              <div key={id} className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-text">{license.name}</span>
                  {id === recommendation.recommended ? <Badge>Recommended</Badge> : null}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{license.summary}</p>
              </div>
            );
          })}
        </div>
      </Panel>
    </ToolStack>
  );
}
