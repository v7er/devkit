import { useMemo, useState } from "react";
import { Alert, Badge, Field, Panel, Select, TextArea, ToolGrid, ToolStack } from "@/components/ui";
import { CodeOutput } from "@/components/ui";
import {
  addMatrices,
  determinant,
  formatMatrix,
  inverseMatrix,
  matrixDimensions,
  multiplyMatrices,
  parseMatrix,
  transposeMatrix,
} from "./logic";

type Operation = "add" | "multiply" | "transpose" | "determinant" | "inverse";

const OPERATIONS: Array<{ value: Operation; label: string }> = [
  { value: "add", label: "A + B" },
  { value: "multiply", label: "A × B" },
  { value: "transpose", label: "Transpose A" },
  { value: "determinant", label: "Determinant of A" },
  { value: "inverse", label: "Inverse of A" },
];

const RESULT_LABELS: Record<Operation, string> = {
  add: "A + B",
  multiply: "A × B",
  transpose: "Aᵀ",
  determinant: "det(A)",
  inverse: "A⁻¹",
};

export default function MatrixTool() {
  const [operation, setOperation] = useState<Operation>("add");
  const [matrixA, setMatrixA] = useState("1 2\n3 4");
  const [matrixB, setMatrixB] = useState("5 6\n7 8");

  const needsB = operation === "add" || operation === "multiply";

  const analysis = useMemo(() => {
    try {
      const a = parseMatrix(matrixA);
      const aSize = matrixDimensions(a);
      if (operation === "add" || operation === "multiply") {
        const b = parseMatrix(matrixB);
        const bSize = matrixDimensions(b);
        const result = operation === "add" ? addMatrices(a, b) : multiplyMatrices(a, b);
        return {
          error: "",
          result: formatMatrix(result),
          aSize,
          bSize,
          resultSize: matrixDimensions(result),
          note:
            operation === "multiply"
              ? "Each result cell is a row of A dotted with a column of B."
              : "Matrices must have identical dimensions.",
        };
      }

      if (operation === "determinant") {
        return {
          error: "",
          result: String(Number(determinant(a).toPrecision(12))),
          aSize,
          bSize: null,
          resultSize: null,
          note: "The determinant uses Gaussian elimination with partial pivoting.",
        };
      }

      if (operation === "inverse") {
        const result = inverseMatrix(a);
        return {
          error: "",
          result: formatMatrix(result),
          aSize,
          bSize: null,
          resultSize: matrixDimensions(result),
          note: "The inverse is computed with Gauss–Jordan elimination.",
        };
      }

      const result = transposeMatrix(a);
      return {
        error: "",
        result: formatMatrix(result),
        aSize,
        bSize: null,
        resultSize: matrixDimensions(result),
        note: "Rows of A become columns of the result.",
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not compute this matrix",
        result: "",
        aSize: null,
        bSize: null,
        resultSize: null,
        note: "",
      };
    }
  }, [matrixA, matrixB, operation]);

  return (
    <ToolStack>
      <ToolGrid>
        <Panel title="Matrices" description="One row per line; separate values with spaces or commas.">
          <div className="space-y-4">
            <Select
              label="Operation"
              value={operation}
              onChange={(value) => setOperation(value as Operation)}
              options={OPERATIONS}
            />

            <Field label="Matrix A" htmlFor="matrix-a" hint="For example: 1 2 on the first line, 3 4 on the next.">
              <TextArea
                id="matrix-a"
                mono
                rows={5}
                value={matrixA}
                onChange={(event) => setMatrixA(event.target.value)}
                aria-label="Matrix A"
                placeholder="1 2\n3 4"
              />
            </Field>

            {needsB ? (
              <Field label="Matrix B" htmlFor="matrix-b">
                <TextArea
                  id="matrix-b"
                  mono
                  rows={5}
                  value={matrixB}
                  onChange={(event) => setMatrixB(event.target.value)}
                  aria-label="Matrix B"
                  placeholder="5 6\n7 8"
                />
              </Field>
            ) : null}

            {!needsB ? (
              <Alert tone="info">
                Determinant and inverse require a square matrix. Transpose works on any shape.
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-1.5">
              {analysis.aSize ? (
                <Badge tone="accent">
                  A {analysis.aSize.rows}×{analysis.aSize.columns}
                </Badge>
              ) : null}
              {analysis.bSize ? (
                <Badge>
                  B {analysis.bSize.rows}×{analysis.bSize.columns}
                </Badge>
              ) : null}
              {analysis.resultSize ? (
                <Badge>
                  Result {analysis.resultSize.rows}×{analysis.resultSize.columns}
                </Badge>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel title="Result" description={RESULT_LABELS[operation]} flush>
          <div className="space-y-3 p-4">
            {analysis.error ? (
              <Alert tone="danger" title="Cannot compute">
                {analysis.error}
              </Alert>
            ) : null}
            <CodeOutput
              value={analysis.result}
              language="matrix"
              filename="matrix-result.txt"
              placeholder="Result appears here"
              wrap={false}
              maxHeight={320}
            />
            {analysis.note ? <p className="text-xs text-faint">{analysis.note}</p> : null}
          </div>
        </Panel>
      </ToolGrid>
    </ToolStack>
  );
}
