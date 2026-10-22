// Xorla: public screens (loaded only when needed). Shared code lives in ../App.jsx.
import React, { useState, useEffect, useRef } from 'react';
import { Check, CalendarClock, Archive, Tag, Lock, TrendingUp, ShoppingBag, Package, MousePointerClick, MessageCircle, ShoppingBasket, Shirt, Pill, Scissors, UtensilsCrossed, Hotel, PartyPopper, Car, Wrench, Boxes, Sun, Moon, Sparkles, Users, Bike, ArrowRight, ChevronRight, Bell, Store, FileText, WifiOff, Smartphone, CloudUpload, ShieldCheck, CreditCard, Minus, Plus } from 'lucide-react';
import { LP, LP_THEMES, PLAN_PRICES, SB_KEY, XorlaMark, fmt, planPrice, sbRpc, shadow, tint } from '../App.jsx';

// Public pricing page — xorla.vercel.app/pricing (no login needed)
// Design: the Pro plan is a gold card (Xorla's warm gold) on the dark teal page; everything else stays quiet so it can shine.
function PricingPage() {
  const [interval, setIntervalSel] = useState('monthly');
  const [spots, setSpots] = useState(null);
  useEffect(() => {
    document.title = 'Xorla pricing';
    sbRpc('early_supporter_spots', SB_KEY, {}).then((n) => setSpots(typeof n === 'number' ? n : null)).catch(() => {});
  }, []);

  const P = { bg: '#0A1F1C', deep: '#07171A', surface: '#0F2B26', line: 'rgba(234,245,242,0.12)', ink: '#EAF5F2', muted: '#93B5AD', teal: '#1FD9C4', gold: '#FFB020', goldDeep: '#E89A0C', onGold: '#0A1F1C' };
  const display = "'Poppins', 'Inter', system-ui, sans-serif";
  const early = spots === null || spots > 0;
  const per = interval === 'monthly' ? 'a month' : 'a year';
  const proPrice = planPrice('pro', interval, 0, early), proRegular = planPrice('pro', interval, 0, false);
  const bizPrice = planPrice('business', interval, 0, early), bizRegular = planPrice('business', interval, 0, false);
  const taken = spots === null ? null : 100 - spots;

  const Tick = ({ t, onGold }) => (t.endsWith(':')
    ? <li className="text-[12.5px] font-bold uppercase tracking-wide pt-0.5" style={{ color: onGold ? P.onGold : P.teal }}>{t.slice(0, -1)}</li> :
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
    <div className="min-h-screen" style={{ background: `radial-gradient(1200px 600px at 50% -10%, #12403A 0%, ${P.bg} 55%)`, color: P.ink, fontFamily: "'Poppins', 'Inter', system-ui, sans-serif" }}>
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
              Every new business gets 30 days of everything, Business included, free and with no card. Then choose the plan that fits, pay by card, transfer or USSD, and stop whenever you like.
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
              <p className="text-[14px] mt-1" style={{ color: P.muted }}>Run a one-person business properly.</p>
              <div className="mt-5" style={{ fontFamily: display, fontWeight: 800, fontSize: 40, letterSpacing: '-0.03em' }}>₦0</div>
              <ul className="space-y-2.5 mt-6 mb-7">
                {['1 location, run by you', 'Up to 20 products or services', 'Sales, expenses, invoices and receipts', 'Your own online shop link', 'Online payments, appointments, deliveries and reports', '10 room or rental bookings and 10 questions to Oga a month'].map((t) => <Tick key={t} t={t} />)}
              </ul>
              <a href="/" className="block text-center rounded-2xl py-3.5 text-[15px] font-semibold" style={{ border: `1px solid ${P.line}`, color: P.ink }}>Start free</a>
            </div>

            {/* Pro — the gold card */}
            <div className="xorla-gold-card order-1 lg:order-2 relative rounded-[30px] p-8 lg:py-10" style={{ background: `linear-gradient(155deg, #FFC24A 0%, ${P.gold} 45%, ${P.goldDeep} 100%)`, color: P.onGold, boxShadow: '0 30px 80px rgba(255,176,32,0.22), 0 2px 0 rgba(255,255,255,0.35) inset' }}>
              <div className="flex items-center justify-between">
                <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em' }}>Pro</h2>
                <span className="text-[12.5px] font-semibold px-3 py-1 rounded-full" style={{ background: P.onGold, color: P.gold }}>Recommended</span>
              </div>
              <p className="text-[14.5px] mt-1" style={{ color: 'rgba(10,31,28,0.78)' }}>For a growing business with staff.</p>
              <Price value={proPrice} regular={proRegular} onGold />
              <ul className="space-y-2.5 mt-6 mb-8">
                {['Everything in Free, plus:', 'Up to 3 staff, each with their own login. They see only what you allow', 'Unlimited products, services and room bookings', '150 questions to Oga a month, in 5 languages', '100 automatic WhatsApp messages a month: payment reminders, booking confirmations and summaries', 'Your brand only: no "Powered by Xorla" on your shop and receipts', 'Unlimited papers in your document vault'].map((t) => <Tick key={t} t={t} onGold />)}
              </ul>
              <a href="/" className="block text-center rounded-2xl py-4 text-[15.5px] font-bold" style={{ background: P.onGold, color: P.gold }}>Start your 30-day free trial</a>
              <p className="text-[12.5px] text-center mt-3" style={{ color: 'rgba(10,31,28,0.7)' }}>No card needed to start.</p>
            </div>

            {/* Business */}
            <div className="order-2 lg:order-3 rounded-[26px] p-7" style={{ border: `1px solid ${P.line}`, background: 'rgba(15,43,38,0.5)' }}>
              <h2 style={{ fontFamily: display, fontWeight: 700, fontSize: 21 }}>Business</h2>
              <p className="text-[14px] mt-1" style={{ color: P.muted }}>For several branches, shops or warehouses.</p>
              <Price value={bizPrice} regular={bizRegular} />
              <p className="text-[13px] mt-2" style={{ color: P.muted }}>Includes 3 locations. Each extra one is {fmt(PLAN_PRICES.extraShop[interval])} {per}.</p>
              <ul className="space-y-2.5 mt-6 mb-7">
                {['Everything in Pro, plus:', 'Up to 10 staff across your locations', 'Deliveries, stock transfers and requests between locations', '500 questions to Oga and 500 reminders a month', 'See every location together, or one at a time'].map((t) => <Tick key={t} t={t} />)}
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
            <span className="flex gap-4"><a href="/privacy" style={{ color: P.teal }}>Privacy</a><a href="/terms" style={{ color: P.teal }}>Terms</a><a href="/ride" style={{ color: P.teal }}>Ride with Xorla</a><a href="/" style={{ color: P.teal }}>Open Xorla</a></span>
          </footer>
        </main>
      </div>
    </div>
  );
}

// ============ Privacy policy and terms of service (public pages: /privacy and /terms) ============
// Fill these in before launch. Until LEGAL.email is set, the pages point people to the in-app Help instead.
const LEGAL = {
  company: 'PointBlank Softworks Ltd',
  rc: '',                     // CAC registration number, e.g. 'RC 1234567'
  address: 'Abia State, Nigeria',
  email: '',                  // e.g. a support or privacy inbox
  updated: '8 October 2026',
};
const legalContact = () => (LEGAL.email ? `email ${LEGAL.email}` : 'use Settings → Help in the Xorla app');

const PRIVACY_SECTIONS = [
  ['Who we are', [
    `Xorla is a business management app made by ${LEGAL.company}${LEGAL.rc ? ` (${LEGAL.rc})` : ''}, ${LEGAL.address} ("we", "us"). This policy explains what personal data Xorla handles, why, and the choices you have. It is written to meet the Nigeria Data Protection Act 2023 and the Nigeria Data Protection Commission's guidance.`,
    'Xorla handles data in two different roles, and it matters which one applies:',
    ['For your own account (business owners and staff), we decide how the data is used. We are the data controller.',
     'For the records a business keeps about its own customers (names, phone numbers, sales, invoices, bookings, appointments and storefront orders), the business is the data controller and we process that data only to run Xorla for them. If you are a customer of a business that uses Xorla, please contact that business first about your data. We will help them answer you.'],
  ]],
  ['What we collect', [
    ['Account details: your name, email address, password (stored only in scrambled form), phone number, business name, address, logo and the business type you choose.',
     'Staff details: the names of staff the owner invites, which branch they work at, and when they were last active, so the owner can see who is on shift.',
     'Business records you enter: sales, expenses, invoices, products and services, stock, bookings, appointments, deposits and refunds. These can include your customers\' names, phone numbers and what they owe.',
     'Storefront requests: when a customer orders or books on a business\'s storefront, the name, phone number, note and chosen time they give.',
     'Payments for your Xorla plan: handled by Paystack. We receive confirmation of the payment, the amount, and the card type and last four digits so you can recognise it. We never see or store full card numbers.',
     'Device and usage details: the notification settings on your device if you turn notifications on, the browser and device type, and basic technical logs our providers keep to run the service securely.'],
  ]],
  ['How we use it, and why we are allowed to', [
    ['To provide Xorla: storing your records, showing your reports, running your storefront and bookings, and letting your staff work with you. Basis: our contract with you.',
     'To bill your plan and prevent fraud. Basis: contract, and our legal obligations to keep financial records.',
     'To send messages you switch on, such as WhatsApp payment reminders to your customers, business summaries, and app notifications. Basis: your instructions, and your consent where required. You can switch these off at any time in Settings.',
     'To answer questions you ask Oga, Xorla\'s assistant. Basis: contract, at your request. See "Oga and AI" below.',
     'To keep Xorla secure, fix problems and improve it, using totals rather than individual records wherever we can. Basis: our legitimate interest in running a safe, reliable service.',
     'To contact you about your account, your plan, or important changes. We will not send you marketing without your consent, and you can unsubscribe at any time.'],
    'We do not sell personal data, and we do not use your customers\' details to advertise to them.',
  ]],
  ['Oga and AI', [
    'When you ask Oga a question, Xorla sends the question and a summary of the relevant business figures to an AI provider (Anthropic) to write the answer. The summary can include customer names and amounts owed when your question needs them. The provider processes this only to answer you and does not use it to train its models. Oga\'s answers are suggestions to help you think, not professional financial, legal or tax advice. Xorla never makes automated decisions about you that have legal or similarly significant effects.',
  ]],
  ['Who we share it with', [
    'We share data only with providers who help us run Xorla, under contracts that require them to protect it and use it only for us:',
    ['Supabase: database, sign-in and file storage.',
     'Vercel: hosting of the Xorla website and app.',
     'Paystack: plan payments, and later, payments to businesses through their storefront.',
     'Anthropic: answers to questions asked to Oga.',
     'Meta (WhatsApp Business): reminder and summary messages, only when the business switches them on.',
     'Google, Apple and Mozilla: delivering app notifications to your device, only if you turn them on. Google Fonts also provides the typefaces the pages use.'],
    'We may also share data when the law requires it, to protect people\'s safety, or as part of a merger or sale of our business, in which case this policy continues to apply.',
  ]],
  ['Data stored outside Nigeria', [
    'Some of these providers store or process data on servers outside Nigeria. When that happens we rely on the safeguards the Nigeria Data Protection Act allows, such as contracts that require the same level of protection as Nigerian law, and we choose providers with strong security standards.',
  ]],
  ['How long we keep it', [
    ['Your account and business records: for as long as your account is open.',
     'If you close your account, we delete or anonymise your records within 90 days, except what the law requires us to keep.',
     'Payment and billing records: kept for up to 6 years, as Nigerian tax law requires.',
     'Records a business keeps about its customers: the business decides how long to keep them, and can delete them in Xorla at any time.'],
  ]],
  ['Keeping it safe', [
    'Data is encrypted while it travels and when stored by our providers. Each business can only ever see its own records, enforced inside the database itself. Staff see only the branches they work at. You can add a PIN lock on your phone. If a data breach is likely to put people at risk, we will tell the Nigeria Data Protection Commission within 72 hours of becoming aware of it, and tell the people affected without delay.',
  ]],
  ['Your rights', [
    'Under the Nigeria Data Protection Act you have the right to:',
    ['be told how your data is used (this policy);',
     'get a copy of your data;',
     'have wrong data corrected;',
     'have your data deleted, or its use restricted, where the law allows;',
     'object to us using your data for our legitimate interests or for marketing;',
     'receive your data in a format you can take elsewhere;',
     'withdraw consent at any time, without affecting what was done before.'],
    `To use any of these rights, ${legalContact()}. We will reply within 30 days. If you are not satisfied with our answer, you can complain to the Nigeria Data Protection Commission (ndpc.gov.ng).`,
  ]],
  ['Children', [
    'Xorla is for businesses and is not meant for anyone under 18. We do not knowingly collect children\'s data. If you think a child has given us their details, please tell us and we will delete them.',
  ]],
  ['Cookies and storage on your device', [
    'Xorla keeps a few small items on your device to work: your sign-in, your PIN lock, and preferences such as which branch you were viewing. We do not use advertising or tracking cookies.',
  ]],
  ['Changes to this policy', [
    'If we make important changes, we will tell you in the app or by email before they take effect. The date at the top shows when this policy last changed.',
  ]],
  ['Contact', [
    `${LEGAL.company}, ${LEGAL.address}. For anything about your data, ${legalContact()}.`,
  ]],
];

