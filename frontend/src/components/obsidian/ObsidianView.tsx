'use client';

import { useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useObsidianStore } from '@/store/useObsidianStore';
import { agentApi, memoryApi } from '@/lib/api';
import './obsidian.css';
import SessionSelector from './SessionSelector';
import ObsidianSidebar from './ObsidianSidebar';
import ObsidianTabs from './ObsidianTabs';
import NoteViewer from './NoteViewer';
import GraphView from './GraphView';
import SearchPanel from './SearchPanel';
import StatusBar from './StatusBar';
import RightPanel from './RightPanel';

export default function ObsidianView() {
  const searchParams = useSearchParams();
  const {
    selectedSessionId,
    viewMode,
    sidebarCollapsed,
    rightPanelOpen,
    setLoading,
    setMemoryIndex,
    setMemoryStats,
    setFiles,
    setGraphData,
    setSessions,
    setLoadingSessions,
    setSelectedSessionId,
  } = useObsidianStore();

  // Load sessions on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingSessions(true);
    agentApi.list().then((sessions) => {
      if (!cancelled) {
        setSessions(sessions);
        setLoadingSessions(false);
        // Auto-select session from URL param
        const urlSessionId = searchParams.get('sessionId');
        if (urlSessionId && !selectedSessionId) {
          const match = sessions.find((s: { session_id: string }) => s.session_id === urlSessionId);
          if (match) {
            setSelectedSessionId(urlSessionId);
          }
        }
      }
    }).catch(() => {
      if (!cancelled) setLoadingSessions(false);
    });
    return () => { cancelled = true; };
  }, [setSessions, setLoadingSessions, searchParams, setSelectedSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load memory data when session changes
  const loadSessionMemory = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const [indexRes, graphRes] = await Promise.all([
        memoryApi.getIndex(sessionId),
        memoryApi.getGraph(sessionId),
      ]);
      setMemoryIndex(indexRes.index);
      setMemoryStats(indexRes.stats);
      setFiles(indexRes.index.files);
      setGraphData(graphRes.nodes, graphRes.edges);
    } catch (err) {
      console.error('Failed to load session memory:', err);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setMemoryIndex, setMemoryStats, setFiles, setGraphData]);

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionMemory(selectedSessionId);
    }
  }, [selectedSessionId, loadSessionMemory]);

  if (!selectedSessionId) {
    return (
      <>
        <SessionSelector />
        <StatusBar onRefresh={() => {}} />
      </>
    );
  }

  return (
    <div className="obsidian-root">
      {/* Left sidebar: file tree / tags / backlinks */}
      <ObsidianSidebar />

      {/* Main content area */}
      <div
        className="obsidian-main"
        style={{
          marginLeft: sidebarCollapsed ? 40 : 260,
          marginRight: rightPanelOpen ? 280 : 0,
        }}
      >
        <ObsidianTabs />
        <div className="obsidian-content">
          {viewMode === 'editor' && <NoteViewer />}
          {viewMode === 'graph' && <GraphView />}
          {viewMode === 'search' && <SearchPanel />}
        </div>
      </div>

      {/* Right panel: metadata / backlinks / outline */}
      {rightPanelOpen && <RightPanel />}

      {/* Bottom status bar */}
      <StatusBar onRefresh={() => selectedSessionId && loadSessionMemory(selectedSessionId)} />
    </div>
  );
}
