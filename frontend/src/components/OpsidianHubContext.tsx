'use client';

import { createContext, useContext, type MutableRefObject } from 'react';

export type HubMode = 'user' | 'sessions' | 'curator';

interface HubContextValue {
  mode: HubMode;
  setMode: (m: HubMode) => void;
  /** Each child view writes its refresh function here. */
  refreshRef: MutableRefObject<() => void>;
}

export const HubContext = createContext<HubContextValue | null>(null);

export function useHubMode() {
  return useContext(HubContext);
}
