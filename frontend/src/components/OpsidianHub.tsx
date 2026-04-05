'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useObsidianStore } from '@/store/useObsidianStore';
import { useI18n } from '@/lib/i18n';
import { Home, User, MessagesSquare } from 'lucide-react';
import UserOpsidianView from './user-opsidian/UserOpsidianView';
import ObsidianView from './obsidian/ObsidianView';
import './obsidian/obsidian.css';

export default function OpsidianHub() {
  const [mode, setMode] = useState<'user' | 'sessions'>('user');
  const router = useRouter();
  const { t } = useI18n();
  const { setSelectedSessionId, selectedSessionId } = useObsidianStore();

  const handleSessionsClick = useCallback(() => {
    if (mode === 'sessions' && selectedSessionId) {
      // Already viewing a session → reset to session selector
      setSelectedSessionId(null);
    } else {
      setMode('sessions');
    }
  }, [mode, selectedSessionId, setSelectedSessionId]);

  return (
    <div className="opsidian-hub">
      <div className="opsidian-hub-content">
        {mode === 'user' ? <UserOpsidianView /> : <ObsidianView />}
      </div>

      <nav className="opsidian-bottom-nav">
        <button
          className="obn-item obn-home"
          onClick={() => router.push('/')}
        >
          <Home size={18} />
          <span>{t('opsidian.home')}</span>
        </button>
        <button
          className={`obn-item ${mode === 'user' ? 'obn-active' : ''}`}
          onClick={() => setMode('user')}
        >
          <User size={18} />
          <span>{t('opsidian.userVault')}</span>
        </button>
        <button
          className={`obn-item ${mode === 'sessions' ? 'obn-active' : ''}`}
          onClick={handleSessionsClick}
        >
          <MessagesSquare size={18} />
          <span>{t('opsidian.sessionsVault')}</span>
        </button>
      </nav>
    </div>
  );
}
