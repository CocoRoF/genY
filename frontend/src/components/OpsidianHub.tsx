'use client';

import { useState, useMemo } from 'react';
import { HubContext, type HubMode } from './OpsidianHubContext';
import UserOpsidianView from './user-opsidian/UserOpsidianView';
import ObsidianView from './obsidian/ObsidianView';
import './obsidian/obsidian.css';

export default function OpsidianHub() {
  const [mode, setMode] = useState<HubMode>('user');

  const ctx = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <HubContext.Provider value={ctx}>
      <div className="opsidian-hub">
        <div className="opsidian-hub-content">
          {mode === 'user' ? <UserOpsidianView /> : <ObsidianView />}
        </div>
      </div>
    </HubContext.Provider>
  );
}
