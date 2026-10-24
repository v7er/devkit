import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Alert,
  CodeOutput,
  Field,
  InlineRow,
  Input,
  Panel,
  Toggle,
  ToolGrid,
  ToolStack,
} from "@/components/ui";
import {
  ChmodError,
  modeBits,
  modeToChmodCommand,
  modeToOctal,
  modeToSymbolic,
  modeToSymbolicSet,
  parseOctalMode,
  parseSymbolic,
  setPermission,
  setSpecial,
  type PermissionName,
  type PermissionRole,
  type SpecialBit,
} from "./logic";

const ROLES: Array<{ value: PermissionRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "group", label: "Group" },
  { value: "other", label: "Other" },
];

const PERMISSIONS: Array<{ value: PermissionName; label: string }> = [
  { value: "read", label: "Read" },
  { value: "write", label: "Write" },
  { value: "execute", label: "Execute" },
];

const SPECIAL_BITS: Array<{ value: SpecialBit; label: string; description: string }> = [
  { value: "setuid", label: "Setuid", description: "Run the file as its owner (s in owner execute)." },
  { value: "setgid", label: "Setgid", description: "Run with the group's privileges (s in group execute)." },
  { value: "sticky", label: "Sticky bit", description: "Restrict deletion in shared directories (t in other execute)." },
];

function describeError(error: unknown): string {
  return error instanceof ChmodError ? error.message : "Could not read that mode.";
}

export default function ChmodTool() {
  const [mode, setMode] = useState(0o755);
  const [octalInput, setOctalInput] = useState("755");
  const [symbolicInput, setSymbolicInput] = useState("rwxr-xr-x");
  const [octalError, setOctalError] = useState("");
  const [symbolicError, setSymbolicError] = useState("");
  const [target, setTarget] = useState("path/to/file");
  const [recursive, setRecursive] = useState(false);

  const bits = modeBits(mode);
  const symbolic = modeToSymbolic(mode);
  const specialEnabled = bits.setuid || bits.setgid || bits.sticky;
  const targetError = target.trim() ? "" : "Enter the file or directory to change.";
  const command = targetError ? "" : modeToChmodCommand(mode, target, recursive);

  const applyMode = (next: number) => {
    setMode(next);
    setOctalInput(modeToOctal(next));
    setSymbolicInput(modeToSymbolic(next));
    setOctalError("");
    setSymbolicError("");
  };

  const changeOctal = (value: string) => {
    setOctalInput(value);
    try {
      applyMode(parseOctalMode(value));
    } catch (error) {
      setOctalError(describeError(error));
    }
  };

  const changeSymbolic = (value: string) => {
    setSymbolicInput(value);
    try {
      applyMode(parseSymbolic(value));
    } catch (error) {
      setSymbolicError(describeError(error));
    }
  };

  const togglePermission = (role: PermissionRole, permission: PermissionName, enabled: boolean) => {
    applyMode(setPermission(mode, role, permission, enabled));
  };

  const toggleSpecial = (bit: SpecialBit, enabled: boolean) => {
    applyMode(setSpecial(mode, bit, enabled));
  };

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Permissions" description="Pick bits from the matrix or type an octal or symbolic mode.">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Octal mode"
                htmlFor="chmod-octal"
                hint="Three or four octal digits"
                error={octalError}
              >
                <Input
                  id="chmod-octal"
                  value={octalInput}
                  onChange={(event) => changeOctal(event.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className="font-mono"
                  aria-label="Octal mode"
                />
              </Field>
              <Field
                label="Symbolic mode"
                htmlFor="chmod-symbolic"
                hint="Nine characters, such as rwxr-xr-x"
                error={symbolicError}
              >
                <Input
                  id="chmod-symbolic"
                  value={symbolicInput}
                  onChange={(event) => changeSymbolic(event.target.value)}
                  autoComplete="off"
                  className="font-mono"
                  aria-label="Symbolic mode"
                />
              </Field>
            </div>

            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs text-faint">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">
                      Role
                    </th>
                    {PERMISSIONS.map((permission) => (
                      <th key={permission.value} scope="col" className="px-3 py-2 text-center font-semibold">
                        {permission.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ROLES.map((role) => (
                    <tr key={role.value}>
                      <th scope="row" className="px-3 py-2 text-left font-medium text-muted">
                        {role.label}
                      </th>
                      {PERMISSIONS.map((permission) => (
                        <td key={permission.value} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={bits[role.value][permission.value]}
                            onChange={(event) =>
                              togglePermission(role.value, permission.value, event.target.checked)
                            }
                            aria-label={`${role.label} ${permission.label.toLowerCase()}`}
                            className="size-4 cursor-pointer rounded border-line"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2">
              {SPECIAL_BITS.map((bit) => (
                <Toggle
                  key={bit.value}
                  label={bit.label}
                  description={bit.description}
                  checked={bits[bit.value]}
                  onChange={(checked) => toggleSpecial(bit.value, checked)}
                />
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Target" htmlFor="chmod-target" error={targetError}>
                <Input
                  id="chmod-target"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  className="font-mono"
                  placeholder="path/to/file"
                  aria-label="Target path"
                />
              </Field>
              <Toggle
                label="Recursive"
                description="Adds -R for directories."
                checked={recursive}
                onChange={setRecursive}
                className="pb-2"
              />
            </div>
          </div>
        </Panel>

        <Panel title="Result" description="The mode in each common notation, plus a ready-to-run command.">
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border border-line bg-surface-2 p-3">
              <InlineRow label="Symbolic">{symbolic}</InlineRow>
              <InlineRow label="Octal">{modeToOctal(mode)}</InlineRow>
              <InlineRow label="Set notation">{modeToSymbolicSet(mode)}</InlineRow>
              <InlineRow label="ls -l">{`-${symbolic}`}</InlineRow>
              <InlineRow label="Special bits">{`${bits.setuid ? "setuid " : ""}${bits.setgid ? "setgid " : ""}${bits.sticky ? "sticky" : ""}`.trim() || "none"}</InlineRow>
            </div>

            {specialEnabled ? (
              <Alert tone="warning" title="Special bits change how the file is accessed">
                Setuid and setgid are ignored on many modern systems for scripts. The sticky bit only
                affects directories.
              </Alert>
            ) : null}

            <CodeOutput
              value={command}
              language="bash"
              filename="chmod-command.sh"
              placeholder="Enter a target path to build the command"
              maxHeight={160}
              wrap={false}
            />

            <p className="flex items-start gap-1.5 text-xs text-faint">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Octal digits map to owner, group, and other in that order: read 4, write 2, execute 1.
            </p>
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
