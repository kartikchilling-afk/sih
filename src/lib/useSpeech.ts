import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from './i18n';

const langCodes: Record<Lang, string> = {
  en: 'en-US',
  hi: 'hi-IN',
  mr: 'mr-IN',
};

export function useSpeech(lang: Lang) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn('SpeechRecognition not supported in this browser');
      return false;
    }
    try {
      recognitionRef.current?.stop();
    } catch { /* ignore */ }
    const rec = new SR();
    rec.lang = langCodes[lang];
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = (e: any) => {
      console.warn('Speech recognition error:', e.error);
      setIsListening(false);
    };
    try {
      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
    } catch (err) {
      console.warn('Failed to start recognition:', err);
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
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCodes[lang];
    utter.rate = 0.9;
    const pickVoice = () => {
      const voices = synthRef.current?.getVoices() || [];
      if (voices.length === 0) return;
      const langPrefix = langCodes[lang].split('-')[0];
      const match = voices.find((v) => v.lang.startsWith(langPrefix)) || voices.find((v) => v.lang.startsWith('en'));
      if (match) utter.voice = match;
    };
    pickVoice();
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utter);
  }, [lang]);

  useEffect(() => {
    if (!synthRef.current) return;
    synthRef.current.onvoiceschanged = () => { synthRef.current?.getVoices(); };
  }, []);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    synthRef.current?.cancel();
  }, []);

  return { isListening, transcript, isSpeaking, startListening, stopListening, speak, stopSpeaking, setTranscript };
}
