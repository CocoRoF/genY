'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useVTuberStore } from '@/store/useVTuberStore';
import { getAudioManager } from '@/lib/audioManager';
import {
  EnhancedLipSyncController,
  MotionPipeline,
  ExpressionController,
  createAutoBlinkPlugin,
  createEyeSaccadePlugin,
  createExpressionPlugin,
  createBeatSyncController,
  createBeatSyncPlugin,
  DEFAULT_ENHANCED_CONFIG,
} from '@/lib/live2d';
import type { Live2DEnhancedConfig, BeatSyncController } from '@/lib/live2d';

// Pan/zoom bounds — keeps the model usable but prevents accidental infinite zoom.
const MIN_USER_ZOOM = 0.3;
const MAX_USER_ZOOM = 4;
const WHEEL_ZOOM_SPEED = 0.0015;   // Logarithmic factor per wheel-deltaY unit.
const DRAG_CLICK_THRESHOLD_PX = 4; // Below this movement, still counts as a click.

/**
 * Live2DCanvas — Enhanced Live2D Cubism 4 renderer
 *
 * Integrates AIRI's advanced rendering features:
 *   - Motion Plugin Pipeline (pre/post/final plugin stages)
 *   - Auto Blink (timer-based with dual expression modes)
 *   - Eye Saccade (idle eye micro-movements)
 *   - Beat Sync (physics-based head movement to audio beats)
 *   - Expression Controller (Add/Multiply/Overwrite blend modes)
 *   - Enhanced Lip Sync (wLipSync ML vowel detection with RMS fallback)
 *   - DropShadow effect
 *
 * Backward compatible: existing mao_pro and other presets work without changes.
 * Uses generation counter (genRef) to guard against React Strict Mode race conditions.
 */

interface Live2DCanvasProps {
  sessionId: string;
  className?: string;
  interactive?: boolean;
  background?: number;
  backgroundAlpha?: number;
  enhancedConfig?: Partial<Live2DEnhancedConfig>;
}

