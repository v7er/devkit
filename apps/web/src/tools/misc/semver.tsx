import { useMemo, useState } from "react";
import { ArrowUp, CheckCircle2 } from "lucide-react";
import {
  Alert,
  Badge,
  CodeOutput,
  Field,
  Input,
  Panel,
  Segmented,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  bumpVersion,
  checkRange,
  compareVersions,
  inspectVersion,
  type BumpType,
} from "./logic";

const RELATION_TEXT = {
  lower: "is lower than",
  equal: "is equal to",
  higher: "is higher than",
} as const;

export default function SemverTool() {
  const [versionA, setVersionA] = useState("1.4.2");
  const [versionB, setVersionB] = useState("2.0.0");
  const [range, setRange] = useState("^1.0.0");
  const [release, setRelease] = useState<BumpType>("minor");

  const reportA = useMemo(() => inspectVersion(versionA), [versionA]);
  const reportB = useMemo(() => inspectVersion(versionB), [versionB]);
  const comparison = useMemo(() => compareVersions(versionA, versionB), [versionA, versionB]);
  const rangeResult = useMemo(() => checkRange(versionA, range), [versionA, range]);
  const bump = useMemo(() => bumpVersion(versionA, release), [versionA, release]);

  return (
    <ToolStack>
      <ToolGrid>
        <Panel
          title="Version A"
          description="MAJOR.MINOR.PATCH with optional prerelease and build metadata."
          actions={<Badge tone="accent">primary</Badge>}
        >
          <div className="space-y-3">
            <Field
              label="Version"
              hint="Leading “v” and surrounding whitespace are accepted."
            >
              <Input
                className="font-mono"
                value={versionA}
                onChange={(event) => setVersionA(event.target.value)}
                placeholder="1.4.2"
                aria-label="Version A"
              />
            </Field>

            {reportA.details ? (
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {[
                  ["Major", String(reportA.details.major)],
                  ["Minor", String(reportA.details.minor)],
                  ["Patch", String(reportA.details.patch)],
                  ["Prerelease", reportA.details.prerelease || "—"],
                  ["Build", reportA.details.build || "—"],
                  ["Normalized", reportA.details.normalized],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-line bg-surface-2 px-2.5 py-2">
                    <p className="text-faint">{label}</p>
                    <p className="mt-0.5 truncate font-mono text-text">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Alert tone="danger" title="Invalid version">
                {reportA.error}
              </Alert>
            )}
          </div>
        </Panel>

        <Panel title="Version B" description="Compared by SemVer precedence, not string order.">
          <div className="space-y-3">
            <Field label="Version">
              <Input
                className="font-mono"
                value={versionB}
                onChange={(event) => setVersionB(event.target.value)}
                placeholder="2.0.0"
                aria-label="Version B"
              />
            </Field>

            {reportB.details ? null : (
              <Alert tone="danger" title="Invalid version">
                {reportB.error}
              </Alert>
            )}

            {comparison.error ? (
              <Alert tone="danger">{comparison.error}</Alert>
            ) : (
              <Alert tone="success" title="Comparison">
                <span className="font-mono">{versionA.trim()}</span>{" "}
                {comparison.relation ? RELATION_TEXT[comparison.relation] : ""}{" "}
                <span className="font-mono">{versionB.trim()}</span>.
                {comparison.relation === "equal"
                  ? " They normalize to the same precedence."
                  : comparison.difference
                    ? ` The main difference is ${comparison.difference}.`
                    : ""}
                {comparison.relation !== "equal"
                  ? " Build metadata is ignored when comparing."
                  : ""}
              </Alert>
            )}
          </div>
        </Panel>
      </ToolGrid>

      <ToolGrid>
        <Panel
          title="Range check"
          description="Uses node-semver range syntax, including ^, ~, x-ranges, and hyphen ranges."
        >
          <div className="space-y-3">
            <Field label="Range" hint="Examples: ^1.2.0 · >=1.0.0 <2.0.0 · 1.x · *">
              <Input
                className="font-mono"
                value={range}
                onChange={(event) => setRange(event.target.value)}
                placeholder="^1.0.0"
                aria-label="Version range"
              />
            </Field>

            {rangeResult.error ? (
              <Alert tone="danger" title="Invalid range">
                {rangeResult.error}
              </Alert>
            ) : rangeResult.satisfied ? (
              <Alert tone="success" title="In range">
                <span className="font-mono">{versionA.trim()}</span> satisfies{" "}
                <span className="font-mono">{range.trim()}</span>.
              </Alert>
            ) : (
              <Alert tone="warning" title="Outside the range">
                <span className="font-mono">{versionA.trim()}</span> does not satisfy{" "}
                <span className="font-mono">{range.trim()}</span>.
              </Alert>
            )}

            <p className="text-xs leading-relaxed text-faint">
              Prerelease versions such as <span className="font-mono">1.3.0-beta.1</span> only match
              a range when the range or version includes a prerelease tag at the same
              major.minor.patch level.
            </p>
          </div>
        </Panel>

        <Panel
          title="Increment"
          description="Bumps version A and resets the lower components."
          actions={
            <Badge>
              <ArrowUp className="size-2.5" aria-hidden />
              semver.inc
            </Badge>
          }
        >
          <div className="space-y-3">
            <Segmented
              label="Release type"
              value={release}
              onChange={setRelease}
              options={[
                { value: "major", label: "Major" },
                { value: "minor", label: "Minor" },
                { value: "patch", label: "Patch" },
              ]}
            />

            {bump.error ? (
              <Alert tone="danger" title="Cannot increment">
                {bump.error}
              </Alert>
            ) : (
              <Alert tone="info" title="Result">
                <span className="inline-flex items-center gap-1 font-mono">
                  <CheckCircle2 className="size-3" aria-hidden />
                  {versionA.trim()} → {bump.next}
                </span>
                <span className="mt-1 block">
                  {release === "major"
                    ? "A major bump resets minor and patch to zero and drops any prerelease tag."
                    : release === "minor"
                      ? "A minor bump resets patch to zero and drops any prerelease tag."
                      : "A patch bump only changes the patch number and drops any prerelease tag."}
                </span>
              </Alert>
            )}

            <CodeOutput
              value={bump.next ?? ""}
              language="next version"
              filename="next-version.txt"
              placeholder="A valid version A produces the next version here"
              maxHeight={80}
            />
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
