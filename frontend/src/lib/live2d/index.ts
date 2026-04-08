/**
 * Live2D Enhanced System — Public API
 *
 * Re-exports all enhanced Live2D modules for clean imports.
 */

// Types
export type {
  CubismCoreModel,
  Live2DInternalModel,
  ExpressionBlendMode,
  ExpressionEntry,
  ExpressionGroupDefinition,
  ExpressionState,
  MotionManagerUpdateContext,
  MotionPluginContext,
  MotionPlugin,
  BeatSyncStyleName,
  BeatBaseAngles,
  BeatSyncController,
  VowelKey,
  AdvancedLipSync,
  Live2DEnhancedConfig,
} from './types';

export { DEFAULT_ENHANCED_CONFIG } from './types';

// Expression system
export { ExpressionStore, normaliseBlend } from './expressionStore';
export { ExpressionController } from './expressionController';

// Motion pipeline
export { MotionPipeline } from './motionPipeline';

// Plugins
export { createAutoBlinkPlugin } from './plugins/autoBlink';
export { createEyeSaccadePlugin } from './plugins/eyeSaccade';
export { createExpressionPlugin } from './plugins/expression';

// Beat sync
export { createBeatSyncController, createBeatSyncPlugin } from './beatSync';

// Enhanced lip sync
export { EnhancedLipSyncController } from './enhancedLipSync';

// Advanced lip sync (wLipSync)
export { createAdvancedLipSync } from './lipsync/advancedLipSync';
