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
  const speechRequestRef = useRef(0);
  const removeVoiceListenerRef = useRef<(() => void) | null>(null);
  const voiceLoadTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
  }, []);

  const startListening = useCallback(() => {
    setSpeechError('');
    setTranscript('');
    const speechWindow = window as SpeechWindow;
    const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SR) {
      setSpeechError('Voice input is not supported in this browser. Please type your answer.');
      return false;
    }
    const previousRecognition = recognitionRef.current;
    recognitionRef.current = null;
    try { previousRecognition?.stop(); } catch { /* ignore */ }
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
    rec.onend = () => {
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
        setIsListening(false);
      }
    };
    rec.onerror = (e: SpeechErrorEvent) => {
      if (recognitionRef.current !== rec) return;
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
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try { recognition?.stop(); } catch { /* ignore */ }
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string) => {
    const synth = synthRef.current;
    if (!synth || !('SpeechSynthesisUtterance' in window)) {
      setSpeechError('Audio playback is not supported in this browser.');
      return;
    }
    setSpeechError('');
    const request = ++speechRequestRef.current;
    removeVoiceListenerRef.current?.();
    removeVoiceListenerRef.current = null;
    if (voiceLoadTimeoutRef.current !== null) {
      window.clearTimeout(voiceLoadTimeoutRef.current);
      voiceLoadTimeoutRef.current = null;
    }
    setIsSpeaking(false);
    synth.cancel();
    // Chromium can leave speech synthesis paused after an interrupted utterance.
    synth.resume();
    const speakNow = () => {
      if (request !== speechRequestRef.current) return;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = langCodes[lang];
      utter.rate = 0.9;
      const langPrefix = langCodes[lang].split('-')[0];
      const voice = synth.getVoices().find((item) => item.lang.toLowerCase().startsWith(langPrefix))
        || synth.getVoices().find((item) => item.lang.toLowerCase().startsWith('en'));
      if (voice) utter.voice = voice;
      utter.onstart = () => {
        if (request === speechRequestRef.current) setIsSpeaking(true);
      };
      utter.onend = () => {
        if (request === speechRequestRef.current) setIsSpeaking(false);
      };
      utter.onerror = () => {
        if (request === speechRequestRef.current) {
          setIsSpeaking(false);
          setSpeechError('Audio playback could not start. Please try the Listen button again.');
        }
      };
      synth.speak(utter);
    };
    if (synth.getVoices().length > 0) {
      speakNow();
    } else {
      const loadVoices = () => {
        removeVoiceListenerRef.current?.();
        speakNow();
      };
      synth.addEventListener('voiceschanged', loadVoices, { once: true });
      removeVoiceListenerRef.current = () => synth.removeEventListener('voiceschanged', loadVoices);
      voiceLoadTimeoutRef.current = window.setTimeout(() => {
        removeVoiceListenerRef.current?.();
        removeVoiceListenerRef.current = null;
        voiceLoadTimeoutRef.current = null;
        speakNow();
      }, 500);
    }
  }, [lang]);

  useEffect(() => {
    if (!synthRef.current) return;
    synthRef.current.getVoices();
  }, []);

  const stopSpeaking = useCallback(() => {
    speechRequestRef.current += 1;
    removeVoiceListenerRef.current?.();
    removeVoiceListenerRef.current = null;
    if (voiceLoadTimeoutRef.current !== null) {
      window.clearTimeout(voiceLoadTimeoutRef.current);
      voiceLoadTimeoutRef.current = null;
    }
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    removeVoiceListenerRef.current?.();
    if (voiceLoadTimeoutRef.current !== null) window.clearTimeout(voiceLoadTimeoutRef.current);
    synthRef.current?.cancel();
  }, []);

  return { isListening, transcript, isSpeaking, speechError, startListening, stopListening, speak, stopSpeaking, setTranscript };
}