const TERMS_SECTIONS = [
  ['Agreement', [
    `These terms are an agreement between you and ${LEGAL.company}${LEGAL.rc ? ` (${LEGAL.rc})` : ''}, ${LEGAL.address}, the makers of Xorla. By creating an account or using Xorla you agree to them. If you use Xorla for a business, you confirm you are allowed to accept these terms for that business.`,
  ]],
  ['What Xorla is', [
    'Xorla helps you record sales and expenses, track stock, send invoices and reminders, take bookings and appointments, run an online storefront, and understand your numbers. Xorla is a tool. It does not hold your money, and it is not a bank, a payment provider, an accountant or a lawyer.',
  ]],
  ['Your account and your team', [
    ['Give accurate details, and keep your password private. You are responsible for what happens under your account.',
     'The business owner is responsible for the staff they invite and what those staff do in Xorla. Remove staff who leave.',
     'You must be at least 18 years old.'],
  ]],
  ['Plans, trial and payment', [
    ['New businesses get a 30-day free trial of the Business plan. No card is needed.',
     'After the trial you can stay on the Free plan or pay for Pro or Business. Prices are in naira and shown on the Pricing page and in the app before you pay.',
     'Paid plans run monthly or yearly. If auto-renew is on, we charge your saved card at the end of each period. You can turn auto-renew off at any time, and your plan stays active until the end of the period you paid for.',
     'Early-supporter prices apply for 12 months from the first payment, then the normal price applies. We will remind you before a renewal at a different price.',
     'Payments are processed by Paystack. Fees already paid are not refunded for unused time, unless the law requires it or we fail to provide the service.',
     'If a plan ends, your records stay safe. Features beyond the Free plan pause until you upgrade, and nothing you recorded is deleted.',
     'We may change prices for future periods. We will tell you at least 30 days before a change affects you.'],
  ]],
  ['Your data and your customers', [
    ['Your business records belong to you. You can export or delete them.',
     'When you record details about your customers or receive orders and bookings through your storefront, you are responsible for having a lawful reason to keep their details, and for answering their questions about it. Our Privacy Policy explains how we help.',
     'Only send WhatsApp messages to customers who would expect to hear from you, and stop when they ask you to.'],
  ]],
  ['Your storefront, bookings and deposits', [
    ['Sales, bookings, appointments, deposits and refunds made through your storefront are between you and your customer. You set your prices, your deposit and cancellation rules, and you are responsible for keeping them, including sending refunds you owe.',
     'Xorla shows customers only the times and rooms you are free, based on what you and your team record. Keep your records up to date so customers are not double-booked.'],
  ]],
  ['Fair use', [
    'Do not use Xorla to break the law, mislead or defraud anyone, send spam, sell prohibited goods or services, or try to access another business\'s data or interfere with how Xorla works. We may suspend accounts that do, after warning you where reasonable.',
  ]],
  ['Oga and reports', [
    'Oga\'s answers, and Xorla\'s reports and suggestions, are based on what you record and are meant to help you decide. They are not professional financial, tax or legal advice. You remain responsible for your tax filings and business decisions.',
  ]],
  ['Availability', [
    'We work hard to keep Xorla running and your data safe, but we cannot promise it will never be interrupted, for example during maintenance or problems with our providers or your internet connection. We will give notice of planned maintenance where we can.',
  ]],
  ['Our liability', [
    'To the extent the law allows, we are not responsible for indirect losses such as lost profits or lost business opportunities, and our total responsibility to you for any claim is limited to what you paid us for Xorla in the 12 months before the claim. Nothing in these terms limits rights you have that the law does not allow us to limit.',
  ]],
  ['Ending your account', [
    `You can stop using Xorla at any time. To close your account and have your data deleted, ${legalContact()}. We may close accounts that seriously or repeatedly break these terms. Before closing an account for any other reason, we will give at least 30 days' notice so you can export your records.`,
  ]],
  ['Changes to these terms', [
    'If we make important changes, we will tell you in the app or by email at least 14 days before they take effect. If you keep using Xorla after that, the new terms apply.',
  ]],
  ['Law and disputes', [
    'These terms are governed by the laws of the Federal Republic of Nigeria. If something goes wrong, please contact us first. Most problems can be solved quickly. If we cannot resolve a dispute together within 30 days, either of us may take it to the courts of Nigeria.',
  ]],
  ['Contact', [
    `${LEGAL.company}, ${LEGAL.address}. For any question about these terms, ${legalContact()}.`,
  ]],
];

function LegalPage({ kind }) {
  const isPrivacy = kind === 'privacy';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const title = isPrivacy ? 'Privacy policy' : 'Terms of service';
  useEffect(() => {
    document.title = `Xorla ${title.toLowerCase()}`;
  }, [title]);
  const P = { bg: '#0A1F1C', line: 'rgba(234,245,242,0.12)', ink: '#EAF5F2', muted: '#A9C5BE', teal: '#1FD9C4' };
  const display = "'Poppins', 'Inter', system-ui, sans-serif";
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="min-h-screen" style={{ background: P.bg, color: P.ink, fontFamily: "'Poppins', 'Inter', system-ui, sans-serif" }}>
      <header className="max-w-3xl mx-auto px-5 py-5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5"><XorlaMark size={26} /><span style={{ fontFamily: display, fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>Xorla</span></a>
        <a href={isPrivacy ? '/terms' : '/privacy'} className="text-[13px] font-medium" style={{ color: P.teal }}>{isPrivacy ? 'Terms of service' : 'Privacy policy'}</a>
      </header>
      <main className="max-w-3xl mx-auto px-5 pb-20">
        <h1 className="pt-6" style={{ fontFamily: display, fontWeight: 800, fontSize: 'clamp(30px, 5vw, 44px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{title}</h1>
        <p className="mt-3 text-[14px]" style={{ color: P.muted }}>Last updated {LEGAL.updated}</p>
        <nav aria-label="Contents" className="mt-8 rounded-2xl p-5" style={{ border: `1px solid ${P.line}` }}>
          <div className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: P.muted }}>Contents</div>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[14px]">
            {sections.map(([h], i) => <li key={h}><a href={`#${slug(h)}`} style={{ color: P.ink }}><span style={{ color: P.muted }}>{i + 1}.</span> {h}</a></li>)}
          </ol>
        </nav>
        {sections.map(([h, blocks], i) => (
          <section key={h} id={slug(h)} className="mt-10 scroll-mt-6">
            <h2 className="text-[20px] mb-3" style={{ fontFamily: display, fontWeight: 700, letterSpacing: '-0.01em' }}>{i + 1}. {h}</h2>
            {blocks.map((b, j) => Array.isArray(b)
              ? <ul key={j} className="mt-3 space-y-2 text-[15px] leading-relaxed list-disc pl-5" style={{ color: P.muted }}>{b.map((li) => <li key={li}>{li}</li>)}</ul>
              : <p key={j} className="mt-3 text-[15px] leading-relaxed" style={{ color: P.muted }}>{b}</p>)}
          </section>
        ))}
        <footer className="mt-16 pt-6 flex flex-wrap justify-between gap-3 text-[13px]" style={{ borderTop: `1px solid ${P.line}`, color: P.muted }}>
          <span>Xorla is made by {LEGAL.company}.</span>
          <span className="flex gap-4"><a href="/pricing" style={{ color: P.teal }}>Pricing</a><a href="/" style={{ color: P.teal }}>Open Xorla</a></span>
        </footer>
      </main>
    </div>
  );
}
const LP_DISPLAY = "'Unbounded', 'Inter', system-ui, sans-serif";
const LP_BODY = "'Poppins', 'Inter', system-ui, sans-serif";
const LP_MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

// Numbers that count up when they come into view (or when they change)
function LpCount({ value, prefix = '₦', ms = 900 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(0);
  const [seen, setSeen] = useState(false);
  const from = useRef(0);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    if (!('IntersectionObserver' in window)) { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!seen) return undefined;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(value); from.current = value; return undefined; }
    const a = from.current, t0 = performance.now(); let raf;
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3); setShown(Math.round(a + (value - a) * e)); if (k < 1) raf = requestAnimationFrame(step); else from.current = value; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [value, seen]);
  return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>{prefix}{shown.toLocaleString('en-NG')}</span>;
}

// The last word of the headline keeps changing: wahala, stress, headache...
const LP_WORDS = ['wahala.', 'stress.', 'headache.', 'guesswork.', 'palava.'];
function LpRotate({ words, still }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (still) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % words.length), 2400);
    return () => clearInterval(t);
  }, [still, words.length]);
  return (
    <span className="lp-rot" style={{ display: 'inline-grid', verticalAlign: 'bottom', overflow: 'hidden', paddingBottom: '0.08em', marginBottom: '-0.08em' }}>
      {/* the longest word sets the width, so nothing around it jumps */}
      <span style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{words.reduce((a, w) => (w.length > a.length ? w : a), '')}</span>
      <span key={i} className="lp-rot-word" style={{ gridArea: '1 / 1', color: LP.accent }}>{words[i]}</span>
    </span>
  );
}