export default function Live2DCanvas({
  sessionId,
  className = '',
  interactive = true,
  background = 0x000000,
  backgroundAlpha = 0,
  enhancedConfig: configOverrides,
}: Live2DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pixiAppRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRef = useRef<any>(null);
  const genRef = useRef(0);

  // Enhanced system refs
  const lipSyncRef = useRef<EnhancedLipSyncController>(new EnhancedLipSyncController());
  const motionPipelineRef = useRef<MotionPipeline | null>(null);
  const expressionControllerRef = useRef<ExpressionController | null>(null);
  const beatSyncRef = useRef<BeatSyncController | null>(null);
  const hiddenPartIndicesRef = useRef<number[]>([]);
  const configRef = useRef<Live2DEnhancedConfig>({
    ...DEFAULT_ENHANCED_CONFIG,
    ...configOverrides,
  });

  // ── Pan / zoom state (user-controlled view manipulation) ──
  // baseScaleRef holds the fit-to-canvas scale; userZoomRef is the multiplier on top.
  // userPanRef is an additive pixel offset from the resting (initialXshift/Yshift) center.
  // dragRef tracks an in-flight pointer drag — `moved` is read by onClick to suppress
  // tap interactions when the pointer was actually dragging the view.
  const baseScaleRef = useRef(1);
  const userZoomRef = useRef(1);
  const userPanRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const applyTransformRef = useRef<() => void>(() => {});

  // Update config when overrides change
  useEffect(() => {
    configRef.current = { ...DEFAULT_ENHANCED_CONFIG, ...configOverrides };
    motionPipelineRef.current?.updateConfig(configRef.current);
  }, [configOverrides]);

  const model = useVTuberStore((s) => s.getModelForSession(sessionId));
  const avatarState = useVTuberStore((s) => s.avatarStates[sessionId]);
  const interactAction = useVTuberStore((s) => s.interact);

  // ── Initialise Pixi + load Live2D model + enhanced systems ─────
  useEffect(() => {
    if (!model || !containerRef.current) return;

    const gen = ++genRef.current;
    const isStale = () => gen !== genRef.current;

    const init = async () => {
      // ── Load Live2D Cubism Core SDK ──
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (!win.Live2DCubismCore) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[src*="live2dcubismcore"]');
          if (existing) {
            const poll = () => {
              if (win.Live2DCubismCore) return resolve();
              setTimeout(poll, 50);
            };
            poll();
            return;
          }
          const script = document.createElement('script');
          script.src = '/lib/live2d/live2dcubismcore.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Live2D Cubism Core SDK'));
          document.head.appendChild(script);
        });
      }
      if (isStale()) return;

      // ── Dynamic import pixi.js and Live2D display ──
      const PIXI = await import('pixi.js');
      const { Live2DModel } = await import('pixi-live2d-display/cubism4');
      Live2DModel.registerTicker(PIXI.Ticker);
      if (isStale()) return;

      const container = containerRef.current;
      if (!container) return;

      // ── Cleanup any orphaned resources ──
      if (modelRef.current) {
        try { modelRef.current.parent?.removeChild(modelRef.current); } catch { /* ignore */ }
        try { modelRef.current.destroy(); } catch { /* already destroyed */ }
        modelRef.current = null;
      }
      if (pixiAppRef.current) {
        try { pixiAppRef.current.destroy(true); } catch { /* already destroyed */ }
        pixiAppRef.current = null;
      }
      container.innerHTML = '';
      if (isStale()) return;

      // ── Create Pixi Application ──
      const config = configRef.current;
      const app = new PIXI.Application({
        width: container.clientWidth || 600,
        height: container.clientHeight || 600,
        backgroundAlpha,
        backgroundColor: background,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      if (isStale()) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.view as unknown as HTMLElement);
      const canvas = app.view as unknown as HTMLCanvasElement;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      pixiAppRef.current = app;

      // ── FPS limit ──
      if (config.maxFps > 0) {
        app.ticker.maxFPS = config.maxFps;
      }

      // ── Load the Live2D model ──
      const live2dModel = await Live2DModel.from(model.url, {
        autoHitTest: false,
        autoFocus: false,
      });
      if (isStale()) {
        live2dModel.destroy();
        return;
      }
      modelRef.current = live2dModel;

      // ── Compute fit-to-canvas base scale and set anchor ──
      const scaleX = app.screen.width / live2dModel.width;
      const scaleY = app.screen.height / live2dModel.height;
      baseScaleRef.current = Math.min(scaleX, scaleY) * (model.kScale || 0.85);
      live2dModel.anchor.set(0.5, 0.5);

      // ── Reset user-controlled zoom/pan on model swap ──
      userZoomRef.current = 1;
      userPanRef.current = { x: 0, y: 0 };
      dragRef.current.active = false;
      dragRef.current.moved = false;

      // ── Shared transform applier (used by load, resize, wheel, drag) ──
      applyTransformRef.current = () => {
        const a = pixiAppRef.current;
        const m = modelRef.current;
        if (!a || !m) return;
        m.scale.set(baseScaleRef.current * userZoomRef.current);
        m.x = a.screen.width / 2 + (model.initialXshift || 0) + userPanRef.current.x;
        m.y = a.screen.height / 2 + (model.initialYshift || 0) + userPanRef.current.y;
      };
      applyTransformRef.current();

      app.stage.addChild(live2dModel);

      // ── DropShadow effect ──
      // NOTE: @pixi/filter-drop-shadow v5.x is incompatible with pixi.js v7.
      // The v5 filter uses deprecated APIs (settings.FILTER_RESOLUTION, utils.hex2rgb)
      // which corrupt the WebGL clipping/render texture pipeline, causing model parts
      // (e.g. head) to disappear. Disabled until a pixi.js v7-compatible filter is available.
      // To re-enable: install a v7-compatible drop-shadow filter package.

      // ══════════════════════════════════════════════════════════════
      // ── ENHANCED SYSTEMS INITIALIZATION ──
      // ══════════════════════════════════════════════════════════════

      const internalModel = live2dModel.internalModel;

      // ── Resolve hiddenParts IDs → indices (watermark / unwanted part suppression) ──
      // Live2D Parts carry opacity per frame; motions may re-enable them, so we zero
      // opacity each tick (see onTick below).
      hiddenPartIndicesRef.current = [];
      if (model.hiddenParts && model.hiddenParts.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coreModel = internalModel.coreModel as any;
        for (const partId of model.hiddenParts) {
          try {
            const idx = coreModel.getPartIndex?.(partId);
            if (typeof idx === 'number' && idx >= 0) {
              hiddenPartIndicesRef.current.push(idx);
            } else {
              console.warn(`[Live2DCanvas] hiddenPart "${partId}" not found on model "${model.name}"`);
            }
          } catch (err) {
            console.warn(`[Live2DCanvas] Failed to resolve part "${partId}":`, err);
          }
        }
      }

      // ── 1. Enhanced Lip Sync ──
      const lipSync = lipSyncRef.current;
      lipSync.setModel(live2dModel);

      // Try to initialize advanced lip sync (wLipSync)
      const audioManager = getAudioManager();
      if (config.lipSyncMode === 'advanced') {
        try {
          await audioManager.init();
          const audioCtx = audioManager.getAudioContext();
          if (audioCtx) {
            await lipSync.initAdvanced(audioCtx);
          }
        } catch {
          // Fall back to RMS — already default
        }
      }

      // Connect legacy RMS callback (works in both modes)
      audioManager.setAmplitudeCallback(lipSync.onAmplitude);

      // ── 2. Expression Controller ──
      const expressionController = new ExpressionController((paramId: string) => {
        try {
          return (internalModel.coreModel as any).getParameterValueById(paramId) as number;
        } catch { return 0; }
      });
      expressionControllerRef.current = expressionController;

      // ── 3. Beat Sync Controller ──
      const beatSync = createBeatSyncController({
        baseAngles: () => ({ x: 0, y: 0, z: 0 }),
        initialStyle: config.beatSyncStyle,
        autoStyleShift: config.beatSyncAutoStyleShift,
      });
      beatSyncRef.current = beatSync;

      // ── 4. Motion Plugin Pipeline ──
      const pipeline = new MotionPipeline({
        internalModel: internalModel as any,
        config: configRef.current,
      });

      // Register plugins in correct order
      if (config.beatSyncEnabled) {
        pipeline.register(createBeatSyncPlugin(beatSync), 'pre');
      }
      pipeline.register(createEyeSaccadePlugin(), 'post');
      pipeline.register(createAutoBlinkPlugin(), 'final');
      if (config.expressionEnabled) {
        pipeline.register(createExpressionPlugin(expressionController), 'final');
      }

      motionPipelineRef.current = pipeline;

      // ── 5. Hook into the ticker for per-frame updates ──
      const onTick = () => {
        if (!modelRef.current || !motionPipelineRef.current) return;
        const now = performance.now();
        const coreModel = modelRef.current.internalModel?.coreModel;
        if (!coreModel) return;

        // Run motion pipeline (blink, saccade, beat sync, expressions)
        motionPipelineRef.current.update(coreModel, now);

        // Update advanced lip sync (per-frame vowel detection)
        lipSyncRef.current.updateFrame();

        // Force hidden parts to zero opacity (must run AFTER pipeline, since
        // motions / expressions may restore part opacity each frame).
        const hiddenIndices = hiddenPartIndicesRef.current;
        if (hiddenIndices.length > 0) {
          for (const idx of hiddenIndices) {
            try {
              coreModel.setPartOpacityByIndex?.(idx, 0);
            } catch {
              // ignore — part index may be invalid after a model swap
            }
          }
        }
      };

      app.ticker.add(onTick);

      // ── Start idle motion ──
      try {
        await live2dModel.motion(model.idleMotionGroupName || 'Idle');
      } catch {
        // Idle group might not exist
      }
    };

    init().catch((err) => console.error('[Live2DCanvas] Init error:', err));

    return () => {
      genRef.current++;

      // Disconnect enhanced systems
      lipSyncRef.current.reset();
      lipSyncRef.current.setModel(null);
      motionPipelineRef.current?.dispose();
      motionPipelineRef.current = null;
      expressionControllerRef.current?.dispose();
      expressionControllerRef.current = null;
      beatSyncRef.current = null;
      hiddenPartIndicesRef.current = [];
      applyTransformRef.current = () => {};
      userZoomRef.current = 1;
      userPanRef.current = { x: 0, y: 0 };
      dragRef.current.active = false;
      dragRef.current.moved = false;

      // Remove model from stage FIRST, then destroy model, then app.
      if (modelRef.current) {
        try { modelRef.current.parent?.removeChild(modelRef.current); } catch { /* ignore */ }
        try { modelRef.current.destroy(); } catch { /* ignore */ }
        modelRef.current = null;
      }
      if (pixiAppRef.current) {
        try { pixiAppRef.current.destroy(true); } catch { /* ignore */ }
        pixiAppRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.name, model?.url]);

  // ── Apply avatar state changes (expression + motion) ──────
  useEffect(() => {
    if (!avatarState || !modelRef.current) return;
    const live2dModel = modelRef.current;

    // Apply expression
    try {
      live2dModel.expression(avatarState.expression_index);
    } catch {
      // Expression index may be out of range
    }

    // Apply motion (skip idle triggers — idle loops automatically)
    if (avatarState.trigger !== 'system') {
      try {
        live2dModel.motion(avatarState.motion_group, avatarState.motion_index);
      } catch {
        // Motion group may not exist
      }
    }

    // Schedule beat sync pulse on emotion changes (gives liveliness to state transitions)
    if (avatarState.trigger === 'agent_output' && beatSyncRef.current) {
      beatSyncRef.current.scheduleBeat();
    }
  }, [avatarState?.emotion, avatarState?.expression_index, avatarState?.motion_group, avatarState?.motion_index, avatarState?.trigger, avatarState?.timestamp]);

  // ── Handle click/tap on canvas ────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive || !modelRef.current || !containerRef.current) return;

      // Suppress tap if the pointer was dragging the view — the click fires after
      // pointerup regardless, so we gate it on the drag state we just tracked.
      if (dragRef.current.moved) {
        dragRef.current.moved = false;
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const hitArea = y < 0.4 ? 'HitAreaHead' : 'HitAreaBody';
      interactAction(sessionId, hitArea, x, y);

      // Trigger beat sync on interaction for responsiveness
      beatSyncRef.current?.scheduleBeat();
    },
    [interactive, sessionId, interactAction],
  );

  // ── Resize observer ────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !pixiAppRef.current) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        pixiAppRef.current.renderer.resize(width, height);
        if (modelRef.current) {
          const m = modelRef.current;
          // Recompute fit-to-canvas base scale from natural dimensions (undo current scale).
          const naturalW = m.width / (m.scale.x || 1);
          const naturalH = m.height / (m.scale.y || 1);
          baseScaleRef.current =
            Math.min(width / naturalW, height / naturalH) * (model?.kScale || 0.85);
          applyTransformRef.current();
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.kScale, model?.initialXshift, model?.initialYshift]);

  // ── Focus tracking (eye follow mouse) ─────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!modelRef.current) return;
      // Don't snap the eye-focus target while the user is dragging the view —
      // it looks jittery and the focus target isn't where they're looking anyway.
      if (dragRef.current.active) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      modelRef.current.focus(
        x * (pixiAppRef.current?.screen?.width ?? rect.width),
        y * (pixiAppRef.current?.screen?.height ?? rect.height),
      );
    };

    container.addEventListener('mousemove', handleMouseMove);
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ── Pan / zoom interactions ───────────────────────────────
  // Wheel zooms around the cursor (common VTuber-viewer UX); left-button drag
  // pans. Touch / trackpad pinch is deferred — scope can expand if requested.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!interactive) return;

    // Map a clientX/Y pair to Pixi screen coordinates. The canvas display size
    // may differ from app.screen (resolution / DPR), so scale by the ratio.
    const toScreenCoords = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const app = pixiAppRef.current;
      if (!app || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
      const sx = app.screen.width / rect.width;
      const sy = app.screen.height / rect.height;
      return {
        x: (clientX - rect.left) * sx,
        y: (clientY - rect.top) * sy,
      };
    };

    const onWheel = (e: WheelEvent) => {
      if (!modelRef.current || !pixiAppRef.current) return;
      e.preventDefault();

      const app = pixiAppRef.current;
      const oldZoom = userZoomRef.current;
      // Exponential factor keeps zoom feel consistent across input devices.
      const newZoom = Math.max(
        MIN_USER_ZOOM,
        Math.min(MAX_USER_ZOOM, oldZoom * Math.exp(-e.deltaY * WHEEL_ZOOM_SPEED)),
      );
      if (newZoom === oldZoom) return;

      // Zoom around cursor: keep the world point under the cursor stationary.
      // Derivation (anchor=(0.5, 0.5), pan on top of initial shift):
      //   newPan = oldPan * ratio + (cursor - baseline) * (1 - ratio)
      const ratio = newZoom / oldZoom;
      const cursor = toScreenCoords(e.clientX, e.clientY);
      const baselineX = app.screen.width / 2 + (model?.initialXshift || 0);
      const baselineY = app.screen.height / 2 + (model?.initialYshift || 0);
      userPanRef.current = {
        x: userPanRef.current.x * ratio + (cursor.x - baselineX) * (1 - ratio),
        y: userPanRef.current.y * ratio + (cursor.y - baselineY) * (1 - ratio),
      };
      userZoomRef.current = newZoom;
      applyTransformRef.current();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Left button only — right-click reserved for browser menu.
      if (!modelRef.current) return;
      dragRef.current = {
        active: true,
        moved: false,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: userPanRef.current.x,
        startPanY: userPanRef.current.y,
      };
      try { container.setPointerCapture(e.pointerId); } catch { /* capture optional */ }
      container.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.active || e.pointerId !== d.pointerId) return;

      const dx = e.clientX - d.startClientX;
      const dy = e.clientY - d.startClientY;
      if (!d.moved && Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD_PX) {
        d.moved = true;
      }
      if (!d.moved) return;

      const app = pixiAppRef.current;
      const rect = container.getBoundingClientRect();
      if (!app || rect.width === 0 || rect.height === 0) return;
      // Convert client-pixel delta to Pixi-screen-pixel delta.
      const sx = app.screen.width / rect.width;
      const sy = app.screen.height / rect.height;
      userPanRef.current = {
        x: d.startPanX + dx * sx,
        y: d.startPanY + dy * sy,
      };
      applyTransformRef.current();
    };

    const endDrag = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.active || e.pointerId !== d.pointerId) return;
      try { container.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      d.active = false;
      // Keep `d.moved` set — handleClick (onClick) will read and consume it.
      container.style.cursor = interactive ? 'grab' : 'default';
    };

    // pointer capture (above, in pointerdown) routes pointermove/up back to this
    // element even when the pointer leaves it, so we don't need pointerleave.
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', endDrag);
    container.addEventListener('pointercancel', endDrag);

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', endDrag);
      container.removeEventListener('pointercancel', endDrag);
    };
  }, [interactive, model?.initialXshift, model?.initialYshift]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden ${className}`}
      onClick={handleClick}
      style={{
        cursor: interactive ? 'grab' : 'default',
        position: 'relative',
        touchAction: 'none', // Prevent browser pan/zoom from eating pointer gestures.
      }}
    />
  );
}
