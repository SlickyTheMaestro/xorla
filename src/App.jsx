import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import { Plus, Copy, Check, X, Phone, PhoneCall, Settings, Sparkles, Loader2, Wallet, TrendingUp, TrendingDown, ShoppingBag, Camera, PartyPopper, Send, Lock, Delete, Receipt, ChevronRight, ChevronLeft, Home, Search, Bell, ArrowUpRight, ArrowDownRight, LogOut, Lightbulb, Package, Users, Download, Share, SquarePlus, Globe, Store, Warehouse, Truck, PackagePlus, ArrowRight, ShieldCheck, Archive, Tag, CalendarClock } from 'lucide-react';
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

async function sbRest(table, { method = 'GET', accessToken, query = '', body, upsert = false } = {}) {
  // With no real session (public storefront visitors), authenticate as the anon key itself —
  // this is what lets Postgres correctly resolve the request as role "anon" for public RLS policies.
  const headers = { apikey: SB_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken || SB_KEY}` };
  if (method !== 'GET') headers.Prefer = upsert ? 'return=representation,resolution=merge-duplicates' : 'return=representation';
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
  // Some database actions succeed with an empty reply — only read a reply if there is one
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  if (!res.ok) throw new Error((data && (data.message || data.error_description)) || 'Something went wrong. Please try again.');
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
const EXPENSE_CATEGORIES = ['Transport', 'Fuel & power', 'Rent', 'Staff', 'Other'];
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
function fmtPdf(n) { return `NGN ${Number(n || 0).toLocaleString('en-NG')}`; } // jsPDF's built-in fonts can't render the ₦ glyph
const EDITABLE_SETTINGS = ['businessName', 'paymentLink', 'tone', 'customInstructions', 'language', 'ownerPhone', 'businessAddress', 'businessEmail', 'allowStaffExpenses', 'storefrontEnabled', 'storefrontTagline', 'businessType', 'autoReminders', 'summaryFrequency', 'myName'];
const SETTINGS_TITLES = { plan: 'Your plan', notifications: 'Notifications', shops: 'Shops', automation: 'Automatic WhatsApp', businessType: 'Business type', tour: 'App tour', branding: 'Name & logo', storefront: 'Storefront', messages: 'Messages & language', contact: 'Phone & contact', team: 'Staff & join code', security: 'App lock (PIN)' };
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
const BUSINESS_TERMS = {
  products: { catalog: 'Products', item: 'product', Item: 'Product', soldPrompt: 'What did you sell?', intro: 'Add what you sell once — pick it instantly when recording a sale, with cost and price auto-filled.', tracksStock: true, typeLabel: 'Sells products', salesTab: 'Sales', sale: 'sale', orders: 'Orders', order: 'order', amountPh: 'Sold for (₦)', costPh: 'Cost (optional)' },
  services: { catalog: 'Services', item: 'service', Item: 'Service', soldPrompt: 'What service did you do?', intro: 'Add the services you offer once — pick one instantly when recording a job, with your price filled in.', tracksStock: false, typeLabel: 'Offers services', salesTab: 'Jobs', sale: 'job', orders: 'Requests', order: 'request', amountPh: 'Amount charged (₦)', costPh: 'Materials cost (optional)' },
  both: { catalog: 'Catalog', item: 'item', Item: 'Item', soldPrompt: 'What did you sell or do?', intro: 'Add your products and services once — pick them instantly when recording a sale.', tracksStock: true, typeLabel: 'Products & services', salesTab: 'Sales', sale: 'sale', orders: 'Orders', order: 'order', amountPh: 'Amount (₦)', costPh: 'Cost (optional)' },
};
const BUSINESS_TYPE_CHOICES = [
  { id: 'products', title: 'I sell products', desc: 'Shops, boutiques, distributors, provisions — things you keep in stock.' },
  { id: 'services', title: 'I offer services', desc: 'Salons, tailors, mechanics, photographers, repairs, consulting.' },
  { id: 'both', title: 'Both', desc: 'For example, a salon that also sells hair products.' },
];
const PRICE_UNITS = [['fixed', 'Fixed price'], ['session', 'Per session'], ['hour', 'Per hour'], ['from', 'Starting from']];
const DURATIONS = ['30 minutes', '1 hour', '1.5 hours', '2 hours', '3 hours', '4 hours', 'Half a day', 'Full day', '2+ days'];
function priceLabel(p) {
  const amt = fmt(p.sellingPrice);
  if (p.priceUnit === 'hour') return `${amt} / hour`;
  if (p.priceUnit === 'session') return `${amt} / session`;
  if (p.priceUnit === 'from') return `From ${amt}`;
  return amt;
}
// Items saved before "kind" existed follow the business type
function kindOf(p, businessType) {
  return p.kind || (businessType === 'services' ? 'service' : 'product');
}
function base64UrlToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}
const DEVICE_WORD = typeof navigator !== 'undefined' && /iPad|Tablet/i.test(navigator.userAgent) ? 'tablet'
  : typeof navigator !== 'undefined' && /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent) ? 'phone' : 'computer';
// Android browsers where web push is known not to deliver reliably (subscribing "works", but nothing arrives)
const PUSH_UNRELIABLE_BROWSER = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) && /(EdgA|OPR|OPT|Opera)/i.test(navigator.userAgent)
  ? (/EdgA/i.test(navigator.userAgent) ? 'Edge' : 'Opera') : null;
const PLAN_INFO = {
  free: { name: 'Free', staff: 0, locations: 1, products: 20, ai: 10, wa: 0 },
  pro: { name: 'Pro', staff: 3, locations: 1, products: null, ai: 150, wa: 100 },
  business: { name: 'Business', staff: 10, locations: 3, products: null, ai: 500, wa: 500 },
};
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

function loadImageAsDataURL(url) {
  return fetch(url)
    .then((res) => res.blob())
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);
}

function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
}

async function downloadInvoicePDF(inv, settings) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 60;

  let logoDataUrl = null;
  if (settings.logoUrl) logoDataUrl = await loadImageAsDataURL(settings.logoUrl);

  // Logo sits in a fixed, standard-size box (44x44pt) — image scales to fit inside it without stretching,
  // and the business name always starts at the same X position regardless of the logo's actual shape.
  const LOGO_BOX = 44;
  let textX = marginX;
  if (logoDataUrl) {
    try {
      const dims = await getImageDimensions(logoDataUrl);
      const ratio = dims.width / dims.height;
      let logoW = LOGO_BOX, logoH = LOGO_BOX;
      if (ratio > 1) logoH = LOGO_BOX / ratio; else logoW = LOGO_BOX * ratio;
      const offsetX = (LOGO_BOX - logoW) / 2;
      const offsetY = (LOGO_BOX - logoH) / 2;
      doc.addImage(logoDataUrl, 'JPEG', marginX + offsetX, y - 30 + offsetY, logoW, logoH);
      textX = marginX + LOGO_BOX + 14;
    } catch (e) {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(settings.businessName || 'Your Business', textX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  if (settings.ownerPhone) { y += 15; doc.text(`Tel: ${settings.ownerPhone}`, textX, y); }
  if (settings.businessEmail) { y += 14; doc.text(settings.businessEmail, textX, y); }
  if (settings.businessAddress) {
    const bizAddrLines = doc.splitTextToSize(settings.businessAddress, 220);
    y += 14;
    doc.text(bizAddrLines, textX, y);
    y += (bizAddrLines.length - 1) * 12;
  }
  const businessBlockBottom = y;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('INVOICE', pageWidth - marginX, 60, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`Invoice #: ${inv.invoiceNo}`, pageWidth - marginX, 80, { align: 'right' });
  doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - marginX, 94, { align: 'right' });
  doc.text(`Due: ${new Date(inv.dueDate).toLocaleDateString('en-GB')}`, pageWidth - marginX, 108, { align: 'right' });

  y = Math.max(150, businessBlockBottom + 24, 130);
  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 28;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BILL TO', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  y += 16;
  doc.text(inv.clientName, marginX, y);
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  if (inv.phone) { y += 14; doc.text(inv.phone, marginX, y); }
  if (inv.clientAddress) {
    const addrLines = doc.splitTextToSize(inv.clientAddress, 240);
    y += 14;
    doc.text(addrLines, marginX, y);
    y += (addrLines.length - 1) * 12;
  }
  doc.setTextColor(0, 0, 0);

  y += 36;
  // Right-aligned numeric columns with generous spacing — prevents values from overlapping
  const colQtyX = pageWidth - marginX - 210;
  const colPriceX = pageWidth - marginX - 105;
  const colTotalX = pageWidth - marginX;
  const descX = marginX + 10;

  doc.setFillColor(19, 50, 44);
  doc.rect(marginX, y, pageWidth - marginX * 2, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DESCRIPTION', descX, y + 17);
  doc.text('QTY', colQtyX, y + 17, { align: 'right' });
  doc.text('UNIT PRICE', colPriceX, y + 17, { align: 'right' });
  doc.text('TOTAL', colTotalX, y + 17, { align: 'right' });
  y += 26;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const items = invoiceLineItems(inv);
  items.forEach((item, i) => {
    y += 26;
    if (i % 2 === 1) { doc.setFillColor(247, 247, 247); doc.rect(marginX, y - 17, pageWidth - marginX * 2, 24, 'F'); }
    const descLines = doc.splitTextToSize(String(item.description), colQtyX - descX - 20);
    doc.text(descLines, descX, y);
    doc.text(String(item.quantity), colQtyX, y, { align: 'right' });
    doc.text(fmtPdf(item.unitPrice), colPriceX, y, { align: 'right' });
    doc.text(fmtPdf(Number(item.quantity) * Number(item.unitPrice)), colTotalX, y, { align: 'right' });
    if (descLines.length > 1) y += (descLines.length - 1) * 12;
  });

  y += 40;
  const subtotal = invoiceSubtotal(inv);
  const tax = subtotal * (Number(inv.taxRate || 0) / 100);
  doc.setFontSize(10);
  doc.text('Subtotal', colPriceX, y, { align: 'right' });
  doc.text(fmtPdf(subtotal), colTotalX, y, { align: 'right' });
  if (Number(inv.taxRate) > 0) {
    y += 20;
    doc.text(`Tax (${inv.taxRate}%)`, colPriceX, y, { align: 'right' });
    doc.text(fmtPdf(tax), colTotalX, y, { align: 'right' });
  }
  y += 10;
  doc.setDrawColor(220, 220, 220);
  doc.line(colQtyX, y, pageWidth - marginX, y);
  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TOTAL', colPriceX, y, { align: 'right' });
  doc.text(fmtPdf(subtotal + tax), colTotalX, y, { align: 'right' });

  if (inv.paidAmount > 0) {
    y += 24;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`Paid so far: ${fmtPdf(inv.paidAmount)}`, colPriceX, y, { align: 'right' });
    y += 14;
    doc.text(`Balance due: ${fmtPdf(subtotal + tax - inv.paidAmount)}`, colPriceX, y, { align: 'right' });
  }

  if (settings.paymentLink) {
    y += 44;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Payment details', marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    y += 14;
    doc.text(settings.paymentLink, marginX, y);
  }

  if (inv.notes) {
    y += 34;
    doc.setDrawColor(230, 230, 230);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 18;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(90, 90, 90);
    const noteLines = doc.splitTextToSize(inv.notes, pageWidth - marginX * 2);
    doc.text(noteLines, marginX, y);
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated with Xorla', marginX, doc.internal.pageSize.getHeight() - 30);

  doc.save(`Invoice-${inv.invoiceNo}.pdf`);
}