const LP_RECEIPT = [['Indomie Super Pack ×2', 1900], ['Peak Milk tin ×3', 1950], ['Hair braiding (Ada)', 15000], ['Room 204, 2 nights', 70000], ['Delivery to Aba Road', 1500]];
function LandingReceipt({ still }) {
  const total = LP_RECEIPT.reduce((a, [, v]) => a + v, 0);
  return (
    <div className={`lp-receipt ${still ? 'lp-still' : ''}`} style={{ fontFamily: LP_MONO }} aria-label={`A receipt for today: total ${fmt(total)}, profit ${fmt(42500)}`}>
      <div className="text-center">
        <div className="text-[13px] font-semibold tracking-wide">AMAKA STORES</div>
        <div className="text-[10.5px]" style={{ color: '#7F918C' }}>Ikot Ekpene Road, Umuahia</div>
        <div className="lp-dash my-2.5" />
      </div>
      {LP_RECEIPT.map(([d, v], i) => (
        <div key={d} className="lp-line flex justify-between gap-3 text-[11.5px] leading-[1.9]" style={{ animationDelay: `${0.6 + i * 0.3}s` }}><span className="truncate">{d}</span><span className="shrink-0">{fmt(v)}</span></div>
      ))}
      <div className="lp-line lp-dash my-2" style={{ animationDelay: `${0.6 + LP_RECEIPT.length * 0.3}s` }} />
      <div className="lp-line flex justify-between text-[12.5px] font-semibold" style={{ animationDelay: `${0.72 + LP_RECEIPT.length * 0.3}s` }}><span>Sales today</span><span>{fmt(total)}</span></div>
      <div className="lp-stamp mt-3 rounded-lg px-3 py-2 text-center" style={{ animationDelay: `${1.05 + LP_RECEIPT.length * 0.3}s` }}>
        <div className="text-[10px]">PROFIT TODAY</div>
        <div className="text-[19px] font-semibold leading-tight">{fmt(42500)}</div>
      </div>
      <div className="text-center text-[10px] mt-2.5" style={{ color: '#7F918C' }}>Recorded on Xorla</div>
    </div>
  );
}

