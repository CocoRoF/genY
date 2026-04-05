'use client';

import { useObsidianStore } from '@/store/useObsidianStore';
import { useHubMode } from '@/components/OpsidianHubContext';
import { useI18n } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  FileText,
  Database,
  Tag,
  Link2,
  Brain,
  PanelRight,
  PanelRightClose,
  Loader2,
} from 'lucide-react';

export default function StatusBar({ onRefresh }: { onRefresh: () => void }) {
  const {
    selectedSessionId,
    memoryStats,
    memoryIndex,
    loading,
    selectedFile,
    viewMode,
    rightPanelOpen,
    setRightPanelOpen,
  } = useObsidianStore();
  const hub = useHubMode();
  const { t } = useI18n();
  const router = useRouter();

  if (!selectedSessionId && !hub) return null;

  const stats = memoryStats;

  return (
    <div className="obs-statusbar">
      <div className="obs-sb-left">
        {/* Hub navigation buttons */}
        {hub && (
          <div className="obs-hub-nav">
            <button className="obs-hub-nav-btn" onClick={() => router.push('/')} title={t('opsidian.home')}>
              {t('opsidian.home')}
            </button>
            <button
              className={`obs-hub-nav-btn ${hub.mode === 'user' ? 'obs-hub-nav-active' : ''}`}
              onClick={() => hub.setMode('user')}
            >
              {t('opsidian.userVault')}
            </button>
            <button
              className={`obs-hub-nav-btn ${hub.mode === 'sessions' ? 'obs-hub-nav-active' : ''}`}
              onClick={() => hub.setMode('sessions')}
            >
              {t('opsidian.sessionsVault')}
            </button>
            <span className="obs-hub-nav-sep" />
          </div>
        )}
        <span className="obs-sb-item obs-sb-brand-item">
          <Brain size={12} />
          GenY Obsidian
        </span>
        {selectedSessionId && (
          <>
            <span className="obs-sb-item">
              <FileText size={11} />
              {stats?.total_files ?? 0} files
            </span>
            <span className="obs-sb-item">
              <Database size={11} />
              {((memoryIndex?.total_chars ?? 0) / 1000).toFixed(1)}K chars
            </span>
            <span className="obs-sb-item">
              <Tag size={11} />
              {stats?.total_tags ?? 0} tags
            </span>
            <span className="obs-sb-item">
              <Link2 size={11} />
              {stats?.total_links ?? 0} links
            </span>
          </>
        )}
      </div>
      <div className="obs-sb-right">
        {loading && (
          <span className="obs-sb-item">
            <Loader2 size={11} className="spin" />
            Loading…
          </span>
        )}
        {selectedFile && (
          <span className="obs-sb-item obs-sb-file">
            {selectedFile}
          </span>
        )}
        {selectedSessionId && <span className="obs-sb-item obs-sb-mode">{viewMode}</span>}
        <button className="obs-sb-btn" onClick={onRefresh} title="Refresh memory">
          <RefreshCw size={11} />
        </button>
        <button
          className="obs-sb-btn"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          title={rightPanelOpen ? 'Hide right panel' : 'Show right panel'}
        >
          {rightPanelOpen ? <PanelRightClose size={11} /> : <PanelRight size={11} />}
        </button>
      </div>
    </div>
  );
}
