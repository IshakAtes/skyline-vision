import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ExternalLink,
  LayoutTemplate,
  Link2,
  LoaderCircle,
  Megaphone,
  MessageCircle,
  Monitor,
  ShoppingBag,
  X,
} from 'lucide-react';
import { getWhatsappUrl } from './config/whatsapp';

const projectOptions = [
  { id: 'website', title: 'Webseiten & Landingpages', desc: 'Moderne Webseiten, Onepager, Landingpages und Unternehmenswebseiten.', icon: LayoutTemplate },
  { id: 'business_app_shop', title: 'Business-Apps & Onlineshops', desc: 'Webanwendungen, Kundenportale, Buchungssysteme und Onlineshops.', icon: ShoppingBag },
  { id: 'digital_marketing', title: 'Digitales Marketing', desc: 'SEO, GEO, Social-Media-Marketing, Sichtbarkeit und digitale Kundengewinnung.', icon: Megaphone },
  { id: 'ai_automation', title: 'KI-Automatisierung', desc: 'n8n-Workflows, KI-Assistenten, KI-Agents und Prozessautomation.', icon: Bot },
  { id: 'signage', title: 'Firmen- & Fassadenschilder', desc: 'Firmenschilder, Fassadenschilder, Leuchtreklame und Außenwerbung.', icon: Monitor },
];

const budgetOptions = [
  { id: 'compact', title: 'Kompakter Einstieg', desc: 'Schlanker Umfang mit klar priorisierten Zielen' },
  { id: 'professional', title: 'Professionelles Projekt', desc: 'Solider Ausbau mit Strategie, Design und Umsetzung' },
  { id: 'growth', title: 'Wachstum & Skalierung', desc: 'Mehrere Bausteine oder laufende Weiterentwicklung' },
  { id: 'custom', title: 'Individuelle Lösung', desc: 'Komplexere Anforderungen oder besondere Funktionen' },
  { id: 'unsure', title: 'Noch offen', desc: 'Wir ordnen den passenden Rahmen gemeinsam ein' },
];

const timelineOptions = [
  { id: 'asap', title: 'So bald wie möglich', desc: 'Schneller Projektstart' },
  { id: '2-4-weeks', title: 'In 2 - 4 Wochen', desc: 'Start ist konkret geplant' },
  { id: '1-3-months', title: 'In 1 - 3 Monaten', desc: 'Projekt wird vorbereitet' },
  { id: 'flexible', title: 'Flexibel', desc: 'Zeitraum noch offen' },
];

const inquiryEndpoint = import.meta.env.VITE_INQUIRY_API_URL || '/api/send-inquiry';
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getLabel = (options, value, fallback = 'Noch offen') => options.find((option) => option.id === value)?.title || fallback;

