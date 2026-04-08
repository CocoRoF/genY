/**
 * Beat Sync Controller — Audio beat-synchronized head movement
 *
 * Ported from AIRI's beat-sync.ts. Removed Vue ref dependencies.
 * Supports 4 animation styles: punchy-v, balanced-v, swing-lr, sway-sine.
 * Uses physics-based spring simulation for smooth head movement.
 *
 * BPM auto-detection: <120 → swing-lr, 120-180 → balanced-v, >180 → punchy-v
 */

import type { BeatBaseAngles, BeatSyncController, BeatSyncStyleName, MotionPlugin, MotionPluginContext } from './types';

type BeatStylePattern = 'v' | 'swing' | 'sway';

interface BeatStyleConfig {
  topYaw: number;
  topRoll: number;
  bottomDip: number;
  pattern: BeatStylePattern;
  swingLift?: number;
}

interface BeatSegment {
  start: number;
  duration: number;
  fromY: number;
  fromZ: number;
  toY: number;
  toZ: number;
}

const DEFAULT_STYLES: Record<BeatSyncStyleName, BeatStyleConfig> = {
  'punchy-v': { topYaw: 10, topRoll: 8, bottomDip: 4, pattern: 'v' },
  'balanced-v': { topYaw: 6, topRoll: 0, bottomDip: 6, pattern: 'v' },
  'swing-lr': { topYaw: 8, topRoll: 0, bottomDip: 6, swingLift: 8, pattern: 'swing' },
  'sway-sine': { topYaw: 10, topRoll: 0, bottomDip: 0, swingLift: 10, pattern: 'sway' },
};

export interface CreateBeatSyncOptions {
  baseAngles: () => BeatBaseAngles;
  releaseDelayMs?: number;
  defaultIntervalMs?: number;
  initialStyle?: BeatSyncStyleName;
  autoStyleShift?: boolean;
}

