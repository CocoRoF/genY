/**
 * Eye Saccade Plugin — Idle eye micro-movements
 *
 * Ported from AIRI's animation.ts (useLive2DIdleEyeFocus) and eye-motions.ts.
 * Simulates natural idle eye saccades: random gaze shifts at probabilistic intervals.
 *
 * Uses a probability distribution for inter-saccade intervals
 * (matching real human saccade timing patterns).
 */

import type { MotionPlugin, MotionPluginContext, Live2DInternalModel } from '../types';

// ─── Saccade Interval Distribution (from AIRI eye-motions.ts) ────────────────

const EYE_SACCADE_INT_STEP = 400;
const EYE_SACCADE_INT_P: [number, number][] = [
  [0.075, 800],
  [0.110, 0],
  [0.125, 0],
  [0.140, 0],
  [0.125, 0],
  [0.050, 0],
  [0.040, 0],
  [0.030, 0],
  [0.020, 0],
  [1.000, 0],
];

// Build cumulative probability distribution
for (let i = 1; i < EYE_SACCADE_INT_P.length; i++) {
  EYE_SACCADE_INT_P[i][0] += EYE_SACCADE_INT_P[i - 1][0];
  EYE_SACCADE_INT_P[i][1] = EYE_SACCADE_INT_P[i - 1][1] + EYE_SACCADE_INT_STEP;
}

function randomSaccadeInterval(): number {
  const r = Math.random();
  for (let i = 0; i < EYE_SACCADE_INT_P.length; i++) {
    if (r <= EYE_SACCADE_INT_P[i][0]) {
      return EYE_SACCADE_INT_P[i][1] + Math.random() * EYE_SACCADE_INT_STEP;
    }
  }
  return EYE_SACCADE_INT_P[EYE_SACCADE_INT_P.length - 1][1] + Math.random() * EYE_SACCADE_INT_STEP;
}

// ─── Math helpers (replacing Three.js MathUtils dependency) ──────────────────

function randFloat(low: number, high: number): number {
  return low + Math.random() * (high - low);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export function createEyeSaccadePlugin(): MotionPlugin {
  let nextSaccadeAfter = -1;
  let focusTarget: [number, number] | undefined;
  let lastSaccadeAt = -1;

  return (ctx: MotionPluginContext) => {
    // Only apply during idle motion
    if (!ctx.isIdleMotion || ctx.handled) return;

    const now = ctx.now;

    // Time for a new saccade?
    if (now >= nextSaccadeAfter || now < lastSaccadeAt) {
      focusTarget = [randFloat(-1, 1), randFloat(-1, 0.7)];
      lastSaccadeAt = now;
      // randomSaccadeInterval() returns ms, now is also ms — no division needed
      nextSaccadeAfter = now + randomSaccadeInterval();

      // Drive the focus controller for head-follow
      ctx.internalModel.focusController.focus(
        focusTarget[0] * 0.5,
        focusTarget[1] * 0.5,
        false,
      );
    }

    // focusController.update expects frame delta in ms
    ctx.internalModel.focusController.update(ctx.timeDelta);

    // Direct eye ball parameter control with lerp for smooth transitions
    if (focusTarget) {
      const currentX = ctx.model.getParameterValueById('ParamEyeBallX') as number;
      const currentY = ctx.model.getParameterValueById('ParamEyeBallY') as number;
      ctx.model.setParameterValueById('ParamEyeBallX', lerp(currentX, focusTarget[0], 0.3));
      ctx.model.setParameterValueById('ParamEyeBallY', lerp(currentY, focusTarget[1], 0.3));
    }
  };
}
