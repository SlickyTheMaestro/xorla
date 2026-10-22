import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Moon, Sun, X, EyeOff, Eye, Check, ChevronRight, Megaphone, AlertCircle, Sparkles, Gift, ArrowRight, BadgeCheck, ScrollText, Hash, CalendarClock, Pill, Award, FileBadge, Flame, Home, Umbrella, Landmark, Users, FileText, Lock, Wrench, CreditCard, CircleHelp, Frown, Lightbulb, ImagePlus, ChevronLeft, Info, Trash2, Bike, Truck, Car } from 'lucide-react';
import { createPortal } from 'react-dom';


const INVOICES_KEY = 'chaseit:invoices';
const SALES_KEY = 'chaseit:sales';
const EXPENSES_KEY = 'chaseit:expenses';

// ============================================================
// SUPABASE CONNECTION — real backend, replacing local-only storage
// ============================================================
const SB_URL = 'https://gmduzfhxkjwojbkwgcxu.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtZHV6Zmh4a2p3b2pia3dnY3h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2Nzc3MzQsImV4cCI6MjEwMjI1MzczNH0.n1nm6W27zJE7epfJ7GlK3xAN9fcAjxeRDFDCNX6t4oo';
const SESSION_KEY = 'xorla:session';

function friendlyAuthError(raw) {
  const msg = (raw || '').toLowerCase();
  if (msg.includes('password') && (msg.includes('6 char') || msg.includes('at least'))) return `Your password needs to be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  if (msg.includes('invalid login credentials')) return "That email or password doesn't match our records. Check both and try again.";
  if (msg.includes('user already registered') || msg.includes('already exists')) return 'An account with this email already exists — try logging in instead.';
  if (msg.includes('email') && msg.includes('invalid')) return 'That email address doesn\'t look right — double check it.';
  if (msg.includes('rate limit') || msg.includes('too many')) return "Too many attempts — wait a minute and try again.";
  if (msg.includes('failed to fetch') || msg.includes('network')) return "Couldn't reach the server — check your internet connection.";
  if (!raw) return 'Something went wrong. Please try again.';
  return raw;
}
const PASSWORD_MIN_LENGTH = 8;
function passwordError(password) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password needs to be at least ${PASSWORD_MIN_LENGTH} characters.`;
  return '';
}
function isPasswordValid(password) {
  return password.length >= PASSWORD_MIN_LENGTH;
}

// ---------- No internet ----------
// Every call to the database goes through here: with no internet it throws one clear, friendly error,
// marked so that sales and expenses know to wait on the phone instead of failing.
class OfflineError extends Error {
  constructor() { super("You're offline. This needs internet. Try again when you're back online."); this.offline = true; }
}
async function netFetch(url, opts) {
  // A network that says it's connected but never answers counts as offline after 30 seconds
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), 30000) : null;
  try { return await fetch(url, ctl ? { ...opts, signal: ctl.signal } : opts); }
  catch (e) { throw new OfflineError(); }
  finally { if (t) clearTimeout(t); }
}

