import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Copy, Check, X, Phone, PhoneCall, Settings, Sparkles, Loader2, Wallet, TrendingUp, TrendingDown, ShoppingBag, Camera, PartyPopper, Send, Lock, Delete, Receipt, ChevronRight, ChevronLeft, Home, Search, Bell, ArrowUpRight, ArrowDownRight, LogOut, Lightbulb, Package } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

const INVOICES_KEY = 'chaseit:invoices';
const SALES_KEY = 'chaseit:sales';
const EXPENSES_KEY = 'chaseit:expenses';
const SETTINGS_KEY = 'chaseit:settings';

// ============================================================
// SUPABASE CONNECTION — real backend, replacing local-only storage
// ============================================================
const SB_URL = 'https://gmduzfhxkjwojbkwgcxu.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtZHV6Zmh4a2p3b2pia3dnY3h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2Nzc3MzQsImV4cCI6MjEwMjI1MzczNH0.n1nm6W27zJE7epfJ7GlK3xAN9fcAjxeRDFDCNX6t4oo';
const SESSION_KEY = 'xorla:session';

function friendlyAuthError(raw) {
  const msg = (raw || '').toLowerCase();
  if (msg.includes('password') && (msg.includes('6 char') || msg.includes('at least'))) return 'Your password needs to be at least 6 characters long.';
  if (msg.includes('invalid login credentials')) return "That email or password doesn't match our records. Check both and try again.";
  if (msg.includes('user already registered') || msg.includes('already exists')) return 'An account with this email already exists — try logging in instead.';
  if (msg.includes('email') && msg.includes('invalid')) return 'That email address doesn\'t look right — double check it.';
  if (msg.includes('rate limit') || msg.includes('too many')) return "Too many attempts — wait a minute and try again.";
  if (msg.includes('failed to fetch') || msg.includes('network')) return "Couldn't reach the server — check your internet connection.";
  if (!raw) return 'Something went wrong. Please try again.';
  return raw;
}
const PASSWORD_MIN_LENGTH = 6;
function passwordError(password) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password needs to be at least ${PASSWORD_MIN_LENGTH} characters.`;
  return '';
}
function isPasswordValid(password) {
  return password.length >= PASSWORD_MIN_LENGTH;
}

async function sbAuthCall(path, body) {
  const res = await fetch(`${SB_URL}/auth/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(friendlyAuthError(data.error_description || data.msg || data.error));
  return data;
}
const sbSignUp = (email, password) => sbAuthCall('/signup', { email, password });
const sbSignIn = (email, password) => sbAuthCall('/token?grant_type=password', { email, password });
const sbRefresh = (refresh_token) => sbAuthCall('/token?grant_type=refresh_token', { refresh_token });
const sbRecover = (email) => sbAuthCall('/recover', { email });
async function sbSetNewPassword(accessToken, password) {
  const res = await fetch(`${SB_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Could not update password.');
  return data;
}

async function sbRest(table, { method = 'GET', accessToken, query = '', body } = {}) {
  const headers = { apikey: SB_KEY, 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (method !== 'GET') headers.Prefer = 'return=representation';
  const res = await fetch(`${SB_URL}/rest/v1/${table}${query}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return [];
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error_description || 'Database request failed.');
  return data;
}

async function sbRpc(fnName, accessToken, params) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error_description || 'Something went wrong setting up your business.');
  return data;
}

async function saveSession(session) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {} }
async function loadSession() { try { const v = localStorage.getItem(SESSION_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
async function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

const C = {
  bg: '#0A1F1C',
  surface: '#0F2925',
  surfaceRaised: '#13322C',
  line: 'rgba(255,255,255,0.07)',
  lineStrong: 'rgba(255,255,255,0.13)',
  ink: '#EAF6F2',
  inkDim: '#93B0AA',
  inkFaint: '#54706A',
  copper: '#FFB020',
  copperSoft: 'rgba(255,176,32,0.14)',
  sage: '#1FD9C4',
  sageSoft: 'rgba(31,217,196,0.14)',
  rust: '#E2624B',
  rustSoft: 'rgba(226,98,75,0.14)',
};
const shadow = '0 1px 1px rgba(0,0,0,0.25), 0 12px 28px -16px rgba(0,0,0,0.65)';

const TONES = [
  { id: 'friendly', label: 'Friendly', desc: 'Warm and friendly, like a normal polite reminder between people who know each other.' },
  { id: 'calm', label: 'Calm', desc: 'Calm, gentle, patient, and reassuring, even if the payment is very overdue. Never sounds annoyed.' },
  { id: 'firm', label: 'Firm', desc: 'Firm, direct, and businesslike. No small talk. Clearly states what is owed and expected.' },
  { id: 'custom', label: 'Custom', desc: '' },
];
const LANGUAGES = [
  { id: 'english', label: 'English' }, { id: 'pidgin', label: 'Pidgin' }, { id: 'yoruba', label: 'Yoruba' }, { id: 'igbo', label: 'Igbo' }, { id: 'hausa', label: 'Hausa' },
];
const EXPENSE_CATEGORIES = ['Restock', 'Transport', 'Rent', 'Staff', 'Other'];
const LANGUAGE_LABEL = { english: 'English', pidgin: 'Nigerian Pidgin English', yoruba: 'Yoruba', igbo: 'Igbo', hausa: 'Hausa' };

function daysBetween(a, b) { const ms = 1000 * 60 * 60 * 24; return Math.round((b - a) / ms); }
function balanceOf(inv) { return Math.max(0, Number(inv.amount) - Number(inv.paidAmount || 0)); }
function computeStatus(inv) {
  if (balanceOf(inv) <= 0) return 'paid';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(inv.dueDate); due.setHours(0, 0, 0, 0);
  const diff = daysBetween(due, today);
  if (diff < 0) return 'upcoming';
  if (diff === 0) return 'dueToday';
  if (diff <= 3) return 'soon';
  if (diff < 14) return 'overdue';
  return 'critical';
}
const URGENCY = {
  upcoming: { label: 'Upcoming', color: C.inkFaint },
  dueToday: { label: 'Due today', color: C.copper },
  soon: { label: 'Due soon', color: C.copper },
  overdue: { label: 'Overdue', color: C.rust },
  critical: { label: 'Needs your call', color: '#C4432E' },
  paid: { label: 'Paid', color: C.sage },
};
function fmt(n) { return `₦${Number(n || 0).toLocaleString('en-NG')}`; }
function todayKey() { return new Date().toLocaleDateString('sv-SE'); }

function timeLabel(iso) { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function dateKeyOf(iso) { return new Date(iso).toLocaleDateString('sv-SE'); }

function fromSbSale(row) {
  return { id: row.id, item: row.item, amount: row.amount, cost: row.cost || 0, owed: row.owed || 0, dateKey: dateKeyOf(row.sold_at), time: timeLabel(row.sold_at), loggedBy: row.logged_by_name || '', photo: null };
}
function fromSbInvoice(row) {
  return { id: row.id, clientName: row.client_name, invoiceNo: row.invoice_no, amount: row.amount, paidAmount: row.paid_amount || 0, dueDate: row.due_date, phone: row.phone || '', loggedBy: row.logged_by_name || '' };
}
function fromSbExpense(row) {
  return { id: row.id, item: row.item, amount: row.amount, category: row.category || 'Other', dateKey: dateKeyOf(row.spent_at), time: timeLabel(row.spent_at), loggedBy: row.logged_by_name || '' };
}
function fromSbProduct(row) {
  return { id: row.id, name: row.name, costPrice: row.cost_price || 0, sellingPrice: row.selling_price || 0, imageUrl: row.image_url || null };
}

function staticMessage(inv, settings) {
  const status = computeStatus(inv);
  const bal = balanceOf(inv);
  const amt = fmt(bal);
  const dueStr = new Date(inv.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const name = inv.clientName.split(' ')[0];
  const partial = inv.paidAmount > 0 ? ` (₦${Number(inv.paidAmount).toLocaleString('en-NG')} already received, ${amt} remaining)` : '';
  const link = settings.paymentLink ? `\n\nPay here: ${settings.paymentLink}` : '';
  let base;
  switch (status) {
    case 'upcoming': base = `Hi ${name}, just a friendly heads up — your payment of ${amt} for Invoice #${inv.invoiceNo} is due on ${dueStr}.${partial}`; break;
    case 'dueToday': base = `Hi ${name}, this is a reminder that your payment of ${amt} for Invoice #${inv.invoiceNo} is due today.${partial}`; break;
    case 'soon': base = `Hi ${name}, your payment of ${amt} for Invoice #${inv.invoiceNo} was due on ${dueStr}. Could you share an update on when we can expect it?${partial}`; break;
    case 'overdue': base = `Hi ${name}, Invoice #${inv.invoiceNo} (${amt}) is now overdue since ${dueStr}. Please arrange payment this week.${partial}`; break;
    case 'critical': base = `Hi ${name}, we've sent a few reminders about Invoice #${inv.invoiceNo} (${amt}), due ${dueStr}, with no response yet. Can we get on a quick call?${partial}`; break;
    default: base = '';
  }
  return base + link;
}
function staticThankYou(inv) {
  const name = inv.clientName.split(' ')[0];
  return `Hi ${name}, thank you — we've received your full payment of ${fmt(inv.amount)} for Invoice #${inv.invoiceNo}. We really appreciate your business! 🙏`;
}
async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data?.error?.message || `Request failed (${response.status})`);
  }
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!text) throw new Error('No response came back — try rephrasing your question.');
  return text;
}
async function aiMessage(inv, settings) {
  const status = computeStatus(inv);
  const bal = balanceOf(inv);
  const dueStr = new Date(inv.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const tone = TONES.find((t) => t.id === settings.tone) || TONES[0];
  const toneDesc = settings.tone === 'custom' ? (settings.customInstructions || 'Neutral and professional.') : tone.desc;
  const statusLine = {
    upcoming: `The payment is not due yet — due on ${dueStr}.`, dueToday: `The payment is due today, ${dueStr}.`,
    soon: `The payment was due on ${dueStr} and is a few days overdue.`, overdue: `The payment is significantly overdue — it was due on ${dueStr}.`,
    critical: `The payment is severely overdue (due ${dueStr}) and several reminders have already been sent with no response.`,
  }[status] || '';
  const prompt = `You are helping a Nigerian business write a short WhatsApp payment reminder to a client.

Client name: ${inv.clientName}
Invoice number: ${inv.invoiceNo}
Amount owed (balance remaining): ${fmt(bal)}
${inv.paidAmount > 0 ? `Note: client already paid ₦${Number(inv.paidAmount).toLocaleString('en-NG')} of this invoice, so only mention the remaining balance.` : ''}
${statusLine}
Desired tone: ${toneDesc}
${settings.paymentLink ? `Include this payment link naturally at the end: ${settings.paymentLink}` : ''}
Write the entire message in ${LANGUAGE_LABEL[settings.language] || 'English'}.

Write ONLY the WhatsApp message text, nothing else — no preamble, no quotation marks, no explanation. Keep it under 55 words. Sound natural and human, matching the tone described.`;
  const text = await callClaude(prompt);
  return text || staticMessage(inv, settings);
}
async function aiThankYou(inv, settings) {
  const prompt = `You are helping a Nigerian business write a short, warm WhatsApp thank-you message to a client who just finished paying an invoice in full.

Client name: ${inv.clientName}
Invoice number: ${inv.invoiceNo}
Amount paid in total: ${fmt(inv.amount)}
Write the entire message in ${LANGUAGE_LABEL[settings.language] || 'English'}.

Write ONLY the WhatsApp message text, nothing else. Keep it under 40 words. Sound genuinely appreciative and human.`;
  const text = await callClaude(prompt);
  return text || staticThankYou(inv);
}
async function aiDailySummary(stats, settings) {
  const prompt = `Write a short, encouraging end-of-day WhatsApp message a Nigerian business owner would send to themselves, summarizing their business today.

Today's sales total: ${fmt(stats.todayRevenue)} from ${stats.saleCount} sale(s)
Today's expenses: ${fmt(stats.todayExpenses)}
Net profit today (sales minus cost of goods minus expenses): ${fmt(stats.net)}
Total still owed to them by customers: ${fmt(stats.outstanding)}
Overdue amount: ${fmt(stats.overdue)}
Write the entire message in ${LANGUAGE_LABEL[settings.language] || 'English'}.

Write ONLY the message text, nothing else. Keep it under 55 words, warm and motivating.`;
  const text = await callClaude(prompt);
  return text || `Today: ${fmt(stats.todayRevenue)} in sales, ${fmt(stats.todayExpenses)} in expenses, ${fmt(stats.net)} profit. ${fmt(stats.outstanding)} still owed to you. Keep going! 💪`;
}

async function aiAdvice(question, ctx, settings) {
  const prompt = `You are a practical, experienced business advisor helping a small business owner in Nigeria/West Africa. Give specific, actionable advice grounded in their actual numbers below — never generic platitudes.

Business snapshot:
- Profit today: ${fmt(ctx.trueProfitToday)}
- Sales today: ${fmt(ctx.todayRevenue)} from ${ctx.saleCount} sale(s)
- Expenses today: ${fmt(ctx.todayExpenses)}
- Sales this week (last 7 days): ${fmt(ctx.weekTotal)}
- Total owed to them by customers: ${fmt(ctx.outstanding)}
- Of which overdue: ${fmt(ctx.overdue)}
- Invoices needing urgent follow-up right now: ${ctx.needsAttentionCount}

Owner's question: "${question}"

Answer in 3-5 short bullet points. Reference the actual numbers above where it strengthens the advice. Plain, encouraging, practical language suited to a West African small business owner — no jargon, no fluff. Write the entire answer in ${LANGUAGE_LABEL[settings.language] || 'English'}. Start straight with the advice, no preamble.`;
  const text = await callClaude(prompt);
  return text || "Couldn't reach the advisor right now — check your connection and try again.";
}
function resizeImage(file, maxWidth = 320, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = reader.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

function resizeImageToBlob(file, maxWidth = 500, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process image'))), 'image/jpeg', quality);
      };
      img.onerror = reject; img.src = reader.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

async function sbUploadImage(accessToken, blob, path) {
  const res = await fetch(`${SB_URL}/storage/v1/object/product-images/${path}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'image/jpeg' },
    body: blob,
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Image upload failed.'); }
  return `${SB_URL}/storage/v1/object/public/product-images/${path}`;
}

function LockScreen({ pin, onUnlock }) {
  const [entry, setEntry] = useState('');
  const [shake, setShake] = useState(false);
  const press = (d) => {
    if (entry.length >= 4) return;
    const next = entry + d; setEntry(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === pin) onUnlock();
        else { setShake(true); setTimeout(() => { setShake(false); setEntry(''); }, 400); }
      }, 120);
    }
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: C.bg, color: C.ink }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center mb-5" style={{ background: C.copperSoft }}>
        <Lock size={15} style={{ color: C.copper }} />
      </div>
      <div className="text-[15px] font-medium mb-1">Enter your PIN</div>
      <div className="text-xs mb-9" style={{ color: C.inkFaint }}>To open Xorla</div>
      <div className={`flex gap-3.5 mb-10 ${shake ? 'animate-pulse' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-full transition-colors" style={{ background: i < entry.length ? C.copper : 'transparent', border: `1.5px solid ${i < entry.length ? C.copper : C.lineStrong}` }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-[240px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)} className="aspect-square rounded-full text-base font-medium" style={{ color: C.ink }}>{d}</button>
        ))}
        <div />
        <button onClick={() => press('0')} className="aspect-square rounded-full text-base font-medium" style={{ color: C.ink }}>0</button>
        <div />
      </div>
    </div>
  );
}

function XorlaMark({ size = 30 }) {
  const id = 'xg-' + size;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`${id}a`} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0B3B35" />
          <stop offset="100%" stopColor="#12645A" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="88" y1="12" x2="14" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0E7A6E" />
          <stop offset="100%" stopColor="#2CEBD6" />
        </linearGradient>
      </defs>
      <path d="M11 13 L37 13 L89 83 L65 83 Z" fill={`url(#${id}a)`} />
      <path d="M89 13 L63 13 L11 83 L35 83 Z" fill={`url(#${id}b)`} />
      <path d="M77 5 L95 5 L95 18 L83 18 Z" fill="#FFB020" />
    </svg>
  );
}

