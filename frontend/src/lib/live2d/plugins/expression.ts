/**
 * Expression Plugin — Per-frame expression parameter application
 *
 * Ported from AIRI's useMotionUpdatePluginExpression.
 * This plugin intentionally ignores `handled` state so that expression values
 * are always applied on top of whatever the motion/blink plugins produced.
 * It also does NOT call `markHandled()` so it never blocks other plugins.
 */

import type { MotionPlugin, MotionPluginContext } from '../types';
import type { ExpressionController } from '../expressionController';

export function createExpressionPlugin(controller: ExpressionController): MotionPlugin {
  return (ctx: MotionPluginContext) => {
    // Always apply regardless of handled state — expressions layer on top
    controller.applyExpressions(ctx.model);
  };
}
