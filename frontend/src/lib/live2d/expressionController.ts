/**
 * Expression Controller — Live2D expression parameter blending
 *
 * Ported from AIRI's expression-controller.ts.
 * Parses exp3 data, registers into ExpressionStore, and applies
 * per-frame expression blending (Add/Multiply/Overwrite).
 */

import type {
  CubismCoreModel,
  ExpressionBlendMode,
  ExpressionEntry,
  ExpressionGroupDefinition,
} from './types';
import { ExpressionStore, normaliseBlend } from './expressionStore';

/** A single expression reference inside model3.json FileReferences.Expressions[]. */
interface Model3ExpressionRef {
  Name: string;
  File: string;
}

/** Parameter entry inside an exp3.json file. */
interface Exp3Parameter {
  Id: string;
  Value: number;
  Blend: 'Add' | 'Multiply' | 'Overwrite';
}

/** Root structure of an exp3.json file. */
interface Exp3Json {
  Type: string;
  Parameters: Exp3Parameter[];
}

export class ExpressionController {
  private store: ExpressionStore;
  private activeLastFrame = new Set<string>();
  private getModelDefault: (parameterId: string) => number;

  constructor(getModelDefault?: (parameterId: string) => number) {
    this.store = new ExpressionStore();
    this.getModelDefault = getModelDefault ?? (() => 0);
  }

  /** Access the underlying store for external queries */
  getStore(): ExpressionStore {
    return this.store;
  }

  /**
   * Parse model3.json expression references and the corresponding exp3 data,
   * then register everything in the store.
   */
  async initialise(
    expressionRefs: Model3ExpressionRef[],
    readExpFile: (path: string) => Promise<string>,
    modelId?: string,
  ): Promise<void> {
    const groups: ExpressionGroupDefinition[] = [];
    const entryMap = new Map<string, ExpressionEntry>();

    for (const expRef of expressionRefs) {
      try {
        const raw = await readExpFile(expRef.File);
        const exp3: Exp3Json = JSON.parse(raw);

        const groupParams: ExpressionGroupDefinition['parameters'] = [];

        for (const param of exp3.Parameters) {
          const blend = normaliseBlend(param.Blend);
          groupParams.push({
            parameterId: param.Id,
            blend,
            value: param.Value,
          });

          if (!entryMap.has(param.Id)) {
            const modelDefault = this.getModelDefault(param.Id);
            entryMap.set(param.Id, {
              name: param.Id,
              parameterId: param.Id,
              blend,
              currentValue: modelDefault,
              defaultValue: modelDefault,
              modelDefault,
              targetValue: param.Value,
            });
          } else if (param.Value !== 0) {
            const existing = entryMap.get(param.Id)!;
            if (existing.targetValue === 0) {
              existing.targetValue = param.Value;
            }
          }
        }

        groups.push({ name: expRef.Name, parameters: groupParams });
      } catch (err) {
        console.warn(`[expression-controller] Failed to parse exp3 for "${expRef.Name}" (${expRef.File}):`, err);
      }
    }

    this.store.registerExpressions(
      modelId ?? 'unknown',
      groups,
      Array.from(entryMap.values()),
    );
  }

  /**
   * Apply all expression entries onto the Live2D model each frame.
   *
   * - Noop detection: skip identity values (Add:0, Multiply:1, Overwrite:modelDefault)
   * - Transition reset: clear stale values when entry goes inactive
   * - Multiply blend reads post-blink values to preserve auto-blink modulation
   */
  applyExpressions(coreModel: CubismCoreModel): void {
    const activeThisFrame = new Set<string>();

    for (const entry of this.store.expressions.values()) {
      if (this.isNoopValue(entry)) continue;

      const blendedValue = this.computeTargetValue(entry, coreModel);
      coreModel.setParameterValueById(entry.parameterId, blendedValue);
      activeThisFrame.add(entry.parameterId);
    }

    // Reset parameters that were active last frame but not this frame
    for (const paramId of this.activeLastFrame) {
      if (!activeThisFrame.has(paramId)) {
        const entry = this.findEntryByParameterId(paramId);
        if (entry) {
          coreModel.setParameterValueById(paramId, entry.modelDefault);
        }
      }
    }

    this.activeLastFrame.clear();
    for (const id of activeThisFrame) {
      this.activeLastFrame.add(id);
    }
  }

  private isNoopValue(entry: ExpressionEntry): boolean {
    switch (entry.blend) {
      case 'Add': return entry.currentValue === 0;
      case 'Multiply': return entry.currentValue === 1;
      default: return entry.currentValue === entry.modelDefault;
    }
  }

  private computeTargetValue(entry: ExpressionEntry, coreModel: CubismCoreModel): number {
    switch (entry.blend) {
      case 'Add':
        return entry.modelDefault + entry.currentValue;
      case 'Multiply': {
        const currentFrameValue = coreModel.getParameterValueById(entry.parameterId);
        return currentFrameValue * entry.currentValue;
      }
      default:
        return entry.currentValue;
    }
  }

  private findEntryByParameterId(paramId: string): ExpressionEntry | undefined {
    for (const entry of this.store.expressions.values()) {
      if (entry.parameterId === paramId) return entry;
    }
    return undefined;
  }

  dispose(): void {
    this.store.dispose();
    this.activeLastFrame.clear();
  }
}
