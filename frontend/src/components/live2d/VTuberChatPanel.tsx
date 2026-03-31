'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { chatApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { ChatRoomMessage } from '@/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * VTuberChatPanel — Conversational chat overlay for VTuber sessions.
 *
 * Uses the Chat Room system for DB-backed persistence:
 *  - Loads history on mount via getRoomMessages()
 *  - Sends messages via broadcastToRoom()
 *  - Receives responses in real-time via SSE subscription
 *
 * Messages survive tab switches because they are stored in DB.
 */
export default function VTuberChatPanel({
  sessionId,
  roomId,
}: {
  sessionId: string;
  roomId?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastMsgIdRef = useRef<string | null>(null);
  const sseRef = useRef<{ close: () => void } | null>(null);

  // Convert ChatRoomMessage to display format
  const toDisplayMessage = useCallback((msg: ChatRoomMessage): ChatMessage => {
    const role = msg.type === 'user' ? 'user' : msg.type === 'system' ? 'system' : 'assistant';
    return {
      id: msg.id,
      role,
      content: msg.content,
      timestamp: new Date(msg.timestamp).getTime(),
    };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load history + subscribe SSE when roomId is available
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    const init = async () => {
      try {
        const historyResp = await chatApi.getRoomMessages(roomId);
        if (cancelled) return;

        const loaded = historyResp.messages.map(toDisplayMessage);
        setMessages(loaded);
        setHistoryLoaded(true);

        if (loaded.length > 0) {
          lastMsgIdRef.current = historyResp.messages[historyResp.messages.length - 1].id;
        }

        // Subscribe to SSE for live updates
        const sub = chatApi.subscribeToRoom(
          roomId,
          lastMsgIdRef.current,
          (eventType, eventData) => {
            if (eventType === 'message') {
              const msg = eventData as unknown as ChatRoomMessage;
              if (!msg.id) return;
              lastMsgIdRef.current = msg.id;
              const displayMsg = toDisplayMessage(msg);
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, displayMsg];
              });
            }
          },
          () => lastMsgIdRef.current,
        );

        sseRef.current = sub;
      } catch (e) {
        console.error('[VTuberChatPanel] Failed to init chat room:', e);
        setHistoryLoaded(true);
      }
    };

    init();

    return () => {
      cancelled = true;
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [roomId, toDisplayMessage]);

  // Reset state when session/room changes
  useEffect(() => {
    setMessages([]);
    setHistoryLoaded(false);
    lastMsgIdRef.current = null;
  }, [sessionId, roomId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !roomId) return;

    setInput('');
    setSending(true);

    try {
      const resp = await chatApi.broadcastToRoom(roomId, { message: text });

      if (resp.user_message) {
        const userMsg = toDisplayMessage(resp.user_message);
        lastMsgIdRef.current = resp.user_message.id;
        setMessages((prev) => {
          if (prev.some((m) => m.id === resp.user_message.id)) return prev;
          return [...prev, userMsg];
        });
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `[neutral] ${t('vtuberChat.errorMessage')}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, roomId, toDisplayMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Strip emotion tag for display, return [emotion, cleanText]
  const parseMessage = (content: string): [string | null, string] => {
    const match = content.match(/^\[(neutral|joy|anger|disgust|fear|smirk|sadness|surprise)\]\s*/);
    if (match) {
      return [match[1], content.slice(match[0].length)];
    }
    return [null, content];
  };

  // No chat room available yet
  if (!roomId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[var(--text-muted)] text-sm opacity-60">
        {t('vtuberChat.preparingRoom')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5 min-h-0"
      >
        {historyLoaded && messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm opacity-60">
            {t('vtuberChat.startConversation')}
          </div>
        )}
        {!historyLoaded && (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm opacity-60">
            <span className="animate-pulse">{t('vtuberChat.loadingHistory')}</span>
          </div>
        )}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';
          const [emotion, text] = isUser || isSystem ? [null, msg.content] : parseMessage(msg.content);

          // System messages (e.g. "1/1 sessions responded") — subtle inline
          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center py-0.5">
                <span className="text-[0.6875rem] text-[var(--text-muted)] opacity-50">
                  {text}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-[0.875rem] leading-relaxed whitespace-pre-wrap break-words ${
                  isUser
                    ? 'bg-[var(--primary-color)] text-white rounded-br-md'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-bl-md'
                }`}
              >
                {emotion && (
                  <span className="text-[0.6875rem] opacity-60 mr-1.5">
                    [{emotion}]
                  </span>
                )}
                {text}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2 rounded-2xl rounded-bl-md bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-[0.875rem]">
              <span className="animate-pulse">...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="flex-1 resize-none px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-[0.875rem] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--primary-color)] transition-colors max-h-[120px]"
            placeholder={t('vtuberChat.inputPlaceholder')}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-[var(--primary-color)] text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
            onClick={handleSend}
            disabled={sending || !input.trim()}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
