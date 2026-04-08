/**
 * Live2D Enhanced System — Shared type definitions
 *
 * Framework-independent types used across the enhanced Live2D rendering pipeline.
 * Ported and adapted from AIRI Project's stage-ui-live2d system.
 */

// ─── Cubism Model Types (abstracted from pixi-live2d-display) ────────────────

/** Minimal interface for Cubism 4 core model parameter access */
export interface CubismCoreModel {
  getParameterValueById(id: string): number;
  setParameterValueById(id: string, value: number): void;
}

/** Internal model with coreModel access */
export interface Live2DInternalModel {
  coreModel: CubismCoreModel;
  eyeBlink?: {
    updateParameters(model: CubismCoreModel, deltaTimeSec: number): void;
  };
  motionManager: {
    state: {
      currentGroup: string | null;
    };
    groups: {
      idle: string;
    };
    stopAllMotions(): void;
  };
  focusController: {
    focus(x: number, y: number, instant: boolean): void;
    update(elapsed: number): void;
  };
}

// ─── Expression System Types ─────────────────────────────────────────────────

export type ExpressionBlendMode = 'Add' | 'Multiply' | 'Overwrite';

export interface ExpressionEntry {
  name: string;
  parameterId: string;
  blend: ExpressionBlendMode;
  currentValue: number;
  defaultValue: number;
  modelDefault: number;
  targetValue: number;
  resetTimer?: ReturnType<typeof setTimeout>;
}

export interface ExpressionGroupDefinition {
  name: string;
  parameters: {
    parameterId: string;
    blend: ExpressionBlendMode;
    value: number;
  }[];
}

export interface ExpressionState {
  name: string;
  value: number;
  default: number;
  active: boolean;
}

// ─── Motion Plugin Pipeline Types ────────────────────────────────────────────

export interface MotionManagerUpdateContext {
  model: CubismCoreModel;
  now: number;
  timeDelta: number;
}

export interface MotionPluginContext extends MotionManagerUpdateContext {
  internalModel: Live2DInternalModel;
  isIdleMotion: boolean;
  handled: boolean;
  markHandled: () => void;

  // Enhanced feature flags
  autoBlinkEnabled: boolean;
  forceAutoBlinkEnabled: boolean;
  idleAnimationEnabled: boolean;
  expressionEnabled: boolean;
}

export type MotionPlugin = (ctx: MotionPluginContext) => void;

// ─── Beat Sync Types ─────────────────────────────────────────────────────────

export type BeatSyncStyleName = 'punchy-v' | 'balanced-v' | 'swing-lr' | 'sway-sine';

export interface BeatBaseAngles {
  x: number;
  y: number;
  z: number;
}

export interface BeatSyncController {
  targetX: number;
  targetY: number;
  targetZ: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  updateTargets(now: number): void;
  scheduleBeat(timestamp?: number | null): void;
  setStyle(style: BeatSyncStyleName): void;
  getStyle(): BeatSyncStyleName;
  setAutoStyleShift(enabled: boolean): void;
}

// ─── Lip Sync Types ──────────────────────────────────────────────────────────

export type VowelKey = 'A' | 'E' | 'I' | 'O' | 'U';

export interface AdvancedLipSync {
  getMouthOpen(): number;
  getVowelWeights(): Record<VowelKey, number>;
  connectSource(source: AudioNode): void;
  dispose(): void;
}

// ─── Enhanced System Config ──────────────────────────────────────────────────

export interface Live2DEnhancedConfig {
  autoBlinkEnabled: boolean;
  forceAutoBlinkEnabled: boolean;
  idleAnimationEnabled: boolean;
  expressionEnabled: boolean;
  beatSyncEnabled: boolean;
  shadowEnabled: boolean;
  maxFps: number;               // 0 = unlimited
  renderScale: number;          // HiDPI scale (default: 2)
  beatSyncStyle: BeatSyncStyleName;
  beatSyncAutoStyleShift: boolean;
  lipSyncMode: 'rms' | 'advanced'; // 'rms' = legacy, 'advanced' = wLipSync
}

export const DEFAULT_ENHANCED_CONFIG: Live2DEnhancedConfig = {
  autoBlinkEnabled: true,
  forceAutoBlinkEnabled: false,
  idleAnimationEnabled: true,
  expressionEnabled: true,
  beatSyncEnabled: true,
  shadowEnabled: true,
  maxFps: 0,
  renderScale: 2,
  beatSyncStyle: 'punchy-v',
  beatSyncAutoStyleShift: true,
  lipSyncMode: 'rms', // default to legacy for backward compatibility
};
