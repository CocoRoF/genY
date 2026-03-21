import { create } from 'zustand';
import { chatApi } from '@/lib/api';
import type { ChatRoom, ChatRoomMessage, BroadcastStatus } from '@/types';

interface MessengerState {
  // Rooms
  rooms: ChatRoom[];
  activeRoomId: string | null;
  loadingRooms: boolean;
  searchQuery: string;

  // Messages
  messages: ChatRoomMessage[];
  loadingMessages: boolean;
  isSending: boolean;

  // Broadcast progress
  broadcastStatus: BroadcastStatus | null;

  // Event subscription (internal, not exposed directly)
  _eventSub: { close: () => void } | null;
  _lastMsgId: string | null;
  _pollTimer: ReturnType<typeof setInterval> | null;

  // UI
  createModalOpen: boolean;
  inviteModalOpen: boolean;
  mobileSidebarOpen: boolean;
  sidebarCollapsed: boolean;
  memberPanelOpen: boolean;
  selectedMemberId: string | null;

  // Actions - Rooms
  fetchRooms: () => Promise<void>;
  setActiveRoom: (roomId: string | null) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  addMembersToRoom: (sessionIds: string[]) => Promise<void>;
  setSearchQuery: (q: string) => void;

  // Actions - Messages
  sendMessage: (content: string) => Promise<void>;

  // Actions - Event stream
  _subscribeToEvents: (roomId: string) => void;
  _unsubscribeEvents: () => void;
  _ensureSSE: () => void;
  _checkForNewMessages: () => Promise<void>;
  _startPolling: () => void;
  _stopPolling: () => void;

  // Actions - UI
  setCreateModalOpen: (open: boolean) => void;
  setInviteModalOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setMemberPanelOpen: (open: boolean) => void;
  setSelectedMemberId: (id: string | null) => void;

  // Derived
  getActiveRoom: () => ChatRoom | undefined;
  getFilteredRooms: () => ChatRoom[];
}

