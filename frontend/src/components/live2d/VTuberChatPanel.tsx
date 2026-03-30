'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { agentApi } from '@/lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * VTuberChatPanel — Lightweight conversational chat overlay for VTuber sessions.
 *
 * Shows recent messages as floating bubbles + a text input at the bottom.
 * Executes via the standard agent execute API.
 */
export default function VTuberChatPanel({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      // Use the standard execute API — VTuber workflow handles routing
      const result = await agentApi.execute(sessionId, { prompt: text });
      if (result.output) {
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: result.output,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (e) {
      const errorMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: '[neutral] 죄송해요, 잠시 문제가 생겼어요.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, sessionId]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5 min-h-0"
      >
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm opacity-60">
            대화를 시작해보세요 ✨
          </div>
        )}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const [emotion, text] = isUser ? [null, msg.content] : parseMessage(msg.content);

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
            placeholder="메시지를 입력하세요..."
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