function OptionCard({ option, selected, multiple, onSelect }) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      className={`config-option ${multiple ? 'is-multiple' : ''} ${selected ? 'is-selected' : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {Icon && <Icon size={22} strokeWidth={1.8} />}
      <span><strong>{option.title}</strong><small>{option.desc}</small></span>
      <span className="option-check"><Check size={13} /></span>
    </button>
  );
}

function OptionGroup({ label, options, value, multiple = false, allowEmpty = false, onSelect }) {
  return (
    <fieldset className="config-fieldset">
      <legend>{label}</legend>
      <div className="config-options">
        {options.map((option) => {
          const selected = multiple ? value.includes(option.id) : value === option.id;
          return (
            <OptionCard
              key={option.id}
              option={option}
              selected={selected}
              multiple={multiple}
              onSelect={() => onSelect(allowEmpty && selected ? '' : option.id)}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

function Configurator({ onClose }) {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    projectType: '',
    projectTypes: [],
    signType: '',
    websitePackage: '',
    budget: '',
    timeline: '',
    inspirationWebsites: '',
    name: '',
    company: '',
    companyWebsite: '',
    email: '',
    phone: '',
    notes: '',
  });

  const hasValidContactData = Boolean(formData.name.trim() && emailRegex.test(formData.email.trim()) && formData.phone.trim());
  const canProceed = step === 1 ? Boolean(formData.projectType) : step === 3 ? hasValidContactData : true;
  const select = (name, value) => {
    setFormError('');
    setFormData((current) => ({ ...current, [name]: value }));
  };
  const selectProjectType = (value) => setFormData((current) => {
    setFormError('');
    return {
      ...current,
      projectType: value,
      projectTypes: value ? [value] : [],
      signType: '',
      websitePackage: '',
    };
  });
  const change = (event) => {
    setFormError('');
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };
  const validateForm = () => {
    if (!formData.name.trim()) return 'Bitte geben Sie Ihren Namen ein.';
    if (!emailRegex.test(formData.email.trim())) return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
    if (!formData.phone.trim()) return 'Bitte geben Sie eine Telefonnummer ein.';
    if (!formData.projectType) return 'Bitte wählen Sie einen Hauptbereich aus.';
    return '';
  };
  const buildInquiryPayload = () => ({
    ...formData,
    email: formData.email.trim(),
    meta: {
      pageUrl: window.location.href,
      submittedAt: new Date().toISOString(),
      userAgent: window.navigator.userAgent,
    },
  });
  const submit = async (event) => {
    event?.preventDefault();
    if (isSubmitting) return;

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const response = await fetch(inquiryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildInquiryPayload()),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || 'Inquiry request failed');
      }

      setSubmitted(true);
    } catch (error) {
      console.error(error);
      setFormError('Die Anfrage konnte leider nicht gesendet werden. Bitte versuche es erneut oder kontaktiere uns direkt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="configurator-overlay" role="dialog" aria-modal="true" aria-label="Projektanfrage">
      <div className="configurator-modal">
        <button className="config-close" onClick={onClose} aria-label="Konfigurator schließen"><X size={20} /></button>

        {submitted ? (
          <motion.div className="config-success" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="success-icon"><CheckCircle2 size={40} /></div>
            <span className="config-kicker">Anfrage eingegangen</span>
            <h2>Vielen Dank!</h2>
            <p>Deine Anfrage wurde erfolgreich gesendet. Wir melden uns zeitnah bei dir.</p>
            <p className="success-note">Senden Sie uns gerne Fotos, Logos, Videos, Screenshots oder Inspirationen direkt per WhatsApp.</p>
            <div className="success-actions">
              <a className="config-button whatsapp-button" href={getWhatsappUrl()} target="_blank" rel="noreferrer">
                <MessageCircle size={19} /> Dateien per WhatsApp senden <ExternalLink size={15} />
              </a>
              <button className="config-button secondary" onClick={onClose}>Zurück zur Startseite</button>
            </div>
          </motion.div>
        ) : (
          <div className="config-layout">
            <aside className="config-sidebar">
              <div>
                <span className="config-kicker">Grenady</span>
                <h2>Projekt starten</h2>
              </div>
              <ol className="config-progress">
                {['Projekt', 'Rahmen', 'Kontakt', 'Prüfen'].map((label, index) => {
                  const number = index + 1;
                  return (
                    <li className={step >= number ? 'is-active' : ''} key={label}>
                      <span>{step > number ? <Check size={13} /> : number}</span>{label}
                    </li>
                  );
                })}
              </ol>
              <div className="config-selection">
                <small>Aktuelle Auswahl</small>
                <strong>{formData.projectType ? getLabel(projectOptions, formData.projectType) : 'Noch kein Bereich gewählt'}</strong>
                <p>Beschreiben Sie Ihr Vorhaben kurz. Wir prüfen es individuell und melden uns mit einem passenden Angebot.</p>
              </div>
            </aside>

            <div className="config-content">
              <AnimatePresence mode="wait">
                <motion.div key={step} className="config-step" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
                  {step === 1 && (
                    <>
                      <span className="config-kicker">Schritt 1 von 4</span>
                      <h2>Wobei dürfen wir Sie unterstützen?</h2>
                      <p className="config-intro">Wählen Sie zuerst den Hauptbereich aus. Details klären wir danach über Ihre Angaben und die persönliche Beratung.</p>
                      <OptionGroup label="Hauptbereich" options={projectOptions} value={formData.projectType} onSelect={selectProjectType} />
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <span className="config-kicker">Schritt 2 von 4</span>
                      <h2>Budget, Zeitraum & Inspiration</h2>
                      <p className="config-intro">Beschreiben Sie kurz Ihr Vorhaben. Wir prüfen die Anfrage individuell und erstellen danach ein persönliches Angebot.</p>
                      <OptionGroup label="Budgetorientierung" options={budgetOptions} value={formData.budget} onSelect={(value) => select('budget', value)} />
                      <OptionGroup label="Zeitraum" options={timelineOptions} value={formData.timeline} onSelect={(value) => select('timeline', value)} />
                      <label className="config-label"><Link2 size={17} /> Inspirations-Websites</label>
                      <textarea className="config-input" name="inspirationWebsites" value={formData.inspirationWebsites} onChange={change} rows="3" placeholder="Links zu Websites, Beispielseiten, Marken oder Stilen" />
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <span className="config-kicker">Schritt 3 von 4</span>
                      <h2>Wie können wir Sie erreichen?</h2>
                      <p className="config-intro">Drei Pflichtfelder, damit Ihre Anfrage nicht im digitalen Nirgendwo landet.</p>
                      <form id="lead-form" className="config-form" onSubmit={(event) => { event.preventDefault(); if (canProceed) setStep(4); }}>
                        <div className="config-input-row">
                          <input className="config-input" name="name" value={formData.name} onChange={change} required placeholder="Ihr Name *" />
                          <input className="config-input" name="company" value={formData.company} onChange={change} placeholder="Unternehmen" />
                        </div>
                        <input
                          className="config-honeypot"
                          name="companyWebsite"
                          value={formData.companyWebsite}
                          onChange={change}
                          tabIndex="-1"
                          autoComplete="off"
                          aria-hidden="true"
                          placeholder="Website"
                        />
                        <input className="config-input" type="email" name="email" value={formData.email} onChange={change} required placeholder="E-Mail-Adresse *" />
                        <input className="config-input" type="tel" name="phone" value={formData.phone} onChange={change} required placeholder="Telefonnummer *" />
                        <label className="config-label"><MessageCircle size={17} /> Notizen</label>
                        <p className="config-help">Hier können Sie Website-Inspirationen, Beispielseiten, Links, Ideen oder besondere Wünsche einfügen. Bilder, Videos oder größere Dateien können Sie uns gerne anschließend per WhatsApp zusenden.</p>
                        <textarea className="config-input" name="notes" value={formData.notes} onChange={change} rows="5" placeholder="Kurzbeschreibung, Ziele, Links, Ideen oder besondere Anforderungen" />
                      </form>
                    </>
                  )}

                  {step === 4 && (
                    <>
                      <span className="config-kicker">Schritt 4 von 4</span>
                      <h2>Anfrage prüfen</h2>
                      <p className="config-intro">Passt alles? Wir prüfen Ihre Anfrage individuell und melden uns mit einem passenden persönlichen Angebot.</p>
                      <div className="config-summary">
                        {[
                          ['Hauptbereich', getLabel(projectOptions, formData.projectType)],
                          ['Budgetorientierung', getLabel(budgetOptions, formData.budget)],
                          ['Zeitraum', getLabel(timelineOptions, formData.timeline)],
                          ['Angebot', 'Individuelles Angebot nach Anfrage'],
                          ['Kontakt', `${formData.name}${formData.company ? `, ${formData.company}` : ''}`],
                        ].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
                      </div>
                      <div className="config-whatsapp-note"><Bot size={22} /><p><strong>Individuelles Angebot nach Anfrage.</strong><br />Bilder, Videos, Logos oder größere Dateien können Sie uns nach dem Absenden gerne per WhatsApp zusenden.</p></div>
                    </>
                  )}

                  {formError && <p className="config-error" role="alert">{formError}</p>}

                  <div className="config-navigation">
                    {step > 1 ? <button className="config-button secondary" disabled={isSubmitting} onClick={() => setStep((current) => current - 1)}><ArrowLeft size={17} /> Zurück</button> : <span />}
                    {step < 4 ? (
                      <button className="config-button primary" disabled={!canProceed || isSubmitting} onClick={() => canProceed && setStep((current) => current + 1)}>Weiter <ArrowRight size={17} /></button>
                    ) : (
                      <button className="config-button primary" disabled={isSubmitting} onClick={submit}>
                        {isSubmitting ? <><LoaderCircle className="config-spinner" size={17} /> Wird gesendet</> : <>Anfrage absenden <Check size={17} /></>}
                      </button>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Configurator;
