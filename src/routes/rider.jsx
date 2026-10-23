// Xorla: rider screens (loaded only when needed). Shared code lives in ../App.jsx.
import { Bike, BadgeCheck, Clock, Pencil, Lock, Ban, MapPin, Bell, ChevronRight, ArrowRight, Package, Check, Phone, MessageCircle, X, Loader2, CameraOff, RotateCcw, LogOut, ChevronLeft, EyeOff, Eye, Store, ShieldCheck, AlertCircle, ImagePlus, Contact, ScanFace, Landmark, Search, Download, Share } from 'lucide-react';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BrandSelect, C, NG_LGAS, NG_STATES, PASSWORD_MIN_LENGTH, RIDER_ID_TYPES, RIDER_VEHICLES, SB_KEY, SB_URL, XorlaMark, base64UrlToUint8Array, brandConfirm, fmt, formatPhoneDisplay, resizeImageToBlob, riderBilling, riderInitials, sbRecover, sbRefresh, sbRpc, sbSignIn, sbSignUp, toWhatsAppNumber, vaultFileUrl } from '../App.jsx';

// ============ The Xorla rider network: sign-up for delivery riders (xorla.vercel.app/ride) ============
// Riders have their own login, kept apart from business accounts on this phone.
// Phase 1: apply, get checked by the Xorla team, get approved. Jobs open city by city later.
const RIDER_SESSION_KEY = 'xorla:rider-session';
// Optional: a WhatsApp number riders can message (international format, e.g. 2348031234567). Leave empty to hide the button.
const RIDER_SUPPORT_WHATSAPP = '';
const RIDER_RELATIONS = ['Parent', 'Brother or sister', 'Uncle or aunt', 'Employer', 'Religious leader', 'Community leader', 'Other'];
const RIDER_STEPS = [['you', 'You'], ['ride', 'Your ride'], ['id', 'ID & selfie'], ['guarantor', 'Guarantor'], ['bank', 'Bank & send']];

