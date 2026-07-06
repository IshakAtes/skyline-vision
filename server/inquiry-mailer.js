import nodemailer from 'nodemailer';

const siteName = 'Grenady';
const defaultRecipient = 'ishakfeuer@gmail.com';
const defaultFrom = 'Grenady <mail@grenady.de>';
const genericErrorMessage = 'Die Anfrage konnte leider nicht gesendet werden. Bitte versuche es erneut oder kontaktiere uns direkt.';
const successMessage = 'Vielen Dank! Deine Anfrage wurde erfolgreich gesendet. Wir melden uns zeitnah bei dir.';
const rateLimitWindowMs = 15 * 60 * 1000;
const rateLimitMaxRequests = 5;
const rateLimitStore = new Map();

const labels = {
  projectTypes: {
    website: 'Webseiten & Landingpages',
    business_app_shop: 'Business-Apps & Onlineshops',
    digital_marketing: 'Digitales Marketing',
    ai_automation: 'KI-Automatisierung',
    signage: 'Firmen- & Fassadenschilder',
    relaunch: 'Webseiten & Landingpages',
    shop: 'Business-Apps & Onlineshops',
    seo: 'Digitales Marketing',
    branding: 'Digitales Marketing',
    marketing: 'Digitales Marketing',
    'ai-automation': 'KI-Automatisierung',
    'ai-assistant': 'KI-Automatisierung',
    software: 'Business-Apps & Onlineshops',
    retainer: 'Business-Apps & Onlineshops',
  },
  signType: {
    led: 'LED-Schrift & Leuchtreklame',
    'company-sign': 'Firmen- & Fassadenschild',
    'sign-consulting': 'Beratung zur Schildart',
  },
  websitePackage: {
    landingpage: 'Landingpage / Onepager',
    business: 'Business Website',
    shop: 'Onlineshop',
    custom: 'Individuelle Plattform',
    unsure: 'Noch offen',
  },
  timeline: {
    asap: 'So bald wie möglich',
    '2-4-weeks': 'In 2 - 4 Wochen',
    '1-3-months': 'In 1 - 3 Monaten',
    flexible: 'Flexibel',
  },
};

const fieldLabels = {
  name: 'Name',
  email: 'E-Mail',
  phone: 'Telefon',
  company: 'Firma',
  projectTypes: 'Hauptbereich',
  signType: 'Detail Beschilderung',
  websitePackage: 'Detail Website / Shop',
  timeline: 'Zeitraum',
  inspirationWebsites: 'Inspirations-Websites',
  notes: 'Nachricht / Zusatzwünsche',
  offer: 'Angebot',
};

function limitLength(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function stripControlCharacters(value) {
  return Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 10 || code === 13 || code === 9 || (code > 31 && code !== 127);
    })
    .join('');
}

function normalizeString(value, maxLength = 1000) {
  if (typeof value !== 'string') return '';
  return limitLength(stripControlCharacters(value).trim(), maxLength);
}

function normalizeHeaderValue(value, fallback = '') {
  const normalized = normalizeString(value, 320).replace(/[\r\n]+/g, ' ');
  return normalized || fallback;
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeString(item, 80)).filter(Boolean).slice(0, 20);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value);
}

function parseBoolean(value) {
  return ['1', 'true', 'yes'].includes(String(value).toLowerCase());
}

function getAllowedOrigins() {
  return normalizeString(process.env.INQUIRY_ALLOWED_ORIGIN || '', 1000)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin) {
  const allowedOrigins = getAllowedOrigins();
  if (!allowedOrigins.length || !origin) return true;
  return allowedOrigins.includes(origin);
}

export function createCorsHeaders(origin) {
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = origin && isOriginAllowed(origin)
    ? origin
    : allowedOrigins[0] || '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function isRateLimited(key) {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now - existing.startedAt > rateLimitWindowMs) {
    rateLimitStore.set(key, { count: 1, startedAt: now });
    return false;
  }

  existing.count += 1;
  return existing.count > rateLimitMaxRequests;
}

function humanizeChoice(group, value) {
  if (!value) return 'Nicht angegeben';
  return labels[group]?.[value] || value;
}

