import { useCallback, useEffect, useState } from 'react';
import {
  Activity, Accessibility, AlertTriangle, ArrowRight, BadgeCheck, Bell, Check, ChevronDown,
  ChevronRight, CircleHelp, ClipboardList, FileCheck2, FileSignature, FileText, HeartPulse,
  History, Languages, LockKeyhole, MessageCircle, Mic, Paperclip, Play, Plus, ScanLine,
  ShieldCheck, Sparkles, Stethoscope, UserRound, Volume2, X,
} from 'lucide-react';
import { isSupabaseConfigured, supabase, type Patient, type MedicalDocument, type ActivityLog, type ConsentRecord, type HealthStory, type HealthReport } from '@/lib/supabase';
import { translate, langNames, type Lang } from '@/lib/i18n';
import { useSpeech } from '@/lib/useSpeech';

type Section = 'Overview' | 'Clinical summary' | 'My history' | 'Documents';
type ModalKind = 'intake' | 'upload' | 'profile' | 'consent' | 'report' | 'howitworks' | 'docview' | null;

const navKeys = ['nav.overview', 'nav.clinicalSummary', 'nav.myHistory', 'nav.documents'] as const;
const navIcons = [Activity, FileSignature, History, FileText];
const navSections: Section[] = ['Overview', 'Clinical summary', 'My history', 'Documents'];

const stepKeys = [
  { t: 'journey.step1', d: 'journey.step1d' },
  { t: 'journey.step2', d: 'journey.step2d' },
  { t: 'journey.step3', d: 'journey.step3d' },
  { t: 'journey.step4', d: 'journey.step4d' },
];

const consentTypes = [
  { key: 'data_processing', labelKey: 'consent.dataProcessing', descKey: 'consent.dataProcessingDesc' },
  { key: 'document_upload', labelKey: 'consent.documentUpload', descKey: 'consent.documentUploadDesc' },
  { key: 'abha_linkage', labelKey: 'consent.abhaLinkage', descKey: 'consent.abhaLinkageDesc' },
  { key: 'history_sharing', labelKey: 'consent.historySharing', descKey: 'consent.historySharingDesc' },
];

const docCategories = [
  { key: 'prescription', labelKey: 'upload.prescription' },
  { key: 'lab_report', labelKey: 'upload.labReport' },
  { key: 'scan', labelKey: 'upload.scan' },
  { key: 'discharge_summary', labelKey: 'upload.discharge' },
  { key: 'other', labelKey: 'upload.other' },
];

