import { validateDungeonSpec } from "../../core/src/dungeon-spec.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function evaluateStartGate(spec) {
  const validation = validateDungeonSpec(spec);
  const criticalErrors = validation.errors.map((entry) => ({
    severity: "critical",
    ...clone(entry),
  }));

  return {
    allowed: validation.valid,
    criticalCount: criticalErrors.length,
    errors: criticalErrors,
  };
}