function humanizeChoices(group, values) {
  const normalizedValues = normalizeArray(values);
  if (!normalizedValues.length) return 'Nicht angegeben';
  return [...new Set(normalizedValues.map((value) => humanizeChoice(group, value)))].join(', ');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeInquiry(payload = {}) {
  const projectTypes = normalizeArray(payload.projectTypes);
  const projectType = normalizeString(payload.projectType, 80) || projectTypes[0] || '';

  return {
    name: normalizeString(payload.name, 120),
    email: normalizeString(payload.email, 254).toLowerCase(),
    phone: normalizeString(payload.phone, 80),
    company: normalizeString(payload.company, 160),
    projectType,
    projectTypes: projectTypes.length ? projectTypes : (projectType ? [projectType] : []),
    signType: normalizeString(payload.signType, 80),
    websitePackage: normalizeString(payload.websitePackage, 80),
    timeline: normalizeString(payload.timeline, 80),
    inspirationWebsites: normalizeString(payload.inspirationWebsites, 2000),
    notes: normalizeString(payload.notes, 4000),
    companyWebsite: normalizeString(payload.companyWebsite, 200),
    meta: {
      pageUrl: normalizeString(payload.meta?.pageUrl, 500),
      submittedAt: normalizeString(payload.meta?.submittedAt, 80),
      userAgent: normalizeString(payload.meta?.userAgent, 500),
    },
  };
}

function validateInquiry(inquiry) {
  if (inquiry.companyWebsite) return '';
  if (!inquiry.name) return 'Bitte geben Sie Ihren Namen ein.';
  if (!inquiry.email || !isValidEmail(inquiry.email)) return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
  if (!inquiry.phone) return 'Bitte geben Sie eine Telefonnummer ein.';
  if (!inquiry.projectTypes.length) return 'Bitte wählen Sie einen Hauptbereich aus.';
  return '';
}

function formatLine(label, value) {
  return `${label}: ${value || 'Nicht angegeben'}`;
}

function formatTextEmail(inquiry) {
  const selectionLines = [
    formatLine(fieldLabels.projectTypes, humanizeChoices('projectTypes', inquiry.projectTypes)),
    inquiry.signType ? formatLine(fieldLabels.signType, humanizeChoice('signType', inquiry.signType)) : '',
    inquiry.websitePackage ? formatLine(fieldLabels.websitePackage, humanizeChoice('websitePackage', inquiry.websitePackage)) : '',
    formatLine(fieldLabels.timeline, humanizeChoice('timeline', inquiry.timeline)),
    formatLine(fieldLabels.inspirationWebsites, inquiry.inspirationWebsites),
    formatLine(fieldLabels.offer, 'Individuelles Angebot nach Anfrage'),
  ].filter(Boolean);

  return [
    `Neue Anfrage über ${siteName}`,
    '',
    'Kundendaten:',
    formatLine(fieldLabels.name, inquiry.name),
    formatLine(fieldLabels.email, inquiry.email),
    formatLine(fieldLabels.phone, inquiry.phone),
    formatLine(fieldLabels.company, inquiry.company),
    '',
    'Konfigurator-Auswahl:',
    ...selectionLines,
    '',
    'Nachricht / Zusatzwünsche:',
    inquiry.notes || 'Nicht angegeben',
    '',
    'Technische Infos:',
    formatLine('Seite', inquiry.meta.pageUrl),
    formatLine('Zeitpunkt', inquiry.meta.submittedAt),
    formatLine('Browser', inquiry.meta.userAgent),
  ].join('\n');
}

function renderRows(rows) {
  return rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#666;width:220px;">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#111;font-weight:600;">${escapeHtml(value || 'Nicht angegeben')}</td>
    </tr>
  `).join('');
}

function formatHtmlEmail(inquiry) {
  const customerRows = [
    [fieldLabels.name, inquiry.name],
    [fieldLabels.email, inquiry.email],
    [fieldLabels.phone, inquiry.phone],
    [fieldLabels.company, inquiry.company],
  ];
  const selectionRows = [
    [fieldLabels.projectTypes, humanizeChoices('projectTypes', inquiry.projectTypes)],
    ...(inquiry.signType ? [[fieldLabels.signType, humanizeChoice('signType', inquiry.signType)]] : []),
    ...(inquiry.websitePackage ? [[fieldLabels.websitePackage, humanizeChoice('websitePackage', inquiry.websitePackage)]] : []),
    [fieldLabels.timeline, humanizeChoice('timeline', inquiry.timeline)],
    [fieldLabels.inspirationWebsites, inquiry.inspirationWebsites],
    [fieldLabels.offer, 'Individuelles Angebot nach Anfrage'],
  ];

  return `
    <div style="margin:0;padding:28px;background:#f6f3ef;font-family:Arial,sans-serif;color:#111;">
      <div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e6e0d8;border-radius:10px;overflow:hidden;">
        <div style="padding:28px 30px;background:#111;color:#fff;">
          <p style="margin:0 0 8px;color:#e98700;letter-spacing:.12em;text-transform:uppercase;font-size:12px;">${siteName}</p>
          <h1 style="margin:0;font-size:28px;font-weight:600;">Neue Anfrage über ${siteName}</h1>
        </div>
        <div style="padding:26px 30px;">
          <h2 style="margin:0 0 14px;font-size:18px;">Kundendaten</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden;">${renderRows(customerRows)}</table>

          <h2 style="margin:28px 0 14px;font-size:18px;">Konfigurator-Auswahl</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden;">${renderRows(selectionRows)}</table>

          <h2 style="margin:28px 0 12px;font-size:18px;">Nachricht / Zusatzwünsche</h2>
          <div style="white-space:pre-wrap;line-height:1.6;padding:16px;border:1px solid #eee;border-radius:8px;background:#fafafa;">${escapeHtml(inquiry.notes || 'Nicht angegeben')}</div>

          <p style="margin:26px 0 0;color:#777;font-size:12px;line-height:1.6;">
            Seite: ${escapeHtml(inquiry.meta.pageUrl || 'Nicht angegeben')}<br>
            Zeitpunkt: ${escapeHtml(inquiry.meta.submittedAt || 'Nicht angegeben')}<br>
            Browser: ${escapeHtml(inquiry.meta.userAgent || 'Nicht angegeben')}
          </p>
        </div>
      </div>
    </div>
  `;
}

function createTransporter() {
  const host = normalizeHeaderValue(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = parseBoolean(process.env.SMTP_SECURE);
  const user = normalizeHeaderValue(process.env.SMTP_USER);
  const pass = normalizeHeaderValue(process.env.SMTP_PASS);

  if (!host) {
    throw new Error('SMTP_HOST is missing.');
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT is invalid.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user || pass ? { user, pass } : undefined,
  });
}

async function sendInquiryEmail(inquiry) {
  const transporter = createTransporter();
  const from = normalizeHeaderValue(process.env.SMTP_FROM, defaultFrom);
  const to = normalizeHeaderValue(process.env.INQUIRY_RECIPIENT_EMAIL, defaultRecipient);

  await transporter.sendMail({
    from,
    to,
    replyTo: inquiry.email,
    subject: `Neue Anfrage über ${siteName}`,
    text: formatTextEmail(inquiry),
    html: formatHtmlEmail(inquiry),
  });
}

export async function createInquiryResponse(payload, options = {}) {
  if (!isOriginAllowed(options.origin)) {
    return { status: 403, body: { message: genericErrorMessage } };
  }

  const rateLimitKey = options.ip || 'unknown';
  if (isRateLimited(rateLimitKey)) {
    return { status: 429, body: { message: 'Bitte warten Sie kurz, bevor Sie eine weitere Anfrage senden.' } };
  }

  const inquiry = normalizeInquiry(payload);
  const validationError = validateInquiry(inquiry);

  if (validationError) {
    return { status: 400, body: { message: validationError } };
  }

  if (inquiry.companyWebsite) {
    return { status: 200, body: { message: successMessage } };
  }

  try {
    await sendInquiryEmail(inquiry);
    return { status: 200, body: { message: successMessage } };
  } catch (error) {
    console.error('SMTP inquiry email failed:', error);
    return { status: 500, body: { message: genericErrorMessage } };
  }
}
