/**
 * Auto Blink Plugin — Realistic eye blink animation
 *
 * Ported from AIRI's useMotionUpdatePluginAutoEyeBlink.
 * Provides timer-based blink with dual modes:
 *   - Expression OFF: absolute writes (direct parameter replacement)
 *   - Expression ON:  multiply-modulation (preserves expression values)
 *
 * Blink timing: 75ms close + 75ms open, 3-8 second random interval
 */

import type { MotionPlugin, MotionPluginContext } from '../types';

const BLINK_CLOSE_DURATION = 75;   // ms
const BLINK_OPEN_DURATION = 75;    // ms
const MIN_DELAY = 3000;            // ms
const MAX_DELAY = 8000;            // ms
const BLINK_THRESHOLD = 0.15;      // Skip blink when eyes nearly closed

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
function easeInQuad(t: number): number {
  return t * t;
}

interface BlinkState {
  phase: 'idle' | 'closing' | 'opening';
  progress: number;
  startLeft: number;
  startRight: number;
  delayMs: number;
}

export function createAutoBlinkPlugin(): MotionPlugin {
  const state: BlinkState = {
    phase: 'idle',
    progress: 0,
    startLeft: 1,
    startRight: 1,
    delayMs: MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY),
  };

  let preBlinkLeft = 1.0;
  let preBlinkRight = 1.0;

  function resetState(): void {
    state.phase = 'idle';
    state.progress = 0;
    state.delayMs = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  }

  function updateForcedBlink(dt: number, baseLeft: number, baseRight: number) {
    if (state.phase === 'idle') {
      state.delayMs = Math.max(0, state.delayMs - dt);
      if (state.delayMs === 0) {
        state.phase = 'closing';
        state.progress = 0;
        state.startLeft = baseLeft;
        state.startRight = baseRight;
      }
      return { eyeLOpen: baseLeft, eyeROpen: baseRight };
    }

    if (state.phase === 'closing') {
      state.progress = Math.min(1, state.progress + dt / BLINK_CLOSE_DURATION);
      const eased = easeOutQuad(state.progress);
      const eyeLOpen = clamp01(state.startLeft * (1 - eased));
      const eyeROpen = clamp01(state.startRight * (1 - eased));

      if (state.progress >= 1) {
        state.phase = 'opening';
        state.progress = 0;
      }
      return { eyeLOpen, eyeROpen };
    }

    // Opening
    state.progress = Math.min(1, state.progress + dt / BLINK_OPEN_DURATION);
    const eased = easeInQuad(state.progress);
    const eyeLOpen = clamp01(state.startLeft * eased);
    const eyeROpen = clamp01(state.startRight * eased);

    if (state.progress >= 1) {
      resetState();
    }
    return { eyeLOpen, eyeROpen };
  }

  return (ctx: MotionPluginContext) => {
    // ── EXPRESSION OFF: Main-identical behavior ──
    if (!ctx.expressionEnabled) {
      if (!ctx.isIdleMotion || ctx.handled) return;

      const baseLeft = clamp01(1.0); // model default
      const baseRight = clamp01(1.0);

      if (!ctx.autoBlinkEnabled) {
        resetState();
        ctx.model.setParameterValueById('ParamEyeLOpen', baseLeft);
        ctx.model.setParameterValueById('ParamEyeROpen', baseRight);
        ctx.markHandled();
        return;
      }

      if (ctx.forceAutoBlinkEnabled || !ctx.internalModel.eyeBlink) {
        const rawDelta = Math.max(ctx.timeDelta ?? 0, 0);
        const dt = rawDelta < 5 ? rawDelta * 1000 : rawDelta;
        const safeDt = dt || 16;
        const { eyeLOpen, eyeROpen } = updateForcedBlink(safeDt, baseLeft, baseRight);
        ctx.model.setParameterValueById('ParamEyeLOpen', eyeLOpen);
        ctx.model.setParameterValueById('ParamEyeROpen', eyeROpen);
        ctx.markHandled();
        return;
      }

      // SDK eyeBlink path (updateParameters expects seconds)
      ctx.internalModel.eyeBlink!.updateParameters(ctx.model, ctx.timeDelta / 1000);
      const blinkLeft = ctx.model.getParameterValueById('ParamEyeLOpen') as number;
      const blinkRight = ctx.model.getParameterValueById('ParamEyeROpen') as number;
      ctx.model.setParameterValueById('ParamEyeLOpen', clamp01(blinkLeft * baseLeft));
      ctx.model.setParameterValueById('ParamEyeROpen', clamp01(blinkRight * baseRight));
      ctx.markHandled();
      return;
    }

    // ── EXPRESSION ON: Multiply-modulate behavior ──
    if (!ctx.isIdleMotion) return;

    const baseLeft = clamp01(1.0);
    const baseRight = clamp01(1.0);

    if (!ctx.autoBlinkEnabled) {
      resetState();
      const currentLeft = ctx.model.getParameterValueById('ParamEyeLOpen') as number;
      const currentRight = ctx.model.getParameterValueById('ParamEyeROpen') as number;
      ctx.model.setParameterValueById('ParamEyeLOpen', clamp01(currentLeft * baseLeft));
      ctx.model.setParameterValueById('ParamEyeROpen', clamp01(currentRight * baseRight));
      return;
    }

    if (!ctx.forceAutoBlinkEnabled && ctx.internalModel.eyeBlink != null) {
      resetState();
      const currentLeft = ctx.model.getParameterValueById('ParamEyeLOpen') as number;
      const currentRight = ctx.model.getParameterValueById('ParamEyeROpen') as number;
      ctx.model.setParameterValueById('ParamEyeLOpen', clamp01(currentLeft * baseLeft));
      ctx.model.setParameterValueById('ParamEyeROpen', clamp01(currentRight * baseRight));
      return;
    }

    // Force Auto Blink: stateful blink for models without idle blink curves
    const currentLeft = ctx.model.getParameterValueById('ParamEyeLOpen') as number;
    const currentRight = ctx.model.getParameterValueById('ParamEyeROpen') as number;

    if (state.phase === 'idle' && currentLeft <= BLINK_THRESHOLD && currentRight <= BLINK_THRESHOLD) {
      resetState();
      return;
    }

    if (state.phase === 'idle') {
      preBlinkLeft = currentLeft;
      preBlinkRight = currentRight;
    }

    const wasActive = state.phase !== 'idle';
    const rawDelta = Math.max(ctx.timeDelta ?? 0, 0);
    const dt = rawDelta < 5 ? rawDelta * 1000 : rawDelta;
    const safeDt = dt || 16;
    const { eyeLOpen: blinkFactorL, eyeROpen: blinkFactorR } = updateForcedBlink(safeDt, 1.0, 1.0);

    if (wasActive && state.phase === 'idle') {
      ctx.model.setParameterValueById('ParamEyeLOpen', clamp01(preBlinkLeft * baseLeft));
      ctx.model.setParameterValueById('ParamEyeROpen', clamp01(preBlinkRight * baseRight));
      return;
    }

    if (state.phase === 'idle') return;

    ctx.model.setParameterValueById('ParamEyeLOpen', clamp01(preBlinkLeft * blinkFactorL * baseLeft));
    ctx.model.setParameterValueById('ParamEyeROpen', clamp01(preBlinkRight * blinkFactorR * baseRight));
  };
}