export function createBeatSyncController(options: CreateBeatSyncOptions): BeatSyncController {
  const {
    baseAngles: baseAnglesGetter,
    releaseDelayMs = 1800,
    defaultIntervalMs = 600,
    initialStyle = 'punchy-v',
    autoStyleShift: initialAutoShift = false,
  } = options;

  let _targetX = 0;
  let _targetY = 0;
  let _targetZ = 0;
  let _velocityX = 0;
  let _velocityY = 0;
  let _velocityZ = 0;
  let _segments: BeatSegment[] = [];
  let _currentTopSide: 'left' | 'right' = 'left';
  let _primed = false;
  let _patternStarted = false;
  let _lastBeatTimestamp: number | null = null;
  let _lastInterval: number | null = null;
  let _avgInterval: number | null = null;
  let _style: BeatSyncStyleName = initialStyle;
  let _autoShift = initialAutoShift;

  const getBaseAngles = () => baseAnglesGetter();

  function lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
  }

  function easeOutCubic(t: number): number {
    return 1 - ((1 - t) ** 3);
  }

  function getStyleConfig(): BeatStyleConfig {
    return DEFAULT_STYLES[_style] || DEFAULT_STYLES['punchy-v'];
  }

  function getTopPose(side: 'left' | 'right') {
    const base = getBaseAngles();
    const { topYaw, topRoll, swingLift, pattern } = getStyleConfig();
    const direction = side === 'left' ? -1 : 1;
    const zOffset = (pattern === 'swing' || pattern === 'sway') ? (swingLift ?? topRoll) : topRoll;
    const z = base.z + ((pattern === 'swing' || pattern === 'sway') ? zOffset : direction * zOffset);
    return { y: base.y + (direction * topYaw), z };
  }

  function getBottomPose() {
    const base = getBaseAngles();
    const { bottomDip } = getStyleConfig();
    return { y: base.y, z: base.z - bottomDip };
  }

  function updateTargets(now: number): void {
    const base = getBaseAngles();
    let currentY: number = _targetY;
    let currentZ: number = _targetZ;

    if (!_primed && !_segments.length) {
      currentY = base.y;
      currentZ = base.z;
    }

    while (_segments.length) {
      const segment = _segments[0];
      if (now < segment.start) {
        currentY = segment.fromY;
        currentZ = segment.fromZ;
        break;
      }
      const progress = Math.min(1, (now - segment.start) / Math.max(segment.duration, 1));
      const eased = easeOutCubic(progress);
      currentY = lerp(segment.fromY, segment.toY, eased);
      currentZ = lerp(segment.fromZ, segment.toZ, eased);
      if (progress >= 1) {
        _segments.shift();
        continue;
      }
      break;
    }

    const timeSinceBeat = _primed && _lastBeatTimestamp != null ? (now - _lastBeatTimestamp) : Infinity;
    const shouldRelease = _primed && !_segments.length && timeSinceBeat > releaseDelayMs;

    if (shouldRelease) {
      _primed = false;
      _patternStarted = false;
      _currentTopSide = 'left';
      _segments = [];
      _lastBeatTimestamp = null;
      currentY = base.y;
      currentZ = base.z;
      _velocityY *= 0.5;
      _velocityZ *= 0.5;
    }

    _targetY = currentY;
    _targetZ = currentZ;
  }

  function scheduleBeat(timestamp?: number | null): void {
    const now = timestamp != null && Number.isFinite(timestamp)
      ? Number(timestamp)
      : (typeof performance !== 'undefined' ? performance.now() : Date.now());

    updateTargets(now);

    if (!_primed) {
      _primed = true;
      _lastBeatTimestamp = now;
      return;
    }

    const interval = Math.min(2000, Math.max(220, _lastBeatTimestamp != null ? (now - _lastBeatTimestamp) : defaultIntervalMs));
    _lastBeatTimestamp = now;
    _lastInterval = interval;
    _avgInterval = _avgInterval == null ? interval : (_avgInterval * 0.7 + interval * 0.3);

    if (_autoShift && _avgInterval) {
      const bpm = 60000 / _avgInterval;
      const targetStyle: BeatSyncStyleName = bpm < 120 ? 'swing-lr' : bpm < 180 ? 'balanced-v' : 'punchy-v';
      if (targetStyle !== _style) _style = targetStyle;
    }

    const halfDuration = Math.max(80, interval / 2);
    const startPose = { y: _targetY, z: _targetZ };
    _segments = [];

    const styleConfig = getStyleConfig();
    const nextSide = _currentTopSide === 'left' ? 'right' : 'left';

    if (styleConfig.pattern === 'v') {
      if (!_patternStarted) {
        const topPose = getTopPose('left');
        _segments.push({
          start: now,
          duration: halfDuration,
          fromY: startPose.y, fromZ: startPose.z,
          toY: topPose.y, toZ: topPose.z,
        });
        _patternStarted = true;
        _currentTopSide = 'left';
        return;
      }
      const bottomPose = getBottomPose();
      const nextTopPose = getTopPose(nextSide);
      _segments.push({
        start: now,
        duration: halfDuration,
        fromY: startPose.y, fromZ: startPose.z,
        toY: bottomPose.y, toZ: bottomPose.z,
      });
      _segments.push({
        start: now + halfDuration,
        duration: halfDuration,
        fromY: bottomPose.y, fromZ: bottomPose.z,
        toY: nextTopPose.y, toZ: nextTopPose.z,
      });
      _currentTopSide = nextSide;
    } else if (styleConfig.pattern === 'swing') {
      const currentSide = _currentTopSide;
      const sidePose = getTopPose(currentSide);
      const oppositePose = getTopPose(nextSide);
      const sidePortion = 0.35;
      const sideDuration = Math.max(60, interval * sidePortion);
      const crossDuration = Math.max(60, interval - sideDuration);
      _segments.push({
        start: now,
        duration: sideDuration,
        fromY: startPose.y, fromZ: startPose.z,
        toY: sidePose.y, toZ: sidePose.z,
      });
      _segments.push({
        start: now + sideDuration,
        duration: crossDuration,
        fromY: sidePose.y, fromZ: sidePose.z,
        toY: oppositePose.y, toZ: oppositePose.z,
      });
      _patternStarted = true;
      _currentTopSide = nextSide;
    } else if (styleConfig.pattern === 'sway') {
      const base = getBaseAngles();
      const currentSide = _currentTopSide;
      const sidePose = getTopPose(currentSide);
      const oppositePose = getTopPose(nextSide);
      const lift = styleConfig.swingLift ?? 10;

      if (!_patternStarted) {
        _segments.push({
          start: now,
          duration: halfDuration,
          fromY: startPose.y, fromZ: startPose.z,
          toY: sidePose.y, toZ: sidePose.z,
        });
        _patternStarted = true;
        _currentTopSide = currentSide;
        return;
      }

      const apexPose = { y: 0, z: base.z + lift };
      const leg1 = Math.max(60, interval * 0.5);
      const leg2 = Math.max(60, interval - leg1);
      _segments.push({
        start: now,
        duration: leg1,
        fromY: startPose.y, fromZ: startPose.z,
        toY: apexPose.y, toZ: apexPose.z,
      });
      _segments.push({
        start: now + leg1,
        duration: leg2,
        fromY: apexPose.y, fromZ: apexPose.z,
        toY: oppositePose.y, toZ: oppositePose.z,
      });
      _patternStarted = true;
      _currentTopSide = nextSide;
    }
  }

  return {
    get targetX() { return _targetX; },
    get targetY() { return _targetY; },
    get targetZ() { return _targetZ; },
    get velocityX() { return _velocityX; },
    set velocityX(v: number) { _velocityX = v; },
    get velocityY() { return _velocityY; },
    set velocityY(v: number) { _velocityY = v; },
    get velocityZ() { return _velocityZ; },
    set velocityZ(v: number) { _velocityZ = v; },
    updateTargets,
    scheduleBeat,
    setStyle: (s: BeatSyncStyleName) => { _style = s; },
    getStyle: () => _style,
    setAutoStyleShift: (enabled: boolean) => { _autoShift = enabled; },
  };
}

