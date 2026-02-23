'use client';

import { useAppStore } from '@/store/useAppStore';

const GLOBAL_TABS = [
  { id: 'playground', label: 'Playground' },
  { id: 'settings', label: 'Settings' },
];

const SESSION_TABS = [
  { id: 'info', label: 'Info' },
  { id: 'graph', label: 'Graph' },
  { id: 'command', label: 'Command' },
  { id: 'dashboard', label: 'Dashboard', managerOnly: true },
  { id: 'storage', label: 'Storage' },
  { id: 'logs', label: 'Logs' },
];

function TabButton({ id, label, active, onClick }: { id: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      key={id}
      className={`tab-btn${active ? ' tab-btn-active' : ''}`}
      onClick={onClick}
    >
      {label}
      {active && <span className="tab-indicator" />}
    </button>
  );
}

export default function TabNavigation() {
  const { activeTab, setActiveTab, selectedSessionId, sessions } = useAppStore();

  const selectedSession = sessions.find(s => s.session_id === selectedSessionId);
  const hasSession = !!selectedSessionId && !!selectedSession;
  const showDashboard = selectedSession?.role === 'manager';

  const sessionName = selectedSession?.session_name
    || selectedSessionId?.substring(0, 10)
    || '';

  return (
    <div className="tab-bar">
      {/* ── Global Tabs ── */}
      <div className="tab-group">
        {GLOBAL_TABS.map(tab => (
          <TabButton
            key={tab.id}
            id={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      {/* ── Session Tabs ── */}
      {hasSession && (
        <>
          <div className="tab-divider" />
          <div className="tab-session-badge" title={selectedSession?.session_id}>
            <span className={`tab-session-dot ${selectedSession?.status === 'running' ? 'running' : ''}`} />
            {sessionName}
          </div>
          <div className="tab-group">
            {SESSION_TABS.filter(tab => !tab.managerOnly || showDashboard).map(tab => (
              <TabButton
                key={tab.id}
                id={tab.id}
                label={tab.label}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
