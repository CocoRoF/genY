/**
 * Motion Plugin Pipeline — Plugin-based animation update system
 *
 * Ported from AIRI's motion-manager.ts.
 * Provides a pipeline of pre/post/final plugins that run each frame
 * to control Live2D model parameters (blink, beat sync, expressions, etc.)
 *
 * Pipeline flow: PRE → Hooked Update → POST → FINAL
 */

import type {
  CubismCoreModel,
  Live2DInternalModel,
  MotionPlugin,
  MotionPluginContext,
  Live2DEnhancedConfig,
} from './types';

export interface MotionPipelineOptions {
  internalModel: Live2DInternalModel;
  config: Live2DEnhancedConfig;
}

export class MotionPipeline {
  private prePlugins: MotionPlugin[] = [];
  private postPlugins: MotionPlugin[] = [];
  private finalPlugins: MotionPlugin[] = [];
  private lastUpdateTime = 0;
  private internalModel: Live2DInternalModel;
  private config: Live2DEnhancedConfig;

  constructor(options: MotionPipelineOptions) {
    this.internalModel = options.internalModel;
    this.config = options.config;
  }

  /** Register a plugin at a specific pipeline stage */
  register(plugin: MotionPlugin, stage: 'pre' | 'post' | 'final' = 'pre'): void {
    if (stage === 'pre') this.prePlugins.push(plugin);
    else if (stage === 'post') this.postPlugins.push(plugin);
    else this.finalPlugins.push(plugin);
  }

  /** Update the config reference (for dynamic changes) */
  updateConfig(config: Live2DEnhancedConfig): void {
    this.config = config;
  }

  /**
   * Run the full plugin pipeline for one frame.
   *
   * @param model - Cubism core model
   * @param now - Current timestamp (ms)
   * @param selectedMotionGroup - Currently selected motion group (for idle detection)
   * @returns Whether the update was handled by any plugin
   */
  update(model: CubismCoreModel, now: number, selectedMotionGroup?: string | null): boolean {
    const timeDelta = this.lastUpdateTime ? now - this.lastUpdateTime : 0;

    const currentGroup = this.internalModel.motionManager.state.currentGroup;
    const idleGroup = this.internalModel.motionManager.groups.idle;
    const isIdleMotion =
      !currentGroup ||
      currentGroup === idleGroup ||
      (!!selectedMotionGroup && currentGroup === selectedMotionGroup);

    const ctx: MotionPluginContext = {
      model,
      now,
      timeDelta,
      internalModel: this.internalModel,
      isIdleMotion,
      handled: false,
      markHandled: () => { ctx.handled = true; },
      autoBlinkEnabled: this.config.autoBlinkEnabled,
      forceAutoBlinkEnabled: this.config.forceAutoBlinkEnabled,
      idleAnimationEnabled: this.config.idleAnimationEnabled,
      expressionEnabled: this.config.expressionEnabled,
    };

    // PRE plugins
    this.runPlugins(this.prePlugins, ctx);

    // POST plugins
    this.runPlugins(this.postPlugins, ctx);

    // FINAL plugins always run regardless of handled state
    for (const plugin of this.finalPlugins) {
      plugin(ctx);
    }

    this.lastUpdateTime = now;
    return ctx.handled;
  }

  private runPlugins(plugins: MotionPlugin[], ctx: MotionPluginContext): void {
    for (const plugin of plugins) {
      if (ctx.handled) break;
      plugin(ctx);
    }
  }

  dispose(): void {
    this.prePlugins = [];
    this.postPlugins = [];
    this.finalPlugins = [];
    this.lastUpdateTime = 0;
  }
}
