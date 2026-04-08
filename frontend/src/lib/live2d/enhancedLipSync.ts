/**
 * Enhanced Lip Sync Controller — Unified RMS + wLipSync
 *
 * Extends the existing Geny LipSyncController to support both:
 *   - Legacy RMS mode (existing behavior, backward compatible)
 *   - Advanced wLipSync mode (ML-based vowel detection from AIRI)
 *
 * The controller auto-detects wLipSync availability and falls back gracefully.
 */

import type { AdvancedLipSync, CubismCoreModel } from './types';
import { createAdvancedLipSync } from './lipsync/advancedLipSync';

const RMS_SMOOTHING = 0.3;
const RMS_MOUTH_OPEN_SCALE = 1.8;
const RMS_THRESHOLD = 0.015;

export class EnhancedLipSyncController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any = null;
  private smoothValue = 0;
  private advancedLipSync: AdvancedLipSync | null = null;
  private _mode: 'rms' | 'advanced' = 'rms';
  private _initialized = false;

  /** Connect a Live2D model */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setModel(model: any): void {
    this.model = model;
  }

  /** Get current mode */
  get mode(): 'rms' | 'advanced' {
    return this._mode;
  }

  /** Check if advanced mode is available */
  get isAdvancedAvailable(): boolean {
    return this.advancedLipSync !== null;
  }

  /**
   * Initialize advanced lip sync (wLipSync).
   * Must be called after AudioContext is available.
   * Falls back to RMS if initialization fails.
   */
  async initAdvanced(audioContext: AudioContext): Promise<boolean> {
    if (this._initialized) return this.advancedLipSync !== null;

    this._initialized = true;
    this.advancedLipSync = await createAdvancedLipSync(audioContext);

    if (this.advancedLipSync) {
      this._mode = 'advanced';
      console.log('[EnhancedLipSync] wLipSync initialized successfully');
      return true;
    }

    console.log('[EnhancedLipSync] wLipSync unavailable, using RMS mode');
    this._mode = 'rms';
    return false;
  }

  /** Set mode explicitly */
  setMode(mode: 'rms' | 'advanced'): void {
    if (mode === 'advanced' && !this.advancedLipSync) {
      console.warn('[EnhancedLipSync] Cannot switch to advanced mode — wLipSync not initialized');
      return;
    }
    this._mode = mode;
  }

  /**
   * Connect an audio source to the advanced lip sync node.
   * Only works in advanced mode.
   */
  connectSource(source: AudioNode): void {
    this.advancedLipSync?.connectSource(source);
  }

  /**
   * Legacy RMS amplitude callback (for backward compatibility with AudioManager).
   * Only used in RMS mode.
   */
  onAmplitude = (amplitude: number): void => {
    if (this._mode === 'advanced') {
      // In advanced mode, wLipSync handles lip sync directly via updateFrame()
      // Still track amplitude for fallback
      this.smoothValue = RMS_SMOOTHING * this.smoothValue + (1 - RMS_SMOOTHING) * amplitude;
      return;
    }

    // Legacy RMS mode
    this.smoothValue = RMS_SMOOTHING * this.smoothValue + (1 - RMS_SMOOTHING) * amplitude;

    if (!this.model?.internalModel?.coreModel) return;
    const coreModel = this.model.internalModel.coreModel;
    const mouthOpen = this.smoothValue > RMS_THRESHOLD
      ? Math.min(this.smoothValue * RMS_MOUTH_OPEN_SCALE, 1.0)
      : 0;
    coreModel.setParameterValueById('ParamMouthOpenY', mouthOpen);
  };

  /**
   * Per-frame update for advanced lip sync mode.
   * Call this in the animation loop when in advanced mode.
   */
  updateFrame(): void {
    if (this._mode !== 'advanced' || !this.advancedLipSync) return;
    if (!this.model?.internalModel?.coreModel) return;

    const coreModel = this.model.internalModel.coreModel;
    const mouthOpen = this.advancedLipSync.getMouthOpen();
    coreModel.setParameterValueById('ParamMouthOpenY', mouthOpen);
  }

  /** Reset state */
  reset(): void {
    this.smoothValue = 0;
    if (this.model?.internalModel?.coreModel) {
      this.model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', 0);
    }
  }

  /** Full cleanup */
  dispose(): void {
    this.reset();
    this.advancedLipSync?.dispose();
    this.advancedLipSync = null;
    this._initialized = false;
    this._mode = 'rms';
  }
}
