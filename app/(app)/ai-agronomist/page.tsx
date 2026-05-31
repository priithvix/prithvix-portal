'use client';

import {
  useState, useRef, useEffect, useCallback, type ReactNode, type ChangeEvent,
} from 'react';
import { useData } from '@/contexts/DataContext';
import { useAI, type ChatSession } from '@/contexts/AIContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Bot, Send, User, Leaf, Bug, Droplets, Globe, ExternalLink, TrendingUp,
  CloudRain, Sprout, Sun, Brain, BadgeIndianRupee, Copy, Check, Mic, MicOff,
  ChevronDown, Sparkles, Wheat, ThumbsUp, ThumbsDown, RotateCcw,
  Camera, ImagePlus, X, Zap, ScanSearch, AlertCircle, Plus, Trash2,
  MessageSquare, PanelLeftClose, PanelLeft, Pencil, Clock, ChevronRight,
} from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { compressImageToJpegDataUrl } from '@/lib/image-compress-client';
import { toast } from 'sonner';

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderInline(text: string): ReactNode {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`'))
          return <code key={i} className="rounded bg-black/10 px-1 font-mono text-xs dark:bg-white/10">{p.slice(1, -1)}</code>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function renderMessage(content: string): ReactNode {
  const lines = content.split('\n');
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (k: string) => {
    if (!bullets.length) return;
    out.push(
      <ul key={k} className="my-2 space-y-1.5 pl-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
            <span>{renderInline(b)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flush(`f${i}`); return; }
    if (/^[-*•]\s+/.test(t)) { bullets.push(t.replace(/^[-*•]\s+/, '')); return; }
    if (/^\d+\.\s+/.test(t)) { bullets.push(t.replace(/^\d+\.\s+/, '')); return; }
    flush(`f${i}`);
    if (/^#{1,3}\s/.test(t))
      out.push(<p key={i} className="mt-3 mb-1 text-sm font-bold">{renderInline(t.replace(/^#{1,3}\s/, ''))}</p>);
    else
      out.push(<p key={i} className="text-sm leading-relaxed">{renderInline(t)}</p>);
  });
  flush('end');
  return <div className="space-y-1">{out}</div>;
}

// ─── Chips ────────────────────────────────────────────────────────────────────
function getChips(content: string): string[] {
  if (/pest|kide|bollworm|aphid|thrips/i.test(content))
    return ['Organic alternatives?', 'PHI / waiting period?', 'Preventive spray schedule?'];
  if (/fertiliz|urea|npk|khad|dap/i.test(content))
    return ['Foliar spray benefits?', 'Micronutrient symptoms?', 'Soil test kaise karein?'];
  if (/disease|bimari|fungal|blast|blight/i.test(content))
    return ['Fungicide dose aur brand?', 'Seed treatment tips?', 'Spread rokne ke upay?'];
  if (/yield|utpadan|harvest/i.test(content))
    return ['Best variety for region?', 'Soil health tips?', 'Post-harvest storage?'];
  if (/irrigation|paani|drip/i.test(content))
    return ['Drip vs sprinkler?', 'Govt subsidy on drip?', 'Water stress symptoms?'];
  if (/scheme|yojana|insurance|subsidy/i.test(content))
    return ['PMFBY claim kaise karein?', 'KCC kaise milega?', 'e-NAM registration?'];
  return ['Aur detail mein batao', 'Best season for this crop?', 'Govt scheme hai koi?'];
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      title="Copy"
      className="rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Voice ────────────────────────────────────────────────────────────────────
function useVoice(cb: (t: string) => void) {
  const [on, setOn] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  const toggle = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice not supported in this browser'); return; }
    if (on) { ref.current?.stop(); setOn(false); return; }
    const r = new SR();
    r.lang = 'hi-IN'; r.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => { cb(e.results[0][0].transcript); setOn(false); };
    r.onerror = () => { toast.error('Voice error'); setOn(false); };
    r.onend = () => setOn(false);
    r.start(); ref.current = r; setOn(true);
  }, [on, cb]);
  return { on, toggle };
}

// ─── Session date group label ─────────────────────────────────────────────────
function sessionLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd MMM yyyy');
}

// ─── Sidebar session item ─────────────────────────────────────────────────────
function SessionItem({
  session, active, onLoad, onDelete, onRename,
}: {
  session: ChatSession;
  active: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onRename: (t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.title);

  const commit = () => { onRename(title || session.title); setEditing(false); };

  return (
    <div
      onClick={!editing ? onLoad : undefined}
      className={cn(
        'group relative flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 transition-all',
        active
          ? 'bg-primary/10 text-foreground ring-1 ring-primary/20'
          : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
      )}
    >
      <MessageSquare className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-primary' : '')} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded border border-primary bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
          />
        ) : (
          <p className="truncate text-xs font-medium">{session.title}</p>
        )}
        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
          <span>·</span>
          <span>{session.messages.filter((m) => m.role === 'user').length} msgs</span>
        </div>
      </div>
      {/* Action buttons */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="rounded p-1 hover:bg-muted"
          title="Rename"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AIAgronomistPage() {
  const { farmers } = useData();
  const {
    messages, sessionId, isLoading, useWebSearch, toggleWebSearch,
    deepMode, toggleDeepMode, detectedLanguage, sendMessage,
    sessions, loadSession, startNewSession, deleteSession, renameSession,
  } = useAI();

  const [input, setInput] = useState('');
  const [image, setImage] = useState<{ base64: string; name: string } | null>(null);
  const [showScroll, setShowScroll] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [moreQuick, setMoreQuick] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const { on: listening, toggle: toggleVoice } = useVoice((t) =>
    setInput((p) => p ? `${p} ${t}` : t),
  );

  const scrollDown = useCallback((smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => { scrollDown(); }, [messages, isLoading, scrollDown]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const h = () => setShowScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
    el.addEventListener('scroll', h);
    return () => el.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 130) + 'px';
  }, [input]);

  const processImage = async (file: File) => {
    const extOk = /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
    if (!file.type.startsWith('image/') && !extOk) {
      toast.error('Please choose a photo (JPG, PNG, or WebP)');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Photo must be under 20MB');
      return;
    }
    const tid = 'ai-ag-img';
    toast.loading('Preparing photo…', { id: tid });
    try {
      const dataUrl = await compressImageToJpegDataUrl(file);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      setImage({ base64: dataUrl, name: `${baseName}.jpg` });
      toast.success('Photo ready — add a note or press Send', { id: tid });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not use this photo', { id: tid });
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await processImage(f);
    e.target.value = '';
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !image) return;
    if (isLoading) return;
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    const img = image; setImage(null);
    await sendMessage(text, img?.base64, img?.name);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Group sessions by date
  const groupedSessions: Record<string, ChatSession[]> = {};
  sessions.forEach((s) => {
    const label = sessionLabel(s.updatedAt);
    if (!groupedSessions[label]) groupedSessions[label] = [];
    groupedSessions[label].push(s);
  });

  const hasChat = messages.length > 0;
  const crops = ['Gehu', 'Kapas', 'Makka', 'Soya', 'Dhan', 'Pyaz', 'Tamatar', 'Mirchi', 'Sarson'];

  /** Current request includes a photo when the latest message is a user image turn. */
  const analyzingImage =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === 'user' &&
    Boolean(messages[messages.length - 1]?.imageBase64);

  const quickActions = [
    { icon: Bug, label: 'Pest Control', bg: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400', prompt: 'Meri fasal mein kide lag gaye hain. Identify karke dose aur brand ke saath solution batao.' },
    { icon: Droplets, label: 'Irrigation', bg: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400', prompt: 'Mere crop ke liye complete irrigation schedule — pani ki matra, timing, aur drip vs flood.' },
    { icon: Leaf, label: 'Fertilizer', bg: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-900 dark:text-green-400', prompt: 'Complete fertilizer schedule — NPK stages wise, micronutrients aur brands ke saath.' },
    { icon: Sun, label: 'Soil Health', bg: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400', prompt: 'Mitti ki quality kaise sudharu? pH correction aur complete soil health plan batao.' },
    { icon: Sprout, label: 'Crop Disease', bg: 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-950/30 dark:border-yellow-900 dark:text-yellow-400', prompt: 'Fasal ke patte peele ya dhabbe — bimari identify karke spray, dose aur timing batao.' },
    { icon: TrendingUp, label: 'Yield Boost', bg: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/30 dark:border-purple-900 dark:text-purple-400', prompt: 'Is season mein yield badhane ke top 5 tips — seedling se harvest tak complete plan.' },
    { icon: CloudRain, label: 'Season Plan', bg: 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/30 dark:border-sky-900 dark:text-sky-400', prompt: 'Is mahine kaun si fasal best rahegi? Mausam, mitti aur market ke hisab se advisory.' },
    { icon: BadgeIndianRupee, label: 'Govt Schemes', bg: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400', prompt: 'PM-KISAN, PMFBY, KCC, e-NAM — eligibility, benefits aur apply process batao.' },
  ];

  const quickPrimary = quickActions.slice(0, 4);
  const quickExtra = quickActions.slice(4);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ══════════════════════════════════════════════════════════
          SIDEBAR — Chat History
      ══════════════════════════════════════════════════════════ */}
      <aside className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-sidebar transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-0 overflow-hidden',
      )}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">AI Agronomist</span>
          </div>
        </div>

        {/* New chat button */}
        <div className="p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={startNewSession}
            className="w-full justify-start gap-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" /> New Chat
          </Button>
        </div>

        {/* Compact stats */}
        <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-sidebar-border/60 bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <Wheat className="h-3 w-3 shrink-0 text-green-600" />
          <span className="truncate">{farmers.length} farmers</span>
          <span className="text-border">·</span>
          <MessageSquare className="h-3 w-3 shrink-0 text-primary" />
          <span>{sessions.length} chats</span>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No chats yet</p>
              <p className="text-xs text-muted-foreground">Start a conversation!</p>
            </div>
          ) : (
            Object.entries(groupedSessions).map(([label, group]) => (
              <div key={label} className="mb-3">
                <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {label}
                </p>
                <div className="space-y-0.5">
                  {group.map((s) => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      active={s.id === sessionId}
                      onLoad={() => loadSession(s.id)}
                      onDelete={() => {
                        deleteSession(s.id);
                        toast.success('Chat deleted');
                      }}
                      onRename={(t) => renameSession(s.id, t)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar footer */}
        <div className="border-t border-sidebar-border p-3 space-y-1.5">
          <button
            onClick={toggleDeepMode}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition',
              deepMode ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' : 'hover:bg-muted text-muted-foreground',
            )}
          >
            {deepMode ? <Brain className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
            {deepMode ? 'Deep Mode ON' : 'Fast Mode'}
          </button>
          <button
            onClick={toggleWebSearch}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition',
              useWebSearch ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground',
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            {useWebSearch ? 'Web Search ON' : 'Web Search OFF'}
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════
          MAIN CHAT AREA
      ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost" size="icon"
              onClick={() => setSidebarOpen((p) => !p)}
              className="h-8 w-8 text-muted-foreground"
              title={sidebarOpen ? 'Hide sidebar' : 'Show chat history'}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            <div className="flex items-center gap-2">
              {hasChat ? (
                <>
                  <p className="text-sm font-semibold text-foreground line-clamp-1 max-w-[260px]">
                    {sessions.find((s) => s.id === sessionId)?.title ?? 'New Chat'}
                  </p>
                  {detectedLanguage !== 'English' && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs font-normal">🌐 {detectedLanguage}</Badge>
                  )}
                </>
              ) : (
                <p className="text-sm font-medium text-muted-foreground">New Chat</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode indicators */}
            {deepMode && (
              <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400">
                <Brain className="mr-1 h-3 w-3" /> Deep
              </Badge>
            )}
            {useWebSearch && (
              <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary">
                <Globe className="mr-1 h-3 w-3" /> Web
              </Badge>
            )}
            {hasChat && (
              <Button variant="ghost" size="sm" onClick={startNewSession}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-3.5 w-3.5" /> New
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-3xl space-y-5 px-4 py-4">

            {/* Empty state */}
            {!hasChat && (
              <div className="flex flex-col items-center px-1 py-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-emerald-500/10 ring-1 ring-primary/10">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">AI Agronomist</h2>
                <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-snug">
                  Fasal, bimari, khad, schemes — Hindi / Hinglish / English.
                </p>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-2"
                    onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" /> Upload photo
                  </Button>
                  <Button type="button" variant="secondary" size="sm" className="gap-2"
                    onClick={() => cameraRef.current?.click()}>
                    <Camera className="h-4 w-4" /> Camera
                  </Button>
                </div>

                <p className="mt-2 max-w-xs text-[11px] text-muted-foreground">
                  Photos are resized automatically for analysis (works best in daylight, focused leaf/crop).
                </p>

                <div className="mt-4 w-full max-w-md overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex min-w-0 justify-center gap-1.5 px-1">
                    {crops.map((c) => (
                      <span key={c} className="shrink-0 rounded-full border border-border/80 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">{c}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 w-full max-w-lg">
                  <p className="mb-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Quick start</p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickPrimary.map((a, i) => (
                      <button key={i} type="button" disabled={isLoading} onClick={() => sendMessage(a.prompt)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition hover:border-primary/40 hover:bg-muted/40 active:scale-[0.99] disabled:opacity-50',
                          a.bg,
                        )}>
                        <a.icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                        <span className="leading-tight">{a.label}</span>
                      </button>
                    ))}
                  </div>
                  {quickExtra.length > 0 && (
                    <button type="button" onClick={() => setMoreQuick((p) => !p)}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground">
                      {moreQuick ? 'Show fewer' : 'More topics'}
                      <ChevronRight className={cn('h-3.5 w-3.5 transition', moreQuick && 'rotate-90')} />
                    </button>
                  )}
                  {moreQuick && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {quickExtra.map((a, i) => (
                        <button key={i} type="button" disabled={isLoading} onClick={() => sendMessage(a.prompt)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition hover:border-primary/40 hover:bg-muted/40 disabled:opacity-50',
                            a.bg,
                          )}>
                          <a.icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                          <span className="leading-tight">{a.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isLast = !isUser && idx === messages.length - 1;
              const isError = msg.content.startsWith('⏳') || msg.content.startsWith('Main sirf') || msg.content.startsWith('Sorry');
              const ts = new Date(msg.timestamp);

              return (
                <div key={msg.id} className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
                  {/* Avatar */}
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm shadow-sm',
                    isUser ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-primary to-emerald-600 text-white',
                  )}>
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  <div className={cn('group flex max-w-[80%] flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
                    {/* Sender label + time */}
                    <div className={cn('flex items-center gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
                      <span className="text-xs font-semibold text-foreground">{isUser ? 'You' : 'PrithviX AI'}</span>
                      <span className="text-xs text-muted-foreground">{format(ts, 'hh:mm a')}</span>
                    </div>

                    {/* Image */}
                    {msg.imageBase64 && (
                      <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
                        <img src={msg.imageBase64} alt={msg.imageName ?? 'crop'} className="max-h-64 w-auto max-w-[300px] object-cover" />
                        <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5">
                          <ScanSearch className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-xs text-muted-foreground">{msg.imageName ?? 'Crop image'} — sent for analysis</span>
                        </div>
                      </div>
                    )}

                    {/* Bubble */}
                    {(msg.content && msg.content !== '📸 Image sent for analysis') && (
                      <div className={cn(
                        'rounded-2xl px-4 py-3 shadow-sm',
                        isUser
                          ? 'rounded-tr-sm bg-primary text-primary-foreground'
                          : isError
                            ? 'rounded-tl-sm border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                            : 'rounded-tl-sm border border-border/60 bg-card text-foreground',
                      )}>
                        {isError && <AlertCircle className="mb-2 h-4 w-4 text-amber-500" />}
                        {isUser
                          ? <p className="text-sm leading-relaxed">{msg.content}</p>
                          : renderMessage(msg.content)
                        }
                        {!isUser && (
                          <div className="mt-2 flex justify-end">
                            <CopyBtn text={msg.content} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((s, si) => (
                          <a key={`${msg.id}-${si}`} href={s.url} target="_blank" rel="noopener noreferrer" title={s.snippet}
                            className="inline-flex max-w-[200px] items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary">
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{s.title.length > 32 ? s.title.slice(0, 32) + '…' : s.title}</span>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Feedback + follow-up */}
                    {isLast && !isLoading && !isError && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => toast.success('Shukriya! 🙏')} className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:border-green-400 hover:text-green-500 transition">
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => toast('Try rephrasing or enable Deep Mode.')} className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:border-red-400 hover:text-red-500 transition">
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-xs text-muted-foreground">Helpful?</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {getChips(msg.content).map((c, i) => (
                            <button key={i} disabled={isLoading} onClick={() => sendMessage(c)}
                              className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50">
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-600 text-white shadow-sm">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-card px-4 py-3 shadow-sm">
                  <p className="mb-2 text-xs font-semibold text-foreground">PrithviX AI</p>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.32s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.16s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                    <span className="ml-2 text-xs text-muted-foreground">
                      {analyzingImage
                        ? 'Analysing photo…'
                        : deepMode
                          ? 'Deep analysis…'
                          : 'Thinking…'}
                      {useWebSearch && !analyzingImage ? ' · Web search' : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>
        </div>

        {/* Scroll button */}
        {showScroll && (
          <button onClick={() => scrollDown()}
            className="absolute bottom-24 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-lg hover:bg-muted z-10">
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {/* ── Input area ── */}
        <div className="border-t border-border bg-card/90 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl">
            {/* Image preview */}
            {image && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
                <img src={image.base64} alt="preview" className="h-10 w-10 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{image.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><ScanSearch className="h-3 w-3" /> Ready for AI analysis</p>
                </div>
                <button onClick={() => setImage(null)} className="rounded-full p-1 hover:bg-red-100 dark:hover:bg-red-900/30">
                  <X className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2">
              <div className="relative flex-1 rounded-2xl border border-border bg-muted/30 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition">
                <Textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={
                    listening ? '🎤 Bol rahe hain...'
                      : image ? 'Describe the problem or send directly...'
                        : 'Kuch bhi puchho — fasal, bimari, khad, scheme...'
                  }
                  disabled={isLoading}
                  rows={1}
                  className="min-h-[48px] resize-none border-0 bg-transparent px-4 py-3 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                />
                {/* Inline toolbar inside input */}
                <div className="flex items-center gap-1 border-t border-border/40 px-3 py-1.5">
                  <button type="button" onClick={() => fileRef.current?.click()} title="Upload photo"
                    className={cn('rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground', image && 'text-blue-600 dark:text-blue-400')}>
                    <ImagePlus className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => cameraRef.current?.click()} title="Take photo"
                    className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                    <Camera className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={toggleVoice} title="Voice (Hindi)"
                    className={cn('rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground', listening && 'animate-pulse text-red-500')}>
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <div className="flex-1" />
                  {input.length > 120 && <span className="text-[10px] text-muted-foreground tabular-nums">{input.length}</span>}
                  <button type="button"
                    onClick={handleSend}
                    disabled={isLoading || (!input.trim() && !image)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {listening && (
              <p className="mt-1 text-center text-[11px] text-red-500">Listening (Hindi)…</p>
            )}
          </div>
        </div>
      </div>

      {/* Hidden inputs */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
    </div>
  );
}