async function sbAuthCall(path, body) {
  const res = await netFetch(`${SB_URL}/auth/v1${path}`, {
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

async function sbRpc(fnName, accessToken, params) {
  const res = await netFetch(`${SB_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  // Some database actions succeed with an empty reply — only read a reply if there is one
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  if (!res.ok) throw new Error((data && (data.message || data.error_description)) || 'Something went wrong. Please try again.');
  return data;
}

async function saveSession(session) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {} }
async function loadSession() { try { const v = localStorage.getItem(SESSION_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

// The app's colours are CSS variables (see index.css), so light and dark mode is one switch on <html data-xt>.
// Any part of the page can stay dark by wrapping it in data-xt="dark".
const C = {
  bg: 'var(--c-bg)',
  surface: 'var(--c-surface)',
  surfaceRaised: 'var(--c-raised)',
  card: 'var(--c-card)',
  line: 'var(--c-line)',
  lineStrong: 'var(--c-line-strong)',
  ink: 'var(--c-ink)',
  inkDim: 'var(--c-ink-dim)',
  inkFaint: 'var(--c-ink-faint)',
  copper: 'var(--c-copper)',
  copperSoft: 'var(--c-copper-soft)',
  copperFill: 'var(--c-copper-fill)',
  sage: 'var(--c-sage)',
  sageSoft: 'var(--c-sage-soft)',
  sageFill: 'var(--c-sage-fill)',
  rust: 'var(--c-rust)',
  rustSoft: 'var(--c-rust-soft)',
  rustFill: 'var(--c-rust-fill)',
  onAccent: 'var(--c-on-accent)',
};
// A see-through version of a colour: works for palette colours (CSS variables) and plain hex colours
function tint(col, a) {
  const v = typeof col === 'string' && col.match(/^var\(--c-([a-z-]+)\)$/);
  if (v) return `rgba(var(--c-${v[1]}-rgb),${a})`;
  const h = typeof col === 'string' && col.match(/^#([0-9a-f]{6})$/i);
  if (h) { const n = parseInt(h[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  return col;
}
const shadow = 'var(--c-shadow)';

// ---------- Light / dark mode for the app (owners, staff and the founder dashboard) ----------
// Saved on this phone or computer. 'auto' follows the phone's own setting.
const THEME_KEY = 'xorla:theme';
function readThemePref() { try { const v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'auto' ? v : 'dark'; } catch (e) { return 'dark'; } }
function resolveTheme(pref) {
  if (pref !== 'auto') return pref;
  try { return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (e) { return 'dark'; }
}
function applyTheme(mode, animate) {
  const html = document.documentElement;
  if (animate) { html.classList.add('xt-anim'); setTimeout(() => html.classList.remove('xt-anim'), 450); }
  html.setAttribute('data-xt', mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mode === 'light' ? '#F1F5F2' : '#0A1F1C');
}
function useXorlaTheme() {
  const [pref, setPrefState] = useState(readThemePref);
  const [mode, setMode] = useState(() => resolveTheme(readThemePref()));
  useEffect(() => {
    const sync = () => { const p = readThemePref(); const m = resolveTheme(p); setPrefState(p); setMode(m); applyTheme(m, false); };
    sync();
    window.addEventListener('xorla-theme', sync); window.addEventListener('storage', sync);
    let mq = null;
    try { mq = window.matchMedia('(prefers-color-scheme: light)'); if (mq.addEventListener) mq.addEventListener('change', sync); else mq.addListener(sync); } catch (e) { mq = null; }
    return () => {
      window.removeEventListener('xorla-theme', sync); window.removeEventListener('storage', sync);
      if (mq) { if (mq.removeEventListener) mq.removeEventListener('change', sync); else mq.removeListener(sync); }
    };
  }, []);
  const setPref = (p) => {
    try { localStorage.setItem(THEME_KEY, p); } catch (e) {}
    applyTheme(resolveTheme(p), true);
    window.dispatchEvent(new Event('xorla-theme'));
  };
  return { pref, mode, setPref, toggle: () => setPref(mode === 'light' ? 'dark' : 'light') };
}
// The little sun / moon button in the top bar
function ThemeToggle({ size = 17, className = '' }) {
  const { mode, toggle } = useXorlaTheme();
  const light = mode === 'light';
  return (
    <button type="button" onClick={toggle} aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'} title={light ? 'Dark mode' : 'Light mode'}
      className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${className}`} style={{ color: light ? C.copper : C.inkDim, background: 'rgba(var(--c-hi),0.05)', border: `1px solid ${C.line}` }}>
      <span className="absolute inset-0 flex items-center justify-center transition-all duration-500" style={{ opacity: light ? 0 : 1, transform: light ? 'rotate(-90deg) scale(0.5)' : 'none' }}><Moon size={size} /></span>
      <span className="absolute inset-0 flex items-center justify-center transition-all duration-500" style={{ opacity: light ? 1 : 0, transform: light ? 'none' : 'rotate(90deg) scale(0.5)' }}><Sun size={size} /></span>
    </button>
  );
}

// A panel that slides up over the screen (same look as Send stock). Tapping outside closes it
// unless the form inside has something worth keeping (closeOnBackdrop=false).
function Sheet({ title, onClose, children, closeOnBackdrop = true, busy = false }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [busy, onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center sm:p-5" style={{ background: 'rgba(var(--c-scrim),0.8)', fontFamily: "'Poppins', 'Inter', sans-serif", color: C.ink }} onClick={() => closeOnBackdrop && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 xorla-fade-up max-h-[92vh] overflow-y-auto" style={{ background: C.surface, border: `1px solid ${C.line}`, paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden mx-auto -mt-1.5 mb-3 w-10 h-1 rounded-full" style={{ background: C.lineStrong }} />
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">{typeof title === 'string' ? <div className="text-[16px] font-semibold cx-display">{title}</div> : title}</div>
          <button onClick={() => !busy && onClose()} aria-label="Close" className="p-1 -m-1 shrink-0" style={{ color: C.inkFaint }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
function fmt(n) { const v = Number(n || 0); return `${v < 0 ? '−' : ''}₦${Math.abs(v).toLocaleString('en-NG')}`; }
// Live comma-formatting for money input fields — keeps the underlying value clean for storage/math
function formatNumInput(v) {
  if (v === '' || v === null || v === undefined) return '';
  const raw = String(v).replace(/,/g, '');
  if (raw === '' || isNaN(Number(raw))) return raw;
  const parts = raw.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}
function parseNumInput(v) { return String(v).replace(/,/g, ''); }
// WhatsApp needs full international format (2348031234567). People type local format (08031234567),
// so convert Nigerian numbers automatically; numbers already in international format pass through.
function toWhatsAppNumber(raw) {
  let d = String(raw || '').replace(/[^0-9]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('234')) { if (d[3] === '0') d = '234' + d.slice(4); return d; }
  if (d.length === 11 && d.startsWith('0')) return '234' + d.slice(1);
  if (d.length === 10 && /^[789]/.test(d)) return '234' + d;
  return d;
}
function formatPhoneDisplay(raw) {
  const d = toWhatsAppNumber(raw);
  if (d.length === 13 && d.startsWith('234')) return `+234 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  return d ? `+${d}` : '';
}
const isBookable = (p) => p && (p.priceUnit === 'night' || p.priceUnit === 'day');
// What kind of service business: drives examples, default pricing, and the storefront's booking words
const SERVICE_KINDS = {
  personal_care: { includesLabel: "WHAT'S INCLUDED", includes: 'e.g. Includes wash, blow-dry and styling', label: 'Personal care', hint: 'Salons, barbers, spas, makeup', name: "e.g. Knotless braids, Men's haircut", category: 'e.g. Hair, Nails, Skin', unit: 'session' },
  accommodation: { includesLabel: 'ROOM FEATURES', includes: 'e.g. King bed, en-suite bathroom, breakfast for two, Wi-Fi', label: 'Accommodation', hint: 'Hotels, guest houses, shortlets', name: 'e.g. Deluxe room with balcony', category: 'e.g. Rooms, Suites, Apartments', unit: 'night', checkIn: 'Check in', checkOut: 'Check out', what: 'room' },
  rentals: { includesLabel: "WHAT'S INCLUDED", includes: 'e.g. Driver included, fuel not included', label: 'Rentals', hint: 'Cars, event halls, equipment', name: 'e.g. Toyota Camry, 300-seat event hall', category: 'e.g. Cars, Halls, Equipment', unit: 'day', checkIn: 'Pick up', checkOut: 'Return', what: 'item' },
  repairs: { includesLabel: "WHAT'S INCLUDED", includes: 'e.g. Labour included, parts charged separately', label: 'Repairs & trades', hint: 'Mechanics, phones, tailoring', name: 'e.g. Engine service, Phone screen repair', category: 'e.g. Repairs, Servicing', unit: 'fixed' },
  professional: { includesLabel: "WHAT'S INCLUDED", includes: 'e.g. Two rounds of changes, delivered in 5 days', label: 'Professional services', hint: 'Consulting, design, accounting', name: 'e.g. Tax filing, Logo design', category: 'e.g. Consulting, Design', unit: 'fixed' },
  events: { includesLabel: "WHAT'S INCLUDED", includes: 'e.g. 6 hours of coverage, 200 edited photos', label: 'Events & media', hint: 'Photography, catering, MCs', name: 'e.g. Wedding photography, Event MC', category: 'e.g. Photography, Catering', unit: 'fixed' },
};
// Things rented by the day (cars, equipment) get a pick-up and a return time; rooms and halls don't
const rentsByDay = (p) => !!p && p.priceUnit === 'day' && !p.isSpace;
// Who serves an appointment, in the business's own words
const PERSON_WORDS = {
  personal_care: { one: 'stylist', many: 'stylists', One: 'Stylist', Many: 'Stylists', example: 'e.g. Amaka' },
  repairs: { one: 'technician', many: 'technicians', One: 'Technician', Many: 'Technicians', example: 'e.g. Emeka' },
  professional: { one: 'consultant', many: 'consultants', One: 'Consultant', Many: 'Consultants', example: 'e.g. Mrs Okafor' },
  _default: { one: 'team member', many: 'team members', One: 'Team member', Many: 'Team members', example: 'e.g. Chidi' },
};
// Examples that fit the business: what its products are called, and what customers usually tell it
const PRODUCT_EXAMPLES = {
  personal_care: { name: 'e.g. Bone-straight wig, 18 inches', category: 'e.g. Wigs, Hair care, Nails', tagline: 'e.g. Braids, wigs and nails, done beautifully in Aba', note: 'e.g. Hair length, colour, preferred stylist' },
  accommodation: { name: 'e.g. Bottle of water, Chilled malt', category: 'e.g. Drinks, Snacks, Toiletries', tagline: 'e.g. Clean, quiet rooms in the heart of Umuahia', note: 'e.g. Arriving late, need an extra bed' },
  rentals: { name: 'e.g. Phone charger, Car air freshener', category: 'e.g. Accessories, Supplies', tagline: 'e.g. Clean, reliable cars with or without a driver', note: 'e.g. Pick-up location, with or without driver' },
  repairs: { name: 'e.g. Brake pads, Screen protector', category: 'e.g. Spare parts, Accessories', tagline: 'e.g. Honest repairs, fast turnaround', note: 'e.g. Car model and year, phone model, the fault' },
  professional: { name: 'e.g. Printed report, Branded notebook', category: 'e.g. Books, Materials', tagline: 'e.g. Accounting and tax help for growing businesses', note: 'e.g. What you need, and your deadline' },
  events: { name: 'e.g. Photo album, Chair cover', category: 'e.g. Albums, Décor, Rentals', tagline: 'e.g. Photography and coverage for weddings and events', note: 'e.g. Event date, venue and number of guests' },
  _products: { name: 'e.g. Bag of rice (50kg), Ankara fabric', category: 'e.g. Provisions, Fabrics, Drinks', tagline: 'e.g. Quality goods at fair prices, delivered in Aba', note: 'e.g. Size, colour, delivery address' },
};
const examplesFor = (serviceKind) => PRODUCT_EXAMPLES[serviceKind] || PRODUCT_EXAMPLES._products;
const LAGOS_TIME = { timeZone: 'Africa/Lagos' };
const apptTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { ...LAGOS_TIME, hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();
const apptDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { ...LAGOS_TIME, weekday: 'short', day: 'numeric', month: 'short' });
function dayChipLabel(dateStr, todayStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const diff = Math.round((d - new Date(todayStr + 'T12:00:00Z')) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}
const HALF_HOURS = Array.from({ length: 38 }, (_, i) => { const m = 5 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });
const hhmmLabel = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`; };
// Halls and event spaces: times from 6am to midnight
const EVENT_TIMES = [...HALF_HOURS.filter((t) => t >= '06:00'), '24:00'];
// Moving the start keeps the end after it (at least an hour later)
const eventEndAfter = (start, end) => (end > start ? end : EVENT_TIMES.find((t) => t >= `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}${start.slice(2)}`) || '24:00');
const eventTimeLabel = (t) => (!t ? '' : t.startsWith('24') || t.startsWith('00:00') ? 'midnight' : hhmmLabel(t.slice(0, 5)));
function priceLabel(p) {
  const amt = fmt(p.sellingPrice);
  if (p.priceUnit === 'hour') return `${amt} / hour`;
  if (p.priceUnit === 'session') return `${amt} / session`;
  if (p.priceUnit === 'from') return `From ${amt}`;
  if (p.priceUnit === 'night') return `${amt} / night`;
  if (p.priceUnit === 'day') return `${amt} / day`;
  return amt;
}
// Items saved before "kind" existed follow the business type
function kindOf(p, businessType) {
  return p.kind || (businessType === 'services' ? 'service' : 'product');
}
function locationWords(businessType, serviceKind) {
  const branch = businessType === 'services' || (businessType === 'both' && ['accommodation', 'personal_care', 'professional', 'events'].includes(serviceKind));
  return branch ? { one: 'branch', many: 'branches', One: 'Branch', Many: 'Branches' } : { one: 'shop', many: 'shops', One: 'Shop', Many: 'Shops' };
}
// The first location is created as "Main shop"; show it in the business's own words ("Main branch")
function displayLocationName(s, L) {
  if (!s) return '';
  const n = s.name || '';
  if (/^main (shop|branch)$/i.test(n.trim())) return `Main ${L.one}`;
  return n;
}
function base64UrlToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}
const PLAN_PRICES = {
  pro: { monthly: 4500, yearly: 45000, earlyMonthly: 3000, earlyYearly: 30000 },
  business: { monthly: 12000, yearly: 120000, earlyMonthly: 8000, earlyYearly: 80000 },
  extraShop: { monthly: 3500, yearly: 35000 },
};
function planPrice(plan, interval, extraShops = 0, early = false) {
  const p = PLAN_PRICES[plan]; if (!p) return 0;
  const base = interval === 'monthly' ? (early ? p.earlyMonthly : p.monthly) : (early ? p.earlyYearly : p.yearly);
  return base + (plan === 'business' ? Math.max(0, Math.floor(extraShops)) * PLAN_PRICES.extraShop[interval] : 0);
}
function todayKey() { return new Date().toLocaleDateString('sv-SE'); }

function invoiceLineItems(inv) {
  if (inv.items && inv.items.length) return inv.items;
  return [{ description: 'Goods / Services', quantity: 1, unitPrice: Number(inv.amount) || 0 }];
}
function invoiceSubtotal(inv) {
  return invoiceLineItems(inv).reduce((a, it) => a + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
}
function invoiceTotal(inv) {
  const sub = invoiceSubtotal(inv);
  return sub + sub * (Number(inv.taxRate || 0) / 100);
}

// Charts are a large download, so they load on their own after the screen is up (a quiet space holds their place)
let rechartsMod = null;
let rechartsLoad = null;
function LazyChart({ children }) {
  const [R, setR] = useState(rechartsMod);
  useEffect(() => {
    if (R) return undefined;
    let live = true;
    rechartsLoad = rechartsLoad || import('recharts').then((m) => (rechartsMod = m));
    rechartsLoad.then((m) => live && setR(m)).catch(() => {});
    return () => { live = false; };
  }, []);
  return R ? children(R) : <div style={{ width: '100%', height: '100%' }} aria-hidden="true" />;
}
function cleanOptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((g) => g && String(g.name || '').trim() && Array.isArray(g.values) && g.values.some((v) => String(v).trim()))
    .slice(0, 2).map((g) => {
      const values = g.values.map((v) => String(v).trim()).filter(Boolean);
      const prices = Object.fromEntries(Object.entries(g.prices && typeof g.prices === 'object' ? g.prices : {}).map(([k, a]) => [k, Math.round(Number(a) || 0)]).filter(([k, a]) => a && values.includes(k)));
      return { name: String(g.name).trim(), values, ...(Object.keys(prices).length ? { prices } : {}) };
    });
}
// The extra price of a choice: "Gold / XXL" → Gold's extra + XXL's extra (an own choice like "Emerald / XXL" counts what's listed)
function optionAddon(options, variant) {
  const o = cleanOptions(options); if (!o.length || !variant) return 0;
  const parts = String(variant).split(' / ');
  return o.reduce((a, g, i) => a + (Number((g.prices || {})[String(parts[i] || '').trim()]) || 0), 0);
}
function optionCombos(options) {
  const o = cleanOptions(options);
  if (!o.length) return [];
  if (o.length === 1) return o[0].values;
  return o[0].values.flatMap((a) => o[1].values.map((b) => `${a} / ${b}`));
}
const optionWords = (options) => cleanOptions(options).map((g) => g.name.toLowerCase()).join(' and ');
const hasOptions = (p) => !!p && Array.isArray(p.options) && p.options.length > 0;

function fromSbProduct(row) {
  return { id: row.id, shopId: row.shop_id || null, name: row.name, costPrice: row.cost_price || 0, sellingPrice: row.selling_price || 0, imageUrl: row.image_url || null, stockQuantity: row.stock_quantity === null || row.stock_quantity === undefined ? null : Number(row.stock_quantity), units: Number(row.units) || 1, lowStockThreshold: row.low_stock_threshold ?? 5, trackStock: !!row.track_stock || (row.stock_quantity !== null && row.stock_quantity !== undefined), category: row.category || '', kind: row.kind || null, priceUnit: row.price_unit || 'fixed', duration: row.duration || '', description: row.description || '', images: Array.isArray(row.images) ? row.images.filter(Boolean) : [], isSpace: !!row.is_space, hourPrice: row.hour_price == null ? null : Number(row.hour_price), capacity: row.capacity == null ? null : Number(row.capacity), options: cleanOptions(row.options), madeToOrder: !!row.made_to_order, customChoice: !!row.custom_choice, leadTime: row.lead_time || '' };
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

function XorlaMark({ size = 30 }) {
  // a unique id per logo, so a hidden copy elsewhere on the page can't blank out its colours
  const id = 'xg' + React.useId().replace(/:/g, '');
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
// Password box with a show/hide eye, so people can check what they typed
function PasswordInput({ value, onChange, placeholder = 'Password', style, autoComplete = 'current-password', autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} placeholder={placeholder} value={value} onChange={onChange} autoComplete={autoComplete} autoFocus={autoFocus} autoCapitalize="none" autoCorrect="off" spellCheck={false}
        className="w-full rounded-xl pl-3.5 pr-11 py-3 text-[13.5px] outline-none" style={style} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg" style={{ color: show ? C.sage : C.inkFaint }}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
// Live checks under a new password: long enough, and both boxes match
function PasswordChecks({ password, confirm }) {
  if (!password) return null;
  const long = isPasswordValid(password);
  const typedConfirm = confirm.length > 0;
  const match = typedConfirm && confirm === password;
  const row = (ok, text, bad) => (
    <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: ok ? C.sage : bad ? '#E2A090' : C.inkFaint }}>
      <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ background: ok ? C.sageSoft : 'transparent', border: ok ? 'none' : `1px solid ${bad ? '#E2A090' : C.line}` }}>{ok && <Check size={9} strokeWidth={3} />}</span>{text}
    </div>
  );
  return (
    <div className="space-y-1 pl-0.5 pt-0.5">
      {row(long, `At least ${PASSWORD_MIN_LENGTH} characters`)}
      {typedConfirm && row(match, match ? 'Passwords match' : "Passwords don't match yet", !match)}
    </div>
  );
}

// Branded dropdown — a drop-in replacement for <select> that matches Xorla's look.
// Takes the same <option> children and calls onChange({ target: { value } }) like a native select.
function BrandSelect({ value, onChange, children, className = '', style = {}, disabled, icon, 'aria-label': ariaLabel, palette }) {
  const P = palette || C;   // light pages (the rider network) pass their own colours
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const listRef = useRef(null);
  const opts = React.Children.toArray(children)
    .filter((ch) => ch && ch.type === 'option')
    .map((ch) => ({ value: ch.props.value ?? '', label: React.Children.toArray(ch.props.children).join(''), disabled: !!ch.props.disabled }));
  const selIndex = opts.findIndex((o) => String(o.value) === String(value ?? ''));
  const current = opts[selIndex];
  useEffect(() => {
    if (!open) return;
    // Draw the list at the page's top level, anchored to the button, so no card can cover it
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom;
      const up = below < 280 && r.top > below;
      setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 180) - 8)), minWidth: r.width, ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }) });
    };
    place();
    const away = (e) => { if (ref.current?.contains(e.target) || listRef.current?.contains(e.target)) return; setOpen(false); };
    // Opening it can nudge the page (a phone's keyboard closing, or the browser bringing the button into view): don't close for that
    const openedAt = Date.now();
    const onScroll = (e) => { if (listRef.current?.contains(e.target) || Date.now() - openedAt < 500) { place(); return; } setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', away); document.removeEventListener('touchstart', away);
      window.removeEventListener('resize', place); window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);
  // Once the list is drawn, keep all of it on screen: a long option must never run off the right edge
  useLayoutEffect(() => {
    if (!open || !pos || !listRef.current) return;
    const w = listRef.current.getBoundingClientRect().width;
    const fit = Math.max(8, Math.min(pos.left, window.innerWidth - w - 8));
    if (Math.abs(fit - pos.left) > 0.5) setPos((p) => p && { ...p, left: fit });
  }, [open, pos]);
  const pick = (o) => { if (!o || o.disabled) return; onChange && onChange({ target: { value: o.value } }); setOpen(false); };
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { setOpen(true); setActive(selIndex); } else setActive((a) => Math.min(opts.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (open && active >= 0) pick(opts[active]); else { setOpen(true); setActive(selIndex); } }
  };
  // Width/flex classes belong on the wrapper; everything else styles the button
  const layout = (className.match(/(^|\s)(flex-1|min-w-0|shrink-0|w-\S+)(?=\s|$)/g) || []).join(' ').trim();
  const look = className.split(/\s+/).filter((k) => k && !/^(flex-1|min-w-0|shrink-0|w-\S+|appearance-none|outline-none)$/.test(k)).join(' ');
  return (
    <div ref={ref} className={`relative ${layout}`}>
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        onClick={() => { setOpen((o) => !o); setActive(selIndex); }} onKeyDown={onKey}
        className={`${look} w-full flex items-center justify-between gap-2 text-left outline-none transition-colors`}
        style={{ ...style, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, ...(open ? { boxShadow: `0 0 0 1.5px ${P.copper}` } : {}) }}>
        <span className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="truncate" style={{ color: current && current.value !== '' ? P.ink : P.inkFaint }}>{current ? current.label : ''}</span>
        </span>
        <ChevronRight size={15} className="shrink-0" style={{ color: open ? P.copper : P.inkFaint, transform: `rotate(${open ? -90 : 90}deg)`, transition: 'transform .15s' }} />
      </button>
      {open && pos && createPortal(
        <div ref={listRef} role="listbox" aria-label={ariaLabel} className="fixed z-[200] rounded-xl py-1.5 max-h-64 overflow-y-auto"
          style={{ ...pos, width: 'max-content', maxWidth: 'min(340px, calc(100vw - 16px))', background: P.surface, border: `1px solid ${P.lineStrong || P.line}`, boxShadow: palette ? '0 16px 40px rgba(11,43,38,0.18)' : '0 16px 40px rgba(var(--c-lo),calc(0.5 * var(--c-lok)))', fontFamily: "'Poppins', 'Inter', sans-serif" }}>
          {opts.map((o, i) => {
            const sel = i === selIndex;
            return (
              <button key={i} type="button" role="option" aria-selected={sel} disabled={o.disabled}
                onMouseEnter={() => setActive(i)} onClick={() => pick(o)}
                className="w-full text-left px-3.5 py-2.5 text-[13px] flex items-center justify-between gap-4"
                style={{ background: i === active ? P.surfaceRaised : 'transparent', color: o.value === '' ? P.inkFaint : sel ? P.copper : P.ink, fontWeight: sel ? 600 : 400, opacity: o.disabled ? 0.4 : 1 }}>
                <span className="min-w-0 break-words">{o.label}</span>
                {sel && o.value !== '' && <Check size={14} className="shrink-0" style={{ color: P.copper }} />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

const S = {
  bg: '#FFFFFF',
  tile: '#F1F2EF',
  ink: '#17191A',
  muted: '#6B706B',
  line: '#E6E8E4',
  soldOut: '#B4B8B2',
};
const SF_FONT = "'Poppins', 'Inter', system-ui, sans-serif";

// The pop-up card itself. Also used as the live preview on the founder's publishing page.
const SPOT_TONES = {
  info: { from: '#0E5A50', to: '#0A2A26', glow: 'rgba(31,217,196,0.55)', accent: C.sage, Icon: Megaphone, eyebrow: 'From Xorla' },
  warning: { from: '#8A4B06', to: '#2A1A08', glow: 'rgba(255,176,32,0.6)', accent: C.copper, Icon: AlertCircle, eyebrow: 'Important' },
  success: { from: '#0B6B4F', to: '#0A2A22', glow: 'rgba(52,230,160,0.55)', accent: '#34E6A0', Icon: Sparkles, eyebrow: 'Good news' },
  update: { from: '#7A4A0C', to: '#0F2B26', glow: 'rgba(255,176,32,0.5)', accent: C.copper, Icon: Gift, eyebrow: 'New in Xorla' },
};
const SPOT_CTA = { plan: 'See plans', updates: "See what's new", support: 'Message support', sales: 'Go to sales', products: 'Go to products', settings: 'Open settings', vault: 'Open my document vault', cac: 'Register my business' };
const UPDATE_KIND = { new: 'New', improved: 'Improved', fixed: 'Fixed', tip: 'Tip' };
function XorlaSpotlight({ spot, canPlan = true, onClose, preview = false }) {
  const isAnn = spot.kind === 'ann';
  const it = spot.item || {};
  const tone = SPOT_TONES[isAnn ? (it.tone || 'info') : 'update'] || SPOT_TONES.info;
  const cta = isAnn ? (it.cta && it.cta !== 'none' && (!['plan', 'cac', 'vault'].includes(it.cta) || canPlan) ? it.cta : null) : 'updates';
  const title = isAnn ? (it.title || (it.tone === 'warning' ? 'Please note' : it.tone === 'success' ? 'Good news' : 'A message from Xorla')) : it.title;
  const body = isAnn ? it.message : it.body;
  const Ic = tone.Icon;
  const card = (
    <div className="w-full max-w-[360px] rounded-[28px] overflow-hidden xorla-spot-in" style={{ background: C.surface, border: `1px solid ${C.lineStrong}`, boxShadow: `0 30px 80px -20px rgba(var(--c-lo),calc(0.85 * var(--c-lok))), 0 0 0 1px rgba(255,255,255,0.03), 0 0 60px -20px ${tone.glow}` }} onClick={(e) => e.stopPropagation()}>
      <div data-xt="dark" className="relative h-[168px] overflow-hidden" style={{ background: `radial-gradient(120% 90% at 85% 0%, ${tone.glow} 0%, transparent 55%), linear-gradient(160deg, ${tone.from}, ${tone.to})` }}>
        <div className="absolute -left-10 -bottom-16 w-48 h-48 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.10)' }} />
        <div className="absolute -left-2 -bottom-8 w-32 h-32 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
        <div className="absolute right-6 top-7 w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
        <div className="absolute right-14 top-16 w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.35)' }} />
        <div className="absolute left-5 top-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(var(--c-lo),calc(0.28 * var(--c-lok)))' }}><XorlaMark size={16} /></span>
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(255,255,255,0.85)' }}>{tone.eyebrow}</span>
        </div>
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 w-[76px] h-[76px] rounded-[24px] flex items-center justify-center xorla-spot-float" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.22)', boxShadow: '0 14px 30px -10px rgba(var(--c-lo),calc(0.6 * var(--c-lok)))' }}>
          <Ic size={34} style={{ color: '#fff' }} strokeWidth={2.2} />
        </div>
        {!isAnn && it.kind && <span className="absolute right-4 top-4 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: C.copperFill, color: C.onAccent }}>{UPDATE_KIND[it.kind] || 'New'}</span>}
      </div>
      <div className="px-6 pt-5 pb-6 text-center">
        <div className="text-[20px] font-bold leading-tight cx-display" style={{ color: C.ink, overflowWrap: 'anywhere' }}>{title || 'Your headline'}</div>
        <div className="mt-2.5 text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: C.inkDim, display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{body || 'Your message shows here.'}</div>
        {cta ? (
          <>
            <button onClick={() => onClose(cta)} className="mt-5 w-full h-12 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2" style={{ background: C.copperFill, color: C.onAccent, boxShadow: '0 10px 24px -10px rgba(255,176,32,0.7)' }}>{SPOT_CTA[cta] || 'Open'} <ArrowRight size={16} /></button>
            <button onClick={() => onClose(null)} className="mt-2 w-full h-10 text-[13.5px] font-semibold" style={{ color: C.inkDim }}>Not now</button>
          </>
        ) : (
          <button onClick={() => onClose(null)} className="mt-5 w-full h-12 rounded-2xl text-[15px] font-bold" style={{ background: C.copperFill, color: C.onAccent, boxShadow: '0 10px 24px -10px rgba(255,176,32,0.7)' }}>Got it</button>
        )}
      </div>
    </div>
  );
  if (preview) return card;
  return (
    <div className="fixed inset-0 z-[96] flex flex-col items-center justify-center px-5" style={{ background: 'rgba(var(--c-scrim),0.78)', backdropFilter: 'blur(6px)', fontFamily: "'Poppins', 'Inter', system-ui, sans-serif", color: C.ink }} onClick={() => onClose(null)} role="dialog" aria-modal="true" aria-label={title}>
      <style>{`@keyframes xorlaSpotIn{from{opacity:0;transform:translateY(18px) scale(.94)}to{opacity:1;transform:none}}@keyframes xorlaSpotFloat{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-50%,-56%)}}.xorla-spot-in{animation:xorlaSpotIn .38s cubic-bezier(.2,.9,.3,1.2) both}.xorla-spot-float{animation:xorlaSpotFloat 3.2s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.xorla-spot-in,.xorla-spot-float{animation:none}}`}</style>
      {card}
      <button onClick={() => onClose(null)} aria-label="Close" className="mt-5 w-11 h-11 rounded-full flex items-center justify-center xorla-spot-in" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}><X size={20} /></button>
    </div>
  );
}

// ---------- Register a business name with CAC, through Xorla ----------
const NG_STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];
// Business category → type, like CAC's own classification
// Local government areas, by state (774)
// A guest who has booked but not checked in yet (no room until check-in). Starts the order note, so the front desk can find the booking.
const BOOKED_GUEST_NOTE = 'Has a booking, not checked in yet.';
// Laundry for someone not staying: the business fetches the bag and brings it back, or the customer drops it off and collects it
const LAUNDRY_COLLECT_NOTE = 'Laundry: collect it from me and bring it back.';
const LAUNDRY_DROP_NOTE = "Laundry: I'll drop it off and collect it.";
const laundryCollect = (o) => o.fulfilMode === 'delivery' && String(o.note || '').startsWith(LAUNDRY_COLLECT_NOTE);
const laundryDrop = (o) => o.fulfilMode === 'pickup' && String(o.note || '').startsWith(LAUNDRY_DROP_NOTE);
const noteWithout = (n) => String(n || '').replace(BOOKED_GUEST_NOTE, '').replace(LAUNDRY_COLLECT_NOTE, '').replace(LAUNDRY_DROP_NOTE, '').trim();
// Hotel extras that are a service (someone does it for the guest), so "brought to your room / pick it up" doesn't fit
const STAY_SERVICE_RE = /air ?port|pick ?-?up|drop ?-?off|transfer|shuttle|taxi|\bcab\b|car hire|chauffeur|driver|\bride\b|laundry|dry ?clean|ironing|washing|massage|\bspa\b|sauna|salon|tour|excursion|guide|cleaning|housekeeping|late check|early check|wake ?-?up|baby ?sit|decorat|photograph|gym|pool access|parking/i;
const stayServiceKind = (name) => (/air ?port|pick ?-?up|drop ?-?off|transfer|shuttle|taxi|\bcab\b|car hire|chauffeur|driver|\bride\b/i.test(name) ? 'ride' : /laundry|dry ?clean|ironing|washing/i.test(name) ? 'laundry' : /late check|early check/i.test(name) ? 'checkin' : 'other');
const NG_LGAS = Object.fromEntries(Object.entries({
  'Abia': 'Aba North|Aba South|Arochukwu|Bende|Ikwuano|Isiala Ngwa North|Isiala Ngwa South|Isuikwuato|Obi Ngwa|Ohafia|Osisioma|Ugwunagbo|Ukwa East|Ukwa West|Umuahia North|Umuahia South|Umu Nneochi',
  'Adamawa': 'Demsa|Fufure|Ganye|Gayuk|Gombi|Grie|Hong|Jada|Lamurde|Madagali|Maiha|Mayo Belwa|Michika|Mubi North|Mubi South|Numan|Shelleng|Song|Toungo|Yola North|Yola South',
  'Akwa Ibom': 'Abak|Eastern Obolo|Eket|Esit Eket|Essien Udim|Etim Ekpo|Etinan|Ibeno|Ibesikpo Asutan|Ibiono-Ibom|Ika|Ikono|Ikot Abasi|Ikot Ekpene|Ini|Itu|Mbo|Mkpat-Enin|Nsit-Atai|Nsit-Ibom|Nsit-Ubium|Obot Akara|Okobo|Onna|Oron|Oruk Anam|Udung-Uko|Ukanafun|Uruan|Urue-Offong/Oruko|Uyo',
  'Anambra': 'Aguata|Anambra East|Anambra West|Anaocha|Awka North|Awka South|Ayamelum|Dunukofia|Ekwusigo|Idemili North|Idemili South|Ihiala|Njikoka|Nnewi North|Nnewi South|Ogbaru|Onitsha North|Onitsha South|Orumba North|Orumba South|Oyi',
  'Bauchi': "Alkaleri|Bauchi|Bogoro|Damban|Darazo|Dass|Gamawa|Ganjuwa|Giade|Itas/Gadau|Jama'are|Katagum|Kirfi|Misau|Ningi|Shira|Tafawa Balewa|Toro|Warji|Zaki",
  'Bayelsa': 'Brass|Ekeremor|Kolokuma/Opokuma|Nembe|Ogbia|Sagbama|Southern Ijaw|Yenagoa',
  'Benue': 'Ado|Agatu|Apa|Buruku|Gboko|Guma|Gwer East|Gwer West|Katsina-Ala|Konshisha|Kwande|Logo|Makurdi|Obi|Ogbadibo|Ohimini|Oju|Okpokwu|Otukpo|Tarka|Ukum|Ushongo|Vandeikya',
  'Borno': 'Abadam|Askira/Uba|Bama|Bayo|Biu|Chibok|Damboa|Dikwa|Gubio|Guzamala|Gwoza|Hawul|Jere|Kaga|Kala/Balge|Konduga|Kukawa|Kwaya Kusar|Mafa|Magumeri|Maiduguri|Marte|Mobbar|Monguno|Ngala|Nganzai|Shani',
  'Cross River': 'Abi|Akamkpa|Akpabuyo|Bakassi|Bekwarra|Biase|Boki|Calabar Municipal|Calabar South|Etung|Ikom|Obanliku|Obubra|Obudu|Odukpani|Ogoja|Yakuur|Yala',
  'Delta': 'Aniocha North|Aniocha South|Bomadi|Burutu|Ethiope East|Ethiope West|Ika North East|Ika South|Isoko North|Isoko South|Ndokwa East|Ndokwa West|Okpe|Oshimili North|Oshimili South|Patani|Sapele|Udu|Ughelli North|Ughelli South|Ukwuani|Uvwie|Warri North|Warri South|Warri South West',
  'Ebonyi': 'Abakaliki|Afikpo North|Afikpo South|Ebonyi|Ezza North|Ezza South|Ikwo|Ishielu|Ivo|Izzi|Ohaozara|Ohaukwu|Onicha',
  'Edo': 'Akoko-Edo|Egor|Esan Central|Esan North-East|Esan South-East|Esan West|Etsako Central|Etsako East|Etsako West|Igueben|Ikpoba-Okha|Oredo|Orhionmwon|Ovia North-East|Ovia South-West|Owan East|Owan West|Uhunmwonde',
  'Ekiti': 'Ado-Ekiti|Efon|Ekiti East|Ekiti South-West|Ekiti West|Emure|Gbonyin|Ido-Osi|Ijero|Ikere|Ikole|Ilejemeje|Irepodun/Ifelodun|Ise/Orun|Moba|Oye',
  'Enugu': 'Aninri|Awgu|Enugu East|Enugu North|Enugu South|Ezeagu|Igbo Etiti|Igbo Eze North|Igbo Eze South|Isi Uzo|Nkanu East|Nkanu West|Nsukka|Oji River|Udenu|Udi|Uzo-Uwani',
  'FCT (Abuja)': 'Abaji|Abuja Municipal (AMAC)|Bwari|Gwagwalada|Kuje|Kwali',
  'Gombe': 'Akko|Balanga|Billiri|Dukku|Funakaye|Gombe|Kaltungo|Kwami|Nafada|Shongom|Yamaltu/Deba',
  'Imo': 'Aboh Mbaise|Ahiazu Mbaise|Ehime Mbano|Ezinihitte|Ideato North|Ideato South|Ihitte/Uboma|Ikeduru|Isiala Mbano|Isu|Mbaitoli|Ngor Okpala|Njaba|Nkwerre|Nwangele|Obowo|Oguta|Ohaji/Egbema|Okigwe|Onuimo|Orlu|Orsu|Oru East|Oru West|Owerri Municipal|Owerri North|Owerri West',
  'Jigawa': 'Auyo|Babura|Biriniwa|Birnin Kudu|Buji|Dutse|Gagarawa|Garki|Gumel|Guri|Gwaram|Gwiwa|Hadejia|Jahun|Kafin Hausa|Kaugama|Kazaure|Kiri Kasama|Kiyawa|Maigatari|Malam Madori|Miga|Ringim|Roni|Sule Tankarkar|Taura|Yankwashi',
  'Kaduna': "Birnin Gwari|Chikun|Giwa|Igabi|Ikara|Jaba|Jema'a|Kachia|Kaduna North|Kaduna South|Kagarko|Kajuru|Kaura|Kauru|Kubau|Kudan|Lere|Makarfi|Sabon Gari|Sanga|Soba|Zangon Kataf|Zaria",
  'Kano': 'Ajingi|Albasu|Bagwai|Bebeji|Bichi|Bunkure|Dala|Dambatta|Dawakin Kudu|Dawakin Tofa|Doguwa|Fagge|Gabasawa|Garko|Garun Mallam|Gaya|Gezawa|Gwale|Gwarzo|Kabo|Kano Municipal|Karaye|Kibiya|Kiru|Kumbotso|Kunchi|Kura|Madobi|Makoda|Minjibir|Nasarawa|Rano|Rimin Gado|Rogo|Shanono|Sumaila|Takai|Tarauni|Tofa|Tsanyawa|Tudun Wada|Ungogo|Warawa|Wudil',
  'Katsina': "Bakori|Batagarawa|Batsari|Baure|Bindawa|Charanchi|Dan Musa|Dandume|Danja|Daura|Dutsi|Dutsin Ma|Faskari|Funtua|Ingawa|Jibia|Kafur|Kaita|Kankara|Kankia|Katsina|Kurfi|Kusada|Mai'Adua|Malumfashi|Mani|Mashi|Matazu|Musawa|Rimi|Sabuwa|Safana|Sandamu|Zango",
  'Kebbi': 'Aleiro|Arewa Dandi|Argungu|Augie|Bagudo|Birnin Kebbi|Bunza|Dandi|Fakai|Gwandu|Jega|Kalgo|Koko/Besse|Maiyama|Ngaski|Sakaba|Shanga|Suru|Wasagu/Danko|Yauri|Zuru',
  'Kogi': 'Adavi|Ajaokuta|Ankpa|Bassa|Dekina|Ibaji|Idah|Igalamela-Odolu|Ijumu|Kabba/Bunu|Kogi|Lokoja|Mopa-Muro|Ofu|Ogori/Magongo|Okehi|Okene|Olamaboro|Omala|Yagba East|Yagba West',
  'Kwara': 'Asa|Baruten|Edu|Ekiti|Ifelodun|Ilorin East|Ilorin South|Ilorin West|Irepodun|Isin|Kaiama|Moro|Offa|Oke Ero|Oyun|Pategi',
  'Lagos': 'Agege|Ajeromi-Ifelodun|Alimosho|Amuwo-Odofin|Apapa|Badagry|Epe|Eti-Osa|Ibeju-Lekki|Ifako-Ijaiye|Ikeja|Ikorodu|Kosofe|Lagos Island|Lagos Mainland|Mushin|Ojo|Oshodi-Isolo|Shomolu|Surulere',
  'Nasarawa': 'Akwanga|Awe|Doma|Karu|Keana|Keffi|Kokona|Lafia|Nasarawa|Nasarawa Egon|Obi|Toto|Wamba',
  'Niger': 'Agaie|Agwara|Bida|Borgu|Bosso|Chanchaga|Edati|Gbako|Gurara|Katcha|Kontagora|Lapai|Lavun|Magama|Mariga|Mashegu|Mokwa|Munya|Paikoro|Rafi|Rijau|Shiroro|Suleja|Tafa|Wushishi',
  'Ogun': 'Abeokuta North|Abeokuta South|Ado-Odo/Ota|Ewekoro|Ifo|Ijebu East|Ijebu North|Ijebu North East|Ijebu Ode|Ikenne|Imeko Afon|Ipokia|Obafemi Owode|Odeda|Odogbolu|Ogun Waterside|Remo North|Shagamu|Yewa North|Yewa South',
  'Ondo': 'Akoko North-East|Akoko North-West|Akoko South-East|Akoko South-West|Akure North|Akure South|Ese Odo|Idanre|Ifedore|Ilaje|Ile Oluji/Okeigbo|Irele|Odigbo|Okitipupa|Ondo East|Ondo West|Ose|Owo',
  'Osun': 'Aiyedaade|Aiyedire|Atakumosa East|Atakumosa West|Boluwaduro|Boripe|Ede North|Ede South|Egbedore|Ejigbo|Ife Central|Ife East|Ife North|Ife South|Ifedayo|Ifelodun|Ila|Ilesa East|Ilesa West|Irepodun|Irewole|Isokan|Iwo|Obokun|Odo Otin|Ola Oluwa|Olorunda|Oriade|Orolu|Osogbo',
  'Oyo': 'Afijio|Akinyele|Atiba|Atisbo|Egbeda|Ibadan North|Ibadan North-East|Ibadan North-West|Ibadan South-East|Ibadan South-West|Ibarapa Central|Ibarapa East|Ibarapa North|Ido|Irepo|Iseyin|Itesiwaju|Iwajowa|Kajola|Lagelu|Ogbomosho North|Ogbomosho South|Ogo Oluwa|Olorunsogo|Oluyole|Ona Ara|Orelope|Ori Ire|Oyo East|Oyo West|Saki East|Saki West|Surulere',
  'Plateau': "Barkin Ladi|Bassa|Bokkos|Jos East|Jos North|Jos South|Kanam|Kanke|Langtang North|Langtang South|Mangu|Mikang|Pankshin|Qua'an Pan|Riyom|Shendam|Wase",
  'Rivers': 'Abua/Odual|Ahoada East|Ahoada West|Akuku-Toru|Andoni|Asari-Toru|Bonny|Degema|Eleme|Emohua|Etche|Gokana|Ikwerre|Khana|Obio/Akpor|Ogba/Egbema/Ndoni|Ogu/Bolo|Okrika|Omuma|Opobo/Nkoro|Oyigbo|Port Harcourt|Tai',
  'Sokoto': 'Binji|Bodinga|Dange Shuni|Gada|Goronyo|Gudu|Gwadabawa|Illela|Isa|Kebbe|Kware|Rabah|Sabon Birni|Shagari|Silame|Sokoto North|Sokoto South|Tambuwal|Tangaza|Tureta|Wamako|Wurno|Yabo',
  'Taraba': 'Ardo Kola|Bali|Donga|Gashaka|Gassol|Ibi|Jalingo|Karim Lamido|Kurmi|Lau|Sardauna|Takum|Ussa|Wukari|Yorro|Zing',
  'Yobe': 'Bade|Bursari|Damaturu|Fika|Fune|Geidam|Gujba|Gulani|Jakusko|Karasuwa|Machina|Nangere|Nguru|Potiskum|Tarmuwa|Yunusari|Yusufari',
  'Zamfara': 'Anka|Bakura|Birnin Magaji/Kiyaw|Bukkuyum|Bungudu|Gummi|Gusau|Kaura Namoda|Maradun|Maru|Shinkafi|Talata Mafara|Tsafe|Zurmi',
}).map(([k, v]) => [k, v.split('|')]));
async function cacUpload(token, businessId, file, kind) {
  const pdf = file.type === 'application/pdf';
  if (pdf && file.size > 5.5 * 1024 * 1024) throw new Error('That PDF is too large. Use one under 5 MB, or a photo.');
  const blob = pdf ? file : await resizeImageToBlob(file, 1600, 0.86);
  const path = `${businessId}/${kind}-${Date.now()}.${pdf ? 'pdf' : 'jpg'}`;
  const res = await fetch(`${SB_URL}/storage/v1/object/cac-docs/${path}`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${token}`, 'Content-Type': pdf ? 'application/pdf' : 'image/jpeg' }, body: blob });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "That file didn't upload. Check your connection and try again."); }
  return path;
}
async function cacDocUrl(token, path, expiresIn = 900) {
  const res = await fetch(`${SB_URL}/storage/v1/object/sign/cac-docs/${path}`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn }) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.signedURL) throw new Error("Couldn't open that file.");
  return `${SB_URL}/storage/v1${d.signedURL}`;
}
const CAC_STATUS = {
  submitted: ['Details sent', C.copper], paid: ['Paid · being checked', C.copper], filed: ['With CAC', C.sage], query: ['Needs a fix', C.rust],
  registered: ['Registered', C.sage], rejected: ["Didn't go through", C.rust], cancelled: ['Cancelled', C.inkFaint], draft: ['Not sent yet', C.inkFaint],
};

// ---------- Document vault: a business's important papers, shareable with a link that expires ----------
const VAULT_KINDS = {
  cac_certificate: ['CAC certificate', BadgeCheck, '#1FD9C4', 'reg'],
  cac_report: ['CAC status report', ScrollText, '#1FD9C4', 'reg'],
  tin: ['Tax ID (TIN)', Hash, '#7FB3FF', 'reg'],
  cac_annual: ['CAC annual return', CalendarClock, '#7FB3FF', 'reg'],
  nafdac: ['NAFDAC', Pill, '#C792EA', 'lic'],
  son: ['SON / MANCAP', Award, '#C792EA', 'lic'],
  permit: ['Permit or licence', FileBadge, '#FFB020', 'lic'],
  fire: ['Fire certificate', Flame, '#F78C6C', 'lic'],
  tenancy: ['Tenancy agreement', Home, '#A3BE8C', 'prop'],
  insurance: ['Insurance', Umbrella, '#A3BE8C', 'prop'],
  bank: ['Bank letter', Landmark, '#89DDFF', 'other'],
  id: ["Owner's ID", Users, '#89DDFF', 'other'],
  other: ['Other', FileText, '#8A9A96', 'other'],
};
const vaultDaysLeft = (d) => (d?.expires_on ? Math.round((new Date(d.expires_on + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000) : null);
const vaultExpiry = (d) => {
  const left = vaultDaysLeft(d);
  if (left === null) return null;
  if (left < 0) return { text: `Expired ${new Date(d.expires_on + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, tone: C.rust, bg: C.rustSoft, urgent: true };
  if (left === 0) return { text: 'Expires today', tone: C.rust, bg: C.rustSoft, urgent: true };
  if (left <= Math.max(7, Number(d.remind_days ?? 30))) return { text: `Expires in ${left} day${left === 1 ? '' : 's'}`, tone: C.copper, bg: C.copperSoft, urgent: true };
  return { text: `Valid till ${new Date(d.expires_on + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, tone: C.sage, bg: C.sageSoft, urgent: false };
};
async function vaultFileUrl(token, bucket, path, download = false) {
  const res = await fetch(`${SB_URL}/storage/v1/object/sign/${bucket}/${path}`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 600 }) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.signedURL) throw new Error("Couldn't open that file. If the link was shared with you, it may have stopped working.");
  return `${SB_URL}/storage/v1${d.signedURL}${download ? `&download=${encodeURIComponent(download === true ? '' : download)}` : ''}`;
}

// A small stack of papers, used as the vault's picture
function VaultArt({ size = 1 }) {
  const card = (rot, x, y, bg, children, z) => (
    <div className="absolute rounded-xl" style={{ width: 92 * size, height: 118 * size, left: x * size, top: y * size, transform: `rotate(${rot}deg)`, background: bg, boxShadow: '0 16px 30px -12px rgba(var(--c-lo),calc(0.7 * var(--c-lok))), inset 0 0 0 1px rgba(var(--c-lo),calc(0.08 * var(--c-lok)))', zIndex: z, padding: 9 * size }}>{children}</div>
  );
  const lines = (c, n = 4) => Array.from({ length: n }, (_, i) => <div key={i} style={{ height: 3 * size, width: `${[86, 70, 92, 55][i % 4]}%`, background: c, borderRadius: 4, marginTop: 6 * size }} />);
  return (
    <div aria-hidden className="relative" style={{ width: 170 * size, height: 140 * size }}>
      {card(-12, 4, 18, 'linear-gradient(160deg, #DCE9FF, #B9D0F5)', <><div style={{ height: 6 * size, width: '55%', background: '#5B83C7', borderRadius: 4 }} />{lines('rgba(40,70,120,0.28)')}</>, 1)}
      {card(9, 70, 10, 'linear-gradient(160deg, #DFF7EE, #B8E8D6)', <><div style={{ height: 6 * size, width: '48%', background: '#2C9C7B', borderRadius: 4 }} />{lines('rgba(20,90,70,0.28)')}</>, 2)}
      {card(-2, 36, 4, 'linear-gradient(160deg, #FBF6EA, #EEE2C4)', <>
        <div className="text-center font-bold uppercase" style={{ fontSize: 6 * size, letterSpacing: '0.18em', color: '#8A6A2A' }}>Certificate</div>
        <div className="mx-auto" style={{ marginTop: 6 * size, height: 5 * size, width: '70%', background: '#1F2A26', borderRadius: 3 }} />
        {lines('rgba(150,110,40,0.35)', 2)}
        <svg width={20 * size} height={20 * size} viewBox="0 0 46 46" style={{ position: 'absolute', right: 8 * size, bottom: 8 * size }}><circle cx="23" cy="23" r="21" fill="#0F6B5A" /><path d="M15.5 23.5l5 5 10-11" fill="none" stroke="#F6E7B8" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </>, 3)}
      <div className="absolute rounded-2xl flex items-center justify-center" style={{ zIndex: 4, width: 44 * size, height: 44 * size, right: 2 * size, bottom: 0, background: `linear-gradient(180deg, #FFC24D, ${C.copperFill})`, boxShadow: '0 10px 20px -8px rgba(255,176,32,0.8)' }}><Lock size={20 * size} style={{ color: C.onAccent }} /></div>
    </div>
  );
}

// ---------- Xorla's team: registration requests, the agent and the price ----------
// Ready-made notes for the owner, so the team (and the agent) don't type the same thing every time
const CAC_SUGGEST = {
  query: [
    'Your first business name is already taken. Send us another name choice.',
    'Both names are too close to businesses already registered. Send two new name choices.',
    'Your ID photo is not clear. Upload a clearer photo with all four corners showing.',
    'Your passport photograph needs a plain white background. Upload a new one.',
    'Your signature is not clear. Sign on plain white paper with a dark pen and upload it again.',
    'Your NIN does not match your name or date of birth. Check it and correct it.',
    'Describe what the business does more clearly, for example "Sale of ready-made clothes and shoes".',
    'The business address is not complete. Add the shop number, street and town.',
  ],
  rejected: [
    'CAC did not accept this name because it uses a restricted word. Your payment will be refunded within 5 working days.',
    'We could not confirm your identity with the details given. Your payment will be refunded within 5 working days.',
    'You asked us to cancel. Your payment will be refunded within 5 working days.',
  ],
  registered: [
    'Congratulations! Your business name is registered. Download your certificate and status report below.',
    'Congratulations! Your business name is registered. Your TIN will follow in a few days, and we will add it here.',
  ],
};

// Branded scrollbars everywhere (thin, Xorla teal on dark) and the "typing…" dots
if (typeof document !== 'undefined' && !document.getElementById('xorla-global-style')) {
  const st = document.createElement('style'); st.id = 'xorla-global-style';
  st.textContent = `
    * { scrollbar-width: thin; scrollbar-color: rgba(31,217,196,0.45) transparent; }
    *::-webkit-scrollbar { width: 8px; height: 8px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background: linear-gradient(180deg, rgba(31,217,196,0.55), rgba(255,176,32,0.5)); border-radius: 99px; border: 2px solid transparent; background-clip: padding-box; }
    *::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #1FD9C4, #FFB020); background-clip: padding-box; }
    .xorla-dots span { display: inline-block; width: 6px; height: 6px; margin: 0 2px; border-radius: 99px; background: currentColor; animation: xorla-dot 1.2s infinite ease-in-out; }
    .xorla-dots span:nth-child(2) { animation-delay: .15s } .xorla-dots span:nth-child(3) { animation-delay: .3s }
    @keyframes xorla-dot { 0%, 60%, 100% { opacity: .25; transform: translateY(0) } 30% { opacity: 1; transform: translateY(-3px) } }
  `;
  document.head.appendChild(st);
}
const TypingBubble = ({ name, mine, avatar = true }) => (
  <div className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2 items-end`}>
    {!mine && avatar && <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: '#0F2C27', border: `1px solid ${C.line}` }}><XorlaMark size={18} /></span>}
    <div>
      <div className="text-[11px] mb-1" style={{ color: C.inkFaint }}>{name ? <><strong style={{ color: C.sage }}>{name}</strong> is typing</> : 'Typing'}</div>
      <div className="rounded-2xl px-4 py-3 xorla-dots" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.sage, borderTopLeftRadius: mine ? 16 : 6 }}><span /><span /><span /></div>
    </div>
  </div>
);

// ---------- Help & support: talk to Xorla, see what's new, read how-to guides ----------
// Fill in when ready. The WhatsApp button appears once a number is set (international format, e.g. '2348031234567').
const SUPPORT = { whatsapp: '', email: '', hoursText: 'Monday to Saturday, 9am to 6pm', openDays: [1, 2, 3, 4, 5, 6], openHour: 9, closeHour: 18 };
const SUPPORT_TOPICS = [
  { id: 'problem', label: 'Something isn\'t working', short: 'Problem', Icon: Wrench },
  { id: 'billing', label: 'Plans and payments', short: 'Billing', Icon: CreditCard },
  { id: 'question', label: 'How do I…?', short: 'Question', Icon: CircleHelp },
  { id: 'complaint', label: 'Make a complaint', short: 'Complaint', Icon: Frown },
  { id: 'idea', label: 'Suggest an idea', short: 'Idea', Icon: Lightbulb },
];
const supportWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const same = d.toLocaleDateString('en-CA', LAGOS_TIME) === now.toLocaleDateString('en-CA', LAGOS_TIME);
  return same ? d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
};
// Private screenshots load with the viewer's own login
function SupportImage({ path, token }) {
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let gone = false, made = '';
    fetch(`${SB_URL}/storage/v1/object/authenticated/support-files/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b && !gone) { made = URL.createObjectURL(b); setUrl(made); } }).catch(() => {});
    return () => { gone = true; if (made) URL.revokeObjectURL(made); };
  }, [path, token]);
  if (!url) return <div className="mt-2 w-40 h-24 rounded-xl flex items-center justify-center text-[11px]" style={{ background: 'rgba(var(--c-lo),calc(0.2 * var(--c-lok)))', color: C.inkFaint }}><ImagePlus size={15} className="mr-1.5" /> Screenshot</div>;
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-2 block"><img src={url} alt="Screenshot" className="max-w-[220px] max-h-[220px] rounded-xl object-cover" style={{ border: '1px solid rgba(var(--c-hi),0.12)' }} /></button>
      {open && <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: 'rgba(var(--c-lo),calc(0.9 * var(--c-lok)))' }} onClick={() => setOpen(false)}><img src={url} alt="Screenshot" className="max-w-full max-h-full rounded-xl" /></div>}
    </>
  );
}

// ============ Slot picker: a week calendar, then the free times for the chosen day grouped by part of the day ============
// When a chosen time ends: a group booking finishes when its last person is done (the calendar says when, for each time)
function calEndOf(cal, t) {
  if (cal?.group) for (const d of cal.days || []) { const i = (d.slots || []).indexOf(t); if (i >= 0 && d.ends && d.ends[i]) return d.ends[i]; }
  return new Date(new Date(t).getTime() + (cal?.minutes || 0) * 60000).toISOString();
}
function SlotPicker({ cal, day, onDay, slot, onSlot, light, scarcity = 'one', belowDay, chosenLabel }) {
  const P = light
    ? { ink: '#17191A', muted: '#6B706B', faint: '#B4B8B2', tile: '#F1F2EF', line: '#E6E8E4', pick: '#17191A', pickInk: '#fff', dot: '#1F7A5C', bg: '#fff' }
    : { ink: C.ink, muted: C.inkDim, faint: C.inkFaint, tile: C.surfaceRaised, line: C.line, pick: C.copper, pickInk: C.bg, dot: C.sage, bg: C.surface };
  const days = cal?.days || [];
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const todayStr = new Date().toLocaleDateString('sv-SE', LAGOS_TIME);
  // Monday-first weeks covering every day we have times for
  const addD = (ds, n) => { const x = new Date(ds + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const mondayOf = (ds) => { const x = new Date(ds + 'T12:00:00Z'); return addD(ds, -((x.getUTCDay() + 6) % 7)); };
  const first = mondayOf(todayStr), last = days.length ? days[days.length - 1].date : todayStr;
  const weeks = []; for (let w = first; w <= last; w = addD(w, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addD(w, i)));
  const weekOf = (ds) => Math.max(0, weeks.findIndex((wk) => wk.includes(ds)));
  const [week, setWeek] = useState(() => weekOf(day || todayStr));
  useEffect(() => { if (day) setWeek(weekOf(day)); }, [day]);
  const shown = weeks[week] || [];
  const monthLabel = (() => {
    const fmtM = (ds) => new Date(ds + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
    if (!shown.length) return '';
    const a = fmtM(shown[0]), b = fmtM(shown[6]);
    return a === b ? `${a} ${shown[0].slice(0, 4)}` : `${a.slice(0, 3)} – ${b.slice(0, 3)} ${shown[6].slice(0, 4)}`;
  })();
  const sel = byDate[day];
  const hourOf = (t) => Number(new Date(t).toLocaleTimeString('en-GB', { ...LAGOS_TIME, hour: '2-digit', hour12: false }).slice(0, 2));
  const groups = sel ? [['Morning', (h) => h < 12], ['Afternoon', (h) => h >= 12 && h < 17], ['Evening', (h) => h >= 17]]
    .map(([label, test]) => [label, sel.slots.map((t, i) => [t, (sel.left || [])[i]]).filter(([t]) => test(hourOf(t)))]).filter(([, list]) => list.length) : [];
  const cap = cal?.capacity || 1;
  const arrow = (dir, disabled) => (
    <button type="button" aria-label={dir < 0 ? 'Previous week' : 'Next week'} disabled={disabled} onClick={() => setWeek((w) => w + dir)}
      className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: disabled ? P.faint : P.ink, background: disabled ? 'transparent' : P.tile }}>
      {dir < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  );
  const endOf = (t) => calEndOf(cal, t);
  return (
    <div className="rounded-2xl p-3.5" style={{ border: `1px solid ${P.line}`, background: P.bg }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[13.5px] font-semibold" style={{ color: P.ink }}>{monthLabel}</span>
        <span className="flex items-center gap-1.5">{arrow(-1, week === 0)}{arrow(1, week >= weeks.length - 1)}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="tablist" aria-label="Day">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <span key={i} className="text-[10.5px] font-semibold pb-1" style={{ color: P.faint }}>{l}</span>)}
        {shown.map((ds) => {
          const d = byDate[ds]; const free = d && d.slots.length > 0; const on = ds === day; const isToday = ds === todayStr;
          return (
            <button key={ds} type="button" role="tab" aria-selected={on} aria-label={`${new Date(ds + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}${free ? `, ${d.slots.length} times free` : d && !d.open ? ', closed' : ', no free times'}`}
              disabled={!free} onClick={() => { onDay(ds); onSlot(''); }}
              className="relative aspect-square max-h-11 w-full mx-auto rounded-full flex flex-col items-center justify-center text-[13.5px] font-semibold transition-colors"
              style={on ? { background: P.pick, color: P.pickInk } : { color: free ? P.ink : P.faint, textDecoration: d && !d.open ? 'none' : undefined, outline: isToday && !on ? `1px solid ${P.line}` : 'none' }}>
              {Number(ds.slice(8))}
              {free && !on && <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ background: P.dot }} />}
            </button>
          );
        })}
      </div>
      {belowDay ? <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${P.line}` }}>{belowDay(sel)}</div> : (
      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${P.line}` }}>
        {!sel ? <div className="text-[12.5px] py-2 text-center" style={{ color: P.muted }}>Choose a day with a dot to see free times.</div> : (
          <>
            <div className="text-[12.5px] font-semibold mb-2" style={{ color: P.ink }}>{new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</div>
            <div className="space-y-2.5">
              {groups.map(([label, list]) => (
                <div key={label}>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: P.faint }}>{label}</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {list.map(([t, left]) => {
                      const on = slot === t; const few = !cal?.group && cap > 1 && left !== undefined && (scarcity === 'all' ? left < cap : left === 1);
                      return (
                        <button key={t} type="button" aria-pressed={on} onClick={() => onSlot(t)} className="py-2 rounded-lg text-[12.5px] font-semibold leading-tight"
                          style={on ? { background: P.pick, color: P.pickInk } : { background: P.tile, color: P.ink }}>
                          {apptTime(t)}{few && <span className="block text-[9.5px] font-medium" style={{ opacity: 0.75 }}>{scarcity === 'all' ? `${left} of ${cap} free` : '1 left'}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {slot && (
          <div className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2 text-[12.5px] font-semibold" style={{ background: P.tile, color: P.ink }}>
            <Check size={14} style={{ color: P.dot }} /> {chosenLabel ? chosenLabel(slot) : `${apptDay(slot)}, ${apptTime(slot)} to ${apptTime(endOf(slot))}`}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// ============ Branded dialogs: Xorla's own confirm and message boxes, instead of the browser's plain pop-ups ============
let dialogPush = null;
function brandDialog(opts) {
  return new Promise((resolve) => {
    if (!dialogPush) { resolve(opts.kind === 'confirm' ? window.confirm(opts.message) : (window.alert(opts.message), true)); return; }
    dialogPush({ ...opts, resolve });
  });
}
// brandConfirm('Remove "Laundry"? This can't be undone.', { confirm: 'Remove', danger: true }) → true / false
const brandConfirm = (message, o = {}) => brandDialog({ kind: 'confirm', message, ...o });
const brandAlert = (message, o = {}) => brandDialog({ kind: 'alert', message: String(message || 'Something went wrong. Please try again.'), ...o });
function splitTitle(message) {
  // "Close Main branch? It disappears from…" → title "Close Main branch?", body "It disappears from…"
  const m = String(message).match(/^(.{4,90}?[?])\s+([\s\S]+)$/);
  return m ? [m[1], m[2]] : [null, String(message)];
}
function BrandDialogHost() {
  const [queue, setQueue] = useState([]);
  const okRef = useRef(null);
  useEffect(() => { dialogPush = (d) => setQueue((q) => [...q, d]); return () => { dialogPush = null; }; }, []);
  const d = queue[0];
  const close = (v) => { if (!d) return; d.resolve(v); setQueue((q) => q.slice(1)); };
  useEffect(() => {
    if (!d) return undefined;
    okRef.current && okRef.current.focus();
    const onKey = (e) => { if (e.key === 'Escape') close(d.kind === 'confirm' ? false : true); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!d) return null;
  const light = d.theme === 'light';
  const P = light ? { bg: '#FFFFFF', ink: '#14201E', dim: '#55635F', line: 'rgba(0,0,0,0.1)', back: 'rgba(10,20,18,0.45)' } : { bg: C.surface, ink: C.ink, dim: C.inkDim, line: C.line, back: 'rgba(3,10,9,0.8)' };
  const [title, body] = d.title ? [d.title, d.message] : splitTitle(d.message);
  const accent = d.danger ? C.rust : light ? '#14201E' : C.copper;
  const Icon = d.kind === 'alert' ? (d.tone === 'info' ? Info : AlertCircle) : d.danger ? Trash2 : Check;
  const iconTone = d.kind === 'alert' && d.tone !== 'info' ? C.rust : d.danger ? C.rust : light ? '#14201E' : C.copper;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-5" style={{ background: P.back }} onClick={() => close(d.kind === 'confirm' ? false : true)}>
      <div role="alertdialog" aria-modal="true" aria-label={title || 'Message'} className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-6 xorla-fade-up" style={{ background: P.bg, border: `1px solid ${P.line}`, color: P.ink, fontFamily: "'Poppins', 'Inter', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3.5">
          <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: tint(iconTone, 0.13) }}><Icon size={18} style={{ color: iconTone }} /></span>
          <div className="min-w-0 pt-0.5">
            {title && <div className="text-[16px] font-semibold leading-snug mb-1">{title}</div>}
            <div className="text-[13.5px] leading-relaxed whitespace-pre-line max-h-[50vh] overflow-y-auto" style={{ color: title ? P.dim : P.ink, overflowWrap: 'anywhere' }}>{body}</div>
          </div>
        </div>
        <div className={`grid gap-2 mt-5 ${d.kind === 'confirm' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {d.kind === 'confirm' && <button onClick={() => close(false)} className="rounded-xl py-3 text-[14px] font-semibold" style={{ color: P.dim, border: `1px solid ${P.line}` }}>{d.cancel || 'Cancel'}</button>}
          <button ref={okRef} onClick={() => close(true)} className="rounded-xl py-3 text-[14px] font-semibold" style={{ background: accent, color: light && !d.danger ? '#fff' : d.danger ? '#fff' : C.bg }}>{d.confirm || (d.kind === 'confirm' ? 'Yes, continue' : 'OK')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Store links: by name today (xorla.vercel.app/amakastores); when Xorla has its own domain, set STORE_ROOT_DOMAIN
// (e.g. 'xorla.ng') and amakastores.xorla.ng opens the same store. Old /store/CODE links keep working.
const STORE_ROOT_DOMAIN = '';
const STORE_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const RIDER_VEHICLES = [
  ['bike', 'Motorbike', 'Okada / dispatch bike', Bike],
  ['tricycle', 'Tricycle', 'Keke', Truck],
  ['car', 'Car', 'For bigger orders', Car],
  ['van', 'Van', 'Bulk and heavy items', Truck],
  ['bicycle', 'Bicycle', 'Short trips', Bike],
];
const RIDER_ID_TYPES = [['nin', 'NIN', 'Slip or card'], ['drivers_licence', "Driver's licence", ''], ['voters_card', "Voter's card", ''], ['passport', 'Int. passport', '']];
async function riderBilling(token, action, extra = {}) {
  const res = await fetch(`${SB_URL}/functions/v1/billing`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...extra }) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error) throw new Error(d.error || 'Something went wrong. Please try again.');
  return d;
}
const riderInitials = (n) => String(n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// ============ The Xorla home page (what new visitors see at xorla.vercel.app) ============
// Logged-in owners and staff never see it: they go straight to their dashboard.
// Light and dark: follows the phone's setting until the visitor picks one. Colours are CSS variables, so one switch re-colours everything.
const LP_THEMES = {
  light: { bg: '#FFFFFF', bg2: '#F4F8F6', card: '#FFFFFF', tint: '#E3F4EF', deep: '#0B3B33', ink: '#0B2B26', dim: '#4A5E59', faint: '#7F918C', line: 'rgba(11,43,38,0.10)', btn: '#0B3B33', btnInk: '#FFFFFF', accent: '#0E9F8E', nav: 'rgba(255,255,255,0.78)', wa: '#DCF8C6', waInk: '#0B2B26', dots: 'rgba(11,43,38,0.09)', shadow: 'rgba(11,43,38,0.45)', glow: 'rgba(31,217,196,0)' },
  dark: { bg: '#071A17', bg2: '#0B221E', card: '#0F2925', tint: '#12352F', deep: '#0F3A33', ink: '#EAF6F2', dim: '#A6C0BA', faint: '#6E8B85', line: 'rgba(255,255,255,0.09)', btn: '#1FD9C4', btnInk: '#062520', accent: '#1FD9C4', nav: 'rgba(7,26,23,0.72)', wa: '#005C4B', waInk: '#E9FFF6', dots: 'rgba(255,255,255,0.06)', shadow: 'rgba(0,0,0,0.75)', glow: 'rgba(31,217,196,0.22)' },
};
const LP = Object.fromEntries(Object.keys(LP_THEMES.light).map((k) => [k, `var(--lp-${k})`]));
Object.assign(LP, { amber: '#FFB020', teal: '#1FD9C4', coral: '#F4845F', paper: '#FFFDF6', forest: '#0B3B33', inkFixed: '#0B2B26' });

// ============ Routes load on demand, so each visitor downloads only the screens they use ============
// If Xorla was updated while this page was open, the old screen files are gone: reload once to get the new ones
function loadRoute(load, name) {
  return React.lazy(() => load().then((m) => ({ default: m[name] })).catch((e) => {
    let tried = false;
    try { tried = sessionStorage.getItem('xorla:route-reload') === '1'; sessionStorage.setItem('xorla:route-reload', '1'); } catch (x) {}
    if (!tried && typeof navigator !== 'undefined' && navigator.onLine !== false) { window.location.reload(); return new Promise(() => {}); }
    throw e;
  }));
}
try { sessionStorage.removeItem('xorla:route-reload'); } catch (e) {}
const XorlaApp = loadRoute(() => import('./routes/business.jsx'), 'XorlaApp');
const AdminDashboard = loadRoute(() => import('./routes/admin.jsx'), 'AdminDashboard');
const Storefront = loadRoute(() => import('./routes/store.jsx'), 'Storefront');
const StoreBySlug = loadRoute(() => import('./routes/store.jsx'), 'StoreBySlug');
const CustomerOrder = loadRoute(() => import('./routes/customer.jsx'), 'CustomerOrder');
const GuestBooking = loadRoute(() => import('./routes/customer.jsx'), 'GuestBooking');
const AppointmentOffer = loadRoute(() => import('./routes/customer.jsx'), 'AppointmentOffer');
const LandingPage = loadRoute(() => import('./routes/public.jsx'), 'LandingPage');
const PricingPage = loadRoute(() => import('./routes/public.jsx'), 'PricingPage');
const LegalPage = loadRoute(() => import('./routes/public.jsx'), 'LegalPage');
const RiderApp = loadRoute(() => import('./routes/rider.jsx'), 'RiderApp');
const CacAgentPage = loadRoute(() => import('./routes/shared.jsx'), 'CacAgentPage');
const VaultShared = loadRoute(() => import('./routes/shared.jsx'), 'VaultShared');

// While a screen's code downloads: the page colour only, so nothing flashes
function RouteLoading() {
  return <div style={{ minHeight: '100vh' }} aria-busy="true" />;
}


export default function Root() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const storeMatch = path.match(/^\/store\/([A-Za-z0-9]+)/);
  const clean = path.replace(/\/+$/, '');
  const offerMatch = path.match(/^\/appt\/([a-f0-9]{20,64})/);
  // A store opened by its name: /amakastores, or amakastores.<STORE_ROOT_DOMAIN>
  const slugMatch = path.match(/^\/([A-Za-z0-9-]{3,30})\/?$/);
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const storeSub = STORE_ROOT_DOMAIN && host.endsWith(`.${STORE_ROOT_DOMAIN}`) && clean === '' ? host.slice(0, -STORE_ROOT_DOMAIN.length - 1).toLowerCase().replace(/^(www|app)$/, '') : '';
  const guestMatch = path.match(/^\/booking\/([a-f0-9]{20,64})/);
  const orderMatch = path.match(/^\/order\/([a-f0-9]{20,64})/);
  const docsMatch = path.match(/^\/docs\/([a-f0-9]{32})/);
  const agentMatch = path.match(/^\/agent\/([a-f0-9]{64})/);
  // New visitors to the main address see the home page; anyone logged in (or using the installed app) goes straight in
  const showLanding = clean === '' && typeof window !== 'undefined' && !window.location.search && (() => {
    try { if (localStorage.getItem(SESSION_KEY)) return false; } catch (e) { return false; }
    try { if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) return false; } catch (e) {}
    return true;
  })();
  const page = /^\/(ride|riders?)$/.test(clean) ? <RiderApp /> : agentMatch ? <CacAgentPage token={agentMatch[1]} /> : docsMatch ? <VaultShared token={docsMatch[1]} /> : offerMatch ? <AppointmentOffer token={offerMatch[1]} /> : guestMatch ? <GuestBooking token={guestMatch[1]} /> : orderMatch ? <CustomerOrder token={orderMatch[1]} /> : storeMatch ? <Storefront businessCode={storeMatch[1]} />
    : clean === '/pricing' ? <PricingPage />
    : clean === '/privacy' ? <LegalPage kind="privacy" />
    : clean === '/terms' ? <LegalPage kind="terms" />
    : clean === '/admin' ? <AdminDashboard />
    : clean === '/login' ? <XorlaApp />
    : storeSub ? <StoreBySlug slug={storeSub} />
    : slugMatch && STORE_SLUG_RE.test(slugMatch[1].toLowerCase()) ? <StoreBySlug slug={slugMatch[1].toLowerCase()} />
    : showLanding ? <LandingPage />
    : <XorlaApp />;
  return <><React.Suspense fallback={<RouteLoading />}>{page}</React.Suspense><BrandDialogHost /></>;
}

export { BOOKED_GUEST_NOTE, BrandSelect, C, CAC_STATUS, CAC_SUGGEST, EVENT_TIMES, HALF_HOURS, LAGOS_TIME, LAUNDRY_COLLECT_NOTE, LAUNDRY_DROP_NOTE, LP, LP_THEMES, LazyChart, NG_LGAS, NG_STATES, PASSWORD_MIN_LENGTH, PERSON_WORDS, PLAN_PRICES, PasswordChecks, PasswordInput, RIDER_ID_TYPES, RIDER_VEHICLES, S, SB_KEY, SB_URL, SERVICE_KINDS, SESSION_KEY, SF_FONT, SPOT_CTA, SPOT_TONES, STAY_SERVICE_RE, STORE_ROOT_DOMAIN, SUPPORT, SUPPORT_TOPICS, Sheet, SlotPicker, SupportImage, ThemeToggle, TypingBubble, UPDATE_KIND, VAULT_KINDS, VaultArt, XorlaMark, XorlaSpotlight, apptDay, apptTime, base64UrlToUint8Array, brandAlert, brandConfirm, cacDocUrl, cacUpload, calEndOf, cleanOptions, displayLocationName, eventEndAfter, eventTimeLabel, examplesFor, fmt, formatNumInput, formatPhoneDisplay, friendlyAuthError, fromSbProduct, hasOptions, hhmmLabel, invoiceLineItems, invoiceSubtotal, isBookable, kindOf, laundryCollect, laundryDrop, loadSession, locationWords, netFetch, noteWithout, optionAddon, optionCombos, optionWords, parseNumInput, passwordError, planPrice, priceLabel, rentsByDay, resizeImageToBlob, riderBilling, riderInitials, saveSession, sbRecover, sbRefresh, sbRpc, sbSignIn, sbSignUp, shadow, stayServiceKind, supportWhen, tint, toWhatsAppNumber, todayKey, useXorlaTheme, vaultDaysLeft, vaultExpiry, vaultFileUrl };
