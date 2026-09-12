import { applyEditCommand } from "./edit-command.js";

function cloneSpec(spec) {
  return JSON.parse(JSON.stringify(spec));
}

export class EditSession {
  #spec;
  #undoStack = [];
  #redoStack = [];

  constructor(spec) {
    this.#spec = cloneSpec(spec);
  }

  get spec() {
    return cloneSpec(this.#spec);
  }

  get canUndo() {
    return this.#undoStack.length > 0;
  }

  get canRedo() {
    return this.#redoStack.length > 0;
  }

  apply(command) {
    const result = applyEditCommand(this.#spec, command);
    if (!result.ok) return result;

    this.#spec = result.spec;
    this.#undoStack.push({ command: cloneSpec(command), inverse: cloneSpec(result.inverse) });
    this.#redoStack = [];
    return { ok: true, spec: this.spec };
  }

  undo() {
    const entry = this.#undoStack.pop();
    if (!entry) return { ok: false, error: { code: "NOTHING_TO_UNDO", message: "Undo stack is empty." } };

    const result = applyEditCommand(this.#spec, entry.inverse);
    if (!result.ok) {
      this.#undoStack.push(entry);
      return result;
    }

    this.#spec = result.spec;
    this.#redoStack.push(entry);
    return { ok: true, spec: this.spec };
  }

  redo() {
    const entry = this.#redoStack.pop();
    if (!entry) return { ok: false, error: { code: "NOTHING_TO_REDO", message: "Redo stack is empty." } };

    const result = applyEditCommand(this.#spec, entry.command);
    if (!result.ok) {
      this.#redoStack.push(entry);
      return result;
    }

    this.#spec = result.spec;
    this.#undoStack.push(entry);
    return { ok: true, spec: this.spec };
  }
}
