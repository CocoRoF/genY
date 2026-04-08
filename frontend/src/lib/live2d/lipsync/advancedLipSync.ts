/**
 * Advanced Lip Sync — wLipSync-based ML phoneme detection
 *
 * Ported from AIRI's model-driver-lipsync.
 * Uses the wLipSync AudioWorklet to detect AEIOUS vowels from audio
 * and maps them to a smooth mouth-open value for Live2D.
 *
 * Falls back gracefully to legacy RMS mode if wLipSync initialization fails.
 */

import type { AdvancedLipSync, VowelKey } from '../types';

const RAW_KEYS = ['A', 'E', 'I', 'O', 'U', 'S'] as const;
const RAW_TO_VOWEL: Record<(typeof RAW_KEYS)[number], VowelKey> = {
  A: 'A',
  E: 'E',
  I: 'I',
  O: 'O',
  U: 'U',
  S: 'I', // Treat S as silence/closed; map to small I-like mouth
};

export interface AdvancedLipSyncOptions {
  cap?: number;                  // 0.7 default
  volumeScale?: number;          // 0.9 default
  volumeExponent?: number;       // 0.7 default
  mouthUpdateIntervalMs?: number; // 40ms (~25fps)
  mouthLerpWindowMs?: number;    // 120ms smoothing
}

/**
 * Create an advanced lip sync system using wLipSync AudioWorklet.
 * Returns null if wLipSync is unavailable or initialization fails.
 */
export async function createAdvancedLipSync(
  audioContext: AudioContext,
  options: AdvancedLipSyncOptions = {},
): Promise<AdvancedLipSync | null> {
  try {
    // Dynamic import of wlipsync
    const { createWLipSyncNode } = await import('wlipsync');

    // Load the profile data
    const profileModule = await import('./wlipsync-profile.json');
    const profile = profileModule.default ?? profileModule;

    const node = await createWLipSyncNode(audioContext, profile as any);

    const cap = options.cap ?? 0.7;
    const volumeScale = options.volumeScale ?? 0.9;
    const volumeExponent = options.volumeExponent ?? 0.7;
    const mouthUpdateIntervalMs = options.mouthUpdateIntervalMs ?? 40;
    const mouthLerpWindowMs = options.mouthLerpWindowMs ?? 120;

    const now = () =>
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    let lastRawMouthOpen = 0;
    let lastRawUpdateMs = 0;
    let smoothedMouthOpen = 0;
    let lastSmoothedMs = 0;

    const getVowelWeights = (): Record<VowelKey, number> => {
      const projected: Record<VowelKey, number> = { A: 0, E: 0, I: 0, O: 0, U: 0 };
      const amp = Math.min(((node as any).volume ?? 0) * volumeScale, 1) ** volumeExponent;

      for (const raw of RAW_KEYS) {
        const vowel = RAW_TO_VOWEL[raw];
        const rawVal = (node as any).weights?.[raw] ?? 0;
        projected[vowel] = Math.max(projected[vowel], Math.min(cap, rawVal * amp));
      }

      return projected;
    };

    const computeMouthOpen = () => {
      const weights = Object.values(getVowelWeights());
      return weights.length ? Math.max(...weights) : 0;
    };

    const maybeUpdateRawMouthOpen = (timestamp: number) => {
      if (
        lastRawUpdateMs === 0 ||
        mouthUpdateIntervalMs <= 0 ||
        timestamp - lastRawUpdateMs >= mouthUpdateIntervalMs
      ) {
        lastRawMouthOpen = computeMouthOpen();
        lastRawUpdateMs = timestamp;
      }
    };

    const getSmoothedMouthOpen = (timestamp: number) => {
      if (lastSmoothedMs === 0 || mouthLerpWindowMs <= 0) {
        smoothedMouthOpen = lastRawMouthOpen;
        lastSmoothedMs = timestamp;
        return smoothedMouthOpen;
      }

      const alpha = Math.min(1, (timestamp - lastSmoothedMs) / mouthLerpWindowMs);
      smoothedMouthOpen += (lastRawMouthOpen - smoothedMouthOpen) * alpha;
      lastSmoothedMs = timestamp;
      return smoothedMouthOpen;
    };

    // Prime initial state
    const initialTimestamp = now();
    lastRawMouthOpen = computeMouthOpen();
    lastRawUpdateMs = initialTimestamp;
    smoothedMouthOpen = lastRawMouthOpen;
    lastSmoothedMs = initialTimestamp;

    return {
      getMouthOpen: () => {
        const timestamp = now();
        maybeUpdateRawMouthOpen(timestamp);
        return getSmoothedMouthOpen(timestamp);
      },
      getVowelWeights,
      connectSource: (source: AudioNode) => {
        try {
          source.connect(node);
        } catch (error) {
          console.error('[advanced-lip-sync] failed to connect source:', error);
        }
      },
      dispose: () => {
        try {
          node.disconnect();
        } catch { /* already disconnected */ }
      },
    };
  } catch (err) {
    console.warn('[advanced-lip-sync] wLipSync initialization failed, falling back to RMS mode:', err);
    return null;
  }
}
