import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Leaf, MessageCircle, Sparkles, Volume2, X } from 'lucide-react';

type PortalPage = 'overview' | 'clinical-summary' | 'history' | 'documents' | 'health-story' | 'care-path' | 'upload';
export type Language = 'en' | 'hi' | 'mr';

type TutorialStep = { target: string; message: string; title: string };
type PageGuidance = { message: string; next: string; steps: TutorialStep[] };

// --- TRANSLATIONS DICTIONARY ---
const translations: Record<Language, { ui: Record<string, string>, pages: Record<PortalPage, PageGuidance> }> = {
  en: {
    ui: { guide: 'Your MediKiosk guide', thinking: 'Thinking…', listen: 'Listen', whatNext: 'What next?', showAround: 'Show me around', skip: 'Skip tutorial', done: 'Done', next: 'Next', greetingTitle: 'Hi, I’m Veda 👋', greetingSub: 'I can help you use MediKiosk.', minimize: 'Minimize', needHelp: 'Need help?', walkthrough: 'VEDA WALKTHROUGH' },
    pages: {
      overview: { message: 'This is your patient dashboard. You can begin your health story whenever you are ready.', next: 'Start your health story to share what brings you in.', steps: [{ target: '#start-health-story', title: 'Start here', message: 'Let’s begin here. Click this button to share your health story.' }, { target: '#health-story-journey', title: 'Your progress', message: 'This shows each step of your health story, from sharing symptoms to reviewing the summary.' }, { target: '#upload-documents', title: 'Add records', message: 'You can securely add prescriptions, lab reports, and scans here.' }] },
      'clinical-summary': { message: 'Here you’ll find the summary prepared from your health information.', next: 'Review your summary or start a new health story.', steps: [] },
      history: { message: 'You can review your previous health information and reports here.', next: 'Open a health story to see its report.', steps: [] },
      documents: { message: 'Your uploaded medical documents appear here. You can add a new one at any time.', next: 'Use Add document to upload a prescription, report, or scan.', steps: [{ target: '#upload-documents', title: 'Add a document', message: 'Choose this to securely upload a prescription, lab report, scan, or discharge summary.' }] },
      'care-path': { message: 'Choose the care approach that feels right for you today. Both paths are private and guided.', next: 'Select Ayurvedic or Allopathic care to continue.', steps: [{ target: '#care-path-options', title: 'Choose your care path', message: 'Select Ayurvedic or Allopathic care. Veda will tailor the questions to your choice.' }] },
      'health-story': { message: 'I’ll guide you through each question. You can type your answers or use the microphone.', next: 'Complete the current question, then choose Continue.', steps: [{ target: '#intake-concern', title: 'Share your concern', message: 'Describe what is bothering you in your own words. This helps prepare your summary.' }, { target: '#intake-symptoms', title: 'Safety check', message: 'Choose the closest symptom. Urgent symptoms are highlighted so your care team can respond quickly.' }, { target: '#intake-records', title: 'Add records', message: 'Add any prescription, report, or scan you want your care team to see.' }] },
      upload: { message: 'Choose a document type, then add a file. Your records stay private and secure.', next: 'Select a category and upload your document.', steps: [] },
    }
  },
  hi: {
    ui: { guide: 'आपकी मेडीकियोस्क गाइड', thinking: 'सोच रही हूँ…', listen: 'सुनें', whatNext: 'आगे क्या?', showAround: 'मुझे दिखाएं', skip: 'ट्यूटोरियल छोड़ें', done: 'हो गया', next: 'अगला', greetingTitle: 'नमस्ते, मैं वेदा हूँ 👋', greetingSub: 'मैं मेडीकियोस्क का उपयोग करने में आपकी मदद कर सकती हूँ।', minimize: 'छोटा करें', needHelp: 'मदद चाहिए?', walkthrough: 'वेदा वॉकथ्रू' },
    pages: {
      overview: { message: 'यह आपका पेशेंट डैशबोर्ड है। आप जब भी तैयार हों, अपनी स्वास्थ्य कहानी शुरू कर सकते हैं।', next: 'अपनी परेशानी बताने के लिए स्वास्थ्य कहानी शुरू करें।', steps: [{ target: '#start-health-story', title: 'यहाँ से शुरू करें', message: 'आइए यहाँ से शुरू करें। अपनी स्वास्थ्य कहानी साझा करने के लिए इस बटन पर क्लिक करें।' }, { target: '#health-story-journey', title: 'आपकी प्रगति', message: 'यह आपकी स्वास्थ्य कहानी का हर कदम दिखाता है।' }, { target: '#upload-documents', title: 'रिकॉर्ड जोड़ें', message: 'आप यहाँ सुरक्षित रूप से पर्चे और रिपोर्ट जोड़ सकते हैं।' }] },
      'clinical-summary': { message: 'यहाँ आपको अपनी स्वास्थ्य जानकारी से तैयार किया गया सारांश मिलेगा।', next: 'अपना सारांश देखें या नई कहानी शुरू करें।', steps: [] },
      history: { message: 'आप यहाँ अपनी पिछली स्वास्थ्य जानकारी और रिपोर्ट देख सकते हैं।', next: 'रिपोर्ट देखने के लिए स्वास्थ्य कहानी खोलें।', steps: [] },
      documents: { message: 'आपके अपलोड किए गए दस्तावेज़ यहाँ दिखाई देते हैं।', next: 'नया दस्तावेज़ अपलोड करने के लिए "दस्तावेज़ जोड़ें" का उपयोग करें।', steps: [{ target: '#upload-documents', title: 'दस्तावेज़ जोड़ें', message: 'पर्चे, लैब रिपोर्ट या स्कैन सुरक्षित रूप से अपलोड करने के लिए इसे चुनें।' }] },
      'care-path': { message: 'आज आपके लिए सही लगने वाला देखभाल दृष्टिकोण चुनें।', next: 'जारी रखने के लिए आयुर्वेदिक या एलोपैथिक देखभाल चुनें।', steps: [{ target: '#care-path-options', title: 'अपना मार्ग चुनें', message: 'आयुर्वेदिक या एलोपैथिक चुनें। वेदा आपके चुनाव के अनुसार सवाल पूछेगी।' }] },
      'health-story': { message: 'मैं हर सवाल में आपका मार्गदर्शन करूँगी। आप टाइप कर सकते हैं या माइक का उपयोग कर सकते हैं।', next: 'वर्तमान प्रश्न पूरा करें, फिर "जारी रखें" चुनें।', steps: [{ target: '#intake-concern', title: 'अपनी परेशानी बताएं', message: 'अपने शब्दों में बताएं कि आपको क्या परेशानी है।' }, { target: '#intake-symptoms', title: 'सुरक्षा जांच', message: 'सबसे करीबी लक्षण चुनें।' }, { target: '#intake-records', title: 'रिकॉर्ड जोड़ें', message: 'कोई भी पर्चा या रिपोर्ट जोड़ें जो आप अपनी केयर टीम को दिखाना चाहते हैं।' }] },
      upload: { message: 'दस्तावेज़ का प्रकार चुनें, फिर फ़ाइल जोड़ें। आपके रिकॉर्ड निजी और सुरक्षित रहते हैं।', next: 'एक श्रेणी चुनें और अपना दस्तावेज़ अपलोड करें।', steps: [] },
    }
  },
  mr: {
    ui: { guide: 'तुमची मेडीकिओस्क मार्गदर्शक', thinking: 'विचार करत आहे…', listen: 'ऐका', whatNext: 'पुढे काय?', showAround: 'मला माहिती द्या', skip: 'ट्यूटोरियल वगळा', done: 'पूर्ण झाले', next: 'पुढील', greetingTitle: 'नमस्कार, मी वेदा आहे 👋', greetingSub: 'मी तुम्हाला मेडीकिओस्क वापरण्यात मदत करू शकते.', minimize: 'लहान करा', needHelp: 'मदत हवी आहे?', walkthrough: 'वेदा वॉकथ्रू' },
    pages: {
      overview: { message: 'हा तुमचा पेशंट डॅशबोर्ड आहे. तुम्ही तयार असाल तेव्हा तुमची आरोग्य कथा सुरू करू शकता.', next: 'तुमचा त्रास सांगण्यासाठी आरोग्य कथा सुरू करा.', steps: [{ target: '#start-health-story', title: 'येथून सुरू करा', message: 'चला येथून सुरू करूया. तुमची आरोग्य कथा सामायिक करण्यासाठी या बटणावर क्लिक करा.' }, { target: '#health-story-journey', title: 'तुमची प्रगती', message: 'हे तुमच्या आरोग्य कथेची प्रत्येक पायरी दाखवते.' }, { target: '#upload-documents', title: 'रेकॉर्ड जोडा', message: 'तुम्ही येथे सुरक्षितपणे प्रिस्क्रिप्शन आणि रिपोर्ट जोडू शकता.' }] },
      'clinical-summary': { message: 'येथे तुम्हाला तुमच्या आरोग्य माहितीवरून तयार केलेला सारांश मिळेल.', next: 'तुमचा सारांश तपासा किंवा नवीन कथा सुरू करा.', steps: [] },
      history: { message: 'तुम्ही तुमची मागील आरोग्य माहिती आणि अहवाल येथे पाहू शकता.', next: 'अहवाल पाहण्यासाठी आरोग्य कथा उघडा.', steps: [] },
      documents: { message: 'तुमची अपलोड केलेली कागदपत्रे येथे दिसतील.', next: 'नवीन कागदपत्र अपलोड करण्यासाठी "कागदपत्र जोडा" वापरा.', steps: [{ target: '#upload-documents', title: 'कागदपत्र जोडा', message: 'प्रिस्क्रिप्शन, लॅब रिपोर्ट किंवा स्कॅन सुरक्षितपणे अपलोड करण्यासाठी हे निवडा.' }] },
      'care-path': { message: 'आज तुम्हाला योग्य वाटेल तो काळजीचा मार्ग निवडा.', next: 'पुढे जाण्यासाठी आयुर्वेदिक किंवा ॲलोपॅथिक काळजी निवडा.', steps: [{ target: '#care-path-options', title: 'तुमचा मार्ग निवडा', message: 'आयुर्वेदिक किंवा ॲलोपॅथिक निवडा. वेदा तुमच्या निवडीनुसार प्रश्न विचारेल.' }] },
      'health-story': { message: 'मी तुम्हाला प्रत्येक प्रश्नात मार्गदर्शन करेन. तुम्ही टाईप करू शकता किंवा माईक वापरू शकता.', next: 'सध्याचा प्रश्न पूर्ण करा, नंतर "पुढे जा" निवडा.', steps: [{ target: '#intake-concern', title: 'तुमचा त्रास सांगा', message: 'तुम्हाला काय त्रास होत आहे ते तुमच्या शब्दात सांगा.' }, { target: '#intake-symptoms', title: 'सुरक्षा तपासणी', message: 'सर्वात जवळचे लक्षण निवडा.' }, { target: '#intake-records', title: 'रेकॉर्ड जोडा', message: 'तुम्ही तुमच्या केअर टीमला दाखवू इच्छित असलेले कोणतेही प्रिस्क्रिप्शन किंवा रिपोर्ट जोडा.' }] },
      upload: { message: 'कागदपत्राचा प्रकार निवडा, नंतर फाइल जोडा. तुमचे रेकॉर्ड खाजगी आणि सुरक्षित राहतील.', next: 'एक श्रेणी निवडा आणि तुमचे कागदपत्र अपलोड करा.', steps: [] },
    }
  }
};

