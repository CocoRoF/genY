'use client';

import { useObsidianStore } from '@/store/useObsidianStore';
import { useUserOpsidianStore } from '@/store/useUserOpsidianStore';
import { useHubMode } from '@/components/OpsidianHubContext';
import { useI18n } from '@/lib/i18n';
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
  ArrowLeftRight,
} from 'lucide-react';

export default function StatusBar({ onRefresh }: { onRefresh: () => void }) {
  const hub = useHubMode();
  const { t } = useI18n();

  // Always read both stores — pick data based on hub mode
  const obsidian = useObsidianStore();
  const userStore = useUserOpsidianStore();

  const isUserMode = hub?.mode === 'user';

  // Derived data — switch source based on mode
  const totalFiles = isUserMode
    ? (userStore.stats?.total_files ?? 0)
    : (obsidian.memoryStats?.total_files ?? 0);
  const totalChars = isUserMode
    ? (userStore.stats?.total_chars ?? 0)
    : (obsidian.memoryIndex?.total_chars ?? 0);
  const totalTags = isUserMode
    ? (userStore.stats?.total_tags ?? 0)
    : (obsidian.memoryStats?.total_tags ?? 0);
  const totalLinks = isUserMode ? 0 : (obsidian.memoryStats?.total_links ?? 0);
  const loading = isUserMode ? userStore.loading : obsidian.loading;
  const selectedFile = isUserMode ? userStore.selectedFile : obsidian.selectedFile;
  const viewMode = isUserMode ? userStore.viewMode : obsidian.viewMode;
  const rightPanelOpen = isUserMode ? userStore.rightPanelOpen : obsidian.rightPanelOpen;
  const togglePanel = isUserMode
    ? () => userStore.setRightPanelOpen(!userStore.rightPanelOpen)
    : () => obsidian.setRightPanelOpen(!obsidian.rightPanelOpen);
  const showViewMode = isUserMode || !!obsidian.selectedSessionId;

  // Session info for sessions mode
  const selectedSession = !isUserMode && obsidian.selectedSessionId
    ? obsidian.sessions.find(s => s.session_id === obsidian.selectedSessionId)
    : null;
  const sessionLabel = selectedSession
    ? (selectedSession.session_name || selectedSession.session_id.slice(0, 8))
    : null;

  // Without hub context (standalone session page), hide when no session
  if (!hub && !obsidian.selectedSessionId) return null;

  return (
    <div className="obs-statusbar">
      <div className="obs-sb-left">
        {/* Hub navigation buttons */}
        {hub && (
          <div className="obs-hub-nav">
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
        {/* Session indicator in sessions mode */}
        {!isUserMode && sessionLabel && (
          <button
            className="obs-sb-item obs-sb-session-btn"
            onClick={() => obsidian.setSelectedSessionId(null)}
            title={t('opsidian.changeSession')}
          >
            <ArrowLeftRight size={11} />
            {sessionLabel}
          </button>
        )}
        <span className="obs-sb-item">
          <FileText size={11} />
          {totalFiles} files
        </span>
        <span className="obs-sb-item">
          <Database size={11} />
          {(totalChars / 1000).toFixed(1)}K chars
        </span>
        <span className="obs-sb-item">
          <Tag size={11} />
          {totalTags} tags
        </span>
        <span className="obs-sb-item">
          <Link2 size={11} />
          {totalLinks} links
        </span>
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
        {showViewMode && <span className="obs-sb-item obs-sb-mode">{viewMode}</span>}
        <button className="obs-sb-btn" onClick={onRefresh} title="Refresh memory">
          <RefreshCw size={11} />
        </button>
        <button
          className="obs-sb-btn"
          onClick={togglePanel}
          title={rightPanelOpen ? 'Hide right panel' : 'Show right panel'}
        >
          {rightPanelOpen ? <PanelRightClose size={11} /> : <PanelRight size={11} />}
        </button>
      </div>
    </div>
  );
}
