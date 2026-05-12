// ═══════════════════════════════════════════
// EVA Voice Engine
// Speech-to-text (Chef speaks) + Text-to-speech (EVA speaks)
// ═══════════════════════════════════════════

const AUSTRALIAN_VOICE_NAMES = [
  'karen',
  'natasha',
  'australia',
  'en-au',
  'en_au',
];

let cachedVoice: SpeechSynthesisVoice | null = null;
let speechQueue: string[] = [];
let isSpeaking = false;
let onFinishCallback: (() => void) | null = null;

// ─── Find the best Australian female voice ───
function findAustralianVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  
  const voices = window.speechSynthesis.getVoices();
  
  // Priority 1: Explicit Australian voice
  for (const voice of voices) {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();
    if (
      (lang.includes('en-au') || lang.includes('en_au')) &&
      !name.includes('male')
    ) {
      cachedVoice = voice;
      return voice;
    }
  }

  // Priority 2: Voice with Australian keywords
  for (const voice of voices) {
    const name = voice.name.toLowerCase();
    if (AUSTRALIAN_VOICE_NAMES.some(k => name.includes(k))) {
      cachedVoice = voice;
      return voice;
    }
  }

  // Priority 3: Any English female voice that sounds decent
  for (const voice of voices) {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();
    if (
      lang.startsWith('en') &&
      (name.includes('samantha') || name.includes('victoria') || name.includes('kate'))
    ) {
      cachedVoice = voice;
      return voice;
    }
  }

  // Fallback: first English voice
  const fallback = voices.find(v => v.lang.startsWith('en'));
  cachedVoice = fallback || null;
  return cachedVoice;
}

// ─── EVA speaks ───
export function evaSpeak(text: string, onFinish?: () => void): void {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    onFinish?.();
    return;
  }

  // Clean text for speaking
  const cleaned = text
    .replace(/[#*_`]/g, '')
    .replace(/🔴|🟡|🟢/g, '')
    .replace(/\[SCREEN:.*?\]/g, '')
    .replace(/\[PAUSE\]/g, '...')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();

  if (!cleaned) {
    onFinish?.();
    return;
  }

  // Split into sentences for more natural delivery
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
  speechQueue = sentences.map(s => s.trim()).filter(Boolean);
  onFinishCallback = onFinish || null;
  
  speakNext();
}

function speakNext(): void {
  if (speechQueue.length === 0) {
    isSpeaking = false;
    onFinishCallback?.();
    return;
  }

  isSpeaking = true;
  const sentence = speechQueue.shift()!;
  const utterance = new SpeechSynthesisUtterance(sentence);
  
  const voice = findAustralianVoice();
  if (voice) utterance.voice = voice;
  
  utterance.lang = 'en-AU';
  utterance.rate = 0.95;
  utterance.pitch = 1.05;
  utterance.volume = 1;

  utterance.onend = () => {
    // Small pause between sentences
    setTimeout(speakNext, 150);
  };

  utterance.onerror = () => {
    speakNext();
  };

  window.speechSynthesis.speak(utterance);
}

export function evaStopSpeaking(): void {
  speechQueue = [];
  isSpeaking = false;
  window.speechSynthesis.cancel();
}

export function evaIsSpeaking(): boolean {
  return isSpeaking || window.speechSynthesis.speaking;
}

// ─── Chef speaks (speech-to-text) ───
let recognition: any = null;

export function startListening(
  onResult: (text: string) => void,
  onEnd?: () => void,
  onError?: (error: string) => void
): void {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError?.('Speech recognition not supported on this device');
    return;
  }

  // Stop EVA if she's talking
  evaStopSpeaking();

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US'; // Chef isn't Aussie — use US English for his input
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    const text = event.results[0][0].transcript;
    onResult(text);
  };

  recognition.onend = () => {
    onEnd?.();
  };

  recognition.onerror = (event: any) => {
    if (event.error === 'no-speech') {
      onEnd?.();
    } else {
      onError?.(event.error);
    }
  };

  recognition.start();
}

export function stopListening(): void {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}

// ─── Init voices (must be called after user gesture on some browsers) ───
export function initVoices(): Promise<void> {
  return new Promise((resolve) => {
    if (window.speechSynthesis.getVoices().length > 0) {
      findAustralianVoice();
      resolve();
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      findAustralianVoice();
      resolve();
    };
    // Timeout fallback
    setTimeout(resolve, 2000);
  });
}