function AuthScreen({ onDone }) {
  const [step, setStep] = useState('role'); // role | owner | staff | code | forgot
  const [mode, setMode] = useState('login'); // login | signup
  const [form, setForm] = useState({ business: '', email: '', password: '', code: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newBusinessCode, setNewBusinessCode] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const field = { background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.ink };

  const wrap = (title, subtitle, content) => (
    <div className="lg:flex h-[100dvh] overflow-hidden relative" style={{ background: `radial-gradient(circle at 25% 20%, ${C.surface} 0%, ${C.bg} 55%)`, color: C.ink }}>
      <div className="xorla-orb xorla-pulse" style={{ width: 420, height: 420, top: '-10%', left: '-8%', background: C.sage, opacity: 0.16 }} />
      <div className="xorla-orb" style={{ width: 360, height: 360, bottom: '-12%', right: '-6%', background: C.copper, opacity: 0.13 }} />

      {/* Left brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative z-10">
        <div className="xorla-fade-up flex flex-col items-center">
          <div style={{ filter: `drop-shadow(0 0 24px ${C.sageSoft})` }}><XorlaMark size={60} /></div>
          <div className="text-[32px] font-extrabold mt-4 cx-display" style={{ letterSpacing: '-0.01em', background: `linear-gradient(135deg, ${C.ink}, ${C.sage})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Xorla</div>
          <div className="text-[13.5px] mt-2 mb-10" style={{ color: C.inkFaint }}>Run your business. Grow your future.</div>

          <div className="xorla-float w-full max-w-[320px] rounded-2xl p-5" style={{ background: 'rgba(19,50,44,0.55)', backdropFilter: 'blur(20px)', border: `1px solid ${C.lineStrong}`, boxShadow: `0 20px 60px -12px rgba(0,0,0,0.6), 0 0 40px -8px ${C.sageSoft}` }}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] uppercase tracking-wide" style={{ color: C.inkFaint }}>Profit today</div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full xorla-pulse" style={{ background: C.sage }} />
                <span className="text-[9.5px] font-medium" style={{ color: C.sage }}>Live</span>
              </div>
            </div>
            <div className="cx-mono text-[28px] font-extrabold mb-3">₦42,500</div>
            <div className="flex items-end gap-1.5 h-14">
              {[40, 65, 50, 80, 55, 90, 70].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm xorla-bar" style={{ height: `${h}%`, background: i === 5 ? C.sage : C.line, animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
              <span className="text-[11px]" style={{ color: C.inkFaint }}>Owed to you</span>
              <span className="cx-mono text-[13px] font-semibold" style={{ color: C.copper }}>₦18,200</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-1/2 h-full overflow-y-auto flex items-center justify-center px-6 py-8 relative z-10">
        <div className="w-full max-w-[380px] xorla-fade-up">
          <div className="flex flex-col items-center mb-7 lg:hidden">
            <div style={{ filter: `drop-shadow(0 0 20px ${C.sageSoft})` }}><XorlaMark size={40} /></div>
            <div className="text-[20px] font-extrabold mt-2.5 cx-display" style={{ letterSpacing: '-0.01em' }}>Xorla</div>
            <div className="text-[11px] mt-1" style={{ color: C.inkFaint }}>Run your business. Grow your future.</div>
          </div>
          <div className="rounded-2xl p-6" style={{ background: 'rgba(15,41,37,0.7)', backdropFilter: 'blur(24px)', border: `1px solid ${C.lineStrong}`, boxShadow: '0 24px 70px -16px rgba(0,0,0,0.65)' }}>
            {title && <div className="text-[18px] font-semibold cx-display mb-1">{title}</div>}
            {subtitle && <div className="text-[12.5px] mb-5" style={{ color: C.inkFaint }}>{subtitle}</div>}
            {content}
          </div>
        </div>
      </div>
    </div>
  );

  if (step === 'role') {
    return wrap("Who's opening Xorla?", 'This decides what you\'ll see next.', (
      <>
        <button onClick={() => setStep('owner')} className="w-full rounded-xl p-4 mb-2.5 text-left transition-all hover:border-opacity-100 active:scale-[0.98]" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }} onMouseEnter={(e) => e.currentTarget.style.borderColor = C.sage} onMouseLeave={(e) => e.currentTarget.style.borderColor = C.line}>
          <div className="text-[13.5px] font-semibold">I'm the business owner</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: C.inkFaint }}>Full dashboard — sales, invoices, expenses, team, and advice.</div>
        </button>
        <button onClick={() => setStep('staff')} className="w-full rounded-xl p-4 text-left transition-all active:scale-[0.98]" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }} onMouseEnter={(e) => e.currentTarget.style.borderColor = C.copper} onMouseLeave={(e) => e.currentTarget.style.borderColor = C.line}>
          <div className="text-[13.5px] font-semibold">I'm a sales rep / staff</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: C.inkFaint }}>Straight to recording sales — nothing else.</div>
        </button>
      </>
    ));
  }

  if (step === 'forgot') {
    const sendReset = async () => {
      setError(''); setLoading(true);
      try {
        await sbRecover(form.email.trim());
        setResetSent(true);
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    };
    return wrap('Reset your password', "We'll email you a link to set a new one.", (
      <>
        <button onClick={() => { setStep('role'); setResetSent(false); setError(''); }} className="flex items-center gap-1 text-[12px] mb-4" style={{ color: C.inkFaint }}><ChevronLeft size={14} /> Back</button>
        {error && <div className="text-[12px] rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(226,98,75,0.12)', color: '#E2A090' }}>{error}</div>}
        {resetSent ? (
          <div className="rounded-xl p-4 text-[13px] leading-relaxed" style={{ background: C.sageSoft, color: C.sage }}>
            Check <strong>{form.email}</strong> for a reset link. Open it on this device, set a new password, then come back and log in.
          </div>
        ) : (
          <>
            <input type="email" placeholder="Your email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none mb-4" style={field} />
            <button disabled={loading || !form.email} onClick={sendReset} className="w-full rounded-xl py-3 text-[13.5px] font-semibold transition-transform active:scale-[0.98]" style={{ background: C.sage, color: C.bg, opacity: loading ? 0.6 : 1, boxShadow: `0 12px 28px -8px ${C.sage}66` }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        )}
      </>
    ));
  }

  if (step === 'code') {
    return wrap('Your business code', "Share this with your staff — it's how they join your business, not a password.", (
      <>
        <div className="rounded-xl p-5 mb-5 text-center" style={{ background: C.surfaceRaised, border: `1px solid ${C.sage}` }}>
          <div className="cx-mono text-[28px] font-extrabold tracking-[0.1em]" style={{ color: C.sage }}>{newBusinessCode}</div>
        </div>
        <button onClick={() => onDone()} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.sage, color: C.bg, boxShadow: `0 12px 28px -8px ${C.sage}66` }}>Continue to my dashboard</button>
      </>
    ));
  }

  if (step === 'staff') {
    const submitStaff = async () => {
      setError(''); setLoading(true);
      try {
        if (mode === 'signup') {
          const pwErr = passwordError(form.password);
          if (pwErr) throw new Error(pwErr);
        }
        let auth;
        if (mode === 'login') {
          auth = await sbSignIn(form.email.trim(), form.password);
        } else {
          auth = await sbSignUp(form.email.trim(), form.password);
          if (!auth.access_token) throw new Error('Account created, but no session came back — check that email confirmation is turned off in Supabase.');
          await sbRpc('join_business_as_staff', auth.access_token, { p_business_code: form.code.trim().toUpperCase(), p_name: form.name.trim() });
        }
        await saveSession({ access_token: auth.access_token, refresh_token: auth.refresh_token, user_id: auth.user.id });
        const ok = await onDone();
        if (!ok) throw new Error("Logged in, but couldn't load your business. Please try again.");
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    };
    return wrap('Join your business', mode === 'login' ? 'Log back in.' : "Enter your employer's business code to join.", (
      <>
        <button onClick={() => setStep('role')} className="flex items-center gap-1 text-[12px] mb-4" style={{ color: C.inkFaint }}><ChevronLeft size={14} /> Back</button>
        {error && <div className="text-[12px] rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(226,98,75,0.12)', color: '#E2A090' }}>{error}</div>}
        <div className="space-y-2.5 mb-4">
          {mode === 'signup' && (
            <>
              <input type="text" placeholder="Business code (from your employer)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none uppercase" style={field} />
              <input type="text" placeholder="Your full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none" style={field} />
            </>
          )}
          <input type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none" style={field} />
          <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none" style={field} />
          {mode === 'signup' && form.password.length > 0 && (
            <div className="text-[11px] pl-0.5" style={{ color: isPasswordValid(form.password) ? C.sage : C.inkFaint }}>
              {isPasswordValid(form.password) ? '✓ ' : ''}At least 6 characters
            </div>
          )}
        </div>
        <button disabled={loading || !form.email || !form.password || (mode === 'signup' && (!form.code || !form.name))} onClick={submitStaff} className="w-full rounded-xl py-3 text-[13.5px] font-semibold mb-4 transition-transform active:scale-[0.98]" style={{ background: C.sage, color: C.bg, opacity: loading ? 0.6 : 1, boxShadow: `0 12px 28px -8px ${C.sage}66` }}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Join business'}
        </button>
        <div className="text-center text-[12.5px]" style={{ color: C.inkFaint }}>
          {mode === 'login' ? "First time? " : 'Already joined? '}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="font-semibold" style={{ color: C.sage }}>{mode === 'login' ? 'Join with a code' : 'Log in'}</button>
        </div>
        {mode === 'login' && (
          <div className="text-center text-[12px] mt-2">
            <button onClick={() => { setStep('forgot'); setError(''); }} style={{ color: C.inkFaint }}>Forgot password?</button>
          </div>
        )}
      </>
    ));
  }

  // step === 'owner'
  const submitOwner = async () => {
    setError(''); setLoading(true);
    try {
      if (mode === 'signup') {
        const pwErr = passwordError(form.password);
        if (pwErr) throw new Error(pwErr);
      }
      let auth;
      if (mode === 'login') {
        auth = await sbSignIn(form.email.trim(), form.password);
        await saveSession({ access_token: auth.access_token, refresh_token: auth.refresh_token, user_id: auth.user.id });
        const ok = await onDone();
        if (!ok) throw new Error("Logged in, but couldn't load your business. Please try again.");
      } else {
        auth = await sbSignUp(form.email.trim(), form.password);
        if (!auth.access_token) throw new Error('Account created, but no session came back — check that email confirmation is turned off in Supabase.');
        const result = await sbRpc('create_owner_business', auth.access_token, { business_name: form.business.trim() });
        const row = Array.isArray(result) ? result[0] : result;
        await saveSession({ access_token: auth.access_token, refresh_token: auth.refresh_token, user_id: auth.user.id });
        setNewBusinessCode(row.out_business_code);
        setStep('code');
      }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return wrap(mode === 'login' ? 'Welcome back' : 'Create your account', mode === 'login' ? 'Log in to see how your business is doing.' : 'Takes less than a minute to get started.', (
    <>
      <button onClick={() => setStep('role')} className="flex items-center gap-1 text-[12px] mb-4" style={{ color: C.inkFaint }}><ChevronLeft size={14} /> Back</button>
      {error && <div className="text-[12px] rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(226,98,75,0.12)', color: '#E2A090' }}>{error}</div>}
      <div className="space-y-2.5 mb-4">
        {mode === 'signup' && (
          <input type="text" placeholder="Business name" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none" style={field} />
        )}
        <input type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none" style={field} />
        <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none" style={field} />
        {mode === 'signup' && form.password.length > 0 && (
          <div className="text-[11px] pl-0.5" style={{ color: isPasswordValid(form.password) ? C.sage : C.inkFaint }}>
            {isPasswordValid(form.password) ? '✓ ' : ''}At least 6 characters
          </div>
        )}
      </div>
      <button disabled={loading || !form.email || !form.password || (mode === 'signup' && !form.business)} onClick={submitOwner} className="w-full rounded-xl py-3 text-[13.5px] font-semibold mb-4 transition-transform active:scale-[0.98]" style={{ background: C.sage, color: C.bg, opacity: loading ? 0.6 : 1, boxShadow: `0 12px 28px -8px ${C.sage}66` }}>
        {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
      </button>
      <div className="text-center text-[12.5px]" style={{ color: C.inkFaint }}>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="font-semibold" style={{ color: C.sage }}>{mode === 'login' ? 'Sign up' : 'Log in'}</button>
      </div>
      {mode === 'login' && (
        <div className="text-center text-[12px] mt-2">
          <button onClick={() => { setStep('forgot'); setError(''); }} style={{ color: C.inkFaint }}>Forgot password?</button>
        </div>
      )}
    </>
  ));
}

function ResetPasswordScreen({ accessToken, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const field = { background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.ink };

  const submit = async () => {
    setError('');
    if (password.length < 6) { setError('Password should be at least 6 characters.'); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    try {
      await sbSetNewPassword(accessToken, password);
      setDone(true);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 relative overflow-hidden" style={{ background: `radial-gradient(circle at 25% 20%, ${C.surface} 0%, ${C.bg} 55%)`, color: C.ink }}>
      <div className="xorla-orb xorla-pulse" style={{ width: 380, height: 380, top: '-10%', left: '-8%', background: C.sage, opacity: 0.14 }} />
      <div className="w-full max-w-[380px] xorla-fade-up relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div style={{ filter: `drop-shadow(0 0 20px ${C.sageSoft})` }}><XorlaMark size={44} /></div>
          <div className="text-[22px] font-extrabold mt-3 cx-display" style={{ letterSpacing: '-0.01em' }}>Xorla</div>
        </div>
        <div className="rounded-2xl p-6" style={{ background: 'rgba(15,41,37,0.7)', backdropFilter: 'blur(24px)', border: `1px solid ${C.lineStrong}`, boxShadow: '0 24px 70px -16px rgba(0,0,0,0.65)' }}>
          {done ? (
            <>
              <div className="text-[17px] font-semibold cx-display mb-1">Password updated</div>
              <div className="text-[12.5px] mb-5" style={{ color: C.inkFaint }}>You can log in with your new password now.</div>
              <button onClick={onDone} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.sage, color: C.bg, boxShadow: `0 12px 28px -8px ${C.sage}66` }}>Continue to log in</button>
            </>
          ) : (
            <>
              <div className="text-[17px] font-semibold cx-display mb-1">Set a new password</div>
              <div className="text-[12.5px] mb-5" style={{ color: C.inkFaint }}>Choose something you'll remember.</div>
              {error && <div className="text-[12px] rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(226,98,75,0.12)', color: '#E2A090' }}>{error}</div>}
              <div className="space-y-2.5 mb-4">
                <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none" style={field} />
                <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none" style={field} />
              </div>
              <button disabled={loading || !password || !confirm} onClick={submit} className="w-full rounded-xl py-3 text-[13.5px] font-semibold transition-transform active:scale-[0.98]" style={{ background: C.sage, color: C.bg, opacity: loading ? 0.6 : 1, boxShadow: `0 12px 28px -8px ${C.sage}66` }}>
                {loading ? 'Saving…' : 'Set new password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChaseIt() {
  const [tab, setTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({ paymentLink: '', tone: 'friendly', customInstructions: '', language: 'english', ownerPhone: '', pin: '', staffList: [], activeStaff: '', businessName: '', loggedIn: false, role: 'owner', allowStaffExpenses: false, businessCode: '' });
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [resetToken, setResetToken] = useState(() => {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash || '';
    if (hash.includes('type=recovery')) {
      const params = new URLSearchParams(hash.substring(1));
      return params.get('access_token');
    }
    return null;
  });
  const [locked, setLocked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', costPrice: '', sellingPrice: '', imageBlob: null, imagePreview: null });
  const [productImageUploading, setProductImageUploading] = useState(false);
  const [previousTab, setPreviousTab] = useState('overview');
  const [draft, setDraft] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [savingSale, setSavingSale] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [salesViewDate, setSalesViewDate] = useState(todayKey());
  const [expensesViewDate, setExpensesViewDate] = useState(todayKey());
  const [error, setError] = useState('');
  const [form, setForm] = useState({ clientName: '', invoiceNo: '', amount: '', dueDate: '', phone: '' });
  const [saleForm, setSaleForm] = useState({ item: '', amount: '', cost: '', fullyPaid: true, paidNow: '', customerName: '', customerPhone: '', dueDate: '', photo: null, productId: '', quantity: '1' });
  const [expenseForm, setExpenseForm] = useState({ item: '', amount: '', category: 'Restock' });
  const [payingId, setPayingId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const [aiTexts, setAiTexts] = useState({});
  const [thankYouTexts, setThankYouTexts] = useState({});
  const [thankYouLoadingId, setThankYouLoadingId] = useState(null);
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [advisorQuestion, setAdvisorQuestion] = useState('');
  const [advisorAnswer, setAdvisorAnswer] = useState('');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newStaffName, setNewStaffName] = useState('');

  const persistSettings = useCallback(async (pin) => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ pin })); } catch (e) {} }, []);

  const fetchProfileAndBusiness = useCallback(async (accessToken, userId) => {
    const profiles = await sbRest('profiles', { accessToken, query: `?id=eq.${userId}&select=*` });
    if (!profiles.length) throw new Error('Profile not found');
    const profile = profiles[0];
    const businesses = await sbRest('businesses', { accessToken, query: `?id=eq.${profile.business_id}&select=*` });
    const business = businesses[0];
    let staffRoster = [];
    if (profile.role === 'owner') {
      const staffRows = await sbRest('profiles', { accessToken, query: `?business_id=eq.${profile.business_id}&role=eq.staff&select=name` });
      staffRoster = staffRows.map((r) => r.name);
    }
    return { profile, business, staffRoster };
  }, []);

  const loadBusinessData = useCallback(async (accessToken) => {
    try {
      const [salesRows, invoiceRows, expenseRows, productRows] = await Promise.all([
        sbRest('sales', { accessToken, query: '?select=*&order=sold_at.desc' }),
        sbRest('invoices', { accessToken, query: '?select=*&order=created_at.desc' }),
        sbRest('expenses', { accessToken, query: '?select=*&order=spent_at.desc' }),
        sbRest('products', { accessToken, query: '?select=*&order=name.asc' }),
      ]);
      setSales(salesRows.map(fromSbSale));
      setInvoices(invoiceRows.map(fromSbInvoice));
      setExpenses(expenseRows.map(fromSbExpense));
      setProducts(productRows.map(fromSbProduct));
    } catch (e) {
      console.error('Loading business data failed:', e);
    }
  }, []);

  // Quietly refresh in the background every 20s so new entries from teammates show up without a manual reload
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => { loadBusinessData(session.access_token); }, 20000);
    return () => clearInterval(interval);
  }, [session, loadBusinessData]);

  const applySession = useCallback((sess, profile, business, staffRoster) => {
    setSession(sess);
    setSettings((prev) => ({
      ...prev,
      loggedIn: true,
      role: profile.role,
      activeStaff: profile.name,
      businessName: business.name,
      businessId: business.id,
      businessCode: business.business_code,
      paymentLink: business.payment_link || '',
      tone: business.reminder_tone || 'friendly',
      customInstructions: business.custom_instructions || '',
      language: business.language || 'english',
      ownerPhone: business.owner_phone || '',
      allowStaffExpenses: !!business.allow_staff_expenses,
      staffList: staffRoster,
    }));
    loadBusinessData(sess.access_token);
  }, [loadBusinessData]);

  const bootstrap = useCallback(async () => {
    setAuthLoading(true);
    const sess = await loadSession();
    if (!sess) { setAuthLoading(false); return false; }
    try {
      const { profile, business, staffRoster } = await fetchProfileAndBusiness(sess.access_token, sess.user_id);
      applySession(sess, profile, business, staffRoster);
      setAuthLoading(false);
      return true;
    } catch (e) {
      try {
        const refreshed = await sbRefresh(sess.refresh_token);
        const newSess = { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, user_id: refreshed.user.id };
        await saveSession(newSess);
        const { profile, business, staffRoster } = await fetchProfileAndBusiness(newSess.access_token, newSess.user_id);
        applySession(newSess, profile, business, staffRoster);
        setAuthLoading(false);
        return true;
      } catch (e2) {
        console.error('Bootstrap failed:', e, e2);
        await clearSession();
        setAuthLoading(false);
        return false;
      }
    }
  }, [fetchProfileAndBusiness, applySession]);

  const logout = useCallback(async () => {
    if (session) { try { await fetch(`${SB_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${session.access_token}` } }); } catch (e) {} }
    await clearSession();
    setSession(null);
    setSettings((prev) => ({ ...prev, loggedIn: false, role: 'owner', activeStaff: '', businessName: '', staffList: [] }));
  }, [session]);

  useEffect(() => {
    (async () => {
      let loadedSettings = null;
      try { const v = localStorage.getItem(SETTINGS_KEY); if (v) { loadedSettings = JSON.parse(v); setSettings((prev) => ({ ...prev, pin: loadedSettings.pin || '' })); } } catch (e) {}
      if (loadedSettings?.pin) setLocked(true);
      setLoaded(true);
      await bootstrap();
    })();
  }, []);

  const knownCustomers = useMemo(() => {
    const map = new Map();
    invoices.forEach((inv) => {
      if (inv.clientName && inv.clientName !== 'Customer' && !map.has(inv.clientName.toLowerCase())) {
        map.set(inv.clientName.toLowerCase(), { name: inv.clientName, phone: inv.phone || '' });
      }
    });
    return Array.from(map.values());
  }, [invoices]);
  function matchCustomers(query) {
    if (!query || query.length < 1) return [];
    return knownCustomers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3);
  }

  const addInvoice = async () => {
    setError('');
    if (!form.clientName || !form.invoiceNo || !form.amount || !form.dueDate) { setError('Fill in client, invoice number, amount, and due date.'); return; }
    if (savingInvoice) return;
    setSavingInvoice(true);
    try {
      const rows = await sbRest('invoices', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, logged_by: session.user_id, logged_by_name: settings.activeStaff || '', client_name: form.clientName, invoice_no: form.invoiceNo, amount: form.amount, paid_amount: 0, due_date: form.dueDate, phone: form.phone } });
      setInvoices((prev) => [fromSbInvoice(rows[0]), ...prev]);
      setForm({ clientName: '', invoiceNo: '', amount: '', dueDate: '', phone: '' });
      setShowForm(false);
    } catch (e) { setError(e.message); } finally { setSavingInvoice(false); }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setPhotoUploading(true);
    try { const dataUrl = await resizeImage(file); setSaleForm((f) => ({ ...f, photo: dataUrl })); }
    catch (err) { console.error(err); } finally { setPhotoUploading(false); }
  };

  const addSale = async () => {
    if (!saleForm.item || !saleForm.amount) return;
    if (savingSale) return;
    setSavingSale(true);
    const owed = saleForm.fullyPaid ? 0 : Math.max(0, Number(saleForm.amount) - Number(saleForm.paidNow || 0));
    try {
      const saleRows = await sbRest('sales', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, logged_by: session.user_id, logged_by_name: settings.activeStaff || '', item: saleForm.item, amount: saleForm.amount, cost: saleForm.cost || 0, owed } });
      const newSale = fromSbSale(saleRows[0]);
      setSales((prev) => [newSale, ...prev]);

      if (owed > 0) {
        const defaultDue = new Date(); defaultDue.setDate(defaultDue.getDate() + 7);
        const invRows = await sbRest('invoices', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, logged_by: session.user_id, logged_by_name: settings.activeStaff || '', client_name: saleForm.customerName || 'Customer', invoice_no: `SALE-${newSale.id.slice(-5)}`, amount: saleForm.amount, paid_amount: saleForm.paidNow || 0, due_date: saleForm.dueDate || defaultDue.toISOString().slice(0, 10), phone: saleForm.customerPhone } });
        setInvoices((prev) => [fromSbInvoice(invRows[0]), ...prev]);
      }
      setSaleForm({ item: '', amount: '', cost: '', fullyPaid: true, paidNow: '', customerName: '', customerPhone: '', dueDate: '', photo: null });
      setShowSaleForm(false);
    } catch (e) { console.error(e); alert(e.message); } finally { setSavingSale(false); }
  };
  const removeSale = async (id) => {
    try { await sbRest(`sales?id=eq.${id}`, { method: 'DELETE', accessToken: session.access_token }); setSales((prev) => prev.filter((s) => s.id !== id)); }
    catch (e) { alert(e.message); }
  };

  const addExpense = async () => {
    if (!expenseForm.item || !expenseForm.amount) return;
    if (savingExpense) return;
    setSavingExpense(true);
    try {
      const rows = await sbRest('expenses', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, logged_by: session.user_id, logged_by_name: settings.activeStaff || '', item: expenseForm.item, amount: expenseForm.amount, category: expenseForm.category } });
      setExpenses((prev) => [fromSbExpense(rows[0]), ...prev]);
      setExpenseForm({ item: '', amount: '', category: 'Restock' });
      setShowExpenseForm(false);
    } catch (e) { alert(e.message); } finally { setSavingExpense(false); }
  };
  const removeExpense = async (id) => {
    try { await sbRest(`expenses?id=eq.${id}`, { method: 'DELETE', accessToken: session.access_token }); setExpenses((prev) => prev.filter((e) => e.id !== id)); }
    catch (e) { alert(e.message); }
  };

  const handleProductPhotoSelect = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setProductImageUploading(true);
    try {
      const [preview, blob] = await Promise.all([resizeImage(file, 200, 0.6), resizeImageToBlob(file, 500, 0.7)]);
      setProductForm((f) => ({ ...f, imagePreview: preview, imageBlob: blob }));
    } catch (err) { console.error(err); } finally { setProductImageUploading(false); }
  };

  const addProduct = async () => {
    if (!productForm.name || !productForm.sellingPrice) return;
    if (savingProduct) return;
    setSavingProduct(true);
    try {
      let imageUrl = null;
      if (productForm.imageBlob) {
        const path = `${settings.businessId}/${Date.now()}.jpg`;
        imageUrl = await sbUploadImage(session.access_token, productForm.imageBlob, path);
      }
      const rows = await sbRest('products', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, name: productForm.name, cost_price: productForm.costPrice || 0, selling_price: productForm.sellingPrice, image_url: imageUrl } });
      setProducts((prev) => [fromSbProduct(rows[0]), ...prev].sort((a, b) => a.name.localeCompare(b.name)));
      setProductForm({ name: '', costPrice: '', sellingPrice: '', imageBlob: null, imagePreview: null });
      setShowProductForm(false);
    } catch (e) { alert(e.message); } finally { setSavingProduct(false); }
  };
  const removeProduct = async (id) => {
    try { await sbRest(`products?id=eq.${id}`, { method: 'DELETE', accessToken: session.access_token }); setProducts((prev) => prev.filter((p) => p.id !== id)); }
    catch (e) { alert(e.message); }
  };

  // Picking a product (or changing quantity) auto-fills the sale's item/amount/cost — still editable afterward for discounts
  const applyProductToSale = (productId, qtyRaw) => {
    const qty = Math.max(1, Number(qtyRaw) || 1);
    if (!productId) { setSaleForm((f) => ({ ...f, productId: '', quantity: String(qty) })); return; }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setSaleForm((f) => ({
      ...f,
      productId,
      quantity: String(qty),
      item: qty > 1 ? `${product.name} ×${qty}` : product.name,
      amount: (Number(product.sellingPrice) * qty).toString(),
      cost: (Number(product.costPrice) * qty).toString(),
    }));
  };

  const recordPayment = async (id) => {
    const amt = Number(payAmount); if (!amt || amt <= 0) return;
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    const newPaid = Math.min(Number(inv.amount), Number(inv.paidAmount || 0) + amt);
    try {
      await sbRest(`invoices?id=eq.${id}`, { method: 'PATCH', accessToken: session.access_token, body: { paid_amount: newPaid } });
      setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, paidAmount: newPaid } : i));
      setPayingId(null); setPayAmount('');
    } catch (e) { alert(e.message); }
  };
  const undoPaid = async (id) => {
    try { await sbRest(`invoices?id=eq.${id}`, { method: 'PATCH', accessToken: session.access_token, body: { paid_amount: 0 } }); setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, paidAmount: 0 } : i)); }
    catch (e) { alert(e.message); }
  };
  const removeInvoice = async (id) => {
    try { await sbRest(`invoices?id=eq.${id}`, { method: 'DELETE', accessToken: session.access_token }); setInvoices((prev) => prev.filter((i) => i.id !== id)); }
    catch (e) { alert(e.message); }
  };

  const copyMessage = async (inv) => {
    const msg = aiTexts[inv.id] || staticMessage(inv, settings);
    try { await navigator.clipboard.writeText(msg); setCopiedId(inv.id); setTimeout(() => setCopiedId(null), 1800); } catch (e) {}
  };
  const generateAI = async (inv) => {
    setAiLoadingId(inv.id);
    try { const msg = await aiMessage(inv, settings); setAiTexts((prev) => ({ ...prev, [inv.id]: msg })); }
    catch (e) { console.error(e); } finally { setAiLoadingId(null); }
  };
  const generateThankYou = async (inv) => {
    setThankYouLoadingId(inv.id);
    try { const msg = await aiThankYou(inv, settings); setThankYouTexts((prev) => ({ ...prev, [inv.id]: msg })); }
    catch (e) { console.error(e); } finally { setThankYouLoadingId(null); }
  };
  const updateSettings = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if ('pin' in patch) persistSettings(patch.pin);
    if (session && next.businessId && settings.role === 'owner') {
      const bizPatch = {};
      if ('paymentLink' in patch) bizPatch.payment_link = patch.paymentLink;
      if ('tone' in patch) bizPatch.reminder_tone = patch.tone;
      if ('customInstructions' in patch) bizPatch.custom_instructions = patch.customInstructions;
      if ('language' in patch) bizPatch.language = patch.language;
      if ('ownerPhone' in patch) bizPatch.owner_phone = patch.ownerPhone;
      if ('allowStaffExpenses' in patch) bizPatch.allow_staff_expenses = patch.allowStaffExpenses;
      if (Object.keys(bizPatch).length) {
        sbRest(`businesses?id=eq.${next.businessId}`, { method: 'PATCH', accessToken: session.access_token, body: bizPatch }).catch((e) => console.error('Settings sync failed:', e));
      }
    }
  };
  const savePin = () => { if (newPin.length !== 4) return; updateSettings({ pin: newPin }); setNewPin(''); };
  const removePin = () => { updateSettings({ pin: '' }); setNewPin(''); };

  const todaySales = sales.filter((s) => s.dateKey === todayKey());
  const todayRevenue = todaySales.reduce((a, s) => a + Number(s.amount), 0);
  const todayCOGS = todaySales.reduce((a, s) => a + Number(s.cost || 0), 0);
  const todayExpensesList = expenses.filter((e) => e.dateKey === todayKey());
  const todayExpenses = todayExpensesList.reduce((a, e) => a + Number(e.amount), 0);
  const trueProfitToday = todayRevenue - todayCOGS - todayExpenses;

  const viewedSales = sales.filter((s) => s.dateKey === salesViewDate);
  const viewedSalesTotal = viewedSales.reduce((a, s) => a + Number(s.amount), 0);
  const viewedExpensesList = expenses.filter((e) => e.dateKey === expensesViewDate);
  const viewedExpensesTotal = viewedExpensesList.reduce((a, e) => a + Number(e.amount), 0);
  const shiftDate = (dateKey, days) => { const d = new Date(dateKey + 'T00:00:00'); d.setDate(d.getDate() + days); return d.toLocaleDateString('sv-SE'); };
  const formatViewDate = (dateKey) => dateKey === todayKey() ? 'Today' : new Date(dateKey + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toLocaleDateString('sv-SE');
    const total = sales.filter((s) => s.dateKey === key).reduce((a, s) => a + Number(s.amount), 0);
    return { key, label: d.toLocaleDateString('en-GB', { weekday: 'short' })[0], total };
  });
  const maxDay = Math.max(1, ...last7.map((d) => d.total));
  const weekTotal = last7.reduce((a, d) => a + d.total, 0);
  const yesterdayTotal = last7[5]?.total || 0;
  const todayVsYesterday = yesterdayTotal > 0 ? Math.round(((todayRevenue - yesterdayTotal) / yesterdayTotal) * 100) : (todayRevenue > 0 ? 100 : 0);

  const totals = invoices.reduce((acc, inv) => {
    const bal = balanceOf(inv);
    acc.recovered += Number(inv.paidAmount || 0);
    if (bal > 0) { acc.outstanding += bal; const status = computeStatus(inv); if (status === 'overdue' || status === 'critical') acc.overdue += bal; }
    return acc;
  }, { outstanding: 0, overdue: 0, recovered: 0 });

  const sortedInvoices = [...invoices]
    .filter((inv) => !searchQuery || inv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const order = { critical: 0, overdue: 1, dueToday: 2, soon: 3, upcoming: 4, paid: 5 };
      return order[computeStatus(a)] - order[computeStatus(b)];
    });

  const recentActivity = [...todaySales.map((s) => ({ ...s, kind: 'sale' })), ...todayExpensesList.map((e) => ({ ...e, kind: 'expense' }))]
    .sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5);
  const needsAttention = sortedInvoices.filter((i) => ['critical', 'overdue', 'dueToday'].includes(computeStatus(i))).slice(0, 4);

  const generateSummary = async () => {
    setSummaryLoading(true);
    try { const text = await aiDailySummary({ todayRevenue, saleCount: todaySales.length, todayExpenses, net: trueProfitToday, outstanding: totals.outstanding, overdue: totals.overdue }, settings); setSummaryText(text); }
    catch (e) { console.error(e); } finally { setSummaryLoading(false); }
  };

  const runAdvisor = async (q) => {
    if (!q || !q.trim()) return;
    setAdvisorQuestion(q);
    setAdvisorLoading(true);
    setAdvisorAnswer('');
    try {
      const ctx = { trueProfitToday, todayRevenue, saleCount: todaySales.length, todayExpenses, weekTotal, outstanding: totals.outstanding, overdue: totals.overdue, needsAttentionCount: needsAttention.length };
      const text = await aiAdvice(q, ctx, settings);
      setAdvisorAnswer(text);
    } catch (e) {
      console.error(e);
      setAdvisorAnswer(`Couldn't get an answer just now — ${e.message}. Give it another try.`);
    } finally { setAdvisorLoading(false); }
  };

  const fontStyle = (
    <style>{`
      .cx-display { font-family: 'Inter', sans-serif; letter-spacing: -0.015em; }
      .cx-mono { font-family: 'Inter', sans-serif; font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }
      .cx-body { font-family: 'Inter', sans-serif; }
      .cx-ghost:active { opacity: 0.6; }
    `}</style>
  );

  if (resetToken) {
    return <>{fontStyle}<ResetPasswordScreen accessToken={resetToken} onDone={() => { window.location.hash = ''; setResetToken(null); }} /></>;
  }
  if (!loaded || authLoading) return <div className="min-h-screen flex items-center justify-center cx-body" style={{ background: C.bg, color: C.inkDim }}>{fontStyle}<div className="text-sm">Loading…</div></div>;
  if (!session) {
    return <>{fontStyle}<AuthScreen onDone={bootstrap} /></>;
  }
  if (locked && settings.pin) return <>{fontStyle}<LockScreen pin={settings.pin} onUnlock={() => setLocked(false)} /></>;

  const field = { background: C.bg, border: `1px solid ${C.line}`, color: C.ink };
  const card = { background: 'rgba(19,50,44,0.55)', backdropFilter: 'blur(16px)', border: `1px solid ${C.lineStrong}`, boxShadow: '0 1px 1px rgba(0,0,0,0.2), 0 16px 40px -20px rgba(0,0,0,0.7)' };

  if (settings.role === 'staff') {
    const myTodaySales = sales.filter((s) => s.dateKey === todayKey() && s.loggedBy === settings.activeStaff);
    const myTodayTotal = myTodaySales.reduce((a, s) => a + Number(s.amount), 0);
    return (
      <div className="min-h-screen cx-body" style={{ background: C.bg, color: C.ink }}>
        {fontStyle}
        <div className="max-w-md mx-auto px-5 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <XorlaMark size={26} />
              <span className="cx-display text-[17px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>Xorla</span>
            </div>
            <button onClick={logout} className="flex items-center gap-1.5 text-[12px]" style={{ color: C.inkFaint }}><LogOut size={13} /> Log out</button>
          </div>

          <div className="mb-6">
            <div className="text-[12px]" style={{ color: C.inkFaint }}>Logging in as</div>
            <div className="text-[20px] font-bold cx-display">{settings.activeStaff}</div>
          </div>

          <div className="rounded-2xl p-4 mb-5" style={card}>
            <div className="text-[10.5px] uppercase tracking-wide mb-1" style={{ color: C.inkFaint }}>Your sales today</div>
            <div className="cx-mono text-[26px] font-extrabold">{fmt(myTodayTotal)}</div>
            <div className="text-[11.5px] mt-0.5" style={{ color: C.inkFaint }}>{myTodaySales.length} sale{myTodaySales.length !== 1 ? 's' : ''} logged</div>
          </div>

          <div className="rounded-2xl p-5 mb-5" style={card}>
            <div className="text-[13.5px] font-semibold cx-display mb-3">Record a sale</div>
            <div className="space-y-2.5">
              {products.length > 0 && (
                <div className="rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                  <div className="text-[10.5px] font-medium mb-1.5" style={{ color: C.inkDim }}>PICK A PRODUCT (OPTIONAL)</div>
                  <div className="flex gap-2">
                    <select value={saleForm.productId} onChange={(e) => applyProductToSale(e.target.value, saleForm.quantity)} className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ ...field, colorScheme: 'dark' }}>
                      <option value="">Choose a product…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.sellingPrice)}</option>)}
                    </select>
                    {saleForm.productId && (
                      <input type="number" min="1" value={saleForm.quantity} onChange={(e) => applyProductToSale(saleForm.productId, e.target.value)} className="w-16 rounded-lg px-2 py-2 text-sm text-center outline-none cx-mono" style={field} />
                    )}
                  </div>
                </div>
              )}
              <input type="text" placeholder="What did you sell?" value={saleForm.item} onChange={(e) => setSaleForm({ ...saleForm, item: e.target.value, productId: '' })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
              <div className="flex gap-2">
                <input type="number" placeholder="Sold for (₦)" value={saleForm.amount} onChange={(e) => setSaleForm({ ...saleForm, amount: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                <input type="number" placeholder="Cost (optional)" value={saleForm.cost} onChange={(e) => setSaleForm({ ...saleForm, cost: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
              </div>
              <div>
                <div className="text-[11.5px] font-medium mb-1.5" style={{ color: C.inkDim }}>Did they pay the full amount?</div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setSaleForm({ ...saleForm, fullyPaid: true })} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={saleForm.fullyPaid ? { background: C.sage, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>Yes, in full</button>
                  <button type="button" onClick={() => setSaleForm({ ...saleForm, fullyPaid: false })} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={!saleForm.fullyPaid ? { background: C.rust, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>No, owes some</button>
                </div>
              </div>
              {!saleForm.fullyPaid && (
                <div className="rounded-lg p-3 space-y-2.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                  <input type="number" placeholder="How much did they pay now (₦)?" value={saleForm.paidNow} onChange={(e) => setSaleForm({ ...saleForm, paidNow: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none cx-mono" style={field} />
                  <input type="text" placeholder="Customer's name" value={saleForm.customerName} onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={field} />
                  <div className="flex gap-2">
                    <input type="tel" placeholder="Phone (for reminder)" value={saleForm.customerPhone} onChange={(e) => setSaleForm({ ...saleForm, customerPhone: e.target.value })} className="w-1/2 rounded-lg px-3 py-2 text-sm outline-none" style={field} />
                    <input type="date" placeholder="Due date" value={saleForm.dueDate} onChange={(e) => setSaleForm({ ...saleForm, dueDate: e.target.value })} className="w-1/2 rounded-lg px-3 py-2 text-sm outline-none" style={field} />
                  </div>
                  <div className="text-[10.5px]" style={{ color: C.inkFaint }}>Leave the date blank and we'll default to 7 days from now.</div>
                  {saleForm.amount && (
                    <div className="text-xs font-medium" style={{ color: C.rust }}>Balance owed: {fmt(Math.max(0, Number(saleForm.amount) - Number(saleForm.paidNow || 0)))}</div>
                  )}
                </div>
              )}
              <button onClick={addSale} disabled={savingSale} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingSale ? 0.6 : 1 }}>{savingSale ? "Saving…" : "Save sale"}</button>
            </div>
          </div>

          {settings.allowStaffExpenses && (
            <div className="rounded-2xl p-5 mb-5" style={card}>
              <div className="text-[13.5px] font-semibold cx-display mb-3">Record an expense</div>
              <div className="space-y-2.5">
                <input type="text" placeholder="What did you spend on?" value={expenseForm.item} onChange={(e) => setExpenseForm({ ...expenseForm, item: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                <input type="number" placeholder="Amount (₦)" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                <button onClick={addExpense} disabled={savingExpense} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ border: `1px solid ${C.rust}`, color: C.rust, opacity: savingExpense ? 0.6 : 1 }}>{savingExpense ? "Saving…" : "Save expense"}</button>
              </div>
            </div>
          )}

          {myTodaySales.length > 0 && (
            <div className="rounded-2xl p-4" style={card}>
              <div className="text-[10.5px] uppercase tracking-wide mb-3" style={{ color: C.inkFaint }}>Logged today</div>
              <div className="space-y-2.5">
                {myTodaySales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-[12.5px]">
                    <span style={{ color: C.inkDim }}>{s.item} · {s.time}</span>
                    <span className="cx-mono font-medium">{fmt(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (tab === 'settings' && draft) {
    return (
      <div className="min-h-screen cx-body" style={{ background: C.bg, color: C.ink }}>
        {fontStyle}
        <div className="max-w-2xl mx-auto min-h-screen flex flex-col">
          <div className="flex items-center gap-3 p-5 pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
            <button onClick={() => setTab(previousTab)} className="shrink-0" style={{ color: C.inkDim }}><ChevronLeft size={20} /></button>
            <div>
              <div className="text-[15px] font-semibold cx-display mb-0.5">Business settings</div>
              <div className="text-[12px]" style={{ color: C.inkFaint }}>Set these up once — nothing changes until you save.</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>PAYMENT LINK</div>
              <input type="text" placeholder="Paystack link, bank details, etc." value={draft.paymentLink} onChange={(e) => setDraft({ ...draft, paymentLink: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
              <div className="text-[11px] mt-1.5" style={{ color: C.inkFaint }}>Added to the end of every reminder message automatically.</div>
            </div>

            <div>
              <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>REMINDER TONE</div>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button key={t.id} onClick={() => setDraft({ ...draft, tone: t.id })} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={draft.tone === t.id ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{t.label}</button>
                ))}
              </div>
              {draft.tone === 'custom' && (
                <textarea placeholder="e.g. Always mention we value the long relationship." value={draft.customInstructions} onChange={(e) => setDraft({ ...draft, customInstructions: e.target.value })} rows={2} className="w-full mt-2 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none" style={field} />
              )}
            </div>

            <div>
              <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>LANGUAGE</div>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((l) => (
                  <button key={l.id} onClick={() => setDraft({ ...draft, language: l.id })} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={draft.language === l.id ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{l.label}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>YOUR WHATSAPP NUMBER</div>
              <input type="tel" placeholder="e.g. 2348012345678" value={draft.ownerPhone} onChange={(e) => setDraft({ ...draft, ownerPhone: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
            </div>

            <div className="pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>TEAM</div>
              <div className="text-[11px] mb-2" style={{ color: C.inkFaint }}>Share this code with staff — they enter it once to join your business for good.</div>
              <div className="flex items-center justify-between rounded-xl px-3.5 py-3 mb-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                <span className="cx-mono text-[16px] font-bold tracking-[0.1em]" style={{ color: C.sage }}>{settings.businessCode}</span>
                <button onClick={() => navigator.clipboard?.writeText(settings.businessCode)} className="text-[11px] font-medium" style={{ color: C.copper }}>Copy</button>
              </div>
              {settings.staffList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {settings.staffList.map((name) => (
                    <div key={name} className="px-2.5 py-1 rounded-full text-[12px]" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}>{name}</div>
                  ))}
                </div>
              ) : (
                <div className="text-[11.5px]" style={{ color: C.inkFaint }}>No staff have joined yet.</div>
              )}
            </div>

            <div className="pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <div className="text-[13px] font-medium mb-0.5">Let staff log expenses</div>
                  <div className="text-[11px]" style={{ color: C.inkFaint }}>Off by default — turn on only if reps genuinely spend cash on your behalf (transport, restock, etc).</div>
                </div>
                <button onClick={() => setDraft({ ...draft, allowStaffExpenses: !draft.allowStaffExpenses })} className="shrink-0 w-11 h-6 rounded-full relative" style={{ background: draft.allowStaffExpenses ? C.sage : C.line }}>
                  <div className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ background: C.bg, left: draft.allowStaffExpenses ? '22px' : '2px' }} />
                </button>
              </div>
            </div>

            <div className="pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="text-[11px] font-medium mb-1.5" style={{ color: C.inkDim }}>APP LOCK (PIN)</div>
              <div className="text-[11px] mb-2.5 leading-relaxed" style={{ color: C.inkFaint }}>
                Only the owner sets this — it's a quick screen lock for this device, so a staff member or customer picking up the phone can't browse your sales and money owed. It doesn't affect your login; it's separate and only lives on this device.
              </div>
              <div className="flex gap-2">
                <input type="tel" maxLength={4} placeholder="4-digit PIN" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                <button onClick={() => { if (newPin.length === 4) { setDraft({ ...draft, pin: newPin }); setNewPin(''); } }} disabled={newPin.length !== 4} className="px-4 rounded-xl text-[12px] font-medium" style={{ background: C.copper, color: C.bg, opacity: newPin.length === 4 ? 1 : 0.35 }}>{draft.pin ? 'Change' : 'Set'}</button>
                {draft.pin && <button onClick={() => setDraft({ ...draft, pin: '' })} className="px-3 rounded-xl text-[12px] font-medium" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}>Remove</button>}
              </div>
              {draft.pin && <div className="text-[11px] mt-1.5" style={{ color: C.sage }}>PIN staged: will be set when you save.</div>}
            </div>

            <div className="pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
              <button onClick={logout} className="text-[12.5px] font-medium" style={{ color: C.rust }}>Log out</button>
            </div>
          </div>

          <div className="flex gap-2.5 p-5 pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
            <button onClick={() => setTab(previousTab)} className="flex-1 rounded-xl py-2.5 text-[13px] font-medium" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>Cancel</button>
            <button onClick={() => { updateSettings(draft); setTab(previousTab); }} className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold" style={{ background: C.sage, color: C.bg }}>Save settings</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex cx-body relative overflow-x-hidden" style={{ background: `radial-gradient(circle at 15% 0%, ${C.surface} 0%, ${C.bg} 45%)`, color: C.ink }}>
      {fontStyle}
      <div className="xorla-orb" style={{ width: 500, height: 500, top: '-15%', left: '20%', background: C.sage, opacity: 0.06, position: 'fixed' }} />

      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 min-h-screen px-5 py-6 relative z-10" style={{ borderRight: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2.5 mb-9 px-1">
          <div style={{ filter: `drop-shadow(0 0 12px ${C.sageSoft})` }}><XorlaMark size={30} /></div>
          <div className="cx-display text-[19px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>Xorla</div>
        </div>

        <nav className="space-y-1 mb-6">
          {[
            { id: 'overview', label: 'Overview', Icon: Home },
            { id: 'sales', label: 'Sales', Icon: ShoppingBag },
            { id: 'products', label: 'Products', Icon: Package },
            { id: 'expenses', label: 'Expenses', Icon: Receipt },
            { id: 'invoices', label: 'Invoices', Icon: Wallet },
            { id: 'advisor', label: 'Oga', Icon: Lightbulb },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-medium" style={tab === id ? { background: C.sageSoft, color: C.sage } : { color: C.inkDim }}>
              <Icon size={16} /> {label}
              {id === 'invoices' && needsAttention.length > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: C.rust, color: C.bg }}>{needsAttention.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="rounded-2xl p-4 mb-6" style={{ background: C.copperSoft, border: `1px solid rgba(255,176,32,0.18)` }}>
          <Sparkles size={16} style={{ color: C.copper }} className="mb-2" />
          <div className="text-[12.5px] font-semibold mb-1">Let AI chase for you</div>
          <div className="text-[11px] leading-relaxed mb-3" style={{ color: C.inkDim }}>Reminders that sound like you, in the language your customers speak.</div>
          <button onClick={() => setTab('invoices')} className="w-full rounded-lg py-2 text-[11.5px] font-semibold" style={{ background: C.copper, color: C.bg }}>Try it</button>
        </div>

        <div className="mt-auto space-y-1">
          {settings.pin && (
            <button onClick={() => setLocked(true)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium" style={{ color: C.inkFaint }}><Lock size={15} /> Lock app</button>
          )}
          <button onClick={() => { setDraft({ ...settings }); setPreviousTab(tab); setTab('settings'); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium" style={{ color: tab === 'settings' ? C.copper : C.inkDim }}><Settings size={15} /> Settings</button>
          <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium" style={{ color: C.inkFaint }}><LogOut size={15} /> Log out</button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 relative z-10">

        {/* Mobile brand bar */}
        <div className="lg:hidden flex items-center justify-between px-5 pt-6 pb-1">
          <div className="flex items-center gap-2">
            <XorlaMark size={26} />
            <span className="cx-display text-[17px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>Xorla</span>
          </div>
          <div className="flex items-center gap-4">
            {settings.pin && <button onClick={() => setLocked(true)} style={{ color: C.inkFaint }}><Lock size={16} /></button>}
            <button onClick={() => { setDraft({ ...settings }); setPreviousTab(tab); setTab('settings'); }} style={{ color: tab === 'settings' ? C.copper : C.inkDim }}><Settings size={18} /></button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 lg:py-8 pb-24">

          {/* Top bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="hidden lg:block text-[17px] font-semibold cx-display capitalize mr-auto">
              {tab === 'overview' ? `Welcome back${settings.businessName ? ', ' + settings.businessName : ''}` : tab}
            </div>
            <div className="relative flex-1 lg:flex-none lg:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.inkFaint }} />
              <input type="text" placeholder="Search invoices…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-xl pl-9 pr-3 py-2 text-[12.5px] outline-none" style={field} />
            </div>
            {settings.staffList.length > 0 && (
              <div className="hidden md:flex items-center gap-1.5">
                {settings.staffList.slice(0, 3).map((name) => (
                  <button key={name} onClick={() => updateSettings({ activeStaff: name })} className="px-2.5 py-1.5 rounded-full text-[11px] font-medium" style={settings.activeStaff === name ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{name}</button>
                ))}
              </div>
            )}
            <button className="relative hidden sm:flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>
              <Bell size={15} />
              {needsAttention.length > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: C.rust }} />}
            </button>
            <button
              onClick={() => { if (tab === 'expenses') setShowExpenseForm(true); else if (tab === 'invoices') setShowForm(true); else { setTab('sales'); setShowSaleForm(true); } }}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold shrink-0" style={{ background: C.sage, color: C.bg }}>
              <Plus size={14} /> New
            </button>
          </div>

          {/* Mobile staff switcher */}
          {settings.staffList.length > 0 && (
            <div className="md:hidden flex items-center gap-2 mb-5 overflow-x-auto">
              <span className="text-[11px] shrink-0" style={{ color: C.inkFaint }}>Logging as</span>
              {settings.staffList.map((name) => (
                <button key={name} onClick={() => updateSettings({ activeStaff: name })} className="px-2.5 py-1 rounded-full text-[11.5px] font-medium shrink-0" style={settings.activeStaff === name ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{name}</button>
              ))}
            </div>
          )}

          {/* Mobile nav */}
          <div className="lg:hidden flex gap-5 mb-2 overflow-x-auto" style={{ borderBottom: `1px solid ${C.line}` }}>
            {[
              { id: 'overview', label: 'Overview', Icon: Home },
              { id: 'sales', label: 'Sales', Icon: ShoppingBag },
              { id: 'products', label: 'Products', Icon: Package },
              { id: 'expenses', label: 'Expenses', Icon: Receipt },
              { id: 'invoices', label: 'Invoices', Icon: Wallet },
              { id: 'advisor', label: 'Oga', Icon: Lightbulb },
            ].map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)} className="flex items-center gap-1.5 pb-3 text-[13px] font-medium shrink-0" style={{ color: tab === id ? C.ink : C.inkFaint, borderBottom: tab === id ? `2px solid ${C.copper}` : '2px solid transparent', marginBottom: '-1px' }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <div className="lg:hidden text-[11px] mb-6 mt-3" style={{ color: C.inkFaint }}>Sold something? Use Sales. Billing without a sale now? Use Invoices.</div>

          {/* ============ OVERVIEW TAB ============ */}
          {tab === 'overview' && (
            <>
              <div className="lg:grid lg:grid-cols-5 lg:gap-5 mb-5 xorla-fade-up">
                <div className="lg:col-span-3 rounded-2xl p-5 mb-4 lg:mb-0" style={card}>
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="text-[10.5px] font-medium tracking-wide uppercase mb-1.5" style={{ color: C.inkFaint }}>Profit today</div>
                      <div className="cx-mono text-[32px] leading-none font-extrabold" style={{ color: trueProfitToday >= 0 ? C.ink : C.rust }}>{fmt(trueProfitToday)}</div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold mt-1" style={todayVsYesterday >= 0 ? { background: C.sageSoft, color: C.sage } : { background: C.rustSoft, color: C.rust }}>
                      {todayVsYesterday >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {Math.abs(todayVsYesterday)}%
                    </div>
                  </div>
                  <div className="text-[11px] mb-2" style={{ color: C.inkFaint }}>vs yesterday · sales trend, last 7 days</div>
                  <div style={{ height: 130 }} className="-ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={last7} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={C.sage} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={C.sage} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <YAxis hide domain={[0, 'dataMax + 1']} />
                        <Tooltip contentStyle={{ background: C.surfaceRaised, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 12 }} labelStyle={{ color: C.inkDim }} formatter={(v) => [fmt(v), 'Sales']} />
                        <Area type="monotone" dataKey="total" stroke={C.sage} strokeWidth={2} fill="url(#salesFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between mt-1 px-1">
                    {last7.map((d) => <span key={d.key} className="text-[9.5px]" style={{ color: C.inkFaint }}>{d.label}</span>)}
                  </div>
                </div>

                <div className="lg:col-span-2 rounded-2xl p-5" style={card}>
                  <div className="text-[13.5px] font-semibold cx-display mb-3">Quick add sale</div>
                  <div className="space-y-2.5">
                    {products.length > 0 && (
                      <div className="flex gap-2">
                        <select value={saleForm.productId} onChange={(e) => applyProductToSale(e.target.value, saleForm.quantity)} className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none" style={{ ...field, colorScheme: 'dark' }}>
                          <option value="">Pick a product…</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.sellingPrice)}</option>)}
                        </select>
                        {saleForm.productId && (
                          <input type="number" min="1" value={saleForm.quantity} onChange={(e) => applyProductToSale(saleForm.productId, e.target.value)} className="w-14 rounded-xl px-2 py-2.5 text-sm text-center outline-none cx-mono" style={field} />
                        )}
                      </div>
                    )}
                    <input type="text" placeholder="What did you sell?" value={saleForm.item} onChange={(e) => setSaleForm({ ...saleForm, item: e.target.value, productId: '' })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                    <div className="flex gap-2">
                      <input type="number" placeholder="Sold for (₦)" value={saleForm.amount} onChange={(e) => setSaleForm({ ...saleForm, amount: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                      <input type="number" placeholder="Cost (optional)" value={saleForm.cost} onChange={(e) => setSaleForm({ ...saleForm, cost: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                    </div>
                    <button onClick={addSale} disabled={savingSale} className="w-full rounded-xl py-2.5 text-[13px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingSale ? 0.6 : 1 }}>{savingSale ? "Saving…" : "Save sale"}</button>
                    <button onClick={() => { setTab('sales'); setShowSaleForm(true); }} className="w-full text-[11.5px] font-medium" style={{ color: C.inkFaint }}>Need to record a partial payment? →</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-2xl p-4" style={card}>
                  <div className="text-[10.5px] font-medium tracking-wide uppercase mb-3" style={{ color: C.inkFaint }}>Recent activity</div>
                  {recentActivity.length === 0 ? (
                    <div className="text-[12px] py-4 text-center" style={{ color: C.inkFaint }}>Nothing logged yet today.</div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivity.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-[12.5px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: item.kind === 'sale' ? C.sageSoft : C.rustSoft }}>
                              {item.kind === 'sale' ? <ShoppingBag size={11} style={{ color: C.sage }} /> : <Receipt size={11} style={{ color: C.rust }} />}
                            </div>
                            <span className="truncate" style={{ color: C.inkDim }}>{item.item}</span>
                          </div>
                          <span className="cx-mono font-medium shrink-0" style={{ color: item.kind === 'sale' ? C.sage : C.rust }}>{item.kind === 'sale' ? '+' : '-'}{fmt(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl p-4" style={card}>
                  <div className="text-[10.5px] font-medium tracking-wide uppercase mb-3" style={{ color: C.inkFaint }}>Needs attention</div>
                  {needsAttention.length === 0 ? (
                    <div className="text-[12px] py-4 text-center" style={{ color: C.inkFaint }}>Nothing urgent — nice.</div>
                  ) : (
                    <div className="space-y-3">
                      {needsAttention.map((inv) => {
                        const u = URGENCY[computeStatus(inv)];
                        return (
                          <button key={inv.id} onClick={() => setTab('invoices')} className="w-full flex items-center justify-between text-[12.5px] text-left">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: u.color }} />
                              <span className="truncate" style={{ color: C.inkDim }}>{inv.clientName}</span>
                            </div>
                            <span className="cx-mono font-medium shrink-0">{fmt(balanceOf(inv))}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl p-4" style={card}>
                  <div className="text-[10.5px] font-medium tracking-wide uppercase mb-3" style={{ color: C.inkFaint }}>This week</div>
                  <div className="cx-mono text-[20px] font-bold mb-3">{fmt(weekTotal)}</div>
                  <div className="flex items-end gap-1 h-10">
                    {last7.map((d, i) => (
                      <div key={d.key} className="flex-1 rounded-sm" style={{ height: `${Math.max(10, (d.total / maxDay) * 100)}%`, background: i === 6 ? C.sage : C.line }} />
                    ))}
                  </div>
                </div>
              </div>

              {!summaryText ? (
                <button onClick={generateSummary} disabled={summaryLoading} className="w-full mt-5 flex items-center justify-center gap-2 text-[13px] font-medium py-3 rounded-2xl" style={{ color: C.copper, border: `1px solid ${C.line}` }}>
                  {summaryLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {summaryLoading ? 'Writing your summary…' : "Write today's WhatsApp summary"}
                </button>
              ) : (
                <div className="rounded-2xl p-4 mt-5" style={card}>
                  <div className="text-[13px] leading-relaxed mb-3" style={{ color: C.inkDim }}>{summaryText}</div>
                  <div className="flex gap-2">
                    {settings.ownerPhone ? (
                      <a href={`https://wa.me/${settings.ownerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(summaryText)}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-medium" style={{ background: C.sage, color: C.bg }}>
                        <Send size={12} /> Send to my WhatsApp
                      </a>
                    ) : (
                      <div className="flex-1 text-[11px] py-2 text-center" style={{ color: C.inkFaint }}>Add your WhatsApp number in Settings to send this.</div>
                    )}
                    <button onClick={() => setSummaryText('')} className="px-3 rounded-xl text-[12px]" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}>Redo</button>
                  </div>
                </div>
              )}
            </>
          )}


        {tab === 'sales' && (
          <>
            <div className="rounded-2xl p-5 mb-4" style={card}>
              <div className="flex items-end justify-between mb-4">
                <div>
                  <div className="text-[10.5px] font-medium tracking-wide uppercase mb-1" style={{ color: C.inkFaint }}>Today</div>
                  <div className="cx-mono text-[26px] font-bold leading-none">{fmt(todayRevenue)}</div>
                </div>
                <div className="text-[12px]" style={{ color: C.inkFaint }}>{todaySales.length} sale{todaySales.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="flex items-end justify-between gap-1.5 h-14">
                {last7.map((d, i) => (
                  <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full rounded-full" style={{ height: `${Math.max(8, (d.total / maxDay) * 100)}%`, background: i === 6 ? C.copper : C.line, minHeight: '4px' }} />
                    <div className="text-[9px]" style={{ color: C.inkFaint }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {settings.staffList.length > 0 && todaySales.length > 0 && (
              <div className="rounded-2xl p-4 mb-4" style={card}>
                <div className="text-[10.5px] font-medium tracking-wide uppercase mb-2.5" style={{ color: C.inkFaint }}>Today by team member</div>
                <div className="space-y-2">
                  {settings.staffList.map((name) => {
                    const total = todaySales.filter((s) => s.loggedBy === name).reduce((a, s) => a + Number(s.amount), 0);
                    const count = todaySales.filter((s) => s.loggedBy === name).length;
                    if (count === 0) return null;
                    return (
                      <div key={name} className="flex items-center justify-between text-[12.5px]">
                        <span style={{ color: C.inkDim }}>{name} · {count} sale{count !== 1 ? 's' : ''}</span>
                        <span className="cx-mono font-medium">{fmt(total)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!showSaleForm ? (
              <button onClick={() => setShowSaleForm(true)} className="w-full mb-6 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold" style={{ background: C.copper, color: C.bg }}><Plus size={16} /> Add sale</button>
            ) : (
              <div className="rounded-2xl p-5 mb-6 space-y-3" style={card}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[14px] font-semibold cx-display">New sale</div>
                  <button onClick={() => setShowSaleForm(false)} style={{ color: C.inkFaint }}><X size={17} /></button>
                </div>
                {products.length > 0 && (
                  <div className="rounded-xl p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                    <div className="text-[10.5px] font-medium mb-1.5" style={{ color: C.inkDim }}>PICK A PRODUCT (OPTIONAL)</div>
                    <div className="flex gap-2">
                      <select value={saleForm.productId} onChange={(e) => applyProductToSale(e.target.value, saleForm.quantity)} className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ ...field, colorScheme: 'dark' }}>
                        <option value="">Choose a product…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.sellingPrice)}</option>)}
                      </select>
                      {saleForm.productId && (
                        <input type="number" min="1" value={saleForm.quantity} onChange={(e) => applyProductToSale(saleForm.productId, e.target.value)} className="w-16 rounded-lg px-2 py-2 text-sm text-center outline-none cx-mono" style={field} />
                      )}
                    </div>
                    {saleForm.productId && <div className="text-[10.5px] mt-1.5" style={{ color: C.inkFaint }}>Amount and cost below are auto-filled — still editable if you're giving a discount.</div>}
                  </div>
                )}
                <input type="text" placeholder="What did you sell?" value={saleForm.item} onChange={(e) => setSaleForm({ ...saleForm, item: e.target.value, productId: '' })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                <div className="flex gap-2">
                  <input type="number" placeholder="Sold for (₦)" value={saleForm.amount} onChange={(e) => setSaleForm({ ...saleForm, amount: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                  <input type="number" placeholder="Cost (optional)" value={saleForm.cost} onChange={(e) => setSaleForm({ ...saleForm, cost: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                </div>
                <label className="flex items-center gap-2 text-[12.5px] font-medium py-2.5 px-3.5 rounded-xl cursor-pointer" style={{ border: `1px dashed ${C.line}`, color: C.inkDim }}>
                  <Camera size={14} />{photoUploading ? 'Adding photo…' : saleForm.photo ? 'Photo added — tap to change' : 'Add a photo (optional)'}
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
                </label>
                {saleForm.photo && <img src={saleForm.photo} alt="Item" className="rounded-xl" style={{ maxHeight: '90px' }} />}

                <div className="pt-1">
                  <div className="flex gap-1.5">
                    <button onClick={() => setSaleForm({ ...saleForm, fullyPaid: true })} className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold" style={saleForm.fullyPaid ? { background: C.sage, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>Paid in full</button>
                    <button onClick={() => setSaleForm({ ...saleForm, fullyPaid: false })} className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold" style={!saleForm.fullyPaid ? { background: C.rust, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>Still owes some</button>
                  </div>
                </div>

                {!saleForm.fullyPaid && (
                  <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                    <div className="text-[11px]" style={{ color: C.inkFaint }}>Shows up in Invoices so Xorla can remind them for you.</div>
                    <input type="number" placeholder="How much did they pay now (₦)?" value={saleForm.paidNow} onChange={(e) => setSaleForm({ ...saleForm, paidNow: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.ink }} />
                    <div className="relative">
                      <input type="text" placeholder="Customer's name" value={saleForm.customerName} onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.ink }} />
                      {matchCustomers(saleForm.customerName).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {matchCustomers(saleForm.customerName).map((c) => (
                            <button key={c.name} onClick={() => setSaleForm({ ...saleForm, customerName: c.name, customerPhone: c.phone })} className="px-2.5 py-1 rounded-full text-[10.5px]" style={{ border: `1px solid ${C.line}`, color: C.copper }}>{c.name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input type="tel" placeholder="Phone" value={saleForm.customerPhone} onChange={(e) => setSaleForm({ ...saleForm, customerPhone: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.ink }} />
                      <input type="date" value={saleForm.dueDate} onChange={(e) => setSaleForm({ ...saleForm, dueDate: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.ink }} />
                    </div>
                    {saleForm.amount && <div className="text-[12.5px] font-medium" style={{ color: C.rust }}>Balance owed: {fmt(Math.max(0, Number(saleForm.amount) - Number(saleForm.paidNow || 0)))}</div>}
                  </div>
                )}
                <button onClick={addSale} disabled={savingSale} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingSale ? 0.6 : 1 }}>{savingSale ? "Saving…" : "Save sale"}</button>
              </div>
            )}

            <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
              <div className="text-[13px] font-semibold cx-display" style={{ color: C.inkDim }}>{formatViewDate(salesViewDate)}'s sales</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSalesViewDate(shiftDate(salesViewDate, -1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>‹</button>
                <input type="date" value={salesViewDate} max={todayKey()} onChange={(e) => e.target.value && setSalesViewDate(e.target.value)} className="rounded-lg px-2 py-1 text-[11.5px] outline-none" style={{ ...field, colorScheme: 'dark' }} />
                {salesViewDate !== todayKey() && <button onClick={() => setSalesViewDate(todayKey())} className="text-[11px] font-medium" style={{ color: C.sage }}>Today</button>}
                <button onClick={() => setSalesViewDate(shiftDate(salesViewDate, 1))} disabled={salesViewDate >= todayKey()} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.line}`, color: salesViewDate >= todayKey() ? C.inkFaint : C.inkDim, opacity: salesViewDate >= todayKey() ? 0.4 : 1 }}>›</button>
              </div>
            </div>
            {viewedSales.length > 0 && (
              <div className="text-[11px] mb-2.5" style={{ color: C.inkFaint }}>{fmt(viewedSalesTotal)} total · {viewedSales.length} sale{viewedSales.length !== 1 ? 's' : ''}</div>
            )}
            {viewedSales.length === 0 && <div className="text-center text-[13px] py-8 rounded-2xl" style={{ color: C.inkFaint, border: `1px dashed ${C.line}` }}>No sales logged that day.</div>}
            <div>
              {viewedSales.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between py-3" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                  <div className="flex items-center gap-3 min-w-0">
                    {s.photo && <img src={s.photo} alt={s.item} className="w-9 h-9 rounded-lg object-cover shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium truncate">{s.item}</div>
                      <div className="text-[11px] flex items-center gap-1.5" style={{ color: C.inkFaint }}>
                        {s.time}{s.loggedBy && <span>· {s.loggedBy}</span>}
                        {s.owed > 0 && <span style={{ color: C.rust }}>· {fmt(s.owed)} owed</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="cx-mono text-[13.5px] font-medium">{fmt(s.amount)}</div>
                    <button onClick={() => removeSale(s.id)} className="text-[11px]" style={{ color: C.inkFaint }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ============ PRODUCTS TAB ============ */}
        {tab === 'products' && (
          <>
            <div className="text-[12px] mb-4" style={{ color: C.inkFaint }}>Add what you sell once — pick it instantly when recording a sale, with cost and price auto-filled.</div>

            {!showProductForm ? (
              <button onClick={() => setShowProductForm(true)} className="w-full mb-6 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold" style={{ background: C.copper, color: C.bg }}><Plus size={16} /> Add product</button>
            ) : (
              <div className="rounded-2xl p-5 mb-6 space-y-3" style={card}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[14px] font-semibold cx-display">New product</div>
                  <button onClick={() => setShowProductForm(false)} style={{ color: C.inkFaint }}><X size={17} /></button>
                </div>
                <label className="flex items-center gap-2 text-[12.5px] font-medium py-2.5 px-3.5 rounded-xl cursor-pointer" style={{ border: `1px dashed ${C.line}`, color: C.inkDim }}>
                  <Camera size={14} />{productImageUploading ? 'Adding photo…' : productForm.imagePreview ? 'Photo added — tap to change' : 'Add a product photo (optional)'}
                  <input type="file" accept="image/*" onChange={handleProductPhotoSelect} className="hidden" />
                </label>
                {productForm.imagePreview && <img src={productForm.imagePreview} alt="" className="w-16 h-16 rounded-xl object-cover" />}
                <input type="text" placeholder="Product name" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                <div className="flex gap-2">
                  <input type="number" placeholder="Cost price (₦)" value={productForm.costPrice} onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                  <input type="number" placeholder="Selling price (₦)" value={productForm.sellingPrice} onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                </div>
                <button onClick={addProduct} disabled={savingProduct} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingProduct ? 0.6 : 1 }}>{savingProduct ? 'Saving…' : 'Save product'}</button>
              </div>
            )}

            <div className="text-[13px] font-semibold cx-display mb-2.5" style={{ color: C.inkDim }}>Your products</div>
            {products.length === 0 && <div className="text-center text-[13px] py-8 rounded-2xl" style={{ color: C.inkFaint, border: `1px dashed ${C.line}` }}>No products yet — add your first one above.</div>}
            <div>
              {products.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between py-3" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                  <div className="flex items-center gap-3 min-w-0">
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.bg }}><Package size={16} style={{ color: C.inkFaint }} /></div>}
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium truncate">{p.name}</div>
                      <div className="text-[11px]" style={{ color: C.inkFaint }}>Cost {fmt(p.costPrice)} · Sells {fmt(p.sellingPrice)}</div>
                    </div>
                  </div>
                  <button onClick={() => removeProduct(p.id)} className="text-[11px] shrink-0" style={{ color: C.inkFaint }}>Remove</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ============ EXPENSES TAB ============ */}
        {tab === 'expenses' && (
          <>
            <div className="rounded-2xl p-5 mb-6" style={card}>
              <div className="text-[10.5px] font-medium tracking-wide uppercase mb-1" style={{ color: C.inkFaint }}>Spent today</div>
              <div className="cx-mono text-[26px] font-bold leading-none" style={{ color: C.rust }}>{fmt(todayExpenses)}</div>
            </div>

            {!showExpenseForm ? (
              <button onClick={() => setShowExpenseForm(true)} className="w-full mb-6 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold" style={{ background: C.copper, color: C.bg }}><Plus size={16} /> Add expense</button>
            ) : (
              <div className="rounded-2xl p-5 mb-6 space-y-3" style={card}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[14px] font-semibold cx-display">New expense</div>
                  <button onClick={() => setShowExpenseForm(false)} style={{ color: C.inkFaint }}><X size={17} /></button>
                </div>
                <input type="text" placeholder="What did you spend on?" value={expenseForm.item} onChange={(e) => setExpenseForm({ ...expenseForm, item: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                <input type="number" placeholder="Amount (₦)" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setExpenseForm({ ...expenseForm, category: c })} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={expenseForm.category === c ? { background: C.rust, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{c}</button>
                  ))}
                </div>
                <button onClick={addExpense} disabled={savingExpense} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingExpense ? 0.6 : 1 }}>{savingExpense ? "Saving…" : "Save expense"}</button>
              </div>
            )}

            <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
              <div className="text-[13px] font-semibold cx-display" style={{ color: C.inkDim }}>{formatViewDate(expensesViewDate)}'s expenses</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setExpensesViewDate(shiftDate(expensesViewDate, -1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>‹</button>
                <input type="date" value={expensesViewDate} max={todayKey()} onChange={(e) => e.target.value && setExpensesViewDate(e.target.value)} className="rounded-lg px-2 py-1 text-[11.5px] outline-none" style={{ ...field, colorScheme: 'dark' }} />
                {expensesViewDate !== todayKey() && <button onClick={() => setExpensesViewDate(todayKey())} className="text-[11px] font-medium" style={{ color: C.sage }}>Today</button>}
                <button onClick={() => setExpensesViewDate(shiftDate(expensesViewDate, 1))} disabled={expensesViewDate >= todayKey()} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.line}`, color: expensesViewDate >= todayKey() ? C.inkFaint : C.inkDim, opacity: expensesViewDate >= todayKey() ? 0.4 : 1 }}>›</button>
              </div>
            </div>
            {viewedExpensesList.length > 0 && (
              <div className="text-[11px] mb-2.5" style={{ color: C.inkFaint }}>{fmt(viewedExpensesTotal)} total</div>
            )}
            {viewedExpensesList.length === 0 && <div className="text-center text-[13px] py-8 rounded-2xl" style={{ color: C.inkFaint, border: `1px dashed ${C.line}` }}>No expenses logged that day.</div>}
            <div>
              {viewedExpensesList.map((e, i) => (
                <div key={e.id} className="flex items-center justify-between py-3" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                  <div>
                    <div className="text-[13.5px] font-medium">{e.item}</div>
                    <div className="text-[11px]" style={{ color: C.inkFaint }}>{e.time} · {e.category}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="cx-mono text-[13.5px] font-medium" style={{ color: C.rust }}>-{fmt(e.amount)}</div>
                    <button onClick={() => removeExpense(e.id)} className="text-[11px]" style={{ color: C.inkFaint }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ============ INVOICES TAB ============ */}
        {tab === 'invoices' && (
          <>
            {!showForm ? (
              <button onClick={() => setShowForm(true)} className="w-full mb-6 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold" style={{ background: C.copper, color: C.bg }}><Plus size={16} /> Add invoice</button>
            ) : (
              <div className="rounded-2xl p-5 mb-6 space-y-3" style={card}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[14px] font-semibold cx-display">New invoice</div>
                  <button onClick={() => { setShowForm(false); setError(''); }} style={{ color: C.inkFaint }}><X size={17} /></button>
                </div>
                {error && <div className="text-[12px] rounded-xl px-3.5 py-2.5" style={{ background: C.rustSoft, color: '#E39C87' }}>{error}</div>}
                <div className="relative">
                  <input type="text" placeholder="Client name" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                  {matchCustomers(form.clientName).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {matchCustomers(form.clientName).map((c) => (
                        <button key={c.name} onClick={() => setForm({ ...form, clientName: c.name, phone: c.phone })} className="px-2.5 py-1 rounded-full text-[10.5px]" style={{ border: `1px solid ${C.line}`, color: C.copper }}>{c.name}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Invoice #" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                  <input type="number" placeholder="Amount (₦)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                </div>
                <div className="flex gap-2">
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                  <input type="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                </div>
                <button onClick={addInvoice} disabled={savingInvoice} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingInvoice ? 0.6 : 1 }}>{savingInvoice ? "Saving…" : "Save invoice"}</button>
              </div>
            )}

            <div className="flex items-baseline justify-between mb-3">
              <span className="text-[13px] font-semibold cx-display" style={{ color: C.inkDim }}>Invoices</span>
              <span className="cx-mono text-[11px]" style={{ color: C.inkFaint }}>{invoices.length} total</span>
            </div>
            {sortedInvoices.length === 0 && <div className="text-center text-[13px] py-10 rounded-2xl" style={{ color: C.inkFaint, border: `1px dashed ${C.line}` }}>No invoices yet.</div>}

            <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
              {sortedInvoices.map((inv) => {
                const status = computeStatus(inv);
                const u = URGENCY[status];
                const bal = balanceOf(inv);
                const paidPct = Math.min(100, Math.round(((Number(inv.paidAmount) || 0) / Number(inv.amount)) * 100));
                const message = aiTexts[inv.id] || staticMessage(inv, settings);
                const isPaid = status === 'paid';
                const thankMsg = thankYouTexts[inv.id] || staticThankYou(inv);
                return (
                  <div key={inv.id} className="rounded-2xl p-4 relative overflow-hidden" style={card}>
                    <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: u.color }} />
                    <div className="pl-2">
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="min-w-0">
                          <div className="font-medium text-[14px] truncate">{inv.clientName}</div>
                          <div className="text-[11.5px] mt-0.5" style={{ color: C.inkFaint }}>#{inv.invoiceNo} · due {new Date(inv.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="cx-mono text-[14px] font-semibold">{fmt(bal)}</div>
                          <div className="text-[11px] font-medium mt-0.5" style={{ color: u.color }}>{u.label}</div>
                        </div>
                      </div>

                      {inv.paidAmount > 0 && !isPaid && (
                        <div className="mb-2.5">
                          <div className="h-[3px] rounded-full overflow-hidden" style={{ background: C.bg }}><div className="h-full rounded-full" style={{ width: `${paidPct}%`, background: C.sage }} /></div>
                          <div className="text-[10.5px] mt-1" style={{ color: C.inkFaint }}>₦{Number(inv.paidAmount).toLocaleString('en-NG')} of {fmt(inv.amount)} paid</div>
                        </div>
                      )}

                      {isPaid ? (
                        <div className="rounded-xl p-3 mb-3" style={{ background: C.bg }}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-[10.5px] flex items-center gap-1 font-medium" style={{ color: C.sage }}><PartyPopper size={11} /> Fully paid</div>
                            <button onClick={() => generateThankYou(inv)} disabled={thankYouLoadingId === inv.id} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.copper }}>
                              {thankYouLoadingId === inv.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} AI rewrite
                            </button>
                          </div>
                          <div className="text-[12.5px] leading-relaxed" style={{ color: C.inkDim }}>{thankMsg}</div>
                        </div>
                      ) : (
                        <div className="rounded-xl p-3 mb-3" style={{ background: C.bg }}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-[10.5px]" style={{ color: C.inkFaint }}>{aiTexts[inv.id] ? '✓ Personalized' : "Message we'll send"}</div>
                            <button onClick={() => generateAI(inv)} disabled={aiLoadingId === inv.id} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.copper }}>
                              {aiLoadingId === inv.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} AI rewrite
                            </button>
                          </div>
                          <div className="text-[12.5px] leading-relaxed whitespace-pre-line" style={{ color: C.inkDim }}>{message}</div>
                        </div>
                      )}

                      {payingId === inv.id && (
                        <div className="flex gap-2 mb-3">
                          <input type="number" autoFocus placeholder={`Max ${fmt(bal)}`} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-[12.5px] outline-none cx-mono" style={field} />
                          <button onClick={() => recordPayment(inv.id)} className="px-3 rounded-xl text-[12px] font-medium" style={{ background: C.sage, color: C.bg }}>Save</button>
                          <button onClick={() => { setPayingId(null); setPayAmount(''); }} className="px-2" style={{ color: C.inkFaint }}><X size={14} /></button>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        {status === 'critical' && inv.phone && (
                          <a href={`tel:${inv.phone.replace(/[^0-9+]/g, '')}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-semibold" style={{ background: C.rust, color: C.bg }}>
                            <PhoneCall size={13} /> Call now
                          </a>
                        )}
                        {inv.phone && status !== 'critical' && (
                          <a href={`https://wa.me/${inv.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(isPaid ? thankMsg : message)}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-semibold" style={{ background: C.sage, color: C.bg }}>
                            <Phone size={13} /> {isPaid ? 'Send thanks' : 'WhatsApp'}
                          </a>
                        )}
                        {!isPaid && !inv.phone && (
                          <button onClick={() => copyMessage(inv)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-medium" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>
                            {copiedId === inv.id ? <><Check size={13} style={{ color: C.sage }} /> Copied</> : <><Copy size={13} /> Copy message</>}
                          </button>
                        )}
                        <div className="flex items-center gap-3 text-[11.5px]" style={{ color: C.inkDim }}>
                          {!isPaid && inv.phone && <button onClick={() => copyMessage(inv)}>{copiedId === inv.id ? 'Copied' : 'Copy'}</button>}
                          {!isPaid && payingId !== inv.id && <button onClick={() => setPayingId(inv.id)}>Payment</button>}
                          {isPaid && <button onClick={() => undoPaid(inv.id)}>Undo</button>}
                          <button onClick={() => removeInvoice(inv.id)} style={{ color: C.inkFaint }}>Remove</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {invoices.some((i) => computeStatus(i) === 'critical') && (
              <div className="mt-5 flex items-start gap-2.5 rounded-2xl p-4 text-[12.5px]" style={{ background: 'rgba(192,95,66,0.08)', border: `1px solid rgba(192,95,66,0.2)`, color: '#D9A08D' }}>
                <PhoneCall size={15} className="shrink-0 mt-0.5" style={{ color: C.rust }} />
                <div>Some invoices have had no response after several reminders. It's time for a real conversation.</div>
              </div>
            )}
          </>
        )}

        {/* ============ ADVISOR TAB ============ */}
        {tab === 'advisor' && (
          <div className="rounded-2xl p-5" style={card}>
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb size={16} style={{ color: C.copper }} />
              <div className="text-[15px] font-semibold cx-display">Oga</div>
            </div>
            <div className="text-[12px] mb-4" style={{ color: C.inkFaint }}>Your business advisor. Ask anything — answers are grounded in your real numbers, not generic tips.</div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {['How can I grow sales?', 'Why is my profit low?', 'Ideas to cut expenses', 'What should I focus on this week?'].map((q) => (
                <button key={q} onClick={() => runAdvisor(q)} disabled={advisorLoading} className="px-3 py-1.5 rounded-full text-[11.5px]" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>{q}</button>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Ask about your business…"
                value={advisorQuestion}
                onChange={(e) => setAdvisorQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runAdvisor(advisorQuestion); }}
                className="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                style={field}
              />
              <button onClick={() => runAdvisor(advisorQuestion)} disabled={advisorLoading || !advisorQuestion.trim()} className="px-4 rounded-xl text-[12.5px] font-semibold flex items-center gap-1.5" style={{ background: C.copper, color: C.bg, opacity: advisorLoading || !advisorQuestion.trim() ? 0.4 : 1 }}>
                {advisorLoading ? <Loader2 size={14} className="animate-spin" /> : 'Ask'}
              </button>
            </div>

            {advisorAnswer && !advisorLoading && (
              <div className="rounded-xl p-4 text-[13px] leading-relaxed whitespace-pre-line" style={{ background: C.surfaceRaised, color: C.inkDim }}>{advisorAnswer}</div>
            )}
            {!advisorAnswer && !advisorLoading && (
              <div className="text-[12px] py-6 text-center" style={{ color: C.inkFaint }}>Ask a question above or tap a suggestion to get started.</div>
            )}
          </div>
        )}
        </div>
      </div>

      {tab !== 'advisor' && (
        <button
          onClick={() => { setPreviousTab(tab); setTab('advisor'); }}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 pl-3.5 pr-4 py-3 rounded-full transition-transform active:scale-95"
          style={{ background: C.copper, color: C.bg, boxShadow: '0 8px 24px rgba(255,176,32,0.35)' }}
        >
          <Lightbulb size={17} />
          <span className="text-[12.5px] font-semibold">Ask Oga</span>
        </button>
      )}
    </div>
  );
}
