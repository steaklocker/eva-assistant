'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════
// EVA — Voice-First Executive Assistant
// ═══════════════════════════════════════════

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  spoken?: boolean;
};

export default function EVA() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── Init ───
  useEffect(() => {
    setMounted(true);
    // Init voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
        setVoiceReady(true);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // ─── Auto-scroll ───
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // ─── Find Australian voice ───
  const getVoice = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const voices = window.speechSynthesis.getVoices();
    // Try Australian first
    let v = voices.find(v => v.lang.includes('en-AU') && !v.name.toLowerCase().includes('male'));
    if (!v) v = voices.find(v => v.name.toLowerCase().includes('karen'));
    if (!v) v = voices.find(v => v.name.toLowerCase().includes('samantha'));
    if (!v) v = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'));
    if (!v) v = voices.find(v => v.lang.startsWith('en'));
    return v || null;
  }, []);

  // ─── EVA speaks ───
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const clean = text
      .replace(/[#*_`]/g, '')
      .replace(/🔴|🟡|🟢/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim();

    if (!clean) return;

    setSpeaking(true);
    const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
    let i = 0;

    const speakNext = () => {
      if (i >= sentences.length) {
        setSpeaking(false);
        return;
      }
      const utt = new SpeechSynthesisUtterance(sentences[i].trim());
      const voice = getVoice();
      if (voice) utt.voice = voice;
      utt.lang = 'en-AU';
      utt.rate = 0.95;
      utt.pitch = 1.05;
      utt.onend = () => { i++; setTimeout(speakNext, 120); };
      utt.onerror = () => { i++; speakNext(); };
      window.speechSynthesis.speak(utt);
    };

    speakNext();
  }, [getVoice]);

  // ─── Send message ───
  const send = useCallback(async (text: string, isVoice = false) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date(), spoken: isVoice };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const evaMsg: Message = { role: 'assistant', content: data.text, timestamp: new Date() };
      setMessages(prev => [...prev, evaMsg]);

      // EVA speaks her response
      speak(data.text);
    } catch {
      const errMsg: Message = {
        role: 'assistant',
        content: "Chef, connection's playing up. Give me a sec and try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, speak]);

  // ─── Voice input ───
  const toggleListening = useCallback(() => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }

    if (listening) {
      setListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    setListening(true);
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setListening(false);
      send(text, true);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
  }, [listening, speaking, send]);

  // ─── Key handler ───
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  // ─── Quick commands ───
  const quickCommands = [
    { label: 'Morning Brief', cmd: 'Run my morning brief' },
    { label: 'Inventory', cmd: 'Check Shopify inventory for issues' },
    { label: 'Markets', cmd: "What's moving today that affects my businesses?" },
    { label: 'Decisions', cmd: "What am I avoiding?" },
    { label: 'Contacts', cmd: 'Who needs a follow-up?' },
    { label: 'Evening Review', cmd: 'Run my evening review' },
  ];

  if (!mounted) return null;

  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';
  const isEmpty = messages.length === 0 && !loading;

  return (
    <div style={styles.root}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.avatar}>
            <span style={styles.avatarLetter}>E</span>
            {speaking && <div style={styles.speakingRing} />}
          </div>
          <div>
            <div style={styles.name}>EVA</div>
            <div style={styles.status}>
              {speaking ? 'Speaking...' : listening ? 'Listening...' : loading ? 'Thinking...' : 'Online'}
            </div>
          </div>
        </div>
        <div style={styles.time}>
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* ── Conversation ── */}
      <div ref={scrollRef} style={styles.chat}>
        {isEmpty && (
          <div style={styles.welcome}>
            <div style={styles.welcomeAvatar}>
              <span style={{ fontSize: 28 }}>E</span>
            </div>
            <div style={styles.welcomeText}>Good {greeting}, Chef.</div>
            <div style={styles.welcomeSub}>What do you need?</div>
            <div style={styles.quickGrid}>
              {quickCommands.map((q, i) => (
                <button key={i} onClick={() => send(q.cmd)} style={styles.quickBtn}>
                  {q.label}
                </button>
              ))}
            </div>
            <div style={styles.voiceHint}>
              Tap the mic to talk, or type below
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? styles.userRow : styles.evaRow}>
            {msg.role === 'assistant' && <div style={styles.evaDot}>E</div>}
            <div style={msg.role === 'user' ? styles.userBubble : styles.evaBubble}>
              {msg.content.split('\n').map((line, li) => (
                <p key={li} style={styles.msgLine}>
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div style={styles.evaRow}>
            <div style={styles.evaDot}>E</div>
            <div style={styles.evaBubble}>
              <div style={styles.thinking}>
                <span style={{ ...styles.thinkDot, animationDelay: '0ms' }} />
                <span style={{ ...styles.thinkDot, animationDelay: '150ms' }} />
                <span style={{ ...styles.thinkDot, animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick bar (after first message) ── */}
      {!isEmpty && (
        <div style={styles.quickBar}>
          {quickCommands.slice(0, 4).map((q, i) => (
            <button key={i} onClick={() => send(q.cmd)} style={styles.quickBarBtn} disabled={loading}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div style={styles.inputArea}>
        <div style={styles.inputRow}>
          {/* Mic button */}
          <button
            onClick={toggleListening}
            style={{
              ...styles.micBtn,
              background: listening ? 'var(--red)' : speaking ? 'var(--amber)' : 'var(--surface)',
              borderColor: listening ? 'var(--red)' : speaking ? 'var(--amber)' : 'var(--border)',
            }}
          >
            {listening ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="white" />
              </svg>
            ) : speaking ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <line x1="4" y1="4" x2="20" y2="20" />
                <line x1="20" y1="4" x2="4" y2="20" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={listening ? 'Listening...' : 'Talk or type...'}
            disabled={loading || listening}
            rows={1}
            style={styles.textarea}
          />

          {/* Send */}
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            style={{
              ...styles.sendBtn,
              opacity: loading || !input.trim() ? 0.3 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════
// Styles — phone-first, dark, minimal
// ═══════════════════════════════════════════
const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    overflow: 'hidden',
  },

  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    minHeight: 60,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--bg)',
  },
  speakingRing: {
    position: 'absolute' as const,
    inset: -3,
    borderRadius: 14,
    border: '2px solid var(--accent)',
    animation: 'pulse-ring 1.2s ease-out infinite',
  },
  name: { fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' },
  status: { fontSize: 11, color: 'var(--text-muted)', marginTop: 1 },
  time: { fontSize: 13, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' as const },

  // Chat area
  chat: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 0',
  },

  // Welcome state
  welcome: { textAlign: 'center' as const, padding: '48px 20px 24px' },
  welcomeAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    color: 'var(--bg)',
    fontWeight: 700,
  },
  welcomeText: { fontSize: 20, fontWeight: 300, color: 'var(--text)' },
  welcomeSub: { fontSize: 14, color: 'var(--text-dim)', marginTop: 4 },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
    maxWidth: 340,
    margin: '28px auto 0',
  },
  quickBtn: {
    padding: '12px 10px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text-muted)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  voiceHint: {
    fontSize: 11,
    color: 'var(--text-dim)',
    marginTop: 20,
    fontStyle: 'italic' as const,
  },

  // Messages
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '4px 16px',
    marginBottom: 4,
  },
  evaRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '4px 16px',
    marginBottom: 8,
  },
  evaDot: {
    width: 26,
    height: 26,
    borderRadius: 8,
    background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--bg)',
    flexShrink: 0,
    marginTop: 2,
  },
  userBubble: {
    maxWidth: '75%',
    padding: '10px 14px',
    borderRadius: '16px 16px 4px 16px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  evaBubble: {
    maxWidth: '80%',
    padding: '10px 14px',
    borderRadius: '4px 16px 16px 16px',
    background: 'transparent',
  },
  msgLine: {
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--text-muted)',
    margin: '2px 0',
  },

  // Thinking animation
  thinking: { display: 'flex', gap: 4, padding: '4px 0' },
  thinkDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--accent)',
    animation: 'breathe 1s ease-in-out infinite',
  },

  // Quick bar
  quickBar: {
    display: 'flex',
    gap: 6,
    padding: '6px 16px',
    overflowX: 'auto' as const,
    borderTop: '1px solid var(--border)',
  },
  quickBarBtn: {
    padding: '5px 12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 11,
    color: 'var(--text-dim)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    fontFamily: 'inherit',
  },

  // Input area
  inputArea: {
    padding: '8px 12px 24px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  textarea: {
    flex: 1,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '11px 14px',
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.4,
    resize: 'none' as const,
    outline: 'none',
    minHeight: 44,
    maxHeight: 100,
    fontFamily: 'inherit',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
};