function timeLabel(iso) { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function dateKeyOf(iso) { return new Date(iso).toLocaleDateString('sv-SE'); }

function fromSbSale(row) {
  return { id: row.id, item: row.item, amount: row.amount, cost: row.cost || 0, owed: row.owed || 0, soldAt: row.sold_at, basketId: row.basket_id || null, productId: row.product_id || null, quantity: Number(row.quantity) || 1, dateKey: dateKeyOf(row.sold_at), time: timeLabel(row.sold_at), loggedBy: row.logged_by_name || '', photo: null, shopId: row.shop_id || null };
}
function fromSbInvoice(row) {
  return { id: row.id, clientName: row.client_name, invoiceNo: row.invoice_no, amount: row.amount, paidAmount: row.paid_amount || 0, dueDate: row.due_date, phone: row.phone || '', loggedBy: row.logged_by_name || '', items: row.items || [], taxRate: row.tax_rate || 0, clientAddress: row.client_address || '', notes: row.notes || '', autoReminderCount: row.auto_reminder_count || 0, shopId: row.shop_id || null };
}
function fromSbExpense(row) {
  return { id: row.id, item: row.item, amount: row.amount, category: row.category || 'Other', dateKey: dateKeyOf(row.spent_at), time: timeLabel(row.spent_at), loggedBy: row.logged_by_name || '', shopId: row.shop_id || null };
}
function fromSbProduct(row) {
  return { id: row.id, name: row.name, costPrice: row.cost_price || 0, sellingPrice: row.selling_price || 0, imageUrl: row.image_url || null, stockQuantity: row.stock_quantity === null || row.stock_quantity === undefined ? null : Number(row.stock_quantity), lowStockThreshold: row.low_stock_threshold ?? 5, trackStock: !!row.track_stock || (row.stock_quantity !== null && row.stock_quantity !== undefined), category: row.category || '', kind: row.kind || null, priceUnit: row.price_unit || 'fixed', duration: row.duration || '', description: row.description || '' };
}
function fromSbOrder(row) {
  return { id: row.id, customerName: row.customer_name, customerPhone: row.customer_phone || '', items: row.items || [], total: row.total || 0, status: row.status, createdAt: row.created_at, preferredTime: row.preferred_time || '', note: row.note || '', shopId: row.shop_id || null };
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
// All AI goes through Xorla's own backend (a Supabase Edge Function), which holds the secret key,
// checks the user is logged in, and caps daily use. The app never talks to the AI company directly.
let AI_ACCESS_TOKEN = null;
function setAiAccessToken(token) { AI_ACCESS_TOKEN = token; }
async function callClaude(prompt, task = 'oga') {
  if (!AI_ACCESS_TOKEN) throw new Error('Please log in again to use Oga.');
  let response;
  try {
    response = await fetch(`${SB_URL}/functions/v1/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${AI_ACCESS_TOKEN}` },
      body: JSON.stringify({ task, prompt }),
    });
  } catch (e) {
    throw new Error("Couldn't reach Oga. Check your internet connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || "Oga couldn't answer just now. Please try again.");
  const text = String(data.text || '').trim();
  if (!text) throw new Error('No answer came back. Try rephrasing your question.');
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
  const text = await callClaude(prompt, 'message');
  return text || staticMessage(inv, settings);
}
async function aiThankYou(inv, settings) {
  const prompt = `You are helping a Nigerian business write a short, warm WhatsApp thank-you message to a client who just finished paying an invoice in full.

Client name: ${inv.clientName}
Invoice number: ${inv.invoiceNo}
Amount paid in total: ${fmt(inv.amount)}
Write the entire message in ${LANGUAGE_LABEL[settings.language] || 'English'}.

Write ONLY the WhatsApp message text, nothing else. Keep it under 40 words. Sound genuinely appreciative and human.`;
  const text = await callClaude(prompt, 'message');
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
  const text = await callClaude(prompt, 'summary');
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

Products over the last 30 days (${ctx.shopView || 'whole business'}), best sellers first:
${ctx.productSummary || '- Not available.'}

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

// PINs are stored per account on this device — a different business logging in never inherits someone else's PIN
function getStoredPin(userId) { try { return (userId && localStorage.getItem(`xorla:pin:${userId}`)) || ''; } catch (e) { return ''; } }
function setStoredPin(userId, pin) { try { if (!userId) return; if (pin) localStorage.setItem(`xorla:pin:${userId}`, pin); else localStorage.removeItem(`xorla:pin:${userId}`); } catch (e) {} }

function PinPad({ title, subtitle, error, onComplete, footer, top }) {
  const [entry, setEntry] = useState('');
  const [shake, setShake] = useState(false);
  useEffect(() => { setEntry(''); }, [title]);
  const press = (d) => {
    if (entry.length >= 4) return;
    const next = entry + d; setEntry(next);
    if (next.length === 4) {
      setTimeout(() => {
        const ok = onComplete(next);
        if (ok === false) { setShake(true); setTimeout(() => { setShake(false); setEntry(''); }, 450); }
        else setEntry('');
      }, 140);
    }
  };
  const keyStyle = { color: C.ink, background: C.surfaceRaised };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative" style={{ background: C.bg, color: C.ink }}>
      {top}
      <div className="w-11 h-11 rounded-full flex items-center justify-center mb-5" style={{ background: C.copperSoft }}>
        <Lock size={18} style={{ color: C.copper }} />
      </div>
      <div className="text-[17px] font-semibold cx-display mb-1.5 text-center">{title}</div>
      <div className="text-[13px] mb-8 text-center max-w-[280px]" style={{ color: error ? C.rust : C.inkFaint }}>{error || subtitle}</div>
      <div className={`flex gap-4 mb-10 ${shake ? 'animate-pulse' : ''}`} aria-live="polite" aria-label={`${entry.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-3 h-3 rounded-full transition-colors" style={{ background: i < entry.length ? (shake ? C.rust : C.copper) : 'transparent', border: `1.5px solid ${i < entry.length ? (shake ? C.rust : C.copper) : C.lineStrong}` }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-[260px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)} className="aspect-square rounded-full text-[22px] font-medium active:scale-95 transition-transform" style={keyStyle}>{d}</button>
        ))}
        <div />
        <button onClick={() => press('0')} className="aspect-square rounded-full text-[22px] font-medium active:scale-95 transition-transform" style={keyStyle}>0</button>
        <button onClick={() => setEntry((v) => v.slice(0, -1))} aria-label="Delete last digit" className="aspect-square rounded-full flex items-center justify-center active:scale-95 transition-transform" style={{ color: C.inkDim }}><Delete size={22} /></button>
      </div>
      {footer && <div className="mt-8">{footer}</div>}
    </div>
  );
}

function LockScreen({ pin, businessName, onUnlock, onForgot }) {
  return (
    <PinPad
      title={businessName ? `Welcome back to ${businessName}` : 'Enter your PIN'}
      subtitle="Enter your 4-digit PIN to open Xorla"
      onComplete={(code) => { if (code === pin) { onUnlock(); return true; } return false; }}
      footer={<button onClick={onForgot} className="text-[13px] font-medium" style={{ color: C.copper }}>Forgot PIN? Log in with your password</button>}
    />
  );
}

// Set, change, or turn off the PIN. Changing or removing always asks for the current PIN first.
function PinSetup({ currentPin, mode, onFinish, onCancel }) {
  const [stage, setStage] = useState(currentPin ? 'verify' : 'new');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const titles = {
    verify: mode === 'remove' ? 'Enter your PIN to turn it off' : 'Enter your current PIN',
    new: currentPin ? 'Choose your new PIN' : 'Choose a 4-digit PIN',
    confirm: 'Enter it once more to confirm',
  };
  const subtitles = {
    verify: 'So we know it\'s really you.',
    new: 'Avoid easy ones like 1234 or your birth year.',
    confirm: 'Just making sure you remember it.',
  };
  const onComplete = (code) => {
    if (stage === 'verify') {
      if (code !== currentPin) { setError('That PIN is wrong — try again.'); return false; }
      setError('');
      if (mode === 'remove') { onFinish(''); return true; }
      setStage('new'); return true;
    }
    if (stage === 'new') { setError(''); setFirst(code); setStage('confirm'); return true; }
    if (code !== first) { setError("Those didn't match — choose your PIN again."); setFirst(''); setStage('new'); return false; }
    onFinish(code); return true;
  };
  return (
    <div className="fixed inset-0 z-[90]">
      <PinPad
        title={titles[stage]}
        subtitle={subtitles[stage]}
        error={error}
        onComplete={onComplete}
        top={<button onClick={onCancel} className="absolute top-6 left-5 flex items-center gap-1 text-[13px] font-medium" style={{ color: C.inkDim }}><ChevronLeft size={18} /> Cancel</button>}
      />
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
        <button onClick={() => { setStep('owner'); setMode('login'); }} className="w-full rounded-xl p-4 mb-2.5 text-left transition-all hover:border-opacity-100 active:scale-[0.98]" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }} onMouseEnter={(e) => e.currentTarget.style.borderColor = C.sage} onMouseLeave={(e) => e.currentTarget.style.borderColor = C.line}>
          <div className="text-[13.5px] font-semibold">I'm the business owner</div>
          <div className="text-[11.5px] mt-0.5" style={{ color: C.inkFaint }}>Full dashboard — sales, invoices, expenses, team, and advice.</div>
        </button>
        <button onClick={() => { setStep('staff'); setMode('login'); }} className="w-full rounded-xl p-4 text-left transition-all active:scale-[0.98]" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }} onMouseEnter={(e) => e.currentTarget.style.borderColor = C.copper} onMouseLeave={(e) => e.currentTarget.style.borderColor = C.line}>
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
        <button onClick={() => { setStep('role'); setResetSent(false); setError(''); setMode('login'); }} className="flex items-center gap-1 text-[12px] mb-4" style={{ color: C.inkFaint }}><ChevronLeft size={14} /> Back</button>
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
        const result = await onDone();
        if (!result.ok) throw new Error(result.removed ? "Your access to this business has been removed. Contact the business owner if you think this is a mistake." : "Logged in, but couldn't load your business. Please try again.");
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    };
    return wrap('Join your business', mode === 'login' ? 'Log back in.' : "Enter your employer's business code to join.", (
      <>
        <button onClick={() => { setStep('role'); setMode('login'); }} className="flex items-center gap-1 text-[12px] mb-4" style={{ color: C.inkFaint }}><ChevronLeft size={14} /> Back</button>
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
        const bootResult = await onDone();
        if (!bootResult.ok) throw new Error(bootResult.removed ? "This account no longer has access to a business." : "Logged in, but couldn't load your business. Please try again.");
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
      <button onClick={() => { setStep('role'); setMode('login'); }} className="flex items-center gap-1 text-[12px] mb-4" style={{ color: C.inkFaint }}><ChevronLeft size={14} /> Back</button>
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

// Branded dropdown — a drop-in replacement for <select> that matches Xorla's look.
// Takes the same <option> children and calls onChange({ target: { value } }) like a native select.
function BrandSelect({ value, onChange, children, className = '', style = {}, disabled, icon, 'aria-label': ariaLabel }) {
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
    const onScroll = (e) => { if (listRef.current?.contains(e.target)) return; setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', away); document.removeEventListener('touchstart', away);
      window.removeEventListener('resize', place); window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);
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
        style={{ ...style, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, ...(open ? { borderColor: C.copper } : {}) }}>
        <span className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="truncate" style={{ color: current && current.value !== '' ? C.ink : C.inkFaint }}>{current ? current.label : ''}</span>
        </span>
        <ChevronRight size={15} className="shrink-0" style={{ color: open ? C.copper : C.inkFaint, transform: `rotate(${open ? -90 : 90}deg)`, transition: 'transform .15s' }} />
      </button>
      {open && pos && createPortal(
        <div ref={listRef} role="listbox" aria-label={ariaLabel} className="fixed z-[200] rounded-xl py-1.5 max-h-64 overflow-y-auto"
          style={{ ...pos, width: 'max-content', maxWidth: 'min(340px, 90vw)', background: C.surface, border: `1px solid ${C.lineStrong || C.line}`, boxShadow: '0 16px 40px rgba(0,0,0,0.5)', fontFamily: "'Inter', sans-serif" }}>
          {opts.map((o, i) => {
            const sel = i === selIndex;
            return (
              <button key={i} type="button" role="option" aria-selected={sel} disabled={o.disabled}
                onMouseEnter={() => setActive(i)} onClick={() => pick(o)}
                className="w-full text-left px-3.5 py-2.5 text-[13px] flex items-center justify-between gap-4"
                style={{ background: i === active ? C.surfaceRaised : 'transparent', color: o.value === '' ? C.inkFaint : sel ? C.copper : C.ink, fontWeight: sel ? 600 : 400, opacity: o.disabled ? 0.4 : 1 }}>
                <span className="truncate">{o.label}</span>
                {sel && o.value !== '' && <Check size={14} className="shrink-0" style={{ color: C.copper }} />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

function XorlaApp() {
  const [tab, setTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [invoicesAll, setInvoices] = useState([]);
  const [salesAll, setSales] = useState([]);
  const [expensesAll, setExpenses] = useState([]);
  const [productsAll, setProducts] = useState([]);
  const [productShops, setProductShops] = useState([]);
  const [stockTransfers, setStockTransfers] = useState([]);
  const [stockRequests, setStockRequests] = useState([]);
  const [stockPanel, setStockPanel] = useState(null); // 'delivery' | 'transfer' | 'request'
  const [stockBusy, setStockBusy] = useState(false);
  const [stockError, setStockError] = useState('');
  const [deliveryForm, setDeliveryForm] = useState({ lines: [{ productId: '', split: {} }], arrived: true, note: '' });
  const [sendForm, setSendForm] = useState({ from: '', to: '', lines: [{ productId: '', qty: '' }], receivedNow: false, requestId: null, note: '' });
  const [requestForm, setRequestForm] = useState({ lines: [{ productId: '', qty: '' }], note: '' });
  const [receiveQty, setReceiveQty] = useState({});
  const [ordersAll, setOrders] = useState([]);
  const [locationsAll, setShops] = useState([]);
  const [staffShops, setStaffShops] = useState([]);
  const [staffPresence, setStaffPresence] = useState([]);
  const [currentShopId, setCurrentShopId] = useState('all');
  const [recordShopId, setRecordShopId] = useState(null);
  const [settings, setSettings] = useState({ paymentLink: '', tone: 'friendly', customInstructions: '', language: 'english', ownerPhone: '', pin: '', staffList: [], activeStaff: '', businessName: '', loggedIn: false, role: 'owner', allowStaffExpenses: false, businessCode: '', businessAddress: '', businessEmail: '', storefrontEnabled: false, heroImageUrl: null, storefrontTagline: '', autoReminders: false, summaryFrequency: 'off' });
  const T = BUSINESS_TERMS[settings.businessType] || BUSINESS_TERMS.products;
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ---------- Multi-shop: the whole app follows the shop switcher ----------
  const isOwnerRole = settings.role === 'owner';
  // Locations are shops (they sell) or warehouses (storage only). Sales, staff, and the storefront only ever see shops.
  const liveLocations = locationsAll.filter((s) => !s.archived);
  const closedLocations = locationsAll.filter((s) => s.archived);
  const shops = liveLocations.filter((s) => (s.kind || 'shop') !== 'warehouse');
  const warehouses = liveLocations.filter((s) => s.kind === 'warehouse');
  const locations = [...shops, ...warehouses];
  const hasManyLocations = locations.length > 1;
  const mainShopId = (shops.find((s) => s.is_main) || shops[0])?.id || null;
  const myShops = isOwnerRole ? shops : (() => {
    const mine = shops.filter((s) => staffShops.some((ss) => ss.profile_id === session?.user_id && ss.shop_id === s.id));
    return mine.length ? mine : shops.slice(0, 1);
  })();
  const viewAllShops = isOwnerRole && (currentShopId === 'all' || shops.length <= 1);
  const activeShopId = viewAllShops ? null : (myShops.some((s) => s.id === currentShopId) ? currentShopId : myShops[0]?.id || null);
  const targetShopId = activeShopId || (myShops.some((s) => s.id === recordShopId) ? recordShopId : null) || mainShopId;
  const showShopSwitcher = myShops.length > 1;
  const shopNameOf = (id) => (locationsAll.find((s) => s.id === (id || mainShopId)) || {}).name || '';
  const inActiveShop = (r) => viewAllShops || (r.shopId || mainShopId) === activeShopId;
  const sales = salesAll.filter(inActiveShop);
  const expenses = expensesAll.filter(inActiveShop);
  const invoices = invoicesAll.filter(inActiveShop);
  const orders = ordersAll.filter(inActiveShop);

  // Per-shop stock and prices. Viewing one shop shows its numbers; "All shops" shows totals.
  const shopRow = (productId, shopId) => productShops.find((r) => r.product_id === productId && r.shop_id === shopId);
  const stockAt = (p, shopId) => Number(shopRow(p.id, shopId)?.stock_quantity || 0);
  const priceAt = (p, shopId) => {
    const o = shopId ? shopRow(p.id, shopId)?.price_override : null;
    return o !== null && o !== undefined ? Number(o) : Number(p.sellingPrice);
  };
  const stockShopIds = activeShopId ? [activeShopId] : (isOwnerRole ? locations : myShops).map((s) => s.id);
  const products = productsAll.map((p) => {
    const tracked = p.trackStock && kindOf(p, settings.businessType) === 'product';
    const lowShops = tracked ? stockShopIds.filter((id) => stockAt(p, id) <= p.lowStockThreshold) : [];
    return {
      ...p,
      basePrice: Number(p.sellingPrice),
      sellingPrice: priceAt(p, activeShopId || targetShopId),
      stockQuantity: tracked ? stockShopIds.reduce((a, id) => a + stockAt(p, id), 0) : null,
      lowShops: lowShops.map(shopNameOf),
      isLow: T.tracksStock && lowShops.length > 0,
    };
  });
  const hasShopPrices = (p) => productShops.some((r) => r.product_id === p.id && r.price_override !== null && r.price_override !== undefined);
  const setLocalStock = (productId, shopId, qty) => setProductShops((prev) => {
    const exists = prev.some((r) => r.product_id === productId && r.shop_id === shopId);
    return exists ? prev.map((r) => (r.product_id === productId && r.shop_id === shopId ? { ...r, stock_quantity: qty } : r)) : [...prev, { product_id: productId, shop_id: shopId, stock_quantity: qty, price_override: null }];
  });
  // Every stock change goes through one safe database step, so simultaneous sales can't overwrite each other
  const changeStock = async (productId, shopId, change, reason) => {
    const next = await sbRpc('adjust_stock', session.access_token, { p_product_id: productId, p_shop_id: shopId, p_change: change, p_reason: reason });
    setLocalStock(productId, shopId, Number(next));
    return Number(next);
  };
  const [loaded, setLoaded] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

  useEffect(() => {
    if (isStandalone) return; // already installed — never nag someone who's already using it as an app
    const dismissed = localStorage.getItem('xorla:install-dismissed');

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!dismissed) setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleInstalled = () => { setShowInstallBanner(false); setInstallPrompt(null); };
    window.addEventListener('appinstalled', handleInstalled);

    // iOS never fires beforeinstallprompt — show our own instructions instead, if not already dismissed
    if (isIOS && !dismissed) setShowInstallBanner(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [isIOS, isStandalone]);

  const handleInstallClick = async () => {
    if (isIOS) { setShowIOSSteps(true); return; }
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setShowInstallBanner(false);
  };
  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    setShowIOSSteps(false);
    try { localStorage.setItem('xorla:install-dismissed', '1'); } catch (e) {}
  };
  // ---------- First-time guided tour ----------
  const [tourStep, setTourStep] = useState(null);
  const [tourRect, setTourRect] = useState(null);
  const tourKey = session ? `xorla:tour-done:${session.user_id}` : null;
  const tourSteps = [
    { target: null, title: 'Welcome to Xorla', body: "Here's a 30-second look at where everything is. You can skip anytime." },
    { target: 'profit', title: 'Your real profit, at a glance', body: 'Money in, minus what your goods cost, minus what you spent. It updates as you record.' },
    { target: 'nav-sales', title: T.tracksStock ? 'Record every sale here' : 'Record every job here', body: `Tap ${T.salesTab}, then add what you ${T.tracksStock ? 'sold' : 'did'}. If someone still owes you, Xorla tracks it. ${T.orders} from your online store show up here too.` },
    { target: 'nav-products', title: `Your ${T.catalog.toLowerCase()}`, body: `Add each ${T.item} once with its price. After that, recording a sale takes one tap.` },
    { target: 'nav-invoices', title: 'Money people owe you', body: 'Every unpaid balance lives here, most urgent first, with a one-tap WhatsApp reminder.' },
    { target: 'nav-expenses', title: 'What you spend', body: 'Log rent, transport, and restocking so your profit is the true number.' },
    { target: 'settings', title: 'Make it yours', body: 'Your logo, WhatsApp number, online storefront, and team are all in Settings.' },
    { target: 'oga', title: 'Ask Oga — in your language', body: 'Your business advisor. Ask about your sales, profit, or customers in English, Pidgin, Yoruba, Igbo, or Hausa. Tap Ask Oga to choose your language.' },
    { target: null, title: "You're all set", body: `The best first step: add your first ${T.item}. You can replay this tour anytime from Settings.`, final: true },
  ];
  const langIntroKey = session ? `xorla:lang-intro-seen:${session.user_id}` : null;
  const [showLangIntro, setShowLangIntro] = useState(false);
  useEffect(() => {
    if (!langIntroKey || !tourKey || settings.role !== 'owner') return;
    try { setShowLangIntro(!!localStorage.getItem(tourKey) && !localStorage.getItem(langIntroKey)); } catch (e) {}
  }, [langIntroKey, tourKey, settings.role]);
  const dismissLangIntro = () => { setShowLangIntro(false); try { if (langIntroKey) localStorage.setItem(langIntroKey, '1'); } catch (e) {} };

  const endTour = () => { setTourStep(null); setTourRect(null); try { if (tourKey) localStorage.setItem(tourKey, '1'); if (langIntroKey) localStorage.setItem(langIntroKey, '1'); } catch (e) {} setShowLangIntro(false); };
  const startTour = () => { setTab('overview'); setTourStep(0); };

  // Start once, for owners, right after they've told us what kind of business they run
  useEffect(() => {
    if (!settings.loggedIn || settings.role !== 'owner' || !settings.businessType || !tourKey || tourStep !== null) return;
    let done = false;
    try { done = !!localStorage.getItem(tourKey); } catch (e) {}
    if (!done) startTour();
  }, [settings.loggedIn, settings.role, settings.businessType, tourKey]);

  // Find the highlighted element (whichever copy is visible — bottom bar on phones, sidebar on desktop)
  useEffect(() => {
    if (tourStep === null) return;
    const step = tourSteps[tourStep];
    const measure = () => {
      if (!step || !step.target) { setTourRect(null); return; }
      const el = [...document.querySelectorAll(`[data-tour="${step.target}"]`)].find((n) => n.getBoundingClientRect().width > 0);
      if (!el) { setTourRect(null); return; }
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) { el.scrollIntoView({ block: 'center' }); }
      const r2 = el.getBoundingClientRect();
      setTourRect({ top: r2.top, left: r2.left, width: r2.width, height: r2.height });
    };
    const t = setTimeout(measure, 60);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure); };
  }, [tourStep, tab]);

  const openInstallFromSettings = () => {
    if (isIOS) { setTab('overview'); setShowInstallBanner(true); setShowIOSSteps(true); return; }
    if (installPrompt) { handleInstallClick(); return; }
    alert("Your browser doesn't support installing from here — on Android, look for \"Install app\" or \"Add to Home screen\" in your browser's menu (⋮).");
  };

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
  const [restockingId, setRestockingId] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [restockShopId, setRestockShopId] = useState(null);
  const [restockCost, setRestockCost] = useState('');
  const [productsView, setProductsView] = useState('list');
  const [notifOpen, setNotifOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [usage, setUsage] = useState(null);
  const [earlySpots, setEarlySpots] = useState(null);
  const [planInterval, setPlanInterval] = useState('monthly');
  const [planExtra, setPlanExtra] = useState(0);
  const [payMode, setPayMode] = useState('once');
  const [billingBusy, setBillingBusy] = useState(null);
  const [billingNote, setBillingNote] = useState(null);
  const [pendingPlanOpen, setPendingPlanOpen] = useState(false);
  const [billingReturnRef, setBillingReturnRef] = useState(null);
  const [limitPrompt, setLimitPrompt] = useState(null);
  const [seatOk, setSeatOk] = useState(null);
  const [planBannerHidden, setPlanBannerHidden] = useState(false);
  const [pushState, setPushState] = useState('checking'); // checking | unsupported | ios-install | denied | off | on
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState(null);
  const badgeRef = useRef(0);
  const lastBadgeRef = useRef(-1);
  const [insightDays, setInsightDays] = useState(30);
  const [correctingId, setCorrectingId] = useState(null);
  const [correctQty, setCorrectQty] = useState('');
  const [correctShopId, setCorrectShopId] = useState(null);
  const [transferringId, setTransferringId] = useState(null);
  const [transferForm, setTransferForm] = useState({ from: '', to: '', qty: '' });
  const [productForm, setProductForm] = useState({ name: '', costPrice: '', sellingPrice: '', stockQuantity: '', lowStockThreshold: '5', category: '', kind: 'product', priceUnit: 'fixed', duration: '', description: '', imageBlob: null, imagePreview: null });
  const formIsService = settings.businessType === 'services' || (settings.businessType === 'both' && productForm.kind === 'service');
  const fieldLabel = 'text-[10.5px] font-semibold tracking-wide mb-1.5';
  const [productImageUploading, setProductImageUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [openSections, setOpenSections] = useState(new Set(['branding']));
  const [settingsPage, setSettingsPage] = useState(null);
  const [pinFlow, setPinFlow] = useState(null);
  const [pinNotice, setPinNotice] = useState('');
  const [waConnected, setWaConnected] = useState(null);
  const [waTesting, setWaTesting] = useState(false);
  const [waNotice, setWaNotice] = useState(null);
  const [waLog, setWaLog] = useState([]);
  const callWhatsApp = async (action) => {
    const res = await fetch(`${SB_URL}/functions/v1/whatsapp`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ action }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  };
  useEffect(() => {
    if (settingsPage !== 'automation' || !session) return;
    setWaNotice(null);
    callWhatsApp('status').then((d) => setWaConnected(!!d.connected)).catch(() => setWaConnected(false));
    sbRest('message_log', { accessToken: session.access_token, query: '?select=kind,to_phone,status,error,created_at&order=created_at.desc&limit=8' }).then(setWaLog).catch(() => setWaLog([]));
  }, [settingsPage]);
  const sendWhatsAppTest = async () => {
    setWaTesting(true); setWaNotice(null);
    try { await callWhatsApp('test'); setWaNotice({ ok: true, text: 'Test summary sent — check your WhatsApp.' }); }
    catch (e) { setWaNotice({ ok: false, text: e.message }); }
    finally { setWaTesting(false); }
  };
  const [saveNotice, setSaveNotice] = useState('');
  const [aiNotice, setAiNotice] = useState('');
  const showAiNotice = (msg) => { setAiNotice(msg); setTimeout(() => setAiNotice(''), 6000); };
  const [pendingBusinessType, setPendingBusinessType] = useState(null);
  const toggleSection = (id) => setOpenSections((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const [previousTab, setPreviousTab] = useState('overview');
  const [draft, setDraft] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [savingSale, setSavingSale] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [paperWidth, setPaperWidth] = useState(() => { try { return localStorage.getItem('xorla:paper') || '58'; } catch (e) { return '58'; } });
  const [cartMode, setCartMode] = useState(false);
  const [cartItems, setCartItems] = useState([{ productId: '', description: '', quantity: '1', unitPrice: '', unitCost: '' }]);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceView, setInvoiceView] = useState('active');
  const [viewDate, setViewDate] = useState(todayKey());
  const [staffFilter, setStaffFilter] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ clientName: '', invoiceNo: '', amount: '', dueDate: '', phone: '', clientAddress: '', itemized: false, items: [{ description: '', quantity: '1', unitPrice: '' }], taxRate: '0', notes: '' });
  const [saleForm, setSaleForm] = useState({ item: '', amount: '', cost: '', fullyPaid: true, paidNow: '', customerName: '', customerPhone: '', dueDate: '', photo: null, productId: '', quantity: '1' });
  const [expenseForm, setExpenseForm] = useState({ item: '', amount: '', category: 'Other' });
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
      const staffRows = await sbRest('profiles', { accessToken, query: `?business_id=eq.${profile.business_id}&role=eq.staff&select=id,name` });
      staffRoster = staffRows.map((r) => ({ id: r.id, name: r.name }));
    }
    return { profile, business, staffRoster };
  }, []);

  const loadBusinessData = useCallback(async (accessToken) => {
    try {
      const [salesRows, invoiceRows, expenseRows, productRows, orderRows, shopRows, staffShopRows, presenceRows, productShopRows, transferRows, requestRows, subscriptionRows, paymentRows] = await Promise.all([
        sbRest('sales', { accessToken, query: '?select=*&order=sold_at.desc' }),
        sbRest('invoices', { accessToken, query: '?select=*&order=created_at.desc' }),
        sbRest('expenses', { accessToken, query: '?select=*&order=spent_at.desc' }),
        sbRest('products', { accessToken, query: '?select=*&order=name.asc' }),
        sbRest('orders', { accessToken, query: '?select=*&order=created_at.desc' }),
        sbRest('shops', { accessToken, query: '?select=*&order=created_at.asc' }).catch(() => []),
        sbRest('staff_shops', { accessToken, query: '?select=*' }).catch(() => []),
        sbRest('profiles', { accessToken, query: '?role=eq.staff&select=id,name,last_seen_at' }).catch(() => []),
        sbRest('product_shops', { accessToken, query: '?select=*' }).catch(() => []),
        sbRest('stock_transfers', { accessToken, query: '?select=*&order=created_at.desc&limit=300' }).catch(() => []),
        sbRest('stock_requests', { accessToken, query: '?select=*&order=created_at.desc&limit=100' }).catch(() => []),
        sbRest('subscriptions', { accessToken, query: '?select=business_id,plan,billing_interval,extra_shops,status,trial_ends_at,current_period_end,early_supporter,early_supporter_until,auto_renew,card_last4,card_brand' }).catch(() => null),
        sbRest('payments', { accessToken, query: '?select=*&order=paid_at.desc&limit=12' }).catch(() => []),
      ]);
      setSales(salesRows.map(fromSbSale));
      setInvoices(invoiceRows.map(fromSbInvoice));
      setExpenses(expenseRows.map(fromSbExpense));
      setProducts(productRows.map(fromSbProduct));
      setOrders(orderRows.map(fromSbOrder));
      setShops(shopRows);
      setStaffShops(staffShopRows);
      setStaffPresence(presenceRows);
      setProductShops(productShopRows);
      setStockTransfers(transferRows);
      setStockRequests(requestRows);
      setSubscription(Array.isArray(subscriptionRows) && subscriptionRows[0] ? subscriptionRows[0] : null);
      setPayments(paymentRows || []);
    } catch (e) {
      console.error('Loading business data failed:', e);
    }
  }, []);

  // Staff apps quietly report "I'm here" once a minute while open, so the owner can see who's online
  useEffect(() => {
    if (settings.role !== 'staff' || !session?.access_token) return;
    const ping = () => { if (document.visibilityState === 'visible') sbRpc('touch_last_seen', session.access_token, {}).catch(() => {}); };
    ping();
    const t = setInterval(ping, 60 * 1000);
    document.addEventListener('visibilitychange', ping);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', ping); };
  }, [settings.role, session?.access_token]);

  // Brand-coloured scrollbars on desktop, only while the Xorla dashboard is open
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'xorla-scrollbars';
    el.textContent = `
      @media (pointer: fine) {
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, ${C.sage}, #12A898); border-radius: 999px; border: 2px solid ${C.bg}; }
        ::-webkit-scrollbar-thumb:hover { background: ${C.sage}; }
        ::-webkit-scrollbar-corner { background: transparent; }
        @supports (-moz-appearance: none) { * { scrollbar-color: ${C.sage} ${C.bg}; scrollbar-width: thin; } }
      }`;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  // App icon badge: shows how many things are waiting; disappears when there's nothing left
  useEffect(() => {
    const n = badgeRef.current;
    if (n === lastBadgeRef.current) return;
    lastBadgeRef.current = n;
    try {
      if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n).catch(() => {});
      else if (n === 0 && navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
    } catch (e) {}
  });
  // Opening Xorla clears its notifications from the phone's tray — the bell inside shows everything anyway
  useEffect(() => {
    const clearTray = () => {
      if (document.visibilityState !== 'visible' || !('serviceWorker' in navigator)) return;
      navigator.serviceWorker.ready.then((reg) => reg.getNotifications ? reg.getNotifications() : []).then((list) => list.forEach((note) => note.close())).catch(() => {});
    };
    clearTray();
    document.addEventListener('visibilitychange', clearTray);
    return () => document.removeEventListener('visibilitychange', clearTray);
  }, []);
  // ---------- Push notifications ----------
  const checkPush = () => {
    if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) return;
    if (Notification.permission === 'denied') { setPushState('denied'); return; }
    navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((sub) => setPushState(sub ? 'on' : 'off')).catch(() => setPushState('off'));
  };
  // Open the screen a notification points to: on first load (?tab=...) and when a notification is tapped while Xorla is open
  useEffect(() => {
    const openFrom = (href) => {
      try {
        const t = new URL(href, window.location.origin).searchParams.get('tab');
        if (t && ['overview', 'sales', 'orders', 'products', 'expenses', 'invoices', 'advisor'].includes(t)) setTab(t);
        if (t === 'plan') setPendingPlanOpen(true);
      } catch (e) {}
    };
    openFrom(window.location.href);
    const q = new URLSearchParams(window.location.search);
    if (q.get('billing') === 'return') setBillingReturnRef(q.get('reference') || q.get('trxref') || '');
    if (window.location.search.includes('tab=') || q.get('billing')) window.history.replaceState(null, '', window.location.pathname);
    const onMsg = (e) => { if (e.data?.type === 'xorla-open') openFrom(e.data.url); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, []);
  // Work out whether this phone can get notifications, and whether it already does
  useEffect(() => {
    if (!session) return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) { setPushState(isIOS && !isStandalone ? 'ios-install' : 'unsupported'); return; }
    checkPush();
    const onVisible = () => { if (document.visibilityState === 'visible') checkPush(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [session?.user_id]);

  // Renew the login token every 45 minutes while the app stays open (tokens expire after about an hour),
  // so saves and Oga keep working for owners who leave Xorla open all day
  useEffect(() => {
    if (!session?.refresh_token) return;
    const t = setInterval(async () => {
      try {
        const r = await sbRefresh(session.refresh_token);
        const next = { access_token: r.access_token, refresh_token: r.refresh_token, user_id: r.user.id };
        await saveSession(next);
        setSession(next);
        setAiAccessToken(next.access_token);
      } catch (e) { console.error('Session renewal failed', e); }
    }, 45 * 60 * 1000);
    return () => clearInterval(t);
  }, [session?.refresh_token]);

  // Quietly refresh in the background every 20s so new entries from teammates show up without a manual reload
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => { loadBusinessData(session.access_token); }, 20000);
    return () => clearInterval(interval);
  }, [session, loadBusinessData]);

  const applySession = useCallback((sess, profile, business, staffRoster, lockIfPin = false) => {
    setSession(sess);
    setAiAccessToken(sess.access_token);
    const myPin = profile.role === 'owner' ? getStoredPin(sess.user_id) : '';
    setLocked(lockIfPin && !!myPin);
    setSettings((prev) => ({
      ...prev,
      loggedIn: true,
      role: profile.role,
      activeStaff: profile.name,
      pin: myPin,
      myName: profile.name,
      businessName: business.name,
      businessId: business.id,
      businessCode: business.business_code,
      paymentLink: business.payment_link || '',
      tone: business.reminder_tone || 'friendly',
      customInstructions: business.custom_instructions || '',
      language: business.language || 'english',
      ownerPhone: business.owner_phone || '',
      allowStaffExpenses: !!business.allow_staff_expenses,
      autoReminders: !!business.auto_reminders_enabled,
      summaryFrequency: business.summary_frequency || 'off',
      businessType: business.business_type || null,
      logoUrl: business.logo_url || null,
      businessAddress: business.address || '',
      businessEmail: business.email || '',
      storefrontEnabled: !!business.storefront_enabled,
      heroImageUrl: business.hero_image_url || null,
      heroImages: Array.isArray(business.hero_images) && business.hero_images.length ? business.hero_images : (business.hero_image_url ? [business.hero_image_url] : []),
      storefrontTagline: business.storefront_tagline || '',
      staffList: staffRoster,
    }));
    loadBusinessData(sess.access_token);
  }, [loadBusinessData]);

  const bootstrap = useCallback(async (opts = {}) => {
    setAuthLoading(true);
    const sess = await loadSession();
    if (!sess) { setAuthLoading(false); return { ok: false }; }
    try {
      const { profile, business, staffRoster } = await fetchProfileAndBusiness(sess.access_token, sess.user_id);
      applySession(sess, profile, business, staffRoster, !opts.fresh);
      setAuthLoading(false);
      return { ok: true };
    } catch (e) {
      const removed1 = e.message === 'Profile not found';
      try {
        const refreshed = await sbRefresh(sess.refresh_token);
        const newSess = { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, user_id: refreshed.user.id };
        await saveSession(newSess);
        const { profile, business, staffRoster } = await fetchProfileAndBusiness(newSess.access_token, newSess.user_id);
        applySession(newSess, profile, business, staffRoster, !opts.fresh);
        setAuthLoading(false);
        return { ok: true };
      } catch (e2) {
        console.error('Bootstrap failed:', e, e2);
        await clearSession();
        setAuthLoading(false);
        return { ok: false, removed: removed1 || e2.message === 'Profile not found' };
      }
    }
  }, [fetchProfileAndBusiness, applySession]);

  const logout = useCallback(async () => {
    if (session) { try { await fetch(`${SB_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${session.access_token}` } }); } catch (e) {} }
    await clearSession();
    setSession(null);
    setAiAccessToken(null);
    setLocked(false);
    setTab('overview');
    setSettingsPage(null);
    setSettings((prev) => ({ ...prev, loggedIn: false, role: 'owner', activeStaff: '', businessName: '', staffList: [], pin: '' }));
  }, [session]);

  const [newShopName, setNewShopName] = useState('');
  const [newShopKind, setNewShopKind] = useState('shop');
  const [shopEdits, setShopEdits] = useState({});
  const [shopBusy, setShopBusy] = useState(false);
  const addShop = async () => {
    const name = newShopName.trim(); if (!name || shopBusy) return;
    if (planKnown && liveLocations.length >= planCaps.locations) {
      setLimitPrompt(effPlan === 'business'
        ? { title: `Your plan includes ${planCaps.locations} locations`, body: 'Add extra locations to your Business plan for ₦3,500 a month each, then open this one.' }
        : { title: 'More locations come with Business', body: 'Run several shops and warehouses with stock transfers, deliveries and requests between them. Business includes 3 locations, with more as you grow.' });
      return;
    }
    setShopBusy(true);
    try {
      const rows = await sbRest('shops', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, name, ...(newShopKind === 'warehouse' ? { kind: 'warehouse' } : {}) } });
      setShops((prev) => [...prev, rows[0]]); setNewShopName('');
    } catch (e) { alert(e.message); } finally { setShopBusy(false); }
  };
  const saveShop = async (shop) => {
    const edit = shopEdits[shop.id]; if (!edit) return;
    const name = (edit.name ?? shop.name).trim() || shop.name;
    const address = (edit.address ?? shop.address ?? '').trim();
    try {
      await sbRest(`shops?id=eq.${shop.id}`, { method: 'PATCH', accessToken: session.access_token, body: { name, address } });
      setShops((prev) => prev.map((s) => (s.id === shop.id ? { ...s, name, address } : s)));
      setShopEdits((prev) => { const n = { ...prev }; delete n[shop.id]; return n; });
    } catch (e) { alert(e.message); }
  };
  // Close a location that's shut down (history is kept), or reopen it
  const closeLocation = async (loc) => {
    const left = productShops.filter((r) => r.shop_id === loc.id && Number(r.stock_quantity) > 0);
    if (left.length) {
      const units = left.reduce((a, r) => a + Number(r.stock_quantity), 0);
      alert(`${loc.name} still has ${units} item${units !== 1 ? 's' : ''} in stock. Move its remaining stock to another location first (Products → Send stock), then close it.`);
      return;
    }
    if (!window.confirm(`Close ${loc.name}? It disappears from the app and your storefront, and staff lose access to it. Its past sales and records stay in your reports, and you can reopen it later.`)) return;
    try {
      await sbRest(`shops?id=eq.${loc.id}`, { method: 'PATCH', accessToken: session.access_token, body: { archived: true } });
      await sbRest(`staff_shops?shop_id=eq.${loc.id}`, { method: 'DELETE', accessToken: session.access_token }).catch(() => {});
      setShops((prev) => prev.map((s) => (s.id === loc.id ? { ...s, archived: true } : s)));
      setStaffShops((prev) => prev.filter((ss) => ss.shop_id !== loc.id));
      if (currentShopId === loc.id) setCurrentShopId('all');
    } catch (e) { alert(e.message); }
  };
  const reopenLocation = async (loc) => {
    try {
      await sbRest(`shops?id=eq.${loc.id}`, { method: 'PATCH', accessToken: session.access_token, body: { archived: false } });
      setShops((prev) => prev.map((s) => (s.id === loc.id ? { ...s, archived: false } : s)));
    } catch (e) { alert(e.message); }
  };

  const toggleStaffShop = async (profileId, shopId) => {
    const assigned = staffShops.filter((ss) => ss.profile_id === profileId);
    const has = assigned.some((ss) => ss.shop_id === shopId);
    if (has && assigned.length === 1) { alert('Everyone needs at least one shop. Add another shop for them first, then remove this one.'); return; }
    try {
      if (has) {
        await sbRest(`staff_shops?profile_id=eq.${profileId}&shop_id=eq.${shopId}`, { method: 'DELETE', accessToken: session.access_token });
        setStaffShops((prev) => prev.filter((ss) => !(ss.profile_id === profileId && ss.shop_id === shopId)));
      } else {
        await sbRest('staff_shops', { method: 'POST', accessToken: session.access_token, body: { profile_id: profileId, shop_id: shopId } });
        setStaffShops((prev) => [...prev, { profile_id: profileId, shop_id: shopId }]);
      }
    } catch (e) { alert(e.message); }
  };

  const removeStaff = async (staffId, staffName) => {
    if (!window.confirm(`Remove ${staffName}? They'll be logged out immediately and won't be able to log back in.`)) return;
    try {
      await sbRest(`profiles?id=eq.${staffId}`, { method: 'DELETE', accessToken: session.access_token });
      setSettings((prev) => ({ ...prev, staffList: prev.staffList.filter((s) => s.id !== staffId) }));
    } catch (e) { alert(e.message); }
  };

  useEffect(() => {
    (async () => {
      try { localStorage.removeItem(SETTINGS_KEY); } catch (e) {} // retire the old device-wide PIN
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
    const cleanItems = form.itemized ? form.items.filter((it) => it.description.trim() && Number(it.unitPrice) > 0).map((it) => ({ description: it.description.trim(), quantity: Number(it.quantity) || 1, unitPrice: Number(it.unitPrice) })) : [];
    const computedAmount = form.itemized
      ? cleanItems.reduce((a, it) => a + it.quantity * it.unitPrice, 0) * (1 + Number(form.taxRate || 0) / 100)
      : Number(form.amount);
    if (!form.clientName || !form.invoiceNo || !form.dueDate) { setError('Fill in client, invoice number, and due date.'); return; }
    if (form.itemized && cleanItems.length === 0) { setError('Add at least one line item with a description and price.'); return; }
    if (!form.itemized && !form.amount) { setError('Enter an amount, or switch to itemized to add line items.'); return; }
    if (savingInvoice) return;
    setSavingInvoice(true);
    try {
      const rows = await sbRest('invoices', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, shop_id: targetShopId, logged_by: session.user_id, logged_by_name: settings.activeStaff || '', client_name: form.clientName, invoice_no: form.invoiceNo, amount: computedAmount, paid_amount: 0, due_date: form.dueDate, phone: form.phone, client_address: form.clientAddress, items: cleanItems, tax_rate: form.itemized ? Number(form.taxRate || 0) : 0, notes: form.notes } });
      setInvoices((prev) => [fromSbInvoice(rows[0]), ...prev]);
      setForm({ clientName: '', invoiceNo: '', amount: '', dueDate: '', phone: '', clientAddress: '', itemized: false, items: [{ description: '', quantity: '1', unitPrice: '' }], taxRate: '0', notes: '' });
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
      const saleRows = await sbRest('sales', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, shop_id: targetShopId, logged_by: session.user_id, logged_by_name: settings.activeStaff || '', item: saleForm.item, amount: saleForm.amount, cost: saleForm.cost || 0, owed, product_id: saleForm.productId || null, quantity: saleForm.productId ? Math.max(1, Number(saleForm.quantity) || 1) : 1 } });
      const newSale = fromSbSale(saleRows[0]);
      setSales((prev) => [newSale, ...prev]);

      if (owed > 0) {
        const defaultDue = new Date(); defaultDue.setDate(defaultDue.getDate() + 7);
        const invRows = await sbRest('invoices', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, shop_id: targetShopId, logged_by: session.user_id, logged_by_name: settings.activeStaff || '', client_name: saleForm.customerName || 'Customer', invoice_no: `SALE-${newSale.id.slice(-5)}`, amount: saleForm.amount, paid_amount: saleForm.paidNow || 0, due_date: saleForm.dueDate || defaultDue.toISOString().slice(0, 10), phone: saleForm.customerPhone, items: [{ description: saleForm.item, quantity: 1, unitPrice: Number(saleForm.amount) }] } });
        setInvoices((prev) => [fromSbInvoice(invRows[0]), ...prev]);
      }

      if (saleForm.productId) {
        const product = products.find((p) => p.id === saleForm.productId);
        if (product && product.stockQuantity !== null) {
          const qtySold = Math.max(1, Number(saleForm.quantity) || 1);
          try { await changeStock(product.id, targetShopId, -qtySold, 'sale'); }
          catch (e) { console.error('Stock update failed:', e); }
        }
      }

      setReceipt(makeReceipt({ id: newSale.id, items: [{ name: saleForm.item, amount: Number(saleForm.amount) }], total: saleForm.amount, owed, customerName: saleForm.customerName, customerPhone: saleForm.customerPhone, shopId: targetShopId }));
      setSaleForm({ item: '', amount: '', cost: '', fullyPaid: true, paidNow: '', customerName: '', customerPhone: '', dueDate: '', photo: null, productId: '', quantity: '1' });
      setShowSaleForm(false);
    } catch (e) { console.error(e); alert(e.message); } finally { setSavingSale(false); }
  };
  const removeSale = async (id) => {
    const sale = sales.find((s) => s.id === id);
    if (!window.confirm(`Remove "${sale?.item || 'this sale'}"? This can't be undone.`)) return;
    try { await sbRest(`sales?id=eq.${id}`, { method: 'DELETE', accessToken: session.access_token }); setSales((prev) => prev.filter((s) => s.id !== id)); }
    catch (e) { alert(e.message); }
  };

  const applyProductToCartRow = (idx, productId) => {
    const items = [...cartItems];
    if (!productId) { items[idx] = { ...items[idx], productId: '' }; setCartItems(items); return; }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    items[idx] = { ...items[idx], productId, description: product.name, unitPrice: String(product.sellingPrice), unitCost: String(product.costPrice) };
    setCartItems(items);
  };

  const addCartSale = async () => {
    const cleanItems = cartItems
      .filter((it) => it.description.trim() && Number(it.unitPrice) > 0)
      .map((it) => ({ productId: it.productId || null, description: it.description.trim(), quantity: Math.max(1, Number(it.quantity) || 1), unitPrice: Number(it.unitPrice), unitCost: Number(it.unitCost) || 0 }));
    if (!cleanItems.length) return;
    if (savingSale) return;
    setSavingSale(true);
    try {
      const totalAmount = cleanItems.reduce((a, it) => a + it.quantity * it.unitPrice, 0);
      const owed = saleForm.fullyPaid ? 0 : Math.max(0, totalAmount - Number(saleForm.paidNow || 0));

      // One sale row per product — keeps per-product analytics, COGS, and stock tracking accurate
      const newSales = [];
      // One basket = one receipt: every item shares a basket ID; the balance owed sits on the first item
      const basketId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : null;
      for (const [idx, it] of cleanItems.entries()) {
        const rows = await sbRest('sales', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, shop_id: targetShopId, logged_by: session.user_id, logged_by_name: settings.activeStaff || '', item: it.quantity > 1 ? `${it.description} ×${it.quantity}` : it.description, amount: it.quantity * it.unitPrice, cost: it.quantity * it.unitCost, owed: idx === 0 ? owed : 0, product_id: it.productId || null, quantity: it.quantity, ...(basketId ? { basket_id: basketId } : {}) } });
        newSales.push(rows[0]);
        if (it.productId) {
          const product = products.find((p) => p.id === it.productId);
          if (product && product.stockQuantity !== null) {
            try { await changeStock(product.id, targetShopId, -it.quantity, 'sale'); }
            catch (e) { console.error('Stock update failed:', e); }
          }
        }
      }
      setSales((prev) => [...newSales.map(fromSbSale), ...prev]);

      if (owed > 0) {
        const defaultDue = new Date(); defaultDue.setDate(defaultDue.getDate() + 7);
        const invItems = cleanItems.map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice }));
        const invRows = await sbRest('invoices', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, shop_id: targetShopId, logged_by: session.user_id, logged_by_name: settings.activeStaff || '', client_name: saleForm.customerName || 'Customer', invoice_no: `SALE-${Date.now().toString().slice(-6)}`, amount: totalAmount, paid_amount: saleForm.paidNow || 0, due_date: saleForm.dueDate || defaultDue.toISOString().slice(0, 10), phone: saleForm.customerPhone, items: invItems } });
        setInvoices((prev) => [fromSbInvoice(invRows[0]), ...prev]);
      }

      setReceipt(makeReceipt({ id: basketId || newSales[0]?.id, items: cleanItems.map((it) => ({ name: it.quantity > 1 ? `${it.description} ×${it.quantity}` : it.description, amount: it.quantity * it.unitPrice })), total: totalAmount, owed, customerName: saleForm.customerName, customerPhone: saleForm.customerPhone, shopId: targetShopId }));
      setCartItems([{ productId: '', description: '', quantity: '1', unitPrice: '', unitCost: '' }]);
      setSaleForm((f) => ({ ...f, fullyPaid: true, paidNow: '', customerName: '', customerPhone: '', dueDate: '' }));
      setShowSaleForm(false);
      setCartMode(false);
    } catch (e) { console.error(e); alert(e.message); } finally { setSavingSale(false); }
  };

  const addExpense = async () => {
    if (!expenseForm.item || !expenseForm.amount) return;
    if (savingExpense) return;
    setSavingExpense(true);
    try {
      const rows = await sbRest('expenses', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, shop_id: targetShopId, logged_by: session.user_id, logged_by_name: settings.activeStaff || '', item: expenseForm.item, amount: expenseForm.amount, category: expenseForm.category } });
      setExpenses((prev) => [fromSbExpense(rows[0]), ...prev]);
      setExpenseForm({ item: '', amount: '', category: 'Other' });
      setShowExpenseForm(false);
    } catch (e) { alert(e.message); } finally { setSavingExpense(false); }
  };
  const removeExpense = async (id) => {
    const exp = expenses.find((e) => e.id === id);
    if (!window.confirm(`Remove "${exp?.item || 'this expense'}"? This can't be undone.`)) return;
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

  const saveHeroImages = async (list) => {
    await sbRest(`businesses?id=eq.${settings.businessId}`, { method: 'PATCH', accessToken: session.access_token, body: { hero_images: list, hero_image_url: list[0] || null } });
    setSettings((prev) => ({ ...prev, heroImages: list, heroImageUrl: list[0] || null }));
  };
  const handleHeroSelect = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    if ((settings.heroImages || []).length >= 5) { alert('You can have up to 5 banner photos. Remove one to add another.'); return; }
    setHeroUploading(true);
    try {
      const blob = await resizeImageToBlob(file, 1600, 0.82);
      const path = `${settings.businessId}/hero-${Date.now()}.jpg`;
      const url = await sbUploadImage(session.access_token, blob, path);
      await saveHeroImages([...(settings.heroImages || []), url]);
    } catch (err) { alert(err.message); } finally { setHeroUploading(false); }
  };
  const removeHeroImage = async (url) => {
    if (!window.confirm('Remove this banner photo from your storefront?')) return;
    try { await saveHeroImages((settings.heroImages || []).filter((u) => u !== url)); } catch (err) { alert(err.message); }
  };

  const handleLogoSelect = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoUploading(true);
    try {
      const blob = await resizeImageToBlob(file, 300, 0.85);
      const path = `${settings.businessId}/logo-${Date.now()}.jpg`;
      const url = await sbUploadImage(session.access_token, blob, path);
      await sbRest(`businesses?id=eq.${settings.businessId}`, { method: 'PATCH', accessToken: session.access_token, body: { logo_url: url } });
      setSettings((prev) => ({ ...prev, logoUrl: url }));
      setDraft((prev) => (prev ? { ...prev, logoUrl: url } : prev));
    } catch (err) { alert(err.message); } finally { setLogoUploading(false); }
  };

  const addProduct = async () => {
    if (!productForm.name || !productForm.sellingPrice) return;
    if (savingProduct) return;
    if (!editingProductId && planKnown && planCaps.products !== null && productsAll.length >= planCaps.products) {
      setLimitPrompt({ title: `The Free plan includes ${planCaps.products} ${T.catalog.toLowerCase()}`, body: `Upgrade to Pro for unlimited ${T.catalog.toLowerCase()}, up to 3 staff, 150 Oga questions a month, and automatic WhatsApp reminders.` });
      return;
    }
    setSavingProduct(true);
    try {
      let imageUrl = null;
      if (productForm.imageBlob) {
        const path = `${settings.businessId}/${Date.now()}.jpg`;
        imageUrl = await sbUploadImage(session.access_token, productForm.imageBlob, path);
      }
      let savedId = editingProductId;
      if (editingProductId) {
        const existing = products.find((p) => p.id === editingProductId);
        const rows = await sbRest(`products?id=eq.${editingProductId}`, { method: 'PATCH', accessToken: session.access_token, body: { name: productForm.name, cost_price: productForm.costPrice || 0, selling_price: productForm.sellingPrice, image_url: imageUrl || existing?.imageUrl || null, low_stock_threshold: Number(productForm.lowStockThreshold) || 5, category: productForm.category.trim(), kind: formIsService ? 'service' : 'product', price_unit: formIsService ? productForm.priceUnit : 'fixed', duration: formIsService ? productForm.duration : '', description: formIsService ? productForm.description.trim() : '', ...(formIsService ? { track_stock: false } : {}) } });
        setProducts((prev) => prev.map((p) => p.id === editingProductId ? fromSbProduct(rows[0]) : p).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const rows = await sbRest('products', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, name: productForm.name, cost_price: productForm.costPrice || 0, selling_price: productForm.sellingPrice, image_url: imageUrl, track_stock: !formIsService && productForm.stockQuantity !== '', low_stock_threshold: Number(productForm.lowStockThreshold) || 5, category: productForm.category.trim(), kind: formIsService ? 'service' : 'product', price_unit: formIsService ? productForm.priceUnit : 'fixed', duration: formIsService ? productForm.duration : '', description: formIsService ? productForm.description.trim() : '' } });
        setProducts((prev) => [fromSbProduct(rows[0]), ...prev].sort((a, b) => a.name.localeCompare(b.name)));
        const startQty = Number(productForm.stockQuantity);
        if (!formIsService && productForm.stockQuantity !== '' && startQty > 0) await changeStock(rows[0].id, targetShopId, startQty, 'initial');
        savedId = rows[0].id;
      }
      // Optional per-shop prices: blank means "use the normal price"
      if (isOwnerRole && shops.length > 1 && savedId) {
        const changes = shops.map((s) => {
          const raw = String((productForm.shopPrices || {})[s.id] ?? '').trim();
          const value = raw === '' ? null : Number(parseNumInput(raw));
          const had = shopRow(savedId, s.id)?.price_override;
          return { shop: s.id, value: Number.isFinite(value) ? value : null, changed: (had ?? null) !== (Number.isFinite(value) ? value : null) };
        }).filter((x) => x.changed);
        if (changes.length) {
          await sbRest('product_shops', { method: 'POST', accessToken: session.access_token, upsert: true, body: changes.map((x) => ({ product_id: savedId, shop_id: x.shop, price_override: x.value })) });
          setProductShops((prev) => {
            let next = [...prev];
            changes.forEach((x) => {
              const i = next.findIndex((r) => r.product_id === savedId && r.shop_id === x.shop);
              if (i >= 0) next[i] = { ...next[i], price_override: x.value };
              else next.push({ product_id: savedId, shop_id: x.shop, stock_quantity: null, price_override: x.value });
            });
            return next;
          });
        }
      }
      setProductForm({ name: '', costPrice: '', sellingPrice: '', stockQuantity: '', lowStockThreshold: '5', category: '', kind: 'product', priceUnit: 'fixed', duration: '', description: '', imageBlob: null, imagePreview: null });
      setEditingProductId(null);
      setShowProductForm(false);
    } catch (e) { alert(e.message); } finally { setSavingProduct(false); }
  };
  const removeProduct = async (id) => {
    const product = products.find((p) => p.id === id);
    if (!window.confirm(`Remove "${product?.name || 'this product'}" from your catalog? This can't be undone.`)) return;
    try { await sbRest(`products?id=eq.${id}`, { method: 'DELETE', accessToken: session.access_token }); setProducts((prev) => prev.filter((p) => p.id !== id)); }
    catch (e) { alert(e.message); }
  };

  const fulfillOrder = async (order) => {
    if (!window.confirm(T.tracksStock ? `Mark this order as fulfilled? It'll be logged as a real sale and stock will update.` : `Mark this request as done? It'll be logged as a job.`)) return;
    try {
      const newSales = [];
      for (const item of order.items) {
        const rows = await sbRest('sales', { method: 'POST', accessToken: session.access_token, body: { business_id: settings.businessId, shop_id: order.shopId || mainShopId, logged_by: session.user_id, logged_by_name: settings.activeStaff || '', item: item.quantity > 1 ? `${item.description} ×${item.quantity}` : item.description, amount: item.quantity * item.unitPrice, cost: item.quantity * (item.unitCost || 0), owed: 0, product_id: item.productId || null, quantity: item.quantity } });
        newSales.push(rows[0]);
        if (item.productId) {
          const product = products.find((p) => p.id === item.productId);
          if (product && product.stockQuantity !== null) {
            try { await changeStock(product.id, order.shopId || mainShopId, -item.quantity, 'order'); }
            catch (e) { console.error('Stock update failed:', e); }
          }
        }
      }
      setSales((prev) => [...newSales.map(fromSbSale), ...prev]);
      await sbRest(`orders?id=eq.${order.id}`, { method: 'PATCH', accessToken: session.access_token, body: { status: 'fulfilled' } });
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: 'fulfilled' } : o));
    } catch (e) { alert(e.message); }
  };
  const cancelOrder = async (id) => {
    try { await sbRest(`orders?id=eq.${id}`, { method: 'PATCH', accessToken: session.access_token, body: { status: 'cancelled' } }); setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: 'cancelled' } : o)); }
    catch (e) { alert(e.message); }
  };
  const removeOrder = async (id) => {
    if (!window.confirm("Remove this order record? This can't be undone.")) return;
    try { await sbRest(`orders?id=eq.${id}`, { method: 'DELETE', accessToken: session.access_token }); setOrders((prev) => prev.filter((o) => o.id !== id)); }
    catch (e) { alert(e.message); }
  };

  // New stock at a new cost → average it with the stock already on hand, so profit stays accurate on old and new units
  const totalStockOf = (productId) => (productsAll.find((p) => p.id === productId)?.trackStock ? locations.reduce((a, s) => a + stockAt({ id: productId }, s.id), 0) : 0);
  const newAverageCost = (productId, addQty, unitCost) => {
    const base = productsAll.find((p) => p.id === productId);
    const oldCost = Number(base?.costPrice) || 0;
    const onHand = totalStockOf(productId);
    if (!(unitCost > 0) || !(addQty > 0)) return oldCost;
    if (onHand <= 0 || oldCost <= 0) return Math.round(unitCost);
    return Math.round((onHand * oldCost + addQty * unitCost) / (onHand + addQty));
  };
  const costExplainer = (productId, qty, unitCost, next) => {
    const base = productsAll.find((p) => p.id === productId);
    const onHand = totalStockOf(productId);
    const old = Number(base?.costPrice) || 0;
    const tail = `From now on Xorla counts ${fmt(next)} each when working out your profit. Your selling price stays ${fmt(base?.sellingPrice || 0)}.`;
    return onHand > 0 && old > 0 ? `You have ${onHand} at ${fmt(old)} + ${qty} new at ${fmt(unitCost)}. ${tail}` : tail;
  };
  const saveCostPrice = async (productId, cost) => {
    await sbRest(`products?id=eq.${productId}`, { method: 'PATCH', accessToken: session.access_token, body: { cost_price: cost } });
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, costPrice: cost } : p)));
  };

  const handleRestock = async (product) => {
    const added = Number(restockAmount);
    if (!added || added < 0) return;
    const shopId = activeShopId || (locations.some((s) => s.id === restockShopId) ? restockShopId : mainShopId);
    const unitCost = Number(parseNumInput(restockCost));
    const nextCost = restockCost !== '' && unitCost > 0 ? newAverageCost(product.id, added, unitCost) : null;
    try {
      if (!product.trackStock) {
        await sbRest(`products?id=eq.${product.id}`, { method: 'PATCH', accessToken: session.access_token, body: { track_stock: true } });
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, trackStock: true } : p)));
      }
      await changeStock(product.id, shopId, added, product.trackStock ? 'restock' : 'initial');
      if (nextCost !== null && nextCost !== Number(product.costPrice)) await saveCostPrice(product.id, nextCost);
      setRestockingId(null);
      setRestockAmount('');
      setRestockCost('');
    } catch (e) { alert(e.message); }
  };

  // Fix a stock mistake: set the real count; the difference is recorded as a correction
  const handleCorrectCount = async (p) => {
    const actual = Number(correctQty);
    if (correctQty === '' || !Number.isFinite(actual) || actual < 0) return;
    const shopId = activeShopId || (locations.some((s) => s.id === correctShopId) ? correctShopId : mainShopId);
    const current = stockAt(p, shopId);
    const delta = actual - current;
    if (delta === 0) { setCorrectingId(null); return; }
    if (!window.confirm(`Change ${p.name} at ${shopNameOf(shopId)} from ${current} to ${actual}? This is saved as a correction in your stock history.`)) return;
    try { await changeStock(p.id, shopId, delta, 'correction'); setCorrectingId(null); setCorrectQty(''); }
    catch (e) { alert(e.message); }
  };

  // Move stock between shops (owner)
  const handleTransfer = async (product) => {
    const qty = Number(transferForm.qty);
    if (!qty || qty <= 0 || !transferForm.from || !transferForm.to) return;
    try {
      await sbRpc('transfer_stock', session.access_token, { p_product_id: product.id, p_from_shop: transferForm.from, p_to_shop: transferForm.to, p_qty: qty });
      setLocalStock(product.id, transferForm.from, stockAt(product, transferForm.from) - qty);
      setLocalStock(product.id, transferForm.to, stockAt(product, transferForm.to) + qty);
      setTransferringId(null);
      setTransferForm({ from: '', to: '', qty: '' });
    } catch (e) { alert(e.message); }
  };

  // Picking a product (or changing quantity) auto-fills the sale's item/amount/cost — still editable afterward for discounts
  const applyProductToSale = (productId, qtyRaw) => {
    if (!productId) { setSaleForm((f) => ({ ...f, productId: '', quantity: qtyRaw })); return; }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const qty = Math.max(1, Number(qtyRaw) || 1); // used only for computing totals — the field itself keeps whatever the user typed, including empty
    setSaleForm((f) => ({
      ...f,
      productId,
      quantity: qtyRaw,
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
    const inv = invoices.find((i) => i.id === id);
    if (!window.confirm(`Remove the invoice for "${inv?.clientName || 'this client'}"? This can't be undone.`)) return;
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
    catch (e) { showAiNotice(`${e.message} Your standard reminder is still ready to send.`); } finally { setAiLoadingId(null); }
  };
  const generateThankYou = async (inv) => {
    setThankYouLoadingId(inv.id);
    try { const msg = await aiThankYou(inv, settings); setThankYouTexts((prev) => ({ ...prev, [inv.id]: msg })); }
    catch (e) { showAiNotice(`${e.message} Your standard thank-you note is still ready to send.`); } finally { setThankYouLoadingId(null); }
  };
  const updateSettings = (patch) => {
    if ('myName' in patch) {
      const nm = String(patch.myName || '').trim();
      if (nm && nm !== settings.myName && session) {
        patch = { ...patch, myName: nm, activeStaff: nm };
        sbRpc('set_my_name', session.access_token, { p_name: nm }).then(() => loadBusinessData(session.access_token)).catch((e) => alert(e.message));
      } else { patch = { ...patch }; delete patch.myName; }
    }
    const next = { ...settings, ...patch };
    setSettings(next);
    if ('pin' in patch) setStoredPin(session?.user_id, patch.pin);
    if (session && next.businessId && settings.role === 'owner') {
      const bizPatch = {};
      if ('paymentLink' in patch) bizPatch.payment_link = patch.paymentLink;
      if ('tone' in patch) bizPatch.reminder_tone = patch.tone;
      if ('customInstructions' in patch) bizPatch.custom_instructions = patch.customInstructions;
      if ('language' in patch) bizPatch.language = patch.language;
      if ('businessName' in patch && patch.businessName.trim()) bizPatch.name = patch.businessName.trim();
      if ('businessType' in patch) bizPatch.business_type = patch.businessType;
      if ('ownerPhone' in patch) bizPatch.owner_phone = patch.ownerPhone;
      if ('businessAddress' in patch) bizPatch.address = patch.businessAddress;
      if ('businessEmail' in patch) bizPatch.email = patch.businessEmail;
      if ('storefrontEnabled' in patch) bizPatch.storefront_enabled = patch.storefrontEnabled;
      if ('storefrontTagline' in patch) bizPatch.storefront_tagline = patch.storefrontTagline;
      if ('allowStaffExpenses' in patch) bizPatch.allow_staff_expenses = patch.allowStaffExpenses;
      if ('autoReminders' in patch) bizPatch.auto_reminders_enabled = patch.autoReminders;
      if ('summaryFrequency' in patch) bizPatch.summary_frequency = patch.summaryFrequency;
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

  const pendingOrderCount = orders.filter((o) => o.status === 'pending').length;
  const unpaidInvoiceCount = invoices.filter((i) => computeStatus(i) !== 'paid').length;
  const currentStaffNames = settings.staffList.map((s) => s.name);
  const sellerOptions = [...new Set([...currentStaffNames, ...sales.map((s) => s.loggedBy), ...expenses.map((e) => e.loggedBy)].filter(Boolean))]
    .sort((a, b) => (a === settings.myName ? -1 : b === settings.myName ? 1 : a.localeCompare(b)));
  const viewedSales = sales.filter((s) => s.dateKey === viewDate);
  const viewedSalesTotal = viewedSales.reduce((a, s) => a + Number(s.amount), 0);
  const viewedCOGS = viewedSales.reduce((a, s) => a + Number(s.cost || 0), 0);
  const viewedExpensesList = expenses.filter((e) => e.dateKey === viewDate);
  const viewedExpensesTotal = viewedExpensesList.reduce((a, e) => a + Number(e.amount), 0);
  const viewedProfit = viewedSalesTotal - viewedCOGS - viewedExpensesTotal;
  // Staff filter narrows what's actually LISTED — the Profit card above stays whole-business, since expenses aren't fairly attributable to one rep
  const filteredSales = viewedSales.filter((s) => !staffFilter || s.loggedBy === staffFilter);
  const filteredSalesTotal = filteredSales.reduce((a, s) => a + Number(s.amount), 0);
  const filteredExpensesList = viewedExpensesList.filter((e) => !staffFilter || e.loggedBy === staffFilter);
  const filteredExpensesTotal = filteredExpensesList.reduce((a, e) => a + Number(e.amount), 0);
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
    .filter((inv) => invoiceView === 'paid' ? computeStatus(inv) === 'paid' : computeStatus(inv) !== 'paid')
    .sort((a, b) => {
      const order = { critical: 0, overdue: 1, dueToday: 2, soon: 3, upcoming: 4, paid: 5 };
      return order[computeStatus(a)] - order[computeStatus(b)];
    });
  const paidInvoiceCount = invoices.filter((inv) => computeStatus(inv) === 'paid').length;

  const recentActivity = [...todaySales.map((s) => ({ ...s, kind: 'sale' })), ...todayExpensesList.map((e) => ({ ...e, kind: 'expense' }))]
    .sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5);
  const needsAttention = sortedInvoices.filter((i) => ['critical', 'overdue', 'dueToday'].includes(computeStatus(i))).slice(0, 4);

  const generateSummary = async () => {
    setSummaryLoading(true);
    try { const text = await aiDailySummary({ todayRevenue, saleCount: todaySales.length, todayExpenses, net: trueProfitToday, outstanding: totals.outstanding, overdue: totals.overdue }, settings); setSummaryText(text); }
    catch (e) { showAiNotice(e.message); } finally { setSummaryLoading(false); }
  };

  // ---------- Product performance (best sellers, fast and slow movers) ----------
  const nameKey = (s) => String(s || '').replace(/\s*×\s*\d+\s*$/, '').trim().toLowerCase();
  const productByName = new Map(productsAll.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const qtyFromName = (s) => { const m = String(s || '').match(/×\s*(\d+)\s*$/); return m ? Number(m[1]) : 1; };
  const productPerformance = (days) => {
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const stats = new Map();
    sales.forEach((s) => {
      if (s.dateKey < since) return;
      const pid = s.productId || productByName.get(nameKey(s.item));
      if (!pid) return;
      const units = s.productId ? s.quantity : qtyFromName(s.item);
      const st = stats.get(pid) || { units: 0, revenue: 0, profit: 0, sales: 0 };
      st.units += units; st.revenue += Number(s.amount) || 0; st.profit += (Number(s.amount) || 0) - (Number(s.cost) || 0); st.sales += 1;
      stats.set(pid, st);
    });
    return products.map((p) => {
      const st = stats.get(p.id) || { units: 0, revenue: 0, profit: 0, sales: 0 };
      const perDay = st.units / days;
      const daysLeft = p.stockQuantity !== null && perDay > 0 ? p.stockQuantity / perDay : null;
      return { ...p, ...st, perDay, daysLeft };
    });
  };
  const perfText = (rows) => {
    const sold = rows.filter((r) => r.units > 0).sort((a, b) => b.revenue - a.revenue);
    const slow = rows.filter((r) => r.units === 0 && (r.stockQuantity === null || r.stockQuantity > 0));
    const lines = sold.slice(0, 12).map((r) => `- ${r.name}: ${r.units} sold, ${fmt(r.revenue)} revenue, ${fmt(r.profit)} profit${r.stockQuantity !== null ? `, ${r.stockQuantity} in stock${r.daysLeft !== null ? ` (~${Math.round(r.daysLeft)} days left at current pace)` : ''}` : ''}`);
    if (slow.length) lines.push(`- Not sold at all in this period: ${slow.slice(0, 10).map((r) => `${r.name}${r.stockQuantity ? ` (${r.stockQuantity} in stock)` : ''}`).join(', ')}`);
    return lines.length ? lines.join('\n') : '- No product sales recorded in this period yet.';
  };

  const runAdvisor = async (q) => {
    if (!q || !q.trim()) return;
    setAdvisorQuestion(q);
    setAdvisorLoading(true);
    setAdvisorAnswer('');
    try {
      const ctx = { trueProfitToday, todayRevenue, saleCount: todaySales.length, todayExpenses, weekTotal, outstanding: totals.outstanding, overdue: totals.overdue, needsAttentionCount: needsAttention.length , productSummary: perfText(productPerformance(30)), shopView: viewAllShops ? 'all shops combined' : shopNameOf(activeShopId) };
      const text = await aiAdvice(q, ctx, settings);
      setAdvisorAnswer(text);
    } catch (e) {
      console.error(e);
      setAdvisorAnswer(e.message);
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

  // ---------- Plan: what this business is on right now ----------
  const planKnown = !!subscription;
  const nowMs = Date.now();
  const effPlan = !subscription ? 'pro'
    : subscription.status === 'trial' && new Date(subscription.trial_ends_at).getTime() > nowMs ? 'pro'
    : subscription.status === 'active' && new Date(subscription.current_period_end).getTime() > nowMs ? subscription.plan
    : 'free';
  const onTrial = planKnown && subscription.status === 'trial' && new Date(subscription.trial_ends_at).getTime() > nowMs;
  const planEnd = !planKnown ? null : new Date(onTrial ? subscription.trial_ends_at : subscription.current_period_end || 0);
  const planDaysLeft = planEnd ? Math.max(0, Math.ceil((planEnd.getTime() - nowMs) / 86400000)) : null;
  const planCaps = { ...PLAN_INFO[effPlan], locations: PLAN_INFO[effPlan].locations + (effPlan === 'business' ? Number(subscription?.extra_shops || 0) : 0) };
  const earlyActive = planKnown && subscription.early_supporter && new Date(subscription.early_supporter_until).getTime() > nowMs;
  const earlyEligible = earlyActive || (planKnown && !subscription.early_supporter && (earlySpots === null || earlySpots > 0));
  // What the plan allows right now: multi-location tools, which locations are active, how many staff are over
  const multiLocationOn = !planKnown || effPlan === 'business';
  const pausedLocationIds = planKnown ? liveLocations.slice(planCaps.locations).map((l) => l.id) : [];
  const isPausedLocation = (id) => !!id && pausedLocationIds.includes(id);
  const staffOverBy = planKnown ? Math.max(0, settings.staffList.length - planCaps.staff) : 0;
  useEffect(() => {
    if (settings.role !== 'staff' || !session?.access_token || !planKnown) return;
    sbRpc('staff_seat_ok', session.access_token, { p_profile: session.user_id }).then((ok) => setSeatOk(ok === false ? false : true)).catch(() => setSeatOk(true));
  }, [settings.role, session?.access_token, planKnown, effPlan]);
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Open Settings → Your plan (from a notification, an upgrade prompt, or after paying)
  useEffect(() => {
    if (!settings.loggedIn || settings.role !== 'owner' || (!pendingPlanOpen && billingReturnRef === null)) return;
    setDraft({ ...settings }); setSettingsPage('plan'); setPreviousTab('overview'); setTab('settings');
    setPendingPlanOpen(false);
    if (billingReturnRef !== null) {
      const ref = billingReturnRef; setBillingReturnRef(null);
      if (!ref) return;
      setBillingBusy('verify'); setBillingNote(null);
      callBilling('verify', { reference: ref })
        .then((r) => {
          if (r.ok) setBillingNote({ ok: true, text: `Payment received — thank you! You're on ${PLAN_INFO[r.plan]?.name || 'your new plan'}${r.until ? ` until ${fmtDate(r.until)}` : ''}.` });
          else setBillingNote({ ok: false, text: r.status === 'abandoned' ? 'The payment was not completed. Nothing was charged.' : 'We could not confirm the payment yet. If money left your account, it will show here within a few minutes.' });
          return loadBusinessData(session.access_token);
        })
        .catch((e) => setBillingNote({ ok: false, text: e.message }))
        .finally(() => setBillingBusy(null));
    }
  }, [settings.loggedIn, settings.role, pendingPlanOpen, billingReturnRef]);
  // Fresh usage and early-supporter places whenever the plan page opens
  useEffect(() => {
    if (settingsPage !== 'plan' || !session) return;
    setPlanExtra(Math.max(0, liveLocations.length - 3, effPlan === 'business' ? Number(subscription?.extra_shops || 0) : 0));
    sbRpc('my_usage', session.access_token, {}).then(setUsage).catch(() => {});
    if (!document.getElementById('xorla-jakarta')) {
      const link = document.createElement('link');
      link.id = 'xorla-jakarta'; link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
    sbRpc('early_supporter_spots', session.access_token, {}).then((n) => setEarlySpots(typeof n === 'number' ? n : null)).catch(() => {});
  }, [settingsPage]);

  if (resetToken) {
    return <>{fontStyle}<ResetPasswordScreen accessToken={resetToken} onDone={() => { window.location.hash = ''; setResetToken(null); }} /></>;
  }
  if (!loaded || authLoading) return <div className="min-h-screen flex items-center justify-center cx-body" style={{ background: C.bg, color: C.inkDim }}>{fontStyle}<div className="text-sm">Loading…</div></div>;
  if (!session) {
    return <>{fontStyle}<AuthScreen onDone={() => bootstrap({ fresh: true })} /></>;
  }
  if (locked && settings.pin) return <>{fontStyle}<LockScreen pin={settings.pin} businessName={settings.businessName} onUnlock={() => setLocked(false)} onForgot={() => { setStoredPin(session?.user_id, ''); setLocked(false); logout(); }} /></>;

  const field = { background: C.bg, border: `1px solid ${C.line}`, color: C.ink };
  const card = { background: 'rgba(19,50,44,0.55)', backdropFilter: 'blur(16px)', border: `1px solid ${C.lineStrong}`, boxShadow: '0 1px 1px rgba(0,0,0,0.2), 0 16px 40px -20px rgba(0,0,0,0.7)' };

  // One pill, top of every screen, only once there's a second shop
  // Team presence: who has Xorla open right now, and who's been active today. Tapping someone opens their sales.
  const presenceOf = (name) => {
    const p = staffPresence.find((x) => x.name === name);
    const seen = p?.last_seen_at ? new Date(p.last_seen_at) : null;
    const online = !!seen && Date.now() - seen.getTime() < 150 * 1000;
    const salesToday = salesAll.filter((s) => s.loggedBy === name && s.dateKey === todayKey()).length;
    let label = online ? 'Online' : 'Not seen yet';
    if (!online && seen) {
      const mins = Math.round((Date.now() - seen.getTime()) / 60000);
      label = mins < 60 ? `Seen ${mins}m ago` : mins < 1440 ? `Seen ${Math.round(mins / 60)}h ago` : `Seen ${seen.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    }
    return { online, label, salesToday };
  };
  const renderTeamPresence = (compact) => (
    <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {!compact && <span className="text-[11px] font-medium shrink-0 mr-0.5" style={{ color: C.inkFaint }}>Team</span>}
      {settings.staffList.map((s) => {
        const pr = presenceOf(s.name);
        return (
          <button key={s.id} onClick={() => { setStaffFilter(s.name); setTab('sales'); }} title={`${pr.label}${pr.salesToday ? ` · ${pr.salesToday} ${T.sale}${pr.salesToday !== 1 ? 's' : ''} today` : ''}`} className="shrink-0 flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full text-left" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
            <span className="relative flex w-2 h-2 shrink-0">
              {pr.online && <span className="absolute inline-flex w-full h-full rounded-full animate-ping" style={{ background: C.sage, opacity: 0.6 }} />}
              <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: pr.online ? C.sage : C.inkFaint }} />
            </span>
            <span className="leading-tight">
              <span className="block text-[12px] font-semibold" style={{ color: C.ink }}>{s.name}</span>
              {!compact && <span className="block text-[10px]" style={{ color: pr.online ? C.sage : C.inkFaint }}>{pr.label}{pr.salesToday ? ` · ${pr.salesToday} today` : ''}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );


  // ---------- Stock system: deliveries, transfers, requests ----------
  const stockProducts = productsAll.filter((p) => kindOf(p, settings.businessType) === 'product');
  const productName = (id) => (productsAll.find((p) => p.id === id) || {}).name || 'Item';
  const inTransit = stockTransfers.filter((t) => t.status === 'in_transit');
  const pendingRequests = stockRequests.filter((r) => r.status === 'pending');
  const runStock = async (fn, after) => {
    setStockBusy(true); setStockError('');
    try { await fn(); await loadBusinessData(session.access_token); after && after(); }
    catch (e) { setStockError(e.message); }
    finally { setStockBusy(false); }
  };
  const openSend = (prefill = {}) => {
    setSendForm({ from: prefill.from || (warehouses[0]?.id || ''), to: prefill.to || '', lines: prefill.lines?.length ? prefill.lines : [{ productId: prefill.productId || '', qty: '' }], receivedNow: false, requestId: prefill.requestId || null, note: '' });
    setStockError(''); setStockPanel('transfer');
  };
  const submitDelivery = () => {
    const items = [];
    deliveryForm.lines.forEach((l) => { if (!l.productId) return; Object.entries(l.split || {}).forEach(([shopId, q]) => { const qty = Number(q); if (qty > 0) items.push({ productId: l.productId, shopId, qty }); }); });
    if (!items.length) { setStockError('Add at least one item with a quantity.'); return; }
    const costUpdates = deliveryForm.lines.map((l) => {
      const qty = Object.values(l.split || {}).reduce((a, q) => a + (Number(q) || 0), 0);
      const uc = Number(parseNumInput(l.cost || ''));
      if (!l.productId || !(qty > 0) || !(uc > 0)) return null;
      const next = newAverageCost(l.productId, qty, uc);
      const base = productsAll.find((p) => p.id === l.productId);
      return next !== Number(base?.costPrice) ? { productId: l.productId, cost: next } : null;
    }).filter(Boolean);
    runStock(async () => {
      await sbRpc('receive_delivery', session.access_token, { p_items: items, p_arrived: deliveryForm.arrived, p_note: deliveryForm.note });
      for (const u of costUpdates) await saveCostPrice(u.productId, u.cost);
    },
      () => { setStockPanel(null); setDeliveryForm({ lines: [{ productId: '', split: {} }], arrived: true, note: '' }); });
  };
  const submitSend = () => {
    const items = sendForm.lines.filter((l) => l.productId && Number(l.qty) > 0).map((l) => ({ productId: l.productId, qty: Number(l.qty) }));
    if (!sendForm.from || !sendForm.to) { setStockError('Choose where the stock is going from and to.'); return; }
    if (!items.length) { setStockError('Add at least one item with a quantity.'); return; }
    runStock(() => sbRpc('send_transfer', session.access_token, { p_from: sendForm.from, p_to: sendForm.to, p_items: items, p_received_now: sendForm.receivedNow, p_request_id: sendForm.requestId, p_note: sendForm.note }),
      () => setStockPanel(null));
  };
  const submitRequest = () => {
    const items = requestForm.lines.filter((l) => l.productId && Number(l.qty) > 0).map((l) => ({ productId: l.productId, qty: Number(l.qty) }));
    if (!items.length) { setStockError('Add at least one item with a quantity.'); return; }
    runStock(() => sbRpc('request_stock', session.access_token, { p_shop_id: activeShopId || targetShopId, p_items: items, p_note: requestForm.note }),
      () => { setStockPanel(null); setRequestForm({ lines: [{ productId: '', qty: '' }], note: '' }); });
  };
  const confirmReceived = (t) => {
    const raw = receiveQty[t.id];
    const qty = raw === undefined || raw === '' ? Number(t.qty_sent) : Number(raw);
    runStock(() => sbRpc('receive_transfer', session.access_token, { p_transfer_id: t.id, p_qty: qty }));
  };
  const declineRequest = (r) => {
    const reason = window.prompt('Why are you declining? The staff member will see this.', '');
    if (reason === null) return;
    runStock(() => sbRpc('decline_stock_request', session.access_token, { p_request_id: r.id, p_reason: reason }));
  };


  const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const groupBatches = (rows) => {
    const map = new Map();
    rows.forEach((t) => { const k = `${t.batch_id}|${t.to_shop}`; if (!map.has(k)) map.set(k, []); map.get(k).push(t); });
    return [...map.values()];
  };
  const productSelect = (value, onChange, placeholder = 'Choose an item…') => (
    <BrandSelect value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[13px] outline-none" style={{ ...field, colorScheme: 'dark' }}>
      <option value="">{placeholder}</option>
      {stockProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </BrandSelect>
  );

  // Incoming items with a "what arrived" box (owner sees all; staff see their shops)
  const renderIncoming = (rows) => groupBatches(rows).map((batch) => {
    const first = batch[0];
    return (
      <div key={`${first.batch_id}|${first.to_shop}`} className="rounded-xl p-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold mb-0.5">
          {first.kind === 'delivery' ? <Truck size={14} style={{ color: C.copper }} /> : <ArrowRight size={14} style={{ color: C.copper }} />}
          <span>{first.kind === 'delivery' ? 'Supplier delivery' : shopNameOf(first.from_shop)} → <span style={{ color: C.copper }}>{shopNameOf(first.to_shop)}</span></span>
        </div>
        <div className="text-[11px] mb-2.5" style={{ color: C.inkFaint }}>Sent {fmtDay(first.created_at)}{first.sent_by_name ? ` by ${first.sent_by_name}` : ''}{first.note ? ` · ${first.note}` : ''}</div>
        <div className="space-y-2">
          {batch.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-[13px]">{productName(t.product_id)} <span style={{ color: C.inkFaint }}>· {Number(t.qty_sent)} sent</span></span>
              <input type="number" min="0" aria-label={`How many ${productName(t.product_id)} arrived`} placeholder={String(Number(t.qty_sent))} value={receiveQty[t.id] ?? ''} onChange={(e) => setReceiveQty({ ...receiveQty, [t.id]: e.target.value })} className="w-16 rounded-lg px-2 py-1.5 text-[13px] text-center outline-none cx-mono" style={field} />
              <button onClick={() => confirmReceived(t)} disabled={stockBusy} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: C.sage, color: C.bg, opacity: stockBusy ? 0.6 : 1 }}>Received</button>
            </div>
          ))}
        </div>
        <div className="text-[10.5px] mt-2" style={{ color: C.inkFaint }}>Leave the box empty if everything arrived. If some are missing, type how many actually came.</div>
      </div>
    );
  });

  const renderStockCenter = () => {
    if (!isOwnerRole || !hasManyLocations) return null;
    if (!multiLocationOn) return (
      <div className="rounded-2xl p-4 mb-6 flex items-start gap-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.copperSoft }}><Truck size={18} style={{ color: C.copper }} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold">Deliveries, transfers and stock requests are part of Business</div>
          <div className="text-[12px] leading-relaxed mt-0.5 mb-3" style={{ color: C.inkDim }}>Your locations and everything recorded in them are all still here.</div>
          <button onClick={openPlanPage} className="px-4 py-2 rounded-xl text-[12.5px] font-semibold" style={{ background: C.copper, color: C.bg }}>See plans</button>
        </div>
      </div>
    );
    const shortages = stockTransfers.filter((t) => t.status === 'received' && t.qty_received !== null && Number(t.qty_received) < Number(t.qty_sent) && Date.now() - new Date(t.received_at).getTime() < 30 * 86400000).slice(0, 5);
    return (
      <div className="rounded-2xl p-4 mb-6 space-y-4" style={card}>
        <div>
          <div className="text-[14px] font-semibold cx-display mb-0.5">Stock across your locations</div>
          <div className="text-[11.5px]" style={{ color: C.inkFaint }}>Record supplier deliveries, and send stock between locations.</div>
        </div>
        {stockError && !stockPanel && <div className="rounded-xl px-3.5 py-2.5 text-[12.5px]" style={{ background: C.rustSoft, color: C.rust }}>{stockError}</div>}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { setStockError(''); setDeliveryForm({ lines: [{ productId: '', split: {} }], arrived: true, note: '' }); setStockPanel('delivery'); }} className="flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold" style={{ background: C.copper, color: C.bg }}><Truck size={16} /> Receive delivery</button>
          <button onClick={() => openSend()} className="flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.ink }}><ArrowRight size={16} /> Send stock</button>
        </div>

        {pendingRequests.length > 0 && (
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.copper }}>Requests from your shops ({pendingRequests.length})</div>
            <div className="space-y-2">
              {pendingRequests.map((r) => (
                <div key={r.id} className="rounded-xl p-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                  <div className="text-[12.5px] font-semibold">{shopNameOf(r.shop_id)} <span className="font-normal" style={{ color: C.inkFaint }}>· {r.requested_by_name || 'Staff'} · {fmtDay(r.created_at)}</span></div>
                  <div className="text-[12.5px] mt-1" style={{ color: C.inkDim }}>{(r.items || []).map((it) => `${productName(it.productId)} ×${it.qty}`).join(', ')}</div>
                  {r.note && <div className="text-[11.5px] mt-1 italic" style={{ color: C.inkFaint }}>"{r.note}"</div>}
                  <div className="flex gap-2 mt-2.5">
                    <button onClick={() => openSend({ to: r.shop_id, requestId: r.id, lines: (r.items || []).map((it) => ({ productId: it.productId, qty: String(it.qty) })) })} className="flex-1 rounded-lg py-2 text-[12.5px] font-semibold" style={{ background: C.sage, color: C.bg }}>Approve & send</button>
                    <button onClick={() => declineRequest(r)} className="px-4 rounded-lg py-2 text-[12.5px] font-medium" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {inTransit.length > 0 && (
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkFaint }}>On the way</div>
            <div className="space-y-2">{renderIncoming(inTransit)}</div>
          </div>
        )}

        {shortages.length > 0 && (
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.rust }}>Shortages (last 30 days)</div>
            <div className="space-y-1.5">
              {shortages.map((t) => (
                <div key={t.id} className="text-[12.5px] rounded-lg px-3 py-2" style={{ background: C.rustSoft, color: C.ink }}>
                  <strong style={{ color: C.rust }}>{Number(t.qty_sent) - Number(t.qty_received)} missing</strong> · {productName(t.product_id)} · {t.kind === 'delivery' ? 'Supplier' : shopNameOf(t.from_shop)} → {shopNameOf(t.to_shop)} · received {fmtDay(t.received_at)}{t.received_by_name ? ` by ${t.received_by_name}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // The forms, as a panel over the screen
  const renderStockPanel = () => {
    if (!stockPanel) return null;
    const lineRow = (lines, setLines, i, withAvail) => {
      const l = lines[i];
      const avail = withAvail && sendForm.from && l.productId ? stockAt({ id: l.productId }, sendForm.from) : null;
      return (
        <div key={i} className="space-y-1">
          <div className="flex gap-2 items-center">
            {productSelect(l.productId, (v) => setLines(lines.map((x, j) => (j === i ? { ...x, productId: v } : x))))}
            <input type="number" min="1" placeholder="Qty" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className="w-20 rounded-lg px-2 py-2 text-[13px] text-center outline-none cx-mono" style={field} />
            {lines.length > 1 && <button onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove item" style={{ color: C.inkFaint }}><X size={15} /></button>}
          </div>
          {avail !== null && <div className="text-[11px] pl-1" style={{ color: Number(l.qty) > avail ? C.rust : C.inkFaint }}>{avail} available at {shopNameOf(sendForm.from)}</div>}
        </div>
      );
    };
    const title = stockPanel === 'delivery' ? 'Receive a supplier delivery' : stockPanel === 'transfer' ? (sendForm.requestId ? `Send stock to ${shopNameOf(sendForm.to)}` : 'Send stock') : `Request stock for ${shopNameOf(activeShopId || targetShopId)}`;
    return (
      <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center sm:p-5" style={{ background: 'rgba(3,10,9,0.8)' }} onClick={() => !stockBusy && setStockPanel(null)}>
        <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 xorla-fade-up max-h-[92vh] overflow-y-auto" style={{ background: C.surface, border: `1px solid ${C.line}` }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[16px] font-semibold cx-display">{title}</div>
            <button onClick={() => setStockPanel(null)} aria-label="Close" style={{ color: C.inkFaint }}><X size={18} /></button>
          </div>

          {stockPanel === 'delivery' && (
            <div className="space-y-4">
              <div className="text-[12px]" style={{ color: C.inkDim }}>Record what the supplier brought and how it's shared between your locations.</div>
              {deliveryForm.lines.map((l, i) => (
                <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                  <div className="flex gap-2 items-center">
                    {productSelect(l.productId, (v) => setDeliveryForm({ ...deliveryForm, lines: deliveryForm.lines.map((x, j) => (j === i ? { ...x, productId: v } : x)) }))}
                    {deliveryForm.lines.length > 1 && <button onClick={() => setDeliveryForm({ ...deliveryForm, lines: deliveryForm.lines.filter((_, j) => j !== i) })} aria-label="Remove item" style={{ color: C.inkFaint }}><X size={15} /></button>}
                  </div>
                  {locations.map((loc) => (
                    <div key={loc.id} className="flex items-center gap-2 pl-1">
                      <span className="flex-1 min-w-0 truncate text-[12.5px]" style={{ color: C.inkDim }}>{loc.name}{loc.kind === 'warehouse' ? ' (warehouse)' : ''}</span>
                      <input type="number" min="0" placeholder="0" value={(l.split || {})[loc.id] || ''} onChange={(e) => setDeliveryForm({ ...deliveryForm, lines: deliveryForm.lines.map((x, j) => (j === i ? { ...x, split: { ...(x.split || {}), [loc.id]: e.target.value } } : x)) })} className="w-20 rounded-lg px-2 py-1.5 text-[13px] text-center outline-none cx-mono" style={field} />
                    </div>
                  ))}
                  {l.productId && (() => {
                    const total = Object.values(l.split || {}).reduce((a, q) => a + (Number(q) || 0), 0);
                    const base = productsAll.find((p) => p.id === l.productId);
                    const uc = Number(parseNumInput(l.cost || ''));
                    const avg = uc > 0 && total > 0 ? newAverageCost(l.productId, total, uc) : null;
                    return (
                      <div className="pl-1 space-y-1.5 pt-1">
                        <div className="text-[11px] font-medium" style={{ color: C.sage }}>Total: {total}</div>
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-[12px]" style={{ color: C.inkDim }}>Cost per unit this time <span style={{ color: C.inkFaint }}>(optional)</span></span>
                          <input type="text" inputMode="decimal" placeholder={fmt(base?.costPrice || 0)} value={formatNumInput(l.cost || '')} onChange={(e) => setDeliveryForm({ ...deliveryForm, lines: deliveryForm.lines.map((x, j) => (j === i ? { ...x, cost: parseNumInput(e.target.value) } : x)) })} className="w-28 rounded-lg px-2 py-1.5 text-[13px] text-right outline-none cx-mono" style={field} />
                        </div>
                        {avg !== null && avg !== Number(base?.costPrice) && <div className="text-[11px] leading-relaxed" style={{ color: C.sage }}>{costExplainer(l.productId, total, uc, avg)}</div>}
                      </div>
                    );
                  })()}
                </div>
              ))}
              <button onClick={() => setDeliveryForm({ ...deliveryForm, lines: [...deliveryForm.lines, { productId: '', split: {} }] })} className="text-[12px] font-medium" style={{ color: C.sage }}>+ Add another item</button>
              <div className="space-y-2">
                {[[true, 'Arrived already', 'Add it to each location\'s stock now.'], [false, 'On its way', 'Each location confirms what arrives.']].map(([v, l, d]) => (
                  <button key={l} onClick={() => setDeliveryForm({ ...deliveryForm, arrived: v })} className="w-full text-left rounded-xl px-3.5 py-2.5 flex items-start gap-3" style={{ background: deliveryForm.arrived === v ? C.copperSoft : C.surfaceRaised, border: `1.5px solid ${deliveryForm.arrived === v ? C.copper : C.line}` }}>
                    <span className="mt-1 w-4 h-4 rounded-full shrink-0 flex items-center justify-center" style={{ border: `2px solid ${deliveryForm.arrived === v ? C.copper : C.inkFaint}` }}>{deliveryForm.arrived === v && <span className="w-2 h-2 rounded-full" style={{ background: C.copper }} />}</span>
                    <span><span className="block text-[13px] font-semibold">{l}</span><span className="block text-[11.5px]" style={{ color: C.inkFaint }}>{d}</span></span>
                  </button>
                ))}
              </div>
              <input type="text" placeholder="Note (optional) — e.g. supplier name" value={deliveryForm.note} onChange={(e) => setDeliveryForm({ ...deliveryForm, note: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
              <div className="text-[11px] leading-relaxed" style={{ color: C.inkFaint }}>This updates stock only. It isn't added to expenses: each product's cost price is already counted when it sells.</div>
            </div>
          )}

          {stockPanel === 'transfer' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BrandSelect value={sendForm.from} onChange={(e) => setSendForm({ ...sendForm, from: e.target.value })} className="flex-1 min-w-0 rounded-lg px-3 py-2.5 text-[13px] outline-none" style={{ ...field, colorScheme: 'dark' }}>
                  <option value="">From…</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </BrandSelect>
                <ArrowRight size={16} style={{ color: C.inkFaint }} className="shrink-0" />
                <BrandSelect value={sendForm.to} onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })} disabled={!!sendForm.requestId} className="flex-1 min-w-0 rounded-lg px-3 py-2.5 text-[13px] outline-none" style={{ ...field, colorScheme: 'dark' }}>
                  <option value="">To…</option>
                  {locations.filter((l) => l.id !== sendForm.from).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </BrandSelect>
              </div>
              <div className="space-y-2.5">{sendForm.lines.map((_, i) => lineRow(sendForm.lines, (lines) => setSendForm({ ...sendForm, lines }), i, true))}</div>
              <button onClick={() => setSendForm({ ...sendForm, lines: [...sendForm.lines, { productId: '', qty: '' }] })} className="text-[12px] font-medium" style={{ color: C.sage }}>+ Add another item</button>
              <button onClick={() => setSendForm({ ...sendForm, receivedNow: !sendForm.receivedNow })} role="checkbox" aria-checked={sendForm.receivedNow} className="w-full text-left flex items-start gap-3 rounded-xl px-3.5 py-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                <span className="mt-0.5 w-5 h-5 rounded-md shrink-0 flex items-center justify-center" style={{ background: sendForm.receivedNow ? C.sage : 'transparent', border: `2px solid ${sendForm.receivedNow ? C.sage : C.inkFaint}` }}>{sendForm.receivedNow && <Check size={13} style={{ color: C.bg }} />}</span>
                <span><span className="block text-[13px] font-semibold">Already delivered — mark as received now</span><span className="block text-[11.5px]" style={{ color: C.inkFaint }}>For nearby locations, or when you carried it yourself. Otherwise it shows as "on the way" until the receiving location confirms.</span></span>
              </button>
              <input type="text" placeholder="Note (optional) — e.g. driver or waybill" value={sendForm.note} onChange={(e) => setSendForm({ ...sendForm, note: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
            </div>
          )}

          {stockPanel === 'request' && (
            <div className="space-y-4">
              <div className="text-[12px]" style={{ color: C.inkDim }}>Tell the owner what you need. You'll see here when it's on the way.</div>
              <div className="space-y-2.5">{requestForm.lines.map((_, i) => lineRow(requestForm.lines, (lines) => setRequestForm({ ...requestForm, lines }), i, false))}</div>
              <button onClick={() => setRequestForm({ ...requestForm, lines: [...requestForm.lines, { productId: '', qty: '' }] })} className="text-[12px] font-medium" style={{ color: C.sage }}>+ Add another item</button>
              <input type="text" placeholder="Note (optional) — e.g. customers keep asking" value={requestForm.note} onChange={(e) => setRequestForm({ ...requestForm, note: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
            </div>
          )}

          {stockError && <div className="mt-4 rounded-xl px-3.5 py-2.5 text-[12.5px]" style={{ background: C.rustSoft, color: C.rust }}>{stockError}</div>}
          <button onClick={stockPanel === 'delivery' ? submitDelivery : stockPanel === 'transfer' ? submitSend : submitRequest} disabled={stockBusy} className="w-full mt-5 rounded-xl py-3.5 text-[14px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: stockBusy ? 0.6 : 1 }}>
            {stockBusy ? 'Saving…' : stockPanel === 'delivery' ? 'Record delivery' : stockPanel === 'transfer' ? (sendForm.receivedNow ? 'Send and mark received' : 'Send stock') : 'Send request'}
          </button>
        </div>
      </div>
    );
  };

  const renderInsights = () => {
    const rows = productPerformance(insightDays);
    const sold = rows.filter((r) => r.units > 0);
    const unitWord = T.tracksStock ? 'sold' : 'done';
    const byRevenue = [...sold].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const byPace = [...sold].sort((a, b) => b.perDay - a.perDay).slice(0, 5);
    const byProfit = [...sold].filter((r) => r.profit > 0).sort((a, b) => b.profit - a.profit).slice(0, 5);
    const slow = rows.filter((r) => r.units === 0 && (r.stockQuantity === null || r.stockQuantity > 0)).sort((a, b) => (b.stockQuantity || 0) - (a.stockQuantity || 0));
    const soonOut = sold.filter((r) => r.daysLeft !== null && r.daysLeft <= 7).sort((a, b) => a.daysLeft - b.daysLeft);
    const pace = (r) => (r.perDay >= 1 ? `~${Math.round(r.perDay)} a day` : r.perDay * 7 >= 1 ? `~${Math.round(r.perDay * 7)} a week` : `${r.units} in ${insightDays} days`);
    const rankList = (items, valueOf, max, sub) => (
      <div className="space-y-2.5">
        {items.map((r, i) => (
          <div key={r.id}>
            <div className="flex items-center justify-between gap-3 text-[13px] mb-1">
              <span className="min-w-0 truncate"><span className="cx-mono mr-2" style={{ color: C.inkFaint }}>{i + 1}</span>{r.name}</span>
              <span className="shrink-0 cx-mono font-semibold">{sub(r)}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.surfaceRaised }}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(4, (valueOf(r) / (max || 1)) * 100)}%`, background: C.sage }} />
            </div>
          </div>
        ))}
      </div>
    );
    const block = (title, hint, body) => (
      <div className="rounded-2xl p-4 mb-4" style={card}>
        <div className="text-[14px] font-semibold cx-display">{title}</div>
        <div className="text-[11.5px] mb-3.5" style={{ color: C.inkFaint }}>{hint}</div>
        {body}
      </div>
    );
    return (
      <>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-[12px]" style={{ color: C.inkFaint }}>{viewAllShops ? 'All shops combined' : shopNameOf(activeShopId)} · last {insightDays} days</div>
          <div className="flex gap-1 p-1 rounded-lg shrink-0" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setInsightDays(d)} className="px-2.5 py-1 rounded-md text-[12px] font-semibold" style={insightDays === d ? { background: C.copper, color: C.bg } : { color: C.inkDim }}>{d}d</button>
            ))}
          </div>
        </div>

        {sold.length === 0 ? (
          <div className="text-center rounded-2xl px-5 py-10 mb-4" style={{ border: `1px dashed ${C.line}` }}>
            <div className="text-[14px] font-semibold mb-1">No {T.catalog.toLowerCase()} {unitWord} in the last {insightDays} days</div>
            <div className="text-[12px]" style={{ color: C.inkFaint }}>Insights appear once sales are recorded by picking items from your {T.catalog.toLowerCase()}.</div>
          </div>
        ) : (
          <>
            {soonOut.length > 0 && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: C.rustSoft, border: '1px solid rgba(226,98,75,0.3)' }}>
                <div className="text-[13.5px] font-semibold mb-2" style={{ color: C.rust }}>Restock soon</div>
                <div className="space-y-1.5">
                  {soonOut.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="min-w-0 truncate">{r.name}</span>
                      <span className="shrink-0" style={{ color: C.inkDim }}>{r.stockQuantity} left · <strong style={{ color: C.rust }}>{r.daysLeft < 1 ? 'less than a day' : `about ${Math.round(r.daysLeft)} day${Math.round(r.daysLeft) !== 1 ? 's' : ''}`}</strong></span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] mt-2" style={{ color: C.inkDim }}>At the pace they're selling, these run out within a week.</div>
              </div>
            )}
            {block('Best sellers', 'Bringing in the most money', rankList(byRevenue, (r) => r.revenue, byRevenue[0]?.revenue, (r) => fmt(r.revenue)))}
            {block('Fastest moving', `How quickly each one ${T.tracksStock ? 'sells' : 'gets booked'}`, rankList(byPace, (r) => r.perDay, byPace[0]?.perDay, (r) => `${r.units} ${unitWord} · ${pace(r)}`))}
            {byProfit.length > 0 && block('Most profitable', 'Money kept after what each one costs you', rankList(byProfit, (r) => r.profit, byProfit[0]?.profit, (r) => fmt(r.profit)))}
          </>
        )}

        {slow.length > 0 && block(
          T.tracksStock ? 'Slow or not selling' : 'Not booked lately',
          T.tracksStock ? `No sales in the last ${insightDays} days` : `No bookings in the last ${insightDays} days`,
          <>
            <div className="space-y-1.5 mb-3">
              {slow.slice(0, 8).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="min-w-0 truncate" style={{ color: C.inkDim }}>{r.name}</span>
                  {r.stockQuantity !== null && <span className="shrink-0 cx-mono" style={{ color: C.inkFaint }}>{r.stockQuantity} in stock</span>}
                </div>
              ))}
            </div>
            <div className="text-[11.5px] leading-relaxed rounded-lg px-3 py-2" style={{ background: C.surfaceRaised, color: C.inkDim }}>
              {T.tracksStock ? 'Money tied up here isn\'t working for you. Consider a discount, bundling it with a best seller, or ordering less next time.' : 'Consider promoting these on your storefront or WhatsApp status, or a special price for a limited time.'}
            </div>
          </>
        )}

        <button onClick={() => { setPreviousTab('products'); setTab('advisor'); runAdvisor(T.tracksStock ? 'Based on my sales, which products should I stock more of, and which should I reduce or stop?' : 'Based on my bookings, which services should I promote more, and which should I rethink?'); }} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold mb-2" style={{ border: `1px solid ${C.line}`, color: C.ink }}>
          <Lightbulb size={15} style={{ color: C.copper }} /> Ask Oga what to {T.tracksStock ? 'stock more or less of' : 'focus on'}
        </button>
      </>
    );
  };

  // ---------- Notification centre: everything waiting for the owner, in one place ----------
  const notifItems = (() => {
    const items = [];
    const go = (t, extra) => () => { setNotifOpen(false); extra && extra(); setTab(t); };
    if (pendingOrderCount > 0) items.push({ key: 'orders', urgent: false, Icon: ShoppingBag, title: `${pendingOrderCount} new ${T.order}${pendingOrderCount !== 1 ? 's' : ''} from your storefront`, sub: 'Review and fulfil', onClick: go('orders') });
    if (isOwnerRole && pendingRequests.length > 0) items.push({ key: 'requests', urgent: false, Icon: PackagePlus, title: `${pendingRequests.length} stock request${pendingRequests.length !== 1 ? 's' : ''} from your shops`, sub: pendingRequests.slice(0, 2).map((r) => shopNameOf(r.shop_id)).join(', '), onClick: go('products', () => setProductsView('list')) });
    if (needsAttention.length > 0) items.push({ key: 'invoices', urgent: true, Icon: PhoneCall, title: `${needsAttention.length} invoice${needsAttention.length !== 1 ? 's' : ''} need${needsAttention.length === 1 ? 's' : ''} follow-up`, sub: needsAttention.slice(0, 3).map((i) => i.clientName).join(', '), onClick: go('invoices') });
    const arriving = isOwnerRole ? inTransit : inTransit.filter((t) => myShops.some((s) => s.id === t.to_shop));
    if (arriving.length > 0) items.push({ key: 'transit', urgent: false, Icon: Truck, title: `${arriving.length} item${arriving.length !== 1 ? 's' : ''} on the way`, sub: 'Confirm what arrives', onClick: go('products', () => setProductsView('list')) });
    const low = products.filter((p) => p.isLow);
    if (low.length > 0) items.push({ key: 'low', urgent: false, Icon: Package, title: `${low.length} item${low.length !== 1 ? 's' : ''} running low`, sub: low.slice(0, 3).map((p) => p.name).join(', '), onClick: go('products', () => setProductsView('list')) });
    const shortWeek = stockTransfers.filter((t) => t.status === 'received' && t.qty_received !== null && Number(t.qty_received) < Number(t.qty_sent) && Date.now() - new Date(t.received_at).getTime() < 7 * 86400000);
    if (isOwnerRole && shortWeek.length > 0) items.push({ key: 'short', urgent: true, Icon: Truck, title: `${shortWeek.length} shortage${shortWeek.length !== 1 ? 's' : ''} this week`, sub: 'Items missing on arrival', onClick: go('products', () => setProductsView('list')) });
    return items;
  })();
  const notifUrgent = notifItems.some((i) => i.urgent);
  badgeRef.current = notifItems.length;
  const renderBell = (extraClass = '') => (
    <button onClick={() => setNotifOpen((o) => !o)} aria-label={`Notifications${notifItems.length ? `, ${notifItems.length} waiting` : ''}`} aria-expanded={notifOpen} className={`relative flex items-center justify-center shrink-0 ${extraClass}`} style={{ color: notifOpen ? C.copper : C.inkDim }}>
      <Bell size={16} />
      {notifItems.length > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: notifUrgent ? C.rust : C.copper, color: C.bg }}>{notifItems.length}</span>
      )}
    </button>
  );
  const renderNotifPanel = () => notifOpen && (
    <>
      <div className="fixed inset-0 z-[88]" onClick={() => setNotifOpen(false)} />
      <div role="dialog" aria-label="Notifications" className="fixed z-[89] right-3 left-3 sm:left-auto sm:w-[360px] top-16 lg:top-[72px] rounded-2xl overflow-hidden xorla-fade-up" style={{ background: C.surface, border: `1px solid ${C.lineStrong || C.line}`, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <span className="text-[14px] font-semibold cx-display">Needs your attention</span>
          <button onClick={() => setNotifOpen(false)} aria-label="Close" style={{ color: C.inkFaint }}><X size={16} /></button>
        </div>
        {notifItems.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Check size={22} className="mx-auto mb-2" style={{ color: C.sage }} />
            <div className="text-[13.5px] font-semibold">You're all caught up</div>
            <div className="text-[12px] mt-0.5" style={{ color: C.inkFaint }}>Nothing is waiting on you right now.</div>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {notifItems.map((it, i) => (
              <button key={it.key} onClick={it.onClick} className="w-full text-left flex items-start gap-3 px-4 py-3.5 active:opacity-70" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: it.urgent ? C.rustSoft : C.copperSoft }}><it.Icon size={16} style={{ color: it.urgent ? C.rust : C.copper }} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold">{it.title}</span>
                  {it.sub && <span className="block text-[11.5px] truncate" style={{ color: C.inkFaint }}>{it.sub}</span>}
                </span>
                <ChevronRight size={16} className="shrink-0 mt-2.5" style={{ color: C.inkFaint }} />
              </button>
            ))}
          </div>
        )}
        {renderPushControl(true) && <div className="px-4 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.surfaceRaised }}>{renderPushControl(true)}</div>}
      </div>
    </>
  );

  const callPush = async (action) => {
    const res = await fetch(`${SB_URL}/functions/v1/push`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ action }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || "Notifications aren't available right now.");
    return data;
  };
  const enablePush = async () => {
    setPushBusy(true); setPushNote(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPushState(perm === 'denied' ? 'denied' : 'off'); return; }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await callPush('config');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(publicKey) });
      const j = sub.toJSON();
      await sbRpc('save_push_subscription', session.access_token, { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
      setPushState('on');
      await callPush('test').catch(() => {});
      setPushNote({ ok: true, text: "You're set. A test notification is on its way." });
    } catch (e) { setPushNote({ ok: false, text: e.message }); }
    finally { setPushBusy(false); }
  };
  const disablePush = async () => {
    setPushBusy(true); setPushNote(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await sbRpc('delete_push_subscription', session.access_token, { p_endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
      setPushState('off');
    } catch (e) { setPushNote({ ok: false, text: e.message }); }
    finally { setPushBusy(false); }
  };
  const testPush = async () => {
    setPushBusy(true); setPushNote(null);
    try { await callPush('test'); setPushNote({ ok: true, text: 'Test sent — check your notifications.' }); }
    catch (e) { setPushNote({ ok: false, text: e.message }); }
    finally { setPushBusy(false); }
  };
  // The same compact control everywhere: panel, Settings, staff screen
  const renderPushControl = (compact = false) => {
    if (pushState === 'checking' || pushState === 'unsupported') return compact ? null : <div className="text-[12px]" style={{ color: C.inkFaint }}>This browser can't receive notifications. Try Chrome on Android, or install Xorla on your iPhone's Home Screen.</div>;
    const note = pushNote && <div className="text-[11.5px] mt-2 font-medium" style={{ color: pushNote.ok ? C.sage : C.rust }}>{pushNote.text}</div>;
    if (PUSH_UNRELIABLE_BROWSER && (pushState === 'off' || pushState === 'on')) return (
      <div>
        <div className="text-[12px] leading-relaxed mb-2.5" style={{ color: C.inkDim }}>
          <strong style={{ color: C.ink }}>Notifications on Android work reliably in Chrome.</strong> {PUSH_UNRELIABLE_BROWSER} on Android may say they're on but never deliver them — a known issue with the browser, not your phone.
        </div>
        <a href={`intent://${window.location.host}/#Intent;scheme=https;package=com.android.chrome;end`} className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold" style={{ background: C.copper, color: C.bg }}>Open Xorla in Chrome</a>
        {pushState === 'on' && <button onClick={disablePush} disabled={pushBusy} className="w-full mt-2 text-[12px] font-medium" style={{ color: C.inkFaint }}>Turn off here</button>}
        {note}
      </div>
    );
    if (pushState === 'ios-install') return <div className="text-[12px] leading-relaxed" style={{ color: C.inkDim }}><strong style={{ color: C.ink }}>On iPhone:</strong> add Xorla to your Home Screen first (Share → Add to Home Screen), then open it from there to turn on notifications.</div>;
    if (pushState === 'denied') return (
      <div>
        <div className="text-[12.5px] font-semibold mb-1.5" style={{ color: C.ink }}>Notifications are blocked on this {DEVICE_WORD}</div>
        <ol className="text-[12px] leading-relaxed space-y-1 mb-2.5" style={{ color: C.inkDim }}>
          <li><strong style={{ color: C.ink }}>1.</strong> Phone <strong style={{ color: C.ink }}>Settings → Apps → Chrome → Notifications</strong>: switch them on</li>
          <li><strong style={{ color: C.ink }}>2.</strong> In Chrome: <strong style={{ color: C.ink }}>⋮ → Settings → Site settings → Notifications</strong>: turn on "Sites can ask", and if Xorla is under Blocked, set it to Allow</li>
          <li><strong style={{ color: C.ink }}>3.</strong> Come back here and tap the button below</li>
        </ol>
        <button onClick={checkPush} className="w-full rounded-xl py-2.5 text-[12.5px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.ink }}>I've allowed it — check again</button>
      </div>
    );
    if (pushState === 'off') return (
      <div>
        <button onClick={enablePush} disabled={pushBusy} className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: pushBusy ? 0.6 : 1 }}><Bell size={15} /> {pushBusy ? 'Turning on…' : `Get these on this ${DEVICE_WORD}`}</button>
        {note}
      </div>
    );
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: C.sage }}><Check size={15} /> On for this {DEVICE_WORD}</span>
          <span className="flex items-center gap-3 text-[12px] font-medium">
            {!compact && <button onClick={testPush} disabled={pushBusy} style={{ color: C.copper }}>Send a test</button>}
            <button onClick={disablePush} disabled={pushBusy} style={{ color: C.inkFaint }}>Turn off</button>
          </span>
        </div>
        {note}
      </div>
    );
  };

  // ---------- Billing actions ----------
  const callBilling = async (action, extra = {}) => {
    const res = await fetch(`${SB_URL}/functions/v1/billing`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ action, ...extra }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || 'Payments are not available right now. Please try again.');
    return data;
  };
  const startCheckout = async (plan) => {
    setBillingBusy(plan); setBillingNote(null);
    try {
      const r = await callBilling('checkout', { plan, interval: planInterval, extraShops: plan === 'business' ? planExtra : 0, autoRenew: payMode === 'auto' });
      window.location.href = r.url;   // Paystack's secure payment page; it brings them back here afterwards
    } catch (e) { setBillingNote({ ok: false, text: e.message }); setBillingBusy(null); }
  };
  const turnOffAutoRenew = async () => {
    if (!window.confirm('Turn off auto-renew? Your plan stays active until its end date, and your saved card is removed.')) return;
    setBillingBusy('auto'); setBillingNote(null);
    try { await callBilling('auto_renew_off'); await loadBusinessData(session.access_token); setBillingNote({ ok: true, text: 'Auto-renew is off and your card has been removed.' }); }
    catch (e) { setBillingNote({ ok: false, text: e.message }); }
    finally { setBillingBusy(null); }
  };
  const openPlanPage = () => { setLimitPrompt(null); setDraft({ ...settings }); setSettingsPage('plan'); setPreviousTab(tab === 'settings' ? 'overview' : tab); setTab('settings'); };

  const renderPlanPage = () => {
    if (!planKnown) return <div className="text-[13px] px-1" style={{ color: C.inkFaint }}>Plans aren't switched on yet.</div>;
    const s = subscription;
    const display = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
    const GOLD = { top: '#FFC24A', mid: '#FFB020', deep: '#E89A0C', on: '#0A1F1C' };
    const per = planInterval === 'monthly' ? 'a month' : 'a year';
    // How much of the current period is left, for the bar on the membership card
    const periodDays = onTrial ? 30 : s.billing_interval === 'yearly' ? 365 : 30;
    const leftPct = planDaysLeft === null || effPlan === 'free' ? 0 : Math.max(2, Math.min(100, (planDaysLeft / periodDays) * 100));
    const status = onTrial ? { label: 'Free trial', color: C.copper } : effPlan !== 'free' ? { label: 'Active', color: C.sage } : { label: s.status === 'expired' ? 'Plan ended' : 'Free', color: C.inkDim };

    const meter = (label, used, cap, note) => {
      const pct = cap ? Math.min(100, (used / cap) * 100) : 0;
      return (
        <div key={label} className="rounded-xl p-3.5" style={{ background: C.surfaceRaised }}>
          <div className="text-[12px] mb-1" style={{ color: C.inkDim }}>{label}</div>
          <div className="text-[15px] font-semibold mb-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {cap === null ? <>{used} <span className="text-[12px] font-normal" style={{ color: C.inkFaint }}>of unlimited</span></>
              : cap === 0 ? <span className="text-[13px] font-medium" style={{ color: C.inkFaint }}>{note || 'Not included'}</span>
              : <>{used} <span className="text-[12px] font-normal" style={{ color: C.inkFaint }}>of {cap}</span></>}
          </div>
          {cap ? <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(234,245,242,0.08)' }}><div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: pct >= 90 ? C.rust : C.sage }} /></div> : null}
          {cap && used > cap ? <div className="text-[11px] mt-1.5 leading-snug" style={{ color: C.rust }}>{used - cap} more than your plan covers</div> : null}
        </div>
      );
    };
    const tick = (t, onGold) => (
      <li key={t} className="flex items-start gap-2.5 text-[13.5px] leading-snug">
        <Check size={15} strokeWidth={2.6} className="shrink-0 mt-[2px]" style={{ color: onGold ? GOLD.on : C.sage }} />
        <span style={{ color: onGold ? GOLD.on : C.inkDim }}>{t}</span>
      </li>
    );
    const priceBlock = (key, onGold) => {
      const price = planPrice(key, planInterval, key === 'business' ? planExtra : 0, earlyEligible);
      const regular = planPrice(key, planInterval, key === 'business' ? planExtra : 0, false);
      const sub = onGold ? 'rgba(10,31,28,0.72)' : C.inkFaint;
      return (
        <div className="mt-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{ fontFamily: display, fontWeight: 800, fontSize: 34, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: onGold ? GOLD.on : C.ink }}>{fmt(price)}</span>
            <span className="text-[13px]" style={{ color: sub }}>{per}</span>
            {earlyEligible && regular > price && <span className="text-[13px] line-through" style={{ color: sub }}>{fmt(regular)}</span>}
          </div>
          {earlyEligible && regular > price && (
            <div className="text-[12px] mt-1" style={{ color: onGold ? GOLD.on : C.copper }}>
              {earlyActive ? `Early-supporter price, yours until ${fmtDate(s.early_supporter_until)}` : `Early-supporter price for your first 12 months${earlySpots !== null ? `. ${earlySpots} of 100 places left` : ''}`}
            </div>
          )}
        </div>
      );
    };
    const cta = (key, onGold) => {
      const price = planPrice(key, planInterval, key === 'business' ? planExtra : 0, earlyEligible);
      const isCurrent = effPlan === key && !onTrial;
      const label = billingBusy === key ? 'Opening secure payment…' : `${isCurrent ? 'Renew' : 'Choose'} ${PLAN_INFO[key].name} for ${fmt(price)} ${per}`;
      return (
        <>
          <button onClick={() => startCheckout(key)} disabled={!!billingBusy} className="w-full rounded-2xl py-3.5 text-[14px] font-bold transition-opacity"
            style={{ ...(onGold ? { background: GOLD.on, color: GOLD.mid } : { background: 'transparent', color: C.sage, border: `1.5px solid ${C.sage}` }), opacity: billingBusy && billingBusy !== key ? 0.5 : 1 }}>{label}</button>
          <div className="text-[11.5px] mt-2 text-center" style={{ color: onGold ? 'rgba(10,31,28,0.7)' : C.inkFaint }}>
            {isCurrent ? 'Renewing early adds to the time you have left.' : effPlan !== 'free' && !onTrial ? 'Switching plans starts the new plan from today.' : 'Cancel anytime. Nothing renews without telling you.'}
          </div>
        </>
      );
    };
    const proCurrent = effPlan === 'pro' && !onTrial;
    const bizCurrent = effPlan === 'business' && !onTrial;

    return (
      <div className="space-y-6">
        {billingNote && <div className="rounded-2xl px-4 py-3 text-[13px] font-medium" style={{ background: billingNote.ok ? C.sageSoft : C.rustSoft, color: billingNote.ok ? C.sage : C.rust }}>{billingNote.text}</div>}
        {billingBusy === 'verify' && <div className="rounded-2xl px-4 py-3 text-[13px]" style={{ background: C.surfaceRaised, color: C.inkDim }}>Confirming your payment with Paystack…</div>}

        {/* Membership card */}
        <div className="relative overflow-hidden rounded-[24px] p-5" style={{ background: 'linear-gradient(150deg, #134A43 0%, #0E2E29 55%, #0B2420 100%)', border: '1px solid rgba(31,217,196,0.22)' }}>
          <div aria-hidden="true" className="absolute -right-10 -top-12 w-44 h-44 rounded-full" style={{ background: 'radial-gradient(circle, rgba(31,217,196,0.18), transparent 70%)' }} />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="text-[12.5px]" style={{ color: C.inkDim }}>Current plan</div>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{PLAN_INFO[effPlan].name}</div>
            </div>
            <span className="text-[12px] font-semibold px-3 py-1 rounded-full shrink-0" style={{ background: 'rgba(10,31,28,0.5)', color: status.color, border: `1px solid ${status.color}` }}>{status.label}</span>
          </div>
          <div className="relative text-[13px] leading-relaxed mt-2" style={{ color: C.inkDim }}>
            {onTrial ? `Pro free trial. Ends ${fmtDate(s.trial_ends_at)}, no card needed.`
              : effPlan !== 'free' ? (s.auto_renew ? `Renews automatically on ${fmtDate(s.current_period_end)}${s.card_last4 ? ` with ${s.card_brand ? s.card_brand.charAt(0).toUpperCase() + s.card_brand.slice(1) : 'card'} ending ${s.card_last4}` : ''}.` : `Paid until ${fmtDate(s.current_period_end)}. We'll remind you 3 days before.`)
              : s.status === 'expired' ? 'Your plan ended, so you are on Free. Everything you recorded is still here.'
              : 'Free forever. Upgrade whenever you are ready.'}
          </div>
          {effPlan !== 'free' && planDaysLeft !== null && (
            <div className="relative mt-4">
              <div className="flex justify-between text-[12px] mb-1.5"><span style={{ color: C.inkDim }}>{onTrial ? 'Trial' : 'This period'}</span><span className="font-semibold">{planDaysLeft} day{planDaysLeft !== 1 ? 's' : ''} left</span></div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(234,245,242,0.08)' }}><div className="h-full rounded-full" style={{ width: `${leftPct}%`, background: planDaysLeft <= 3 ? C.copper : C.sage }} /></div>
            </div>
          )}
          {(earlyActive || (effPlan !== 'free' && s.auto_renew)) && (
            <div className="relative flex items-center justify-between gap-3 mt-4 pt-3.5" style={{ borderTop: '1px solid rgba(234,245,242,0.1)' }}>
              <span className="text-[12.5px]" style={{ color: earlyActive ? C.copper : C.inkDim }}>{earlyActive ? `Early-supporter price until ${fmtDate(s.early_supporter_until)}` : 'Auto-renew is on'}</span>
              {effPlan !== 'free' && s.auto_renew && <button onClick={turnOffAutoRenew} disabled={!!billingBusy} className="text-[12.5px] font-medium shrink-0" style={{ color: C.inkFaint }}>Turn off auto-renew</button>}
            </div>
          )}
        </div>

        {/* Usage */}
        <div>
          <h3 className="text-[14px] font-semibold mb-2.5 px-1">Used this month</h3>
          <div className="grid grid-cols-2 gap-2">
            {meter('Oga and AI messages', usage?.ai_month ?? 0, planCaps.ai)}
            {meter('WhatsApp reminders', usage?.wa_month ?? 0, planCaps.wa, 'On Pro and Business')}
            {meter('Staff', settings.staffList.length, planCaps.staff, 'On Pro and Business')}
            {meter('Locations', liveLocations.length, planCaps.locations)}
            {meter(T.catalog, productsAll.length, planCaps.products)}
          </div>
        </div>

        {/* Plans */}
        <div>
          <h3 className="text-[18px] text-center mb-1" style={{ fontFamily: display, fontWeight: 800, letterSpacing: '-0.02em' }}>{effPlan === 'free' || onTrial ? 'Choose your plan' : 'Change or renew'}</h3>
          <p className="text-[12.5px] text-center mb-4" style={{ color: C.inkFaint }}>Pay by card, transfer or USSD. Cancel anytime.</p>
          <div className="flex justify-center mb-5">
            <div role="group" aria-label="Billing period" className="inline-flex p-1 rounded-2xl" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
              <button onClick={() => setPlanInterval('monthly')} aria-pressed={planInterval === 'monthly'} className="px-4 py-2 rounded-xl text-[13px] font-semibold" style={planInterval === 'monthly' ? { background: C.ink, color: C.bg } : { color: C.inkDim }}>Monthly</button>
              <button onClick={() => setPlanInterval('yearly')} aria-pressed={planInterval === 'yearly'} className="px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-2" style={planInterval === 'yearly' ? { background: C.ink, color: C.bg } : { color: C.inkDim }}>
                Yearly <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: GOLD.mid, color: GOLD.on }}>2 months free</span>
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            {/* Pro — the gold card */}
            <div className="relative rounded-[26px] p-6" style={{ background: `linear-gradient(155deg, ${GOLD.top} 0%, ${GOLD.mid} 45%, ${GOLD.deep} 100%)`, color: GOLD.on, boxShadow: '0 24px 60px rgba(255,176,32,0.18), inset 0 1px 0 rgba(255,255,255,0.35)' }}>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: display, fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>Pro</span>
                <span className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full" style={{ background: GOLD.on, color: GOLD.mid }}>{proCurrent ? 'Your plan' : 'Recommended'}</span>
              </div>
              <div className="text-[13px] mt-0.5" style={{ color: 'rgba(10,31,28,0.75)' }}>For a growing shop with staff</div>
              {priceBlock('pro', true)}
              <ul className="space-y-2 mt-5 mb-6">
                {['Up to 3 staff, each with their own login', `Unlimited ${T.catalog.toLowerCase()}`, '150 questions to Oga a month, in 5 languages', '100 automatic WhatsApp reminders a month', 'Weekly or monthly WhatsApp summaries'].map((t) => tick(t, true))}
              </ul>
              {cta('pro', true)}
            </div>

            {/* Business */}
            <div className="rounded-[26px] p-6" style={{ background: C.surface, border: `1.5px solid ${bizCurrent ? C.sage : C.line}` }}>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: display, fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>Business</span>
                {bizCurrent && <span className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full" style={{ background: C.sageSoft, color: C.sage }}>Your plan</span>}
              </div>
              <div className="text-[13px] mt-0.5" style={{ color: C.inkDim }}>For several shops or warehouses</div>
              {priceBlock('business', false)}
              <ul className="space-y-2 mt-5 mb-5">
                {['Everything in Pro', 'Up to 10 staff across your locations', 'Deliveries, transfers and stock requests', '500 questions to Oga and 500 reminders a month'].map((t) => tick(t, false))}
              </ul>
              {liveLocations.length > 3 + planExtra && (
                <div className="rounded-2xl px-4 py-3 mb-2 text-[12.5px] leading-relaxed" style={{ background: C.rustSoft, color: C.ink }}>
                  You have <strong>{liveLocations.length} locations</strong>. Add {liveLocations.length - 3 - planExtra} more below so your plan covers them all.
                </div>
              )}
              <div className="flex items-center justify-between rounded-2xl px-4 py-3 mb-5" style={{ background: C.surfaceRaised }}>
                <div>
                  <div className="text-[13.5px] font-semibold">{3 + planExtra} locations</div>
                  <div className="text-[11.5px]" style={{ color: C.inkFaint }}>3 included. Extra ones are {fmt(PLAN_PRICES.extraShop[planInterval])} {per} each</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setPlanExtra(Math.max(0, planExtra - 1))} disabled={planExtra === 0} aria-label="One fewer location" className="w-9 h-9 rounded-xl text-[17px] font-bold" style={{ border: `1px solid ${C.line}`, opacity: planExtra === 0 ? 0.4 : 1 }}>−</button>
                  <button onClick={() => setPlanExtra(Math.min(50, planExtra + 1))} aria-label="One more location" className="w-9 h-9 rounded-xl text-[17px] font-bold" style={{ border: `1px solid ${C.line}` }}>+</button>
                </div>
              </div>
              {cta('business', false)}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[13px] font-semibold mb-2 px-1">How you'd like to pay</div>
            <div className="grid grid-cols-2 gap-2">
              {[['once', 'Pay now', 'Card, transfer or USSD. Renew when you choose.'], ['auto', 'Auto-renew', 'Saved card. Turn it off anytime.']].map(([k, l, d]) => (
                <button key={k} onClick={() => setPayMode(k)} role="radio" aria-checked={payMode === k} className="rounded-2xl p-3.5 text-left" style={{ background: C.surface, border: `1.5px solid ${payMode === k ? C.copper : C.line}` }}>
                  <span className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: payMode === k ? C.copper : C.ink }}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ border: `2px solid ${payMode === k ? C.copper : C.inkFaint}` }}>{payMode === k && <span className="w-2 h-2 rounded-full" style={{ background: C.copper }} />}</span>{l}
                  </span>
                  <span className="block text-[11.5px] mt-1 leading-snug" style={{ color: C.inkFaint }}>{d}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-[12px] mt-4 px-1 leading-relaxed" style={{ color: C.inkFaint }}>
            On the Free plan you keep 1 shop run by you, up to 20 {T.catalog.toLowerCase()}, 10 questions to Oga a month, and your storefront, invoices and receipts.
          </p>
        </div>

        {/* Promises */}
        <div className="rounded-[22px] p-5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <h3 className="text-[14px] font-semibold mb-3">Our promises</h3>
          <div className="space-y-3">
            {[[CalendarClock, 'A reminder 3 days before your plan ends. Nothing renews by surprise.'], [Archive, 'Your records are never deleted. Stop paying and you move to Free with everything intact.'], [Tag, 'Price changes are announced 30 days ahead, and you keep your price for 12 months.'], [Lock, 'Paystack handles every payment. Xorla never sees your card details.']].map(([Icon, t]) => (
              <div key={t} className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.sageSoft }}><Icon size={15} style={{ color: C.sage }} /></span>
                <span className="text-[13px] leading-relaxed pt-1" style={{ color: C.inkDim }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {payments.length > 0 && (
          <div>
            <h3 className="text-[14px] font-semibold mb-2.5 px-1">Payment history</h3>
            <div className="rounded-[22px] overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              {payments.map((pm, i) => (
                <div key={pm.id} className="flex items-center justify-between gap-3 px-4 py-3.5" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                  <div>
                    <div className="text-[13.5px] font-semibold">{PLAN_INFO[pm.plan]?.name || pm.plan}, {pm.billing_interval}</div>
                    <div className="text-[12px]" style={{ color: C.inkFaint }}>{fmtDate(pm.paid_at)}</div>
                  </div>
                  <span className="text-[14px] font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(pm.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLimitPrompt = () => limitPrompt && (
    <div className="fixed inset-0 z-[92] flex items-end sm:items-center justify-center sm:p-5" style={{ background: 'rgba(3,10,9,0.8)' }} onClick={() => setLimitPrompt(null)}>
      <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 xorla-fade-up" style={{ background: C.surface, border: `1px solid ${C.line}` }} onClick={(e) => e.stopPropagation()}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: C.copperSoft }}><Sparkles size={20} style={{ color: C.copper }} /></div>
        <div className="text-[17px] font-bold cx-display mb-1.5">{limitPrompt.title}</div>
        <div className="text-[13px] leading-relaxed mb-5" style={{ color: C.inkDim }}>{limitPrompt.body}</div>
        <button onClick={openPlanPage} className="w-full rounded-xl py-3 text-[13.5px] font-semibold mb-2" style={{ background: C.copper, color: C.bg }}>See plans</button>
        <button onClick={() => setLimitPrompt(null)} className="w-full py-2.5 text-[13px] font-medium" style={{ color: C.inkFaint }}>Not now</button>
      </div>
    </div>
  );

  // ---------- Receipts ----------
  const makeReceipt = ({ id, items, total, owed, customerName, customerPhone, shopId, when }) => ({
    no: String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase(),
    date: new Date(when || Date.now()),
    shopName: shops.length > 1 ? shopNameOf(shopId) : '',
    staff: settings.activeStaff || '',
    items, total: Number(total) || 0, owed: Number(owed) || 0,
    paid: Math.max(0, (Number(total) || 0) - (Number(owed) || 0)),
    customerName: customerName || '', customerPhone: customerPhone || '',
  });
  const receiptFromSale = (s) => {
    const group = s.basketId ? salesAll.filter((x) => x.basketId === s.basketId).sort((a, b) => String(a.soldAt).localeCompare(String(b.soldAt))) : [s];
    const total = group.reduce((a, x) => a + Number(x.amount || 0), 0);
    const owed = group.reduce((a, x) => a + Number(x.owed || 0), 0);
    return makeReceipt({ id: s.basketId || s.id, items: group.map((x) => ({ name: x.item, amount: Number(x.amount) })), total, owed, shopId: s.shopId, when: group[0].soldAt || Date.now() });
  };
  const receiptText = (r) => {
    const line = '--------------------------------';
    return [
      settings.businessName, r.shopName, settings.businessAddress, settings.ownerPhone ? formatPhoneDisplay(settings.ownerPhone) : '', line,
      `Receipt #${r.no}`, r.date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      r.staff ? `Served by: ${r.staff}` : '', r.customerName ? `Customer: ${r.customerName}` : '', line,
      ...r.items.map((it) => `${it.name}  ${fmt(it.amount)}`), line,
      `TOTAL: ${fmt(r.total)}`, `Paid: ${fmt(r.paid)}`, r.owed > 0 ? `Balance owed: ${fmt(r.owed)}` : '', line,
      'Thank you for your business!',
    ].filter(Boolean).join('\n');
  };
  const printReceipt = () => {
    try { localStorage.setItem('xorla:paper', paperWidth); } catch (e) {}
    const style = document.createElement('style');
    style.textContent = `@page { size: ${paperWidth}mm auto; margin: 0; }
      @media print {
        body * { visibility: hidden !important; }
        .xorla-print-area, .xorla-print-area * { visibility: visible !important; }
        .xorla-print-area { position: fixed !important; left: 0 !important; top: 0 !important; width: ${paperWidth}mm !important; max-width: none !important; margin: 0 !important; padding: 3mm !important; box-shadow: none !important; border-radius: 0 !important; }
      }`;
    document.head.appendChild(style);
    setTimeout(() => { window.print(); setTimeout(() => style.remove(), 500); }, 50);
  };

  const renderReceiptModal = () => receipt && (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-0 sm:p-5" style={{ background: 'rgba(3,10,9,0.8)' }} onClick={() => setReceipt(null)}>
      <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 xorla-fade-up max-h-[92vh] overflow-y-auto" style={{ background: C.surface, border: `1px solid ${C.line}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[15px] font-semibold cx-display"><Check size={17} style={{ color: C.sage }} /> {T.sale === 'job' ? 'Job' : 'Sale'} saved</div>
          <button onClick={() => setReceipt(null)} aria-label="Close" style={{ color: C.inkFaint }}><X size={18} /></button>
        </div>

        <div className="flex justify-center mb-4 rounded-2xl py-4" style={{ background: C.bg }}>
          <div className="xorla-print-area" style={{ width: paperWidth === '80' ? 300 : 230, background: '#fff', color: '#111', fontFamily: "'Courier New', ui-monospace, monospace", fontSize: 11.5, lineHeight: 1.45, padding: '14px 12px', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{settings.businessName}</div>
            {receipt.shopName && <div style={{ textAlign: 'center' }}>{receipt.shopName}</div>}
            {settings.businessAddress && <div style={{ textAlign: 'center' }}>{settings.businessAddress}</div>}
            {settings.ownerPhone && <div style={{ textAlign: 'center' }}>{formatPhoneDisplay(settings.ownerPhone)}</div>}
            <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />
            <div>Receipt #{receipt.no}</div>
            <div>{receipt.date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            {receipt.staff && <div>Served by: {receipt.staff}</div>}
            {receipt.customerName && <div>Customer: {receipt.customerName}</div>}
            <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />
            {receipt.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ wordBreak: 'break-word' }}>{it.name}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{fmt(it.amount)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}><span>TOTAL</span><span>{fmt(receipt.total)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Paid</span><span>{fmt(receipt.paid)}</span></div>
            {receipt.owed > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Balance owed</span><span>{fmt(receipt.owed)}</span></div>}
            <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />
            <div style={{ textAlign: 'center' }}>Thank you for your business!</div>
            <div style={{ textAlign: 'center', fontSize: 9.5, color: '#666', marginTop: 4 }}>Powered by Xorla</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px]" style={{ color: C.inkDim }}>Receipt paper</span>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
            {['58', '80'].map((w) => (
              <button key={w} onClick={() => { setPaperWidth(w); try { localStorage.setItem('xorla:paper', w); } catch (e) {} }} className="px-3 py-1 rounded-md text-[12px] font-semibold" style={paperWidth === w ? { background: C.copper, color: C.bg } : { color: C.inkDim }}>{w}mm</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <button onClick={printReceipt} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.copper, color: C.bg }}>Print receipt</button>
          <a href={`https://wa.me/${receipt.customerPhone ? toWhatsAppNumber(receipt.customerPhone) : ''}?text=${encodeURIComponent(receiptText(receipt))}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[13.5px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.ink }}><Send size={15} /> Send on WhatsApp</a>
          <button onClick={() => setReceipt(null)} className="w-full py-2.5 text-[13px] font-medium" style={{ color: C.inkFaint }}>Done</button>
        </div>
        <div className="text-[11px] text-center mt-2 leading-relaxed" style={{ color: C.inkFaint }}>Printing works with printers your phone or computer can connect to, including most Bluetooth receipt printers.</div>
      </div>
    </div>
  );

  const cartTotalNow = cartItems.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const renderCartEditor = () => (
<div className="rounded-xl p-3 space-y-2" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                    <div className="text-[10.5px] mb-1" style={{ color: C.inkFaint }}>Everything this one customer is buying right now.</div>
                    {cartItems.map((it, idx) => (
                      <div key={idx} className="space-y-1.5" style={idx > 0 ? { paddingTop: '8px', borderTop: `1px dashed ${C.line}` } : {}}>
                        {products.length > 0 && (
                          <BrandSelect value={it.productId} onChange={(e) => applyProductToCartRow(idx, e.target.value)} className="w-full min-w-0 rounded-lg px-2.5 py-1.5 text-[11px] outline-none" style={{ ...field, colorScheme: 'dark' }}>
                            <option value="">Pick {T.Item === 'Item' ? 'an' : 'a'} {T.item}… (optional)</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.sellingPrice)}</option>)}
                          </BrandSelect>
                        )}
                        <div className="flex gap-1.5 items-center">
                          <input type="text" placeholder="Item" value={it.description} onChange={(e) => { const items = [...cartItems]; items[idx] = { ...items[idx], description: e.target.value }; setCartItems(items); }} className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-[12.5px] outline-none" style={field} />
                          <input type="number" min="1" placeholder="Qty" value={it.quantity} onChange={(e) => { const items = [...cartItems]; items[idx] = { ...items[idx], quantity: e.target.value }; setCartItems(items); }} className="w-14 rounded-lg px-2 py-2 text-[12.5px] text-center outline-none cx-mono" style={field} />
                          <input type="text" inputMode="decimal" placeholder="₦ each" value={formatNumInput(it.unitPrice)} onChange={(e) => { const items = [...cartItems]; items[idx] = { ...items[idx], unitPrice: parseNumInput(e.target.value) }; setCartItems(items); }} className="w-20 min-w-0 shrink-0 rounded-lg px-2 py-2 text-[12.5px] outline-none cx-mono" style={field} />
                          {cartItems.length > 1 && (
                            <button onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))} style={{ color: C.inkFaint }}><X size={14} /></button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setCartItems([...cartItems, { productId: '', description: '', quantity: '1', unitPrice: '', unitCost: '' }])} className="text-[11.5px] font-medium" style={{ color: C.sage }}>+ Add another item</button>
                    <div className="text-[13px] font-semibold pt-1" style={{ color: C.ink, borderTop: `1px solid ${C.line}` }}>
                      Basket total: {fmt(cartItems.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0))}
                    </div>
                  </div>
  );

  const renderShopSwitcher = () => showShopSwitcher && (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <BrandSelect aria-label="Choose shop" icon={<Store size={15} className="shrink-0" style={{ color: C.copper }} />} value={viewAllShops ? 'all' : activeShopId || ''} onChange={(e) => setCurrentShopId(e.target.value)} className="pl-3.5 pr-3 py-2.5 rounded-full text-[13px] font-semibold whitespace-nowrap" style={{ background: C.surfaceRaised, border: `1px solid ${C.lineStrong || C.line}`, maxWidth: 260 }}>
        {isOwnerRole && <option value="all">All shops</option>}
        {myShops.map((s) => <option key={s.id} value={s.id}>{s.name}{isPausedLocation(s.id) ? ' (paused)' : ''}</option>)}
      </BrandSelect>
      {viewAllShops && <span className="text-[11.5px]" style={{ color: C.inkFaint }}>Showing {shops.length} shops combined</span>}
    </div>
  );
  // In "All shops", forms ask which shop a new record belongs to
  const renderRecordShopPicker = () => (viewAllShops && shops.filter((s) => !isPausedLocation(s.id)).length > 1) && (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11.5px] font-medium" style={{ color: C.inkDim }}>For shop:</span>
      {shops.filter((s) => !isPausedLocation(s.id)).map((s) => (
        <button key={s.id} type="button" onClick={() => { setRecordShopId(s.id); setSaleForm((f) => { if (!f.productId) return f; const base = productsAll.find((p) => p.id === f.productId); if (!base) return f; const qty = Math.max(1, Number(f.quantity) || 1); return { ...f, amount: String(priceAt(base, s.id) * qty) }; }); setCartItems((items) => items.map((it) => { if (!it.productId) return it; const base = productsAll.find((p) => p.id === it.productId); return base ? { ...it, unitPrice: String(priceAt(base, s.id)) } : it; })); }} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={targetShopId === s.id ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{s.name}</button>
      ))}
    </div>
  );

  if (settings.role === 'staff' && planKnown && (planCaps.staff === 0 || seatOk === false)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 cx-body" style={{ background: C.bg, color: C.ink }}>
        {fontStyle}
        <div className="max-w-sm w-full rounded-3xl p-6 text-center" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <XorlaMark size={34} />
          <div className="text-[18px] font-bold cx-display mt-4 mb-2">Staff access is paused</div>
          <div className="text-[13px] leading-relaxed mb-5" style={{ color: C.inkDim }}>{settings.businessName || 'This business'}'s Xorla plan doesn't include your staff place right now. Nothing has been lost — ask the owner to renew, and you'll be able to record again straight away.</div>
          <button onClick={logout} className="w-full rounded-xl py-3 text-[13px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>Log out</button>
        </div>
      </div>
    );
  }
  if (settings.role === 'staff') {
    const myTodaySales = sales.filter((s) => s.dateKey === todayKey() && s.loggedBy === settings.activeStaff);
    const myTodayTotal = myTodaySales.reduce((a, s) => a + Number(s.amount), 0);
    return (
      <div className="min-h-screen cx-body" style={{ background: C.bg, color: C.ink }}>
        {fontStyle}
        <div className="sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)', background: 'rgba(10,31,28,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: `1px solid ${C.line}` }}>
          <div className="max-w-md lg:max-w-6xl mx-auto px-5 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XorlaMark size={26} />
                <span className="cx-display text-[17px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>Xorla</span>
              </div>
              <button onClick={logout} className="flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-lg" style={{ color: C.inkDim }}><LogOut size={13} /> Log out</button>
            </div>
            {showShopSwitcher && <div className="mt-2.5">{renderShopSwitcher()}</div>}
          </div>
        </div>
        {renderReceiptModal()}
        {renderStockPanel()}
        <div className="max-w-md lg:max-w-6xl mx-auto px-5 lg:px-8 pt-6 lg:pt-8 pb-10">

          <div className="mb-6">
            <div className="text-[12px]" style={{ color: C.inkFaint }}>Logging in as</div>
            <div className="text-[20px] font-bold cx-display">{settings.activeStaff}</div>
          </div>

          {/* Wide screens: recording on the left, today's numbers and stock on the right. Phones keep the original order. */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-8">
            <div className="contents lg:block lg:flex-1 lg:min-w-0">
              <div className="order-3 lg:order-none">
          <div className="rounded-2xl p-5 mb-5" style={card}>
            <div className="text-[13.5px] font-semibold cx-display mb-3">Record a {T.sale}</div>
            {myShops.length > 1 && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-[12px]" style={{ background: C.copperSoft, border: '1px solid rgba(255,176,32,0.25)' }}>
                <Store size={14} style={{ color: C.copper }} />
                <span style={{ color: C.inkDim }}>Recording for</span>
                <span className="font-semibold" style={{ color: C.ink }}>{shopNameOf(activeShopId)}</span>
                <span className="ml-auto text-[11px]" style={{ color: C.inkFaint }}>change at the top</span>
              </div>
            )}
            <div className="space-y-2.5">
              <button type="button" onClick={() => setCartMode(!cartMode)} className="flex items-center gap-1.5 text-[12px] font-medium py-0.5" style={{ color: C.copper }}>
                {cartMode ? '− Just one item instead' : '+ Customer buying several different things?'}
              </button>
              {!cartMode && (<>
              {products.length > 0 && (
                <div className="rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                  <div className="text-[10.5px] font-medium mb-1.5" style={{ color: C.inkDim }}>PICK {T.Item === 'Item' ? 'AN' : 'A'} {T.Item.toUpperCase()} (OPTIONAL)</div>
                  <div className="flex gap-2">
                    <BrandSelect value={saleForm.productId} onChange={(e) => applyProductToSale(e.target.value, saleForm.quantity)} className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none" style={{ ...field, colorScheme: 'dark' }}>
                      <option value="">Choose {T.Item === 'Item' ? 'an' : 'a'} {T.item}…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.sellingPrice)}</option>)}
                    </BrandSelect>
                    {saleForm.productId && (
                      <div>
                        <div className="text-[9px] font-semibold text-center mb-1" style={{ color: C.inkFaint }}>QTY</div>
                        <input type="number" min="1" value={saleForm.quantity} onChange={(e) => applyProductToSale(saleForm.productId, e.target.value)} className="w-16 rounded-lg px-2 py-2 text-sm text-center outline-none cx-mono" style={field} />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <input type="text" placeholder={T.soldPrompt} value={saleForm.item} onChange={(e) => setSaleForm({ ...saleForm, item: e.target.value, productId: '' })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
              <div className="flex gap-2">
                <input type="text" inputMode="decimal" placeholder={T.amountPh} value={formatNumInput(saleForm.amount)} onChange={(e) => setSaleForm({ ...saleForm, amount: parseNumInput(e.target.value) })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                <input type="text" inputMode="decimal" placeholder={T.costPh} value={formatNumInput(saleForm.cost)} onChange={(e) => setSaleForm({ ...saleForm, cost: parseNumInput(e.target.value) })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
              </div>
              </>)}
              {cartMode && renderCartEditor()}
              <div>
                <div className="text-[11.5px] font-medium mb-1.5" style={{ color: C.inkDim }}>Did they pay the full amount?</div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setSaleForm({ ...saleForm, fullyPaid: true })} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={saleForm.fullyPaid ? { background: C.sage, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>Yes, in full</button>
                  <button type="button" onClick={() => setSaleForm({ ...saleForm, fullyPaid: false })} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={!saleForm.fullyPaid ? { background: C.rust, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>No, owes some</button>
                </div>
              </div>
              {!saleForm.fullyPaid && (
                <div className="rounded-lg p-3 space-y-2.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                  <input type="text" inputMode="decimal" placeholder="How much did they pay now (₦)?" value={formatNumInput(saleForm.paidNow)} onChange={(e) => setSaleForm({ ...saleForm, paidNow: parseNumInput(e.target.value) })} className="w-full rounded-lg px-3 py-2 text-sm outline-none cx-mono" style={field} />
                  <input type="text" placeholder="Customer's name" value={saleForm.customerName} onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={field} />
                  <div className="flex gap-2">
                    <div className="w-1/2">
                      <div className="text-[10.5px] font-medium mb-1" style={{ color: C.inkFaint }}>PHONE</div>
                      <input type="tel" placeholder="For reminder" value={saleForm.customerPhone} onChange={(e) => setSaleForm({ ...saleForm, customerPhone: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={field} />
                    </div>
                    <div className="w-1/2">
                      <div className="text-[10.5px] font-medium mb-1" style={{ color: C.inkFaint }}>DUE DATE — when they'll pay</div>
                      <input type="date" value={saleForm.dueDate} onChange={(e) => setSaleForm({ ...saleForm, dueDate: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...field, colorScheme: 'dark' }} />
                    </div>
                  </div>
                  <div className="text-[10.5px]" style={{ color: C.inkFaint }}>Leave the date blank and we'll default to 7 days from now.</div>
                  {(cartMode ? cartTotalNow > 0 : saleForm.amount) && (
                    <div className="text-xs font-medium" style={{ color: C.rust }}>Balance owed: {fmt(Math.max(0, (cartMode ? cartTotalNow : Number(saleForm.amount)) - Number(saleForm.paidNow || 0)))}</div>
                  )}
                </div>
              )}
              <button onClick={cartMode ? addCartSale : addSale} disabled={savingSale} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingSale ? 0.6 : 1 }}>{savingSale ? "Saving…" : `Save ${T.sale}`}</button>
            </div>
          </div>
              </div>
              <div className="order-4 lg:order-none">
          {settings.allowStaffExpenses && (
            <div className="rounded-2xl p-5 mb-5" style={card}>
              <div className="text-[13.5px] font-semibold cx-display mb-3">Record an expense</div>
              {myShops.length > 1 && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-[12px]" style={{ background: C.copperSoft, border: '1px solid rgba(255,176,32,0.25)' }}>
                <Store size={14} style={{ color: C.copper }} />
                <span style={{ color: C.inkDim }}>Recording for</span>
                <span className="font-semibold" style={{ color: C.ink }}>{shopNameOf(activeShopId)}</span>
                <span className="ml-auto text-[11px]" style={{ color: C.inkFaint }}>change at the top</span>
              </div>
            )}
              <div className="space-y-2.5">
                <input type="text" placeholder="What did you spend on?" value={expenseForm.item} onChange={(e) => setExpenseForm({ ...expenseForm, item: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                <input type="text" inputMode="decimal" placeholder="Amount (₦)" value={formatNumInput(expenseForm.amount)} onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseNumInput(e.target.value) })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setExpenseForm((f) => ({ ...f, category: c, item: f.item.trim() ? f.item : c }))} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={expenseForm.category === c ? { background: C.rust, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{c}</button>
                  ))}
                </div>
                <button onClick={addExpense} disabled={savingExpense} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ border: `1px solid ${C.rust}`, color: C.rust, opacity: savingExpense ? 0.6 : 1 }}>{savingExpense ? "Saving…" : "Save expense"}</button>
              </div>
            </div>
          )}
              </div>
            </div>
            <div className="contents lg:block lg:w-[400px] lg:shrink-0">
              <div className="order-1 lg:order-none">
          <div className="rounded-2xl p-4 mb-5" style={card}>
            <div className="text-[10.5px] uppercase tracking-wide mb-1" style={{ color: C.inkFaint }}>Your sales today</div>
            <div className="cx-mono text-[26px] font-extrabold">{fmt(myTodayTotal)}</div>
            <div className="text-[11.5px] mt-0.5" style={{ color: C.inkFaint }}>{myTodaySales.length} sale{myTodaySales.length !== 1 ? 's' : ''} logged</div>
          </div>
              </div>
              <div className="order-2 lg:order-none">
          {hasManyLocations && (() => {
            const myIncoming = inTransit.filter((t) => myShops.some((s) => s.id === t.to_shop));
            const myRequests = stockRequests.filter((r) => r.requested_by === session?.user_id).slice(0, 5);
            const statusOf = (r) => r.status === 'pending' ? ['Waiting for approval', C.inkFaint]
              : r.status === 'approved' ? ['On the way', C.copper]
              : r.status === 'fulfilled' ? ['Arrived', C.sage]
              : [`Declined${r.decline_reason ? ` — ${r.decline_reason}` : ''}`, C.rust];
            return (
              <div className="rounded-2xl p-4 mb-5 space-y-4" style={card}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold cx-display truncate">Stock for {shopNameOf(activeShopId || targetShopId)}</div>
                    <div className="text-[11.5px]" style={{ color: C.inkFaint }}>Running low? Ask for more here.</div>
                  </div>
{multiLocationOn ?                   <button onClick={() => { setStockError(''); setRequestForm({ lines: [{ productId: '', qty: '' }], note: '' }); setStockPanel('request'); }} className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold" style={{ background: C.copper, color: C.bg }}><PackagePlus size={15} /> Request stock</button> : <span className="shrink-0 text-[11.5px] text-right max-w-[160px]" style={{ color: C.inkFaint }}>Requests are part of the Business plan</span>}
                </div>
                {stockError && !stockPanel && <div className="rounded-xl px-3.5 py-2.5 text-[12.5px]" style={{ background: C.rustSoft, color: C.rust }}>{stockError}</div>}
                {pushState !== 'on' && pushState !== 'checking' && pushState !== 'unsupported' && (
                  <div className="rounded-xl p-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                    <div className="text-[12px] mb-2" style={{ color: C.inkDim }}>Get a notification on this {DEVICE_WORD} when stock is sent to your shop, or your request is answered.</div>
                    {renderPushControl(true)}
                  </div>
                )}
                {myIncoming.length > 0 && (
                  <div>
                    <div className="text-[11.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.copper }}>Arriving at your shop — check and confirm</div>
                    <div className="space-y-2">{renderIncoming(myIncoming)}</div>
                  </div>
                )}
                {myRequests.length > 0 && (
                  <div>
                    <div className="text-[11.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkFaint }}>My requests</div>
                    <div className="space-y-1.5">
                      {myRequests.map((r) => {
                        const [label, color] = statusOf(r);
                        return (
                          <div key={r.id} className="flex items-start justify-between gap-3 text-[12.5px]">
                            <span className="min-w-0" style={{ color: C.inkDim }}>{(r.items || []).map((it) => `${productName(it.productId)} ×${it.qty}`).join(', ')} <span style={{ color: C.inkFaint }}>· {fmtDay(r.created_at)}</span></span>
                            <span className="shrink-0 font-semibold text-right" style={{ color }}>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
              </div>
              <div className="order-5 lg:order-none">
          {myTodaySales.length > 0 && (
            <div className="rounded-2xl p-4" style={card}>
              <div className="text-[10.5px] uppercase tracking-wide mb-3" style={{ color: C.inkFaint }}>Logged today</div>
              <div className="space-y-2.5">
                {myTodaySales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="min-w-0 truncate" style={{ color: C.inkDim }}>{s.item} · {s.time}</span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="cx-mono font-medium">{fmt(s.amount)}</span>
                      <button onClick={() => setReceipt(receiptFromSale(s))} className="text-[11px] font-medium" style={{ color: C.copper }}>Receipt</button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderBusinessTypeChoices = (selected, onPick) => (
    <div className="space-y-2.5">
      {BUSINESS_TYPE_CHOICES.map((opt) => {
        const on = selected === opt.id;
        return (
          <button key={opt.id} onClick={() => onPick(opt.id)} className="w-full text-left rounded-2xl p-4 flex items-start gap-3 transition-colors active:scale-[0.99]" style={{ background: on ? C.copperSoft : C.surfaceRaised, border: `1.5px solid ${on ? C.copper : C.line}` }}>
            <span className="mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center" style={{ border: `2px solid ${on ? C.copper : C.inkFaint}` }}>
              {on && <span className="w-2.5 h-2.5 rounded-full" style={{ background: C.copper }} />}
            </span>
            <span>
              <span className="block text-[14.5px] font-semibold mb-0.5">{opt.title}</span>
              <span className="block text-[12px] leading-relaxed" style={{ color: C.inkDim }}>{opt.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderSettingsGroup = (title, rows) => (
    <div>
      {title && <div className="text-[11.5px] font-semibold uppercase tracking-wide px-3 mb-2" style={{ color: C.inkFaint }}>{title}</div>}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        {rows.map((r, i) => {
          const inner = (
            <>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: r.danger ? C.rustSoft : C.surfaceRaised }}>
                <r.Icon size={16} style={{ color: r.danger ? C.rust : C.copper }} />
              </div>
              <span className="flex-1 text-left text-[14.5px] font-medium" style={{ color: r.danger ? C.rust : C.ink }}>{r.label}</span>
              {r.toggle ? (
                <span className="shrink-0 w-12 h-7 rounded-full relative transition-colors" style={{ background: r.on ? C.sage : C.line }}>
                  <span className="absolute top-1 w-5 h-5 rounded-full transition-all" style={{ background: '#fff', left: r.on ? '24px' : '4px' }} />
                </span>
              ) : !r.danger && (
                <span className="flex items-center gap-1.5 shrink-0">
                  {r.value && <span className="text-[13px]" style={{ color: r.valueColor || C.inkFaint }}>{r.value}</span>}
                  <ChevronRight size={17} style={{ color: C.inkFaint }} />
                </span>
              )}
            </>
          );
          const onClick = r.toggle ? r.onToggle : r.action ? r.action : () => setSettingsPage(r.id);
          return (
            <button key={r.label} onClick={onClick} role={r.toggle ? 'switch' : undefined} aria-checked={r.toggle ? r.on : undefined} className="w-full flex items-center gap-3 px-3.5 py-3 active:opacity-70" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (tab === 'settings' && draft) {
    const settingsDirty = EDITABLE_SETTINGS.some((k) => (draft[k] ?? '') !== (settings[k] ?? ''));
    const saveSettingsDraft = () => {
      const patch = {};
      EDITABLE_SETTINGS.forEach((k) => { patch[k] = draft[k]; });
      patch.businessName = (draft.businessName || '').trim() || settings.businessName;
      updateSettings(patch);
      setDraft((prev) => ({ ...prev, ...patch }));
      setSettingsPage(null);
      setSaveNotice('Changes saved');
      setTimeout(() => setSaveNotice(''), 3000);
    };
    const leaveSettings = () => {
      if (settingsDirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
      setTab(previousTab);
    };
    return (
      <div className="min-h-screen cx-body" style={{ background: C.bg, color: C.ink }}>
        {fontStyle}
        <div className="max-w-2xl mx-auto min-h-screen flex flex-col">
          <div className="sticky top-0 z-20 grid items-center h-14 px-2" style={{ gridTemplateColumns: '96px 1fr 96px', background: C.bg, borderBottom: `1px solid ${C.line}` }}>
            <button onClick={() => (settingsPage ? setSettingsPage(null) : leaveSettings())} className="justify-self-start flex items-center gap-0.5 pl-1 pr-3 py-2 rounded-lg active:opacity-60" style={{ color: C.copper }}>
              <ChevronLeft size={22} />
              <span className="text-[14px] font-medium">{settingsPage ? 'Settings' : 'Back'}</span>
            </button>
            <div className="text-center text-[16px] font-semibold cx-display truncate">{SETTINGS_TITLES[settingsPage] || 'Settings'}</div>
            <div />
          </div>

          {renderLimitPrompt()}
          {pinFlow && (
            <PinSetup
              currentPin={pinFlow === 'set' ? '' : settings.pin}
              mode={pinFlow}
              onCancel={() => setPinFlow(null)}
              onFinish={(newPin) => {
                setStoredPin(session?.user_id, newPin);
                setSettings((prev) => ({ ...prev, pin: newPin }));
                setDraft((prev) => (prev ? { ...prev, pin: newPin } : prev));
                setPinNotice(pinFlow === 'remove' ? 'PIN lock turned off.' : pinFlow === 'change' ? 'PIN changed.' : 'PIN lock is on.');
                setPinFlow(null);
                setTimeout(() => setPinNotice(''), 4000);
              }}
            />
          )}
          <div className="flex-1 overflow-y-auto px-4 py-5">
            {settingsPage === null && (
              <div className="space-y-6">
                {isOwnerRole && planKnown && renderSettingsGroup('Plan', [
                  { id: 'plan', Icon: Sparkles, label: 'Your plan', value: onTrial ? `Pro trial · ${planDaysLeft}d left` : PLAN_INFO[effPlan].name, valueColor: effPlan === 'free' ? undefined : C.sage },
                ])}
                {renderSettingsGroup('Business', [
                  { id: 'branding', Icon: Camera, label: 'Name & logo', value: draft.businessName },
                  { id: 'storefront', Icon: ShoppingBag, label: 'Storefront', value: draft.storefrontEnabled ? 'Live' : 'Off', valueColor: draft.storefrontEnabled ? C.sage : undefined },
                  { id: 'shops', Icon: Store, label: 'Shops', value: `${shops.length} shop${shops.length !== 1 ? 's' : ''}` },
                  { id: 'businessType', Icon: Package, label: 'Business type', value: (BUSINESS_TERMS[draft.businessType] || BUSINESS_TERMS.products).typeLabel },
                  { id: 'contact', Icon: Phone, label: 'Phone & contact', value: draft.ownerPhone ? formatPhoneDisplay(draft.ownerPhone) : 'Not set', valueColor: draft.ownerPhone ? undefined : C.rust },
                ])}
                {renderSettingsGroup('Language', [
                  { id: 'messages', Icon: Globe, label: 'Oga & message language', value: (LANGUAGES.find((l) => l.id === draft.language) || LANGUAGES[0]).label },
                ])}
                {renderSettingsGroup('Customers', [
                  { id: 'automation', Icon: Bell, label: 'Automatic WhatsApp', value: draft.autoReminders || draft.summaryFrequency !== 'off' ? 'On' : 'Off', valueColor: draft.autoReminders || draft.summaryFrequency !== 'off' ? C.sage : undefined },
                  { id: 'messages', Icon: Send, label: 'Reminder messages', value: (TONES.find((t) => t.id === draft.tone) || {}).label || '' },
                ])}
                {renderSettingsGroup('Team', [
                  { id: 'team', Icon: Users, label: 'Staff & join code', value: `${settings.staffList.length} staff` },
                  { toggle: true, Icon: Receipt, label: 'Let staff log expenses', on: draft.allowStaffExpenses, onToggle: () => setDraft({ ...draft, allowStaffExpenses: !draft.allowStaffExpenses }) },
                ])}
                {renderSettingsGroup('Security', [
                  { id: 'security', Icon: Lock, label: 'App lock (PIN)', value: settings.pin ? 'On' : 'Off', valueColor: settings.pin ? C.sage : undefined },
                ])}
                {renderSettingsGroup('Help', [
                  { action: () => { setSettingsPage(null); startTour(); }, Icon: Lightbulb, label: 'Replay app tour', value: '' },
                ])}
                {renderSettingsGroup('Notifications', [
                  { id: 'notifications', Icon: Bell, label: 'Notifications', value: pushState === 'on' ? 'On' : pushState === 'denied' ? 'Blocked' : 'Off', valueColor: pushState === 'on' ? C.sage : undefined },
                ])}
                {!isStandalone && renderSettingsGroup('App', [
                  { action: openInstallFromSettings, Icon: Download, label: 'Install Xorla app', value: '' },
                ])}
                {renderSettingsGroup(null, [
                  { action: logout, Icon: LogOut, label: 'Log out', danger: true },
                ])}
              </div>
            )}
            {settingsPage === 'branding' && (
              <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="px-4 pb-5 pt-1">
                  <div className="text-[11px] font-medium mb-2 mt-3" style={{ color: C.inkDim }}>YOUR NAME</div>
                  <input type="text" maxLength={40} placeholder="e.g. Ikenna" value={draft.myName || ''} onChange={(e) => setDraft({ ...draft, myName: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                  <div className="text-[11px] mt-1.5 mb-5" style={{ color: C.inkFaint }}>Your own name, shown on receipts ("Served by") and stock records. Your past records update too.</div>
                  <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>BUSINESS NAME</div>
                  <input type="text" maxLength={60} value={draft.businessName} onChange={(e) => setDraft({ ...draft, businessName: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                  <div className="text-[11px] mt-1.5 mb-5" style={{ color: C.inkFaint }}>Shows on your storefront, invoices, and receipts. Saves when you tap Save.</div>
                  <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>BUSINESS LOGO</div>
                  <div className="flex items-center gap-3">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-14 h-14 rounded-xl object-cover" style={{ border: `1px solid ${C.line}` }} />
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.line}` }}><Package size={20} style={{ color: C.inkFaint }} /></div>
                    )}
                    <label className="flex items-center gap-2 text-[12px] font-medium py-2.5 px-3.5 rounded-xl cursor-pointer" style={{ border: `1px dashed ${C.line}`, color: C.inkDim }}>
                      <Camera size={14} />{logoUploading ? 'Uploading…' : settings.logoUrl ? 'Change logo' : 'Upload logo'}
                      <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                    </label>
                  </div>
                  <div className="text-[11px] mt-1.5" style={{ color: C.inkFaint }}>Shows on your downloadable invoice PDFs.</div>
                </div>
              </div>
            )}
            {settingsPage === 'storefront' && (
              <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="px-4 pb-5 pt-1">
                  {draft.storefrontEnabled && !draft.ownerPhone && (
                    <button onClick={() => setSettingsPage('contact')} className="w-full text-left mt-3 rounded-xl px-3.5 py-3 text-[12px] leading-relaxed" style={{ background: C.rustSoft, color: C.rust }}>
                      <strong>Add your WhatsApp number</strong> so storefront orders can reach you. Tap to add it →
                    </button>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div className="pr-4">
                      <div className="text-[13px] font-medium mb-0.5">Public storefront</div>
                      <div className="text-[11px]" style={{ color: C.inkFaint }}>Lets anyone browse your products and order — no login needed for them.</div>
                    </div>
                    <button onClick={() => setDraft({ ...draft, storefrontEnabled: !draft.storefrontEnabled })} className="shrink-0 w-11 h-6 rounded-full relative" style={{ background: draft.storefrontEnabled ? C.sage : C.line }}>
                      <div className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ background: C.bg, left: draft.storefrontEnabled ? '22px' : '2px' }} />
                    </button>
                  </div>
                  {settings.storefrontEnabled && (
                    <div className="mt-4">
                      <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>BANNER PHOTOS ({(settings.heroImages || []).length}/5)</div>
                      <div className="grid grid-cols-2 gap-2 mb-1.5">
                        {(settings.heroImages || []).map((url, i) => (
                          <div key={url} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '16 / 9', background: C.bg }}>
                            <img src={url} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
                            {i === 0 && <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9.5px] font-semibold" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>Shows first</span>}
                            <button onClick={() => removeHeroImage(url)} className="absolute bottom-1.5 right-1.5 px-2 py-1 rounded-lg text-[10.5px] font-semibold" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>Remove</button>
                          </div>
                        ))}
                        {(settings.heroImages || []).length < 5 && (
                          <label className="rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1 text-center px-2" style={{ aspectRatio: '16 / 9', border: `1px dashed ${C.line}`, background: C.bg, color: C.inkDim }}>
                            <Camera size={16} />
                            <span className="text-[11px] font-medium">{heroUploading ? 'Uploading…' : 'Add photo'}</span>
                            <input type="file" accept="image/*" onChange={handleHeroSelect} className="hidden" disabled={heroUploading} />
                          </label>
                        )}
                      </div>
                      <div className="text-[10.5px] mb-4" style={{ color: C.inkFaint }}>Add up to 5 wide, bright photos — they slide automatically at the top of your store. Photos save as soon as they upload.</div>

                      <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>STORE TAGLINE</div>
                      <input type="text" maxLength={80} placeholder="e.g. Premium human hair, delivered in Aba" value={draft.storefrontTagline} onChange={(e) => setDraft({ ...draft, storefrontTagline: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none mb-4" style={field} />

                      <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>YOUR STORE LINK</div>
                      <div className="flex items-center justify-between rounded-xl px-3.5 py-3 mb-2" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                        <span className="cx-mono text-[12px] truncate pr-2" style={{ color: C.sage }}>{window.location.origin}/store/{settings.businessCode}</span>
                        <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/store/${settings.businessCode}`)} className="shrink-0 text-[11px] font-medium" style={{ color: C.copper }}>Copy</button>
                      </div>
                      <a href={`/store/${settings.businessCode}`} target="_blank" rel="noopener noreferrer" className="text-[11.5px] font-medium" style={{ color: C.sage }}>Open your storefront →</a>
                    </div>
                  )}
                  {!settings.storefrontEnabled && (
                    <div className="text-[10.5px] mt-3" style={{ color: C.inkFaint }}>Toggle on and save to get your shareable link.</div>
                  )}
                </div>
              </div>
            )}
            {settingsPage === 'messages' && (
              <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="px-4 pb-5 pt-1">
                  <div className="mt-3">
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
                </div>
              </div>
            )}
            {settingsPage === 'shops' && (
              <div className="space-y-4">
                <div className="text-[12.5px] leading-relaxed px-1" style={{ color: C.inkDim }}>Running more than one location? Add each shop here. Everything you record is kept per shop, and the switcher at the top lets you see one shop or all of them together.</div>
                <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  {locations.map((s, i) => {
                    const isWarehouse = s.kind === 'warehouse';
                    const edit = shopEdits[s.id] || {};
                    const changed = (edit.name !== undefined && edit.name !== s.name) || (edit.address !== undefined && edit.address !== (s.address || ''));
                    const staffCount = staffShops.filter((ss) => ss.shop_id === s.id).length;
                    return (
                      <div key={s.id} className="px-4 py-4 space-y-2" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                        <div className="flex items-center gap-2">
                          {isWarehouse ? <Warehouse size={15} style={{ color: C.copper }} /> : <Store size={15} style={{ color: C.copper }} />}
                          <input aria-label="Shop name" value={edit.name ?? s.name} onChange={(e) => setShopEdits((p) => ({ ...p, [s.id]: { ...edit, name: e.target.value } }))} className="flex-1 min-w-0 bg-transparent text-[14.5px] font-semibold outline-none rounded-lg px-2 py-1" style={{ border: `1px solid ${changed ? C.copper : 'transparent'}` }} />
                          {s.id === mainShopId && <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold shrink-0" style={{ background: C.surfaceRaised, color: C.inkDim }}>MAIN</span>}
                          {isWarehouse && <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold shrink-0" style={{ background: C.copperSoft, color: C.copper }}>WAREHOUSE</span>}
                        </div>
                        <input aria-label="Shop address" placeholder="Address (optional)" value={edit.address ?? (s.address || '')} onChange={(e) => setShopEdits((p) => ({ ...p, [s.id]: { ...edit, address: e.target.value } }))} className="w-full rounded-xl px-3 py-2 text-[12.5px] outline-none" style={field} />
                        <div className="flex items-center justify-between">
                          <span className="text-[11px]" style={{ color: C.inkFaint }}>{isPausedLocation(s.id) ? 'Paused on your plan — records kept, no new sales' : isWarehouse ? 'Storage only — holds stock, never sells' : `${staffCount} staff assigned`}</span>
                          <span className="flex items-center gap-3">
                            {s.id !== mainShopId && !changed && <button onClick={() => closeLocation(s)} className="text-[11.5px] font-medium" style={{ color: C.rust }}>Close location</button>}
                            {changed && <button onClick={() => saveShop(s)} className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: C.copper, color: C.bg }}>Save</button>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {closedLocations.length > 0 && (
                  <div>
                    <div className="text-[11.5px] font-semibold uppercase tracking-wide px-1 mb-2" style={{ color: C.inkFaint }}>Closed locations</div>
                    <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                      {closedLocations.map((s, i) => (
                        <div key={s.id} className="flex items-center justify-between px-4 py-3" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                          <span className="text-[13px]" style={{ color: C.inkDim }}>{s.name}<span className="text-[11px]" style={{ color: C.inkFaint }}> · history kept</span></span>
                          <button onClick={() => reopenLocation(s)} className="text-[12px] font-medium" style={{ color: C.sage }}>Reopen</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  <div className="text-[13.5px] font-semibold mb-2.5">Add a location</div>
                  <div className="flex gap-1 p-1 mb-2 rounded-xl" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                    {[['shop', 'Shop'], ['warehouse', 'Warehouse']].map(([k, l]) => (
                      <button key={k} onClick={() => setNewShopKind(k)} className="flex-1 py-2 rounded-lg text-[12.5px] font-semibold" style={newShopKind === k ? { background: C.copper, color: C.bg } : { color: C.inkDim }}>{l}</button>
                    ))}
                  </div>
                  <div className="text-[11.5px] mb-3" style={{ color: C.inkFaint }}>{newShopKind === 'warehouse' ? 'A warehouse stores stock and sends it to your shops. It never sells, and customers never see it.' : 'A shop sells to customers, can have staff, and appears on your storefront.'}</div>
                  <div className="flex gap-2">
                    <input placeholder={newShopKind === 'warehouse' ? 'e.g. Main warehouse, Lagos' : 'e.g. Ariaria branch'} value={newShopName} onChange={(e) => setNewShopName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addShop()} className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                    <button onClick={addShop} disabled={!newShopName.trim() || shopBusy} className="px-4 rounded-xl text-[13px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: !newShopName.trim() || shopBusy ? 0.5 : 1 }}>{shopBusy ? 'Adding…' : 'Add'}</button>
                  </div>
                  <div className="text-[11px] mt-2" style={{ color: C.inkFaint }}>Locations save instantly. For shops, choose which staff work there under Staff & join code.</div>
                </div>
              </div>
            )}
            {settingsPage === 'automation' && (
              <div className="space-y-4">
                {planKnown && effPlan === 'free' && (
                  <div className="rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3" style={{ background: C.copperSoft, border: '1px solid rgba(255,176,32,0.25)' }}>
                    <span className="text-[12.5px]" style={{ color: C.ink }}>Automatic WhatsApp is part of <strong>Pro</strong> and <strong>Business</strong>.</span>
                    <button onClick={openPlanPage} className="shrink-0 px-3.5 py-2 rounded-xl text-[12px] font-semibold" style={{ background: C.copper, color: C.bg }}>See plans</button>
                  </div>
                )}
                <div className="rounded-2xl px-4 py-3.5 flex items-start gap-3" style={{ background: waConnected ? C.sageSoft : C.surfaceRaised, border: `1px solid ${C.line}` }}>
                  <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: waConnected === null ? C.inkFaint : waConnected ? C.sage : C.copper }} />
                  <div className="text-[12.5px] leading-relaxed" style={{ color: C.inkDim }}>
                    {waConnected === null ? 'Checking connection…' : waConnected
                      ? <><strong style={{ color: C.ink }}>Connected.</strong> Xorla sends automatic messages every morning at 9am.</>
                      : <><strong style={{ color: C.ink }}>Being connected.</strong> Choose your settings now; messages start automatically as soon as Xorla's WhatsApp line is live.</>}
                  </div>
                </div>

                <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  <button onClick={() => setDraft({ ...draft, autoReminders: !draft.autoReminders })} role="switch" aria-checked={draft.autoReminders} className="w-full flex items-start gap-3 px-4 py-4 text-left">
                    <div className="flex-1">
                      <div className="text-[14.5px] font-semibold mb-1">Automatic payment reminders</div>
                      <div className="text-[12px] leading-relaxed" style={{ color: C.inkFaint }}>Customers with an overdue balance and a phone number get a polite WhatsApp reminder, at most every 3 days and 3 times in total. After that, Xorla stops and flags them for you to call.</div>
                    </div>
                    <span className="shrink-0 mt-0.5 w-12 h-7 rounded-full relative transition-colors" style={{ background: draft.autoReminders ? C.sage : C.line }}>
                      <span className="absolute top-1 w-5 h-5 rounded-full transition-all" style={{ background: '#fff', left: draft.autoReminders ? '24px' : '4px' }} />
                    </span>
                  </button>
                  <div className="px-4 py-4" style={{ borderTop: `1px solid ${C.line}` }}>
                    <div className="text-[14.5px] font-semibold mb-1">Business summary to your WhatsApp</div>
                    <div className="text-[12px] leading-relaxed mb-3" style={{ color: C.inkFaint }}>Sales, expenses, profit, and money owed to you, sent to {draft.ownerPhone ? formatPhoneDisplay(draft.ownerPhone) : 'your business number'}.</div>
                    <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                      {[['off', 'Off'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([v, l]) => (
                        <button key={v} onClick={() => setDraft({ ...draft, summaryFrequency: v })} className="flex-1 py-2 rounded-lg text-[12.5px] font-semibold" style={draft.summaryFrequency === v ? { background: C.copper, color: C.bg } : { color: C.inkDim }}>{l}</button>
                      ))}
                    </div>
                    <div className="text-[11px] mt-2" style={{ color: C.inkFaint }}>{draft.summaryFrequency === 'weekly' ? 'Every Monday morning, covering the past 7 days.' : draft.summaryFrequency === 'monthly' ? 'On the 1st of each month, covering the month before.' : 'No summaries will be sent.'}</div>
                    {!draft.ownerPhone && draft.summaryFrequency !== 'off' && (
                      <button onClick={() => setSettingsPage('contact')} className="w-full text-left mt-3 rounded-xl px-3.5 py-2.5 text-[12px]" style={{ background: C.rustSoft, color: C.rust }}><strong>Add your WhatsApp number</strong> so summaries can reach you →</button>
                    )}
                  </div>
                </div>

                {waConnected && (
                  <div>
                    <button onClick={sendWhatsAppTest} disabled={waTesting} className="w-full rounded-xl py-3 text-[13px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.ink, opacity: waTesting ? 0.6 : 1 }}>{waTesting ? 'Sending…' : 'Send me a test summary now'}</button>
                    {waNotice && <div className="text-[12px] mt-2 font-medium" style={{ color: waNotice.ok ? C.sage : C.rust }}>{waNotice.ok ? '✓ ' : ''}{waNotice.text}</div>}
                  </div>
                )}

                <div className="text-[11.5px] leading-relaxed px-1" style={{ color: C.inkFaint }}>
                  Automatic messages use a standard English wording approved by WhatsApp. For a personal message in Pidgin, Yoruba, Igbo, or Hausa, use the WhatsApp button on any invoice.
                </div>

                <div>
                    <div className="text-[11.5px] font-semibold uppercase tracking-wide px-1 mb-2" style={{ color: C.inkFaint }}>Recent automatic messages</div>
                    <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                      {waLog.length === 0 && (
                        <div className="px-4 py-5 text-center text-[12.5px] leading-relaxed" style={{ color: C.inkFaint }}>No automatic messages yet. Every reminder and summary Xorla sends will be listed here, marked Sent or Failed.</div>
                      )}
                      {waLog.map((m, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 px-4 py-3" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium">{m.kind === 'reminder' ? 'Payment reminder' : m.kind === 'summary' ? 'Business summary' : 'Test summary'}</div>
                            <div className="text-[11px] truncate" style={{ color: C.inkFaint }}>{formatPhoneDisplay(m.to_phone)} · {new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold" title={m.error || ''} style={{ color: m.status === 'sent' ? C.sage : C.rust }}>{m.status === 'sent' ? 'Sent' : 'Failed'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
              </div>
            )}
            {settingsPage === 'plan' && renderPlanPage()}
            {settingsPage === 'notifications' && (
              <div className="space-y-4">
                <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  <div className="text-[14.5px] font-semibold mb-1">Notifications on this {DEVICE_WORD}</div>
                  <div className="text-[12px] leading-relaxed mb-4" style={{ color: C.inkFaint }}>Only the things worth interrupting you for. Each phone or computer is turned on separately — this only turns them on for the {DEVICE_WORD} you're using now.</div>
                  {renderPushControl(false)}
                </div>
                <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  <div className="text-[12px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: C.inkFaint }}>What you'll get</div>
                  <div className="space-y-2 text-[12.5px]" style={{ color: C.inkDim }}>
                    {(isOwnerRole ? [
                      ['New storefront orders', 'the moment they come in'],
                      ['Stock requests', 'when a shop asks for more'],
                      ['Overdue invoices', 'one summary each morning, not a buzz for each'],
                    ] : [
                      ['Stock on its way', 'when stock is sent to your shop'],
                      ['Your stock requests', 'when they are approved or declined'],
                    ]).map(([a, b]) => (
                      <div key={a} className="flex items-start gap-2.5"><Check size={14} className="shrink-0 mt-0.5" style={{ color: C.sage }} /><span><strong style={{ color: C.ink }}>{a}</strong> — {b}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {settingsPage === 'businessType' && (
              <div>
                <div className="text-[12.5px] mb-4 px-1" style={{ color: C.inkDim }}>This changes the words and tools Xorla shows you. Your existing records aren't affected.</div>
                {renderBusinessTypeChoices(draft.businessType || 'products', (id) => setDraft({ ...draft, businessType: id }))}
              </div>
            )}
            {settingsPage === 'contact' && (
              <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="px-4 pb-5 pt-1">
                  <div className="mt-3">
                    <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>BUSINESS WHATSAPP NUMBER</div>
                    <input type="tel" inputMode="tel" placeholder="e.g. 0803 123 4567" value={draft.ownerPhone} onChange={(e) => setDraft({ ...draft, ownerPhone: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                    {draft.ownerPhone && toWhatsAppNumber(draft.ownerPhone).length >= 12 && (
                      <div className="text-[11.5px] mt-1.5 font-medium" style={{ color: C.sage }}>✓ Customers will reach you on {formatPhoneDisplay(draft.ownerPhone)}</div>
                    )}
                    {draft.ownerPhone && toWhatsAppNumber(draft.ownerPhone).length < 12 && (
                      <div className="text-[11.5px] mt-1.5 font-medium" style={{ color: C.rust }}>This number looks too short — check it's complete.</div>
                    )}
                    <div className="text-[11px] mt-1.5" style={{ color: C.inkFaint }}>Storefront orders are sent here on WhatsApp, and so are your business summaries. Local format like 0803… is fine.</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>BUSINESS EMAIL (OPTIONAL)</div>
                    <input type="email" placeholder="hello@yourbusiness.com" value={draft.businessEmail} onChange={(e) => setDraft({ ...draft, businessEmail: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium mb-2" style={{ color: C.inkDim }}>BUSINESS ADDRESS (OPTIONAL)</div>
                    <textarea placeholder="Shop address, street, city" value={draft.businessAddress} onChange={(e) => setDraft({ ...draft, businessAddress: e.target.value })} rows={2} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none" style={field} />
                    <div className="text-[11px] mt-1.5" style={{ color: C.inkFaint }}>Shows on your invoice PDFs.</div>
                  </div>
                </div>
              </div>
            )}
            {settingsPage === 'team' && (
              <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="px-4 pb-5 pt-1">
                  <div className="text-[11px] mb-2 mt-3" style={{ color: C.inkFaint }}>Share this code with staff — they enter it once to join your business for good.</div>
                  <div className="flex items-center justify-between rounded-xl px-3.5 py-3 mb-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                    <span className="cx-mono text-[16px] font-bold tracking-[0.1em]" style={{ color: C.sage }}>{settings.businessCode}</span>
                    <button onClick={() => navigator.clipboard?.writeText(settings.businessCode)} className="text-[11px] font-medium" style={{ color: C.copper }}>Copy</button>
                  </div>
                  {staffOverBy > 0 && (
                    <div className="rounded-xl px-3.5 py-2.5 mb-3 text-[12px] leading-relaxed" style={{ background: C.rustSoft, color: C.ink }}>
                      Your plan includes {planCaps.staff} staff place{planCaps.staff !== 1 ? 's' : ''}, and you have {settings.staffList.length}. The {staffOverBy} who joined most recently {staffOverBy !== 1 ? 'are' : 'is'} paused until you upgrade or remove someone.{' '}
                      <button onClick={openPlanPage} className="font-semibold underline" style={{ color: C.copper }}>See plans</button>
                    </div>
                  )}
                  {settings.staffList.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {settings.staffList.map((s) => (
                        <div key={s.id} className="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-full text-[12.5px]" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}>
                          {s.name}
                          <button onClick={() => removeStaff(s.id, s.name)} className="text-[11px] font-semibold ml-1 pl-2" style={{ color: C.rust, borderLeft: `1px solid ${C.line}` }}>Remove</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11.5px]" style={{ color: C.inkFaint }}>No staff have joined yet.</div>
                  )}
                  
                </div>
              </div>
            )}
            {settingsPage === 'team' && shops.length > 1 && settings.staffList.length > 0 && (
              <div className="mt-4">
                <div className="text-[11.5px] font-semibold uppercase tracking-wide px-1 mb-2" style={{ color: C.inkFaint }}>Which shops each person works in</div>
                <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  {settings.staffList.map((st, i) => (
                    <div key={st.id} className="px-4 py-3.5" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                      <div className="text-[13.5px] font-semibold mb-2">{st.name}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {shops.map((s) => {
                          const on = staffShops.some((ss) => ss.profile_id === st.id && ss.shop_id === s.id);
                          return <button key={s.id} onClick={() => toggleStaffShop(st.id, s.id)} aria-pressed={on} className="px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-1" style={on ? { background: C.sage, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{on && <Check size={12} />}{s.name}</button>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] mt-2 px-1" style={{ color: C.inkFaint }}>Staff only see and record for the shops they're in. Changes save instantly.</div>
              </div>
            )}
            {settingsPage === 'security' && (
              <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="px-4 pb-5 pt-1">
                  <div className="flex items-center gap-3 mt-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: settings.pin ? C.sageSoft : C.surfaceRaised }}>
                      <Lock size={18} style={{ color: settings.pin ? C.sage : C.inkFaint }} />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold">{settings.pin ? 'PIN lock is on' : 'PIN lock is off'}</div>
                      <div className="text-[12px]" style={{ color: C.inkFaint }}>{settings.pin ? 'Xorla asks for your PIN whenever it\'s reopened on this phone.' : 'Anyone who picks up this phone can open Xorla.'}</div>
                    </div>
                  </div>
                  <div className="text-[11.5px] mb-4 leading-relaxed" style={{ color: C.inkFaint }}>
                    A quick lock so a staff member or customer holding your phone can't see your sales and money owed. It's separate from your password, belongs to your account only, and lives on this phone.
                  </div>
                  {settings.pin ? (
                    <div className="flex gap-2">
                      <button onClick={() => setPinFlow('change')} className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold" style={{ background: C.copper, color: C.bg }}>Change PIN</button>
                      <button onClick={() => setPinFlow('remove')} className="flex-1 rounded-xl py-2.5 text-[13px] font-medium" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}>Turn off</button>
                    </div>
                  ) : (
                    <button onClick={() => setPinFlow('set')} className="w-full rounded-xl py-2.5 text-[13px] font-semibold" style={{ background: C.copper, color: C.bg }}>Set up PIN</button>
                  )}
                  {pinNotice && <div className="text-[12px] mt-3 font-medium" style={{ color: C.sage }}>✓ {pinNotice}</div>}
                </div>
              </div>
            )}
          </div>

          {settingsDirty ? (
            <div className="sticky bottom-0 flex items-center gap-2.5 px-4 py-3.5 xorla-fade-up" style={{ background: C.surface, borderTop: `1px solid ${C.line}`, paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
              <span className="flex-1 text-[12.5px] font-medium" style={{ color: C.inkDim }}>Unsaved changes</span>
              <button onClick={() => setDraft({ ...settings })} className="px-4 py-2.5 rounded-xl text-[13px] font-medium" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}>Discard</button>
              <button onClick={saveSettingsDraft} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold" style={{ background: C.sage, color: C.bg }}>Save changes</button>
            </div>
          ) : saveNotice ? (
            <div className="sticky bottom-0 flex items-center justify-center gap-2 px-4 py-3.5 text-[13px] font-medium xorla-fade-up" style={{ background: C.sageSoft, color: C.sage, paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
              <Check size={16} /> {saveNotice}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex cx-body relative overflow-x-clip" style={{ background: `radial-gradient(circle at 15% 0%, ${C.surface} 0%, ${C.bg} 45%)`, color: C.ink }}>
      {fontStyle}
      <div className="xorla-orb" style={{ width: 500, height: 500, top: '-15%', left: '20%', background: C.sage, opacity: 0.06, position: 'fixed' }} />

      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen px-5 py-6 z-20" style={{ borderRight: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2.5 mb-9 px-1">
          <div style={{ filter: `drop-shadow(0 0 12px ${C.sageSoft})` }}><XorlaMark size={30} /></div>
          <div className="cx-display text-[19px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>Xorla</div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        <nav className="space-y-1 mb-6">
          {[
            { id: 'overview', label: 'Overview', Icon: Home },
            { id: 'sales', label: T.salesTab, Icon: ShoppingBag },
            { id: 'products', label: T.catalog, Icon: Package },
            { id: 'orders', label: 'Orders', Icon: Download },
            { id: 'expenses', label: 'Expenses', Icon: Receipt },
            { id: 'invoices', label: 'Invoices', Icon: Wallet },
            { id: 'advisor', label: 'Oga', Icon: Lightbulb },
          ].map(({ id, label, Icon }) => (
            <button key={id} data-tour={`nav-${id}`} onClick={() => setTab(id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-medium" style={tab === id ? { background: C.sageSoft, color: C.sage } : { color: C.inkDim }}>
              <Icon size={16} /> {label}
              {id === 'invoices' && needsAttention.length > 0 && (
                <span title="Need action now" className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: C.rust, color: C.bg }}>{needsAttention.length}</span>
              )}
              {id === 'invoices' && needsAttention.length === 0 && unpaidInvoiceCount > 0 && (
                <span title="Unpaid invoices" className="ml-auto min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ border: `1.5px solid ${C.copper}`, color: C.copper }}>{unpaidInvoiceCount}</span>
              )}
              {id === 'products' && products.filter((p) => p.isLow).length > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: C.rust, color: C.bg }}>{products.filter((p) => p.isLow).length}</span>
              )}
              {id === 'orders' && orders.filter((o) => o.status === 'pending').length > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: C.copper, color: C.bg }}>{orders.filter((o) => o.status === 'pending').length}</span>
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
        </div>

        <div className="pt-3 space-y-1 shrink-0" style={{ borderTop: `1px solid ${C.line}` }}>
          {settings.pin && (
            <button onClick={() => setLocked(true)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium" style={{ color: C.inkFaint }}><Lock size={15} /> Lock app</button>
          )}
          <button data-tour="settings" onClick={() => { setDraft({ ...settings }); setSettingsPage(null); setPreviousTab(tab); setTab('settings'); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium" style={{ color: tab === 'settings' ? C.copper : C.inkDim }}><Settings size={15} /> Settings</button>
          <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium" style={{ color: C.inkFaint }}><LogOut size={15} /> Log out</button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 relative z-10">

        {/* Mobile brand bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-5 pb-3" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', background: 'rgba(10,31,28,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2">
            <XorlaMark size={26} />
            <span className="cx-display text-[17px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>Xorla</span>
          </div>
          <div className="flex items-center gap-4">
            {renderBell('sm:hidden')}
            {settings.pin && <button onClick={() => setLocked(true)} style={{ color: C.inkFaint }}><Lock size={16} /></button>}
            <button data-tour="settings" onClick={() => { setDraft({ ...settings }); setSettingsPage(null); setPreviousTab(tab); setTab('settings'); }} style={{ color: tab === 'settings' ? C.copper : C.inkDim }}><Settings size={18} /></button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 lg:py-8 pb-28 lg:pb-24">
          {renderShopSwitcher()}
          {activeShopId && isPausedLocation(activeShopId) && (
            <div className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3" style={{ background: C.rustSoft, border: '1px solid rgba(226,98,75,0.3)' }}>
              <span className="text-[12.5px] leading-relaxed" style={{ color: C.ink }}><strong>{shopNameOf(activeShopId)} is paused on your plan.</strong> You can see its records, but new sales can't be recorded here.</span>
              {isOwnerRole && <button onClick={openPlanPage} className="shrink-0 px-3.5 py-2 rounded-xl text-[12px] font-semibold" style={{ background: C.copper, color: C.bg }}>See plans</button>}
            </div>
          )}

          {/* Top bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="hidden lg:block text-[17px] font-semibold cx-display capitalize mr-auto">
              {tab === 'overview' ? `Welcome back${settings.businessName ? ', ' + settings.businessName : ''}` : tab}
            </div>
            <div className="relative flex-1 lg:flex-none lg:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.inkFaint }} />
              <input type="text" placeholder={`Search customers, ${T.catalog.toLowerCase()}, sales…`} aria-label="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setSearchQuery('')} className="w-full rounded-xl pl-9 pr-8 py-2 text-[12.5px] outline-none" style={field} />
              {searchQuery && <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: C.inkFaint }}><X size={14} /></button>}
              {searchQuery.trim() && tab !== 'invoices' && (() => {
                const q = searchQuery.trim().toLowerCase();
                const inv = invoices.filter((i) => i.clientName.toLowerCase().includes(q) || String(i.invoiceNo).toLowerCase().includes(q)).slice(0, 4);
                const prods = products.filter((p) => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)).slice(0, 4);
                const sls = salesAll.filter((s) => s.item.toLowerCase().includes(q) || (s.loggedBy || '').toLowerCase().includes(q)).slice(0, 4);
                const none = !inv.length && !prods.length && !sls.length;
                const head = (t) => <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>{t}</div>;
                const row = (key, main, sub, onClick) => (
                  <button key={key} onClick={onClick} className="w-full text-left px-3 py-2 flex items-center justify-between gap-3 hover:opacity-80">
                    <span className="min-w-0 truncate text-[12.5px]" style={{ color: C.ink }}>{main}</span>
                    <span className="shrink-0 text-[11px]" style={{ color: C.inkFaint }}>{sub}</span>
                  </button>
                );
                return (
                  <div className="absolute left-0 right-0 lg:left-auto lg:w-[360px] top-full mt-2 z-40 rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto" style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: '0 16px 40px rgba(0,0,0,0.45)' }}>
                    {none && <div className="px-4 py-5 text-[12.5px] text-center" style={{ color: C.inkFaint }}>Nothing matches "{searchQuery.trim()}"</div>}
                    {inv.length > 0 && <>{head('Invoices')}{inv.map((i) => row(i.id, i.clientName, `#${i.invoiceNo} · ${fmt(Math.max(0, Number(i.amount) - Number(i.paidAmount || 0)))}`, () => setTab('invoices')))}</>}
                    {prods.length > 0 && <>{head(T.catalog)}{prods.map((p) => row(p.id, p.name, fmt(p.sellingPrice), () => { setSearchQuery(''); setTab('products'); }))}</>}
                    {sls.length > 0 && <>{head(`Recent ${T.salesTab.toLowerCase()}`)}{sls.map((s) => row(s.id, s.item, `${fmt(s.amount)} · ${new Date(s.soldAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, () => { setSearchQuery(''); setViewDate(s.dateKey); setTab('sales'); }))}</>}
                  </div>
                );
              })()}
            </div>
            {settings.staffList.length > 0 && <div className="hidden md:flex">{renderTeamPresence(true)}</div>}
            <span className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center shrink-0" style={{ border: `1px solid ${notifOpen ? C.copper : C.line}` }}>{renderBell()}</span>
            <button
              onClick={() => { if (tab === 'expenses') setShowExpenseForm(true); else if (tab === 'invoices') setShowForm(true); else { setTab('sales'); setShowSaleForm(true); } }}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold shrink-0" style={{ background: C.sage, color: C.bg }}>
              <Plus size={14} /> New
            </button>
          </div>

          {/* Team presence (owner only) */}
          {settings.staffList.length > 0 && <div className="md:hidden mb-4">{renderTeamPresence(false)}</div>}
          <div className="lg:hidden text-[11px] mb-6 mt-3" style={{ color: C.inkFaint }}>Sold something? Use Sales. Billing without a sale now? Use Invoices.</div>

          {/* ============ OVERVIEW TAB ============ */}
          {tab === 'overview' && (
            <>
              {isOwnerRole && pendingRequests.length > 0 && (
                <button onClick={() => setTab('products')} className="w-full flex items-center justify-between rounded-2xl p-4 mb-5 xorla-fade-up text-left" style={{ background: C.copperSoft, border: '1px solid rgba(255,176,32,0.25)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.copper }}><PackagePlus size={18} style={{ color: C.bg }} /></div>
                    <div>
                      <div className="text-[13.5px] font-semibold cx-display">{pendingRequests.length} stock request{pendingRequests.length !== 1 ? 's' : ''} from your shops</div>
                      <div className="text-[11.5px]" style={{ color: C.inkDim }}>Tap to approve or decline</div>
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: C.copper }} />
                </button>
              )}
              {orders.filter((o) => o.status === 'pending').length > 0 && (
                <button onClick={() => setTab('orders')} className="w-full flex items-center justify-between rounded-2xl p-4 mb-5 xorla-fade-up text-left" style={{ background: C.sageSoft, border: `1px solid rgba(44,235,214,0.25)` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.sage }}>
                      <ShoppingBag size={18} style={{ color: C.bg }} />
                    </div>
                    <div>
                      <div className="text-[13.5px] font-semibold cx-display">{pendingOrderCount} new {T.order}{pendingOrderCount !== 1 ? 's' : ''} from your storefront</div>
                      <div className="text-[11.5px]" style={{ color: C.inkDim }}>Tap to review and fulfill</div>
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: C.sage }} />
                </button>
              )}
              {isOwnerRole && planKnown && !planBannerHidden && (() => {
                const s = subscription;
                let b = null;
                if (onTrial && planDaysLeft <= 7) b = { tone: 'copper', title: `Your Pro trial ends in ${planDaysLeft} day${planDaysLeft !== 1 ? 's' : ''}`, body: 'Choose a plan to keep staff, Oga and more. Nothing is lost either way.', cta: 'See plans' };
                else if (effPlan !== 'free' && !s.auto_renew && planDaysLeft !== null && planDaysLeft <= 3) b = { tone: 'copper', title: `Your ${PLAN_INFO[effPlan].name} plan ends in ${planDaysLeft} day${planDaysLeft !== 1 ? 's' : ''}`, body: 'Renew in a tap with card, transfer or USSD.', cta: 'Renew' };
                else if (s.status === 'expired' && effPlan === 'free') b = { tone: 'neutral', title: "You're on the Free plan", body: 'Your plan ended, but everything you recorded is still here. Upgrade anytime to unlock staff, Oga and more.', cta: 'See plans' };
                if (!b) return null;
                return (
                  <div className="rounded-2xl p-4 mb-5 flex items-start gap-3 xorla-fade-up" style={{ background: b.tone === 'copper' ? C.copperSoft : C.surfaceRaised, border: `1px solid ${b.tone === 'copper' ? 'rgba(255,176,32,0.25)' : C.line}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: b.tone === 'copper' ? C.copper : C.surface }}><Sparkles size={18} style={{ color: b.tone === 'copper' ? C.bg : C.copper }} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold cx-display">{b.title}</div>
                      <div className="text-[12px] leading-relaxed mb-3" style={{ color: C.inkDim }}>{b.body}</div>
                      <button onClick={openPlanPage} className="px-4 py-2 rounded-xl text-[12.5px] font-semibold" style={{ background: C.copper, color: C.bg }}>{b.cta}</button>
                    </div>
                    <button onClick={() => setPlanBannerHidden(true)} aria-label="Dismiss" className="shrink-0" style={{ color: C.inkFaint }}><X size={16} /></button>
                  </div>
                );
              })()}
              {showLangIntro && tourStep === null && (
                <div className="rounded-2xl p-4 mb-5 flex items-start gap-3 xorla-fade-up" style={{ background: `linear-gradient(135deg, ${C.copperSoft}, ${C.surface})`, border: '1px solid rgba(255,176,32,0.25)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.copper }}><Globe size={18} style={{ color: C.bg }} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold" style={{ background: C.copper, color: C.bg }}>NEW</span>
                      <span className="text-[13.5px] font-semibold cx-display">Oga now speaks your language</span>
                    </div>
                    <div className="text-[12px] leading-relaxed mb-3" style={{ color: C.inkDim }}>Ask Oga for advice, and send reminders to customers, in English, Pidgin, Yoruba, Igbo, or Hausa.</div>
                    <button onClick={() => { dismissLangIntro(); setPreviousTab(tab); setTab('advisor'); }} className="px-4 py-2 rounded-xl text-[12.5px] font-semibold" style={{ background: C.copper, color: C.bg }}>Choose my language</button>
                  </div>
                  <button onClick={dismissLangIntro} aria-label="Dismiss" className="shrink-0" style={{ color: C.inkFaint }}><X size={16} /></button>
                </div>
              )}
              {viewAllShops && shops.length > 1 && (() => {
                const rows = shops.map((s) => {
                  const list = salesAll.filter((x) => (x.shopId || mainShopId) === s.id && x.dateKey === todayKey());
                  return { shop: s, total: list.reduce((a, x) => a + Number(x.amount), 0), count: list.length };
                });
                const top = Math.max(1, ...rows.map((r) => r.total));
                return (
                  <div className="rounded-2xl p-5 mb-5 xorla-fade-up" style={card}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-[13.5px] font-semibold cx-display">Today by shop</div>
                      <div className="text-[11px]" style={{ color: C.inkFaint }}>Tap a shop to see just that shop</div>
                    </div>
                    <div className="space-y-3">
                      {rows.map((r) => (
                        <button key={r.shop.id} onClick={() => setCurrentShopId(r.shop.id)} className="w-full text-left">
                          <div className="flex items-center justify-between text-[13px] mb-1.5">
                            <span className="font-medium">{r.shop.name}</span>
                            <span className="cx-mono font-semibold">{fmt(r.total)} <span className="text-[11px] font-normal" style={{ color: C.inkFaint }}>· {r.count} {r.count === 1 ? T.sale : `${T.sale}s`}</span></span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.surfaceRaised }}>
                            <div className="h-full rounded-full" style={{ width: `${(r.total / top) * 100}%`, background: C.sage, transition: 'width 0.5s' }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {showInstallBanner && (
                <div className="rounded-2xl p-4 mb-5 xorla-fade-up" style={{ background: `linear-gradient(135deg, ${C.copperSoft}, ${C.surface})`, border: `1px solid rgba(255,176,32,0.25)` }}>
                  {!showIOSSteps ? (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.copper }}>
                        <Download size={18} style={{ color: C.bg }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold cx-display mb-0.5">Add Xorla to your home screen</div>
                        <div className="text-[11.5px] leading-relaxed mb-3" style={{ color: C.inkDim }}>Opens instantly, no browser tabs or typing the address again — feels like a real app.</div>
                        <div className="flex gap-2">
                          <button onClick={handleInstallClick} className="px-4 py-2 rounded-xl text-[12.5px] font-semibold" style={{ background: C.copper, color: C.bg }}>{isIOS ? 'How to add' : 'Install now'}</button>
                          <button onClick={dismissInstallBanner} className="px-3 py-2 rounded-xl text-[12.5px] font-medium" style={{ color: C.inkFaint }}>Not now</button>
                        </div>
                      </div>
                      <button onClick={dismissInstallBanner} className="shrink-0" style={{ color: C.inkFaint }}><X size={16} /></button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[13.5px] font-semibold cx-display">Add to your home screen</div>
                        <button onClick={dismissInstallBanner} style={{ color: C.inkFaint }}><X size={16} /></button>
                      </div>
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 text-[12.5px]" style={{ color: C.inkDim }}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold" style={{ background: C.copperSoft, color: C.copper }}>1</div>
                          <span>Tap the <Share size={13} className="inline mx-1" style={{ color: C.copper }} /> Share icon at the bottom of Safari</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-[12.5px]" style={{ color: C.inkDim }}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold" style={{ background: C.copperSoft, color: C.copper }}>2</div>
                          <span>Scroll down and tap <strong style={{ color: C.ink }}>"Add to Home Screen"</strong> <SquarePlus size={13} className="inline ml-1" style={{ color: C.copper }} /></span>
                        </div>
                        <div className="flex items-center gap-2.5 text-[12.5px]" style={{ color: C.inkDim }}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold" style={{ background: C.copperSoft, color: C.copper }}>3</div>
                          <span>Tap <strong style={{ color: C.ink }}>"Add"</strong> in the top corner — done!</span>
                        </div>
                      </div>
                      <button onClick={dismissInstallBanner} className="w-full mt-3.5 py-2 rounded-xl text-[12.5px] font-medium" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>Got it</button>
                    </div>
                  )}
                </div>
              )}

              <div className="lg:grid lg:grid-cols-5 lg:gap-5 mb-5 xorla-fade-up">
                <div data-tour="profit" className="lg:col-span-3 rounded-2xl p-5 mb-4 lg:mb-0" style={card}>
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
                  <div className="text-[13.5px] font-semibold cx-display mb-3">Quick add {T.sale}</div>
                  {viewAllShops && shops.length > 1 && <div className="mb-3">{renderRecordShopPicker()}</div>}
                  <div className="space-y-2.5">
                    {products.length > 0 && (
                      <div className="flex gap-2">
                        <BrandSelect value={saleForm.productId} onChange={(e) => applyProductToSale(e.target.value, saleForm.quantity)} className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm outline-none" style={{ ...field, colorScheme: 'dark' }}>
                          <option value="">Pick {T.Item === 'Item' ? 'an' : 'a'} {T.item}…</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.sellingPrice)}</option>)}
                        </BrandSelect>
                        {saleForm.productId && (
                          <div>
                            <div className="text-[8.5px] font-semibold text-center mb-1" style={{ color: C.inkFaint }}>QTY</div>
                            <input type="number" min="1" value={saleForm.quantity} onChange={(e) => applyProductToSale(saleForm.productId, e.target.value)} className="w-14 rounded-xl px-2 py-2.5 text-sm text-center outline-none cx-mono" style={field} />
                          </div>
                        )}
                      </div>
                    )}
                    <input type="text" placeholder={T.soldPrompt} value={saleForm.item} onChange={(e) => setSaleForm({ ...saleForm, item: e.target.value, productId: '' })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                    <div className="flex gap-2">
                      <input type="text" inputMode="decimal" placeholder={T.amountPh} value={formatNumInput(saleForm.amount)} onChange={(e) => setSaleForm({ ...saleForm, amount: parseNumInput(e.target.value) })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                      <input type="text" inputMode="decimal" placeholder={T.costPh} value={formatNumInput(saleForm.cost)} onChange={(e) => setSaleForm({ ...saleForm, cost: parseNumInput(e.target.value) })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                    </div>
                    <button onClick={addSale} disabled={savingSale} className="w-full rounded-xl py-2.5 text-[13px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingSale ? 0.6 : 1 }}>{savingSale ? "Saving…" : `Save ${T.sale}`}</button>
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
                      <a href={`https://wa.me/${toWhatsAppNumber(settings.ownerPhone)}?text=${encodeURIComponent(summaryText)}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-medium" style={{ background: C.sage, color: C.bg }}>
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
            <div className="lg:hidden flex gap-1 p-1 mb-5 rounded-xl" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
              <button onClick={() => setTab('sales')} className="flex-1 py-2 rounded-lg text-[13px] font-semibold" style={tab === 'sales' ? { background: C.copper, color: C.bg } : { color: C.inkDim }}>{T.salesTab}</button>
              <button onClick={() => setTab('orders')} className="flex-1 py-2 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5" style={tab === 'orders' ? { background: C.copper, color: C.bg } : { color: C.inkDim }}>
                {T.orders}
                {pendingOrderCount > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={tab === 'orders' ? { background: C.bg, color: C.copper } : { background: C.copper, color: C.bg }}>{pendingOrderCount}</span>}
              </button>
            </div>
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
                  {settings.staffList.map((s) => {
                    const total = todaySales.filter((sale) => sale.loggedBy === s.name).reduce((a, sale) => a + Number(sale.amount), 0);
                    const count = todaySales.filter((sale) => sale.loggedBy === s.name).length;
                    if (count === 0) return null;
                    return (
                      <div key={s.id} className="flex items-center justify-between text-[12.5px]">
                        <span style={{ color: C.inkDim }}>{s.name} · {count} sale{count !== 1 ? 's' : ''}</span>
                        <span className="cx-mono font-medium">{fmt(total)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!showSaleForm ? (
              <button onClick={() => setShowSaleForm(true)} className="w-full mb-6 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold" style={{ background: C.copper, color: C.bg }}><Plus size={16} /> Add {T.sale}</button>
            ) : (
              <div className="rounded-2xl p-5 mb-6 space-y-3" style={card}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[14px] font-semibold cx-display">New sale</div>
                  <button onClick={() => setShowSaleForm(false)} style={{ color: C.inkFaint }}><X size={17} /></button>
                </div>
                {renderRecordShopPicker()}
                <button onClick={() => setCartMode(!cartMode)} className="flex items-center gap-1.5 text-[12px] font-medium py-1" style={{ color: C.copper }}>
                  {cartMode ? '− Just one item instead' : '+ Customer buying several different things?'}
                </button>

                {!cartMode && (
                  <>
                    {products.length > 0 && (
                      <div className="rounded-xl p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                        <div className="text-[10.5px] font-medium mb-1.5" style={{ color: C.inkDim }}>PICK {T.Item === 'Item' ? 'AN' : 'A'} {T.Item.toUpperCase()} (OPTIONAL)</div>
                        <div className="flex gap-2">
                          <BrandSelect value={saleForm.productId} onChange={(e) => applyProductToSale(e.target.value, saleForm.quantity)} className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none" style={{ ...field, colorScheme: 'dark' }}>
                            <option value="">Choose {T.Item === 'Item' ? 'an' : 'a'} {T.item}…</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.sellingPrice)}</option>)}
                          </BrandSelect>
                          {saleForm.productId && (
                            <div>
                              <div className="text-[9px] font-semibold text-center mb-1" style={{ color: C.inkFaint }}>QTY</div>
                              <input type="number" min="1" value={saleForm.quantity} onChange={(e) => applyProductToSale(saleForm.productId, e.target.value)} className="w-16 rounded-lg px-2 py-2 text-sm text-center outline-none cx-mono" style={field} />
                            </div>
                          )}
                        </div>
                        {saleForm.productId && <div className="text-[10.5px] mt-1.5" style={{ color: C.inkFaint }}>Amount and cost below are auto-filled — still editable if you're giving a discount.</div>}
                      </div>
                    )}
                    <input type="text" placeholder={T.soldPrompt} value={saleForm.item} onChange={(e) => setSaleForm({ ...saleForm, item: e.target.value, productId: '' })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                    <div className="flex gap-2">
                      <input type="text" inputMode="decimal" placeholder={T.amountPh} value={formatNumInput(saleForm.amount)} onChange={(e) => setSaleForm({ ...saleForm, amount: parseNumInput(e.target.value) })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                      <input type="text" inputMode="decimal" placeholder={T.costPh} value={formatNumInput(saleForm.cost)} onChange={(e) => setSaleForm({ ...saleForm, cost: parseNumInput(e.target.value) })} className="w-1/2 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                    </div>
                    <label className="flex items-center gap-2 text-[12.5px] font-medium py-2.5 px-3.5 rounded-xl cursor-pointer" style={{ border: `1px dashed ${C.line}`, color: C.inkDim }}>
                      <Camera size={14} />{photoUploading ? 'Adding photo…' : saleForm.photo ? 'Photo added — tap to change' : 'Add a photo (optional)'}
                      <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
                    </label>
                    {saleForm.photo && <img src={saleForm.photo} alt="Item" className="rounded-xl" style={{ maxHeight: '90px' }} />}
                  </>
                )}

                {cartMode && renderCartEditor()}

                <div className="pt-1">
                  <div className="flex gap-1.5">
                    <button onClick={() => setSaleForm({ ...saleForm, fullyPaid: true })} className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold" style={saleForm.fullyPaid ? { background: C.sage, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>Paid in full</button>
                    <button onClick={() => setSaleForm({ ...saleForm, fullyPaid: false })} className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold" style={!saleForm.fullyPaid ? { background: C.rust, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>Still owes some</button>
                  </div>
                </div>

                {!saleForm.fullyPaid && (
                  <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                    <div className="text-[11px]" style={{ color: C.inkFaint }}>Shows up in Invoices so Xorla can remind them for you.</div>
                    <input type="text" inputMode="decimal" placeholder="How much did they pay now (₦)?" value={formatNumInput(saleForm.paidNow)} onChange={(e) => setSaleForm({ ...saleForm, paidNow: parseNumInput(e.target.value) })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.ink }} />
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
                      <div className="w-1/2">
                        <div className="text-[10.5px] font-medium mb-1" style={{ color: C.inkFaint }}>PHONE</div>
                        <input type="tel" placeholder="For reminder" value={saleForm.customerPhone} onChange={(e) => setSaleForm({ ...saleForm, customerPhone: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.ink }} />
                      </div>
                      <div className="w-1/2">
                        <div className="text-[10.5px] font-medium mb-1" style={{ color: C.inkFaint }}>DUE DATE — when they'll pay</div>
                        <input type="date" value={saleForm.dueDate} onChange={(e) => setSaleForm({ ...saleForm, dueDate: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.ink, colorScheme: 'dark' }} />
                      </div>
                    </div>
                    {(cartMode ? cartItems.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0) : Number(saleForm.amount)) > 0 && (
                      <div className="text-[12.5px] font-medium" style={{ color: C.rust }}>
                        Balance owed: {fmt(Math.max(0, (cartMode ? cartItems.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0) : Number(saleForm.amount)) - Number(saleForm.paidNow || 0)))}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={cartMode ? addCartSale : addSale} disabled={savingSale} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingSale ? 0.6 : 1 }}>{savingSale ? "Saving…" : cartMode ? `Save ${cartItems.length > 1 ? 'items' : 'item'}` : `Save ${T.sale}`}</button>
              </div>
            )}

            <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
              <div className="text-[13px] font-semibold cx-display" style={{ color: C.inkDim }}>{formatViewDate(viewDate)}'s sales</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewDate(shiftDate(viewDate, -1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>‹</button>
                <input type="date" value={viewDate} max={todayKey()} onChange={(e) => e.target.value && setViewDate(e.target.value)} className="rounded-lg px-2 py-1 text-[11.5px] outline-none" style={{ ...field, colorScheme: 'dark' }} />
                {viewDate !== todayKey() && <button onClick={() => setViewDate(todayKey())} className="text-[11px] font-medium" style={{ color: C.sage }}>Today</button>}
                <button onClick={() => setViewDate(shiftDate(viewDate, 1))} disabled={viewDate >= todayKey()} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.line}`, color: viewDate >= todayKey() ? C.inkFaint : C.inkDim, opacity: viewDate >= todayKey() ? 0.4 : 1 }}>›</button>
              </div>
            </div>

            <div className="rounded-2xl p-4 mb-4 flex items-center justify-between" style={card}>
              <div>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.inkFaint }}>Profit, {formatViewDate(viewDate).toLowerCase()}</div>
                <div className="cx-mono text-[22px] font-extrabold" style={{ color: viewedProfit >= 0 ? C.ink : C.rust }}>{fmt(viewedProfit)}</div>
              </div>
              <div className="text-right text-[11px] space-y-0.5" style={{ color: C.inkFaint }}>
                <div>Sales <span className="cx-mono" style={{ color: C.sage }}>{fmt(viewedSalesTotal)}</span></div>
                <div>Expenses <span className="cx-mono" style={{ color: C.rust }}>{fmt(viewedExpensesTotal)}</span></div>
              </div>
            </div>

            {settings.role === 'owner' && sellerOptions.length > 1 && (
              <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
                <span className="text-[11px] font-medium shrink-0 mr-0.5" style={{ color: C.inkFaint }}>Recorded by</span>
                <button onClick={() => setStaffFilter('')} className="px-3 py-1.5 rounded-full text-[12px] font-medium shrink-0" style={!staffFilter ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>Everyone</button>
                {sellerOptions.map((name) => (
                  <button key={name} onClick={() => setStaffFilter(name)} className="px-3 py-1.5 rounded-full text-[12px] font-medium shrink-0" style={staffFilter === name ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>
                    {name === settings.myName ? 'You' : name}{!currentStaffNames.includes(name) && name !== settings.myName ? ' (former)' : ''}
                  </button>
                ))}
              </div>
            )}

            {filteredSales.length > 0 && (
              <div className="text-[11px] mb-2.5" style={{ color: C.inkFaint }}>{fmt(filteredSalesTotal)} total · {filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''}{staffFilter ? ` · ${staffFilter}` : ''}</div>
            )}
            {filteredSales.length === 0 && <div className="text-center text-[13px] py-8 rounded-2xl" style={{ color: C.inkFaint, border: `1px dashed ${C.line}` }}>{staffFilter ? `No sales from ${staffFilter} that day.` : 'No sales logged that day.'}</div>}
            <div>
              {filteredSales.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between py-3" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                  <div className="flex items-center gap-3 min-w-0">
                    {s.photo && <img src={s.photo} alt={s.item} className="w-9 h-9 rounded-lg object-cover shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium truncate">{s.item}</div>
                      <div className="text-[11px] flex items-center gap-1.5" style={{ color: C.inkFaint }}>
                        {s.time}{s.loggedBy && <span>· {s.loggedBy}</span>}{viewAllShops && shops.length > 1 && <span>· {shopNameOf(s.shopId)}</span>}
                        {s.owed > 0 && <span style={{ color: C.rust }}>· {fmt(s.owed)} owed</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="cx-mono text-[13.5px] font-medium">{fmt(s.amount)}</div>
                    <button onClick={() => setReceipt(receiptFromSale(s))} className="text-[11px] font-medium" style={{ color: C.copper }}>Receipt</button>
                    <button onClick={() => removeSale(s.id)} className="text-[11px]" style={{ color: C.inkFaint }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ============ ORDERS TAB ============ */}
        {tab === 'orders' && (
          <>
            <div className="lg:hidden flex gap-1 p-1 mb-5 rounded-xl" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
              <button onClick={() => setTab('sales')} className="flex-1 py-2 rounded-lg text-[13px] font-semibold" style={tab === 'sales' ? { background: C.copper, color: C.bg } : { color: C.inkDim }}>{T.salesTab}</button>
              <button onClick={() => setTab('orders')} className="flex-1 py-2 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5" style={tab === 'orders' ? { background: C.copper, color: C.bg } : { color: C.inkDim }}>
                {T.orders}
                {pendingOrderCount > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={tab === 'orders' ? { background: C.bg, color: C.copper } : { background: C.copper, color: C.bg }}>{pendingOrderCount}</span>}
              </button>
            </div>
            <div className="text-[12px] mb-4" style={{ color: C.inkFaint }}>{T.tracksStock ? 'Orders placed through your storefront land here. Fulfilling one logs it as a real sale and updates your stock automatically.' : 'Service requests from your storefront land here, with the customer\'s preferred time. Marking one done logs it as a job.'}</div>
            {orders.length === 0 && (
              <div className="text-center text-[13px] py-10 rounded-2xl" style={{ color: C.inkFaint, border: `1px dashed ${C.line}` }}>
                {settings.storefrontEnabled ? 'No orders yet — share your storefront link to start getting them.' : 'Turn on your storefront in Settings to start receiving orders here.'}
              </div>
            )}
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="rounded-2xl p-4" style={card}>
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <div className="text-[13.5px] font-semibold">{o.customerName}</div>
                      <div className="text-[11px]" style={{ color: C.inkFaint }}>{viewAllShops && shops.length > 1 && `${shopNameOf(o.shopId)} · `}{o.customerPhone && `${o.customerPhone} · `}{new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at {new Date(o.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <span className="px-2 py-1 rounded-full text-[10.5px] font-semibold shrink-0" style={
                      o.status === 'pending' ? { background: C.copperSoft, color: C.copper } :
                      o.status === 'fulfilled' ? { background: C.sageSoft, color: C.sage } :
                      { background: 'rgba(226,98,75,0.12)', color: C.rust }
                    }>{o.status === 'pending' ? 'New' : o.status === 'fulfilled' ? (T.tracksStock ? 'Fulfilled' : 'Done') : 'Cancelled'}</span>
                  </div>
                  <div className="space-y-1 mb-3 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
                    {o.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-[12.5px]">
                        <span style={{ color: C.inkDim }}>{it.description} ×{it.quantity}</span>
                        <span className="cx-mono">{fmt(it.quantity * it.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                  {(o.preferredTime || o.note) && (
                    <div className="rounded-xl px-3 py-2.5 mb-3 space-y-1 text-[12.5px]" style={{ background: C.surfaceRaised }}>
                      {o.preferredTime && <div><span style={{ color: C.inkFaint }}>Preferred time: </span><span className="font-semibold">{o.preferredTime}</span></div>}
                      {o.note && <div><span style={{ color: C.inkFaint }}>Note: </span>{o.note}</div>}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="cx-mono text-[14px] font-bold">{fmt(o.total)}</div>
                    {o.status === 'pending' && (
                      <div className="flex items-center gap-3">
                        <button onClick={() => cancelOrder(o.id)} className="text-[11.5px] font-medium" style={{ color: C.inkFaint }}>Cancel</button>
                        <button onClick={() => fulfillOrder(o)} className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: C.sage, color: C.bg }}>{T.tracksStock ? 'Fulfill' : 'Mark done'}</button>
                      </div>
                    )}
                    {o.status !== 'pending' && (
                      <button onClick={() => removeOrder(o.id)} className="text-[11.5px]" style={{ color: C.inkFaint }}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ============ PRODUCTS TAB ============ */}
        {tab === 'products' && (
          <>
            <div className="flex gap-1 p-1 mb-4 rounded-xl" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
              {[['list', T.catalog], ['insights', 'Insights']].map(([k, l]) => (
                <button key={k} onClick={() => setProductsView(k)} className="flex-1 py-2 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5" style={productsView === k ? { background: C.copper, color: C.bg } : { color: C.inkDim }}>
                  {k === 'insights' && <TrendingUp size={14} />}{l}
                </button>
              ))}
            </div>
            {productsView === 'insights' ? renderInsights() : (<>
            <div className="text-[12px] mb-4" style={{ color: C.inkFaint }}>{T.intro}</div>
            {renderStockCenter()}

            {!showProductForm ? (
              <button onClick={() => { setEditingProductId(null); setProductForm({ ...({ name: '', costPrice: '', sellingPrice: '', stockQuantity: '', lowStockThreshold: '5', category: '', kind: 'product', priceUnit: 'fixed', duration: '', description: '', imageBlob: null, imagePreview: null }), kind: settings.businessType === 'services' ? 'service' : 'product' }); setShowProductForm(true); }} className="w-full mb-6 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold" style={{ background: C.copper, color: C.bg }}><Plus size={16} /> Add {T.item}</button>
            ) : (
              <div className="rounded-2xl p-5 mb-6 space-y-4" style={card}>
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-semibold cx-display">{editingProductId ? (formIsService ? 'Edit service' : 'Edit product') : (formIsService ? 'New service' : 'New product')}</div>
                  <button onClick={() => { setShowProductForm(false); setEditingProductId(null); }} aria-label="Close" style={{ color: C.inkFaint }}><X size={17} /></button>
                </div>

                {settings.businessType === 'both' && (
                  <div>
                    <div className={fieldLabel} style={{ color: C.inkFaint }}>THIS IS A</div>
                    <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                      {[['product', 'Product'], ['service', 'Service']].map(([k, l]) => (
                        <button key={k} onClick={() => setProductForm({ ...productForm, kind: k })} className="flex-1 py-2 rounded-lg text-[13px] font-semibold" style={productForm.kind === k ? { background: C.copper, color: C.bg } : { color: C.inkDim }}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2 text-[12.5px] font-medium py-2.5 px-3.5 rounded-xl cursor-pointer" style={{ border: `1px dashed ${C.line}`, color: C.inkDim }}>
                    <Camera size={14} />{productImageUploading ? 'Adding photo…' : productForm.imagePreview ? 'Photo added — tap to change' : formIsService ? 'Add a photo of your work (optional)' : 'Add a product photo (optional)'}
                    <input type="file" accept="image/*" onChange={handleProductPhotoSelect} className="hidden" />
                  </label>
                  {productForm.imagePreview && <img src={productForm.imagePreview} alt="" className="w-16 h-16 rounded-xl object-cover mt-2.5" />}
                </div>

                <div>
                  <div className={fieldLabel} style={{ color: C.inkFaint }}>{formIsService ? 'SERVICE NAME' : 'PRODUCT NAME'}</div>
                  <input type="text" placeholder={formIsService ? "e.g. Knotless braids, Men's haircut, Engine service" : 'e.g. Bone-straight wig, 18 inches'} value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                </div>

                <div>
                  <div className={fieldLabel} style={{ color: C.inkFaint }}>CATEGORY (OPTIONAL)</div>
                  <input type="text" list="xorla-categories" placeholder={formIsService ? 'e.g. Hair, Nails, Repairs, Alterations' : 'e.g. Wigs, Shoes, Drinks'} value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                  <datalist id="xorla-categories">
                    {[...new Set(products.map((p) => p.category).filter(Boolean))].map((cat) => <option key={cat} value={cat} />)}
                  </datalist>
                </div>

                {formIsService ? (
                  <>
                    <div>
                      <div className={fieldLabel} style={{ color: C.inkFaint }}>YOUR RATE</div>
                      <div className="flex gap-2">
                        <input type="text" inputMode="decimal" placeholder="₦ amount" value={formatNumInput(productForm.sellingPrice)} onChange={(e) => setProductForm({ ...productForm, sellingPrice: parseNumInput(e.target.value) })} className="w-1/2 min-w-0 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                        <BrandSelect value={productForm.priceUnit} onChange={(e) => setProductForm({ ...productForm, priceUnit: e.target.value })} className="w-1/2 min-w-0 rounded-xl px-3 py-2.5 text-sm outline-none" style={{ ...field, colorScheme: 'dark' }}>
                          {PRICE_UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </BrandSelect>
                      </div>
                      {productForm.sellingPrice && <div className="text-[11.5px] mt-1.5" style={{ color: C.sage }}>Customers will see: {priceLabel({ sellingPrice: Number(productForm.sellingPrice), priceUnit: productForm.priceUnit })}</div>}
                    </div>
                    <div>
                      <div className={fieldLabel} style={{ color: C.inkFaint }}>HOW LONG IT TAKES (OPTIONAL)</div>
                      <BrandSelect value={productForm.duration} onChange={(e) => setProductForm({ ...productForm, duration: e.target.value })} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ ...field, colorScheme: 'dark' }}>
                        <option value="">Not specified</option>
                        {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </BrandSelect>
                    </div>
                    <div>
                      <div className={fieldLabel} style={{ color: C.inkFaint }}>WHAT'S INCLUDED (OPTIONAL)</div>
                      <textarea rows={2} maxLength={160} placeholder="e.g. Includes wash, blow-dry, and styling" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none" style={field} />
                    </div>
                    <div>
                      <div className={fieldLabel} style={{ color: C.inkFaint }}>MATERIALS COST (OPTIONAL)</div>
                      <input type="text" inputMode="decimal" placeholder="₦ per job" value={formatNumInput(productForm.costPrice)} onChange={(e) => setProductForm({ ...productForm, costPrice: parseNumInput(e.target.value) })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                      <div className="text-[11px] mt-1.5" style={{ color: C.inkFaint }}>What supplies cost you each time you do this job — hair, thread, oil, parts. Used to work out your real profit. Private to you.</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="w-1/2">
                        <div className={fieldLabel} style={{ color: C.inkFaint }}>COST PRICE</div>
                        <input type="text" inputMode="decimal" placeholder="What you pay" value={formatNumInput(productForm.costPrice)} onChange={(e) => setProductForm({ ...productForm, costPrice: parseNumInput(e.target.value) })} className="w-full min-w-0 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                      </div>
                      <div className="w-1/2">
                        <div className={fieldLabel} style={{ color: C.inkFaint }}>SELLING PRICE</div>
                        <input type="text" inputMode="decimal" placeholder="What you charge" value={formatNumInput(productForm.sellingPrice)} onChange={(e) => setProductForm({ ...productForm, sellingPrice: parseNumInput(e.target.value) })} className="w-full min-w-0 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!editingProductId && <div className="w-1/2">
                        <div className={fieldLabel} style={{ color: C.inkFaint }}>{shops.length > 1 ? `STOCK AT ${shopNameOf(targetShopId).toUpperCase()}` : 'STOCK ON HAND (OPTIONAL)'}</div>
                        <input type="number" min="0" placeholder="e.g. 20" value={productForm.stockQuantity} onChange={(e) => setProductForm({ ...productForm, stockQuantity: e.target.value })} className="w-full min-w-0 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                      </div>}
                      <div className={editingProductId ? 'w-full' : 'w-1/2'}>
                        <div className={fieldLabel} style={{ color: C.inkFaint }}>LOW STOCK ALERT AT</div>
                        <input type="number" min="0" placeholder="e.g. 5" value={productForm.lowStockThreshold} onChange={(e) => setProductForm({ ...productForm, lowStockThreshold: e.target.value })} className="w-full min-w-0 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                      </div>
                    </div>
                    <div className="text-[11px] -mt-2" style={{ color: C.inkFaint }}>{editingProductId ? 'To change how many you have, use Restock on the product.' : "Leave stock blank if you don't want to track it for this product."}</div>
                  </>
                )}
                {isOwnerRole && shops.length > 1 && (
                  <div className="rounded-xl p-3.5" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                    <div className={fieldLabel} style={{ color: C.inkFaint }}>PRICE BY SHOP (OPTIONAL)</div>
                    <div className="text-[11px] mb-3" style={{ color: C.inkFaint }}>Leave a shop blank to use the normal price{productForm.sellingPrice ? ` (${fmt(productForm.sellingPrice)})` : ''}.</div>
                    <div className="space-y-2">
                      {shops.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <span className="flex-1 min-w-0 truncate text-[12.5px]" style={{ color: C.inkDim }}>{s.name}</span>
                          <input type="text" inputMode="decimal" placeholder={productForm.sellingPrice ? formatNumInput(productForm.sellingPrice) : '₦'} value={formatNumInput((productForm.shopPrices || {})[s.id] || '')} onChange={(e) => setProductForm({ ...productForm, shopPrices: { ...(productForm.shopPrices || {}), [s.id]: parseNumInput(e.target.value) } })} className="w-32 min-w-0 rounded-lg px-3 py-2 text-sm outline-none cx-mono" style={field} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={addProduct} disabled={savingProduct} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingProduct ? 0.6 : 1 }}>{savingProduct ? 'Saving…' : editingProductId ? 'Save changes' : formIsService ? 'Save service' : 'Save product'}</button>
              </div>
            )}

            <div className="text-[13px] font-semibold cx-display mb-2.5" style={{ color: C.inkDim }}>Your {T.catalog.toLowerCase()}</div>
            {products.length === 0 && <div className="text-center text-[13px] py-8 rounded-2xl" style={{ color: C.inkFaint, border: `1px dashed ${C.line}` }}>{`No ${T.catalog.toLowerCase()} yet — add your first one above.`}</div>}

            {products.some((p) => p.isLow) && (
              <div className="rounded-2xl p-3.5 mb-4 flex items-start gap-2.5" style={{ background: 'rgba(226,98,75,0.1)', border: '1px solid rgba(226,98,75,0.25)' }}>
                <Package size={15} className="shrink-0 mt-0.5" style={{ color: C.rust }} />
                <div className="text-[12px]" style={{ color: '#E2A090' }}>
                  Running low: {products.filter((p) => p.isLow).map((p) => (viewAllShops && shops.length > 1 && p.lowShops.length ? `${p.name} (at ${p.lowShops.join(', ')})` : p.name)).join('; ')}
                </div>
              </div>
            )}

            <div>
              {products.map((p, i) => {
                const isLow = p.isLow;
                const isOut = p.stockQuantity === 0;
                const isRestocking = restockingId === p.id;
                return (
                  <div key={p.id} className="py-3" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.bg }}><Package size={16} style={{ color: C.inkFaint }} /></div>}
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-medium truncate">{p.name}{p.category && <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}>{p.category}</span>}</div>
                          <div className="text-[11px] flex items-center gap-1.5 flex-wrap" style={{ color: C.inkFaint }}>
                            {kindOf(p, settings.businessType) === 'service' ? <span>{priceLabel(p)}{p.duration ? ` · ${p.duration}` : ''}{settings.businessType === 'both' ? ' · Service' : ''}</span> : <span>Cost {fmt(p.costPrice)} · Sells {fmt(p.sellingPrice)}{shops.length > 1 && hasShopPrices(p) ? (viewAllShops ? ' · varies by shop' : '') : ''}</span>}
                            {T.tracksStock && kindOf(p, settings.businessType) === 'product' && p.stockQuantity !== null && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold" style={isOut ? { background: 'rgba(226,98,75,0.15)', color: C.rust } : isLow ? { background: 'rgba(226,98,75,0.12)', color: C.rust } : { background: C.sageSoft, color: C.sage }}>
                                {isOut ? 'Out of stock' : `${p.stockQuantity} in stock`}
                              </span>
                            )}
                          </div>
                          {viewAllShops && hasManyLocations && p.stockQuantity !== null && (
                            <div className="mt-1.5 space-y-0.5 max-w-[260px]">
                              {locations.map((s) => {
                                const q = stockAt(p, s.id);
                                const low = q <= p.lowStockThreshold;
                                return (
                                  <div key={s.id} className="flex items-center justify-between gap-3 text-[11px]">
                                    <span className="truncate" style={{ color: C.inkFaint }}>{s.name}</span>
                                    <span className="cx-mono font-semibold shrink-0" style={{ color: low ? C.rust : C.inkDim }}>{q}{low ? ' · low' : ''}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button onClick={() => { setEditingProductId(p.id); setProductForm({ name: p.name, costPrice: String(p.costPrice || ''), sellingPrice: String(p.basePrice || ''), shopPrices: Object.fromEntries(shops.map((s) => { const o = shopRow(p.id, s.id)?.price_override; return [s.id, o !== null && o !== undefined ? String(o) : '']; })), stockQuantity: '', lowStockThreshold: String(p.lowStockThreshold ?? 5), category: p.category || '', kind: kindOf(p, settings.businessType), priceUnit: p.priceUnit || 'fixed', duration: p.duration || '', description: p.description || '', imageBlob: null, imagePreview: p.imageUrl || null }); setShowProductForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[11px] font-medium" style={{ color: C.copper }}>Edit</button>
                        {isOwnerRole && p.stockQuantity !== null && <button onClick={() => { setCorrectingId(correctingId === p.id ? null : p.id); setRestockingId(null); setCorrectQty(''); setCorrectShopId(activeShopId || mainShopId); }} className="text-[11px] font-medium" style={{ color: C.inkDim }}>Fix count</button>}
                        {T.tracksStock && kindOf(p, settings.businessType) === 'product' && <button onClick={() => { setRestockingId(isRestocking ? null : p.id); setCorrectingId(null); setRestockAmount(''); setRestockCost(''); }} className="text-[11px] font-medium" style={{ color: C.sage }}>{p.stockQuantity === null ? 'Track stock' : 'Restock'}</button>}
                        {isOwnerRole && hasManyLocations && multiLocationOn && p.stockQuantity !== null && <button onClick={() => openSend({ productId: p.id, from: activeShopId || '' })} className="text-[11px] font-medium" style={{ color: C.copper }}>Send</button>}
                        <button onClick={() => removeProduct(p.id)} className="text-[11px]" style={{ color: C.inkFaint }}>Remove</button>
                      </div>
                    </div>
                    {transferringId === p.id && (
                      <div className="rounded-xl p-3 mt-2.5 space-y-2" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                        <div className="text-[11.5px] font-semibold" style={{ color: C.inkDim }}>Move stock between shops</div>
                        <div className="flex gap-2 items-center">
                          <BrandSelect value={transferForm.from} onChange={(e) => setTransferForm({ ...transferForm, from: e.target.value })} className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-[12.5px] outline-none" style={{ ...field, colorScheme: 'dark' }}>
                            <option value="">From…</option>
                            {shops.map((s) => <option key={s.id} value={s.id}>{s.name} ({stockAt(p, s.id)})</option>)}
                          </BrandSelect>
                          <span style={{ color: C.inkFaint }}>→</span>
                          <BrandSelect value={transferForm.to} onChange={(e) => setTransferForm({ ...transferForm, to: e.target.value })} className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-[12.5px] outline-none" style={{ ...field, colorScheme: 'dark' }}>
                            <option value="">To…</option>
                            {shops.filter((s) => s.id !== transferForm.from).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </BrandSelect>
                        </div>
                        <div className="flex gap-2">
                          <input type="number" min="1" placeholder="How many?" value={transferForm.qty} onChange={(e) => setTransferForm({ ...transferForm, qty: e.target.value })} className="flex-1 rounded-lg px-3 py-2 text-sm outline-none cx-mono" style={field} />
                          <button onClick={() => handleTransfer(p)} disabled={!transferForm.from || !transferForm.to || !Number(transferForm.qty)} className="px-4 rounded-lg text-[12px] font-semibold" style={{ background: C.sage, color: C.bg, opacity: !transferForm.from || !transferForm.to || !Number(transferForm.qty) ? 0.4 : 1 }}>Move</button>
                        </div>
                      </div>
                    )}
                    {isRestocking && viewAllShops && hasManyLocations && (
                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        <span className="text-[11.5px]" style={{ color: C.inkDim }}>Into:</span>
                        {locations.map((s) => (
                          <button key={s.id} onClick={() => setRestockShopId(s.id)} className="px-2.5 py-1 rounded-full text-[11.5px] font-medium" style={(restockShopId || mainShopId) === s.id ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{s.name}</button>
                        ))}
                      </div>
                    )}
                    {isRestocking && (() => {
                      const qty = Number(restockAmount);
                      const uc = Number(parseNumInput(restockCost));
                      const avg = restockCost !== '' && uc > 0 && qty > 0 ? newAverageCost(p.id, qty, uc) : null;
                      return (
                        <div className="rounded-xl p-3 mt-2.5 space-y-2" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-semibold">{p.stockQuantity === null ? 'Start tracking stock' : 'Restock'}</span>
                            <button onClick={() => { setRestockingId(null); setRestockAmount(''); setRestockCost(''); }} aria-label="Close" className="p-1 -m-1 rounded-md" style={{ color: C.inkFaint }}><X size={16} /></button>
                          </div>
                          <div className="flex gap-2">
                            <input type="number" min="0" autoFocus placeholder={p.stockQuantity === null ? 'Starting stock count' : 'Units received'} value={restockAmount} onChange={(e) => setRestockAmount(e.target.value)} className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none cx-mono" style={field} />
                            <input type="text" inputMode="decimal" aria-label="Cost per unit this time (optional)" placeholder={`Cost each (${fmt(p.costPrice)})`} value={formatNumInput(restockCost)} onChange={(e) => setRestockCost(parseNumInput(e.target.value))} className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none cx-mono" style={field} />
                            <button onClick={() => handleRestock(p)} className="px-4 rounded-lg text-[12px] font-semibold shrink-0" style={{ background: C.sage, color: C.bg }}>Save</button>
                          </div>
                          <div className="text-[11px] leading-relaxed" style={{ color: avg !== null && avg !== Number(p.costPrice) ? C.sage : C.inkFaint }}>
                            {avg !== null && avg !== Number(p.costPrice)
                              ? costExplainer(p.id, qty, uc, avg)
                              : 'Paid a different price this time? Add the cost per unit. It only affects your profit figures — your selling price stays yours to set.'}
                          </div>
                        </div>
                      );
                    })()}
                    {correctingId === p.id && (() => {
                      const cShop = activeShopId || (locations.some((s) => s.id === correctShopId) ? correctShopId : mainShopId);
                      return (
                        <div className="rounded-xl p-3 mt-2.5 space-y-2.5" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-semibold">Correct the count</span>
                            <button onClick={() => { setCorrectingId(null); setCorrectQty(''); }} aria-label="Close" className="p-1 -m-1 rounded-md" style={{ color: C.inkFaint }}><X size={16} /></button>
                          </div>
                          {viewAllShops && hasManyLocations && (
                            <div className="flex flex-wrap gap-1.5">
                              {locations.map((s) => (
                                <button key={s.id} onClick={() => setCorrectShopId(s.id)} className="px-2.5 py-1 rounded-full text-[11.5px] font-medium" style={cShop === s.id ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{s.name} ({stockAt(p, s.id)})</button>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="flex-1 text-[12px]" style={{ color: C.inkDim }}>Real count at {shopNameOf(cShop)}</span>
                            <input type="number" min="0" autoFocus placeholder={String(stockAt(p, cShop))} value={correctQty} onChange={(e) => setCorrectQty(e.target.value)} className="w-20 rounded-lg px-2 py-2 text-sm text-center outline-none cx-mono" style={field} />
                            <button onClick={() => handleCorrectCount(p)} disabled={correctQty === ''} className="px-4 py-2 rounded-lg text-[12px] font-semibold" style={{ background: C.sage, color: C.bg, opacity: correctQty === '' ? 0.4 : 1 }}>Save</button>
                          </div>
                          <div className="text-[11px] leading-relaxed" style={{ color: C.inkFaint }}>For fixing a typing mistake, or after counting what's really on the shelf. It's saved as a correction, so your stock history stays honest.</div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
            </>)}
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
                {renderRecordShopPicker()}
                <input type="text" placeholder="What did you spend on?" value={expenseForm.item} onChange={(e) => setExpenseForm({ ...expenseForm, item: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                <input type="text" inputMode="decimal" placeholder="Amount (₦)" value={formatNumInput(expenseForm.amount)} onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseNumInput(e.target.value) })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setExpenseForm((f) => ({ ...f, category: c, item: f.item.trim() ? f.item : c }))} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={expenseForm.category === c ? { background: C.rust, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{c}</button>
                  ))}
                </div>
                <div className="text-[10.5px] -mt-1.5" style={{ color: C.inkFaint }}>Picking a category fills in the description too — type your own to override.</div>
                <button onClick={addExpense} disabled={savingExpense} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingExpense ? 0.6 : 1 }}>{savingExpense ? "Saving…" : "Save expense"}</button>
              </div>
            )}

            <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
              <div className="text-[13px] font-semibold cx-display" style={{ color: C.inkDim }}>{formatViewDate(viewDate)}'s expenses</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewDate(shiftDate(viewDate, -1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>‹</button>
                <input type="date" value={viewDate} max={todayKey()} onChange={(e) => e.target.value && setViewDate(e.target.value)} className="rounded-lg px-2 py-1 text-[11.5px] outline-none" style={{ ...field, colorScheme: 'dark' }} />
                {viewDate !== todayKey() && <button onClick={() => setViewDate(todayKey())} className="text-[11px] font-medium" style={{ color: C.sage }}>Today</button>}
                <button onClick={() => setViewDate(shiftDate(viewDate, 1))} disabled={viewDate >= todayKey()} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.line}`, color: viewDate >= todayKey() ? C.inkFaint : C.inkDim, opacity: viewDate >= todayKey() ? 0.4 : 1 }}>›</button>
              </div>
            </div>

            <div className="rounded-2xl p-4 mb-4 flex items-center justify-between" style={card}>
              <div>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: C.inkFaint }}>Profit, {formatViewDate(viewDate).toLowerCase()}</div>
                <div className="cx-mono text-[22px] font-extrabold" style={{ color: viewedProfit >= 0 ? C.ink : C.rust }}>{fmt(viewedProfit)}</div>
              </div>
              <div className="text-right text-[11px] space-y-0.5" style={{ color: C.inkFaint }}>
                <div>Sales <span className="cx-mono" style={{ color: C.sage }}>{fmt(viewedSalesTotal)}</span></div>
                <div>Expenses <span className="cx-mono" style={{ color: C.rust }}>{fmt(viewedExpensesTotal)}</span></div>
              </div>
            </div>

            {settings.role === 'owner' && sellerOptions.length > 1 && (
              <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
                <span className="text-[11px] font-medium shrink-0 mr-0.5" style={{ color: C.inkFaint }}>Recorded by</span>
                <button onClick={() => setStaffFilter('')} className="px-3 py-1.5 rounded-full text-[12px] font-medium shrink-0" style={!staffFilter ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>Everyone</button>
                {sellerOptions.map((name) => (
                  <button key={name} onClick={() => setStaffFilter(name)} className="px-3 py-1.5 rounded-full text-[12px] font-medium shrink-0" style={staffFilter === name ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>
                    {name === settings.myName ? 'You' : name}{!currentStaffNames.includes(name) && name !== settings.myName ? ' (former)' : ''}
                  </button>
                ))}
              </div>
            )}

            {filteredExpensesList.length > 0 && (
              <div className="text-[11px] mb-2.5" style={{ color: C.inkFaint }}>{fmt(filteredExpensesTotal)} total{staffFilter ? ` · ${staffFilter}` : ''}</div>
            )}
            {filteredExpensesList.length === 0 && <div className="text-center text-[13px] py-8 rounded-2xl" style={{ color: C.inkFaint, border: `1px dashed ${C.line}` }}>{staffFilter ? `No expenses from ${staffFilter} that day.` : 'No expenses logged that day.'}</div>}
            <div>
              {filteredExpensesList.map((e, i) => (
                <div key={e.id} className="flex items-center justify-between py-3" style={i > 0 ? { borderTop: `1px solid ${C.line}` } : {}}>
                  <div>
                    <div className="text-[13.5px] font-medium">{e.item}</div>
                    <div className="text-[11px]" style={{ color: C.inkFaint }}>{e.time} · {e.category}{e.loggedBy ? ` · ${e.loggedBy}` : ''}{viewAllShops && shops.length > 1 ? ` · ${shopNameOf(e.shopId)}` : ''}</div>
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
                {renderRecordShopPicker()}
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
                  {!form.itemized && (
                    <input type="text" inputMode="decimal" placeholder="Amount (₦)" value={formatNumInput(form.amount)} onChange={(e) => setForm({ ...form, amount: parseNumInput(e.target.value) })} className="w-1/2 min-w-0 rounded-xl px-3.5 py-2.5 text-sm outline-none cx-mono" style={field} />
                  )}
                  {form.itemized && <div className="w-1/2 flex items-center justify-center text-[11px]" style={{ color: C.inkFaint }}>Amount from line items below</div>}
                </div>

                <button type="button" onClick={() => setForm({ ...form, itemized: !form.itemized })} className="flex items-center gap-2 text-[12px] font-medium py-1" style={{ color: C.copper }}>
                  {form.itemized ? '− Switch to a simple amount' : '+ Add line items (itemized invoice)'}
                </button>

                {form.itemized && (
                  <div className="rounded-xl p-3 space-y-2" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                    <div className="flex gap-1.5 text-[9.5px] font-semibold px-0.5" style={{ color: C.inkFaint }}>
                      <span className="flex-1">ITEM</span>
                      <span className="w-14 text-center">QTY</span>
                      <span className="w-20">UNIT ₦</span>
                      <span className="w-3.5" />
                    </div>
                    {form.items.map((it, idx) => (
                      <div key={idx} className="space-y-1.5" style={idx > 0 ? { paddingTop: '8px', borderTop: `1px dashed ${C.line}` } : {}}>
                        {products.length > 0 && (
                          <BrandSelect value="" onChange={(e) => { const product = products.find((p) => p.id === e.target.value); if (!product) return; const items = [...form.items]; items[idx] = { ...items[idx], description: product.name, unitPrice: String(product.sellingPrice) }; setForm({ ...form, items }); }} className="w-full min-w-0 rounded-lg px-2.5 py-1.5 text-[11px] outline-none" style={{ ...field, colorScheme: 'dark' }}>
                            <option value="">Pick from your {T.catalog.toLowerCase()}… (optional)</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.sellingPrice)}</option>)}
                          </BrandSelect>
                        )}
                        <div className="flex gap-1.5 items-center">
                          <input type="text" placeholder="Item description" value={it.description} onChange={(e) => { const items = [...form.items]; items[idx] = { ...items[idx], description: e.target.value }; setForm({ ...form, items }); }} className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-[12.5px] outline-none" style={field} />
                          <input type="number" min="1" placeholder="1" value={it.quantity} onChange={(e) => { const items = [...form.items]; items[idx] = { ...items[idx], quantity: e.target.value }; setForm({ ...form, items }); }} className="w-14 rounded-lg px-2 py-2 text-[12.5px] text-center outline-none cx-mono" style={field} />
                          <input type="text" inputMode="decimal" placeholder="0" value={formatNumInput(it.unitPrice)} onChange={(e) => { const items = [...form.items]; items[idx] = { ...items[idx], unitPrice: parseNumInput(e.target.value) }; setForm({ ...form, items }); }} className="w-20 min-w-0 shrink-0 rounded-lg px-2 py-2 text-[12.5px] outline-none cx-mono" style={field} />
                          {form.items.length > 1 && (
                            <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })} style={{ color: C.inkFaint }}><X size={14} /></button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { description: '', quantity: '1', unitPrice: '' }] })} className="text-[11.5px] font-medium" style={{ color: C.sage }}>+ Add another item</button>

                    <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
                      <span className="text-[11px]" style={{ color: C.inkDim }}>Tax / VAT %</span>
                      <input type="number" placeholder="0" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} className="w-16 rounded-lg px-2 py-1.5 text-[12px] outline-none cx-mono" style={field} />
                    </div>
                    <div className="text-[13px] font-semibold pt-1" style={{ color: C.ink }}>
                      Total: {fmt(form.items.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0) * (1 + Number(form.taxRate || 0) / 100))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <div className="text-[10.5px] font-medium mb-1" style={{ color: C.inkFaint }}>DUE DATE — when payment is expected</div>
                    <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={{ ...field, colorScheme: 'dark' }} />
                  </div>
                  <div className="w-1/2">
                    <div className="text-[10.5px] font-medium mb-1" style={{ color: C.inkFaint }}>PHONE (OPTIONAL)</div>
                    <input type="tel" placeholder="For reminders" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none" style={field} />
                  </div>
                </div>
                <textarea placeholder="Billing address (optional)" value={form.clientAddress} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} rows={2} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none" style={field} />
                <textarea placeholder="Note to add at the bottom of the invoice (optional) — e.g. 'Thank you for your business!'" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none" style={field} />
                <button onClick={addInvoice} disabled={savingInvoice} className="w-full rounded-xl py-3 text-[13.5px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: savingInvoice ? 0.6 : 1 }}>{savingInvoice ? "Saving…" : "Save invoice"}</button>
              </div>
            )}

            <div className="flex items-baseline justify-between mb-3">
              <span className="text-[13px] font-semibold cx-display" style={{ color: C.inkDim }}>Invoices</span>
              <span className="cx-mono text-[11px]" style={{ color: C.inkFaint }}>{invoices.length} total</span>
            </div>
            <div className="flex gap-1.5 mb-4 p-1 rounded-xl" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
              <button onClick={() => setInvoiceView('active')} className="flex-1 py-2 rounded-lg text-[12px] font-semibold" style={invoiceView === 'active' ? { background: C.copper, color: C.bg } : { color: C.inkDim }}>Active</button>
              <button onClick={() => setInvoiceView('paid')} className="flex-1 py-2 rounded-lg text-[12px] font-semibold" style={invoiceView === 'paid' ? { background: C.sage, color: C.bg } : { color: C.inkDim }}>Paid {paidInvoiceCount > 0 ? `(${paidInvoiceCount})` : ''}</button>
            </div>
            {sortedInvoices.length === 0 && <div className="text-center text-[13px] py-10 rounded-2xl" style={{ color: C.inkFaint, border: `1px dashed ${C.line}` }}>{invoiceView === 'paid' ? 'No paid invoices yet.' : 'Nothing active — nice.'}</div>}

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
                          <div className="text-[11.5px] mt-0.5" style={{ color: C.inkFaint }}>
                            #{inv.invoiceNo} · due {new Date(inv.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {inv.items && inv.items.length > 0 && <span> · {inv.items.length} item{inv.items.length !== 1 ? 's' : ''}</span>}
                            {inv.autoReminderCount > 0 && <span> · auto-reminded {inv.autoReminderCount}×</span>}
                            {viewAllShops && shops.length > 1 && <span> · {shopNameOf(inv.shopId)}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="cx-mono text-[14px] font-semibold">{fmt(bal)}</div>
                          <div className="text-[11px] font-medium mt-0.5" style={{ color: u.color }}>{u.label}</div>
                        </div>
                      </div>
                      <button onClick={() => downloadInvoicePDF(inv, settings)} className="flex items-center gap-1.5 text-[11.5px] font-medium mb-2.5" style={{ color: C.copper }}>
                        <Wallet size={12} /> Download PDF invoice
                      </button>

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
                          <input type="text" inputMode="decimal" autoFocus placeholder={`Max ${fmt(bal)}`} value={formatNumInput(payAmount)} onChange={(e) => setPayAmount(parseNumInput(e.target.value))} className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[12.5px] outline-none cx-mono" style={field} />
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
                          <a href={`https://wa.me/${toWhatsAppNumber(inv.phone)}?text=${encodeURIComponent(isPaid ? thankMsg : message)}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-semibold" style={{ background: C.sage, color: C.bg }}>
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

            <div className="rounded-xl px-3.5 py-3 mb-4" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold mb-2" style={{ color: C.inkDim }}><Globe size={13} style={{ color: C.copper }} /> Oga answers in</div>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((l) => (
                  <button key={l.id} onClick={() => updateSettings({ language: l.id })} aria-pressed={settings.language === l.id} className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors" style={settings.language === l.id ? { background: C.copper, color: C.bg } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{l.label}</button>
                ))}
              </div>
              <div className="text-[11px] mt-2" style={{ color: C.inkFaint }}>Your AI reminders, thank-you notes, and summaries use this language too.</div>
            </div>

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
          data-tour="oga"
          onClick={() => { setPreviousTab(tab); setTab('advisor'); }}
          className="fixed bottom-24 lg:bottom-6 right-5 lg:right-6 z-40 flex items-center gap-2 pl-3.5 pr-4 py-3 rounded-full transition-transform active:scale-95"
          style={{ background: C.copper, color: C.bg, boxShadow: '0 8px 24px rgba(255,176,32,0.35)' }}
        >
          <Lightbulb size={17} />
          <span className="text-[12.5px] font-semibold">Ask Oga</span>
        </button>
      )}

      {settings.loggedIn && settings.role === 'owner' && settings.businessType === null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-5" style={{ background: 'rgba(3,10,9,0.8)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md rounded-3xl p-6 xorla-fade-up" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <div className="text-[20px] font-bold cx-display mb-1.5">What does {settings.businessName || 'your business'} do?</div>
            <div className="text-[13px] mb-5" style={{ color: C.inkDim }}>We'll set Xorla up to fit how you work. You can change this later in Settings.</div>
            {renderBusinessTypeChoices(pendingBusinessType, setPendingBusinessType)}
            <button onClick={() => pendingBusinessType && updateSettings({ businessType: pendingBusinessType })} disabled={!pendingBusinessType} className="w-full mt-5 rounded-xl py-3.5 text-[14px] font-semibold" style={{ background: C.copper, color: C.bg, opacity: pendingBusinessType ? 1 : 0.4 }}>Continue</button>
          </div>
        </div>
      )}

      {tourStep !== null && tourSteps[tourStep] && (() => {
        const step = tourSteps[tourStep];
        const pad = 6;
        const vw = window.innerWidth, vh = window.innerHeight;
        const cardW = Math.min(320, vw - 24);
        let cardStyle;
        if (tourRect) {
          const cx = tourRect.left + tourRect.width / 2;
          const left = Math.max(12, Math.min(vw - cardW - 12, cx - cardW / 2));
          const below = tourRect.top + tourRect.height / 2 < vh / 2;
          cardStyle = below ? { top: tourRect.top + tourRect.height + pad + 12, left, width: cardW } : { bottom: vh - tourRect.top + pad + 12, left, width: cardW };
        } else {
          cardStyle = { top: 0, bottom: 0, left: (vw - cardW) / 2, width: cardW, display: 'flex', alignItems: 'center' };
        }
        const isLast = tourStep === tourSteps.length - 1;
        return (
          <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="App tour">
            <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} style={tourRect ? {} : { background: 'rgba(3,10,9,0.78)' }} />
            {tourRect && (
              <div className="absolute rounded-2xl pointer-events-none transition-all duration-300" style={{ top: tourRect.top - pad, left: tourRect.left - pad, width: tourRect.width + pad * 2, height: tourRect.height + pad * 2, boxShadow: '0 0 0 9999px rgba(3,10,9,0.78)', border: `2px solid ${C.copper}` }} />
            )}
            <div className="absolute" style={cardStyle}>
            <div className="w-full rounded-2xl p-5 xorla-fade-up" style={{ background: C.surface, border: `1px solid ${C.lineStrong || C.line}`, boxShadow: '0 20px 50px rgba(0,0,0,0.45)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold" style={{ color: C.copper }}>{tourStep + 1} of {tourSteps.length}</span>
                {!isLast && <button onClick={endTour} className="text-[12px] font-medium" style={{ color: C.inkFaint }}>Skip tour</button>}
              </div>
              <div className="text-[16px] font-bold cx-display mb-1.5">{step.title}</div>
              <div className="text-[13px] leading-relaxed mb-4" style={{ color: C.inkDim }}>{step.body}</div>
              <div className="flex items-center gap-2">
                {tourStep > 0 && !isLast && <button onClick={() => setTourStep(tourStep - 1)} className="px-4 py-2.5 rounded-xl text-[13px] font-medium" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}>Back</button>}
                {isLast ? (
                  <>
                    <button onClick={endTour} className="px-4 py-2.5 rounded-xl text-[13px] font-medium" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}>Finish</button>
                    <button onClick={() => { endTour(); setTab('products'); setEditingProductId(null); setShowProductForm(true); }} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold" style={{ background: C.copper, color: C.bg }}>Add my first {T.item}</button>
                  </>
                ) : (
                  <button onClick={() => setTourStep(tourStep + 1)} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold" style={{ background: C.copper, color: C.bg }}>{tourStep === 0 ? "Show me around" : 'Next'}</button>
                )}
              </div>
            </div>
            </div>
          </div>
        );
      })()}

      {renderReceiptModal()}
      {renderStockPanel()}
      {renderNotifPanel()}
      {renderLimitPrompt()}
      {aiNotice && (
        <div role="status" className="fixed left-4 right-4 lg:left-auto lg:right-6 lg:w-[380px] bottom-24 lg:bottom-6 z-50 rounded-2xl px-4 py-3.5 flex items-start gap-3 xorla-fade-up" style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}>
          <Lightbulb size={17} className="shrink-0 mt-0.5" style={{ color: C.copper }} />
          <div className="flex-1 text-[13px] leading-relaxed" style={{ color: C.ink }}>{aiNotice}</div>
          <button onClick={() => setAiNotice('')} aria-label="Dismiss" style={{ color: C.inkFaint }}><X size={16} /></button>
        </div>
      )}

      {/* Fixed bottom nav — mobile only, WhatsApp-style: always visible, never scrolls */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex" style={{ background: 'rgba(10,31,28,0.97)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${C.line}` }}>
        {[
          { id: 'overview', label: 'Overview', Icon: Home },
          { id: 'sales', label: T.salesTab, Icon: ShoppingBag },
          { id: 'products', label: T.catalog, Icon: Package },
          { id: 'expenses', label: 'Expenses', Icon: Receipt },
          { id: 'invoices', label: 'Invoices', Icon: Wallet },
        ].map(({ id, label, Icon }) => (
          <button key={id} data-tour={`nav-${id}`} onClick={() => setTab(id)} className="flex-1 flex flex-col items-center gap-1 py-2.5 relative">
            <Icon size={21} style={{ color: (tab === id || (id === 'sales' && tab === 'orders')) ? C.copper : C.inkFaint }} />
            <span className="text-[10px] font-medium" style={{ color: (tab === id || (id === 'sales' && tab === 'orders')) ? C.copper : C.inkFaint }}>{label}</span>
            {id === 'sales' && pendingOrderCount > 0 && (
              <span className="absolute top-1.5 right-[22%] w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-bold" style={{ background: C.copper, color: C.bg }}>{pendingOrderCount}</span>
            )}
            {id === 'invoices' && needsAttention.length > 0 && (
              <span className="absolute top-1.5 right-[22%] w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-bold" style={{ background: C.rust, color: C.bg }}>{needsAttention.length}</span>
            )}
            {id === 'invoices' && needsAttention.length === 0 && unpaidInvoiceCount > 0 && (
              <span className="absolute top-1.5 right-[22%] min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[8.5px] font-bold" style={{ background: C.bg, border: `1.5px solid ${C.copper}`, color: C.copper }}>{unpaidInvoiceCount}</span>
            )}
            {id === 'products' && products.filter((p) => p.isLow).length > 0 && (
              <span className="absolute top-1.5 right-[22%] w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-bold" style={{ background: C.rust, color: C.bg }}>{products.filter((p) => p.isLow).length}</span>
            )}
          </button>
        ))}
      </div>
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
const SF_FONT = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

function Storefront({ businessCode }) {
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState(null);
  const [storeProducts, setStoreProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [heroIndex, setHeroIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [preferredTime, setPreferredTime] = useState('');
  const [storeShopId, setStoreShopId] = useState(null);
  const [switchingShop, setSwitchingShop] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [overHero, setOverHero] = useState(true);
  const [catFade, setCatFade] = useState({ left: false, right: false });
  const heroRef = useRef(null);
  const catRef = useRef(null);

  // Header floats transparent over the banner, then turns solid white once the banner scrolls away
  useEffect(() => {
    const onScroll = () => setOverHero(heroRef.current ? heroRef.current.getBoundingClientRect().bottom > 72 : false);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loading]);

  // Show a fade + arrow on whichever side of the category row has more pills hidden
  const updateCatFade = () => {
    const el = catRef.current;
    if (!el) return;
    setCatFade({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  const scrollCats = (dir) => catRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });

  // Storefront-only font + a white browser bar, so it feels like the business's own shop, not the Xorla dashboard
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = meta?.getAttribute('content');
    meta?.setAttribute('content', '#FFFFFF');
    return () => { link.remove(); if (meta && prevTheme) meta.setAttribute('content', prevTheme); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Secure function returns only shopper-safe fields — never cost prices or private settings
        const store = await sbRpc('get_storefront', SB_KEY, { p_business_code: businessCode, ...(storeShopId ? { p_shop_id: storeShopId } : {}) });
        if (!store) { setLoadError(true); setLoading(false); return; }
        setBusiness(store);
        document.title = store.name;
        setStoreProducts((store.products || []).map(fromSbProduct));
      } catch (e) { if (!business) setLoadError(true); }
      setLoading(false);
      setSwitchingShop(false);
    })();
  }, [businessCode, storeShopId]);

  // Banner carousel auto-advance — every 5s, paused for people who've asked their phone to reduce motion
  useEffect(() => {
    const count = Array.isArray(business?.hero_images) ? business.hero_images.length : 0;
    if (count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [business]);

  const categories = ['All', ...[...new Set(storeProducts.map((p) => p.category).filter(Boolean))].sort()];
  const hasCategories = categories.length > 1;
  useEffect(() => {
    updateCatFade();
    window.addEventListener('resize', updateCatFade);
    return () => window.removeEventListener('resize', updateCatFade);
  }, [categories.join('|'), loading]);

  const visibleProducts = storeProducts
    .filter((p) => activeCategory === 'All' || p.category === activeCategory)
    .filter((p) => !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'low') return a.sellingPrice - b.sellingPrice;
      if (sortBy === 'high') return b.sellingPrice - a.sellingPrice;
      const aOut = a.stockQuantity === 0 ? 1 : 0; const bOut = b.stockQuantity === 0 ? 1 : 0;
      return aOut - bOut || a.name.localeCompare(b.name);
    });

  // Grouped into sections only when browsing "All" with categories in use and no search — otherwise one clean grid
  const sections = (activeCategory === 'All' && hasCategories && !query.trim() && sortBy === 'featured')
    ? categories.slice(1).map((cat) => ({ title: cat, items: visibleProducts.filter((p) => p.category === cat) }))
        .concat([{ title: 'More', items: visibleProducts.filter((p) => !p.category) }])
        .filter((s) => s.items.length)
    : [{ title: null, items: visibleProducts }];

  const cartList = Object.entries(cart).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ product: storeProducts.find((p) => p.id === id), qty })).filter((c) => c.product);
  const cartTotal = cartList.reduce((a, c) => a + c.product.sellingPrice * c.qty, 0);
  const cartCount = cartList.reduce((a, c) => a + c.qty, 0);
  const storeShops = business?.shops || [];
  const currentStoreShop = storeShops.find((sh) => sh.id === business?.shop_id) || storeShops[0];
  const cartHasService = cartList.some((c) => kindOf(c.product, business?.business_type) === 'service');
  const lineQtyText = (c) => {
    if (kindOf(c.product, business?.business_type) !== 'service') return ` ×${c.qty}`;
    return c.product.priceUnit === 'hour' ? ` (${c.qty} hr${c.qty !== 1 ? 's' : ''})` : '';
  };

  const changeQty = (product, delta) => {
    setCart((prev) => {
      const current = prev[product.id] || 0;
      const svc = kindOf(product, business?.business_type) === 'service';
      const max = svc ? (product.priceUnit === 'hour' ? 24 : 1) : product.stockQuantity !== null ? product.stockQuantity : Infinity;
      return { ...prev, [product.id]: Math.max(0, Math.min(max, current + delta)) };
    });
  };

  const submitOrder = async () => {
    if (!customerName.trim() || cartList.length === 0) return;
    setSubmitting(true);
    try {
      // Only product IDs + quantities are sent — the database looks up the real prices itself
      const items = cartList.map((c) => ({ productId: c.product.id, quantity: c.qty }));
      const when = preferredTime ? new Date(preferredTime).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
      await sbRpc('place_order', SB_KEY, { p_shop_id: business.shop_id || null, p_business_code: businessCode, p_customer_name: customerName.trim(), p_customer_phone: customerPhone.trim(), p_items: items, p_preferred_time: when, p_note: orderNote.trim() });
      if (business.owner_phone) {
        const lines = cartList.map((c) => `• ${c.product.name}${lineQtyText(c)} — ${fmt(c.product.sellingPrice * c.qty)}`).join('\n');
        const extra = `${when ? `\nPreferred time: ${when}` : ''}${orderNote.trim() ? `\nNote: ${orderNote.trim()}` : ''}`;
        const shopLabel = storeShops.length > 1 ? ` for ${currentStoreShop?.name}` : '';
        const msg = `New ${isService || cartHasService ? 'request' : 'order'}${shopLabel} from ${customerName.trim()}${customerPhone ? ` (${customerPhone.trim()})` : ''}:\n\n${lines}\n\nTotal: ${fmt(cartTotal)}${extra}`;
        window.open(`https://wa.me/${toWhatsAppNumber(business.owner_phone)}?text=${encodeURIComponent(msg)}`, '_blank');
      }
      setOrderSent(true);
      setShowCheckout(false);
    } catch (e) { alert(`Your ${W.short.toLowerCase()} didn't go through. Check your connection and tap ${W.send} again.`); }
    setSubmitting(false);
  };

  const isService = business?.business_type === 'services';
  const W = isService
    ? { your: 'Your request', send: 'Send request', view: 'View request', sent: 'Request sent to', short: 'Request', inYour: 'your request', empty: "Tap a service's price to add it here." }
    : { your: 'Your order', send: 'Send order', view: 'View order', sent: 'Order sent to', short: 'Order', inYour: 'your order', empty: "Tap a product's price to add it here." };
  const page = { background: S.bg, color: S.ink, fontFamily: SF_FONT, minHeight: '100vh' };
  const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black';

  if (loading) {
    return <div className="flex items-center justify-center" style={page}><Loader2 className="animate-spin" size={22} style={{ color: S.muted }} /></div>;
  }
  if (loadError || !business) {
    return (
      <div className="flex flex-col items-center justify-center px-6 text-center" style={page}>
        <div className="text-[20px] font-bold mb-2">This store isn't open right now</div>
        <div className="text-[14px] max-w-xs" style={{ color: S.muted }}>The link may be mistyped, or the business has paused its storefront. Ask them for their current link.</div>
      </div>
    );
  }
  if (orderSent) {
    return (
      <div className="flex flex-col items-center justify-center px-6 text-center" style={page}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: S.ink }}><Check size={26} color="#fff" /></div>
        <div className="text-[24px] font-bold mb-2">{W.sent} {business.name}</div>
        <div className="text-[14px] max-w-sm mb-8" style={{ color: S.muted }}>They'll contact you{customerPhone ? ` on ${customerPhone}` : ''} to confirm {W.inYour} and arrange payment{isService ? '' : ' and delivery'}.</div>
        <button onClick={() => { setOrderSent(false); setCart({}); }} className={`px-6 py-3 rounded-full text-[14px] font-semibold ${focusRing}`} style={{ border: `1.5px solid ${S.ink}` }}>Back to the store</button>
      </div>
    );
  }

  const renderProductCard = (p) => {
    const qty = cart[p.id] || 0;
    const svc = kindOf(p, business.business_type) === 'service';
    const isOut = !svc && p.stockQuantity === 0;
    const fewLeft = !svc && p.stockQuantity !== null && p.stockQuantity > 0 && p.stockQuantity <= 3;
    return (
      <div className="flex flex-col">
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-3 flex items-center justify-center" style={{ background: S.tile }}>
          {p.imageUrl
            ? <img src={p.imageUrl} alt={p.name} loading="lazy" className="w-full h-full object-cover" style={isOut ? { opacity: 0.45, filter: 'grayscale(1)' } : {}} />
            : svc ? <Sparkles size={30} style={{ color: S.soldOut }} /> : <Package size={32} style={{ color: S.soldOut }} />}
          {isOut && <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#fff', color: S.muted }}>Sold out</span>}
          {fewLeft && <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#fff', color: S.ink }}>Only {p.stockQuantity} left</span>}
          {svc && p.duration && <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1" style={{ background: '#fff', color: S.ink }}>{p.duration}</span>}
        </div>
        <div className="text-[14px] font-semibold leading-snug line-clamp-2" style={{ color: isOut ? S.muted : S.ink }}>{p.name}</div>
        {svc && p.description && <div className="text-[12.5px] leading-snug mt-1 line-clamp-2" style={{ color: S.muted }}>{p.description}</div>}
        {svc && <div className="text-[14px] font-bold mt-1.5" style={{ fontVariantNumeric: 'tabular-nums' }}>{priceLabel(p)}</div>}
        <div className="flex-1 min-h-[10px]" />
        {isOut ? (
          <div className="w-full py-2.5 rounded-xl text-center text-[13px] font-semibold" style={{ background: S.tile, color: S.soldOut }}>{fmt(p.sellingPrice)}</div>
        ) : svc ? (
          qty === 0 ? (
            <button onClick={() => changeQty(p, 1)} aria-label={`Request ${p.name}`} className={`w-full py-2.5 rounded-xl text-[13.5px] font-semibold active:scale-[0.98] transition-transform ${focusRing}`} style={{ background: S.ink, color: '#fff' }}>Request</button>
          ) : p.priceUnit === 'hour' ? (
            <div className="w-full flex items-center justify-between rounded-xl" style={{ border: `1.5px solid ${S.ink}` }}>
              <button onClick={() => changeQty(p, -1)} aria-label={`One hour less of ${p.name}`} className={`w-11 py-2 text-[18px] font-semibold rounded-l-xl ${focusRing}`}>−</button>
              <span className="text-[13.5px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{qty} hr{qty !== 1 ? 's' : ''}</span>
              <button onClick={() => changeQty(p, 1)} aria-label={`One hour more of ${p.name}`} className={`w-11 py-2 text-[18px] font-semibold rounded-r-xl ${focusRing}`}>+</button>
            </div>
          ) : (
            <button onClick={() => changeQty(p, -1)} aria-label={`Remove ${p.name} from your request`} className={`w-full py-2.5 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-1.5 ${focusRing}`} style={{ border: `1.5px solid ${S.ink}`, color: S.ink }}><Check size={15} strokeWidth={2.5} /> Added</button>
          )
        ) : qty === 0 ? (
          <button onClick={() => changeQty(p, 1)} aria-label={`Add ${p.name} to your order`} className={`w-full py-2.5 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform ${focusRing}`} style={{ background: S.ink, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            <Plus size={15} strokeWidth={2.5} /> {fmt(p.sellingPrice)}
          </button>
        ) : (
          <div className="w-full flex items-center justify-between rounded-xl" style={{ border: `1.5px solid ${S.ink}` }}>
            <button onClick={() => changeQty(p, -1)} aria-label={`Remove one ${p.name}`} className={`w-11 py-2 text-[18px] font-semibold rounded-l-xl ${focusRing}`}>−</button>
            <span className="text-[14px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
            <button onClick={() => changeQty(p, 1)} aria-label={`Add one more ${p.name}`} disabled={p.stockQuantity !== null && qty >= p.stockQuantity} className={`w-11 py-2 text-[18px] font-semibold rounded-r-xl ${focusRing}`} style={{ opacity: p.stockQuantity !== null && qty >= p.stockQuantity ? 0.3 : 1 }}>+</button>
          </div>
        )}
      </div>
    );
  };

  const renderOrderSummary = () => (
    <div>
      {cartList.length === 0 ? (
        <div className="py-10 text-center text-[13.5px]" style={{ color: S.muted }}>{W.empty}</div>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {cartList.map((c) => (
              <div key={c.product.id} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: S.tile }}>
                  {c.product.imageUrl ? <img src={c.product.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package size={16} style={{ color: S.soldOut }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">{c.product.name}</div>
                  <div className="text-[12.5px]" style={{ color: S.muted, fontVariantNumeric: 'tabular-nums' }}>{kindOf(c.product, business.business_type) === 'service' ? (c.product.priceUnit === 'hour' ? `${c.qty} hr${c.qty !== 1 ? 's' : ''} × ${fmt(c.product.sellingPrice)}` : priceLabel(c.product)) : `${c.qty} × ${fmt(c.product.sellingPrice)}`}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(c.product, -1)} aria-label={`Remove one ${c.product.name}`} className={`w-7 h-7 rounded-full text-[15px] font-semibold ${focusRing}`} style={{ background: S.tile }}>−</button>
                  <button onClick={() => changeQty(c.product, 1)} aria-label={`Add one more ${c.product.name}`} className={`w-7 h-7 rounded-full text-[15px] font-semibold ${focusRing}`} style={{ background: S.tile }}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between py-4 mb-4" style={{ borderTop: `1px solid ${S.line}` }}>
            <span className="text-[14px] font-semibold">Total</span>
            <span className="text-[18px] font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(cartTotal)}</span>
          </div>
        </>
      )}
    </div>
  );

  const renderCheckoutFields = () => (
    <div>
      <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sf-name">Your name</label>
      <input id="sf-name" type="text" autoComplete="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-4 ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
      <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sf-phone">Phone number</label>
      <input id="sf-phone" type="tel" autoComplete="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="So they can confirm with you" className={`w-full rounded-xl px-4 py-3 text-[15px] mb-2 ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
      {cartHasService && (
        <>
          <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sf-when">When would you like it? <span className="font-normal" style={{ color: S.muted }}>(optional)</span></label>
          <input id="sf-when" type="datetime-local" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-4 ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
          <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sf-note">Anything they should know? <span className="font-normal" style={{ color: S.muted }}>(optional)</span></label>
          <textarea id="sf-note" rows={2} maxLength={300} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="e.g. Hair length, car model, measurements" className={`w-full rounded-xl px-4 py-3 text-[15px] mb-4 resize-none ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
        </>
      )}
      <div className="text-[12px] mb-5" style={{ color: S.muted }}>No payment now — {business.name} will contact you to confirm{cartHasService ? ' the time' : ''} and arrange payment.</div>
      <div className="sticky bottom-0 -mx-5 px-5 lg:-mx-6 lg:px-6 pt-3 pb-5" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #fff 22%)' }}>
  <button onClick={submitOrder} disabled={submitting || !customerName.trim() || cartList.length === 0} className={`w-full py-3.5 rounded-xl text-[14.5px] font-semibold ${focusRing}`} style={{ background: S.ink, color: '#fff', opacity: submitting || !customerName.trim() || cartList.length === 0 ? 0.4 : 1 }}>{submitting ? 'Sending…' : `${W.send} · ${fmt(cartTotal)}`}</button>
      </div>
    </div>
  );

  const heroTitle = business.name;
  const heroSub = business.storefront_tagline;
  const heroImages = (Array.isArray(business.hero_images) && business.hero_images.length ? business.hero_images : [business.hero_image_url]).filter(Boolean);
  const hasHero = heroImages.length > 0;
  const overlay = hasHero && overHero;

  return (
    <div style={page}>
      <style>{`
        @keyframes sf-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .sf-rise { animation: sf-rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) { .sf-rise { animation: none; } }
        .sf-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-30 transition-all duration-300" style={overlay ? { background: 'linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0) 100%)' } : { background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${S.line}` }}>
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 md:h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {business.logo_url && <img src={business.logo_url} alt="" className="w-9 h-9 md:w-11 md:h-11 rounded-xl object-cover shrink-0" style={overlay ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.9)' } : {}} />}
            <span className="text-[16px] md:text-[18px] font-bold truncate transition-colors" style={{ color: overlay ? '#fff' : S.ink, letterSpacing: '-0.01em' }}>{business.name}</span>
          </div>
          <div className="hidden md:block flex-1 max-w-sm">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: overlay ? 'rgba(255,255,255,0.85)' : S.muted }} />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" aria-label="Search products" className={`w-full rounded-full pl-10 pr-4 py-2.5 text-[13.5px] ${overlay ? 'placeholder-white/80' : ''} ${focusRing}`} style={overlay ? { background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' } : { background: S.tile, border: '1px solid transparent', color: S.ink }} />
            </div>
          </div>
          <button onClick={() => setShowCheckout(true)} className={`lg:hidden flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-semibold shrink-0 ${focusRing}`} style={cartCount ? { background: overlay ? '#fff' : S.ink, color: overlay ? S.ink : '#fff' } : overlay ? { background: 'rgba(255,255,255,0.18)', color: '#fff', backdropFilter: 'blur(10px)' } : { background: S.tile, color: S.ink }}>
            <ShoppingBag size={15} /> {cartCount || W.short}
          </button>
        </div>
      </header>
      {!hasHero && <div className="h-16 md:h-20" />}

      {/* Hero — the business's own photo and voice */}
      <section>
        <div
          ref={heroRef}
          className="relative overflow-hidden flex items-center justify-center text-center"
          style={{ minHeight: hasHero ? 'clamp(340px, 44vw, 600px)' : 'clamp(200px, 26vw, 300px)', background: hasHero ? '#222' : S.tile }}
          onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchStartX === null || heroImages.length < 2) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) > 40) setHeroIndex((i) => (i + (dx < 0 ? 1 : -1) + heroImages.length) % heroImages.length);
            setTouchStartX(null);
          }}
        >
          {heroImages.map((src, i) => (
            <img key={src} src={src} alt="" aria-hidden={i !== heroIndex % heroImages.length} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: i === heroIndex % heroImages.length ? 1 : 0, transition: 'opacity 900ms ease' }} />
          ))}
          {hasHero && <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.58) 100%)' }} />}
          {heroImages.length > 1 && (
            <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2 z-10">
              {heroImages.map((_, i) => (
                <button key={i} onClick={() => setHeroIndex(i)} aria-label={`Show banner photo ${i + 1}`} className="h-2 rounded-full transition-all" style={{ width: i === heroIndex % heroImages.length ? 22 : 8, background: i === heroIndex % heroImages.length ? '#fff' : 'rgba(255,255,255,0.5)' }} />
              ))}
            </div>
          )}
          <div className={`relative px-6 sf-rise ${hasHero ? "pt-24 pb-14 md:pt-28" : "py-12"}`}>
            {business.logo_url && !hasHero && <img src={business.logo_url} alt="" className="w-16 h-16 rounded-full object-cover mx-auto mb-4" style={{ border: '3px solid #fff' }} />}
            <h1 className="font-extrabold leading-[1.05] mb-3" style={{ fontSize: 'clamp(34px, 6vw, 60px)', letterSpacing: '-0.025em', color: hasHero ? '#fff' : S.ink, textWrap: 'balance' }}>{heroTitle}</h1>
            {heroSub && <p className="mx-auto max-w-md text-[15px] md:text-[17px] leading-relaxed" style={{ color: hasHero ? 'rgba(255,255,255,0.88)' : S.muted }}>{heroSub}</p>}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 md:px-8 pt-6 lg:pt-8 lg:grid lg:grid-cols-[1fr_340px] lg:gap-10" style={{ paddingBottom: cartCount ? '110px' : '40px' }}>
        <main>
          {storeShops.length > 1 && (
            <div className="mb-5 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: S.tile }}>
              <Store size={18} style={{ color: S.ink }} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px]" style={{ color: S.muted }}>Shopping from</div>
                <div className="relative">
                  <select aria-label="Choose which shop to order from" value={currentStoreShop?.id || ''} onChange={(e) => { setSwitchingShop(true); setStoreShopId(e.target.value); }} className={`w-full appearance-none bg-transparent pr-6 text-[15px] font-bold outline-none cursor-pointer ${focusRing}`} style={{ color: S.ink }}>
                    {storeShops.map((sh) => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
                  </select>
                  <ChevronRight size={16} className="absolute right-0 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" style={{ color: S.muted }} />
                </div>
                {currentStoreShop?.address && <div className="text-[12px] truncate" style={{ color: S.muted }}>{currentStoreShop.address}</div>}
              </div>
              {switchingShop && <Loader2 size={16} className="animate-spin shrink-0" style={{ color: S.muted }} />}
            </div>
          )}
          {/* Mobile search */}
          <div className="md:hidden relative mb-4">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" aria-label="Search products" className={`w-full rounded-full pl-10 pr-4 py-3 text-[14px] ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
          </div>

          {/* Categories + sort */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
            <div className="relative min-w-0 flex-1">
              <div ref={catRef} onScroll={updateCatFade} className="flex gap-1.5 overflow-x-auto sf-scroll" style={{ scrollbarWidth: 'none' }}>
                {hasCategories && categories.map((cat) => (
                  <button key={cat} onClick={(e) => { setActiveCategory(cat); e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }} className={`px-4 py-2 rounded-full text-[13.5px] font-semibold whitespace-nowrap transition-colors ${focusRing}`} style={activeCategory === cat ? { background: S.ink, color: '#fff' } : { background: S.tile, color: S.ink }}>{cat}</button>
                ))}
                {!hasCategories && <span className="text-[14px] font-semibold py-2">{storeProducts.length} product{storeProducts.length !== 1 ? 's' : ''}</span>}
              </div>
              {catFade.left && (
                <>
                  <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16" style={{ background: 'linear-gradient(90deg, #fff 35%, rgba(255,255,255,0))' }} />
                  <button onClick={() => scrollCats(-1)} aria-label="Show previous categories" className={`absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center ${focusRing}`} style={{ background: '#fff', color: S.ink, boxShadow: '0 2px 10px rgba(23,25,26,0.14)' }}><ChevronLeft size={16} /></button>
                </>
              )}
              {catFade.right && (
                <>
                  <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16" style={{ background: 'linear-gradient(270deg, #fff 35%, rgba(255,255,255,0))' }} />
                  <button onClick={() => scrollCats(1)} aria-label="Show more categories" className={`absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center ${focusRing}`} style={{ background: '#fff', color: S.ink, boxShadow: '0 2px 10px rgba(23,25,26,0.14)' }}><ChevronRight size={16} /></button>
                </>
              )}
            </div>
            <label className="self-end sm:self-auto shrink-0 flex items-center gap-1.5 text-[13px] rounded-full px-3.5 py-2" style={{ background: S.tile }}>
              <span style={{ color: S.muted }}>Sort</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="font-semibold bg-transparent outline-none cursor-pointer" style={{ color: S.ink }}>
                <option value="featured">Featured</option>
                <option value="low">Lowest price</option>
                <option value="high">Highest price</option>
              </select>
            </label>
          </div>

          {storeProducts.length === 0 && (
            <div className="py-20 text-center">
              <div className="text-[17px] font-bold mb-1.5">Nothing on the shelves yet</div>
              <div className="text-[14px]" style={{ color: S.muted }}>{business.name} is still adding products. Check back soon.</div>
            </div>
          )}
          {storeProducts.length > 0 && visibleProducts.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-[16px] font-bold mb-1.5">No products match "{query}"</div>
              <button onClick={() => { setQuery(''); setActiveCategory('All'); }} className={`text-[14px] font-semibold underline underline-offset-4 ${focusRing}`}>Show all products</button>
            </div>
          )}

          {sections.map((sec) => (
            <section key={sec.title || 'all'} className="mb-10">
              {sec.title && <h2 className="text-[22px] font-bold mb-4" style={{ letterSpacing: '-0.015em' }}>{sec.title}</h2>}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-x-4 gap-y-7">
                {sec.items.map((p) => <React.Fragment key={p.id}>{renderProductCard(p)}</React.Fragment>)}
              </div>
            </section>
          ))}
        </main>

        {/* Desktop order panel */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl px-6 pt-6 overflow-y-auto" style={{ border: `1px solid ${S.line}`, maxHeight: 'calc(100vh - 7.5rem)', overscrollBehavior: 'contain' }}>
            <div className="text-[18px] font-bold mb-5">{W.your}</div>
            {renderOrderSummary()}
            {cartList.length > 0 && renderCheckoutFields()}
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-5 md:px-8 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[13px]" style={{ borderTop: `1px solid ${S.line}`, color: S.muted }}>
        <div>
          <div className="font-semibold mb-0.5" style={{ color: S.ink }}>{business.name}</div>
          {business.address && <div>{business.address}</div>}
        </div>
        <div className="text-[12px]">Store powered by Xorla</div>
      </footer>

      {/* Mobile order bar */}
      {cartCount > 0 && !showCheckout && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-4 pt-3" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #fff 35%)' }}>
          <button onClick={() => setShowCheckout(true)} className={`w-full rounded-2xl py-4 px-5 flex items-center justify-between ${focusRing}`} style={{ background: S.ink, color: '#fff', boxShadow: '0 10px 30px rgba(23,25,26,0.25)' }}>
            <span className="flex items-center gap-2.5 text-[14.5px] font-semibold">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: '#fff', color: S.ink }}>{cartCount}</span>
              {W.view}
            </span>
            <span className="text-[15px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Mobile order sheet */}
      {showCheckout && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(23,25,26,0.45)' }} onClick={() => setShowCheckout(false)}>
          <div className="w-full rounded-t-3xl p-5 sf-rise" style={{ background: '#fff', maxHeight: '88vh', overflowY: 'auto', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: S.line }} />
            <div className="flex items-center justify-between mb-5">
              <div className="text-[19px] font-bold">{W.your}</div>
              <button onClick={() => setShowCheckout(false)} aria-label="Close" className={`w-9 h-9 rounded-full flex items-center justify-center ${focusRing}`} style={{ background: S.tile }}><X size={17} /></button>
            </div>
            {renderOrderSummary()}
            {cartList.length > 0 && renderCheckoutFields()}
          </div>
        </div>
      )}
    </div>
  );
}

// Public pricing page — xorla.vercel.app/pricing (no login needed)
// Design: the Pro plan is a gold card (Xorla's warm gold) on the dark teal page; everything else stays quiet so it can shine.
function PricingPage() {
  const [interval, setIntervalSel] = useState('monthly');
  const [spots, setSpots] = useState(null);
  useEffect(() => {
    document.title = 'Xorla pricing';
    if (!document.getElementById('xorla-jakarta')) {
      const link = document.createElement('link');
      link.id = 'xorla-jakarta'; link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
    sbRpc('early_supporter_spots', SB_KEY, {}).then((n) => setSpots(typeof n === 'number' ? n : null)).catch(() => {});
  }, []);

  const P = { bg: '#0A1F1C', deep: '#07171A', surface: '#0F2B26', line: 'rgba(234,245,242,0.12)', ink: '#EAF5F2', muted: '#93B5AD', teal: '#1FD9C4', gold: '#FFB020', goldDeep: '#E89A0C', onGold: '#0A1F1C' };
  const display = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
  const early = spots === null || spots > 0;
  const per = interval === 'monthly' ? 'a month' : 'a year';
  const proPrice = planPrice('pro', interval, 0, early), proRegular = planPrice('pro', interval, 0, false);
  const bizPrice = planPrice('business', interval, 0, early), bizRegular = planPrice('business', interval, 0, false);
  const taken = spots === null ? null : 100 - spots;

  const Tick = ({ t, onGold }) => (
    <li className="flex items-start gap-2.5 text-[14px] leading-snug">
      <Check size={16} strokeWidth={2.6} className="shrink-0 mt-[2px]" style={{ color: onGold ? P.onGold : P.teal }} />
      <span style={{ color: onGold ? P.onGold : P.muted }}>{t}</span>
    </li>
  );
  const Price = ({ value, regular, onGold }) => (
    <div className="mt-5">
      <div className="flex items-baseline gap-2">
        <span style={{ fontFamily: display, fontWeight: 800, fontSize: 40, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: onGold ? P.onGold : P.ink }}>{fmt(value)}</span>
        <span className="text-[14px]" style={{ color: onGold ? 'rgba(10,31,28,0.7)' : P.muted }}>{per}</span>
      </div>
      {regular > value && <div className="text-[13px] mt-1" style={{ color: onGold ? 'rgba(10,31,28,0.75)' : P.muted }}>
        <span className="line-through">{fmt(regular)}</span> for everyone else. Early-supporter price for your first 12 months.
      </div>}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: `radial-gradient(1200px 600px at 50% -10%, #12403A 0%, ${P.bg} 55%)`, color: P.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes xorla-rise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        .xorla-gold-card { animation: xorla-rise 700ms cubic-bezier(.2,.8,.2,1) 150ms both; }
        @media (prefers-reduced-motion: reduce) { .xorla-gold-card { animation: none; } }
        .xorla-pricing a:focus-visible, .xorla-pricing button:focus-visible { outline: 2px solid ${P.teal}; outline-offset: 3px; }
      `}</style>
      <div className="xorla-pricing">
        <header className="max-w-6xl mx-auto px-5 lg:px-8 py-5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5"><XorlaMark size={28} /><span style={{ fontFamily: display, fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em' }}>Xorla</span></a>
          <a href="/" className="px-4 py-2 rounded-xl text-[13.5px] font-semibold" style={{ border: `1px solid ${P.line}`, color: P.ink }}>Log in</a>
        </header>

        <main className="max-w-6xl mx-auto px-5 lg:px-8 pb-20">
          <section className="max-w-3xl pt-10 lg:pt-16 pb-10 lg:pb-14">
            <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: 'clamp(34px, 6vw, 60px)', lineHeight: 1.04, letterSpacing: '-0.035em' }}>
              Costs less than the profit on one good sale.
            </h1>
            <p className="mt-5 text-[16px] lg:text-[17px] leading-relaxed max-w-xl" style={{ color: P.muted }}>
              Every new business starts with 30 days of Pro, free and with no card. After that, pay monthly by card, transfer or USSD, and stop whenever you like.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <div role="group" aria-label="Billing period" className="inline-flex p-1 rounded-2xl" style={{ background: 'rgba(234,245,242,0.06)', border: `1px solid ${P.line}` }}>
                {[['monthly', 'Monthly'], ['yearly', 'Yearly, 2 months free']].map(([k, l]) => (
                  <button key={k} onClick={() => setIntervalSel(k)} aria-pressed={interval === k} className="px-4 py-2.5 rounded-xl text-[14px] font-semibold transition-colors" style={interval === k ? { background: P.ink, color: P.bg } : { color: P.muted }}>{l}</button>
                ))}
              </div>
              {early && taken !== null && (
                <div className="min-w-[220px]">
                  <div className="text-[13px] mb-1.5" style={{ color: P.ink }}><strong style={{ color: P.gold }}>{taken} of 100</strong> early-supporter places taken</div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(234,245,242,0.1)' }}><div className="h-full rounded-full" style={{ width: `${Math.max(3, taken)}%`, background: P.gold }} /></div>
                </div>
              )}
            </div>
          </section>

          <section aria-label="Plans" className="grid gap-5 lg:grid-cols-[1fr_1.12fr_1fr] lg:items-center">
            {/* Free */}
            <div className="order-3 lg:order-1 rounded-[26px] p-7" style={{ border: `1px solid ${P.line}`, background: 'rgba(15,43,38,0.5)' }}>
              <h2 style={{ fontFamily: display, fontWeight: 700, fontSize: 21 }}>Free</h2>
              <p className="text-[14px] mt-1" style={{ color: P.muted }}>Run a one-person shop properly.</p>
              <div className="mt-5" style={{ fontFamily: display, fontWeight: 800, fontSize: 40, letterSpacing: '-0.03em' }}>₦0</div>
              <ul className="space-y-2.5 mt-6 mb-7">
                {['1 shop, run by you', 'Up to 20 products or services', 'Sales, expenses, invoices and receipts', 'Your own online shop link', '10 questions to Oga a month'].map((t) => <Tick key={t} t={t} />)}
              </ul>
              <a href="/" className="block text-center rounded-2xl py-3.5 text-[15px] font-semibold" style={{ border: `1px solid ${P.line}`, color: P.ink }}>Start free</a>
            </div>

            {/* Pro — the gold card */}
            <div className="xorla-gold-card order-1 lg:order-2 relative rounded-[30px] p-8 lg:py-10" style={{ background: `linear-gradient(155deg, #FFC24A 0%, ${P.gold} 45%, ${P.goldDeep} 100%)`, color: P.onGold, boxShadow: '0 30px 80px rgba(255,176,32,0.22), 0 2px 0 rgba(255,255,255,0.35) inset' }}>
              <div className="flex items-center justify-between">
                <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em' }}>Pro</h2>
                <span className="text-[12.5px] font-semibold px-3 py-1 rounded-full" style={{ background: P.onGold, color: P.gold }}>Recommended</span>
              </div>
              <p className="text-[14.5px] mt-1" style={{ color: 'rgba(10,31,28,0.78)' }}>For a growing shop with staff.</p>
              <Price value={proPrice} regular={proRegular} onGold />
              <ul className="space-y-2.5 mt-6 mb-8">
                {['Up to 3 staff, each with their own login', 'Unlimited products and services', '150 questions to Oga a month, in 5 languages', '100 automatic WhatsApp payment reminders a month', 'Weekly or monthly business summaries on WhatsApp'].map((t) => <Tick key={t} t={t} onGold />)}
              </ul>
              <a href="/" className="block text-center rounded-2xl py-4 text-[15.5px] font-bold" style={{ background: P.onGold, color: P.gold }}>Start your 30-day free trial</a>
              <p className="text-[12.5px] text-center mt-3" style={{ color: 'rgba(10,31,28,0.7)' }}>No card needed to start.</p>
            </div>

            {/* Business */}
            <div className="order-2 lg:order-3 rounded-[26px] p-7" style={{ border: `1px solid ${P.line}`, background: 'rgba(15,43,38,0.5)' }}>
              <h2 style={{ fontFamily: display, fontWeight: 700, fontSize: 21 }}>Business</h2>
              <p className="text-[14px] mt-1" style={{ color: P.muted }}>For several shops or warehouses.</p>
              <Price value={bizPrice} regular={bizRegular} />
              <p className="text-[13px] mt-2" style={{ color: P.muted }}>Includes 3 locations. Each extra one is {fmt(PLAN_PRICES.extraShop[interval])} {per}.</p>
              <ul className="space-y-2.5 mt-6 mb-7">
                {['Everything in Pro', 'Up to 10 staff across your shops', 'Deliveries, stock transfers and requests between locations', '500 questions to Oga and 500 reminders a month', 'See every shop together, or one at a time'].map((t) => <Tick key={t} t={t} />)}
              </ul>
              <a href="/" className="block text-center rounded-2xl py-3.5 text-[15px] font-semibold" style={{ border: `1px solid ${P.teal}`, color: P.teal }}>Start your 30-day free trial</a>
            </div>
          </section>

          <section aria-label="Our promises" className="mt-20 lg:mt-28">
            <h2 className="max-w-xl" style={{ fontFamily: display, fontWeight: 800, fontSize: 'clamp(26px, 3.6vw, 36px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>No surprises. Written down.</h2>
            <div className="grid gap-x-10 gap-y-7 mt-9 sm:grid-cols-2">
              {[
                [CalendarClock, 'A reminder before every renewal', 'We tell you 3 days before your plan ends. Nothing renews by surprise.'],
                [Archive, 'Your records stay yours', 'Stop paying and you move to Free with every sale, invoice and customer still there.'],
                [Tag, 'Prices you can plan around', 'Any change is announced 30 days ahead, and current subscribers keep their price for 12 months.'],
                [Lock, 'Safe payments', 'Card, transfer and USSD payments are handled by Paystack. Xorla never sees your card details.'],
              ].map(([Icon, title, body]) => (
                <div key={title} className="flex gap-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(31,217,196,0.1)' }}><Icon size={20} style={{ color: P.teal }} /></div>
                  <div>
                    <h3 className="text-[15.5px] font-semibold">{title}</h3>
                    <p className="text-[14px] leading-relaxed mt-1 max-w-sm" style={{ color: P.muted }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="mt-20 pt-8 flex flex-wrap items-center justify-between gap-3 text-[13px]" style={{ borderTop: `1px solid ${P.line}`, color: P.muted }}>
            <span>Xorla is made by PointBlank Softworks Ltd.</span>
            <a href="/" style={{ color: P.teal }}>Open Xorla</a>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function Root() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const storeMatch = path.match(/^\/store\/([A-Za-z0-9]+)/);
  if (storeMatch) return <Storefront businessCode={storeMatch[1]} />;
  if (path === '/pricing' || path === '/pricing/') return <PricingPage />;
  return <XorlaApp />;
}