function getPage(section: string, modal: string | null): PortalPage { 
  if (modal === 'carepath') return 'care-path'; 
  if (modal === 'intake') return 'health-story'; 
  if (modal === 'upload') return 'upload'; 
  if (section === 'Clinical summary') return 'clinical-summary'; 
  if (section === 'My history') return 'history'; 
  if (section === 'Documents') return 'documents'; 
  return 'overview'; 
}

function normalizeLanguage(lang: string): Language {
  if (!lang) return 'en';
  const lowerLang = lang.toLowerCase();
  if (lowerLang.startsWith('hi') || lowerLang.includes('hindi')) return 'hi';
  if (lowerLang.startsWith('mr') || lowerLang.includes('marathi')) return 'mr';
  return 'en';
}

function speakVeda(text: string, lang: Language) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel(); 

  let spoken = false;
  const speak = () => {
    if (spoken) return;
    spoken = true;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.90; 
    utterance.pitch = 1.05; 
    
    const localeMap = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
    const targetLang = localeMap[lang];
    utterance.lang = targetLang;
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes(targetLang) && (v.name.includes('Female') || v.name.toLowerCase().includes('google'))) 
                        || voices.find(v => v.lang.includes(targetLang))
                        || voices.find(v => v.lang.includes(lang)); 

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    speak();
  } else {
    window.speechSynthesis.addEventListener('voiceschanged', speak, { once: true });
    setTimeout(speak, 250);
  }
}