function LandingPhone() {
  const bars = [38, 52, 44, 68, 58, 80, 92];
  return (
    <div className="lp-phone" aria-hidden>
      <div className="lp-phone-screen" style={{ fontFamily: "'Poppins', 'Inter', sans-serif" }}>
        <div className="flex items-center justify-between px-4 pt-5">
          <div className="flex items-center gap-1.5"><XorlaMark size={16} /><span className="text-[11px] font-bold text-white">Xorla</span></div>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: 'rgba(255,255,255,0.08)', color: '#EAF6F2' }}>AO</span>
        </div>
        <div className="px-4 mt-3 text-[10.5px]" style={{ color: '#93B0AA' }}>Good evening, Amaka</div>
        <div className="mx-3 mt-2 rounded-2xl p-3.5" style={{ background: 'linear-gradient(160deg, #164A41, #0F2925)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-[9.5px]" style={{ color: '#93B0AA' }}>Profit today</div>
          <div className="text-[22px] font-bold leading-tight" style={{ color: '#1FD9C4' }}>{fmt(42500)}</div>
          <div className="text-[9px] mt-0.5" style={{ color: '#93B0AA' }}>Up {fmt(6100)} on yesterday</div>
          <div className="flex items-end gap-1 h-12 mt-2.5">{bars.map((h, i) => <span key={i} className="lp-bar flex-1 rounded-sm" style={{ height: `${h}%`, background: i === bars.length - 1 ? '#FFB020' : 'rgba(31,217,196,0.35)', animationDelay: `${0.3 + i * 0.08}s` }} />)}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mx-3 mt-2">
          <div className="rounded-xl p-2.5" style={{ background: '#13322C' }}><div className="text-[8.5px]" style={{ color: '#93B0AA' }}>Owed to you</div><div className="text-[12px] font-bold text-white">{fmt(18200)}</div></div>
          <div className="rounded-xl p-2.5" style={{ background: '#13322C' }}><div className="text-[8.5px]" style={{ color: '#93B0AA' }}>Low stock</div><div className="text-[12px] font-bold" style={{ color: '#FFB020' }}>3 items</div></div>
        </div>
        <div className="mx-3 mt-2 rounded-xl overflow-hidden" style={{ background: '#13322C' }}>
          {[['Hair braiding', 'Ada', 15000], ['Peak Milk ×3', 'Tolu', 1950], ['Indomie ×2', 'Tolu', 1900]].map(([d, w, v], i) => (
            <div key={d} className="flex items-center justify-between px-3 py-2" style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span><span className="block text-[10px] font-semibold text-white">{d}</span><span className="block text-[8.5px]" style={{ color: '#54706A' }}>by {w}</span></span>
              <span className="text-[10px] font-semibold text-white">{fmt(v)}</span>
            </div>
          ))}
        </div>
        <div className="absolute left-0 right-0 bottom-0 h-12 flex items-center justify-around px-4" style={{ background: '#0F2925', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {[TrendingUp, ShoppingBag, CalendarClock, Package].map((Ic, i) => <Ic key={i} size={15} style={{ color: i === 0 ? '#FFB020' : '#54706A' }} />)}
        </div>
      </div>
    </div>
  );
}

// Try it: tap products to record sales, and watch the day add up (nothing is saved; it's a demo)
const LP_DEMO = [['Indomie', 950, 720, '🍜'], ['Peak Milk', 650, 520, '🥛'], ['Coke 50cl', 400, 300, '🥤'], ['Bread', 1200, 950, '🍞'], ['Eggs, crate', 4800, 4200, '🥚'], ['Sugar 1kg', 1500, 1180, '🧂']];
function LandingDemo() {
  const [sales, setSales] = useState([]);
  const [receipt, setReceipt] = useState(false);
  const total = sales.reduce((a, s) => a + s.price, 0);
  const profit = sales.reduce((a, s) => a + s.price - s.cost, 0);
  const add = ([name, price, cost, icon]) => { setReceipt(false); setSales((x) => [{ id: Date.now() + Math.random(), name, price, cost, icon }, ...x].slice(0, 30)); };
  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-4 items-stretch">
      <div className="rounded-[28px] p-5 sm:p-6" style={{ background: LP.card, border: `1px solid ${LP.line}` }}>
        <div className="flex items-center justify-between"><span className="text-[15px] font-bold">Tap what you sold</span><span className="text-[12.5px]" style={{ color: LP.faint }}>Price is filled in</span></div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {LP_DEMO.map((p) => (
            <button key={p[0]} onClick={() => add(p)} className="lp-focus lp-press rounded-2xl p-3.5 text-left" style={{ background: LP.bg2, border: `1px solid ${LP.line}` }}>
              <span className="text-[24px] leading-none" aria-hidden>{p[3]}</span>
              <span className="block mt-2 text-[14px] font-semibold">{p[0]}</span>
              <span className="block text-[13px]" style={{ color: LP.dim }}>{fmt(p[1])}</span>
            </button>
          ))}
        </div>
        {/* Phones: see the totals change right under your thumb */}
        <div className="lg:hidden mt-3 grid grid-cols-2 gap-2" aria-live="polite">
          <div className="rounded-xl px-3.5 py-2.5" style={{ background: LP.bg2 }}><div className="text-[11.5px]" style={{ color: LP.faint }}>Sales today</div><div className="text-[18px] font-bold" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.03em' }}><LpCount value={total} ms={400} /></div></div>
          <div className="rounded-xl px-3.5 py-2.5" style={{ background: LP.tint }}><div className="text-[11.5px]" style={{ color: LP.faint }}>Profit today</div><div className="text-[18px] font-bold" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.03em', color: LP.accent }}><LpCount value={profit} ms={400} /></div></div>
        </div>
        <p className="mt-4 text-[13px]" style={{ color: LP.faint }}>This is a demo. Nothing you tap here is saved.</p>
      </div>
      <div className="rounded-[28px] p-5 sm:p-6 flex flex-col" style={{ background: '#0A1F1C', color: '#EAF6F2', minHeight: 360, border: `1px solid ${LP.line}` }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: '#13322C' }}><div className="text-[12px]" style={{ color: '#93B0AA' }}>Sales today</div><div className="text-[26px] font-bold mt-0.5" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.03em' }}><LpCount value={total} ms={450} /></div></div>
          <div className="rounded-2xl p-4" style={{ background: 'rgba(31,217,196,0.12)', border: '1px solid rgba(31,217,196,0.3)' }}><div className="text-[12px]" style={{ color: '#93B0AA' }}>Profit today</div><div className="text-[26px] font-bold mt-0.5" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.03em', color: '#1FD9C4' }}><LpCount value={profit} ms={450} /></div></div>
        </div>
        <div className="mt-3 flex-1 rounded-2xl overflow-hidden" style={{ background: '#13322C' }}>
          {sales.length === 0 ? (
            <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center px-6 gap-2" style={{ color: '#93B0AA' }}><MousePointerClick size={22} /><span className="text-[14px]">Tap a product to record your first sale</span></div>
          ) : (
            <div className="max-h-[210px] overflow-y-auto">
              {sales.map((s, i) => (
                <div key={s.id} className={`flex items-center justify-between px-4 py-2.5 text-[14px] ${i === 0 ? 'lp-new' : ''}`} style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <span className="flex items-center gap-2.5"><span aria-hidden>{s.icon}</span>{s.name}</span><span className="font-semibold">{fmt(s.price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {receipt && sales.length > 0 && (
          <div className="lp-new mt-3 rounded-2xl rounded-tl-md px-4 py-3 text-[13px] leading-relaxed" style={{ background: '#005C4B', color: '#E9FFF6' }}>
            Thank you for shopping at Amaka Stores! {sales.length} item{sales.length !== 1 ? 's' : ''}, total {fmt(total)}. See you again soon.
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => setReceipt(true)} disabled={!sales.length} className="lp-focus h-11 rounded-full text-[14px] font-semibold flex items-center justify-center gap-2" style={{ background: sales.length ? '#25D366' : 'rgba(255,255,255,0.08)', color: sales.length ? '#062520' : '#6E8B85' }}><MessageCircle size={16} /> Send receipt</button>
          <button onClick={() => { setSales([]); setReceipt(false); }} disabled={!sales.length} className="lp-focus h-11 rounded-full text-[14px] font-semibold" style={{ color: sales.length ? '#EAF6F2' : '#6E8B85', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.14)' }}>Start again</button>
        </div>
      </div>
    </div>
  );
}

const LP_KINDS = [
  [ShoppingBasket, 'Provision stores'], [Shirt, 'Boutiques'], [Pill, 'Pharmacies'], [Scissors, 'Salons and barbers'], [UtensilsCrossed, 'Restaurants'],
  [Hotel, 'Hotels and shortlets'], [PartyPopper, 'Event halls'], [Car, 'Car rentals'], [Wrench, 'Repairs and services'], [Boxes, 'Wholesalers'],
];
const LP_TYPES = {
  shops: { label: 'Shops', title: 'For shops and stores',
    points: ['Record a sale in seconds, with the price filled in', 'Stock goes down by itself, and you get warned before you run out', 'Your own online shop link: customers order and pay, you deliver', 'Know who owes you, and send them a reminder on WhatsApp'],
    screen: { head: 'Today at Amaka Stores', rows: [['Mama Gold Rice 50kg', '₦78,000'], ['Kings Oil 5L ×2', '₦29,000'], ['Indomie (carton)', '₦9,800']], note: 'Indomie: 3 cartons left', tone: 'amber' } },
  services: { label: 'Services', title: 'For salons, repairers and every service',
    points: ['Customers book a time on your page, only when you\'re free', 'Customers can choose who they want, and each staff member gets their own login', 'Reminders go out so fewer people forget their appointment', 'See what every service brings in, not just the total'],
    screen: { head: 'Bookings today', rows: [['10:00, Braids', 'Ada'], ['12:30, Haircut', 'Chidi'], ['3:00, Nails', 'Ada']], note: 'Next: braids at 10:00', tone: 'teal' } },
  hotels: { label: 'Hotels', title: 'For hotels, shortlets and event halls',
    points: ['Guests book rooms and pay a deposit online', 'A room board shows who is in, arriving and leaving', 'Extras like water, laundry and airport pickup go on the room bill', 'Check out with one total: the stay and every extra'],
    screen: { head: 'Rooms tonight', rows: [['Room 101', 'In house'], ['Room 204', 'Arriving 2pm'], ['Room 305', 'Free']], note: '2 of 3 rooms booked', tone: 'teal' } },
};
const LP_FAQ = [
  ['Do I need a computer?', 'No. Xorla works on any smartphone, in the browser. You can also add it to your home screen like an app. If you have a laptop, it works there too.'],
  ['Is it really free?', 'Yes. The Free plan is free for as long as you use it, for up to 20 products or services. Pro and Business come with a 30-day free trial, and you only pay if you decide to keep them.'],
  ['What happens to my records if I stop paying?', 'Nothing is deleted. You move to the Free plan, and every sale, invoice and customer is still there.'],
  ['Can my staff use it without seeing everything?', 'Yes. Staff get their own login and only see what you allow. You approve everyone before they can start, and you can remove them any time.'],
  ['Does it work when there is no network?', 'Yes. Once Xorla has opened on your phone with internet, it opens without it too. Keep recording sales and expenses with no data or no signal. They are kept safely on the phone and sent to Xorla by themselves when you are back online. Nothing is counted twice.'],
  ['What if I lose my phone?', 'Your records are kept safely online, not on the phone. Log in on another phone and everything is there. You can also lock Xorla with a PIN.'],
  ['Can customers pay me online?', 'Yes. Customers pay by card, transfer or USSD through Paystack, and the money goes straight to your bank account. Xorla never sees their card details.'],
];

function LandingPage() {
  const rootRef = useRef(null);
  const [theme, setTheme] = useState(() => {
    try { const t = localStorage.getItem('xorla:lp-theme'); if (t === 'light' || t === 'dark') return t; } catch (e) {}
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  });
  const [tab, setTab] = useState('shops');
  const [faq, setFaq] = useState(0);
  const [menu, setMenu] = useState(false);
  const [yearly, setYearly] = useState(false);
  // Early-supporter places left (the first 100 paying businesses get a lower price for 12 months)
  const [spots, setSpots] = useState(null);
  useEffect(() => { sbRpc('early_supporter_spots', SB_KEY, {}).then((n) => setSpots(typeof n === 'number' ? n : null)).catch(() => {}); }, []);
  useEffect(() => {
    if (!menu) return undefined;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [menu]);
  const [scrolled, setScrolled] = useState(0);   // 0..1 how far down the page
  const [pastHero, setPastHero] = useState(false);
  const still = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flip = () => setTheme((t) => { const n = t === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('xorla:lp-theme', n); } catch (e) {} return n; });
  useEffect(() => {
    document.title = 'Xorla: run your business without wahala';
    const html = document.documentElement; const prev = html.style.scrollBehavior;
    if (!still) html.style.scrollBehavior = 'smooth';
    return () => { html.style.scrollBehavior = prev; };
  }, []);
  // The browser bar and page background follow the theme
  useEffect(() => {
    const m = document.querySelector('meta[name="theme-color"]'); const prev = m && m.getAttribute('content');
    if (m) m.setAttribute('content', LP_THEMES[theme].bg);
    document.body.style.background = LP_THEMES[theme].bg;
    return () => { if (m && prev) m.setAttribute('content', prev); document.body.style.background = ''; };
  }, [theme]);
  // Scroll: the progress line, the top bar, and the phone's sticky button
  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const h = document.documentElement.scrollHeight - window.innerHeight; setScrolled(h > 0 ? Math.min(1, window.scrollY / h) : 0); setPastHero(window.scrollY > 640); }); };
    on(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  // Sections glide in as they come into view
  useEffect(() => {
    const els = rootRef.current ? [...rootRef.current.querySelectorAll('[data-reveal]')] : [];
    if (still || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('lp-in')); return undefined; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('lp-in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => io.observe(el)); return () => io.disconnect();
  }, []);

  const t = LP_TYPES[tab];
  const start = '/login?start=signup';
  const vars = Object.fromEntries(Object.entries(LP_THEMES[theme]).map(([k, v]) => [`--lp-${k}`, v]));
  const wrap = 'max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10';
  const H = (size, extra = {}) => ({ fontFamily: LP_DISPLAY, fontSize: size, lineHeight: 1.06, letterSpacing: '-0.035em', fontWeight: 700, ...extra });
  const btn = 'lp-focus lp-press inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-full text-[15.5px] font-bold';
  const head = (text, sub, light) => (
    <div className="max-w-[720px]" data-reveal>
      <h2 style={H('clamp(28px, 3.6vw, 46px)', { color: light ? '#fff' : LP.ink })}>{text}</h2>
      {sub && <p className="mt-4 text-[17px] leading-relaxed max-w-[600px]" style={{ color: light ? 'rgba(255,255,255,0.74)' : LP.dim }}>{sub}</p>}
    </div>
  );
  const tile = (bg, children, cls = '', d = 0, extra = {}) => <div data-reveal className={`lp-tile rounded-[28px] p-6 sm:p-7 overflow-hidden relative ${cls}`} style={{ background: bg, '--d': `${d}s`, ...extra }}>{children}</div>;
  const tt = (a, b, onDark, onBright) => <><h3 className="text-[18px] sm:text-[19px] font-semibold leading-snug" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.02em', color: onDark ? '#fff' : onBright ? LP.inkFixed : LP.ink }}>{a}</h3><p className="mt-2.5 text-[14.5px] leading-relaxed max-w-sm" style={{ color: onDark ? 'rgba(255,255,255,0.74)' : onBright ? 'rgba(11,43,38,0.8)' : LP.dim }}>{b}</p></>;
  const navLinks = [['#try', 'Try it'], ['#features', 'What it does'], ['#for-you', 'Who it\'s for'], ['#pricing', 'Pricing'], ['/ride', 'Riders']];
  const themeBtn = (
    <button onClick={flip} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} className="lp-focus w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: LP.bg2, border: `1px solid ${LP.line}` }}>
      <span className="lp-spin" key={theme}>{theme === 'dark' ? <Sun size={17} style={{ color: LP.amber }} /> : <Moon size={17} />}</span>
    </button>
  );
  const early = typeof spots === 'number' && spots > 0;
  const regular = (plan) => planPrice(plan, yearly ? 'yearly' : 'monthly', 0, false);
  const price = (plan) => planPrice(plan, yearly ? 'yearly' : 'monthly', 0, early);
  const perDay = (plan) => Math.round(price(plan) / (yearly ? 365 : 30) / 10) * 10;

  return (
    <div ref={rootRef} className="lp-root" style={{ ...vars, background: LP.bg, color: LP.ink, fontFamily: LP_BODY, minHeight: '100vh', transition: 'background-color .35s ease, color .35s ease' }}>
      <style>{`
        .lp-root ::selection { background: #FFB020; color: #0B2B26; }
        .lp-receipt { position: relative; width: 236px; background: ${LP.paper}; color: #0B2B26; padding: 18px 18px 26px; border-radius: 6px 6px 0 0;
          box-shadow: 0 30px 60px -28px var(--lp-shadow);
          -webkit-mask: linear-gradient(#000 0 0) top/100% calc(100% - 10px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/16px 10px repeat-x;
                  mask: linear-gradient(#000 0 0) top/100% calc(100% - 10px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/16px 10px repeat-x; }
        .lp-dash { border-top: 1.5px dashed rgba(11,43,38,0.28); }
        .lp-line { opacity: 0; transform: translateY(-4px); animation: lpPrint .28s ease-out forwards; }
        .lp-stamp { opacity: 0; transform: scale(1.25) rotate(-6deg); background: #E3F4EF; color: #0B3B33; border: 1.5px solid #0E9F8E; animation: lpStamp .38s cubic-bezier(.2,1.4,.4,1) forwards; }
        .lp-still .lp-line, .lp-still .lp-stamp { animation: none; opacity: 1; transform: none; }
        @keyframes lpPrint { to { opacity: 1; transform: none; } }
        @keyframes lpStamp { to { opacity: 1; transform: rotate(-3deg); } }
        .lp-phone { width: 250px; height: 510px; border-radius: 42px; padding: 10px; background: #0B2B26; box-shadow: 0 50px 90px -40px var(--lp-shadow), 0 0 90px -10px var(--lp-glow), inset 0 0 0 2px rgba(255,255,255,0.1); }
        .lp-phone-screen { position: relative; height: 100%; border-radius: 33px; overflow: hidden; background: #0A1F1C; }
        .lp-float { animation: lpFloat 7s ease-in-out infinite; }
        @keyframes lpFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .lp-bar { transform-origin: bottom; transform: scaleY(0); animation: lpGrow .7s cubic-bezier(.2,.8,.2,1) forwards; }
        @keyframes lpGrow { to { transform: scaleY(1); } }
        .lp-bubble { opacity: 0; transform: translateY(10px) scale(.95); animation: lpPop .45s cubic-bezier(.2,1.3,.4,1) forwards; }
        @keyframes lpPop { to { opacity: 1; transform: none; } }
        .lp-hero-in > * { opacity: 0; transform: translateY(18px); animation: lpUp .8s cubic-bezier(.2,.7,.2,1) forwards; }
        .lp-hero-in > *:nth-child(2) { animation-delay: .12s; } .lp-hero-in > *:nth-child(3) { animation-delay: .24s; } .lp-hero-in > *:nth-child(4) { animation-delay: .36s; }
        @keyframes lpUp { to { opacity: 1; transform: none; } }
        [data-reveal] { opacity: 0; transform: translateY(26px); transition: opacity .8s cubic-bezier(.2,.7,.2,1), transform .8s cubic-bezier(.2,.7,.2,1); transition-delay: var(--d, 0s); }
        [data-reveal].lp-in { opacity: 1; transform: none; }
        .lp-tile { transition: opacity .8s cubic-bezier(.2,.7,.2,1), transform .8s cubic-bezier(.2,.7,.2,1), box-shadow .3s ease; }
        .lp-tile.lp-in:hover { transform: translateY(-4px); box-shadow: 0 28px 50px -30px var(--lp-shadow); }
        .lp-press { transition: transform .15s ease, box-shadow .2s ease, background-color .2s ease; }
        .lp-press:hover { transform: translateY(-1px); } .lp-press:active { transform: scale(.97); }
        .lp-new { animation: lpNew .45s cubic-bezier(.2,1.2,.4,1); }
        @keyframes lpNew { from { opacity: 0; transform: translateY(-8px); background: rgba(31,217,196,0.18); } to { opacity: 1; transform: none; } }
        .lp-marquee { display: flex; width: max-content; animation: lpMarq 42s linear infinite; }
        /* Works-offline phone: signal drops, sales keep coming with a "waiting" mark, signal returns, all sent (9s loop) */
        .lp-off-bar { animation: lpOffBar 9s infinite; }
        @keyframes lpOffBar { 0%, 8% { opacity: 1; } 14%, 62% { opacity: .18; } 70%, 100% { opacity: 1; } }
        .lp-off-row { animation: lpOffRow 9s infinite; animation-delay: calc(var(--r) * .45s); }
        @keyframes lpOffRow { 0%, 16% { opacity: 0; transform: translateY(8px); } 22%, 92% { opacity: 1; transform: none; } 100% { opacity: 0; } }
        .lp-off-wait { animation: lpOffWait 9s infinite; }
        @keyframes lpOffWait { 0%, 70% { opacity: 1; } 76%, 100% { opacity: 0; } }
        .lp-off-pill-a { animation: lpOffA 9s infinite; }
        @keyframes lpOffA { 0%, 10% { opacity: 0; } 15%, 68% { opacity: 1; } 73%, 100% { opacity: 0; } }
        .lp-off-pill-b { animation: lpOffB 9s infinite; }
        @keyframes lpOffB { 0%, 72% { opacity: 0; transform: scale(.9); } 76%, 94% { opacity: 1; transform: none; } 100% { opacity: 0; } }
        .lp-marquee-wrap:hover .lp-marquee { animation-play-state: paused; }
        @keyframes lpMarq { to { transform: translateX(-50%); } }
        .lp-orb { animation: lpOrb 18s ease-in-out infinite alternate; }
        @keyframes lpOrb { from { transform: translate(0,0) scale(1); } to { transform: translate(-40px, 30px) scale(1.06); } }
        .lp-spin { display: inline-flex; animation: lpSpin .45s cubic-bezier(.2,1.2,.4,1); }
        @keyframes lpSpin { from { transform: rotate(-90deg) scale(.5); opacity: 0; } }
        .lp-rot-word { display: inline-block; animation: lpWord .55s cubic-bezier(.2,.9,.2,1); }
        @keyframes lpWord { from { transform: translateY(85%); opacity: 0; filter: blur(4px); } to { transform: none; opacity: 1; filter: none; } }
        .lp-faq { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .35s ease; }
        .lp-faq.open { grid-template-rows: 1fr; }
        .lp-focus:focus-visible { outline: 3px solid ${LP.accent}; outline-offset: 3px; }
        .lp-bar-r { transform-origin: bottom; transform: scaleY(0); transition: transform .8s cubic-bezier(.2,.8,.2,1) var(--bd, 0s); }
        .lp-in .lp-bar-r { transform: scaleY(1); }
        .lp-line-grow { transform-origin: left; transform: scaleX(0); transition: transform 1.2s cubic-bezier(.2,.7,.2,1) .2s; }
        .lp-in .lp-line-grow { transform: scaleX(1); }
        @media (prefers-reduced-motion: reduce) {
          .lp-line, .lp-stamp, .lp-bubble, .lp-bar, .lp-hero-in > *, [data-reveal], .lp-new, .lp-spin, .lp-rot-word { animation: none !important; opacity: 1 !important; transform: none !important; transition: none !important; }
          .lp-float, .lp-marquee, .lp-orb { animation: none !important; }
          .lp-off-bar, .lp-off-row, .lp-off-wait, .lp-off-pill-b { animation: none !important; opacity: 1 !important; transform: none !important; }
          .lp-off-pill-a { animation: none !important; opacity: 0 !important; }
          .lp-line-grow, .lp-bar-r { transform: none !important; }
        }
      `}</style>

      <style>{`
        .lp-menu .lp-menu-bg { opacity: 0; transition: opacity .35s ease; }
        .lp-menu .lp-menu-glow { opacity: 0; transform: scale(.6); transition: opacity .6s ease, transform .9s cubic-bezier(.2,.7,.2,1); }
        .lp-menu .lp-mi { opacity: 0; transform: translateY(16px); transition: opacity .45s ease, transform .55s cubic-bezier(.2,.7,.2,1); transition-delay: 0s; }
        .lp-menu-open .lp-menu-bg { opacity: 1; }
        .lp-menu-open .lp-menu-glow { opacity: 1; transform: none; }
        .lp-menu-open .lp-mi { opacity: 1; transform: none; transition-delay: calc(var(--i, 0) * 45ms + 60ms); }
        @media (prefers-reduced-motion: reduce) { .lp-menu * { transition: none !important; } }
      `}</style>
      {/* How far down the page you are */}
      <div aria-hidden className="fixed top-0 left-0 right-0 h-[3px] z-50 origin-left" style={{ background: `linear-gradient(90deg, ${LP.teal}, ${LP.amber})`, transform: `scaleX(${scrolled})` }} />

      <header className={`sticky top-0 ${menu ? 'z-[60]' : 'z-40'} transition-[background-color,box-shadow] duration-300`} style={{ background: menu ? 'transparent' : scrolled > 0.005 ? LP.nav : 'transparent', backdropFilter: 'saturate(1.4) blur(14px)', WebkitBackdropFilter: 'saturate(1.4) blur(14px)', boxShadow: !menu && scrolled > 0.005 ? `0 1px 0 ${LP.line}` : 'none' }}>
        <div className={`${wrap} h-16 flex items-center justify-between gap-4`}>
          <a href="/" className="lp-focus flex items-center gap-2.5 rounded-lg"><XorlaMark size={28} /><span className="text-[19px] font-bold" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.03em' }}>Xorla</span></a>
          <nav className="hidden lg:flex items-center gap-1 text-[14.5px] font-semibold">
            {navLinks.map(([h, l]) => <a key={h} href={h} className="lp-focus px-3.5 py-2 rounded-full transition-colors hover:bg-[var(--lp-bg2)]" style={{ color: LP.dim }}>{l}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            {themeBtn}
            <a href="/login" className="lp-focus hidden sm:inline-flex px-4 py-2 rounded-full text-[14.5px] font-semibold" style={{ color: LP.ink }}>Log in</a>
            <a href={start} className="lp-focus lp-press hidden sm:inline-flex px-5 py-2.5 rounded-full text-[14.5px] font-bold" style={{ background: LP.btn, color: LP.btnInk }}>Start free</a>
            <button onClick={() => setMenu((m) => !m)} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} className="lp-focus lg:hidden relative z-[60] w-11 h-11 rounded-full flex items-center justify-center transition-colors" style={{ background: menu ? LP.btn : LP.bg2, border: `1px solid ${menu ? 'transparent' : LP.line}` }}>
              <span aria-hidden className="relative block w-[18px] h-[12px]">
                <span className="absolute left-0 right-0 h-[2px] rounded-full transition-all duration-300" style={{ top: menu ? 5 : 0, transform: menu ? 'rotate(45deg)' : 'none', background: menu ? LP.btnInk : LP.ink }} />
                <span className="absolute left-0 h-[2px] rounded-full transition-all duration-300" style={{ top: 5, width: menu ? 0 : 12, opacity: menu ? 0 : 1, background: LP.ink }} />
                <span className="absolute left-0 right-0 h-[2px] rounded-full transition-all duration-300" style={{ top: menu ? 5 : 10, transform: menu ? 'rotate(-45deg)' : 'none', background: menu ? LP.btnInk : LP.ink }} />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Phone menu: a full panel built for Xorla, not a plain list */}
      <div className={`lp-menu lg:hidden fixed inset-0 z-[55] ${menu ? 'lp-menu-open' : ''}`} aria-hidden={!menu} style={{ pointerEvents: menu ? 'auto' : 'none' }}>
        <div className="lp-menu-bg absolute inset-0" style={{ background: LP.bg }} onClick={() => setMenu(false)} />
        <div aria-hidden className="lp-menu-glow absolute -top-24 -right-24 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(31,217,196,0.28), transparent 65%)' }} />
        <div aria-hidden className="lp-menu-glow absolute bottom-24 -left-24 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,176,32,0.20), transparent 65%)' }} />
        <nav aria-label="Menu" className="relative h-full flex flex-col px-5 sm:px-8 pt-20 overflow-y-auto" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
          <div className="lp-mi text-[11.5px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: LP.faint, '--i': 0 }}>Explore Xorla</div>
          {[[ '#try', 'Try it', 'Tap products, watch profit add up', MousePointerClick, LP.teal],
            ['#features', 'What it does', 'Sales, stock, bookings, receipts', Sparkles, LP.amber],
            ['#for-you', "Who it's for", 'Shops, salons, hotels and more', Users, LP.teal],
            ['#pricing', 'Pricing', 'Start free. No card needed', Tag, LP.amber],
            ['/ride', 'Ride with us', 'Riders: earn delivering nearby', Bike, LP.coral],
          ].map(([h, l, d, Ic, col], i) => (
            <a key={h} href={h} onClick={() => setMenu(false)} className="lp-mi lp-focus group flex items-center gap-4 py-3.5" style={{ '--i': i + 1, borderBottom: `1px solid ${LP.line}` }}>
              <span className="text-[11px] font-bold w-5 shrink-0" style={{ fontFamily: LP_DISPLAY, color: LP.faint }}>{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[22px] leading-tight font-bold" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.035em' }}>{l}</span>
                <span className="block text-[13px] mt-0.5" style={{ color: LP.dim }}>{d}</span>
              </span>
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-active:scale-90" style={{ background: `${col}22`, color: col }}><Ic size={18} /></span>
            </a>
          ))}
          <div className="lp-mi mt-6 rounded-[22px] p-4 flex items-center gap-3.5" style={{ '--i': 6, background: LP.deep, color: '#EAF6F2' }}>
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }}><XorlaMark size={24} /></span>
            <span className="flex-1 min-w-0 text-[12.5px] leading-snug"><strong className="block text-[14px]">Free to start, works offline</strong><span style={{ opacity: 0.75 }}>No network? Keep selling. It sends when you're back.</span></span>
          </div>
          <div className="flex-1 min-h-6" />
          <div className="lp-mi grid grid-cols-2 gap-2.5" style={{ '--i': 7 }}>
            <a href="/login" className="lp-focus h-[52px] rounded-full flex items-center justify-center text-[15px] font-semibold" style={{ border: `1.5px solid ${LP.line}`, color: LP.ink }}>Log in</a>
            <a href={start} className="lp-focus lp-press h-[52px] rounded-full flex items-center justify-center gap-1.5 text-[15px] font-bold" style={{ background: LP.btn, color: LP.btnInk }}>Start free <ArrowRight size={16} /></a>
          </div>
        </nav>
      </div>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden -mt-16 pt-16">
          <div aria-hidden className="absolute inset-0" style={{ backgroundImage: `radial-gradient(${LP.dots} 1.2px, transparent 1.2px)`, backgroundSize: '22px 22px', WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 70% 30%, #000 30%, transparent 75%)', maskImage: 'radial-gradient(ellipse 70% 60% at 70% 30%, #000 30%, transparent 75%)' }} />
          <div aria-hidden className="lp-orb absolute -right-48 -top-40 w-[760px] h-[760px] rounded-full" style={{ background: `radial-gradient(circle at 45% 45%, ${LP.tint} 0%, ${LP.tint} 42%, transparent 64%)` }} />
          <div className={`relative ${wrap} grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-8 items-center pt-8 sm:pt-12 lg:pt-14 pb-14 lg:pb-20`}>
            <div className="lp-hero-in">
              <a href="/ride" className="lp-focus inline-flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5 text-[13px] font-semibold" style={{ background: LP.card, border: `1px solid ${LP.line}`, color: LP.dim }}><span className="px-2 py-0.5 rounded-full text-[11.5px] font-bold" style={{ background: LP.amber, color: LP.inkFixed }}>New</span>Delivery riders can now join Xorla<ChevronRight size={14} /></a>
              <h1 className="mt-6" style={H('clamp(40px, 6.2vw, 80px)', { lineHeight: 1.02, letterSpacing: '-0.045em', fontWeight: 800 })}>
                <span className="sr-only">Run your business without wahala.</span>
                <span aria-hidden>Run your business without <LpRotate words={LP_WORDS} still={still} /></span>
              </h1>
              <p className="mt-6 text-[16.5px] sm:text-[19px] leading-relaxed max-w-[540px]" style={{ color: LP.dim }}>Sales, stock, bookings, staff and payments, all on your phone. Xorla does the counting, so you can face your customers.</p>
              <div>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <a href={start} className={btn} style={{ background: LP.btn, color: LP.btnInk, boxShadow: '0 14px 30px -14px rgba(11,59,51,0.7)' }}>Start free</a>
                  <a href="#try" className={btn} style={{ color: LP.ink, boxShadow: `inset 0 0 0 1.5px ${LP.line}` }}>Try it here first</a>
                </div>
                <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[14px] font-medium" style={{ color: LP.dim }}>
                  {['Free plan for small businesses', '30 days of Pro, free', 'Works offline'].map((x) => <li key={x} className="flex items-center gap-2"><Check size={15} strokeWidth={2.8} style={{ color: LP.accent }} />{x}</li>)}
                </ul>
              </div>
            </div>
            <div className={`relative h-[540px] sm:h-[570px] ${still ? 'lp-still' : ''}`}>
              <div className="absolute right-0 sm:right-[4%] lg:right-[2%] top-[18px]"><div className="lp-float"><LandingPhone /></div></div>
              <div className="absolute left-0 sm:left-[6%] lg:left-[2%] top-[150px] -rotate-[5deg] origin-top z-10"><LandingReceipt still={still} /></div>
              <div className="lp-bubble absolute left-0 sm:left-[4%] lg:left-0 top-[34px] max-w-[230px] z-20 rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[12.5px] leading-snug" style={{ background: LP.wa, color: LP.waInk, boxShadow: `0 16px 30px -18px ${LP.shadow}`, animationDelay: '2.9s' }}>
                <div className="font-bold">New order from Chidi</div>2 crates of Coke, deliver to Aba Road. <span style={{ opacity: 0.7 }}>Paid online</span>
              </div>
              <div className="lp-bubble absolute right-0 sm:right-2 bottom-[18px] z-20 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: LP.card, boxShadow: `0 18px 36px -20px ${LP.shadow}`, border: `1px solid ${LP.line}`, animationDelay: '3.4s' }}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: LP.amber }}><Bell size={15} style={{ color: LP.inkFixed }} /></span>
                <span className="text-[12.5px] leading-tight"><span className="block font-bold">Room 204 booked</span><span style={{ color: LP.faint }}>Deposit of {fmt(35000)} paid</span></span>
              </div>
            </div>
          </div>
        </section>

        {/* Every kind of business, moving past */}
        <section className="py-7 lp-marquee-wrap overflow-hidden" style={{ background: LP.bg2, borderTop: `1px solid ${LP.line}`, borderBottom: `1px solid ${LP.line}` }} aria-label="Made for every kind of business">
          <div className="lp-marquee gap-3" aria-hidden>
            {[...LP_KINDS, ...LP_KINDS].map(([Ic, l], i) => <span key={i} className="shrink-0 inline-flex items-center gap-2.5 rounded-full pl-2 pr-5 py-2 mr-3 text-[15px] font-semibold whitespace-nowrap" style={{ background: LP.card, border: `1px solid ${LP.line}` }}><span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: LP.tint }}><Ic size={15} style={{ color: LP.accent }} /></span>{l}</span>)}
          </div>
          <span className="sr-only">{LP_KINDS.map(([, l]) => l).join(', ')}</span>
        </section>

        {/* Try it */}
        <section id="try" className={`${wrap} pt-20 sm:pt-24 scroll-mt-20`}>
          {head('Record a sale. Right here, right now.', 'Tap a few products the way you would on a busy day. Watch your sales and your profit add up by themselves.')}
          <div className="mt-10" data-reveal style={{ '--d': '0.1s' }}><LandingDemo /></div>
        </section>

        {/* What it does */}
        <section id="features" className={`${wrap} pt-20 sm:pt-28 scroll-mt-20`}>
          {head('Everything a busy owner needs, nothing you don\'t', 'Start with recording sales. Add stock, staff, bookings and online payments when you\'re ready. It all works together.')}
          <div className="mt-10 grid gap-4 lg:grid-cols-6">
            {tile(LP.deep, (
              <div className="grid sm:grid-cols-2 gap-6 items-end">
                <div>{tt('Know your profit every evening', 'Every sale and expense adds up by itself, so you always know what you made today. On Pro, your weekly summary also comes to you on WhatsApp.', true)}
                  <div className="mt-5 text-[40px] font-bold" style={{ fontFamily: LP_DISPLAY, color: LP.teal, letterSpacing: '-0.04em' }}><LpCount value={210500} ms={1400} /></div>
                  <div className="text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>profit this week</div>
                  <div className="mt-5 flex items-end gap-2 h-20" aria-hidden>
                    {[['M', 46], ['T', 58], ['W', 40], ['T', 66], ['F', 74], ['S', 100], ['S', 62]].map(([d, h], i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"><span className="w-full rounded-md lp-bar-r" style={{ height: `${h}%`, background: i === 5 ? LP.amber : 'rgba(31,217,196,0.45)', '--bd': `${0.25 + i * 0.07}s` }} /><span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>{d}</span></div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl p-4" style={{ background: '#DCF8C6', color: LP.inkFixed }}>
                  <div className="text-[12px] font-bold" style={{ color: '#0E7A5F' }}>Your week on Xorla</div>
                  <div className="text-[14px] leading-relaxed mt-1">Good evening Amaka. This week you sold <strong>{fmt(612400)}</strong>, spent <strong>{fmt(401900)}</strong> and made <strong>{fmt(210500)}</strong> profit. Your best seller was Peak Milk. Well done!</div>
                </div>
              </div>
            ), 'lg:col-span-4')}
            {tile(LP.tint, (
              <>
                {tt('Never run out of stock', 'Stock goes down with every sale. You hear about it before the shelf is empty.')}
                <div className="mt-5 space-y-2">
                  {[['Indomie (carton)', 3, LP.coral], ['Peak Milk tin', 24, LP.accent], ['Kings Oil 5L', 11, LP.accent]].map(([n, q, c]) => (
                    <div key={n} className="rounded-xl px-3.5 py-2.5 text-[14px]" style={{ background: LP.card }}>
                      <div className="flex items-center justify-between"><span className="font-semibold">{n}</span><span className="font-bold" style={{ color: c }}>{q} left</span></div>
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: LP.bg2 }}><span className="block h-full rounded-full lp-line-grow" style={{ width: `${Math.min(100, q * 3.5)}%`, background: c }} /></div>
                    </div>
                  ))}
                </div>
              </>
            ), 'lg:col-span-2', 0.08)}
            {tile(LP.card, (
              <>
                {tt('Your own online shop', 'Share one link on WhatsApp and Instagram. Customers order, book or pay from it, and you see it on your phone at once.')}
                <div className="mt-5 rounded-2xl p-3 flex items-center gap-3" style={{ background: LP.bg2, border: `1px solid ${LP.line}` }}>
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: LP.forest }}><Store size={18} color="#fff" /></span>
                  <span className="min-w-0"><span className="block text-[14px] font-bold truncate">xorla.vercel.app/amakastores</span><span className="block text-[12.5px]" style={{ color: LP.faint }}>Open 8am to 9pm</span></span>
                </div>
              </>
            ), 'lg:col-span-2', 0, { border: `1px solid ${LP.line}` })}
            {tile(LP.card, (
              <>
                {tt('Get paid online', 'Customers pay by card, transfer or USSD. The money goes straight to your bank.')}
                <div className="mt-5 flex items-center gap-3">
                  <span className="flex-1 h-11 rounded-full flex items-center justify-center text-[14px] font-bold" style={{ background: LP.btn, color: LP.btnInk }}><Lock size={14} className="mr-1.5" />Pay {fmt(29000)}</span>
                  <span className="h-11 px-4 rounded-full flex items-center gap-1.5 text-[14px] font-bold" style={{ background: LP.tint, color: LP.accent }}><Check size={15} />Paid</span>
                </div>
                <p className="mt-3 text-[12.5px]" style={{ color: LP.faint }}>Secured by Paystack</p>
              </>
            ), 'lg:col-span-2', 0.08, { border: `1px solid ${LP.line}` })}
            {tile(LP.card, (
              <>
                {tt('Staff without stress', 'Each person gets their own login. They record sales; you see who did what, from anywhere.')}
                <div className="mt-5 flex items-center gap-3"><span className="flex -space-x-2">{['TO', 'AD', 'CH'].map((x, i) => <span key={x} className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: ['#E3F4EF', '#FFE7B0', '#FFD9CC'][i], color: LP.inkFixed, boxShadow: `0 0 0 2px ${LP_THEMES[theme].card}` }}>{x}</span>)}</span><span className="text-[13.5px] leading-snug" style={{ color: LP.dim }}>Tolu recorded 12 sales today</span></div>
              </>
            ), 'lg:col-span-2', 0.16, { border: `1px solid ${LP.line}` })}
            {tile(LP.amber, (
              <div className="grid sm:grid-cols-[1fr_1.1fr] gap-6 items-center">
                <div>{tt('Ask Oga anything about your business', 'Oga is your business advisor. It reads your real numbers and answers in English, Pidgin, Igbo, Yoruba or Hausa.', false, true)}</div>
                <div className="space-y-2">
                  <div className="ml-auto max-w-[260px] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[14px]" style={{ background: LP.forest, color: '#fff' }}>Which product dey bring me the most money?</div>
                  <div className="max-w-[300px] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[14px] leading-relaxed" style={{ background: '#fff', color: LP.inkFixed }}>Na Mama Gold Rice. This month e bring {fmt(312000)}, but only 4 bags remain. Order more before weekend.</div>
                </div>
              </div>
            ), 'lg:col-span-4')}
            {tile(LP.bg2, (
              <>
                {tt('Register your business with CAC', 'Apply for your business name inside Xorla. An accredited agent files it, and your certificate lands in your vault.')}
                <div className="mt-5 rounded-xl p-4 text-center" style={{ background: 'linear-gradient(160deg, #FBF6EA, #F3EBD7)', boxShadow: 'inset 0 0 0 1.5px rgba(150,110,40,0.35)' }}>
                  <div className="text-[10px] font-semibold tracking-[0.2em]" style={{ color: '#8A6A2F' }}>CERTIFICATE OF REGISTRATION</div>
                  <div className="mt-1 text-[17px] font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1F2A26' }}>Amaka Stores</div>
                </div>
              </>
            ), 'lg:col-span-2', 0.08)}
            {tile(LP.bg2, (
              <>
                {tt('Reminders that get you paid', 'Xorla reminds customers who owe you on WhatsApp, politely, so you don\'t have to chase them.')}
                <div className="mt-5 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13.5px] leading-relaxed" style={{ background: LP.wa, color: LP.waInk }}>Hello Emeka, a friendly reminder from Amaka Stores: your invoice of {fmt(18200)} is due today. Thank you!</div>
              </>
            ), 'lg:col-span-3')}
            {tile(LP.bg2, (
              <>
                {tt('Your papers, safe in one place', 'Keep your CAC certificate, TIN and licences in the vault. Share them with a bank or supplier in one tap.')}
                <div className="mt-5 flex gap-2">{[['CAC certificate', LP.accent], ['TIN', LP.amber], ['NAFDAC', LP.coral]].map(([n, c]) => <span key={n} className="flex-1 rounded-xl px-2.5 py-3 text-[12px] font-bold text-center" style={{ background: LP.card, borderTop: `3px solid ${c}` }}><FileText size={16} className="mx-auto mb-1" style={{ color: c }} />{n}</span>)}</div>
              </>
            ), 'lg:col-span-3', 0.08)}
          </div>
        </section>

        {/* Built for your kind of business */}
        <section id="for-you" className={`${wrap} pt-20 sm:pt-28 scroll-mt-20`}>
          {head('It changes to fit your business', 'Tell Xorla what you do when you sign up. A shop, a salon and a hotel each get the tools they need, in the words they use.')}
          <div className="mt-9 inline-flex p-1.5 rounded-full" role="tablist" aria-label="Type of business" data-reveal style={{ background: LP.bg2, border: `1px solid ${LP.line}` }}>
            {Object.entries(LP_TYPES).map(([k, v]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="lp-focus px-5 sm:px-7 py-2.5 rounded-full text-[15px] font-bold transition-colors duration-300" style={tab === k ? { background: LP.btn, color: LP.btnInk } : { color: LP.dim }}>{v.label}</button>)}
          </div>
          <div key={tab} className="mt-6 grid lg:grid-cols-[1.15fr_0.85fr] gap-4 items-stretch lp-new" role="tabpanel">
            <div className="rounded-[28px] p-7 sm:p-9" style={{ background: LP.tint }}>
              <h3 style={H('clamp(22px, 2.4vw, 30px)')}>{t.title}</h3>
              <ul className="mt-6 space-y-4">{t.points.map((x) => <li key={x} className="flex items-start gap-3 text-[16px] leading-relaxed"><span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: LP.btn }}><Check size={13} strokeWidth={3} style={{ color: LP.btnInk }} /></span>{x}</li>)}</ul>
            </div>
            <div className="rounded-[28px] p-6 flex flex-col" style={{ background: '#0A1F1C', color: '#EAF6F2', border: `1px solid ${LP.line}` }}>
              <div className="flex items-center gap-2"><XorlaMark size={18} /><span className="text-[13px] font-semibold">{t.screen.head}</span></div>
              <div className="mt-4 rounded-2xl overflow-hidden flex-1" style={{ background: '#13322C' }}>{t.screen.rows.map(([a, b], i) => <div key={a} className="flex items-center justify-between px-4 py-3.5 text-[14.5px]" style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}><span className="font-semibold">{a}</span><span style={{ color: '#93B0AA' }}>{b}</span></div>)}</div>
              <div className="mt-3 rounded-xl px-4 py-3 text-[13.5px] font-bold" style={{ background: t.screen.tone === 'amber' ? 'rgba(255,176,32,0.14)' : 'rgba(31,217,196,0.14)', color: t.screen.tone === 'amber' ? '#FFB020' : '#1FD9C4' }}>{t.screen.note}</div>
            </div>
          </div>
        </section>

        {/* How it works (a real sequence) */}
        <section className={`${wrap} pt-20 sm:pt-28`}>
          {head('Set up before your next customer walks in')}
          <div className="relative mt-10" data-reveal>
            <div aria-hidden className="hidden md:block absolute left-[16%] right-[16%] top-[34px] h-[2px] lp-line-grow" style={{ background: `linear-gradient(90deg, ${LP.teal}, ${LP.amber}, ${LP.coral})` }} />
            <ol className="relative grid md:grid-cols-3 gap-4">
              {[['Sign up with your email', 'It takes about a minute. Tell Xorla your business name and what you sell or do.'], ['Add what you sell', 'Type it in, or take a photo of your price list and Xorla fills it in for you.'], ['Record your first sale', 'Then share your shop link with customers, and invite your staff when you\'re ready.']].map(([a, b], i) => (
                <li key={a} className="rounded-[28px] p-7 md:text-center" style={{ background: LP.card, border: `1px solid ${LP.line}` }}>
                  <span className="md:mx-auto w-[52px] h-[52px] -mt-0 rounded-full flex items-center justify-center text-[20px] font-bold" style={{ fontFamily: LP_DISPLAY, background: [LP.teal, LP.amber, LP.coral][i], color: LP.inkFixed }}>{i + 1}</span>
                  <span className="block mt-5 text-[18px] font-semibold" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.02em' }}>{a}</span>
                  <span className="block mt-2 text-[15px] leading-relaxed" style={{ color: LP.dim }}>{b}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Works offline */}
        <section id="offline" className={`${wrap} pt-20 sm:pt-28 scroll-mt-20`}>
          <div className="relative overflow-hidden rounded-[32px] grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center p-7 sm:p-12" data-reveal style={{ background: LP.tint, border: `1px solid ${LP.line}` }}>
            <div aria-hidden className="absolute -right-24 -top-24 w-80 h-80 rounded-full lp-orb" style={{ background: 'radial-gradient(circle, rgba(255,176,32,0.22), transparent 65%)' }} />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold uppercase tracking-[0.12em]" style={{ background: LP.card, color: LP.accent, border: `1px solid ${LP.line}` }}><WifiOff size={14} /> Works offline</span>
              <h2 className="mt-5 text-[32px] sm:text-[46px] leading-[1.05] font-extrabold" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.045em' }}>No network?<br /><span style={{ color: LP.amber }}>Keep selling.</span></h2>
              <p className="mt-4 text-[16px] sm:text-[17.5px] leading-relaxed max-w-xl" style={{ color: LP.dim }}>Data finishes. Network drops. Light goes and the router goes with it. Xorla keeps recording your sales and expenses on your phone, then sends them by itself the moment you're back online.</p>
              <ul className="mt-6 grid sm:grid-cols-3 gap-3">
                {[[Smartphone, 'Opens with no data', 'Your records are right there'], [CloudUpload, 'Sends by itself', 'When the network returns'], [ShieldCheck, 'Never counted twice', 'Even on a shaky network']].map(([Ic, a, b], i) => (
                  <li key={a} className="rounded-2xl p-3.5 sm:p-4 flex sm:block items-center gap-3" data-reveal style={{ '--d': `${0.1 + i * 0.08}s`, background: LP.card, border: `1px solid ${LP.line}` }}>
                    <Ic size={19} className="shrink-0" style={{ color: [LP.accent, LP.amber, LP.coral][i] }} />
                    <span className="min-w-0"><span className="block sm:mt-2.5 text-[14.5px] font-bold" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.02em' }}>{a}</span>
                    <span className="block text-[13px] mt-0.5" style={{ color: LP.dim }}>{b}</span></span>
                  </li>
                ))}
              </ul>
            </div>
            {/* A little phone that loses signal, keeps selling, then catches up */}
            <div className="relative flex justify-center" aria-hidden>
              <div className="lp-float w-[260px] rounded-[38px] p-3" style={{ background: '#0B2B26', boxShadow: `0 40px 80px -40px ${LP.shadow}` }}>
                <div className="rounded-[28px] overflow-hidden" style={{ background: '#0F2925', color: '#EAF6F2' }}>
                  <div className="flex items-center justify-between px-4 pt-3 text-[11px] font-semibold" style={{ color: '#A6C0BA' }}>
                    <span>9:41</span>
                    <span className="flex items-end gap-[2px] h-3">{[0, 1, 2, 3].map((b) => <span key={b} className="lp-off-bar w-[3px] rounded-sm" style={{ height: 4 + b * 2.5, background: '#EAF6F2', '--b': b }} />)}</span>
                  </div>
                  <div className="px-4 pt-4 pb-5">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: '#6E8B85' }}>Today</div>
                    <div className="text-[26px] font-bold mt-0.5" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.04em' }}>₦48,500</div>
                    <div className="mt-3 space-y-2">
                      {[['Indomie ×2', '₦1,200'], ['Peak Milk', '₦650'], ['Bread', '₦1,500']].map(([n, a], i) => (
                        <div key={n} className="lp-off-row flex items-center justify-between rounded-xl px-3 py-2 text-[12.5px]" style={{ background: 'rgba(255,255,255,0.05)', '--r': i }}>
                          <span>{n}</span>
                          <span className="flex items-center gap-1.5 font-semibold">{a}<span className="lp-off-wait inline-flex"><CloudUpload size={12} style={{ color: '#FFB020' }} /></span></span>
                        </div>
                      ))}
                    </div>
                    <div className="relative mt-4 h-9">
                      <div className="lp-off-pill-a absolute inset-0 rounded-full flex items-center justify-center gap-1.5 text-[11.5px] font-bold" style={{ background: 'rgba(255,176,32,0.16)', color: '#FFB020' }}><WifiOff size={13} /> Offline · 3 waiting</div>
                      <div className="lp-off-pill-b absolute inset-0 rounded-full flex items-center justify-center gap-1.5 text-[11.5px] font-bold" style={{ background: 'rgba(31,217,196,0.16)', color: '#1FD9C4' }}><Check size={13} /> All caught up</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="mt-20 sm:mt-28 relative overflow-hidden" style={{ background: LP.forest }}>
          <div aria-hidden className="absolute -left-40 -bottom-40 w-[520px] h-[520px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(31,217,196,0.16), transparent 65%)' }} />
          <div className={`relative ${wrap} py-20 grid lg:grid-cols-[0.85fr_1.15fr] gap-12`}>
            {head('Your money and your records stay yours', 'Here is how Xorla keeps your business safe, every day.', true)}
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-7">
              {[[ShieldCheck, 'Staff see only what you allow', 'You approve every staff member, and remove them in one tap.'], [Lock, 'Lock it with a PIN', 'Nobody opens your Xorla on your phone without your PIN.'], [CreditCard, 'Payments by Paystack', 'Card, transfer and USSD. Xorla never sees card details.'], [FileText, 'Nothing is ever deleted', 'Stop paying and you move to Free with every record still there.'], [Bell, 'No surprise charges', 'We remind you 3 days before your plan renews.'], [Smartphone, 'Lose your phone, not your records', 'Everything is kept online. Log in on another phone.']].map(([Ic, a, b], i) => (
                <li key={a} className="flex gap-3.5" data-reveal style={{ '--d': `${(i % 2) * 0.08 + Math.floor(i / 2) * 0.06}s` }}>
                  <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(31,217,196,0.14)' }}><Ic size={19} style={{ color: LP.teal }} /></span>
                  <span><span className="block text-[16px] font-bold text-white">{a}</span><span className="block mt-1 text-[14.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>{b}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className={`${wrap} pt-20 sm:pt-28 scroll-mt-20`}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            {head('Start free. Grow when you\'re ready.', 'Every paid plan starts with 30 days free. Pay by card, transfer or USSD.')}
            <div className="inline-flex p-1.5 rounded-full self-start md:self-auto" role="tablist" aria-label="Billing" data-reveal style={{ background: LP.bg2, border: `1px solid ${LP.line}` }}>
              {[[false, 'Monthly'], [true, 'Yearly']].map(([v, l]) => <button key={l} role="tab" aria-selected={yearly === v} onClick={() => setYearly(v)} className="lp-focus px-5 py-2.5 rounded-full text-[14.5px] font-bold transition-colors duration-300 flex items-center gap-2" style={yearly === v ? { background: LP.btn, color: LP.btnInk } : { color: LP.dim }}>{l}{v && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: LP.amber, color: LP.inkFixed }}>2 months free</span>}</button>)}
            </div>
          </div>
          {early && (
            <div className="mt-8 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5" style={{ background: LP.tint, border: `1px solid ${LP.line}` }}>
              <span className="self-start px-3 py-1 rounded-full text-[12.5px] font-bold shrink-0" style={{ background: LP.amber, color: LP.inkFixed }}>Early-supporter offer</span>
              <span className="text-[14.5px] leading-relaxed" style={{ color: LP.ink }}>The first 100 businesses to subscribe pay about a third less for their first 12 months. <strong>{spots} of 100 places left.</strong></span>
            </div>
          )}
          <div className="mt-6 grid md:grid-cols-3 gap-4 items-stretch">
            {[
              ['Free', null, 'For one person getting started', null, ['Up to 20 products or services', 'Sales, expenses, invoices and receipts', 'Your own online shop link', '10 room or rental bookings and 10 questions to Oga a month'], false],
              ['Pro', 'pro', 'For a growing business with staff', 'Everything in Free, plus', ['Up to 3 staff, each with their own login. They see only what you allow', 'Unlimited products, services and room bookings', 'Automatic WhatsApp: payment reminders, booking confirmations and business summaries', 'Oga, your business adviser: 150 questions a month in English, Pidgin, Igbo, Yoruba or Hausa', 'Your brand only: no "Powered by Xorla" on your shop and receipts', 'Unlimited papers in your document vault'], true],
              ['Business', 'business', 'For several branches, shops or warehouses', 'Everything in Pro, plus', ['3 locations included, and add more any time', 'Up to 10 staff, each placed at their branch', 'Move stock between branches, and see what each one sells', 'Every branch together on one screen, or one at a time', '500 questions to Oga and 500 WhatsApp messages a month'], false],
            ].map(([n, plan, who, plus, pts, star], i) => (
              <div key={n} data-reveal className="lp-tile rounded-[28px] p-7 flex flex-col" style={{ '--d': `${i * 0.08}s`, ...(star ? { background: LP.forest, color: '#fff', boxShadow: '0 30px 60px -30px rgba(11,59,51,0.7)' } : { background: LP.card, border: `1px solid ${LP.line}` }) }}>
                <div className="flex items-center justify-between gap-2"><span className="text-[18px] font-semibold" style={{ fontFamily: LP_DISPLAY }}>{n}</span>{star && <span className="px-3 py-1 rounded-full text-[12.5px] font-bold" style={{ background: LP.amber, color: LP.inkFixed }}>Most chosen</span>}</div>
                <div className="mt-1 text-[14px]" style={{ color: star ? 'rgba(255,255,255,0.72)' : LP.dim }}>{who}</div>
                <div className="mt-5 flex items-baseline gap-1.5 flex-wrap"><span className="text-[34px] font-bold" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.04em' }}>{plan ? <LpCount value={price(plan)} ms={500} /> : '₦0'}</span><span className="text-[14px]" style={{ color: star ? 'rgba(255,255,255,0.7)' : LP.faint }}>{plan ? (yearly ? 'a year' : 'a month') : 'forever'}</span></div>
                {plan ? (
                  <div className="mt-1 text-[13px] leading-snug" style={{ color: star ? 'rgba(255,255,255,0.72)' : LP.dim }}>
                    {early && <><span className="line-through">{fmt(regular(plan))}</span> after the offer · </>}About {fmt(perDay(plan))} a day
                  </div>
                ) : <div className="mt-1 text-[13px]" style={{ color: LP.dim }}>No card, no time limit</div>}
                {plus && <div className="mt-5 text-[13px] font-bold uppercase tracking-wide" style={{ color: star ? LP.teal : LP.accent }}>{plus}</div>}
                <ul className={`${plus ? 'mt-3' : 'mt-5'} space-y-2.5 flex-1`}>{pts.map((x) => <li key={x} className="flex items-start gap-2.5 text-[14.5px] leading-snug"><Check size={16} strokeWidth={2.8} className="shrink-0 mt-0.5" style={{ color: star ? LP.teal : LP.accent }} />{x}</li>)}</ul>
                <a href={start} className={`${btn} mt-7 w-full`} style={star ? { background: LP.amber, color: LP.inkFixed } : { background: LP.bg2, color: LP.ink }}>{plan ? 'Start 30 days free' : 'Start free'}</a>
                {plan && <div className="mt-2 text-[12.5px] text-center" style={{ color: star ? 'rgba(255,255,255,0.65)' : LP.faint }}>No card needed. Stop any time.</div>}
              </div>
            ))}
          </div>
          <div data-reveal className="mt-4 rounded-[24px] p-6" style={{ background: LP.card, border: `1px solid ${LP.line}` }}>
            <div className="text-[15px] font-bold">On every plan, Free included</div>
            <ul className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
              {['Customers pay you online by card, transfer or USSD', 'Appointments, bookings and deposits', 'Deliveries with your riders or Xorla riders', 'Discount codes and shop posters', 'Works offline, and syncs when you are back', 'Reports on your profit and best sellers'].map((x) => <li key={x} className="flex items-start gap-2.5 text-[14px] leading-snug" style={{ color: LP.dim }}><Check size={15} strokeWidth={2.8} className="shrink-0 mt-0.5" style={{ color: LP.accent }} />{x}</li>)}
            </ul>
          </div>
          <p className="mt-5 text-[14.5px]" style={{ color: LP.dim }}><a href="/pricing" className="lp-focus font-bold underline underline-offset-4" style={{ color: LP.ink }}>See full pricing and early-supporter prices</a></p>
        </section>

        {/* Questions */}
        <section className={`${wrap} pt-20 sm:pt-28 grid lg:grid-cols-[0.8fr_1.2fr] gap-10`}>
          {head('Questions people ask', 'Something else on your mind? Sign up and tap Help inside Xorla. A real person answers.')}
          <div data-reveal style={{ borderTop: `1px solid ${LP.line}` }}>
            {LP_FAQ.map(([q, a], i) => {
              const open = faq === i;
              return (
                <div key={q} style={{ borderBottom: `1px solid ${LP.line}` }}>
                  <button onClick={() => setFaq(open ? -1 : i)} aria-expanded={open} className="lp-focus w-full flex items-center justify-between gap-4 py-5 text-left text-[17px] font-bold">
                    {q}<span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300" style={{ background: open ? LP.btn : LP.bg2, color: open ? LP.btnInk : LP.ink, transform: open ? 'rotate(180deg)' : 'none' }}>{open ? <Minus size={15} /> : <Plus size={15} />}</span>
                  </button>
                  <div className={`lp-faq ${open ? 'open' : ''}`}><div className="overflow-hidden"><p className="pb-5 -mt-1 text-[15.5px] leading-relaxed max-w-2xl" style={{ color: LP.dim }}>{a}</p></div></div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Last call */}
        <section className={`${wrap} pt-20 sm:pt-28 pb-20`}>
          <div data-reveal className="relative overflow-hidden rounded-[36px] px-7 py-14 sm:px-14 sm:py-16 grid lg:grid-cols-[1.25fr_0.75fr] gap-10 items-center" style={{ background: LP.tint }}>
            <div aria-hidden className="absolute -right-20 -top-24 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,176,32,0.25), transparent 65%)' }} />
            <div className="relative">
              <h2 style={H('clamp(30px, 4.4vw, 56px)')}>Your next sale can be your first one on Xorla.</h2>
              <p className="mt-4 text-[17px] leading-relaxed max-w-lg" style={{ color: LP.dim }}>Free to start. Set up in minutes. Works on the phone you already have.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a href={start} className={btn} style={{ background: LP.btn, color: LP.btnInk }}>Start free</a>
                <a href="/login" className={btn} style={{ background: LP.card, color: LP.ink }}>I already have an account</a>
              </div>
            </div>
            <div className="hidden lg:flex justify-center relative"><div className="rotate-[4deg]"><LandingReceipt still /></div></div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: `1px solid ${LP.line}` }}>
        <div className={`${wrap} py-10 flex flex-col md:flex-row md:items-center justify-between gap-6`}>
          <div>
            <div className="flex items-center gap-2.5"><XorlaMark size={24} /><span className="text-[17px] font-bold" style={{ fontFamily: LP_DISPLAY, letterSpacing: '-0.03em' }}>Xorla</span></div>
            <div className="mt-2 text-[13.5px]" style={{ color: LP.faint }}>Made for businesses across Nigeria. © {new Date().getFullYear()} Xorla</div>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] font-semibold" style={{ color: LP.dim }}>
            {[['/pricing', 'Pricing'], ['/ride', 'Ride with Xorla'], ['/terms', 'Terms'], ['/privacy', 'Privacy'], ['/login', 'Log in']].map(([h, l]) => <a key={h} href={h} className="lp-focus rounded">{l}</a>)}
            {themeBtn}
          </nav>
        </div>
      </footer>

      {/* Phones: Start free stays in reach once you scroll past the top */}
      <div className={`sm:hidden fixed left-0 right-0 bottom-0 z-40 px-4 pt-3 transition-transform duration-300 ${pastHero ? 'translate-y-0' : 'translate-y-full'}`} style={{ background: LP.nav, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderTop: `1px solid ${LP.line}`, paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2">
          <a href="/login" className="lp-focus h-12 px-5 rounded-full text-[15px] font-bold flex items-center justify-center" style={{ color: LP.ink, boxShadow: `inset 0 0 0 1.5px ${LP.line}` }}>Log in</a>
          <a href={start} className="lp-focus flex-1 h-12 rounded-full text-[15.5px] font-bold flex items-center justify-center" style={{ background: LP.btn, color: LP.btnInk }}>Start free</a>
        </div>
      </div>
    </div>
  );
}
export { LandingPage, PricingPage, LegalPage };