// ─── Beat Sync Motion Plugin ─────────────────────────────────────────────────

export function createBeatSyncPlugin(beatSync: BeatSyncController): MotionPlugin {
  // Clamp angle values to Live2D safe range to prevent head from flying off
  const ANGLE_CLAMP = 30;
  const clampAngle = (v: number) => Math.max(-ANGLE_CLAMP, Math.min(ANGLE_CLAMP, v));

  return (ctx: MotionPluginContext) => {
    beatSync.updateTargets(ctx.now);

    // Semi-implicit Euler spring simulation
    const stiffness = 120;
    const damping = 16;
    const mass = 1;

    // ctx.timeDelta is in milliseconds — spring physics needs seconds
    const dt = ctx.timeDelta / 1000;
    if (dt <= 0 || dt > 0.1) return; // Skip bad frames (>100ms = tab was hidden)

    let paramAngleX = ctx.model.getParameterValueById('ParamAngleX') as number;
    let paramAngleY = ctx.model.getParameterValueById('ParamAngleY') as number;
    let paramAngleZ = ctx.model.getParameterValueById('ParamAngleZ') as number;

    // X axis
    {
      const target = beatSync.targetX;
      const pos = paramAngleX;
      const vel = beatSync.velocityX;
      const accel = (stiffness * (target - pos) - damping * vel) / mass;
      beatSync.velocityX = vel + accel * dt;
      paramAngleX = pos + beatSync.velocityX * dt;
      if (Math.abs(target - paramAngleX) < 0.01 && Math.abs(beatSync.velocityX) < 0.01) {
        paramAngleX = target;
        beatSync.velocityX = 0;
      }
    }

    // Y axis
    {
      const target = beatSync.targetY;
      const pos = paramAngleY;
      const vel = beatSync.velocityY;
      const accel = (stiffness * (target - pos) - damping * vel) / mass;
      beatSync.velocityY = vel + accel * dt;
      paramAngleY = pos + beatSync.velocityY * dt;
      if (Math.abs(target - paramAngleY) < 0.01 && Math.abs(beatSync.velocityY) < 0.01) {
        paramAngleY = target;
        beatSync.velocityY = 0;
      }
    }

    // Z axis
    {
      const target = beatSync.targetZ;
      const pos = paramAngleZ;
      const vel = beatSync.velocityZ;
      const accel = (stiffness * (target - pos) - damping * vel) / mass;
      beatSync.velocityZ = vel + accel * dt;
      paramAngleZ = pos + beatSync.velocityZ * dt;
      if (Math.abs(target - paramAngleZ) < 0.01 && Math.abs(beatSync.velocityZ) < 0.01) {
        paramAngleZ = target;
        beatSync.velocityZ = 0;
      }
    }

    ctx.model.setParameterValueById('ParamAngleX', clampAngle(paramAngleX));
    ctx.model.setParameterValueById('ParamAngleY', clampAngle(paramAngleY));
    ctx.model.setParameterValueById('ParamAngleZ', clampAngle(paramAngleZ));
  };
}