export function VedaAssistant({ 
  section, 
  modal, 
  language = 'en' 
}: { 
  section: string; 
  modal: string | null;
  language?: string; 
}) {
  const page = getPage(section, modal); 
  const activeLang = normalizeLanguage(language);
  
  const content = translations[activeLang];
  const ui = content.ui;
  const guidance = content.pages[page]; 
  
  const [expanded, setExpanded] = useState(true); 
  const [thinking, setThinking] = useState(false); 
  const [reply, setReply] = useState(''); 
  const [tutorialIndex, setTutorialIndex] = useState<number | null>(null); 
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null); 
  const timeoutRef = useRef<number | null>(null);
  
  // Drag State
  const [position, setPosition] = useState<{ left: number, top: number } | null>(null);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  const assistantRef = useRef<HTMLElement>(null);
  
  const tutorialStep = tutorialIndex === null ? null : guidance.steps[tutorialIndex]; 
  const visibleTutorialIndex = tutorialIndex ?? 0;

  // Handles smooth tracking for the spotlight tutorial
  const updatePosition = useCallback(() => {
    if (!tutorialStep) {
      setTargetRect(null);
      return;
    }
    const target = document.querySelector(tutorialStep.target); 
    if (target) {
      setTargetRect(target.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [tutorialStep]);

  useEffect(() => {
    if (tutorialStep) {
      const target = document.querySelector(tutorialStep.target);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(updatePosition, 300); 
      }
    }
    updatePosition();
  }, [tutorialStep, updatePosition]);
  
  useEffect(() => { 
    window.addEventListener('resize', updatePosition); 
    window.addEventListener('scroll', updatePosition, true); 
    return () => { 
      window.removeEventListener('resize', updatePosition); 
      window.removeEventListener('scroll', updatePosition, true); 
    }; 
  }, [updatePosition]);
  
  useEffect(() => { 
    setTutorialIndex(null); 
    setReply(''); 
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, [page, activeLang]); 
  
  // Drag-and-drop Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!assistantRef.current) return;
    const rect = assistantRef.current.getBoundingClientRect();
    
    dragRef.current = {
      isDragging: false,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    
    // Distinguish click from drag (threshold of 5px)
    if (!dragRef.current.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      dragRef.current.isDragging = true;
    }
    
    if (dragRef.current.isDragging && assistantRef.current) {
      // Calculate new position
      let newLeft = dragRef.current.startLeft + dx;
      let newTop = dragRef.current.startTop + dy;
      
      // Clamp to screen boundaries so it doesn't get lost
      const maxX = window.innerWidth - assistantRef.current.offsetWidth;
      const maxY = window.innerHeight - assistantRef.current.offsetHeight;
      
      newLeft = Math.max(0, Math.min(newLeft, maxX));
      newTop = Math.max(0, Math.min(newTop, maxY));
      
      setPosition({ left: newLeft, top: newTop });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleFabClick = () => {
    // If we just finished a drag, ignore the click event
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      return;
    }
    setExpanded(!expanded);
  };

  const answer = useMemo(() => reply || guidance.message, [guidance, reply]); 
  const closeTutorial = () => setTutorialIndex(null); 
  
  const nextTutorial = () => { 
    if (tutorialIndex === null) return; 
    if (tutorialIndex + 1 >= guidance.steps.length) { 
      closeTutorial(); 
      setExpanded(true); 
      return; 
    } 
    setTutorialIndex(tutorialIndex + 1); 
  }; 
  
  const askNext = () => { 
    setThinking(true); 
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => { 
      setReply(guidance.next); 
      setThinking(false); 
    }, 600); 
  };
  
  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }, []);

  const fontStyle = activeLang === 'hi' || activeLang === 'mr' ? { fontFamily: '"Noto Sans Devanagari", "Mukta", sans-serif' } : {};
  
  // Custom styling to override CSS position when dragged
  const draggedStyle: React.CSSProperties = position 
    ? { position: 'fixed', left: position.left, top: position.top, bottom: 'auto', right: 'auto', margin: 0 } 
    : {};

  return (
    <div style={fontStyle}>
      {tutorialStep && (
        <div className="veda-tutorial-layer" aria-live="polite">
          {targetRect && (
            <div className="veda-spotlight" style={{ left: targetRect.left - 6, top: targetRect.top - 6, width: targetRect.width + 12, height: targetRect.height + 12 }} />
          )}
          
          <section 
            className="veda-tutorial-card" 
            role="dialog" 
            aria-label="Veda tutorial"
            style={!targetRect ? { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', margin: 0 } : {}}
          >
            <button className="veda-close" onClick={closeTutorial} aria-label="Close tutorial"><X size={16} /></button>
            <span className="veda-kicker">{ui.walkthrough} · {visibleTutorialIndex + 1}/{guidance.steps.length}</span>
            <strong>{tutorialStep.title}</strong>
            <p>{tutorialStep.message}</p>
            <div className="veda-tutorial-actions">
              <button className="veda-text-button" onClick={closeTutorial}>{ui.skip}</button>
              <span />
              <button className="veda-icon-button" disabled={visibleTutorialIndex === 0} onClick={() => setTutorialIndex(visibleTutorialIndex - 1)} aria-label="Previous step"><ChevronLeft size={16} /></button>
              <button className="veda-next-button" onClick={nextTutorial}>{visibleTutorialIndex + 1 === guidance.steps.length ? ui.done : ui.next} <ChevronRight size={15} /></button>
            </div>
          </section>
        </div>
      )}
      
      <aside 
        ref={assistantRef}
        className="veda-assistant" 
        aria-label="Veda, your MediKiosk assistant"
        style={draggedStyle} // Applies the new dragged position
      >
        {expanded && (
          <section className="veda-panel" aria-live="polite">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button className="veda-close" onClick={() => setExpanded(false)} aria-label="Close Veda" style={{ position: 'static' }}><X size={16} /></button>
            </div>

            <div className="veda-panel-heading" style={{ marginTop: '-20px' }}>
              <VedaAvatar />
              <div><strong>Veda</strong><span>{ui.guide}</span></div>
            </div>
            <p>{thinking ? <><i className="veda-thinking-dot" /> {ui.thinking}</> : answer}</p>
            <div className="veda-actions">
              <button onClick={() => speakVeda(answer, activeLang)}><Volume2 size={14} /> {ui.listen}</button>
              <button onClick={askNext}><MessageCircle size={14} /> {ui.whatNext}</button>
            </div>
            <button className="veda-tour-button" onClick={() => guidance.steps.length ? setTutorialIndex(0) : askNext()}><Sparkles size={14} /> {ui.showAround}</button>
          </section>
        )}
        
        {!expanded && (
          <button className="veda-greeting" onClick={() => setExpanded(true)}>
            {ui.greetingTitle}<span>{ui.greetingSub}</span>
          </button>
        )}
        
        <button 
          className="veda-fab" 
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleFabClick}
          aria-label={expanded ? ui.minimize : ui.needHelp} 
          aria-expanded={expanded}
          style={{ cursor: 'grab', touchAction: 'none' }} // Ensure nice grabbing cursor and prevent mobile scroll issues
        >
          <VedaAvatar /><span>{expanded ? ui.minimize : ui.needHelp}</span>
        </button>
      </aside>
    </div>
  );
}

export function VedaAvatar() { 
  return (
    <span className="veda-avatar" aria-hidden="true">
      <span className="veda-hair" />
      <span className="veda-face"><i /><i /><b /></span>
      <Leaf size={12} />
    </span>
  ); 
}