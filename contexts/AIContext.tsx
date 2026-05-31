'use client';

import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';

export interface AISource {
  title: string;
  url: string;
  snippet: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  imageName?: string;
  timestamp: string; // ISO string for serialization
  sources?: AISource[];
  isImage?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
  language: string;
}

export interface AIContextValue {
  // Current session
  messages: AIMessage[];
  sessionId: string | null;
  isLoading: boolean;
  useWebSearch: boolean;
  toggleWebSearch: () => void;
  deepMode: boolean;
  toggleDeepMode: () => void;
  detectedLanguage: string;
  sendMessage: (message: string, imageBase64?: string, imageName?: string) => Promise<void>;

  // Session management
  sessions: ChatSession[];
  loadSession: (id: string) => void;
  startNewSession: () => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
}

const AIContext = createContext<AIContextValue | null>(null);

export function useAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
}

const STORAGE_KEY = 'prithvix_ai_sessions';
const MAX_SESSIONS = 50;
const MIN_INTERVAL_MS = 4500; // safe buffer for Groq 30 RPM

function generateTitle(firstMsg: string): string {
  const clean = firstMsg.replace(/📸.*/, 'Image Analysis').trim();
  return clean.length > 50 ? clean.slice(0, 50) + '…' : clean || 'New Chat';
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch { /* storage full */ }
}

export function AIProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [deepMode, setDeepMode] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState('English');
  const lastCallRef = useRef<number>(0);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const stored = loadSessions();
    setSessions(stored);
  }, []);

  const toggleWebSearch = () => setUseWebSearch((p) => !p);
  const toggleDeepMode = () => setDeepMode((p) => !p);

  const startNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setDetectedLanguage('English');
  };

  const loadSession = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    setSessionId(id);
    setMessages(session.messages);
    setDetectedLanguage(session.language);
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSessions(updated);
      return updated;
    });
    if (sessionId === id) startNewSession();
  };

  const renameSession = (id: string, title: string) => {
    setSessions((prev) => {
      const updated = prev.map((s) => s.id === id ? { ...s, title } : s);
      saveSessions(updated);
      return updated;
    });
  };

  const persistMessages = (
    sid: string,
    msgs: AIMessage[],
    lang: string,
    title?: string,
  ) => {
    setSessions((prev) => {
      const existing = prev.find((s) => s.id === sid);
      const now = new Date().toISOString();
      const session: ChatSession = {
        id: sid,
        title: title ?? existing?.title ?? generateTitle(msgs[0]?.content ?? ''),
        messages: msgs,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        language: lang,
      };
      const without = prev.filter((s) => s.id !== sid);
      const updated = [session, ...without]; // most recent first
      saveSessions(updated);
      return updated;
    });
  };

  const sendMessage = async (
    userMessage: string,
    imageBase64?: string,
    imageName?: string,
  ) => {
    if (!userMessage.trim() && !imageBase64) return;

    // Rate-limit guard
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallRef.current);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallRef.current = Date.now();

    const newMsg: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage || '📸 Image sent for analysis',
      imageBase64,
      imageName,
      timestamp: new Date().toISOString(),
      isImage: !!imageBase64,
    };

    const sid = sessionId ?? `session_${Date.now()}`;
    if (!sessionId) setSessionId(sid);

    const nextMessages = [...messages, newMsg];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const history = messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage || 'Analyse this crop image and identify disease, pest, or deficiency. Give specific treatment.',
          history,
          useWebSearch,
          deepMode,
          imageBase64,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { reply: string; sources?: AISource[]; lang?: string };
      const lang = data.lang ?? detectedLanguage;
      setDetectedLanguage(lang);

      const replyMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        sources: data.sources,
      };

      const finalMessages = [...nextMessages, replyMsg];
      setMessages(finalMessages);
      persistMessages(sid, finalMessages, lang);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      const isRate = /rate.?limit|429|quota|wait/i.test(detail);
      const errMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: isRate
          ? '⏳ Thoda wait karo (10-15 sec) aur dobara try karo.'
          : detail || 'Sorry, kuch gadbad ho gayi. Please retry.',
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [...nextMessages, errMsg];
      setMessages(finalMessages);
      persistMessages(sid, finalMessages, detectedLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AIContext.Provider value={{
      messages, sessionId, isLoading, useWebSearch, toggleWebSearch,
      deepMode, toggleDeepMode, detectedLanguage, sendMessage,
      sessions, loadSession, startNewSession, deleteSession, renameSession,
    }}>
      {children}
    </AIContext.Provider>
  );
}