const severityOptions: Array<{ key: string; labelKey: string }> = [
  { key: 'mild', labelKey: 'intake.mild' },
  { key: 'moderate', labelKey: 'intake.moderate' },
  { key: 'severe', labelKey: 'intake.severe' },
];

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'welcome.greetingMorning';
  if (h < 17) return 'welcome.greetingAfternoon';
  return 'welcome.greetingEvening';
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('medikiosk-lang') as Lang) || 'en');
  const [activeSection, setActiveSection] = useState<Section>('Overview');
  const [modal, setModal] = useState<ModalKind>(null);
  const [isLangOpen, setLangOpen] = useState(false);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [healthStories, setHealthStories] = useState<HealthStory[]>([]);
  const [latestStory, setLatestStory] = useState<HealthStory | null>(null);
  const [activeReport, setActiveReport] = useState<HealthReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [activeDoc, setActiveDoc] = useState<MedicalDocument | null>(null);

  const [intakeStep, setIntakeStep] = useState(1);
  const [chiefConcern, setChiefConcern] = useState('');
  const [symptomDuration, setSymptomDuration] = useState('');
  const [severity, setSeverity] = useState('');
  const [currentMeds, setCurrentMeds] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [ayushMode, setAyushMode] = useState(false);
  const [priorSurgery, setPriorSurgery] = useState(false);
  const [hasRedFlag, setHasRedFlag] = useState(false);
  const [intakeConsent, setIntakeConsent] = useState(false);
  const [intakeError, setIntakeError] = useState('');
  const [symptomSelected, setSymptomSelected] = useState(false);
  const [selectedSymptom, setSelectedSymptom] = useState<string>('');
  const [otherSymptomText, setOtherSymptomText] = useState('');

  const [uploadCategory, setUploadCategory] = useState('prescription');
  const [uploadConsent, setUploadConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const [profileForm, setProfileForm] = useState<Partial<Patient>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const [consentForm, setConsentForm] = useState<Record<string, boolean>>({});
  const [savingConsent, setSavingConsent] = useState(false);
  const [consentMsg, setConsentMsg] = useState('');

  const speech = useSpeech(lang);
  const t = useCallback((key: string, params?: Record<string, string>) => translate(lang, key, params), [lang]);

  const persistLang = (l: Lang) => { setLang(l); localStorage.setItem('medikiosk-lang', l); };

  // Sync speech transcript into chiefConcern when listening
  useEffect(() => {
    if (speech.isListening && speech.transcript) {
      setChiefConcern(speech.transcript);
    }
  }, [speech.transcript, speech.isListening]);

  // Load patient
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const { data } = await supabase.from('patients').select('*').limit(1).maybeSingle();
      if (data) { setPatient(data as Patient); setProfileForm(data as Patient); }
    })();
  }, []);

  const patientId = patient?.id;

  const logActivity = useCallback(async (type: string, title: string, description: string, status: string) => {
    if (!patientId) return;
    await supabase.from('activity_log').insert({
      patient_id: patientId, activity_type: type, title, description, status,
    });
    const { data } = await supabase.from('activity_log').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(10);
    if (data) setActivities(data as ActivityLog[]);
  }, [patientId]);

  // Load activities
  useEffect(() => {
    (async () => {
      if (!patientId) return;
      const { data } = await supabase.from('activity_log').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(10);
      if (data) setActivities(data as ActivityLog[]);
    })();
  }, [patientId]);

  // Load documents
  const loadDocuments = useCallback(async () => {
    if (!patientId) return;
    const { data } = await supabase.from('documents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (data) setDocuments(data as MedicalDocument[]);
  }, [patientId]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // Load consents
  const loadConsents = useCallback(async () => {
    if (!patientId) return;
    const { data } = await supabase.from('consent_records').select('*').eq('patient_id', patientId);
    if (data) {
      setConsents(data as ConsentRecord[]);
      const map: Record<string, boolean> = {};
      (data as ConsentRecord[]).forEach((c) => { map[c.consent_type] = c.granted; });
      setConsentForm(map);
    }
  }, [patientId]);

  useEffect(() => { loadConsents(); }, [loadConsents]);

  // Load health stories
  const loadStories = useCallback(async () => {
    if (!patientId) return;
    const { data } = await supabase.from('health_stories').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (data) {
      setHealthStories(data as HealthStory[]);
      setLatestStory((data as HealthStory[])[0] || null);
    }
  }, [patientId]);

  useEffect(() => { loadStories(); }, [loadStories]);

  // Save profile
  const saveProfile = async () => {
    if (!patientId) return;
    setSavingProfile(true); setProfileMsg('');
    const { error } = await supabase.from('patients').update({
      name: profileForm.name, age: profileForm.age, gender: profileForm.gender,
      phone: profileForm.phone, email: profileForm.email, address: profileForm.address,
      blood_group: profileForm.blood_group, updated_at: new Date().toISOString(),
    }).eq('id', patientId);
    setSavingProfile(false);
    if (error) { setProfileMsg(t('common.error')); return; }
    setProfileMsg(t('profile.saved'));
    const { data } = await supabase.from('patients').select('*').eq('id', patientId).maybeSingle();
    if (data) { setPatient(data as Patient); setProfileForm(data as Patient); }
    logActivity('profile_updated', t('profile.saved'), '', 'complete');
  };

  // Save consent
  const saveConsent = async () => {
    if (!patientId) return;
    setSavingConsent(true); setConsentMsg('');
    for (const ct of consentTypes) {
      const granted = consentForm[ct.key] ?? false;
      const existing = consents.find((c) => c.consent_type === ct.key);
      if (existing) {
        await supabase.from('consent_records').update({
          granted, granted_at: granted ? new Date().toISOString() : null,
          revoked_at: !granted ? new Date().toISOString() : null,
        }).eq('id', existing.id);
      } else {
        await supabase.from('consent_records').insert({
          patient_id: patientId, consent_type: ct.key, granted,
          granted_at: granted ? new Date().toISOString() : null,
        });
      }
    }
    setSavingConsent(false);
    setConsentMsg(t('consent.saved'));
    loadConsents();
    logActivity('consent_given', t('consent.saved'), '', 'complete');
  };

  // Upload document
  const doUpload = async () => {
    if (!patientId) return;
    setUploading(true); setUploadMsg('');
    const filename = `Medical_doc_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.${uploadCategory === 'scan' ? 'jpg' : 'pdf'}`;
    const { data, error } = await supabase.from('documents').insert({
      patient_id: patientId, filename, file_type: uploadCategory === 'scan' ? 'jpg' : 'pdf',
      file_size: 240000, category: uploadCategory, ocr_status: 'processed',
      ocr_extracted_text: 'Document processed via OCR. Values ready for physician review.',
    }).select().single();
    setUploading(false);
    if (error || !data) { setUploadMsg(t('upload.error')); return; }
    setUploadMsg(t('upload.success'));
    loadDocuments();
    logActivity('document_uploaded', filename, t('docs.ready'), 'complete');
    setTimeout(() => { setModal(null); setUploadMsg(''); }, 1200);
  };

  // Delete document
  const deleteDocument = async (id: string) => {
    await supabase.from('documents').delete().eq('id', id);
    loadDocuments();
  };

  // Validate intake step
  const validateIntakeStep = (): boolean => {
    setIntakeError('');
    if (intakeStep === 1) {
      if (!chiefConcern.trim()) {
        setIntakeError(t('intake.fillPrompt'));
        return false;
      }
    }
    if (intakeStep === 1) {
      if (!symptomDuration.trim()) {
        setIntakeError(t('intake.fillPrompt'));
        return false;
      }
      if (!severity) {
        setIntakeError(t('intake.fillPrompt'));
        return false;
      }
      if (!emergencyContact.trim()) {
        setIntakeError(t('intake.fillPrompt'));
        return false;
      }
    }
    if (intakeStep === 2) {
      if (!symptomSelected) {
        setIntakeError(t('intake.selectSymptom'));
        return false;
      }
    }
    return true;
  };

  const symptomLabel = selectedSymptom === 'chestPain' ? t('intake.chestPain') : selectedSymptom === 'breathing' ? t('intake.breathing') : selectedSymptom === 'weakness' ? t('intake.weakness') : selectedSymptom === 'other' ? (otherSymptomText || t('intake.otherSymptom')) : '';

  // Finish intake - save health story and generate report
  const finishIntake = async () => {
    if (!patientId) return;
    const { data: storyData } = await supabase.from('health_stories').insert({
      patient_id: patientId, chief_concern: chiefConcern,
      history_of_present_illness: `Symptom duration: ${symptomDuration}. Severity: ${severity}. Current medications: ${currentMeds || 'None reported'}.`,
      past_history: priorSurgery ? 'Previous admission or surgery reported' : 'No previous admission reported',
      drug_allergy: 'Not yet captured',
      personal_history: ayushMode ? 'AYUSH lifestyle context included' : 'Lifestyle context pending',
      ayush_mode: ayushMode, prior_surgery: priorSurgery, has_red_flag: hasRedFlag,
      red_flag_note: hasRedFlag ? symptomLabel : '',
      status: hasRedFlag ? 'flagged' : 'complete', language: langNames[lang],
    }).select().single();

    if (storyData) {
      const reportTitle = `${t('report.reportTitle')} - ${new Date(storyData.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'hi' ? 'hi-IN' : 'mr-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      const { error: reportError } = await supabase.from('health_reports').insert({
        patient_id: patientId,
        health_story_id: (storyData as HealthStory).id,
        report_title: reportTitle,
        chief_concern: chiefConcern,
        hpi: `Symptom duration: ${symptomDuration}. Severity: ${severity}. Current medications: ${currentMeds || 'None reported'}.`,
        past_history: priorSurgery ? 'Previous admission or surgery reported' : 'No previous admission reported',
        drug_allergy: 'Not yet captured',
        personal_history: ayushMode ? 'AYUSH lifestyle context included' : 'Lifestyle context pending',
        ayush_mode: ayushMode, prior_surgery: priorSurgery, has_red_flag: hasRedFlag,
        red_flag_note: hasRedFlag ? symptomLabel : '',
        physician_notes: '',
        diagnosis: '',
        prescription: '',
        advice: '',
        follow_up: '',
        status: 'generated',
        language: langNames[lang],
      });
      if (reportError) console.error('Failed to generate report:', reportError.message);
    }

    setModal(null);
    speech.stopListening();
    speech.stopSpeaking();
    if (storyData) {
      const rTitle = `${t('report.reportTitle')} - ${new Date((storyData as HealthStory).created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'hi' ? 'hi-IN' : 'mr-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      loadStories();
      logActivity('health_story_started', t('intake.readyForReview'), '', hasRedFlag ? 'flagged' : 'complete');
      logActivity('report_generated', rTitle, '', 'complete');
      setActiveSection('Clinical summary');
    }
  };

  const openIntake = () => {
    setIntakeStep(1);
    setChiefConcern('');
    setSymptomDuration('');
    setSeverity('');
    setCurrentMeds('');
    setEmergencyContact('');
    setAyushMode(false);
    setPriorSurgery(false);
    setHasRedFlag(false);
    setIntakeConsent(false);
    setIntakeError('');
    setSymptomSelected(false);
    setSelectedSymptom('');
    setOtherSymptomText('');
    setModal('intake');
    setTimeout(() => speech.speak(t('intake.titleStart')), 300);
  };

  const handleIntakeStep = (dir: 'next' | 'back') => {
    if (dir === 'next') {
      if (!validateIntakeStep()) return;
      if (intakeStep < 4) {
        setIntakeStep(intakeStep + 1);
        setIntakeError('');
        if (intakeStep === 1) speech.speak(t('intake.symptomQ'));
        if (intakeStep === 2) speech.speak(t('intake.addRecords'));
      } else { finishIntake(); }
    } else {
      setIntakeStep(Math.max(1, intakeStep - 1));
      setIntakeError('');
    }
  };

  // Open report for a health story
  const openReport = async (storyId: string) => {
    setLoadingReport(true);
    setModal('report');
    const { data } = await supabase.from('health_reports').select('*').eq('health_story_id', storyId).maybeSingle();
    if (data) {
      setActiveReport(data as HealthReport);
    } else {
      const { data: fallback } = await supabase.from('health_reports').select('*').eq('patient_id', patientId || '').order('created_at', { ascending: false }).limit(1).maybeSingle();
      setActiveReport(fallback ? (fallback as HealthReport) : null);
    }
    setLoadingReport(false);
  };

  const greeting = `${t(greetingKey())}, ${patient?.name?.split(' ')[0] || 'Aarav'}`;
  const completedSteps = latestStory ? 4 : 0;

  const navItems = navKeys.map((key, i) => ({ label: navSections[i], icon: navIcons[i], key }));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Stethoscope size={21} strokeWidth={2.4} /></div>
          <div><strong>Medi<span>Kiosk</span></strong><small>AI clinical companion</small></div>
        </div>
        <div className="patient-card">
          <div className="patient-avatar">{patient?.avatar_initials || 'AS'}</div>
          <div><strong>{patient?.name || 'Aarav Sharma'}</strong><span>{t('nav.profileSettings').includes('Profile') ? 'Patient ID' : 'रोगी आईडी'} · {patient?.patient_code || 'MK-28491'}</span></div>
          <ChevronDown size={16} className="muted-icon" />
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          <p className="nav-label">{t('nav.yourSpace')}</p>
          {navItems.map(({ label, icon: Icon, key }) => (
            <button className={activeSection === label ? 'nav-item active' : 'nav-item'} key={label} onClick={() => setActiveSection(label)}>
              <Icon size={18} /> <span>{t(key)}</span>{label === 'Documents' && documents.length > 0 && <i className="nav-dot" />}
            </button>
          ))}
          <p className="nav-label nav-label-spaced">{t('nav.support')}</p>
          <button className="nav-item" onClick={() => setModal('howitworks')}><CircleHelp size={18} /><span>{t('nav.howItWorks')}</span></button>
          <button className="nav-item" onClick={() => setModal('consent')}><ShieldCheck size={18} /><span>{t('nav.privacyConsent')}</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note"><LockKeyhole size={16} /><span>{t('nav.secureNote')}</span></div>
          <button className="profile-button" onClick={() => setModal('profile')}><UserRound size={18} /><span>{t('nav.profileSettings')}</span><ArrowRight size={15} /></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark"><Stethoscope size={18} /></div><strong>Medi<span>Kiosk</span></strong></div>
          <div className="breadcrumb"><span>{t('top.patientPortal')}</span><span>/</span><strong>{t(navKeys[navSections.indexOf(activeSection)])}</strong></div>
          <div className="top-actions">
            <div className="language-wrap">
              <button className="language-button" onClick={() => setLangOpen(!isLangOpen)}><Languages size={17} /><span>{langNames[lang]}</span><ChevronDown size={14} /></button>
              {isLangOpen && <div className="language-menu">{(Object.keys(langNames) as Lang[]).map((item) => <button key={item} onClick={() => { persistLang(item); setLangOpen(false); }}>{langNames[item]}{lang === item && <Check size={14} />}</button>)}</div>}
            </div>
            <button className="icon-button" aria-label={t('top.notifications')}><Bell size={19} /><i /></button>
            <div className="top-avatar">{patient?.avatar_initials || 'AS'}</div>
          </div>
        </header>

        <div className="page-wrap">
          <section className="welcome-row">
            <div><p className="eyebrow">{t('welcome.dashboard')} <span>•</span> {new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'hi' ? 'hi-IN' : 'mr-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</p><h1>{greeting}</h1><p className="welcome-copy">{t('welcome.copy')}</p></div>
            <div className="availability"><span className="pulse-dot" /> {t('welcome.ready')} <span className="divider" /> <Volume2 size={15} /> {t('welcome.audioGuided')}</div>
          </section>

          {activeSection === 'Overview' && <>
            <section className="hero-card">
              <div className="hero-copy">
                <div className="sparkle"><Sparkles size={16} /></div>
                <p className="eyebrow light">{t('hero.eyebrow')}</p>
                <h2>{t('hero.title1')}<br /><em>{t('hero.title2')}</em></h2>
                <p>{t('hero.body')}</p>
                <button className="primary-button" onClick={openIntake}>
                  {speech.isListening ? <><span className="listening-bars"><i /><i /><i /></span> {t('hero.listening')}</> : <><Mic size={18} /> {t('hero.start')} <ArrowRight size={17} /></>}
                </button>
                <div className="hero-trust"><LockKeyhole size={14} /> {t('hero.private')} <span /> <span className="clock-icon">◷</span> {t('hero.takes')}</div>
                <div className="impact-inline"><div><strong>{t('hero.60sec')}</strong><span>{t('hero.structured')}</span></div><i /><div><strong>{t('hero.3lang')}</strong><span>{t('hero.voiceFirst')}</span></div><i /><div><strong>{t('hero.abhaReady')}</strong><span>{t('hero.consentLed')}</span></div></div>
              </div>
              <div className="hero-art"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-card card-back"><FileText size={19} /><span>{t('hero.clinicalSummary')}</span><b>{t('hero.readyForReview')}</b></div><div className="art-card card-front"><div className="wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><span>{t('hero.listeningToYou')}</span><small>{t('hero.speakNaturally')}</small></div><div className="art-orb"><Mic size={27} /></div></div>
            </section>

            <section className="feature-strip">
              <button className="feature-item" onClick={openIntake}><div className="feature-item-icon"><Accessibility size={18} /></div><div><strong>{t('feature.everyPatient')}</strong><span>{t('feature.everyPatientDesc')}</span></div><ChevronRight size={15} /></button>
              <button className="feature-item" onClick={openIntake}><div className="feature-item-icon ayush"><HeartPulse size={18} /></div><div><strong>{t('feature.ayush')}</strong><span>{t('feature.ayushDesc')}</span></div><ChevronRight size={15} /></button>
              <button className="feature-item alert-feature" onClick={openIntake}><div className="feature-item-icon alert"><AlertTriangle size={18} /></div><div><strong>{t('feature.redFlag')}</strong><span>{t('feature.redFlagDesc')}</span></div><ChevronRight size={15} /></button>
            </section>

            <section className="content-grid">
              <div className="journey-card panel">
                <div className="panel-heading"><div><p className="eyebrow">{t('journey.eyebrow')}</p><h3>{t('journey.title')}</h3></div><span className="progress-label">{completedSteps} / 4 {t('activity.complete').toLowerCase()}</span></div>
                <div className="progress-track"><span style={{ width: `${(completedSteps / 4) * 100}%` }} /></div>
                <div className="steps">{stepKeys.map((step, index) => <button className={index < completedSteps ? 'step done' : index === completedSteps ? 'step current' : 'step'} key={index} onClick={() => index === 0 ? openIntake() : index === 2 ? setModal('upload') : undefined}><span className="step-number">{index < completedSteps ? <Check size={12} /> : index === completedSteps ? <Play size={12} fill="currentColor" /> : String(index + 1).padStart(2, '0')}</span><span><strong>{t(step.t)}</strong><small>{t(step.d)}</small></span>{index === completedSteps ? <ArrowRight size={17} className="step-arrow" /> : index < completedSteps ? <Check size={16} className="step-check" /> : <LockKeyhole size={15} className="muted-icon" />}</button>)}</div>
              </div>
              <div className="side-column">
                <div className="quick-card panel"><div className="quick-icon"><ClipboardList size={19} /></div><div><p className="eyebrow">{t('quick.eyebrow')}</p><h3>{t('quick.upload')}</h3><p>{t('quick.uploadDesc')}</p><button className="text-button" onClick={() => setModal('upload')}>{t('quick.addDoc')} <Plus size={15} /></button></div></div>
                <div className="privacy-card"><ShieldCheck size={20} /><div><strong>{t('privacy.title')}</strong><p>{t('privacy.body')}</p><button className="privacy-link" onClick={() => setModal('consent')}>{t('privacy.learn')} <ArrowRight size={14} /></button></div></div>
              </div>
            </section>

            <section className="activity-section">
              <div className="section-heading"><div><p className="eyebrow">{t('activity.eyebrow')}</p><h3>{t('activity.title')}</h3></div></div>
              {activities.length === 0 ? <div className="record-list"><div className="record-item" style={{ justifyContent: 'center', color: '#94a7a2', fontSize: 11 }}>{t('activity.empty')}</div></div> : <div className="record-list">{activities.map((a) => <div className="record-item" key={a.id}><div className={`record-icon ${a.activity_type === 'document_uploaded' ? 'green' : a.activity_type === 'consultation_completed' ? 'blue' : 'green'}`}>{a.activity_type === 'document_uploaded' ? <FileCheck2 size={18} /> : a.activity_type === 'consultation_completed' ? <FileText size={18} /> : <Activity size={18} />}</div><div><strong>{a.title}</strong><span>{new Date(a.created_at).toLocaleString(lang === 'en' ? 'en-GB' : lang === 'hi' ? 'hi-IN' : 'mr-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {a.description || a.status}</span></div><span className={`status-pill ${a.status === 'complete' ? 'complete' : ''}`}>{a.status === 'in_progress' ? t('activity.inProgress') : a.status === 'flagged' ? t('activity.inProgress') : t('activity.available')}</span><ArrowRight size={16} className="muted-icon" /></div>)}</div>}
            </section>
          </>}

          {activeSection === 'Clinical summary' && latestStory && (
            <section className="summary-view">
              <div className="summary-view-header"><div><p className="eyebrow">{t('summary.eyebrow')} <span>•</span> {t('summary.draft')}</p><h2>{t('summary.title')}</h2><p>{t('summary.body')}</p></div><div className="summary-actions"><button className="back-button" onClick={openIntake}>{t('summary.edit')}</button><button className="primary-button small" onClick={() => setActiveSection('Overview')}><BadgeCheck size={15} /> {t('summary.markReady')}</button></div></div>
              <div className="review-banner"><div className="review-avatar">{patient?.avatar_initials || 'AS'}</div><div><strong>{patient?.name || 'Aarav Sharma'} <span>· {patient?.age || 34} years · {patient?.gender || 'Male'}</span></strong><p>{t('summary.presentingComplaint')} <i /> {new Date(latestStory.created_at).toLocaleDateString()}</p></div><div className="review-status"><span className="pulse-dot" /> {latestStory.has_red_flag ? t('summary.priorityAlert') : t('summary.priorityNormal')}</div></div>
              {latestStory.has_red_flag && <div className="review-alert"><AlertTriangle size={19} /><div><strong>{t('summary.priorityAlert')}</strong><span>{t('summary.alertBody')}</span></div><ChevronRight size={16} /></div>}
              <div className="summary-columns">
                <div className="summary-panel panel"><div className="summary-panel-head"><div><p className="eyebrow">{t('summary.standardFormat')}</p><h3>{t('summary.presentingComplaint')}</h3></div></div><div className="complaint-block"><div className="complaint-icon"><MessageCircle size={20} /></div><div><strong>{latestStory.chief_concern || t('intake.placeholder')}</strong><span>{t('summary.capturedVia')} · {new Date(latestStory.created_at).toLocaleString()}</span></div></div><div className="clinical-rows"><div><span>{t('summary.hpi')}</span><strong>{latestStory.history_of_present_illness}</strong></div><div><span>{t('summary.pastMed')}</span><strong>{latestStory.past_history}</strong></div><div><span>{t('summary.drugAllergy')}</span><strong>{latestStory.drug_allergy}</strong></div><div><span>{t('summary.personalHistory')}</span><strong>{latestStory.personal_history}</strong></div></div></div>
                <div className="summary-panel panel"><div className="summary-panel-head"><div><p className="eyebrow">{t('summary.digitizedRecords')}</p><h3>{t('summary.docsFindings')}</h3></div><button className="text-button" onClick={() => setActiveSection('Documents')}>{t('activity.viewAll')} <ArrowRight size={14} /></button></div>{documents.length > 0 ? documents.slice(0, 3).map((d) => <div className="finding-card" key={d.id}><div className="record-icon green"><FileCheck2 size={17} /></div><div><strong>{d.filename}</strong><span>{t('summary.ocrProcessed')}</span></div><BadgeCheck size={17} className="finding-check" /></div>) : <div className="finding-empty"><ScanLine size={22} /><span>{t('summary.noDocs')}</span><button className="text-button" onClick={() => setModal('upload')}>{t('summary.addOne')} <Plus size={14} /></button></div>}<div className="abha-linked"><ShieldCheck size={16} /><span>{t('summary.abhaPending')}</span><span className="pending-pill">{t('summary.pending')}</span></div></div>
              </div>
              <div className="summary-footer"><span><LockKeyhole size={14} /> {t('summary.draftPrivate')}</span><button className="primary-button" onClick={() => openReport(latestStory.id)}><FileText size={16} /> {t('report.viewReport')} <ArrowRight size={16} /></button></div>
            </section>
          )}
          {activeSection === 'Clinical summary' && !latestStory && (
            <section className="empty-section panel"><div className="empty-icon"><FileSignature size={28} /></div><p className="eyebrow">{t('summary.eyebrow')}</p><h2>{t('summary.title')}</h2><p>{t('summary.body')}</p><button className="primary-button" onClick={openIntake}>{t('hero.start')} <ArrowRight size={17} /></button></section>
          )}

          {activeSection === 'My history' && (
            <section className="history-view">
              <div className="section-heading"><div><p className="eyebrow">{t('history.eyebrow')}</p><h2>{t('history.title')}</h2><p className="section-copy">{t('history.body')}</p></div></div>
              {healthStories.length === 0 ? <div className="empty-doc panel"><History size={26} /><strong>{t('history.empty')}</strong><button className="text-button" onClick={openIntake}>{t('history.start')} <ArrowRight size={14} /></button></div> : <div className="history-list">{healthStories.map((s) => <div className="record-item history-item" key={s.id} onClick={() => openReport(s.id)}><div className="record-icon green"><FileSignature size={18} /></div><div><strong>{t('history.storyTitle')} · {s.status === 'flagged' ? t('summary.priorityAlert') : t('activity.available')}</strong><span>{t('history.completedOn')} {new Date(s.created_at).toLocaleDateString()}</span></div><span className={`status-pill ${s.status === 'complete' ? 'complete' : ''}`}>{s.status === 'flagged' ? t('activity.inProgress') : t('activity.available')}</span><button className="text-button" onClick={(e) => { e.stopPropagation(); openReport(s.id); }}>{t('report.viewReport')} <ArrowRight size={14} /></button></div>)}</div>}
            </section>
          )}

          {activeSection === 'Documents' && (
            <section className="documents-view">
              <div className="section-heading"><div><p className="eyebrow">{t('docs.eyebrow')}</p><h2>{t('docs.title')}</h2><p className="section-copy">{t('docs.body')}</p></div><button className="primary-button small" onClick={() => setModal('upload')}><Plus size={16} /> {t('docs.add')}</button></div>
              <div className="document-grid">{documents.length === 0 ? <div className="empty-doc panel"><ScanLine size={26} /><strong>{t('docs.empty')}</strong><span>{t('docs.emptyBody')}</span><button className="text-button" onClick={() => setModal('upload')}>{t('docs.uploadFirst')} <ArrowRight size={14} /></button></div> : documents.map((d) => <div className="document-tile" key={d.id}><div className="record-icon green"><FileCheck2 size={18} /></div><div className="doc-info"><strong>{d.filename}</strong><span>{t('docs.uploaded')} {new Date(d.created_at).toLocaleDateString()} · {t('docs.ready')}</span></div><button className="text-button" onClick={() => { setActiveDoc(d); setModal('docview'); }}>{t('docs.view')} <ArrowRight size={14} /></button><button className="text-button delete-btn" onClick={() => deleteDocument(d.id)}><X size={14} /> {t('docs.delete')}</button></div>)}</div>
            </section>
          )}
        </div>
      </main>

      {/* Intake Modal */}
      {modal === 'intake' && (
        <div className="modal-backdrop">
          <div className="intake-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setModal(null); speech.stopListening(); speech.stopSpeaking(); }}><X size={18} /></button>
            <div className="intake-top"><div><p className="eyebrow">{t('intake.eyebrow')}</p><h2>{intakeStep === 4 ? t('intake.titleReady') : t('intake.titleStart')}</h2></div><span className="intake-count">{intakeStep} / 4</span></div>
            <div className="intake-progress"><span style={{ width: `${intakeStep * 25}%` }} /></div>
            <div className="intake-steps">{['intake.aboutYou', 'intake.yourSymptoms', 'intake.yourRecords', 'intake.review'].map((key, index) => <span className={index + 1 <= intakeStep ? 'active' : ''} key={key}><i>{index + 1 < intakeStep ? <Check size={11} /> : index + 1}</i>{t(key)}</span>)}</div>

            {intakeStep === 1 && <div className="intake-body">
              <div className="audio-prompt"><div className="audio-icon"><Volume2 size={20} /></div><div><strong>{t('intake.voiceOrTouch')}</strong><p>{t('intake.voiceDesc', { lang: langNames[lang] })}</p></div><button className="round-audio" onClick={() => speech.isListening ? speech.stopListening() : speech.startListening()}>{speech.isListening ? <span className="mini-bars"><i /><i /><i /></span> : <Mic size={16} />}</button></div>
              <label className="input-label">{t('intake.whatBrings')} <span className="required-asterisk">*</span></label>
              <textarea className={`story-input ${intakeError && !chiefConcern.trim() ? 'field-error' : ''}`} placeholder={t('intake.placeholder')} value={chiefConcern} onChange={(e) => { setChiefConcern(e.target.value); speech.setTranscript(e.target.value); }} />
              {intakeError && !chiefConcern.trim() && <div className="error-msg">{t('intake.required')}</div>}

              <label className="input-label" style={{ marginTop: '14px' }}>{t('intake.symptomDuration')} <span className="required-asterisk">*</span></label>
              <input className={`story-input ${intakeError && !symptomDuration.trim() ? 'field-error' : ''}`} style={{ height: 'auto', padding: '10px 12px' }} placeholder={t('intake.symptomDurationPlaceholder')} value={symptomDuration} onChange={(e) => setSymptomDuration(e.target.value)} />
              {intakeError && !symptomDuration.trim() && <div className="error-msg">{t('intake.required')}</div>}

              <label className="input-label" style={{ marginTop: '14px' }}>{t('intake.severity')} <span className="required-asterisk">*</span></label>
              <div className="severity-row">{severityOptions.map((opt) => <button key={opt.key} className={severity === opt.key ? 'severity-pill selected' : 'severity-pill'} onClick={() => setSeverity(opt.key)}>{t(opt.labelKey)}</button>)}</div>
              {intakeError && !severity && <div className="error-msg">{t('intake.required')}</div>}

              <label className="input-label" style={{ marginTop: '14px' }}>{t('intake.currentMeds')}</label>
              <input className="story-input" style={{ height: 'auto', padding: '10px 12px' }} placeholder={t('intake.currentMedsPlaceholder')} value={currentMeds} onChange={(e) => setCurrentMeds(e.target.value)} />

              <label className="input-label" style={{ marginTop: '14px' }}>{t('intake.emergencyContact')} <span className="required-asterisk">*</span></label>
              <input className={`story-input ${intakeError && !emergencyContact.trim() ? 'field-error' : ''}`} style={{ height: 'auto', padding: '10px 12px' }} placeholder={t('intake.emergencyContactPlaceholder')} value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} />
              {intakeError && !emergencyContact.trim() && <div className="error-msg">{t('intake.required')}</div>}

              <div className="choice-row" style={{ marginTop: '14px' }}><button className={ayushMode ? 'choice-card selected' : 'choice-card'} onClick={() => setAyushMode(!ayushMode)}><HeartPulse size={17} /><span><strong>{t('intake.includeAyush')}</strong><small>{t('intake.ayushDetail')}</small></span>{ayushMode && <Check size={15} />}</button><button className={priorSurgery ? 'choice-card selected' : 'choice-card'} onClick={() => setPriorSurgery(!priorSurgery)}><ClipboardList size={17} /><span><strong>{t('intake.pastSurgery')}</strong><small>{t('intake.pastSurgeryDetail')}</small></span>{priorSurgery && <Check size={15} />}</button></div>
            </div>}

            {intakeStep === 2 && <div className="intake-body">
              <div className="question-title"><MessageCircle size={19} /><div><span>{t('intake.question02')}</span><strong>{t('intake.symptomQ')}</strong></div></div>
              <p className="helper-text">{t('intake.symptomHelper')}</p>
              <div className="symptom-grid">
                <button className={selectedSymptom === 'chestPain' ? 'symptom-card warning-selected' : 'symptom-card'} onClick={() => { setSelectedSymptom('chestPain'); setHasRedFlag(true); setSymptomSelected(true); }}><div className="symptom-icon-3d"><AlertTriangle size={20} /></div><span>{t('intake.chestPain')}</span></button>
                <button className={selectedSymptom === 'breathing' ? 'symptom-card warning-selected' : 'symptom-card'} onClick={() => { setSelectedSymptom('breathing'); setHasRedFlag(true); setSymptomSelected(true); }}><div className="symptom-icon-3d"><HeartPulse size={20} /></div><span>{t('intake.breathing')}</span></button>
                <button className={selectedSymptom === 'weakness' ? 'symptom-card warning-selected' : 'symptom-card'} onClick={() => { setSelectedSymptom('weakness'); setHasRedFlag(true); setSymptomSelected(true); }}><div className="symptom-icon-3d"><Activity size={20} /></div><span>{t('intake.weakness')}</span></button>
                <button className={selectedSymptom === 'other' ? 'symptom-card selected' : 'symptom-card'} onClick={() => { setSelectedSymptom('other'); setHasRedFlag(false); setSymptomSelected(true); }}><div className="symptom-icon-3d"><CircleHelp size={20} /></div><span>{t('intake.otherSymptom')}</span></button>
                {selectedSymptom === 'other' && <textarea className="symptom-other-input" placeholder={t('intake.otherSymptomPlaceholder')} value={otherSymptomText} onChange={(e) => setOtherSymptomText(e.target.value)} />}
              </div>
              {intakeError && !symptomSelected && <div className="error-msg" style={{ marginTop: '10px' }}>{t('intake.selectSymptom')}</div>}
              {hasRedFlag && <div className="red-flag-notice"><AlertTriangle size={18} /><span><strong>{t('intake.redFlagNotice')}</strong> {t('intake.redFlagNoticeBody')}</span></div>}
            </div>}

            {intakeStep === 3 && <div className="intake-body">
              <div className="question-title"><ScanLine size={19} /><div><span>{t('intake.question03')}</span><strong>{t('intake.addRecords')}</strong></div></div>
              <p className="helper-text">{t('intake.recordsHelper')}</p>
              <button className="intake-dropzone" onClick={() => setModal('upload')}><Paperclip size={22} /><strong>{documents.length > 0 ? t('intake.docAdded') : t('intake.tapAdd')}</strong><span>{t('intake.docType')}</span></button>
              <div className="abha-note"><ShieldCheck size={17} /><span>{t('intake.abhaNote')}</span></div>
            </div>}

            {intakeStep === 4 && <div className="intake-body">
              <div className="summary-ready"><div className="summary-check"><Check size={25} /></div><div><strong>{t('intake.readyForReview')}</strong><span>{t('intake.structuredFrom')}</span></div></div>
              <div className="summary-list">
                <div><span>{t('intake.chiefConcern')}</span><strong>{chiefConcern || t('intake.placeholder')}</strong></div>
                <div><span>{t('intake.symptomQ')}</span><strong>{symptomLabel || '-'}</strong></div>
                <div><span>{t('intake.symptomDuration')}</span><strong>{symptomDuration}</strong></div>
                <div><span>{t('intake.severity')}</span><strong>{severity ? t(`intake.${severity}`) : '-'}</strong></div>
                <div><span>{t('intake.currentMeds')}</span><strong>{currentMeds || '-'}</strong></div>
                <div><span>{t('intake.emergencyContact')}</span><strong>{emergencyContact || '-'}</strong></div>
                <div><span>{t('intake.historyCaptured')}</span><strong>{t('summary.hpi')} · {t('summary.pastMed')} · {ayushMode ? t('intake.ayushContext') : t('intake.lifestyleContext')}</strong></div>
                <div><span>{t('intake.safetyScreening')}</span><strong className={hasRedFlag ? 'warning-text' : ''}>{hasRedFlag ? t('intake.priorityFlagged') : t('intake.noUrgent')}</strong></div>
              </div>
              <label className="consent-row"><button className={intakeConsent ? 'check-box checked' : 'check-box'} onClick={() => setIntakeConsent(!intakeConsent)}>{intakeConsent && <Check size={13} />}</button><span>{t('intake.consentShare')}</span></label>
            </div>}

            <div className="intake-footer">{intakeStep > 1 ? <button className="back-button" onClick={() => handleIntakeStep('back')}>{t('intake.back')}</button> : <span />}{intakeStep < 4 ? <button className="primary-button" onClick={() => handleIntakeStep('next')}>{intakeStep === 3 ? t('intake.buildSummary') : t('intake.continue')} <ArrowRight size={16} /></button> : <button className="primary-button" onClick={finishIntake} disabled={!intakeConsent}>{t('intake.finish')} <Check size={16} /></button>}</div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {modal === 'upload' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            <div className="modal-icon"><ScanLine size={22} /></div>
            <p className="eyebrow">{t('upload.eyebrow')}</p>
            <h2>{t('upload.title')}</h2>
            <p className="modal-copy">{t('upload.body')}</p>
            <div className="category-row"><p className="input-label">{t('upload.category')}</p><div className="category-pills">{docCategories.map((c) => <button className={uploadCategory === c.key ? 'category-pill selected' : 'category-pill'} key={c.key} onClick={() => setUploadCategory(c.key)}>{t(c.labelKey)}</button>)}</div></div>
            <button className="dropzone" onClick={doUpload} disabled={uploading || !uploadConsent}><Paperclip size={21} /><strong>{uploading ? t('upload.uploading') : t('upload.choose')}</strong><span>{t('upload.fileInfo')}</span></button>
            <div className="modal-consent"><button className={uploadConsent ? 'check-box checked' : 'check-box'} onClick={() => setUploadConsent(!uploadConsent)}>{uploadConsent && <Check size={13} />}</button><span>{t('upload.consent')}</span></div>
            {uploadMsg && <div className={`upload-msg ${uploadMsg.includes('error') ? 'error' : 'success'}`}><Check size={14} /> {uploadMsg}</div>}
          </div>
        </div>
      )}

      {/* Profile Modal - shows even while patient loads */}
      {modal === 'profile' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            <div className="modal-icon"><UserRound size={22} /></div>
            <p className="eyebrow">{t('profile.eyebrow')}</p>
            <h2>{t('profile.title')}</h2>
            <p className="modal-copy">{t('profile.body')}</p>
            {!patient ? <div className="report-loading">{t('profile.loadingProfile')}</div> : (
              <>
                <div className="profile-form">
                  <div className="form-row"><label>{t('profile.name')}</label><input value={profileForm.name || ''} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} /></div>
                  <div className="form-row-half"><div className="form-row"><label>{t('profile.age')}</label><input type="number" value={profileForm.age || ''} onChange={(e) => setProfileForm({ ...profileForm, age: parseInt(e.target.value) || 0 })} /></div><div className="form-row"><label>{t('profile.gender')}</label><select value={profileForm.gender || 'Male'} onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}><option value="Male">{t('profile.male')}</option><option value="Female">{t('profile.female')}</option><option value="Other">{t('profile.other')}</option></select></div></div>
                  <div className="form-row"><label>{t('profile.phone')}</label><input value={profileForm.phone || ''} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
                  <div className="form-row"><label>{t('profile.email')}</label><input value={profileForm.email || ''} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} /></div>
                  <div className="form-row"><label>{t('profile.address')}</label><input value={profileForm.address || ''} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} /></div>
                  <div className="form-row-half"><div className="form-row"><label>{t('profile.bloodGroup')}</label><input value={profileForm.blood_group || ''} onChange={(e) => setProfileForm({ ...profileForm, blood_group: e.target.value })} /></div><div className="form-row"><label>{t('profile.patientCode')}</label><input value={profileForm.patient_code || ''} disabled /></div></div>
                </div>
                <button className="primary-button" onClick={saveProfile} disabled={savingProfile}>{savingProfile ? t('profile.saving') : t('profile.save')}</button>
                {profileMsg && <div className="upload-msg success"><Check size={14} /> {profileMsg}</div>}
              </>
            )}
          </div>
        </div>
      )}

      {/* Consent Modal */}
      {modal === 'consent' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="consent-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            <div className="modal-icon"><ShieldCheck size={22} /></div>
            <p className="eyebrow">{t('consent.eyebrow')}</p>
            <h2>{t('consent.title')}</h2>
            <p className="modal-copy">{t('consent.body')}</p>
            <div className="consent-list">{consentTypes.map((ct) => <div className="consent-item" key={ct.key}><div className="consent-info"><strong>{t(ct.labelKey)}</strong><span>{t(ct.descKey)}</span></div><button className={consentForm[ct.key] ? 'toggle-switch on' : 'toggle-switch'} onClick={() => setConsentForm({ ...consentForm, [ct.key]: !consentForm[ct.key] })}><span className="toggle-knob" /></button></div>)}</div>
            <button className="primary-button" onClick={saveConsent} disabled={savingConsent}>{savingConsent ? t('common.loading') : t('consent.save')}</button>
            {consentMsg && <div className="upload-msg success"><Check size={14} /> {consentMsg}</div>}
          </div>
        </div>
      )}

      {/* Report Modal */}
      {modal === 'report' && (
        <div className="modal-backdrop" onClick={() => { setModal(null); setActiveReport(null); }}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setModal(null); setActiveReport(null); }}><X size={18} /></button>
            {loadingReport ? <div className="report-loading">{t('common.loading')}</div> : !activeReport ? <div className="report-loading">{t('history.noReport')}</div> : (
              <>
                <div className="report-header">
                  <div>
                    <p className="eyebrow">{t('report.eyebrow')}</p>
                    <h2>{activeReport.report_title}</h2>
                    <p className="report-date">{t('report.generated')} {new Date(activeReport.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'hi' ? 'hi-IN' : 'mr-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <span className={`report-status-badge ${activeReport.status}`}>{t(`report.status${activeReport.status.charAt(0).toUpperCase()}${activeReport.status.slice(1)}`)}</span>
                </div>

                <div className="report-patient-bar">
                  <div className="review-avatar">{patient?.avatar_initials || 'AS'}</div>
                  <div>
                    <strong>{patient?.name || 'Aarav Sharma'}</strong>
                    <span>{patient?.age || 34} years · {patient?.gender || 'Male'} · {patient?.patient_code || 'MK-28491'}</span>
                  </div>
                </div>

                {activeReport.has_red_flag ? (
                  <div className="report-flag"><AlertTriangle size={18} /><span><strong>{t('report.redFlag')}</strong> — {activeReport.red_flag_note}</span></div>
                ) : (
                  <div className="report-no-flag"><BadgeCheck size={18} /><span>{t('report.noRedFlag')}</span></div>
                )}

                <div className="report-section">
                  <div className="report-section-title"><MessageCircle size={15} /> {t('report.chiefComplaint')}</div>
                  <div className="report-section-body">{activeReport.chief_concern || '-'}</div>
                </div>

                <div className="report-section">
                  <div className="report-section-title"><FileText size={15} /> {t('report.hpi')}</div>
                  <div className="report-section-body">{activeReport.hpi || '-'}</div>
                </div>

                <div className="report-grid">
                  <div className="report-grid-item"><label>{t('report.pastHistory')}</label><span>{activeReport.past_history || '-'}</span></div>
                  <div className="report-grid-item"><label>{t('report.drugAllergy')}</label><span>{activeReport.drug_allergy || '-'}</span></div>
                  <div className="report-grid-item"><label>{t('report.personalHistory')}</label><span>{activeReport.personal_history || '-'}</span></div>
                  <div className="report-grid-item"><label>{t('report.ayushMode')}</label><span>{activeReport.ayush_mode ? t('report.yes') : t('report.no')}</span></div>
                  <div className="report-grid-item"><label>{t('report.priorSurgery')}</label><span>{activeReport.prior_surgery ? t('report.yes') : t('report.no')}</span></div>
                  <div className="report-grid-item"><label>{t('report.safetyScreening')}</label><span>{activeReport.has_red_flag ? t('report.redFlag') : t('report.noRedFlag')}</span></div>
                </div>

                <div className="report-section">
                  <div className="report-section-title"><Stethoscope size={15} /> {t('report.diagnosis')}</div>
                  <div className={`report-section-body ${!activeReport.diagnosis ? 'pending' : ''}`}>{activeReport.diagnosis || t('report.diagnosisPending')}</div>
                </div>

                <div className="report-section">
                  <div className="report-section-title"><ClipboardList size={15} /> {t('report.prescription')}</div>
                  <div className={`report-section-body ${!activeReport.prescription ? 'pending' : ''}`}>{activeReport.prescription || t('report.prescriptionPending')}</div>
                </div>

                <div className="report-section">
                  <div className="report-section-title"><BadgeCheck size={15} /> {t('report.advice')}</div>
                  <div className={`report-section-body ${!activeReport.advice ? 'pending' : ''}`}>{activeReport.advice || t('report.advicePending')}</div>
                </div>

                <div className="report-section">
                  <div className="report-section-title"><History size={15} /> {t('report.followUp')}</div>
                  <div className={`report-section-body ${!activeReport.follow_up ? 'pending' : ''}`}>{activeReport.follow_up || t('report.followUpPending')}</div>
                </div>

                <div className="report-section">
                  <div className="report-section-title"><FileSignature size={15} /> {t('report.physicianNotes')}</div>
                  <div className={`report-section-body ${!activeReport.physician_notes ? 'pending' : ''}`}>{activeReport.physician_notes || t('report.physicianNotesPending')}</div>
                </div>

                <div className="report-footer">
                  <span><LockKeyhole size={14} /> {t('summary.draftPrivate')}</span>
                  <button className="primary-button" onClick={() => { setModal(null); setActiveReport(null); }}>{t('report.close')} <X size={16} /></button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* How It Works Modal */}
      {modal === 'howitworks' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="howitworks-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            <div className="modal-icon"><CircleHelp size={22} /></div>
            <p className="eyebrow">{t('howitworks.eyebrow')}</p>
            <h2>{t('howitworks.title')}</h2>
            <p className="modal-copy">{t('howitworks.body')}</p>
            <div className="howitworks-steps">
              <div className="howitworks-step"><div className="howitworks-step-num"><Mic size={16} /></div><div><strong>{t('howitworks.step1Title')}</strong><span>{t('howitworks.step1Desc')}</span></div></div>
              <div className="howitworks-step"><div className="howitworks-step-num"><FileSignature size={16} /></div><div><strong>{t('howitworks.step2Title')}</strong><span>{t('howitworks.step2Desc')}</span></div></div>
              <div className="howitworks-step"><div className="howitworks-step-num"><ScanLine size={16} /></div><div><strong>{t('howitworks.step3Title')}</strong><span>{t('howitworks.step3Desc')}</span></div></div>
              <div className="howitworks-step"><div className="howitworks-step-num"><BadgeCheck size={16} /></div><div><strong>{t('howitworks.step4Title')}</strong><span>{t('howitworks.step4Desc')}</span></div></div>
            </div>
            <button className="primary-button" onClick={() => setModal(null)}>{t('common.close')}</button>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {modal === 'docview' && activeDoc && (
        <div className="modal-backdrop" onClick={() => { setModal(null); setActiveDoc(null); }}>
          <div className="docview-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setModal(null); setActiveDoc(null); }}><X size={18} /></button>
            <div className="report-header">
              <div>
                <p className="eyebrow">{t('docs.eyebrow')}</p>
                <h2>{activeDoc.filename}</h2>
                <p className="report-date">{t('docs.uploaded')} {new Date(activeDoc.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'hi' ? 'hi-IN' : 'mr-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
              <span className="report-status-badge generated">{activeDoc.category}</span>
            </div>
            <div className="report-section">
              <div className="report-section-title"><FileText size={15} /> {t('docview.fileInfo')}</div>
              <div className="report-grid">
                <div className="report-grid-item"><label>{t('docview.fileType')}</label><span>{activeDoc.file_type.toUpperCase()}</span></div>
                <div className="report-grid-item"><label>{t('docview.fileSize')}</label><span>{(activeDoc.file_size / 1024).toFixed(0)} KB</span></div>
                <div className="report-grid-item"><label>{t('docview.category')}</label><span>{t(`upload.${activeDoc.category === 'lab_report' ? 'labReport' : activeDoc.category === 'discharge_summary' ? 'discharge' : activeDoc.category}`)}</span></div>
                <div className="report-grid-item"><label>{t('docview.ocrStatus')}</label><span>{activeDoc.ocr_status}</span></div>
              </div>
            </div>
            <div className="report-section">
              <div className="report-section-title"><ScanLine size={15} /> {t('docview.ocrText')}</div>
              <div className="report-section-body">{activeDoc.ocr_extracted_text || t('docview.noOcrText')}</div>
            </div>
            <div className="report-footer">
              <span><LockKeyhole size={14} /> {t('summary.draftPrivate')}</span>
              <button className="primary-button" onClick={() => { setModal(null); setActiveDoc(null); }}>{t('common.close')} <X size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
