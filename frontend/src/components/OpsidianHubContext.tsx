'use client';

import { createContext, useContext } from 'react';

export type HubMode = 'user' | 'sessions';

interface HubContextValue {
  mode: HubMode;
  setMode: (m: HubMode) => void;
}

export const HubContext = createContext<HubContextValue | null>(null);

export function useHubMode() {
  return useContext(HubContext);
}
