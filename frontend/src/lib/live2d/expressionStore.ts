/**
 * Expression Store — Zustand-based expression state management
 *
 * Ported from AIRI's Pinia expression-store.ts.
 * Manages Live2D expression entries, groups, blend modes, and persistence.
 */

import type {
  ExpressionBlendMode,
  ExpressionEntry,
  ExpressionGroupDefinition,
  ExpressionState,
} from './types';

// ─── Persistence helpers (localStorage) ──────────────────────────────────────

function persistenceKey(modelId: string): string {
  return `geny-expression-defaults:${modelId}`;
}

function loadPersistedDefaults(modelId: string): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(persistenceKey(modelId));
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return null;
  }
}

function savePersistedDefaults(modelId: string, defaults: Record<string, number>): void {
  try {
    localStorage.setItem(persistenceKey(modelId), JSON.stringify(defaults));
  } catch (err) {
    console.warn('[expression-store] Failed to persist defaults:', err);
  }
}

// ─── Expression Store (class-based, framework-independent) ───────────────────

export class ExpressionStore {
  expressions: Map<string, ExpressionEntry> = new Map();
  expressionGroups: Map<string, ExpressionGroupDefinition> = new Map();
  modelId: string = '';

  private clearAllTimers(): void {
    for (const entry of this.expressions.values()) {
      if (entry.resetTimer != null) {
        clearTimeout(entry.resetTimer);
        entry.resetTimer = undefined;
      }
    }
  }

  private toState(entry: ExpressionEntry): ExpressionState {
    return {
      name: entry.name,
      value: entry.currentValue,
      default: entry.defaultValue,
      active: entry.currentValue !== entry.defaultValue,
    };
  }

  private allNames(): string[] {
    return Array.from(this.expressions.keys());
  }

  registerExpressions(
    id: string,
    groups: ExpressionGroupDefinition[],
    parameterEntries: ExpressionEntry[],
  ): void {
    this.clearAllTimers();
    this.expressions = new Map();
    this.expressionGroups = new Map();
    this.modelId = id;

    for (const group of groups) {
      this.expressionGroups.set(group.name, group);
    }

    for (const entry of parameterEntries) {
      this.expressions.set(entry.name, { ...entry });
    }

    // Restore persisted defaults
    const persisted = loadPersistedDefaults(id);
    if (persisted) {
      for (const [name, defaultVal] of Object.entries(persisted)) {
        const entry = this.expressions.get(name);
        if (entry) {
          entry.defaultValue = defaultVal;
          entry.currentValue = defaultVal;
        }
      }
    }
  }

  resolve(name: string): { kind: 'group'; group: ExpressionGroupDefinition } | { kind: 'param'; entry: ExpressionEntry } | null {
    const group = this.expressionGroups.get(name);
    if (group) return { kind: 'group', group };

    const entry = this.expressions.get(name);
    if (entry) return { kind: 'param', entry };

    return null;
  }

  set(name: string, value: boolean | number, duration?: number): { success: boolean; error?: string } {
    const resolved = this.resolve(name);
    if (!resolved) {
      return { success: false, error: `Expression or parameter "${name}" not found.` };
    }

    const numericValue = typeof value === 'boolean' ? (value ? 1 : 0) : value;

    if (resolved.kind === 'group') {
      for (const param of resolved.group.parameters) {
        const entry = this.expressions.get(param.parameterId);
        if (entry) {
          this.applyValue(entry, numericValue, duration);
        }
      }
      return { success: true };
    }

    this.applyValue(resolved.entry, numericValue, duration);
    return { success: true };
  }

  toggle(name: string, duration?: number): { success: boolean; error?: string } {
    const resolved = this.resolve(name);
    if (!resolved) {
      return { success: false, error: `Expression or parameter "${name}" not found.` };
    }

    if (resolved.kind === 'group') {
      const isActive = resolved.group.parameters.some((p) => {
        if (p.value === 0) return false;
        const entry = this.expressions.get(p.parameterId);
        return entry && entry.currentValue === p.value;
      });
      for (const param of resolved.group.parameters) {
        const entry = this.expressions.get(param.parameterId);
        if (entry) {
          const newValue = isActive ? entry.modelDefault : param.value;
          this.applyValue(entry, newValue, duration);
        }
      }
      return { success: true };
    }

    const entry = resolved.entry;
    const newValue = entry.currentValue !== entry.modelDefault ? entry.modelDefault : entry.targetValue;
    this.applyValue(entry, newValue, duration);
    return { success: true };
  }

  saveDefaults(): void {
    if (!this.modelId) return;
    const defaults: Record<string, number> = {};
    for (const [name, entry] of this.expressions) {
      entry.defaultValue = entry.currentValue;
      defaults[name] = entry.currentValue;
    }
    savePersistedDefaults(this.modelId, defaults);
  }

  resetAll(): void {
    this.clearAllTimers();
    for (const entry of this.expressions.values()) {
      entry.currentValue = entry.modelDefault;
    }
  }

  dispose(): void {
    this.clearAllTimers();
    this.expressions = new Map();
    this.expressionGroups = new Map();
    this.modelId = '';
  }

  private applyValue(entry: ExpressionEntry, value: number, duration?: number): void {
    if (entry.resetTimer != null) {
      clearTimeout(entry.resetTimer);
      entry.resetTimer = undefined;
    }
    entry.currentValue = value;
    if (duration && duration > 0) {
      const resetTo = entry.defaultValue;
      entry.resetTimer = setTimeout(() => {
        entry.currentValue = resetTo;
        entry.resetTimer = undefined;
      }, duration * 1000);
    }
  }
}

// ─── Normalize blend mode string ─────────────────────────────────────────────

export function normaliseBlend(raw: string): ExpressionBlendMode {
  switch (raw) {
    case 'Add': return 'Add';
    case 'Multiply': return 'Multiply';
    default: return 'Overwrite';
  }
}
