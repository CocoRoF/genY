'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { toolPresetApi } from '@/lib/toolPresetApi';
import { twMerge } from 'tailwind-merge';
import { useI18n } from '@/lib/i18n';
import { Server, Wrench, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import type { AvailableToolsResponse } from '@/types';

function cn(...classes: (string | boolean | undefined | null)[]) {
  return twMerge(classes.filter(Boolean).join(' '));
}

// ==================== Toggle Section (read-only, copied from ToolPresetsTab pattern) ====================

function ToggleSection({
  title,
  icon,
  items,
  activeNames,
}: {
  title: string;
  icon: React.ReactNode;
  items: { name: string; description: string }[];
  activeNames: Set<string>;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);

  const enabledCount = items.filter(i => activeNames.has(i.name)).length;

  return (
    <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
      {/* Section Header */}
      <button
        className="w-full flex items-center gap-2 py-2.5 px-3.5 bg-[var(--bg-secondary)] text-left text-[0.8125rem] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {icon}
        <span className="flex-1">{title}</span>
        <span className={cn(
          'text-[0.6875rem] font-semibold px-1.5 py-0.5 rounded-md',
          enabledCount > 0
            ? 'bg-[rgba(59,130,246,0.12)] text-[var(--primary-color)]'
            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
        )}>
          {enabledCount}/{items.length}
        </span>
        {expanded ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-color)]">
          {items.length === 0 ? (
            <p className="text-[0.75rem] text-[var(--text-muted)] py-4 text-center">{t('toolPresets.noneAvailable')}</p>
          ) : (
            <div className="divide-y divide-[var(--border-color)]">
              {items.map(item => {
                const isOn = activeNames.has(item.name);
                return (
                  <div
                    key={item.name}
                    className={cn(
                      'flex items-center gap-3 py-2.5 px-3.5 transition-colors',
                      !isOn && 'opacity-40',
                    )}
                  >
                    {/* Status dot */}
                    <span className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      isOn ? 'bg-[var(--success-color)] shadow-[0_0_4px_var(--success-color)]' : 'bg-[var(--text-muted)]/40',
                    )} />

                    {/* Info */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className={cn(
                        'text-[0.8125rem] font-mono truncate',
                        isOn ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]',
                      )}>
                        {item.name}
                      </span>
                      {item.description && (
                        <span className="text-[0.6875rem] text-[var(--text-muted)] line-clamp-1">{item.description}</span>
                      )}
                    </div>

                    {/* Badge */}
                    <span className={cn(
                      'text-[0.625rem] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0',
                      isOn
                        ? 'bg-[rgba(16,185,129,0.12)] text-[#10b981]'
                        : 'bg-[rgba(107,114,128,0.12)] text-[var(--text-muted)]',
                    )}>
                      {isOn ? t('toolPresets.on') : t('toolPresets.off')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Main Tab Component ====================

export default function SessionToolsTab() {
  const { selectedSessionId, sessions } = useAppStore();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState<AvailableToolsResponse>({ servers: [], tools: [] });
  const [activeServers, setActiveServers] = useState<string[]>([]);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [presetName, setPresetName] = useState<string | null>(null);

  const session = useMemo(
    () => sessions.find(s => s.session_id === selectedSessionId),
    [sessions, selectedSessionId],
  );

  const fetchData = useCallback(async () => {
    if (!selectedSessionId) return;
    setLoading(true);
    try {
      const [toolsData, avail] = await Promise.all([
        toolPresetApi.getSessionTools(selectedSessionId),
        toolPresetApi.listAvailable(),
      ]);
      setActiveServers(toolsData.active_servers);
      setActiveTools(toolsData.active_tools);
      setPresetName(toolsData.tool_preset_name);
      setAvailable(avail);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeServerSet = useMemo(() => new Set(activeServers), [activeServers]);
  const activeToolSet = useMemo(() => new Set(activeTools), [activeTools]);

  const enabledServerCount = available.servers.filter(s => activeServerSet.has(s.name)).length;
  const enabledToolCount = available.tools.filter(t => activeToolSet.has(t.name)).length;

  // ── No session selected ──
  if (!selectedSessionId) {
    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex items-center justify-center flex-1">
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Wrench size={32} className="mb-3 opacity-60 text-[var(--text-muted)]" />
            <h3 className="text-[1rem] font-medium text-[var(--text-secondary)] mb-2">
              {t('sessionTools.selectSession')}
            </h3>
            <p className="text-[0.8125rem] text-[var(--text-muted)] max-w-[360px]">
              {t('sessionTools.selectSessionDesc')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[0.8125rem] text-[var(--text-muted)]">{t('sessionTools.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between py-3 px-5 border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3 min-w-0">
          <Shield size={18} className="text-[var(--primary-color)] shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-[0.9375rem] font-semibold text-[var(--text-primary)] truncate">
              {t('sessionTools.title')}
            </h3>
            {presetName && (
              <span className="text-[10px] font-semibold py-0.5 px-1.5 rounded-md bg-[rgba(168,85,247,0.12)] text-[#c084fc] border border-[rgba(168,85,247,0.2)] uppercase tracking-wide shrink-0">
                {presetName}
              </span>
            )}
            {session?.session_name && (
              <>
                <span className="w-px h-4 bg-[var(--border-color)] shrink-0" />
                <span className="text-[12px] text-[var(--text-muted)] truncate max-w-[200px]">
                  {session.session_name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Summary badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium py-1 px-2.5 rounded-full bg-[rgba(59,130,246,0.1)] text-[var(--primary-color)] border border-[rgba(59,130,246,0.15)]">
            <Server size={12} />
            {enabledServerCount}/{available.servers.length} {t('toolPresets.serversEnabled')}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium py-1 px-2.5 rounded-full bg-[rgba(16,185,129,0.1)] text-[#10b981] border border-[rgba(16,185,129,0.15)]">
            <Wrench size={12} />
            {enabledToolCount}/{available.tools.length} {t('toolPresets.toolsEnabled')}
          </span>
        </div>

        {/* MCP Servers — read-only */}
        <ToggleSection
          title={t('toolPresets.mcpServers')}
          icon={<Server size={14} className="text-[var(--primary-color)]" />}
          items={available.servers.map(s => ({ name: s.name, description: s.description }))}
          activeNames={activeServerSet}
        />

        {/* Built-in Tools — read-only */}
        <ToggleSection
          title={t('toolPresets.builtInTools')}
          icon={<Wrench size={14} className="text-[var(--text-muted)]" />}
          items={available.tools.map(tool => ({ name: tool.name, description: tool.description }))}
          activeNames={activeToolSet}
        />
      </div>
    </div>
  );
}
