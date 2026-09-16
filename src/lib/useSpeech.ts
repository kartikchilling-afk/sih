import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from './i18n';

const langCodes: Record<Lang, string> = {
  en: 'en-US',
  hi: 'hi-IN',
  mr: 'mr-IN',
};

type SpeechResult = { transcript: string };
type SpeechResultList = { length: number; [index: number]: SpeechResult[] };
type SpeechResultEvent = { results: SpeechResultList };
type SpeechErrorEvent = { error: string };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function useSpeech(lang: Lang) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
  }, []);

  const startListening = useCallback(() => {
    setSpeechError('');
    const speechWindow = window as SpeechWindow;
    const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SR) {
      setSpeechError('Voice input is not supported in this browser. Please type your answer.');
      return false;
    }
    try {
      recognitionRef.current?.stop();
    } catch { /* ignore */ }
    const rec = new SR();
    rec.lang = langCodes[lang];
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event: SpeechResultEvent) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = (e: SpeechErrorEvent) => {
      console.warn('Speech recognition error:', e.error);
      setSpeechError(e.error === 'not-allowed'
        ? 'Microphone access is blocked. Allow microphone access for this site and try again.'
        : `Voice input stopped: ${e.error}. Please try again or type your answer.`);
      setIsListening(false);
    };
    try {
      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
    } catch (err) {
      console.warn('Failed to start recognition:', err);
      setSpeechError('Could not start the microphone. Please try again or type your answer.');
      setIsListening(false);
      return false;
    }
    return true;
  }, [lang]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string) => {
    const synth = synthRef.current;
    if (!synth || !('SpeechSynthesisUtterance' in window)) {
      setSpeechError('Audio playback is not supported in this browser.');
      return;
    }
    setSpeechError('');
    synth.cancel();
    const speakNow = () => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = langCodes[lang];
      utter.rate = 0.9;
      const langPrefix = langCodes[lang].split('-')[0];
      const voice = synth.getVoices().find((item) => item.lang.toLowerCase().startsWith(langPrefix))
        || synth.getVoices().find((item) => item.lang.toLowerCase().startsWith('en'));
      if (voice) utter.voice = voice;
      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => {
        setIsSpeaking(false);
        setSpeechError('Audio playback could not start. Please try the Listen button again.');
      };
      synth.speak(utter);
    };
    if (synth.getVoices().length > 0) {
      speakNow();
    } else {
      const loadVoices = () => {
        synth.removeEventListener('voiceschanged', loadVoices);
        speakNow();
      };
      synth.addEventListener('voiceschanged', loadVoices, { once: true });
      window.setTimeout(() => {
        synth.removeEventListener('voiceschanged', loadVoices);
        if (!isSpeaking) speakNow();
      }, 500);
    }
  }, [lang]);

  useEffect(() => {
    if (!synthRef.current) return;
    synthRef.current.getVoices();
  }, []);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    synthRef.current?.cancel();
  }, []);

  return { isListening, transcript, isSpeaking, speechError, startListening, stopListening, speak, stopSpeaking, setTranscript };
}