export const useMessengerStore = create<MessengerState>((set, get) => ({
  rooms: [],
  activeRoomId: null,
  loadingRooms: false,
  searchQuery: '',
  messages: [],
  loadingMessages: false,
  isSending: false,
  broadcastStatus: null,
  _eventSub: null,
  _lastMsgId: null,
  _pollTimer: null,
  createModalOpen: false,
  inviteModalOpen: false,
  mobileSidebarOpen: false,
  sidebarCollapsed: false,
  memberPanelOpen: false,
  selectedMemberId: null,

  fetchRooms: async () => {
    set({ loadingRooms: true });
    try {
      const res = await chatApi.listRooms();
      set({ rooms: res.rooms });
    } catch {
      /* ignore */
    } finally {
      set({ loadingRooms: false });
    }
  },

  setActiveRoom: async (roomId) => {
    const { _unsubscribeEvents } = get();
    _unsubscribeEvents();

    if (!roomId) {
      set({ activeRoomId: null, messages: [], mobileSidebarOpen: false, broadcastStatus: null, _lastMsgId: null });
      return;
    }
    set({ activeRoomId: roomId, loadingMessages: true, mobileSidebarOpen: false, broadcastStatus: null });
    try {
      const msgsRes = await chatApi.getRoomMessages(roomId);
      const msgs = msgsRes.messages;
      const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
      set({ messages: msgs, _lastMsgId: lastId });

      // Subscribe to live events starting from the last known message
      get()._subscribeToEvents(roomId);
    } catch {
      /* ignore */
    } finally {
      set({ loadingMessages: false });
    }
  },

  deleteRoom: async (roomId) => {
    try {
      await chatApi.deleteRoom(roomId);
      const { activeRoomId, _unsubscribeEvents } = get();
      if (activeRoomId === roomId) {
        _unsubscribeEvents();
      }
      set(s => ({
        rooms: s.rooms.filter(r => r.id !== roomId),
        ...(activeRoomId === roomId ? { activeRoomId: null, messages: [], broadcastStatus: null, _lastMsgId: null } : {}),
      }));
    } catch {
      /* ignore */
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  addMembersToRoom: async (sessionIds) => {
    const { activeRoomId, fetchRooms } = get();
    if (!activeRoomId || sessionIds.length === 0) return;
    const room = get().getActiveRoom();
    if (!room) return;
    const merged = [...new Set([...room.session_ids, ...sessionIds])];
    try {
      await chatApi.updateRoom(activeRoomId, { session_ids: merged });
      await fetchRooms();
    } catch {
      /* ignore */
    }
  },

  sendMessage: async (content) => {
    const { activeRoomId } = get();
    if (!activeRoomId || !content.trim()) return;

    set({ isSending: true });

    try {
      const res = await chatApi.broadcastToRoom(activeRoomId, { message: content.trim() });
      // Add user message immediately (optimistic)
      set(s => {
        const alreadyExists = s.messages.some(m => m.id === res.user_message.id);
        if (alreadyExists) return {};
        return {
          messages: [...s.messages, res.user_message],
          _lastMsgId: res.user_message.id,
        };
      });

      if (res.target_count > 0 && res.broadcast_id) {
        set({
          broadcastStatus: {
            broadcast_id: res.broadcast_id,
            total: res.target_count,
            completed: 0,
            responded: 0,
            finished: false,
          },
        });

        // Active response polling — aggressively poll until broadcast
        // completes.  This is the "belt and suspenders" approach: even
        // if SSE delivers the messages, this ensures nothing is missed.
        const sentRoomId = activeRoomId;
        let pollAttempts = 0;
        const maxAttempts = 150; // 150 × 2 s = 5 min max
        const responsePoll = async () => {
          pollAttempts++;
          if (pollAttempts > maxAttempts) return;
          if (get().activeRoomId !== sentRoomId) return;

          try {
            let msgs: typeof res.user_message[];
            try {
              const r = await chatApi.getRoomMessagesDirect(sentRoomId);
              msgs = r.messages;
            } catch {
              const r = await chatApi.getRoomMessages(sentRoomId);
              msgs = r.messages;
            }

            if (msgs.length > 0) {
              const current = get().messages;
              const currentIds = current.map(m => m.id).join(',');
              const serverIds = msgs.map(m => m.id).join(',');
              if (currentIds !== serverIds) {
                const serverIdSet = new Set(msgs.map(m => m.id));
                const localOnly = current.filter(m => !serverIdSet.has(m.id));
                set({
                  messages: [...msgs, ...localOnly],
                  _lastMsgId: msgs[msgs.length - 1].id,
                });
              }
            }

            // Check if broadcast is done (system summary message appeared)
            const hasSummary = msgs.some(
              m => m.type === 'system' &&
                   m.timestamp > res.user_message.timestamp &&
                   m.content.includes('sessions responded'),
            );
            if (hasSummary) {
              set({ broadcastStatus: null });
              get().fetchRooms();
              return; // done
            }
          } catch { /* ignore */ }

          // Schedule next poll
          setTimeout(responsePoll, 2000);
        };
        setTimeout(responsePoll, 1500); // first check after 1.5s
      }

      get().fetchRooms();
    } catch (e: unknown) {
      set(s => ({
        messages: [...s.messages, {
          id: `err-${Date.now()}`,
          type: 'system' as const,
          content: e instanceof Error ? e.message : 'Failed to send message',
          timestamp: new Date().toISOString(),
        }],
      }));
    } finally {
      set({ isSending: false });
    }
  },

  _subscribeToEvents: (roomId: string) => {
    const { _lastMsgId, _unsubscribeEvents } = get();
    _unsubscribeEvents();

    const sub = chatApi.subscribeToRoom(
      roomId,
      _lastMsgId,
      (eventType, eventData) => {
        const state = get();
        if (state.activeRoomId !== roomId) return;

        switch (eventType) {
          case 'message': {
            const msg = eventData as unknown as ChatRoomMessage;
            set(s => {
              if (s.messages.some(m => m.id === msg.id)) return {};
              return {
                messages: [...s.messages, msg],
                _lastMsgId: msg.id,
              };
            });
            break;
          }
          case 'broadcast_status': {
            const status = eventData as unknown as BroadcastStatus;
            set({ broadcastStatus: status });
            break;
          }
          case 'broadcast_done': {
            set({ broadcastStatus: null });
            get().fetchRooms();
            break;
          }
        }
      },
      () => get()._lastMsgId,
    );

    set({ _eventSub: sub });
    // Start polling as a reliable fallback for real-time delivery
    get()._startPolling();
  },

  _unsubscribeEvents: () => {
    const { _eventSub } = get();
    get()._stopPolling();
    if (_eventSub) {
      _eventSub.close();
      set({ _eventSub: null });
    }
  },

  _ensureSSE: () => {
    const { activeRoomId, _eventSub } = get();
    if (activeRoomId && !_eventSub) {
      get()._subscribeToEvents(activeRoomId);
    }
  },

  _checkForNewMessages: async () => {
    const { activeRoomId } = get();
    if (!activeRoomId) return;

    try {
      // Use direct backend fetch with cache-busting to avoid any
      // proxy/rewrite/browser caching that could serve stale data.
      let serverMsgs: ChatRoomMessage[];
      try {
        const direct = await chatApi.getRoomMessagesDirect(activeRoomId);
        serverMsgs = direct.messages;
      } catch {
        // Direct backend unreachable — fall back to API through Next.js proxy
        const proxied = await chatApi.getRoomMessages(activeRoomId);
        serverMsgs = proxied.messages;
      }

      if (!serverMsgs.length) return;

      // Always sync from server truth — compare ID fingerprints
      const currentMessages = get().messages;
      const localIds = currentMessages.map(m => m.id).join(',');
      const serverIds = serverMsgs.map(m => m.id).join(',');

      if (localIds !== serverIds) {
        // Preserve local-only messages (e.g. optimistic error msgs)
        const serverIdSet = new Set(serverMsgs.map(m => m.id));
        const localOnly = currentMessages.filter(m => !serverIdSet.has(m.id));
        set({
          messages: [...serverMsgs, ...localOnly],
          _lastMsgId: serverMsgs[serverMsgs.length - 1].id,
        });
      }
    } catch {
      // polling failure is non-critical
    }
  },

  _startPolling: () => {
    get()._stopPolling();
    const timer = setInterval(() => {
      get()._checkForNewMessages();
    }, 2000);
    set({ _pollTimer: timer });
  },

  _stopPolling: () => {
    const { _pollTimer } = get();
    if (_pollTimer) {
      clearInterval(_pollTimer);
      set({ _pollTimer: null });
    }
  },

  setCreateModalOpen: (open) => set({ createModalOpen: open }),
  setInviteModalOpen: (open) => set({ inviteModalOpen: open }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  toggleSidebarCollapsed: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMemberPanelOpen: (open) => set({ memberPanelOpen: open, ...(!open ? { selectedMemberId: null } : {}) }),
  setSelectedMemberId: (id) => set({ selectedMemberId: id, memberPanelOpen: !!id }),

  getActiveRoom: () => {
    const { rooms, activeRoomId } = get();
    return rooms.find(r => r.id === activeRoomId);
  },

  getFilteredRooms: () => {
    const { rooms, searchQuery } = get();
    if (!searchQuery.trim()) return rooms;
    const q = searchQuery.toLowerCase();
    return rooms.filter(r => r.name.toLowerCase().includes(q));
  },
}));