async function riderUpload(token, uid, file, kind) {
  const pdf = file.type === 'application/pdf';
  if (pdf && file.size > 5.5 * 1024 * 1024) throw new Error('That PDF is too large. Use one under 5 MB.');
  const blob = pdf ? file : await resizeImageToBlob(file, 1600, 0.85);
  const path = `${uid}/${kind}-${Date.now()}.${pdf ? 'pdf' : 'jpg'}`;
  const res = await fetch(`${SB_URL}/storage/v1/object/rider-docs/${path}`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${token}`, 'Content-Type': pdf ? 'application/pdf' : 'image/jpeg' }, body: blob });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "That photo didn't upload. Check your connection and try again."); }
  return path;
}

const RIDER_FONT = "'Poppins', 'Inter', system-ui, sans-serif";
const RIDER_DISPLAY = "'Unbounded', 'Inter', system-ui, sans-serif";
const RIDER_LIGHT = {
  bg: '#FBF9F4', surface: '#FFFFFF', surfaceRaised: '#F5F3ED', field: '#F3F1EA', chip: '#F1EFE8', track: '#E7E4DB', mint: '#E3F4EF',
  line: 'rgba(11,43,38,0.09)', lineStrong: 'rgba(11,43,38,0.16)', ink: '#0B2B26', inkDim: '#52645F', inkFaint: '#8C9A96',
  copper: '#0B3B33', copperSoft: 'rgba(11,59,51,0.07)', sage: '#0E9F8E', sageSoft: 'rgba(14,159,142,0.12)', amber: '#F5A300',
  rust: '#D14B34', rustSoft: 'rgba(209,75,52,0.10)',
};
// Illustrations for the rider pages, drawn for Xorla (flat, outlined, brand colours)
function RiderHeroArt({ className = '' }) {
  return (
    <svg viewBox="0 0 560 420" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="A Xorla rider on a motorbike with a delivery box">

  <path d="M120 120 C 170 40, 330 30, 420 80 C 510 130, 540 230, 480 300 C 420 370, 250 390, 160 350 C 70 310, 70 200, 120 120 Z" fill="#E3F4EF"/>
  <path d="M86 92 h44 a14 14 0 0 0 -14 -18 a18 18 0 0 0 -32 6 a10 10 0 0 0 2 12 z" fill="#fff" stroke="#0B2B26" strokeWidth="2.5"/>
  <path d="M430 60 h62 a16 16 0 0 0 -16 -20 a22 22 0 0 0 -40 4 a12 12 0 0 0 -6 16 z" fill="#fff" stroke="#0B2B26" strokeWidth="2.5"/>
  
  <path d="M60 356 h40 M130 356 h60 M220 356 h120 M370 356 h60 M460 356 h40" stroke="#0B2B26" strokeWidth="2.5" opacity="0.25"/>
  <path className="rd-speed" d="M34 246 h46 M18 272 h70 M46 298 h40" stroke="#0B2B26" strokeWidth="3"/>
  
  <g stroke="#0B2B26" strokeWidth="3">
    <circle cx="170" cy="316" r="38" fill="#FFB020"/><circle cx="170" cy="316" r="14" fill="#fff"/>
    <circle cx="404" cy="316" r="38" fill="#FFB020"/><circle cx="404" cy="316" r="14" fill="#fff"/>
  </g>
  
  <path d="M128 300 C 134 266, 206 262, 214 292" stroke="#0B2B26" strokeWidth="3" fill="none"/>
  <path d="M372 282 C 386 262, 420 262, 436 284" stroke="#0B2B26" strokeWidth="3" fill="#fff"/>
  
  <path d="M130 236 L 140 262 M206 236 L 196 262" stroke="#0B2B26" strokeWidth="4"/>
  <rect x="100" y="140" width="122" height="96" rx="12" fill="#0B3B33" stroke="#0B2B26" strokeWidth="3"/>
  <path d="M100 168 h122" stroke="#1FD9C4" strokeWidth="3"/>
  <rect x="112" y="150" width="30" height="8" rx="4" fill="#1FD9C4" opacity="0.5"/>
  <g transform="translate(146 182)">
    <path d="M0 0 L15 20 L0 40" stroke="#1FD9C4" strokeWidth="7"/>
    <path d="M30 0 L15 20 L30 40" stroke="#FFB020" strokeWidth="7"/>
  </g>
  
  <path d="M146 300 C 150 262, 192 248, 236 248 L 318 250 C 334 250, 342 262, 344 276 L 348 300 Z" fill="#fff" stroke="#0B2B26" strokeWidth="3"/>
  
  <path d="M330 252 C 344 238, 356 224, 366 208 L 382 214 C 376 240, 366 262, 352 282 Z" fill="#fff" stroke="#0B2B26" strokeWidth="3"/>
  <rect x="236" y="278" width="62" height="28" rx="8" fill="#DDE4E1" stroke="#0B2B26" strokeWidth="3"/>
  <path d="M248 288 h38 M248 297 h38" stroke="#0B2B26" strokeWidth="2"/>
  <path d="M176 304 h70" stroke="#0B2B26" strokeWidth="7"/>
  
  <path d="M404 316 L 370 206" stroke="#0B2B26" strokeWidth="6"/>
  <path d="M352 206 h34" stroke="#0B2B26" strokeWidth="6"/>
  <path d="M372 204 L 378 178" stroke="#0B2B26" strokeWidth="3"/>
  <ellipse cx="380" cy="172" rx="9" ry="6" fill="#fff" stroke="#0B2B26" strokeWidth="3"/>
  <circle cx="394" cy="232" r="11" fill="#FFE7A8" stroke="#0B2B26" strokeWidth="3"/>
  <path d="M412 226 l18 -6 M414 236 h20 M412 246 l18 6" stroke="#FFB020" strokeWidth="3"/>
  
  <path d="M206 246 C 214 234, 268 234, 288 242 L 288 252 L 206 252 Z" fill="#0B2B26"/>
  
  <path d="M248 238 C 274 236, 302 242, 316 264 L 326 294" stroke="#0B2B26" strokeWidth="26"/>
  <path d="M248 238 C 274 236, 302 242, 316 264 L 326 294" stroke="#174C42" strokeWidth="20"/>
  <path d="M316 300 h30" stroke="#0B2B26" strokeWidth="12"/>
  
  <path d="M232 240 C 224 200, 236 166, 262 150 C 286 138, 308 150, 312 172 C 316 198, 302 224, 298 242 Z" fill="#1FD9C4" stroke="#0B2B26" strokeWidth="3"/>
  <path d="M236 212 C 256 206, 286 206, 308 212" stroke="#FFB020" strokeWidth="7"/>
  <path d="M236 212 C 256 206, 286 206, 308 212" stroke="#0B2B26" strokeWidth="1.5" opacity="0.3"/>
  
  <path d="M292 170 C 318 182, 342 196, 358 206" stroke="#0B2B26" strokeWidth="22"/>
  <path d="M292 170 C 318 182, 342 196, 358 206" stroke="#1FD9C4" strokeWidth="16"/>
  <circle cx="362" cy="208" r="9" fill="#8D5A3B" stroke="#0B2B26" strokeWidth="2.5"/>
  
  <path d="M276 150 v-14" stroke="#0B2B26" strokeWidth="16"/><path d="M276 150 v-14" stroke="#8D5A3B" strokeWidth="10"/>
  <circle cx="282" cy="116" r="24" fill="#8D5A3B" stroke="#0B2B26" strokeWidth="3"/>
  <path d="M256 112 C 254 84, 274 72, 294 76 C 312 80, 320 96, 312 110 Z" fill="#FFB020" stroke="#0B2B26" strokeWidth="3"/>
  <path d="M262 92 C 270 82, 284 78, 296 80" stroke="#fff" strokeWidth="3" opacity="0.7"/>
  <path d="M260 112 C 262 124, 266 132, 272 136" stroke="#0B2B26" strokeWidth="2.5"/>
  <circle cx="296" cy="118" r="2.6" fill="#0B2B26"/>
  <path d="M292 128 q6 5 12 -1" stroke="#0B2B26" strokeWidth="2.5"/>
  
  <g className="rd-bob"><g transform="translate(418 116) rotate(-10)">
    <rect width="46" height="40" rx="6" fill="#fff" stroke="#0B2B26" strokeWidth="2.5"/>
    <path d="M0 13 h46 M23 0 v13" stroke="#0B2B26" strokeWidth="2.5"/>
  </g>
  </g><g className="rd-bob2"><g transform="translate(476 178)">
    <path d="M14 0 C 26 0, 30 12, 26 20 L 14 40 L 2 20 C -2 12, 2 0, 14 0 Z" fill="#E2624B" stroke="#0B2B26" strokeWidth="2.5"/>
    <circle cx="14" cy="14" r="5" fill="#fff"/>
  </g>
  </g><path d="M440 210 C 470 220, 470 250, 446 262" stroke="#0B2B26" strokeWidth="2" strokeDasharray="4 7" opacity="0.5"/>
  <g transform="translate(476 302)">
    <path d="M0 52 C -6 24, 6 6, 26 0 C 30 22, 22 42, 0 52 Z" fill="#2E7D5B" stroke="#0B2B26" strokeWidth="2.5"/>
    <path d="M10 52 C 22 34, 42 30, 58 36 C 50 52, 30 58, 10 52 Z" fill="#7CC4A0" stroke="#0B2B26" strokeWidth="2.5"/>
  </g>
  <g transform="translate(36 318)">
    <path d="M20 40 C 6 30, 2 12, 10 0 C 24 10, 28 26, 20 40 Z" fill="#7CC4A0" stroke="#0B2B26" strokeWidth="2.5"/>
  </g>

    </svg>
  );
}
function RiderSpotMap({ className = '' }) {
  return <svg viewBox="0 0 124 104" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden><defs><clipPath id="rmapclip"><rect x="11" y="15" width="102" height="78" rx="11"/></clipPath></defs>
  <rect x="10" y="14" width="104" height="80" rx="12" fill="#E3F4EF" stroke="#0B2B26" strokeWidth="2.5"/>
  <g clipPath="url(#rmapclip)"><path d="M10 46 C 40 40, 60 70, 114 58" stroke="#fff" strokeWidth="8"/>
  <path d="M46 14 C 50 40, 70 60, 66 94" stroke="#fff" strokeWidth="8"/></g>
  <path d="M28 76 C 44 70, 52 50, 70 46 S 92 30, 96 30" stroke="#0B2B26" strokeWidth="2.5" strokeDasharray="5 6"/>
  <circle cx="28" cy="76" r="6" fill="#1FD9C4" stroke="#0B2B26" strokeWidth="2.5"/>
  <path d="M96 10 C 106 10, 110 20, 106 26 L 96 42 L 86 26 C 82 20, 86 10, 96 10 Z" fill="#FFB020" stroke="#0B2B26" strokeWidth="2.5"/>
  <circle cx="96" cy="21" r="4" fill="#fff"/></svg>;
}
function RiderSpotPay({ className = '' }) {
  return <svg viewBox="0 0 124 110" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
  <rect x="22" y="8" width="56" height="94" rx="12" fill="#fff" stroke="#0B2B26" strokeWidth="2.5"/>
  <path d="M42 16 h16" stroke="#0B2B26" strokeWidth="2.5"/>
  <rect x="30" y="30" width="40" height="30" rx="6" fill="#E3F4EF"/>
  <text x="50" y="51" textAnchor="middle" fontFamily="Inter, Arial" fontWeight="800" fontSize="16" fill="#0B3B33">₦</text>
  <path d="M32 70 h36 M32 80 h24" stroke="#0B2B26" strokeWidth="2.5" opacity="0.35"/>
  <circle cx="90" cy="36" r="16" fill="#FFB020" stroke="#0B2B26" strokeWidth="2.5"/>
  <text x="90" y="42" textAnchor="middle" fontFamily="Inter, Arial" fontWeight="800" fontSize="16" fill="#0B2B26">₦</text>
  <circle cx="98" cy="70" r="12" fill="#FFD27A" stroke="#0B2B26" strokeWidth="2.5"/>
  <path d="M6 44 l8 4 M4 60 h9" stroke="#0B2B26" strokeWidth="2.5"/></svg>;
}
function RiderSpotSafe({ className = '' }) {
  return <svg viewBox="0 0 124 100" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
  <rect x="6" y="40" width="70" height="48" rx="8" fill="#fff" stroke="#0B2B26" strokeWidth="2.5"/>
  <circle cx="26" cy="62" r="9" fill="#8D5A3B" stroke="#0B2B26" strokeWidth="2"/>
  <path d="M42 56 h24 M42 66 h16" stroke="#0B2B26" strokeWidth="2.5" opacity="0.5"/>
  <path d="M84 10 L 116 22 V 50 C 116 72, 100 86, 84 94 C 68 86, 52 72, 52 50 V 22 Z" fill="#1FD9C4" stroke="#0B2B26" strokeWidth="2.5"/>
  <path d="M70 52 l10 10 l18 -20" stroke="#0B2B26" strokeWidth="4"/></svg>;
}

// The rider's pass: fills in as they apply, and becomes their verified card once approved
function RiderPass({ r, photo, compact = false }) {
  const v = RIDER_VEHICLES.find(([k]) => k === r?.vehicle);
  const VIcon = v ? v[3] : Bike;
  const status = r?.status || 'draft';
  const stamp = status === 'approved' ? ['Verified rider', C.sage, BadgeCheck] : status === 'submitted' ? ['Being checked', C.copper, Clock] : status === 'needs_fix' ? ['Needs a fix', C.rust, Pencil]
    : status === 'suspended' ? ['Paused', C.rust, Lock] : status === 'rejected' ? ['Not approved', C.rust, Ban] : ['Application', C.inkDim, Pencil];
  const StampIcon = stamp[2];
  return (
    <div className={`relative overflow-hidden rounded-[24px] ${compact ? 'p-4' : 'p-5'}`} style={{ background: 'linear-gradient(145deg, #143D35 0%, #0E2B26 55%, #0B231F 100%)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 30px 60px -30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
      <span aria-hidden className="absolute -right-16 -top-16 w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,176,32,0.22), transparent 65%)' }} />
      <span aria-hidden className="absolute -left-10 -bottom-20 w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(31,217,196,0.16), transparent 65%)' }} />
      <svg aria-hidden className="absolute right-0 bottom-0 opacity-[0.07]" width="220" height="120" viewBox="0 0 220 120" fill="none"><path d="M0 110 C 60 110, 70 40, 130 40 S 200 10, 220 10" stroke="#fff" strokeWidth="2" strokeDasharray="6 8" /><circle cx="130" cy="40" r="5" fill="#fff" /></svg>
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2"><XorlaMark size={20} /><span className="text-[11px] font-bold tracking-[0.18em]" style={{ color: C.inkDim }}>XORLA RIDER</span></div>
        <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10.5px] font-bold" style={{ background: 'rgba(0,0,0,0.3)', color: stamp[1], border: `1px solid ${stamp[1]}40` }}><StampIcon size={11} />{stamp[0]}</span>
      </div>
      <div className={`relative flex items-center gap-4 ${compact ? 'mt-4' : 'mt-5'}`}>
        <div className={`${compact ? 'w-16 h-16' : 'w-[76px] h-[76px]'} rounded-2xl overflow-hidden shrink-0 flex items-center justify-center`} style={{ background: 'rgba(255,255,255,0.06)', border: `2px solid ${status === 'approved' ? C.sage : 'rgba(255,255,255,0.12)'}` }}>
          {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : <span className="text-[22px] font-bold" style={{ color: C.inkDim }}>{riderInitials(r?.full_name)}</span>}
        </div>
        <div className="min-w-0">
          <div className={`${compact ? 'text-[17px]' : 'text-[20px]'} font-bold leading-tight truncate`} style={{ letterSpacing: '-0.01em', color: r?.full_name ? C.ink : C.inkFaint }}>{r?.full_name || 'Your name'}</div>
          <div className="flex items-center gap-1.5 mt-1 text-[12.5px]" style={{ color: C.inkDim }}><VIcon size={14} style={{ color: C.copper }} />{v ? v[1] : 'Your ride'}{r?.plate_number ? <span className="cx-mono px-1.5 py-0.5 rounded-md text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.07)', color: C.ink }}>{r.plate_number}</span> : null}</div>
          <div className="flex items-center gap-1.5 mt-1 text-[12px] truncate" style={{ color: C.inkFaint }}><MapPin size={12} />{(r?.areas || []).length ? `${r.areas.slice(0, 2).join(', ')}${r.areas.length > 2 ? ` +${r.areas.length - 2}` : ''}` : 'Your areas'}</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Approved riders: the job board, the job in hand, and earnings ----------
const RIDER_JOB_POLL = 12000;
function jobAgo(t) { const m = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`; }
function riderTime(t) { return t ? new Date(t).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : ''; }
function RiderCodeBox({ label, hint, busy, onSubmit, error }) {
  const [code, setCode] = useState('');
  const C = RIDER_LIGHT;
  return (
    <div className="mt-3 rounded-2xl p-3.5" style={{ background: C.field }}>
      <div className="text-[13px] font-bold">{label}</div>
      <div className="text-[12px] mt-0.5 leading-snug" style={{ color: C.inkDim }}>{hint}</div>
      <div className="mt-2.5 flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" placeholder="• • • •" aria-label={label}
          className="flex-1 min-w-0 h-12 rounded-xl px-4 text-[22px] font-bold tracking-[0.5em] text-center outline-none" style={{ background: C.surface, border: `1.5px solid ${error ? C.rust : C.lineStrong}`, color: C.ink, fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }} />
        <button type="button" disabled={busy || code.length !== 4} onClick={() => onSubmit(code, () => setCode(''))} className="shrink-0 h-12 px-5 rounded-xl text-[14px] font-bold" style={{ background: C.copper, color: '#fff', opacity: busy || code.length !== 4 ? 0.45 : 1 }}>{busy ? '…' : 'Confirm'}</button>
      </div>
      {error && <div className="mt-2 text-[12.5px] font-semibold" style={{ color: C.rust }}>{error}</div>}
    </div>
  );
}
// Install the app and job alerts: two taps that make riding with Xorla easier
const riderIsStandalone = () => { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; } };
const riderIsIOS = () => { try { const ua = navigator.userAgent || ''; return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1); } catch (e) { return false; } };
const riderNotifState = () => { try { if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'; return Notification.permission; } catch (e) { return 'unsupported'; } };
const RIDER_SETUP_HIDE = 'xorla:rider-setup-later';
function RiderSetup({ withAlerts, alertsOn, onAlerts, alertsBusy }) {
  const C = RIDER_LIGHT;
  const [installed, setInstalled] = useState(riderIsStandalone);
  const [offer, setOffer] = useState(() => (typeof window !== 'undefined' ? window.__xorlaInstall || null : null));
  const [steps, setSteps] = useState(false);
  const [notif, setNotif] = useState(riderNotifState);
  const [later, setLater] = useState(() => { try { return Number(localStorage.getItem(RIDER_SETUP_HIDE) || 0) > Date.now(); } catch (e) { return false; } });
  const ios = riderIsIOS();
  useEffect(() => {
    const ready = () => { setOffer(window.__xorlaInstall || null); if (!window.__xorlaInstall && riderIsStandalone()) setInstalled(true); };
    const done = () => setInstalled(true);
    window.addEventListener('xorla-install-ready', ready); window.addEventListener('appinstalled', done);
    const back = () => setNotif(riderNotifState());
    document.addEventListener('visibilitychange', back);
    return () => { window.removeEventListener('xorla-install-ready', ready); window.removeEventListener('appinstalled', done); document.removeEventListener('visibilitychange', back); };
  }, []);
  useEffect(() => { setNotif(riderNotifState()); }, [alertsOn]);
  const install = async () => {
    if (offer && offer.prompt) {
      try { offer.prompt(); const r = await offer.userChoice; if (r && r.outcome === 'accepted') setInstalled(true); } catch (e) {}
      window.__xorlaInstall = null; setOffer(null);
      return;
    }
    setSteps(true);
  };
  // iPhones only show alerts from an installed app
  const alertsNeedInstall = ios && !installed;
  const alertsDone = !withAlerts || alertsOn || notif === 'unsupported' && !alertsNeedInstall;
  if (installed && alertsDone) return null;
  if (later) return null;
  const row = (done, Ic, title, body, action, first) => (
    <div className={`flex items-start gap-3 ${first ? 'pb-3 last:pb-0' : 'pt-3'}`} style={first ? undefined : { borderTop: `1px solid ${C.line}` }}>
      <span className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ background: done ? C.sageSoft : C.copperSoft }}>{done ? <Check size={17} style={{ color: C.sage }} /> : <Ic size={17} style={{ color: C.copper }} />}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold leading-snug">{title}</div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: C.inkDim }}>{body}</div>
        {action}
      </div>
    </div>
  );
  const btn = (label, onClick, disabled) => <button type="button" onClick={onClick} disabled={disabled} className="mt-2.5 min-h-[40px] px-4 rounded-xl text-[13px] font-bold inline-flex items-center gap-1.5 disabled:opacity-60" style={{ background: C.copper, color: '#fff' }}>{disabled && <Loader2 size={14} className="animate-spin" />}{label}</button>;
  const blocked = (
    <div className="mt-2 rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed" style={{ background: C.rustSoft, color: C.ink }}>
      Alerts are blocked on this phone. {ios ? 'Open Settings, then Notifications, find Xorla Rider and turn on Allow Notifications.' : 'Tap the lock or ⓘ beside the web address (or the ⋮ menu, then Settings, then Site settings), choose Notifications and set it to Allow. Then come back here.'}
    </div>
  );
  return (
    <div className="mt-4 rounded-[22px] p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 min-w-0 text-[15px] font-extrabold" style={{ letterSpacing: '-0.01em' }}>Set up your phone</div>
        <button type="button" onClick={() => { try { localStorage.setItem(RIDER_SETUP_HIDE, String(Date.now() + 3 * 864e5)); } catch (e) {} setLater(true); }} className="shrink-0 min-h-[32px] px-2 text-[12.5px] font-semibold" style={{ color: C.inkFaint }}>Later</button>
      </div>
      <div>
        {row(installed, Download, installed ? 'Xorla Rider is installed' : 'Install Xorla Rider',
          installed ? 'Open it from your home screen any time.' : 'Opens in one tap from your home screen, like WhatsApp. Uses very little data and space.',
          !installed && btn(offer || !ios ? 'Install app' : 'Show me how', install), true)}
        {withAlerts && row(alertsOn, Bell, alertsOn ? 'Job alerts are on' : 'Turn on job alerts',
          alertsOn ? "We'll buzz you when a job opens near you." : 'Your phone buzzes the moment a job opens near you, even when Xorla is closed. The first rider to accept gets it.',
          alertsOn ? null : alertsNeedInstall ? <div className="mt-2 text-[12.5px] font-semibold" style={{ color: C.copper }}>On iPhone, install the app first, then open it and turn alerts on here.</div>
            : notif === 'denied' ? blocked
            : notif === 'unsupported' ? <div className="mt-2 text-[12.5px]" style={{ color: C.inkDim }}>This browser can't show alerts. Open this page in Chrome to get them.</div>
            : btn(alertsBusy ? 'Turning on…' : 'Turn on alerts', onAlerts, alertsBusy))}
      </div>
      {steps && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3" style={{ background: 'rgba(11,43,38,0.45)', fontFamily: RIDER_FONT }} onClick={() => setSteps(false)}>
          <div role="dialog" aria-modal="true" aria-label="Install Xorla Rider" className="w-full max-w-sm rounded-[22px] p-5" style={{ background: C.surface, color: C.ink }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><div className="flex-1 text-[17px] font-extrabold">Install Xorla Rider</div><button type="button" aria-label="Close" onClick={() => setSteps(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.chip }}><X size={16} /></button></div>
            <ol className="mt-3 space-y-2.5 text-[14px] leading-relaxed">
              {(ios
                ? [<>Open this page in <strong>Safari</strong>.</>, <>Tap the <strong>Share</strong> button <Share size={14} className="inline -mt-0.5" /> at the bottom of the screen.</>, <>Scroll down and tap <strong>Add to Home Screen</strong>.</>, <>Tap <strong>Add</strong>. Xorla Rider is now on your home screen.</>]
                : [<>Open this page in <strong>Chrome</strong>.</>, <>Tap the <strong>⋮</strong> menu at the top right.</>, <>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</>, <>Tap <strong>Install</strong>. Xorla Rider is now on your home screen.</>]
              ).map((t, i) => <li key={i} className="flex gap-3"><span className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[12px] font-bold" style={{ background: C.copperSoft, color: C.copper }}>{i + 1}</span><span>{t}</span></li>)}
            </ol>
            <button type="button" onClick={() => setSteps(false)} className="mt-4 w-full h-11 rounded-xl text-[14px] font-bold" style={{ background: C.copper, color: '#fff' }}>Got it</button>
          </div>
        </div>, document.body)}
    </div>
  );
}
// Where a rider picks up, whether they take long trips, and how far they'll go; moving to another state is a request to the Xorla team
const RIDER_RANGES = [['nearby', 'Nearby only', 'Drop-offs within about 15 km of the pick-up'], ['state', 'Anywhere in my state', 'Any drop-off in the same state'], ['any', 'Other states too', 'Including trips into another state']];
function RiderReachSheet({ call, reach, onClose, onSaved }) {
  const C = RIDER_LIGHT;
  const [areas, setAreas] = useState(reach.areas || []);
  const [longTrips, setLongTrips] = useState(!!reach.long_trips);
  const [range, setRange] = useState(reach.drop_range || 'state');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [moving, setMoving] = useState(false);
  const [mv, setMv] = useState({ state: '', lga: '', areas: [], address: '', note: '' });
  const move = reach.move && reach.move.status === 'pending' ? reach.move : null;
  const lastMove = reach.move && reach.move.status !== 'pending' && reach.move.decided_at && Date.now() - new Date(reach.move.decided_at).getTime() < 14 * 864e5 ? reach.move : null;
  const field = { background: C.field, border: `1.5px solid ${C.field}`, color: C.ink };
  const chip = (on) => (on ? { background: C.copper, color: '#fff', border: `1px solid ${C.copper}` } : { background: C.surface, color: C.inkDim, border: `1px solid ${C.lineStrong}` });
  const toggle = (list, set, l) => set(list.includes(l) ? list.filter((x) => x !== l) : list.length >= 12 ? list : [...list, l]);
  const save = async () => {
    if (!areas.length) { setErr('Choose at least one area you pick up from.'); return; }
    setBusy(true); setErr('');
    try { const r = await call('rider_set_reach', { p_areas: areas, p_long_trips: longTrips, p_drop_range: range }); onSaved({ ...reach, ...r }, 'Saved. You\'ll see jobs from your new areas.'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const sendMove = async () => {
    setBusy(true); setErr('');
    try { const m = await call('rider_request_move', { p_state: mv.state, p_lga: mv.lga, p_areas: mv.areas.length ? mv.areas : [mv.lga], p_address: mv.address.trim(), p_note: mv.note.trim() }); onSaved({ ...reach, move: m }, 'Sent. The Xorla team will check it and let you know.'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const withdraw = async () => {
    setBusy(true);
    try { await call('rider_withdraw_move', {}); onSaved({ ...reach, move: { ...move, status: 'withdrawn' } }, 'Move request withdrawn.'); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" style={{ background: 'rgba(11,43,38,0.45)', fontFamily: RIDER_FONT }} onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Where you ride" className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-[26px] sm:rounded-[26px] p-5" style={{ background: C.bg, color: C.ink }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 text-[19px] font-bold" style={{ fontFamily: RIDER_DISPLAY, letterSpacing: '-0.03em' }}>{moving ? 'Moving to another state' : 'Where you ride'}</div>
          <button type="button" aria-label="Close" onClick={() => (moving ? setMoving(false) : onClose())} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.chip }}><X size={16} /></button>
        </div>
        {!moving ? (
          <>
            <div className="text-[12.5px] mb-4" style={{ color: C.inkDim }}>{reach.state}. You can change this any time.</div>
            <div className="text-[13px] font-bold mb-1">Areas you pick up from</div>
            <div className="text-[12px] mb-2" style={{ color: C.inkFaint }}>Jobs from shops in these areas reach you first. Up to 12.</div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {(NG_LGAS[reach.state] || []).map((l) => <button key={l} type="button" aria-pressed={areas.includes(l)} onClick={() => toggle(areas, setAreas, l)} className="min-h-[34px] px-3 rounded-full text-[12.5px] font-semibold" style={chip(areas.includes(l))}>{l}</button>)}
            </div>
            <button type="button" role="switch" aria-checked={longTrips} onClick={() => setLongTrips(!longTrips)} className="w-full flex items-start gap-3 rounded-2xl px-4 py-3 mb-4 text-left" style={{ background: longTrips ? C.mint : C.surface, border: `1px solid ${C.line}` }}>
              <span className="flex-1 min-w-0"><span className="block text-[13.5px] font-bold">Also show me long trips across {reach.state}</span><span className="block text-[12px] mt-0.5" style={{ color: C.inkDim }}>Jobs from other areas that no nearby rider took in 10 minutes. You'd ride to the pick-up first.</span></span>
              <span className="shrink-0 mt-0.5 w-11 h-6 rounded-full relative" style={{ background: longTrips ? C.sage : C.track }}><span className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all" style={{ left: longTrips ? 23 : 3 }} /></span>
            </button>
            <div className="text-[13px] font-bold mb-2">How far you'll go to drop off</div>
            <div className="space-y-2 mb-4" role="radiogroup">
              {RIDER_RANGES.map(([v, l, d]) => (
                <button key={v} type="button" role="radio" aria-checked={range === v} onClick={() => setRange(v)} className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left" style={{ background: C.surface, border: `1.5px solid ${range === v ? C.copper : C.line}` }}>
                  <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center" style={{ border: `2px solid ${range === v ? C.copper : C.lineStrong}` }}>{range === v && <span className="w-2.5 h-2.5 rounded-full" style={{ background: C.copper }} />}</span>
                  <span className="min-w-0"><span className="block text-[13.5px] font-semibold">{l}</span><span className="block text-[12px]" style={{ color: C.inkFaint }}>{d}</span></span>
                </button>
              ))}
            </div>
            {err && <div className="mb-3 text-[12.5px] font-semibold" style={{ color: C.rust }}>{err}</div>}
            <button type="button" disabled={busy} onClick={save} className="w-full h-12 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2" style={{ background: C.copper, color: '#fff', opacity: busy ? 0.6 : 1 }}>{busy ? <Loader2 size={16} className="animate-spin" /> : null}Save</button>
            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
              {move ? (
                <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(245,163,0,0.12)' }}>
                  <div className="text-[13px] font-bold">Move to {move.to_lga}, {move.to_state}: waiting for the Xorla team</div>
                  <div className="text-[12px] mt-0.5" style={{ color: C.inkDim }}>You keep getting jobs in {reach.state} until it's approved. We may call you or your guarantor.</div>
                  <button type="button" disabled={busy} onClick={withdraw} className="mt-2 text-[12.5px] font-semibold" style={{ color: C.rust }}>Withdraw the request</button>
                </div>
              ) : (
                <>
                  {lastMove && <div className="mb-2 text-[12.5px]" style={{ color: lastMove.status === 'approved' ? C.sage : C.inkDim }}>{lastMove.status === 'approved' ? `Your move to ${lastMove.to_state} was approved.` : lastMove.status === 'declined' ? `Your move to ${lastMove.to_state} wasn't approved${lastMove.decision_note ? `: ${lastMove.decision_note}` : ''}.` : ''}</div>}
                  <button type="button" onClick={() => { setMoving(true); setErr(''); }} className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                    <MapPin size={17} style={{ color: C.copper }} /><span className="flex-1 min-w-0"><span className="block text-[13.5px] font-semibold">I've moved to another state</span><span className="block text-[12px]" style={{ color: C.inkFaint }}>The Xorla team checks it, then your jobs move with you</span></span><ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-[12.5px] mb-4 leading-relaxed" style={{ color: C.inkDim }}>Your checks were done for {reach.state}, so the Xorla team looks at a move first. Until then you keep getting jobs in {reach.state}.</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <BrandSelect palette={RIDER_LIGHT} value={mv.state} onChange={(e) => setMv({ ...mv, state: e.target.value, lga: '', areas: [] })} aria-label="New state" className="w-full min-w-0 rounded-xl px-3 py-3 text-[14px] outline-none" style={field}>
                <option value="">New state</option>
                {NG_STATES.filter((x) => x !== reach.state).map((x) => <option key={x} value={x}>{x}</option>)}
              </BrandSelect>
              <BrandSelect palette={RIDER_LIGHT} value={mv.lga} onChange={(e) => setMv({ ...mv, lga: e.target.value, areas: mv.areas.length ? mv.areas : [e.target.value] })} aria-label="Where you now live" className="w-full min-w-0 rounded-xl px-3 py-3 text-[14px] outline-none" style={field} disabled={!mv.state}>
                <option value="">Where you live</option>
                {(NG_LGAS[mv.state] || []).map((l) => <option key={l} value={l}>{l}</option>)}
              </BrandSelect>
            </div>
            {mv.state && (
              <>
                <div className="text-[13px] font-bold mb-2">Areas you'll pick up from</div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(NG_LGAS[mv.state] || []).map((l) => <button key={l} type="button" aria-pressed={mv.areas.includes(l)} onClick={() => setMv({ ...mv, areas: mv.areas.includes(l) ? mv.areas.filter((x) => x !== l) : mv.areas.length >= 12 ? mv.areas : [...mv.areas, l] })} className="min-h-[34px] px-3 rounded-full text-[12.5px] font-semibold" style={chip(mv.areas.includes(l))}>{l}</button>)}
                </div>
              </>
            )}
            <input type="text" maxLength={200} value={mv.address} onChange={(e) => setMv({ ...mv, address: e.target.value })} placeholder="Your new home address" className="w-full rounded-xl px-3.5 py-3 text-[14px] outline-none mb-2" style={field} />
            <input type="text" maxLength={300} value={mv.note} onChange={(e) => setMv({ ...mv, note: e.target.value })} placeholder="Anything we should know (optional)" className="w-full rounded-xl px-3.5 py-3 text-[14px] outline-none mb-3" style={field} />
            {err && <div className="mb-3 text-[12.5px] font-semibold" style={{ color: C.rust }}>{err}</div>}
            <button type="button" disabled={busy || !mv.state || !mv.lga || mv.address.trim().length < 8} onClick={sendMove} className="w-full h-12 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2" style={{ background: C.copper, color: '#fff', opacity: busy || !mv.state || !mv.lga || mv.address.trim().length < 8 ? 0.5 : 1 }}>{busy ? <Loader2 size={16} className="animate-spin" /> : null}Send to the Xorla team</button>
          </>
        )}
      </div>
    </div>, document.body);
}
function RiderWork({ call, me, photo, token }) {
  const C = RIDER_LIGHT;
  const first = String(me.full_name || '').split(' ')[0];
  const [tab, setTab] = useState(() => { try { const t = new URLSearchParams(window.location.search).get('tab'); return ['jobs', 'active', 'earnings'].includes(t) ? t : 'jobs'; } catch (e) { return 'jobs'; } });
  const [open, setOpen] = useState(null);
  const [mine, setMine] = useState(null);
  const [busy, setBusy] = useState('');
  const [errs, setErrs] = useState({});
  const [note, setNote] = useState('');
  const [alerts, setAlerts] = useState(() => { try { return typeof Notification !== 'undefined' && Notification.permission === 'granted'; } catch (e) { return false; } });
  const seenRef = useRef(null);
  const refresh = useCallback(async (quiet = true) => {
    try {
      const [o, m] = await Promise.all([call('rider_open_jobs'), call('rider_my_jobs')]);
      const list = Array.isArray(o) ? o : [];
      // A new job just arrived: a buzz and a short sound
      if (seenRef.current && list.some((j) => !seenRef.current.has(j.id))) {
        try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) {}
        try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const osc = ac.createOscillator(); const g = ac.createGain(); osc.frequency.value = 880; g.gain.value = 0.08; osc.connect(g); g.connect(ac.destination); osc.start(); setTimeout(() => { osc.frequency.value = 1320; }, 120); setTimeout(() => { osc.stop(); ac.close(); }, 260); } catch (e) {}
        setNote('New job near you');
      }
      seenRef.current = new Set(list.map((j) => j.id));
      setOpen(list); setMine(m || { jobs: [] });
    } catch (e) { if (!quiet) setNote(e.message); }
  }, [call]);
  useEffect(() => {
    refresh(false);
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, RIDER_JOB_POLL);
    const back = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', back); window.addEventListener('online', back);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', back); window.removeEventListener('online', back); };
  }, [refresh]);
  useEffect(() => { if (!note) return undefined; const t = setTimeout(() => setNote(''), 4000); return () => clearTimeout(t); }, [note]);
  const jobs = mine?.jobs || [];
  const active = jobs.filter((j) => ['taken', 'picked_up'].includes(j.status));
  const done = jobs.filter((j) => j.status === 'delivered');
  const available = !!mine?.available;
  const act = async (job, action, extra = {}) => {
    setBusy(`${job.id}:${action}`); setErrs((x) => ({ ...x, [job.id]: '' }));
    try {
      const r = await call('rider_job_act', { p_job: job.id, p_action: action, p_code: extra.code || null, p_note: extra.note || null });
      if (r && r.error) { setErrs((x) => ({ ...x, [job.id]: r.error })); await refresh(); return false; }
      if (action === 'take') { setTab('active'); setNote(`It's yours. Go to ${r.pickup_name}.`); }
      if (action === 'pickup') setNote('Picked up. Now deliver it.');
      if (action === 'deliver') setNote(`Delivered! ${fmt(r.fee)} earned.`);
      await refresh();
      return true;
    } catch (e) { setErrs((x) => ({ ...x, [job.id]: e.message })); await refresh(); return false; }
    finally { setBusy(''); }
  };
  const toggleAvailable = async () => {
    const next = !available;
    try {
      await call('rider_set_available', { p_on: next });
      setMine((m) => ({ ...(m || {}), available: next }));
      if (next && !alerts) turnOnAlerts();
    } catch (e) { setNote(e.message); }
  };
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [reach, setReach] = useState(null);        // areas, long trips, how far, and any move request
  const [reachOpen, setReachOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState([]);
  useEffect(() => { call('rider_reach').then((r) => r && setReach(r)).catch(() => setReach(null)); }, [call]);
  const hideJob = (j) => { setHiddenIds((x) => [...x, j.id]); call('rider_job_act', { p_job: j.id, p_action: 'hide', p_code: null, p_note: null }).catch(() => {}); };
  const saveSub = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const res = await fetch(`${SB_URL}/functions/v1/push`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'config' }) });
      const { publicKey } = await res.json();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(publicKey) });
    }
    const j = sub.toJSON();
    await call('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    return reg;
  }, [call, token]);
  // Alerts were allowed before: make sure this phone is still saved for this rider (quietly, once)
  useEffect(() => { if (alerts && 'serviceWorker' in navigator && 'PushManager' in window) saveSub().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Tapping a job alert while Xorla Rider is already open: go straight to that tab
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMsg = (e) => {
      if (e.data?.type !== 'xorla-open') return;
      try { const u = new URL(e.data.url, window.location.origin); if (!u.pathname.startsWith('/ride')) { window.location.assign(u.href); return; } const t = u.searchParams.get('tab'); if (['jobs', 'active', 'earnings'].includes(t)) setTab(t); } catch (err) {}
      refresh();
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [refresh]);
  const turnOnAlerts = async () => {
    if (alertsBusy) return;
    setAlertsBusy(true);
    try {
      if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) { setNote("This phone can't show job alerts. Keep Xorla open to see new jobs."); return; }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setNote(perm === 'denied' ? 'Alerts are blocked. See the steps on the card to allow them.' : 'Allow notifications to hear about new jobs.'); setAlerts(false); return; }
      const reg = await saveSub();
      setAlerts(true); setNote("Job alerts are on. We'll buzz you when a job opens near you.");
      // A first alert right away, so the rider sees what one looks like
      try { await reg.showNotification('Job alerts are on', { body: "This is how a new delivery job will look. Tap it to see the job.", icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'rider-alerts-on', data: { url: '/ride?tab=jobs' } }); } catch (e) {}
    } catch (e) { setNote("Couldn't turn on alerts. Check your internet and try again."); }
    finally { setAlertsBusy(false); }
  };
  const maps = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || '')}`;
  const tel = (p) => `tel:${String(p || '').replace(/[^0-9+]/g, '')}`;
  const payLabel = (j) => (j.pay_how === 'cash_pickup' ? 'Cash at pick-up' : 'Transfer after delivery');
  const tabs = [['jobs', 'Jobs', (open || []).length], ['active', 'My jobs', active.length], ['earnings', 'Earnings', 0]];
  const Pill = ({ children, tone = 'ink' }) => <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={tone === 'sage' ? { background: C.sageSoft, color: C.sage } : tone === 'amber' ? { background: 'rgba(245,163,0,0.14)', color: '#A86F00' } : tone === 'rust' ? { background: C.rustSoft, color: C.rust } : { background: C.chip, color: C.inkDim }}>{children}</span>;
  return (
    <div>
      <div className="flex items-center gap-3">
        <RiderFaceLocal photo={photo} name={me.full_name} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px]" style={{ color: C.inkDim }}>Hello,</div>
          <div className="text-[22px] font-bold leading-tight truncate" style={{ fontFamily: RIDER_DISPLAY, letterSpacing: '-0.03em' }}>{first}</div>
        </div>
        <button type="button" role="switch" aria-checked={available} onClick={toggleAvailable} className="shrink-0 flex items-center gap-2.5 rounded-full pl-3.5 pr-1.5 py-1.5" style={{ background: available ? C.copper : C.surface, color: available ? '#fff' : C.ink, border: `1px solid ${available ? C.copper : C.lineStrong}` }}>
          <span className="text-[12.5px] font-bold">{available ? 'Taking jobs' : 'Not taking jobs'}</span>
          <span className="w-10 h-6 rounded-full relative transition-colors" style={{ background: available ? '#1FD9C4' : C.track }}><span className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all" style={{ left: available ? 19 : 3 }} /></span>
        </button>
      </div>
      <RiderSetup withAlerts alertsOn={alerts} onAlerts={turnOnAlerts} alertsBusy={alertsBusy} />
      {reach && (
        <button type="button" onClick={() => setReachOpen(true)} className="mt-3 w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <MapPin size={17} className="shrink-0" style={{ color: C.copper }} />
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold truncate">You pick up in {(reach.areas || []).slice(0, 2).join(', ')}{(reach.areas || []).length > 2 ? ` +${reach.areas.length - 2}` : ''}</span>
            <span className="block text-[11.5px]" style={{ color: C.inkFaint }}>{reach.long_trips ? `Long trips across ${reach.state} on` : 'Long trips off'} · drop-offs: {(RIDER_RANGES.find((x) => x[0] === reach.drop_range) || RIDER_RANGES[1])[1].toLowerCase()}{reach.move?.status === 'pending' ? ' · move waiting' : ''}</span>
          </span>
          <span className="text-[12.5px] font-bold shrink-0" style={{ color: C.copper }}>Change</span>
        </button>
      )}
      {reachOpen && reach && <RiderReachSheet call={call} reach={reach} onClose={() => setReachOpen(false)} onSaved={(r, msg) => { setReach(r); setReachOpen(false); setNote(msg); refresh(); }} />}
      <div className="mt-4 grid grid-cols-3 gap-1 p-1 rounded-2xl" style={{ background: C.chip }} role="tablist">
        {tabs.map(([id, l, n]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="h-10 rounded-xl text-[12.5px] font-bold flex items-center justify-center gap-1.5" style={tab === id ? { background: C.surface, color: C.ink, boxShadow: '0 1px 3px rgba(11,43,38,0.12)' } : { color: C.inkDim }}>
            {l}{n > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] flex items-center justify-center" style={{ background: id === 'jobs' ? C.amber : C.sage, color: '#fff' }}>{n}</span>}
          </button>
        ))}
      </div>

      {tab === 'jobs' && (
        <div className="mt-4 space-y-3">
          {open === null && <div className="text-center text-[13px] py-8" style={{ color: C.inkFaint }}>Looking for jobs…</div>}
          {open && open.length === 0 && (
            <div className="rounded-[22px] p-6 text-center" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <RiderSpotMap className="w-24 h-24 mx-auto" />
              <div className="mt-2 text-[16px] font-bold" style={{ fontFamily: RIDER_DISPLAY, letterSpacing: '-0.02em' }}>No jobs right now</div>
              <div className="mt-1 text-[13px] leading-relaxed" style={{ color: C.inkDim }}>You'll see jobs from {(me.areas || []).slice(0, 3).join(', ')}{(me.areas || []).length > 3 ? ` and ${(me.areas || []).length - 3} more` : ''}. {available ? "We'll buzz you when one opens." : 'Switch on "Taking jobs" to get alerts.'}</div>
            </div>
          )}
          {(open || []).map((j) => (
            <div key={j.id} className="rounded-[22px] p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: '0 14px 30px -24px rgba(11,43,38,0.5)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11.5px] font-semibold" style={{ color: C.inkFaint }}>{jobAgo(j.created_at)} · {payLabel(j)}</div>
                  <div className="mt-1 text-[15.5px] font-bold leading-snug">{j.pickup_name}</div>
                  <div className="mt-1 text-[13px] flex items-center gap-1.5 flex-wrap" style={{ color: C.inkDim }}><MapPin size={13} style={{ color: C.sage }} /> {j.pickup_lga}<ArrowRight size={13} /> {j.dropoff_lga ? `${j.dropoff_lga}${j.dropoff_state && j.dropoff_state !== j.pickup_state ? `, ${j.dropoff_state}` : ''}` : (j.dropoff_area || 'Nearby')}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-[12px]">
                    {j.trip_km != null && <span className="font-semibold" style={{ color: C.ink }}>{Number(j.trip_km) === 0 ? 'Same area' : `About ${Math.max(1, Math.round(Number(j.trip_km) * 1.3))} km`}</span>}
                    {j.wide && !(reach?.areas || me.areas || []).includes(j.pickup_lga) && <Pill tone="amber">Long trip</Pill>}
                    {j.dropoff_lga && <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${j.pickup_lga}, ${j.pickup_state}, Nigeria`)}&destination=${encodeURIComponent(`${j.dropoff_lga}, ${j.dropoff_state || j.pickup_state}, Nigeria`)}&travelmode=driving`} target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: C.sage }}>See route</a>}
                  </div>
                  {j.package && <div className="mt-1 text-[12.5px] truncate" style={{ color: C.inkFaint }}><Package size={12} className="inline mr-1" />{j.package}</div>}
                </div>
                <div className="text-right shrink-0"><div className="text-[24px] font-bold leading-none" style={{ fontFamily: RIDER_DISPLAY, letterSpacing: '-0.04em' }}>{fmt(j.fee)}</div><div className="text-[11px] mt-1" style={{ color: C.inkFaint }}>you earn</div></div>
              </div>
              {errs[j.id] && <div className="mt-2 text-[12.5px] font-semibold" style={{ color: C.rust }}>{errs[j.id]}</div>}
              <button type="button" disabled={!!busy || active.length >= 2} onClick={() => act(j, 'take')} className="mt-3 w-full h-12 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2" style={{ background: C.copper, color: '#fff', opacity: busy || active.length >= 2 ? 0.5 : 1 }}>{busy === `${j.id}:take` ? 'Taking it…' : active.length >= 2 ? 'Finish a job first' : <>Accept job <ArrowRight size={17} /></>}</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'active' && (
        <div className="mt-4 space-y-3">
          {active.length === 0 && <div className="rounded-[22px] p-6 text-center text-[13.5px]" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.inkDim }}>No job in hand. Accept one from <button type="button" onClick={() => setTab('jobs')} className="font-bold underline">Jobs</button>.</div>}
          {active.map((j) => {
            const picked = j.status === 'picked_up';
            return (
              <div key={j.id} className="rounded-[22px] overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: C.mint }}>
                  <span className="text-[12.5px] font-bold" style={{ color: C.copper }}>{picked ? 'Step 2 of 2 · Deliver' : 'Step 1 of 2 · Pick up'}</span>
                  <span className="text-[16px] font-bold" style={{ fontFamily: RIDER_DISPLAY }}>{fmt(j.fee)}</span>
                </div>
                <div className="p-4">
                  {[[false, 'Pick up from', j.pickup_name, j.pickup_address, j.pickup_phone], [true, 'Deliver to', j.customer_name, j.dropoff_address, j.customer_phone]].map(([second, l, who, addr, ph]) => {
                    const current = second === picked;
                    return (
                      <div key={l} className="flex gap-3" style={{ opacity: !second && picked ? 0.5 : 1 }}>
                        <div className="flex flex-col items-center">
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: !second && picked ? C.sage : current ? C.amber : C.chip, color: !second && picked ? '#fff' : C.ink }}>{!second && picked ? <Check size={14} /> : second ? 2 : 1}</span>
                          {!second && <span className="w-[2px] flex-1 my-1 rounded-full" style={{ background: C.track, minHeight: 18 }} />}
                        </div>
                        <div className="flex-1 min-w-0 pb-3">
                          <div className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>{l}</div>
                          <div className="text-[15px] font-bold">{who}</div>
                          {addr && <div className="text-[13px] leading-snug mt-0.5" style={{ color: C.inkDim }}>{addr}</div>}
                          {current && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {addr && <a href={maps(addr)} target="_blank" rel="noopener noreferrer" className="h-9 px-3 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5" style={{ background: C.chip }}><MapPin size={14} /> Directions</a>}
                              {ph && <a href={tel(ph)} className="h-9 px-3 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5" style={{ background: C.chip }}><Phone size={14} /> Call</a>}
                              {ph && <a href={`https://wa.me/${toWhatsAppNumber(ph)}`} target="_blank" rel="noopener noreferrer" className="h-9 px-3 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5" style={{ background: C.sageSoft, color: C.sage }}><MessageCircle size={14} /> WhatsApp</a>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {j.package && <div className="text-[12.5px] rounded-xl px-3 py-2" style={{ background: C.field, color: C.inkDim }}><strong style={{ color: C.ink }}>Package:</strong> {j.package}{j.note ? <><br /><strong style={{ color: C.ink }}>Note:</strong> {j.note}</> : null}</div>}
                  {j.locked ? (
                    <div className="mt-3 rounded-2xl p-3.5 text-[13px] leading-relaxed" style={{ background: C.rustSoft, color: C.rust }}><strong>Locked after 5 wrong codes.</strong> Call {j.pickup_name} so they can send new codes.</div>
                  ) : picked ? (
                    <RiderCodeBox label={`${String(j.customer_name || 'The customer').split(' ')[0]}'s code`} hint="Hand over the order, then ask the customer for their 4-digit delivery code." busy={busy === `${j.id}:deliver`} error={errs[j.id]} onSubmit={async (code, clear) => { if (await act(j, 'deliver', { code })) clear(); }} />
                  ) : (
                    <RiderCodeBox label="Pick-up code" hint={`When you collect the package, ${j.pickup_name} gives you a 4-digit code.`} busy={busy === `${j.id}:pickup`} error={errs[j.id]} onSubmit={async (code, clear) => { if (await act(j, 'pickup', { code })) clear(); }} />
                  )}
                  <div className="mt-3 flex items-center justify-between text-[12px]" style={{ color: C.inkFaint }}>
                    <span>{payLabel(j)}</span>
                    {!picked && <button type="button" onClick={async () => { if (await brandConfirm(`Give this job back? ${j.pickup_name} is told, and it goes back to other riders. Giving jobs back often can pause your account.`, { confirm: 'Give it back', danger: true, theme: 'light' })) act(j, 'release', { note: '' }); }} className="font-semibold underline">Give the job back</button>}
                  </div>
                </div>
              </div>
            );
          })}
          {jobs.filter((j) => j.status === 'cancelled' && !hiddenIds.includes(j.id) && Date.now() - new Date(j.cancelled_at).getTime() < 6 * 3600000).map((j) => (
            <div key={j.id} className="rounded-2xl pl-4 pr-2 py-2.5 text-[13px] flex items-start gap-2" style={{ background: C.rustSoft, color: C.rust }}>
              <span className="flex-1 min-w-0 py-0.5"><strong>{j.pickup_name} cancelled a job</strong>{j.cancel_reason ? `: ${j.cancel_reason}` : ''}. Don't go for the pick-up.</span>
              <button type="button" onClick={() => hideJob(j)} aria-label="Clear" className="shrink-0 min-h-[32px] px-2.5 rounded-lg text-[12px] font-bold" style={{ color: C.rust }}>Clear</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'earnings' && (
        <div className="mt-4 space-y-3">
          <RiderPass r={me} photo={photo} compact />
          <div className="grid grid-cols-3 gap-2">
            {[['This week', fmt(mine?.earned_week || 0)], ['All time', fmt(mine?.earned_all || 0)], ['Deliveries', String(mine?.delivered_count || 0)]].map(([l, v]) => (
              <div key={l} className="rounded-2xl px-3 py-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}><div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>{l}</div><div className="text-[18px] font-bold mt-0.5 truncate" style={{ fontFamily: RIDER_DISPLAY, letterSpacing: '-0.03em' }}>{v}</div></div>
            ))}
          </div>
          <div className="text-[12px] leading-relaxed px-1" style={{ color: C.inkFaint }}>Businesses pay you directly: cash at pick-up, or a transfer to {me.bank_name ? `your ${me.bank_name} account` : 'your bank'}. Confirm each one when the money reaches you.</div>
          {done.length === 0 && <div className="rounded-2xl p-5 text-center text-[13px]" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.inkDim }}>Your deliveries and payments show here.</div>}
          <div className="rounded-[22px] overflow-hidden" style={{ background: C.surface, border: done.length ? `1px solid ${C.line}` : 'none' }}>
            {done.map((j, i) => (
              <div key={j.id} className="px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0"><span className="block text-[14px] font-bold truncate">{j.pickup_name}</span><span className="block text-[12px]" style={{ color: C.inkFaint }}>{riderTime(j.delivered_at)} · {j.pickup_lga}</span></span>
                  <span className="text-[16px] font-bold shrink-0" style={{ fontFamily: RIDER_DISPLAY }}>{fmt(j.fee)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  {j.rider_confirmed_paid_at ? <Pill tone="sage"><Check size={11} /> You got it</Pill>
                    : j.paid_at ? <><Pill tone="amber">Business says it's paid ({j.paid_how === 'cash' ? 'cash' : 'transfer'})</Pill><button type="button" disabled={!!busy} onClick={() => act(j, 'got_paid')} className="h-7 px-3 rounded-full text-[11.5px] font-bold" style={{ background: C.copper, color: '#fff' }}>I got it</button></>
                    : <Pill>Waiting for payment</Pill>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {note && <div className="fixed left-0 right-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none"><div className="rounded-full px-4 py-2.5 text-[13px] font-bold xorla-fade-up" style={{ background: C.copper, color: '#fff', boxShadow: '0 10px 30px rgba(11,43,38,0.35)' }}>{note}</div></div>}
    </div>
  );
}
function RiderFaceLocal({ photo, name }) {
  const C = RIDER_LIGHT;
  const initials = String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return photo ? <img src={photo} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" style={{ border: `2px solid ${C.sage}` }} /> : <span className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-[17px] font-bold" style={{ background: C.mint, color: C.copper }}>{initials}</span>;
}

// ============ Live selfie: the camera opens inside the page (nothing to leave, so the phone can't close the page) ============
// The rider sees themselves in an oval, takes the photo, and checks it before using it. The saved photo is not mirrored,
// so it matches the face on their ID. If the camera can't open (no permission, old phone), the caller offers other ways.
const canLiveCamera = () => typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof window !== 'undefined' && window.isSecureContext !== false;
function LiveSelfie({ onUse, onClose, onFail }) {
  const videoRef = useRef(null); const streamRef = useRef(null);
  const [state, setState] = useState('starting');   // starting | live | shot | error
  const [shot, setShot] = useState(null);           // { url, blob }
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState('');
  const stop = () => { try { (streamRef.current?.getTracks() || []).forEach((t) => t.stop()); } catch (e) {} streamRef.current = null; };
  const start = async () => {
    setState('starting'); setMsg('');
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      streamRef.current = st;
      const v = videoRef.current; if (!v) { stop(); return; }
      v.srcObject = st; v.setAttribute('playsinline', ''); v.muted = true;
      await v.play().catch(() => {});
      setState('live');
    } catch (e) {
      const denied = e && /NotAllowed|Permission|Security/i.test(`${e.name} ${e.message}`);
      setMsg(denied ? 'Xorla needs your permission to use the camera. Tap the camera or lock icon in your browser\'s address bar, allow the camera, then try again.' : "Your camera didn't open on this phone.");
      setState('error'); onFail && onFail(denied ? 'denied' : 'unavailable');
    }
  };
  useEffect(() => {
    start();
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { stop(); document.body.style.overflow = prev; };
  }, []);
  useEffect(() => () => { if (shot?.url) URL.revokeObjectURL(shot.url); }, [shot]);
  const snap = () => {
    const v = videoRef.current; if (!v || !v.videoWidth) return;
    const max = 1280; const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => { if (!b) return; setShot({ blob: b, url: URL.createObjectURL(b) }); setState('shot'); stop(); }, 'image/jpeg', 0.9);
  };
  const countdown = () => {
    if (count) return;
    let n = 3; setCount(n);
    const t = setInterval(() => { n -= 1; if (n <= 0) { clearInterval(t); setCount(0); snap(); } else setCount(n); }, 700);
  };
  const retake = () => { setShot(null); start(); };
  const use = () => { if (!shot) return; const file = new File([shot.blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' }); onUse(file); };
  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col" style={{ background: '#050B0A', color: '#fff', fontFamily: "'Poppins', 'Inter', system-ui, sans-serif" }} role="dialog" aria-modal="true" aria-label="Take a selfie">
      <div className="flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))] pb-3">
        <button onClick={() => { stop(); onClose(); }} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }} aria-label="Close"><X size={18} /></button>
        <span className="text-[14px] font-semibold">{state === 'shot' ? 'Is your face clear?' : 'Take a selfie'}</span>
        <span className="w-10" />
      </div>
      <div className="relative flex-1 min-h-0 mx-4 rounded-3xl overflow-hidden" style={{ background: '#0B1513' }}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)', display: state === 'shot' ? 'none' : 'block' }} />
        {state === 'shot' && shot && <img src={shot.url} alt="Your selfie" className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />}
        {(state === 'live' || state === 'starting') && (
          <svg aria-hidden className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 130" preserveAspectRatio="xMidYMid slice">
            <defs><mask id="xsm"><rect width="100" height="130" fill="#fff" /><ellipse cx="50" cy="58" rx="29" ry="38" fill="#000" /></mask></defs>
            <rect width="100" height="130" fill="rgba(5,11,10,0.55)" mask="url(#xsm)" />
            <ellipse cx="50" cy="58" rx="29" ry="38" fill="none" stroke={count ? '#FFB020' : '#1FD9C4'} strokeWidth="0.8" strokeDasharray={count ? '0' : '2.2 1.6'} />
          </svg>
        )}
        {state === 'starting' && <div className="absolute inset-0 flex items-center justify-center"><Loader2 size={26} className="animate-spin" style={{ color: '#1FD9C4' }} /></div>}
        {count > 0 && <div className="absolute inset-0 flex items-center justify-center"><span key={count} className="xorla-fade-up text-[84px] font-extrabold" style={{ color: '#FFB020', textShadow: '0 6px 30px rgba(0,0,0,0.6)' }}>{count}</span></div>}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,176,32,0.15)' }}><CameraOff size={24} style={{ color: '#FFB020' }} /></span>
            <div className="text-[15px] font-semibold mb-1.5">Camera not available</div>
            <div className="text-[13px] leading-relaxed max-w-[300px]" style={{ color: 'rgba(255,255,255,0.72)' }}>{msg}</div>
          </div>
        )}
      </div>
      <div className="px-5 pt-3 pb-[max(18px,env(safe-area-inset-bottom))]">
        {state === 'shot' ? (
          <>
            <div className="text-[12.5px] text-center mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>Whole face showing, in good light, no cap or sunglasses?</div>
            <div className="flex gap-3">
              <button onClick={retake} className="flex-1 h-12 rounded-xl text-[14.5px] font-semibold flex items-center justify-center gap-1.5" style={{ border: '1px solid rgba(255,255,255,0.25)' }}><RotateCcw size={16} /> Retake</button>
              <button onClick={use} className="flex-[1.4] h-12 rounded-xl text-[14.5px] font-bold flex items-center justify-center gap-1.5" style={{ background: '#1FD9C4', color: '#062420' }}><Check size={17} /> Use this photo</button>
            </div>
          </>
        ) : state === 'error' ? (
          <div className="flex gap-3">
            <button onClick={() => { stop(); onClose(); }} className="flex-1 h-12 rounded-xl text-[14.5px] font-semibold" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>Other ways</button>
            <button onClick={start} className="flex-1 h-12 rounded-xl text-[14.5px] font-bold" style={{ background: '#1FD9C4', color: '#062420' }}>Try again</button>
          </div>
        ) : (
          <>
            <div className="text-[12.5px] text-center mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>Fit your face in the oval. Face the light, no cap or sunglasses.</div>
            <div className="flex justify-center">
              <button onClick={countdown} disabled={state !== 'live' || !!count} aria-label="Take photo" className="w-[74px] h-[74px] rounded-full flex items-center justify-center" style={{ border: '4px solid #fff', opacity: state === 'live' ? 1 : 0.5 }}>
                <span className="w-[58px] h-[58px] rounded-full" style={{ background: count ? '#FFB020' : '#fff' }} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>, document.body);
}

function RiderApp() {
  const C = RIDER_LIGHT;   // the rider pages are light and friendly (the rider pass card stays dark)
  const [sess, setSess] = useState(() => { try { return JSON.parse(localStorage.getItem(RIDER_SESSION_KEY) || 'null'); } catch (e) { return null; } });
  const [me, setMe] = useState(undefined);       // undefined = loading, null = no application yet
  const [view, setView] = useState('home');      // home | auth (when logged out)
  const [authMode, setAuthMode] = useState('signup');
  const [auth, setAuth] = useState({ email: '', password: '', show: false, busy: false, error: '', note: '' });
  const [step, setStep] = useState(0);
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const [photos, setPhotos] = useState({});      // signed / local previews of the ID and selfie
  const [upBusy, setUpBusy] = useState('');
  const [banks, setBanks] = useState(null);
  const [bank, setBank] = useState({ q: '', code: '', name: '', number: '', busy: false, error: '' });
  const [agree, setAgree] = useState(false);
  const topRef = useRef(null);
  // Rider home page: sections glide in as you scroll, and menu links scroll smoothly
  const riderHomeRef = useRef(null);
  useEffect(() => {
    if (sess || view !== 'home') return undefined;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const html = document.documentElement; const prev = html.style.scrollBehavior; if (!reduce) html.style.scrollBehavior = 'smooth';
    const els = riderHomeRef.current ? [...riderHomeRef.current.querySelectorAll('[data-reveal]')] : [];
    let io = null;
    if (reduce || !('IntersectionObserver' in window)) els.forEach((el) => el.classList.add('lp-in'));
    else { io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('lp-in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }); els.forEach((el) => io.observe(el)); }
    return () => { if (io) io.disconnect(); html.style.scrollBehavior = prev; };
  }, [sess, view]);
  useEffect(() => {
    document.title = 'Ride with Xorla';
  }, []);

  const saveSess = (s) => { setSess(s); try { if (s) localStorage.setItem(RIDER_SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(RIDER_SESSION_KEY); } catch (e) {} };
  // Keep the login fresh (tokens last about an hour)
  const call = useCallback(async (fn, params = {}) => {
    let s = sess;
    if (s && s.expires_at && Date.now() / 1000 > s.expires_at - 120) {
      try { const r = await sbRefresh(s.refresh_token); s = { access_token: r.access_token, refresh_token: r.refresh_token, user_id: r.user.id, expires_at: r.expires_at || Math.floor(Date.now() / 1000) + 3500 }; saveSess(s); }
      catch (e) { saveSess(null); setMe(undefined); throw new Error('Please log in again.'); }
    }
    return sbRpc(fn, s.access_token, params);
  }, [sess]);
  // What the rider typed on this phone but hasn't saved yet (kept in case the phone reloads the page): laid over
  // whatever is loaded, so a late load can never wipe it
  const typedDraft = (r) => {
    if (!sess?.user_id || (r && !['draft', 'needs_fix'].includes(r.status || 'draft'))) return {};
    try {
      const d = JSON.parse(localStorage.getItem(`xorla:rider-draft:${sess.user_id}`) || 'null');
      if (!d || !d.f || Date.now() - (d.at || 0) > 3 * 86400000) return {};
      return Object.fromEntries(Object.entries(d.f).filter(([k, v]) => v !== '' && v != null && !['id_doc', 'selfie_doc'].includes(k) && !(Array.isArray(v) && !v.length)));
    } catch (e) { return {}; }
  };
  const fill = (r) => {
    setMe(r);
    if (!r) return;
    const typed = typedDraft(r);
    setF({ ...typed, ...{ full_name: r.full_name || '', phone: r.phone || '', date_of_birth: r.date_of_birth || '', home_address: r.home_address || '', state: r.state || 'Abia', lga: r.lga || '', areas: r.areas || [],
      vehicle: r.vehicle || '', plate_number: r.plate_number || '', id_type: r.id_type || '', id_number: r.id_number || '', id_doc: r.id_doc || '', selfie_doc: r.selfie_doc || '',
      guarantor_name: r.guarantor_name || '', guarantor_phone: r.guarantor_phone || '', guarantor_relationship: r.guarantor_relationship || '', guarantor_address: r.guarantor_address || '' },
      ...typed });
  };
  const load = useCallback(async () => {
    if (!sess) { setMe(undefined); return; }
    try { const r = await call('rider_me'); fill(r || null); if (!r) setF({ state: 'Abia', areas: [], ...typedDraft(null) }); }
    catch (e) { if (/log in/i.test(e.message || '') || /JWT|expired/i.test(e.message || '')) { saveSess(null); } else { setMe(null); setErr(e.message); } }
  }, [sess, call]);
  useEffect(() => { load(); }, [sess?.user_id]);
  // Show the ID and selfie they already uploaded
  useEffect(() => {
    if (!sess || !me) return;
    ['id_doc', 'selfie_doc'].forEach((k) => {
      if (me[k] && !photos[k]) vaultFileUrl(sess.access_token, 'rider-docs', me[k]).then((u) => setPhotos((p) => ({ ...p, [k]: u }))).catch(() => {});
    });
  }, [me?.id_doc, me?.selfie_doc, sess?.access_token]);
  // Phones often close the page while the camera is open (to free memory), so it reloads when the rider comes back.
  // Keep the step they were on and what they've typed on this phone, and put them straight back there.
  const draftKey = sess?.user_id ? `xorla:rider-draft:${sess.user_id}` : '';
  const [draftReady, setDraftReady] = useState(false);
  const [camBack, setCamBack] = useState('');   // which photo's camera was open when the page reloaded
  const [liveCam, setLiveCam] = useState(false);       // the in-page selfie camera is open
  const [otherWays, setOtherWays] = useState(false);   // the live camera didn't work: offer the phone camera or the gallery
  useEffect(() => {
    if (!draftKey || me === undefined || draftReady) return;
    setDraftReady(true);
    if (me && !['draft', 'needs_fix'].includes(me.status || 'draft')) return;
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (!d || Date.now() - (d.at || 0) > 3 * 86400000) return;
      if (d.f && typeof d.f === 'object') setF((x) => ({ ...x, ...typedDraft(me) }));
      if (Number.isInteger(d.step) && d.step >= 0 && d.step <= 4) setStep(d.step);
      if (d.cam) setCamBack(d.cam);
    } catch (e) {}
  }, [draftKey, me, draftReady]);
  useEffect(() => {
    if (!draftKey || !draftReady) return;
    if (me && !['draft', 'needs_fix'].includes(me.status || 'draft')) { try { localStorage.removeItem(draftKey); } catch (e) {} return; }
    try { localStorage.setItem(draftKey, JSON.stringify({ f, step, at: Date.now() })); } catch (e) {}
  }, [f, step, draftKey, draftReady, me?.status]);
  // Remember that the camera was opened, so if the page reloads we can say what happened and offer the gallery instead
  const markCamera = (k) => { if (!draftKey) return; try { const d = JSON.parse(localStorage.getItem(draftKey) || '{}'); localStorage.setItem(draftKey, JSON.stringify({ ...d, f, step, at: Date.now(), cam: k })); } catch (e) {} };
  const clearCamera = () => { setCamBack(''); if (!draftKey) return; try { const d = JSON.parse(localStorage.getItem(draftKey) || '{}'); delete d.cam; localStorage.setItem(draftKey, JSON.stringify(d)); } catch (e) {} };
  // A fix requested: jump to the right step
  useEffect(() => {
    if (me?.status !== 'needs_fix') return;
    const n = String(me.review_note || '').toLowerCase();
    setStep(/selfie|photo of you|face/.test(n) ? 2 : /\bid\b|nin|licen|passport|voter/.test(n) ? 2 : /guarantor/.test(n) ? 3 : /bank|account/.test(n) ? 4 : /plate|bike|car|area/.test(n) ? 1 : 0);
  }, [me?.status]);
  useEffect(() => {
    if (step === 4 && sess && banks === null) riderBilling(sess.access_token, 'rider_banks').then((b) => setBanks(Array.isArray(b) ? b : [])).catch((e) => { setBanks([]); setBank((x) => ({ ...x, error: e.message })); });
  }, [step, sess]);

  const doAuth = async () => {
    const email = auth.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAuth((a) => ({ ...a, error: 'Enter your email address.' })); return; }
    if (authMode !== 'forgot' && auth.password.length < PASSWORD_MIN_LENGTH) { setAuth((a) => ({ ...a, error: `Your password needs at least ${PASSWORD_MIN_LENGTH} characters.` })); return; }
    setAuth((a) => ({ ...a, busy: true, error: '', note: '' }));
    try {
      if (authMode === 'forgot') { await sbRecover(email); setAuth((a) => ({ ...a, busy: false, note: `We've sent a link to ${email} to set a new password.` })); return; }
      let r = authMode === 'signup' ? await sbSignUp(email, auth.password) : await sbSignIn(email, auth.password);
      if (authMode === 'signup' && !r.access_token) {
        try { r = await sbSignIn(email, auth.password); } catch (e) { setAuth((a) => ({ ...a, busy: false, note: `Almost there: we've sent a link to ${email}. Open it to confirm your email, then log in here.` })); setAuthMode('login'); return; }
      }
      saveSess({ access_token: r.access_token, refresh_token: r.refresh_token, user_id: r.user?.id, expires_at: r.expires_at || Math.floor(Date.now() / 1000) + 3500 });
      setAuth({ email: '', password: '', show: false, busy: false, error: '', note: '' });
      window.scrollTo(0, 0);
    } catch (e) { setAuth((a) => ({ ...a, busy: false, error: e.message })); }
  };
  const logout = () => { saveSess(null); setMe(undefined); setView('home'); setStep(0); setPhotos({}); setBanks(null); };

  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErr(''); };
  const stepFields = [['full_name', 'phone', 'date_of_birth', 'home_address', 'state', 'lga', 'areas'], ['vehicle', 'plate_number', 'areas'], ['id_type', 'id_number', 'id_doc', 'selfie_doc'], ['guarantor_name', 'guarantor_phone', 'guarantor_relationship', 'guarantor_address'], []];
  const stepProblem = (i) => {
    const need = (k, label) => (!String(f[k] || '').trim() ? label : '');
    if (i === 0) return need('full_name', 'your full name') || need('phone', 'your phone number') || need('date_of_birth', 'your date of birth') || need('home_address', 'your home address') || need('lga', 'your local government');
    if (i === 1) return !f.vehicle ? 'how you deliver' : (['bike', 'tricycle', 'car', 'van'].includes(f.vehicle) && !String(f.plate_number || '').trim()) ? 'your plate number' : !(f.areas || []).length ? 'at least one area you cover' : '';
    if (i === 2) return need('id_type', 'your type of ID') || need('id_number', 'your ID number') || need('id_doc', 'a photo of your ID') || need('selfie_doc', 'your selfie');
    if (i === 3) return need('guarantor_name', "your guarantor's name") || need('guarantor_phone', "your guarantor's phone number") || need('guarantor_relationship', 'how you know them') || need('guarantor_address', "your guarantor's address");
    return '';
  };
  const saveStep = async (next) => {
    const p = stepProblem(step);
    if (p && next > step) { setErr(`Please add ${p}.`); return; }
    setBusy(true); setErr('');
    try {
      const payload = Object.fromEntries(stepFields[step].map((k) => [k, f[k] ?? '']));
      if (stepFields[step].length) { const r = await call('rider_save', { p: payload }); fill(r); setSaved('Saved'); setTimeout(() => setSaved(''), 1800); }
      setStep(next); topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const pickPhoto = async (k, file, live = false) => {
    clearCamera(); setLiveCam(false);
    if (!file) return;
    setUpBusy(k); setErr('');
    try {
      if (!me) setMe(await call('rider_save', { p: { full_name: f.full_name || '' } }));
      // A selfie taken with the live camera is marked as such, so the Xorla team can tell it from an uploaded picture
      const path = await riderUpload(sess.access_token, sess.user_id, file, k === 'id_doc' ? 'id' : live ? 'selfie-live' : 'selfie');
      // Keep what they've typed on this step (it's saved when they continue); only the photo changes here
      setMe(await call('rider_save', { p: { [k]: path } })); setF((x) => ({ ...x, [k]: path }));
      setPhotos((p) => ({ ...p, [k]: URL.createObjectURL(file) }));
    } catch (e) { setErr(e.message); }
    setUpBusy('');
  };
  const checkBank = async () => {
    if (!bank.code || bank.number.length !== 10) { setBank((b) => ({ ...b, error: 'Choose your bank and enter the 10-digit account number.' })); return; }
    setBank((b) => ({ ...b, busy: true, error: '' }));
    try { await riderBilling(sess.access_token, 'rider_bank', { bank_code: bank.code, bank_name: bank.name, account_number: bank.number }); setMe(await call('rider_me')); setBank({ q: '', code: '', name: '', number: '', busy: false, error: '' }); }
    catch (e) { setBank((b) => ({ ...b, busy: false, error: e.message })); }
  };
  const submit = async () => {
    for (let i = 0; i < 4; i++) { const p = stepProblem(i); if (p) { setStep(i); setErr(`Please add ${p}.`); return; } }
    if (!me?.account_number) { setErr('Add your bank account first.'); return; }
    if (!agree) { setErr('Please tick the box to confirm your details are true.'); return; }
    setBusy(true); setErr('');
    try { const r = await call('rider_submit'); fill(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const page = { background: `radial-gradient(700px 420px at 100% 0%, rgba(31,217,196,0.10), transparent 60%), radial-gradient(600px 400px at 0% 20%, rgba(255,176,32,0.08), transparent 60%), ${C.bg}`, color: C.ink, minHeight: '100vh', fontFamily: RIDER_FONT };
  const field = { background: C.field, border: `1.5px solid ${C.field}`, color: C.ink };
  const inputCls = 'w-full rounded-xl px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#0E9F8E]/40 focus:bg-white';
  const label = (t, hint) => <label className="block text-[13px] font-semibold mb-1.5">{t}{hint ? <span className="font-normal" style={{ color: C.inkFaint }}> {hint}</span> : null}</label>;
  const chip = (on) => ({ background: on ? C.copper : C.surface, color: on ? '#fff' : C.ink, border: `1.5px solid ${on ? C.copper : C.lineStrong}` });
  const header = (
    <header className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 pb-2 flex items-center justify-between gap-3" style={{ paddingTop: 'max(18px, env(safe-area-inset-top))' }}>
      <a href="/ride" className="flex items-center gap-2.5"><XorlaMark size={28} /><span className="text-[18px] font-bold" style={{ letterSpacing: '-0.03em', fontFamily: RIDER_DISPLAY }}>Xorla</span><span className="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: C.mint, color: C.sage }}>riders</span></a>
      {sess ? <button onClick={logout} className="flex items-center gap-1.5 text-[13.5px] font-semibold px-3.5 py-2 rounded-full" style={{ color: C.inkDim, background: C.surface, boxShadow: `0 0 0 1px ${C.line}` }}><LogOut size={14} /> Log out</button>
        : view === 'home' ? (
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden sm:block px-3 py-2 text-[14px] font-semibold" style={{ color: C.ink }}>How it works</a>
            <button onClick={() => { setAuthMode('login'); setView('auth'); window.scrollTo(0, 0); }} className="px-3 py-2 text-[14px] font-semibold" style={{ color: C.ink }}>Log in</button>
            <button onClick={() => { setAuthMode('signup'); setView('auth'); window.scrollTo(0, 0); }} className="px-4 py-2 rounded-full text-[14px] font-bold" style={{ background: C.mint, color: C.copper }}>Apply now</button>
          </nav>
        ) : null}
    </header>
  );
  const footer = <footer className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 py-10 text-[12px] flex flex-wrap gap-x-4 gap-y-1" style={{ color: C.inkFaint }}><span>© Xorla</span><a href="/terms" style={{ color: C.inkDim }}>Terms</a><a href="/privacy" style={{ color: C.inkDim }}>Privacy</a><span>Your ID, selfie and bank details are private. Only the Xorla team can see them.</span></footer>;

  // ---------- Logged out: the welcome page ----------
  if (!sess && view === 'home') {
    const go = (mode) => { setAuthMode(mode); setView('auth'); window.scrollTo(0, 0); };
    const perks = [[RiderSpotMap, 'Pick the jobs you want', 'See deliveries in the areas you choose, and take the ones that suit your day.'], [RiderSpotPay, 'Paid to your bank', 'Your fee goes straight to your own account. No chasing anyone for money.'], [RiderSpotSafe, 'Safe for everyone', 'Every rider is checked: ID, selfie and a guarantor. Customers trust you more.']];
    const how = [['Apply', 'About 10 minutes on your phone'], ['We check you', 'ID, selfie, guarantor and bank. 1 to 3 working days'], ['Get approved', 'Your Xorla Rider Pass turns green'], ['Start delivering', 'Jobs open city by city, from Umuahia and Aba']];
    const need = ['Your phone number', "NIN, driver's licence, voter's card or passport", 'A clear selfie', 'Someone who will stand for you (a guarantor)', 'A bank account in your own name', 'Your plate number (bike, keke, car or van)'];
    return (
      <div style={page} ref={riderHomeRef}>
        <style>{`
          .rd-hero-in > * { opacity: 0; transform: translateY(18px); animation: rdUp .8s cubic-bezier(.2,.7,.2,1) forwards; }
          .rd-hero-in > *:nth-child(2) { animation-delay: .1s; } .rd-hero-in > *:nth-child(3) { animation-delay: .2s; } .rd-hero-in > *:nth-child(4) { animation-delay: .3s; } .rd-hero-in > *:nth-child(5) { animation-delay: .4s; } .rd-hero-in > *:nth-child(6) { animation-delay: .5s; }
          .rd-art-in { opacity: 0; transform: translateX(40px); animation: rdIn 1s cubic-bezier(.2,.7,.2,1) .15s forwards; }
          @keyframes rdUp { to { opacity: 1; transform: none; } }
          @keyframes rdIn { to { opacity: 1; transform: none; } }
          .lp-float { animation: lpFloat 6s ease-in-out infinite; }
          @keyframes lpFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          .rd-bob { animation: rdBob 3.2s ease-in-out infinite; transform-box: fill-box; }
          .rd-bob2 { animation: rdBob 3.8s ease-in-out .6s infinite; transform-box: fill-box; }
          @keyframes rdBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
          .rd-speed { animation: rdSpeed 1.1s ease-in-out infinite; }
          @keyframes rdSpeed { 0%,100% { opacity: 1; transform: translateX(0); } 50% { opacity: .35; transform: translateX(-8px); } }
          [data-reveal] { opacity: 0; transform: translateY(26px); transition: opacity .8s cubic-bezier(.2,.7,.2,1), transform .8s cubic-bezier(.2,.7,.2,1), box-shadow .3s ease; transition-delay: var(--d, 0s); }
          [data-reveal].lp-in { opacity: 1; transform: none; }
          .rd-tile.lp-in:hover { transform: translateY(-4px); }
          .lp-line-grow { transform-origin: left; transform: scaleX(0); transition: transform 1.2s cubic-bezier(.2,.7,.2,1) .25s; }
          .lp-in .lp-line-grow { transform: scaleX(1); }
          .rd-pass-tilt { animation: rdTilt 7s ease-in-out infinite; }
          @keyframes rdTilt { 0%,100% { transform: rotate(-1.5deg) translateY(0); } 50% { transform: rotate(1deg) translateY(-6px); } }
          @media (prefers-reduced-motion: reduce) {
            .rd-hero-in > *, .rd-art-in, [data-reveal] { animation: none !important; opacity: 1 !important; transform: none !important; transition: none !important; }
            .lp-float, .rd-bob, .rd-bob2, .rd-speed, .rd-pass-tilt { animation: none !important; }
            .lp-line-grow { transform: none !important; }
          }
        `}</style>
        {header}
        <main>
          <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 grid lg:grid-cols-[1fr_1.05fr] gap-6 lg:gap-10 items-center pt-6 lg:pt-12 pb-10">
            <div className="order-2 lg:order-1 rd-hero-in">
              <div className="text-[18px] sm:text-[20px] font-bold" style={{ color: C.ink, fontFamily: RIDER_FONT }}>Hello, rider!</div>
              <h1 className="mt-1 text-[38px] sm:text-[54px] font-extrabold leading-[1.04]" style={{ letterSpacing: '-0.045em', fontFamily: RIDER_DISPLAY }}>Deliver more.<br /><span style={{ color: C.amber }}>Earn more.</span></h1>
              <div className="mt-4 w-14 h-1.5 rounded-full" style={{ background: C.sage }} />
              <p className="mt-4 text-[16px] leading-relaxed max-w-md" style={{ color: C.inkDim }}>Join the Xorla rider network. Get delivery jobs from shops, restaurants and hotels near you, and get paid straight to your bank.</p>
              <div className="mt-7 rounded-[22px] sm:rounded-full p-2 flex flex-col sm:flex-row sm:items-center gap-2 max-w-lg" style={{ background: C.surface, boxShadow: '0 18px 40px -18px rgba(11,43,38,0.28), 0 0 0 1px rgba(11,43,38,0.06)' }}>
                <div className="flex items-center gap-2 flex-1 min-w-0 pl-3">
                  <MapPin size={18} style={{ color: C.sage }} className="shrink-0" />
                  <BrandSelect palette={RIDER_LIGHT} value={f.state || 'Abia'} onChange={(e) => setF((x) => ({ ...x, state: e.target.value }))} className="flex-1 min-w-0 py-2.5 text-[15px] font-medium" style={{ background: 'transparent', border: 'none', color: C.ink }} aria-label="Where do you ride?">
                    {NG_STATES.map((s) => <option key={s} value={s}>I ride in {s}</option>)}
                  </BrandSelect>
                </div>
                <button onClick={() => go('signup')} className="h-12 px-7 rounded-full text-[15px] font-bold flex items-center justify-center gap-2 shrink-0" style={{ background: C.copper, color: '#fff' }}>Apply now <ArrowRight size={17} /></button>
              </div>
              <div className="mt-4 text-[14px]" style={{ color: C.inkDim }}>Already applied? <button onClick={() => go('login')} className="font-bold underline underline-offset-4" style={{ color: C.copper }}>Log in</button></div>
            </div>
            <div className="order-1 lg:order-2 -mx-2 sm:mx-0 rd-art-in"><div className="lp-float"><RiderHeroArt className="w-full h-auto" /></div></div>
          </section>

          <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 grid sm:grid-cols-3 gap-4">
            {perks.map(([Art, t, d], i) => (
              <div key={t} data-reveal className="rd-tile rounded-[24px] p-5 flex sm:block items-center gap-4" style={{ '--d': `${i * 0.1}s`, background: C.surface, boxShadow: '0 1px 0 rgba(11,43,38,0.04), 0 16px 34px -24px rgba(11,43,38,0.3)' }}>
                <Art className="w-24 sm:w-28 h-auto shrink-0" />
                <div className="min-w-0"><div className="sm:mt-4 text-[17px] font-bold" style={{ fontFamily: RIDER_DISPLAY, letterSpacing: '-0.02em', fontWeight: 600 }}>{t}</div><div className="mt-1 text-[14px] leading-relaxed" style={{ color: C.inkDim }}>{d}</div></div>
              </div>
            ))}
          </section>

          <section id="how" className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 mt-16 scroll-mt-6">
            <div className="text-center" data-reveal><div className="text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: C.sage }}>How it works</div><h2 className="mt-2 text-[30px] sm:text-[38px] font-extrabold leading-tight" style={{ letterSpacing: '-0.04em', fontFamily: RIDER_DISPLAY }}>From sign-up to your <span style={{ color: C.amber }}>first delivery</span></h2></div>
            <div className="relative mt-10" data-reveal>
              <svg aria-hidden className="lp-line-grow hidden sm:block absolute left-[12%] right-[12%] top-[26px] w-[76%] h-4" preserveAspectRatio="none" viewBox="0 0 100 4"><path d="M0 2 H100" stroke={C.ink} strokeOpacity="0.25" strokeWidth="0.6" strokeDasharray="1.6 1.6" vectorEffect="non-scaling-stroke" /></svg>
              <ol className="relative grid sm:grid-cols-4 gap-6 sm:gap-4">
                {how.map(([t, d], i) => (
                  <li key={t} className="flex sm:flex-col sm:items-center sm:text-center gap-4 sm:gap-3">
                    <span className="w-[54px] h-[54px] rounded-full flex items-center justify-center shrink-0 text-[18px] font-extrabold" style={{ background: i === 3 ? C.amber : C.surface, color: C.ink, border: `2.5px solid ${C.ink}`, fontFamily: RIDER_DISPLAY, boxShadow: '0 4px 0 rgba(11,43,38,0.9)' }}>{i === 3 ? <Bike size={22} /> : i + 1}</span>
                    <span><span className="block text-[16px] font-bold" style={{ fontFamily: RIDER_DISPLAY, letterSpacing: '-0.02em', fontWeight: 600 }}>{t}</span><span className="block text-[13.5px] mt-0.5" style={{ color: C.inkDim }}>{d}</span></span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section id="need" className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 mt-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-center scroll-mt-6">
            <div data-reveal className="rounded-[28px] p-6 sm:p-8" style={{ background: C.mint }}>
              <h2 className="text-[26px] sm:text-[30px] font-extrabold leading-tight" style={{ letterSpacing: '-0.04em', fontFamily: RIDER_DISPLAY }}>What you'll need</h2>
              <ul className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {need.map((t) => <li key={t} className="flex items-start gap-2.5 text-[14.5px] font-medium"><span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: C.surface, border: `2px solid ${C.ink}` }}><Check size={13} strokeWidth={3} style={{ color: C.ink }} /></span>{t}</li>)}
              </ul>
              <div className="mt-6 rounded-2xl px-4 py-3 text-[13px] leading-relaxed flex gap-2.5" style={{ background: 'rgba(255,255,255,0.7)', color: C.inkDim }}><Lock size={15} className="shrink-0 mt-0.5" style={{ color: C.sage }} /> Your ID, selfie and bank details stay private. Businesses and customers never see them.</div>
            </div>
            <div data-reveal className="max-w-sm w-full mx-auto" style={{ '--d': '0.12s' }}>
              <div className="rd-pass-tilt"><RiderPass r={{ full_name: 'Chinedu Okafor', vehicle: 'bike', plate_number: 'UMH 482 QK', areas: ['Umuahia North', 'Umuahia South', 'Ikwuano'], status: 'approved' }} /></div>
              <div className="mt-4 text-center text-[13.5px]" style={{ color: C.inkDim }}>Once approved, your <strong style={{ color: C.ink }}>Xorla Rider Pass</strong> turns green.</div>
            </div>
          </section>

          <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 mt-16">
            <div data-reveal className="relative overflow-hidden rounded-[28px] px-6 py-8 sm:px-10 sm:py-10 flex flex-col sm:flex-row sm:items-center gap-6" style={{ background: '#0B3B33', color: '#fff' }}>
              <span aria-hidden className="absolute -right-10 -bottom-16 w-64 h-64 rounded-full" style={{ background: 'rgba(31,217,196,0.18)' }} />
              <span aria-hidden className="absolute right-24 -top-10 w-24 h-24 rounded-full" style={{ background: 'rgba(255,176,32,0.25)' }} />
              <div className="relative flex-1">
                <h2 className="text-[28px] sm:text-[34px] font-extrabold leading-tight" style={{ letterSpacing: '-0.04em', fontFamily: RIDER_DISPLAY }}>Ready to <span style={{ color: '#FFB020' }}>ride?</span></h2>
                <p className="mt-2 text-[14.5px]" style={{ color: 'rgba(255,255,255,0.75)' }}>It's free to join. You must be 18 or older.</p>
              </div>
              <button onClick={() => go('signup')} className="relative h-13 px-8 py-3.5 rounded-full text-[16px] font-bold inline-flex items-center justify-center gap-2" style={{ background: '#FFB020', color: '#0B2B26' }}>Apply now <ArrowRight size={18} /></button>
            </div>
          </section>
        </main>
        {footer}
      </div>
    );
  }

  // ---------- Logged out: create an account or log in ----------
  if (!sess) {
    const t = authMode === 'signup' ? ['Create your rider account', 'Use an email you can open. You\'ll use it to log in and to hear from us.'] : authMode === 'login' ? ['Welcome back', 'Log in to continue your application or see where it is.'] : ['Forgot your password?', "Enter your email and we'll send you a link to set a new one."];
    return (
      <div style={page}>
        {header}
        <main className="max-w-6xl mx-auto px-5 pt-4 pb-10 grid lg:grid-cols-2 gap-8 items-center">
          <div className="hidden lg:block rounded-[32px] p-8" style={{ background: C.mint }}><RiderHeroArt className="w-full h-auto" /><div className="text-center text-[15px] font-semibold mt-2" style={{ color: C.inkDim }}>Deliver more. <span style={{ color: C.ink }}>Earn more.</span></div></div>
          <div className="w-full max-w-md mx-auto lg:mx-0">
          <button onClick={() => setView('home')} className="flex items-center gap-1 text-[13.5px] font-semibold mb-4" style={{ color: C.inkDim }}><ChevronLeft size={17} /> Back</button>
          <div className="lg:hidden -mx-2 mb-2"><RiderHeroArt className="w-full h-auto max-h-[210px]" /></div>
          <div className="rounded-[28px] p-6 sm:p-7" style={{ background: C.surface, boxShadow: '0 1px 0 rgba(11,43,38,0.04), 0 24px 50px -28px rgba(11,43,38,0.35)' }}>
            <h1 className="text-[26px] font-extrabold" style={{ letterSpacing: '-0.03em' }}>{t[0]}</h1>
            <p className="mt-1 text-[14px] leading-relaxed" style={{ color: C.inkDim }}>{t[1]}</p>
            <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); doAuth(); }}>
              <div>{label('Email')}<input type="email" autoComplete="email" value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value, error: '' })} placeholder="you@example.com" className={inputCls} style={field} /></div>
              {authMode !== 'forgot' && (
                <div>{label('Password', authMode === 'signup' ? `(at least ${PASSWORD_MIN_LENGTH} characters)` : '')}
                  <div className="relative"><input type={auth.show ? 'text' : 'password'} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value, error: '' })} className={`${inputCls} pr-12`} style={field} />
                    <button type="button" onClick={() => setAuth({ ...auth, show: !auth.show })} aria-label={auth.show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center" style={{ color: C.inkFaint }}>{auth.show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                </div>
              )}
              {auth.error && <div className="rounded-xl px-3.5 py-2.5 text-[13px]" style={{ background: C.rustSoft, color: C.rust }}>{auth.error}</div>}
              {auth.note && <div className="rounded-xl px-3.5 py-2.5 text-[13px]" style={{ background: C.sageSoft, color: C.sage }}>{auth.note}</div>}
              <button type="submit" disabled={auth.busy} className="w-full h-12 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2" style={{ background: C.copper, color: C.bg, opacity: auth.busy ? 0.7 : 1 }}>{auth.busy ? <Loader2 size={17} className="animate-spin" /> : null}{authMode === 'signup' ? 'Create account' : authMode === 'login' ? 'Log in' : 'Send the link'}</button>
            </form>
            <div className="mt-4 text-[13.5px] text-center" style={{ color: C.inkDim }}>
              {authMode === 'signup' ? <>Already have an account? <button onClick={() => setAuthMode('login')} className="font-semibold" style={{ color: C.copper }}>Log in</button></>
                : <><button onClick={() => setAuthMode('signup')} className="font-semibold" style={{ color: C.copper }}>Create an account</button>{authMode === 'login' && <> · <button onClick={() => setAuthMode('forgot')} className="font-semibold" style={{ color: C.inkDim }}>Forgot password?</button></>}</>}
            </div>
          </div>
          </div>
        </main>
      </div>
    );
  }

  if (me === undefined) return <div style={page} className="flex items-center justify-center"><Loader2 size={22} className="animate-spin" style={{ color: C.inkFaint }} /></div>;

  // ---------- This login belongs to a business: riders need their own account ----------
  if (me?.status === 'business_account') return (
    <div style={page}>
      {header}
      <main className="max-w-md mx-auto px-5 pt-4 pb-10">
        <RiderHeroArt className="w-full h-auto max-h-[220px]" />
        <div className="rounded-[28px] p-6 mt-2" style={{ background: C.surface, boxShadow: '0 1px 0 rgba(11,43,38,0.04), 0 24px 50px -28px rgba(11,43,38,0.35)' }}>
          <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: C.mint }}><Store size={22} style={{ color: C.sage }} /></span>
          <h1 className="mt-3 text-[24px] font-extrabold leading-tight" style={{ letterSpacing: '-0.03em' }}>This email is for a Xorla business</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: C.inkDim }}>To keep things safe, a rider account and a business account can't share a login. To ride with Xorla, create a rider account with a <strong style={{ color: C.ink }}>different email</strong>. Your business stays exactly as it is.</p>
          <button onClick={() => { logout(); setAuthMode('signup'); setView('auth'); }} className="mt-5 w-full h-12 rounded-full text-[15px] font-bold flex items-center justify-center gap-2" style={{ background: C.copper, color: '#fff' }}>Use a different email <ArrowRight size={17} /></button>
          <a href="/" className="mt-2.5 w-full h-12 rounded-full text-[14.5px] font-semibold flex items-center justify-center" style={{ color: C.ink, boxShadow: `inset 0 0 0 1.5px ${C.lineStrong}` }}>Go to my business</a>
        </div>
      </main>
    </div>
  );

  // ---------- Sent: where their application is ----------
  const status = me?.status || 'draft';
  // Approved: the work itself (jobs near you, the job in hand, earnings)
  if (status === 'approved') {
    return (
      <div style={page}>
        {header}
        <main className="max-w-xl mx-auto px-5 pt-5 pb-10"><RiderWork call={call} me={me} photo={photos.selfie_doc} token={sess?.access_token} /></main>
        {footer}
      </div>
    );
  }
  if (['submitted', 'approved', 'rejected', 'suspended'].includes(status)) {
    const first = String(me.full_name || '').split(' ')[0];
    const card = {
      submitted: [Clock, C.amber, `Thanks, ${first}. We're checking your application`, 'We check your ID and selfie, call your guarantor, and confirm your bank account. This usually takes 1 to 3 working days. We may call you on ' + (me.phone ? formatPhoneDisplay(me.phone) : 'your phone') + '.'],
      approved: [BadgeCheck, C.sage, `You're approved, ${first}!`, `Welcome to the Xorla rider network. Delivery jobs open city by city, starting with Umuahia and Aba. We'll message you on ${me.phone ? formatPhoneDisplay(me.phone) : 'your phone'} as soon as jobs open in ${(me.areas || []).slice(0, 2).join(' and ') || 'your area'}.`],
      rejected: [Ban, C.rust, "Your application wasn't approved", me.review_note || "We couldn't approve your application this time."],
      suspended: [Lock, C.rust, 'Your rider account is paused', me.review_note || 'The Xorla team has paused your account while they look into something.'],
    }[status];
    const Ic = card[0];
    const steps = [['Applied', !!me.submitted_at], ['Checked', status === 'approved'], ['Approved', status === 'approved'], ['Delivering', false]];
    return (
      <div style={page}>
        {header}
        <main className="max-w-xl mx-auto px-5 pt-6 pb-6">
          <RiderPass r={me} photo={photos.selfie_doc} />
          <div className="mt-4 rounded-[22px] p-5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${card[1]}22` }}><Ic size={22} style={{ color: card[1] }} /></span>
            <h1 className="mt-3 text-[22px] font-extrabold leading-tight" style={{ letterSpacing: '-0.02em' }}>{card[2]}</h1>
            <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: C.inkDim }}>{card[3]}</p>
            {['submitted', 'approved'].includes(status) && (
              <div className="mt-5 flex items-center">
                {steps.map(([t, done], i) => (
                  <React.Fragment key={t}>
                    <div className="flex flex-col items-center gap-1.5 min-w-0">
                      <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: done ? C.sage : i === steps.findIndex((s) => !s[1]) ? C.copperSoft : C.chip, border: `1.5px solid ${done ? C.sage : i === steps.findIndex((s) => !s[1]) ? C.copper : C.line}` }}>{done ? <Check size={15} style={{ color: C.bg }} /> : <span className="text-[12px] font-bold" style={{ color: C.inkDim }}>{i + 1}</span>}</span>
                      <span className="text-[11.5px] font-semibold" style={{ color: done ? C.ink : C.inkFaint }}>{t}</span>
                    </div>
                    {i < steps.length - 1 && <span className="flex-1 h-[2px] mx-1.5 -mt-5 rounded-full" style={{ background: done && steps[i + 1][1] ? C.sage : C.line }} />}
                  </React.Fragment>
                ))}
              </div>
            )}
            {status === 'approved' && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-xl px-3.5 py-3" style={{ background: C.field }}><div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>Paid into</div><div className="text-[13.5px] font-semibold mt-0.5 truncate">{me.bank_name} ····{String(me.account_number || '').slice(-4)}</div></div>
                <div className="rounded-xl px-3.5 py-3" style={{ background: C.field }}><div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>Your areas</div><div className="text-[13.5px] font-semibold mt-0.5 truncate">{(me.areas || []).length} chosen</div></div>
              </div>
            )}
            {['rejected', 'suspended'].includes(status) && RIDER_SUPPORT_WHATSAPP && <a href={`https://wa.me/${RIDER_SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hello Xorla, this is ${me.full_name} (rider, ${me.phone || ''}). About my rider account:`)}`} target="_blank" rel="noopener noreferrer" className="mt-4 h-11 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2" style={{ background: C.sage, color: C.bg }}><MessageCircle size={16} /> Message the Xorla team</a>}
          </div>
          {status === 'submitted' && <RiderSetup withAlerts={false} />}
          {status === 'submitted' && (
            <div className="mt-3 rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed flex gap-3" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.inkDim }}>
              <ShieldCheck size={17} className="shrink-0 mt-0.5" style={{ color: C.sage }} />
              <span>Tell your guarantor, <strong style={{ color: C.ink }}>{me.guarantor_name}</strong>, to expect a call from Xorla. Nobody from Xorla will ever ask you for money to approve you.</span>
            </div>
          )}
        </main>
        {footer}
      </div>
    );
  }

  // ---------- The application, step by step ----------
  const progress = RIDER_STEPS.map((_, i) => !stepProblem(i) && (i < 4 || !!me?.account_number));
  const lgas = NG_LGAS[f.state] || [];
  const motor = ['bike', 'tricycle', 'car', 'van'].includes(f.vehicle);
  const photoTile = (k, title, hint, Ic, capture) => (
    <div>
    {camBack === k && !photos[k] && !f[k] && (
      <div className="rounded-xl px-3.5 py-2.5 mb-2 text-[12.5px] leading-relaxed flex gap-2" style={{ background: C.copperSoft, color: C.ink }}>
        <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: C.copper }} />
        <span>Your phone closed this page while the camera was open, so the photo didn't come through. Your details are safe. Try again, or take the photo with your phone's camera app first, then tap <strong>Choose a photo you've taken</strong>.</span>
      </div>
    )}
    <label onClick={(e) => { if (k === 'selfie_doc' && canLiveCamera() && !otherWays && upBusy !== k) { e.preventDefault(); setLiveCam(true); return; } markCamera(k); }} className="relative block rounded-2xl overflow-hidden cursor-pointer" style={{ background: C.field, border: `1.5px dashed ${photos[k] || f[k] ? C.sage : C.lineStrong}` }}>
      <input type="file" accept="image/*" {...(capture ? { capture } : {})} className="sr-only" onChange={(e) => { pickPhoto(k, e.target.files?.[0]); e.target.value = ''; }} aria-label={title} />
      {photos[k] ? (
        <div className="relative">
          <img src={photos[k]} alt="" className={`w-full ${k === 'selfie_doc' ? 'h-56' : 'h-44'} object-cover`} />
          <span className="absolute left-2 top-2 px-2 py-1 rounded-lg text-[11.5px] font-bold flex items-center gap-1" style={{ background: C.sage, color: C.bg }}><Check size={12} /> Added</span>
          <span className="absolute right-2 bottom-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>Change</span>
        </div>
      ) : (
        <div className="px-4 py-6 flex flex-col items-center text-center">
          <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: C.copperSoft }}>{upBusy === k ? <Loader2 size={20} className="animate-spin" style={{ color: C.copper }} /> : <Ic size={21} style={{ color: C.copper }} />}</span>
          <span className="mt-2.5 text-[14.5px] font-semibold">{upBusy === k ? 'Uploading…' : title}</span>
          <span className="mt-1 text-[12.5px] leading-snug max-w-[260px]" style={{ color: C.inkFaint }}>{hint}</span>
        </div>
      )}
    </label>
    {capture && upBusy !== k && (k !== 'selfie_doc' || !canLiveCamera() || otherWays || camBack === k) && (
      <label className="mt-2 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12.5px] font-semibold cursor-pointer" style={{ color: C.sage }}>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { pickPhoto(k, e.target.files?.[0]); e.target.value = ''; }} aria-label={`${title}: choose a photo`} />
        <ImagePlus size={14} /> Choose a photo you've taken
      </label>
    )}
    {k === 'selfie_doc' && canLiveCamera() && !otherWays && upBusy !== k && (
      <button type="button" onClick={() => setOtherWays(true)} className="mt-1.5 w-full py-1.5 text-[12px] font-medium" style={{ color: C.inkFaint }}>Camera not working?</button>
    )}
    {k === 'selfie_doc' && liveCam && <LiveSelfie onUse={(file) => pickPhoto('selfie_doc', file, true)} onClose={() => setLiveCam(false)} onFail={() => setOtherWays(true)} />}
    </div>
  );
  const banksMatch = (banks || []).filter((b) => bank.q.trim() && b.name.toLowerCase().includes(bank.q.trim().toLowerCase())).slice(0, 6);
  const stepsBody = [
    // 1. About you
    <div key="you" className="space-y-4">
      <div>{label('Full name', '(as on your ID)')}<input value={f.full_name || ''} onChange={(e) => set({ full_name: e.target.value })} autoComplete="name" placeholder="e.g. Chinedu Okafor" className={inputCls} style={field} /></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>{label('Phone number')}<input type="tel" inputMode="tel" value={f.phone || ''} onChange={(e) => set({ phone: e.target.value })} autoComplete="tel" placeholder="0803 123 4567" className={inputCls} style={field} /></div>
        <div>{label('Date of birth')}<input type="date" value={f.date_of_birth || ''} max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10)} onChange={(e) => set({ date_of_birth: e.target.value })} className={inputCls} style={{ ...field, colorScheme: 'light' }} /></div>
      </div>
      <div>{label('Home address')}<textarea rows={2} value={f.home_address || ''} onChange={(e) => set({ home_address: e.target.value })} placeholder="House number, street, area" className={`${inputCls} resize-none`} style={field} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>{label('State')}<BrandSelect value={f.state || ''} onChange={(e) => set({ state: e.target.value, lga: '', areas: [] })} palette={RIDER_LIGHT} className="w-full rounded-xl px-4 py-3 text-[15px]" style={field} aria-label="State"><option value="">Choose</option>{NG_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</BrandSelect></div>
        <div>{label('Local government')}<BrandSelect value={f.lga || ''} onChange={(e) => set({ lga: e.target.value, areas: (f.areas || []).length ? f.areas : [e.target.value] })} palette={RIDER_LIGHT} className="w-full rounded-xl px-4 py-3 text-[15px]" style={field} aria-label="Local government"><option value="">{f.state ? 'Choose' : 'Choose a state'}</option>{lgas.map((l) => <option key={l} value={l}>{l}</option>)}</BrandSelect></div>
      </div>
    </div>,
    // 2. Your ride and areas
    <div key="ride" className="space-y-5">
      <div>{label('How do you deliver?')}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="How do you deliver?">
          {RIDER_VEHICLES.map(([k, l, d, Ic]) => { const on = f.vehicle === k; return (
            <button key={k} type="button" role="radio" aria-checked={on} onClick={() => set({ vehicle: k })} className="rounded-2xl px-3.5 py-3 text-left transition-colors" style={{ background: on ? C.copperSoft : C.field, border: `1.5px solid ${on ? C.copper : C.lineStrong}` }}>
              <Ic size={20} style={{ color: on ? C.copper : C.inkDim }} />
              <span className="block mt-1.5 text-[14px] font-semibold">{l}</span><span className="block text-[11.5px]" style={{ color: C.inkFaint }}>{d}</span>
            </button>
          ); })}
        </div>
      </div>
      {motor && <div>{label('Plate number')}<input value={f.plate_number || ''} onChange={(e) => set({ plate_number: e.target.value.toUpperCase() })} placeholder="e.g. UMH 482 QK" className={`${inputCls} cx-mono tracking-wider`} style={field} /></div>}
      <div>
        <div className="flex items-baseline justify-between">{label('Where will you deliver?')}<span className="text-[12px]" style={{ color: C.inkFaint }}>{(f.areas || []).length}/12 chosen</span></div>
        {!f.state ? <div className="text-[13px]" style={{ color: C.inkFaint }}>Choose your state in step 1 first.</div> : (
          <div className="flex flex-wrap gap-2">
            {lgas.map((l) => { const on = (f.areas || []).includes(l); return (
              <button key={l} type="button" aria-pressed={on} onClick={() => set({ areas: on ? f.areas.filter((x) => x !== l) : (f.areas || []).length >= 12 ? f.areas : [...(f.areas || []), l] })} className="px-3 py-2 rounded-full text-[13px] font-semibold flex items-center gap-1.5" style={chip(on)}>{on && <Check size={13} />}{l}</button>
            ); })}
          </div>
        )}
        <div className="text-[12px] mt-2" style={{ color: C.inkFaint }}>You'll only see jobs in these areas. You can change them later.</div>
      </div>
    </div>,
    // 3. ID and selfie
    <div key="id" className="space-y-5">
      <div>{label('Your ID')}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Your ID">
          {RIDER_ID_TYPES.map(([k, l, d]) => { const on = f.id_type === k; return (
            <button key={k} type="button" role="radio" aria-checked={on} onClick={() => set({ id_type: k })} className="rounded-xl px-3 py-2.5 text-left" style={{ background: on ? C.copperSoft : C.field, border: `1.5px solid ${on ? C.copper : C.lineStrong}` }}>
              <span className="block text-[13.5px] font-semibold">{l}</span>{d && <span className="block text-[11px]" style={{ color: C.inkFaint }}>{d}</span>}
            </button>
          ); })}
        </div>
      </div>
      {f.id_type && <div>{label(f.id_type === 'nin' ? 'NIN' : 'ID number', f.id_type === 'nin' ? '(11 digits)' : '')}<input value={f.id_number || ''} inputMode={f.id_type === 'nin' ? 'numeric' : 'text'} onChange={(e) => set({ id_number: e.target.value })} placeholder={f.id_type === 'nin' ? '12345678901' : 'As printed on the ID'} className={`${inputCls} cx-mono tracking-wider`} style={field} /></div>}
      <div className="grid sm:grid-cols-2 gap-3">
        {photoTile('id_doc', 'Photo of your ID', 'The front, flat on a table. All four corners and every word clear.', Contact, 'environment')}
        {photoTile('selfie_doc', 'Take a selfie', 'Face the light. No cap, no sunglasses, nobody else in the photo.', ScanFace, 'user')}
      </div>
      <div className="rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed flex gap-2.5" style={{ background: C.field, color: C.inkDim }}><Lock size={15} className="shrink-0 mt-0.5" style={{ color: C.sage }} /> We check that your face matches your ID. Only the Xorla team can see these photos.</div>
    </div>,
    // 4. Guarantor
    <div key="guarantor" className="space-y-4">
      <div className="rounded-xl px-3.5 py-3 text-[13px] leading-relaxed" style={{ background: C.copperSoft, color: C.ink }}>A guarantor is someone who knows you well and will stand for you. <span style={{ color: C.inkDim }}>We'll call them to confirm. Not a friend you just met, and not yourself.</span></div>
      <div>{label('Their full name')}<input value={f.guarantor_name || ''} onChange={(e) => set({ guarantor_name: e.target.value })} className={inputCls} style={field} /></div>
      <div>{label('Their phone number')}<input type="tel" inputMode="tel" value={f.guarantor_phone || ''} onChange={(e) => set({ guarantor_phone: e.target.value })} placeholder="0803 123 4567" className={inputCls} style={field} /></div>
      <div>{label('How do you know them?')}
        <div className="flex flex-wrap gap-2">{RIDER_RELATIONS.map((x) => <button key={x} type="button" aria-pressed={f.guarantor_relationship === x} onClick={() => set({ guarantor_relationship: x })} className="px-3 py-2 rounded-full text-[13px] font-semibold" style={chip(f.guarantor_relationship === x)}>{x}</button>)}</div>
      </div>
      <div>{label('Their address')}<textarea rows={2} value={f.guarantor_address || ''} onChange={(e) => set({ guarantor_address: e.target.value })} className={`${inputCls} resize-none`} style={field} /></div>
    </div>,
    // 5. Bank, review and send
    <div key="bank" className="space-y-5">
      <div>
        <div className="text-[15px] font-bold">Where we pay you</div>
        <div className="text-[13px] mt-0.5 mb-3" style={{ color: C.inkDim }}>Use an account in your own name. We check the name with your bank.</div>
        {me?.account_number ? (
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.sageSoft, border: '1px solid rgba(31,217,196,0.35)' }}>
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.sage }}><Landmark size={18} style={{ color: C.bg }} /></span>
            <span className="flex-1 min-w-0"><span className="block text-[15px] font-bold break-words">{me.account_name}</span><span className="block text-[12.5px]" style={{ color: C.inkDim }}>{me.bank_name} · <span className="cx-mono">{me.account_number}</span></span>
              <span className="flex items-center gap-1 mt-0.5 text-[11.5px] font-semibold" style={{ color: me.bank_verified ? C.sage : C.copper }}>{me.bank_verified ? <><BadgeCheck size={12} /> Name confirmed by your bank</> : 'Test mode: name not checked'}</span></span>
            <button onClick={() => setMe({ ...me, account_number: null })} className="shrink-0 text-[12.5px] font-semibold" style={{ color: C.copper }}>Change</button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {bank.code ? (
              <button type="button" onClick={() => setBank({ ...bank, code: '', name: '', q: '' })} className="w-full rounded-xl px-4 py-3 text-[15px] flex items-center justify-between text-left" style={field}><span className="font-semibold">{bank.name}</span><span className="text-[12.5px] font-semibold" style={{ color: C.copper }}>Change</span></button>
            ) : (
              <div>
                <div className="relative"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: C.inkFaint }} /><input value={bank.q} onChange={(e) => setBank({ ...bank, q: e.target.value, error: '' })} placeholder={banks === null ? 'Loading banks…' : 'Type your bank, e.g. Opay, GTBank, Moniepoint'} className={`${inputCls} pl-10`} style={field} /></div>
                {banksMatch.length > 0 && <div className="mt-1.5 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.lineStrong}` }}>{banksMatch.map((b) => <button key={b.code} type="button" onClick={() => setBank({ ...bank, code: b.code, name: b.name, q: '' })} className="w-full px-4 py-2.5 text-left text-[14px]" style={{ background: C.surfaceRaised, borderBottom: `1px solid ${C.line}` }}>{b.name}</button>)}</div>}
              </div>
            )}
            <input inputMode="numeric" maxLength={10} value={bank.number} onChange={(e) => setBank({ ...bank, number: e.target.value.replace(/\D/g, '').slice(0, 10), error: '' })} placeholder="10-digit account number" className={`${inputCls} cx-mono tracking-wider`} style={field} />
            {bank.error && <div className="rounded-xl px-3.5 py-2.5 text-[13px]" style={{ background: C.rustSoft, color: C.rust }}>{bank.error}</div>}
            <button type="button" onClick={checkBank} disabled={bank.busy} className="w-full h-12 rounded-xl text-[14.5px] font-bold flex items-center justify-center gap-2" style={{ background: C.sage, color: C.bg, opacity: bank.busy ? 0.7 : 1 }}>{bank.busy ? <><Loader2 size={16} className="animate-spin" /> Checking with your bank…</> : 'Check and save account'}</button>
          </div>
        )}
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        {[[0, 'You', [f.full_name, f.phone && formatPhoneDisplay(f.phone), [f.lga, f.state].filter(Boolean).join(', ')]], [1, 'Your ride', [(RIDER_VEHICLES.find(([k]) => k === f.vehicle) || [])[1], f.plate_number, `${(f.areas || []).length} area${(f.areas || []).length !== 1 ? 's' : ''}`]], [2, 'ID & selfie', [(RIDER_ID_TYPES.find(([k]) => k === f.id_type) || [])[1], f.id_doc ? 'ID photo added' : '', f.selfie_doc ? 'selfie added' : '']], [3, 'Guarantor', [f.guarantor_name, f.guarantor_relationship]]].map(([i, t, bits]) => (
          <button key={t} type="button" onClick={() => setStep(i)} className="w-full flex items-center gap-3 px-4 py-3 text-left" style={{ background: C.field, borderBottom: `1px solid ${C.line}` }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: progress[i] ? C.sage : C.rustSoft }}>{progress[i] ? <Check size={13} style={{ color: C.bg }} /> : <X size={13} style={{ color: C.rust }} />}</span>
            <span className="flex-1 min-w-0"><span className="block text-[13.5px] font-semibold">{t}</span><span className="block text-[12px] truncate" style={{ color: C.inkFaint }}>{bits.filter(Boolean).join(' · ') || 'Not filled in'}</span></span>
            <span className="text-[12.5px] font-semibold" style={{ color: C.copper }}>Edit</span>
          </button>
        ))}
      </div>
      <label className="flex items-start gap-3 cursor-pointer rounded-2xl p-4" style={{ background: C.field, border: `1px solid ${agree ? C.copper : C.line}` }}>
        <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErr(''); }} className="mt-1 w-5 h-5 accent-[#FFB020] shrink-0" />
        <span className="text-[13px] leading-relaxed" style={{ color: C.inkDim }}><strong style={{ color: C.ink }}>My details are true.</strong> I'll treat every delivery with care, never ask a customer for extra money, and I understand Xorla can pause riders after complaints. I agree that Xorla may check my ID with NIMC and compare my selfie with my ID photo. I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.copper }}>terms</a>.</span>
      </label>
    </div>,
  ];
  return (
    <div style={page}>
      {header}
      <main className="max-w-5xl mx-auto px-5 pt-4 pb-28 grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start" ref={topRef}>
        <aside className="lg:sticky lg:top-6 space-y-3 min-w-0">
          <div className="hidden lg:block"><RiderPass r={{ ...me, ...f, status }} photo={photos.selfie_doc} /></div>
          <div className="lg:hidden"><RiderPass r={{ ...me, ...f, status }} photo={photos.selfie_doc} compact /></div>
          <div className="hidden lg:block rounded-2xl p-4 text-[12.5px] leading-relaxed" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.inkDim }}><div className="flex items-center gap-2 font-semibold mb-1" style={{ color: C.ink }}><ShieldCheck size={15} style={{ color: C.sage }} /> Private and safe</div>Your details are saved as you go, so you can stop and come back. Only the Xorla team sees your ID, selfie and bank details.</div>
        </aside>
        <section className="min-w-0">
          {status === 'needs_fix' && me?.review_note && (
            <div className="mb-4 rounded-2xl p-4 flex gap-3" style={{ background: C.rustSoft, border: '1px solid rgba(226,98,75,0.35)' }}>
              <Pencil size={18} className="shrink-0 mt-0.5" style={{ color: C.rust }} />
              <span><span className="block text-[14.5px] font-bold">Please fix this, then send it again</span><span className="block text-[13.5px] mt-0.5 leading-relaxed" style={{ color: C.ink }}>{me.review_note}</span></span>
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-semibold" style={{ color: C.inkDim }}>Step {step + 1} of {RIDER_STEPS.length}</div>
            {saved && <div className="text-[12.5px] font-semibold flex items-center gap-1" style={{ color: C.sage }}><Check size={13} /> {saved}</div>}
          </div>
          <div className="flex gap-1.5 mb-5" role="tablist" aria-label="Application steps">
            {RIDER_STEPS.map(([k, l], i) => (
              <button key={k} role="tab" aria-selected={step === i} onClick={() => (i < step || progress.slice(0, i).every(Boolean)) && setStep(i)} className="flex-1 min-w-0 text-left">
                <span className="block h-1.5 rounded-full" style={{ background: i === step ? C.copper : progress[i] ? C.sage : C.track }} />
                <span className="hidden sm:block mt-1.5 text-[11.5px] font-semibold truncate" style={{ color: i === step ? C.ink : C.inkFaint }}>{l}</span>
              </button>
            ))}
          </div>
          <div className="rounded-[24px] p-5 sm:p-6" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <h1 className="text-[22px] font-extrabold mb-1" style={{ letterSpacing: '-0.02em' }}>{['About you', 'Your ride and areas', 'Your ID and a selfie', 'Your guarantor', 'Bank account, then send'][step]}</h1>
            <p className="text-[13.5px] mb-5" style={{ color: C.inkDim }}>{['Use your real details, exactly as on your ID.', 'Tell us what you ride and where you can deliver.', 'This keeps customers and riders safe.', 'Someone who knows you well and will stand for you.', 'Check everything, then send it to the Xorla team.'][step]}</p>
            {stepsBody[step]}
            {err && <div className="mt-4 rounded-xl px-3.5 py-2.5 text-[13px]" style={{ background: C.rustSoft, color: C.rust }}>{err}</div>}
          </div>
        </section>
      </main>
      <div className="fixed left-0 right-0 bottom-0 z-30" style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${C.line}`, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-5xl mx-auto px-5 py-3 flex gap-2.5 lg:pl-[calc(340px+44px)]">
          {step > 0 && <button onClick={() => saveStep(step - 1)} disabled={busy} className="h-12 px-5 rounded-xl text-[14.5px] font-semibold" style={{ color: C.ink, border: `1px solid ${C.lineStrong}` }}>Back</button>}
          {step < 4
            ? <button onClick={() => saveStep(step + 1)} disabled={busy || !!upBusy} className="flex-1 h-12 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2" style={{ background: C.copper, color: C.bg, opacity: busy || upBusy ? 0.7 : 1 }}>{busy ? <Loader2 size={17} className="animate-spin" /> : null}Save and continue <ArrowRight size={17} /></button>
            : <button onClick={submit} disabled={busy} className="flex-1 h-12 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2" style={{ background: progress.every(Boolean) && agree ? C.copper : 'rgba(255,176,32,0.35)', color: C.bg }}>{busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}{status === 'needs_fix' ? 'Send it again' : 'Send my application'}</button>}
        </div>
      </div>
    </div>
  );
}
export { RiderApp };
