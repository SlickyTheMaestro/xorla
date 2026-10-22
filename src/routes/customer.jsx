// Xorla: customer screens (loaded only when needed). Shared code lives in ../App.jsx.
import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, Check, CalendarClock, X, ChevronLeft, Clock, MapPin, Package, Lock, Copy, ShieldCheck, Bike, Phone } from 'lucide-react';
import { S, SB_KEY, SB_URL, SF_FONT, SlotPicker, apptDay, apptTime, brandAlert, brandConfirm, eventTimeLabel, fmt, formatPhoneDisplay, hhmmLabel, laundryCollect, laundryDrop, noteWithout, sbRpc, toWhatsAppNumber } from '../App.jsx';

function AppointmentOffer({ token }) {
  const [offer, setOffer] = useState(undefined);
  const [mode, setMode] = useState('view');      // view | choose
  const [cal, setCal] = useState(null);
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);        // accepted | chose | declined
  const load = useCallback(async () => {
    try { setOffer(await sbRpc('get_appointment_offer', SB_KEY, { p_token: token })); } catch (e) { setOffer(null); }
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => { if (offer?.business) document.title = `${offer.business} · Your appointment`; }, [offer]);
  const openChoose = async () => {
    setMode('choose'); setSlot('');
    try {
      const c = await sbRpc('offer_calendar', SB_KEY, { p_token: token, p_days: 14 });
      setCal(c); setDay((c?.days || []).find((d) => d.slots.length)?.date || '');
    } catch (e) { brandAlert(e.message, { theme: 'light' }); }
  };
  const respond = async (action) => {
    if (action === 'decline' && !(await brandConfirm(`${offer.business} will be told you can't make it, and the appointment will be cancelled.`, { title: "Can't make it?", confirm: "Yes, I can't make it", danger: true, theme: 'light', cancel: 'Go back' }))) return;
    setBusy(true);
    try {
      await sbRpc('respond_to_offer', SB_KEY, { p_token: token, p_action: action, ...(action === 'choose' ? { p_start_at: slot } : {}) });
      setDone(action === 'accept' ? 'accepted' : action === 'choose' ? 'chose' : 'declined'); await load();
    } catch (e) {
      brandAlert(e.message, { theme: 'light', title: 'Please try again' });
      if (action === 'choose') openChoose(); else load();
    }
    setBusy(false);
  };

  const page = { background: S.bg, color: S.ink, fontFamily: SF_FONT, minHeight: '100vh' };
  const btn = 'w-full py-3.5 rounded-xl text-[15px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black';
  if (offer === undefined) return <div className="flex items-center justify-center" style={page}><Loader2 className="animate-spin" size={22} style={{ color: S.muted }} /></div>;
  if (!offer) return (
    <div className="flex flex-col items-center justify-center px-6 text-center" style={page}>
      <div className="text-[20px] font-bold mb-2">This link isn't working</div>
      <div className="text-[14px] max-w-sm" style={{ color: S.muted }}>It may have been replaced by a newer message. Check the latest message from the business, or contact them directly.</div>
    </div>
  );
  const services = (offer.items || []).map((it) => it.description).join(', ') + (offer.person ? `, with ${offer.person}` : '');
  const range = (a, b) => `${apptDay(a)}, ${apptTime(a)} to ${apptTime(b)}`;
  const wa = offer.phone ? `https://wa.me/${toWhatsAppNumber(offer.phone)}` : null;
  const store = offer.business_code ? `/store/${offer.business_code}` : null;
  const card = (children) => <div className="rounded-2xl p-5" style={{ background: S.tile }}>{children}</div>;
  const finished = (icon, title, body) => (
    <div className="text-center pt-6">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: S.ink }}>{icon}</div>
      <div className="text-[22px] font-bold mb-2">{title}</div>
      <div className="text-[14.5px] leading-relaxed max-w-sm mx-auto mb-7" style={{ color: S.muted }}>{body}</div>
      <div className="flex flex-col gap-2 max-w-xs mx-auto">
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={btn} style={{ border: `1.5px solid ${S.ink}`, textAlign: 'center' }}>Message {offer.business}</a>}
        {store && <a href={store} className="text-[13.5px] font-semibold py-2" style={{ color: S.ink }}>Visit {offer.business}</a>}
      </div>
    </div>
  );

  let body;
  if (offer.state === 'confirmed' || done === 'accepted') body = finished(<Check size={26} color="#fff" />, "You're booked", `${services} at ${offer.business}, ${range(offer.start_at, offer.end_at)}. See you then!`);
  else if (done === 'chose' || (offer.state === 'pending' && offer.reply === 'chose_other')) body = finished(<CalendarClock size={24} color="#fff" />, 'Time sent', `You asked for ${range(offer.start_at, offer.end_at)}. It's held for you while ${offer.business} confirms it.`);
  else if (offer.state === 'cancelled' || done === 'declined') body = finished(<X size={24} color="#fff" />, 'Appointment cancelled', `${offer.business} has been told. You're welcome to book another time whenever suits you.`);
  else if (offer.state === 'done') body = finished(<Check size={26} color="#fff" />, 'All done', `Thanks for visiting ${offer.business}.`);
  else if (offer.state === 'expired') body = finished(<CalendarClock size={24} color="#fff" />, 'This offer has expired', `The time ${offer.business} offered is no longer held. Message them, or book a new time.`);
  else if (mode === 'choose') body = (
    <>
      <button onClick={() => setMode('view')} className="flex items-center gap-1 text-[13px] font-medium mb-4" style={{ color: S.muted }}><ChevronLeft size={16} /> Back</button>
      <div className="text-[22px] font-bold mb-1">Choose another time</div>
      <div className="text-[14px] mb-4" style={{ color: S.muted }}>{services}. Only free times are shown.</div>
      {!cal ? <div className="flex items-center gap-2 text-[13px]" style={{ color: S.muted }}><Loader2 size={15} className="animate-spin" /> Checking free times…</div>
        : !cal.days.some((d) => d.slots.length) ? card(<div className="text-[14px]">No other free times in the next two weeks. Please message {offer.business}.</div>)
        : <SlotPicker light cal={cal} day={day} onDay={setDay} slot={slot} onSlot={setSlot} />}
      <button onClick={() => respond('choose')} disabled={!slot || busy} className={`${btn} mt-5`} style={{ background: S.ink, color: '#fff', opacity: !slot || busy ? 0.4 : 1 }}>{busy ? 'Sending…' : slot ? `Ask for ${apptDay(slot)}, ${apptTime(slot)}` : 'Pick a time'}</button>
      <div className="text-[12px] text-center mt-3" style={{ color: S.muted }}>{offer.business} will confirm your new choice.</div>
    </>
  );
  else body = (
    <>
      <div className="text-[13px] font-semibold mb-1" style={{ color: S.muted }}>Hi {offer.customer}</div>
      <h1 className="text-[26px] font-extrabold leading-tight mb-5" style={{ letterSpacing: '-0.02em' }}>{offer.business} has offered you a new time</h1>
      {card(
        <>
          <div className="text-[12px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: S.muted }}>New time</div>
          <div className="text-[20px] font-bold leading-snug">{apptDay(offer.start_at)}</div>
          <div className="text-[17px] font-semibold">{apptTime(offer.start_at)} to {apptTime(offer.end_at)}</div>
          {offer.parts ? (
            <div className="mt-3 space-y-1.5">
              {offer.parts.map((pt, i) => (
                <div key={i} className="text-[13.5px] leading-snug"><span className="font-semibold">{pt.guest || offer.customer}</span><span style={{ color: S.muted }}> · {apptTime(pt.start_at)} to {apptTime(pt.end_at)} · {(pt.items || []).join(', ')}{pt.person ? `, with ${pt.person}` : ''}</span></div>
              ))}
              {offer.total ? <div className="text-[14px] pt-1" style={{ color: S.muted }}>{fmt(offer.total)} in total</div> : null}
            </div>
          ) : <div className="text-[14px] mt-2" style={{ color: S.muted }}>{services}{offer.total ? ` · ${fmt(offer.total)}` : ''}</div>}
          {offer.requested_start_at && <div className="text-[13px] mt-3 pt-3" style={{ color: S.muted, borderTop: `1px solid ${S.line}` }}>You asked for <span style={{ textDecoration: 'line-through' }}>{apptDay(offer.requested_start_at)}, {apptTime(offer.requested_start_at)}</span></div>}
        </>
      )}
      <div className="flex flex-col gap-2.5 mt-6">
        <button onClick={() => respond('accept')} disabled={busy} className={btn} style={{ background: S.ink, color: '#fff', opacity: busy ? 0.5 : 1 }}>{busy ? 'Confirming…' : 'Accept this time'}</button>
        <button onClick={openChoose} disabled={busy} className={btn} style={{ border: `1.5px solid ${S.ink}` }}>Choose another time</button>
        <button onClick={() => respond('decline')} disabled={busy} className="py-2.5 text-[14px] font-medium" style={{ color: S.muted }}>I can't make it</button>
      </div>
      <div className="text-[12px] text-center mt-4" style={{ color: S.muted }}>This time is held for you for a limited time.{wa ? <> Questions? <a href={wa} target="_blank" rel="noopener noreferrer" className="underline">Message {offer.business}</a>.</> : null}</div>
    </>
  );
  return (
    <div style={page}>
      <main className="max-w-md mx-auto px-5 py-8 pb-16">
        <div className="text-[15px] font-bold mb-8">{offer.business}</div>
        {body}
      </main>
      <footer className="max-w-md mx-auto px-5 pb-8 text-[11.5px] flex justify-between" style={{ color: S.muted }}><span>Powered by Xorla</span><a href="/privacy" className="underline">Privacy</a></footer>
    </div>
  );
}

// ---------- The guest's own booking page (/booking/…): see it, pay the deposit, or cancel ----------
function GuestBooking({ token }) {
  const [bk, setBk] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [rf, setRf] = useState({ bank: '', number: '', name: '', editing: false });
  const [online, setOnline] = useState(null);          // { deposit, xorla_fee, fee_total, total } when the business takes online payments
  const [showTransfer, setShowTransfer] = useState(false);
  const [payNote, setPayNote] = useState('');          // after returning from Paystack
  // Checked-in guests order extras to their room: they go on the bill, paid at check-out
  const [menu, setMenu] = useState(null);
  const [roomCart, setRoomCart] = useState({});
  const [roomNote, setRoomNote] = useState('');
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomMsg, setRoomMsg] = useState(null);         // { ok, text }
  const loadMenu = useCallback(async () => { try { setMenu(await sbRpc('guest_room_menu', SB_KEY, { p_token: token })); } catch (e) { setMenu(null); } }, [token]);
  const billing = async (action, extra = {}) => {
    const res = await fetch(`${SB_URL}/functions/v1/billing`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, body: JSON.stringify({ action, token, ...extra }) });
    const data = (await res.json().catch(() => null)) || {};
    if (!res.ok || data.error) throw new Error(data.error || 'Payments are not available right now. Please try again.');
    return data;
  };
  const isNew = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1';
  const load = useCallback(async () => {
    let g = null;
    try { g = await sbRpc('guest_booking', SB_KEY, { p_token: token }); setBk(g); } catch (e) { setBk(null); return; }
    if (g && g.status === 'checked_in' && !g.is_space) loadMenu(); else setMenu(null);
    const owing = g ? Math.max(0, Number(g.deposit_due) - Number(g.deposit_paid)) : 0;
    if (!g || owing <= 0 || !['requested', 'confirmed'].includes(g.status)) { setOnline(null); return; }
    try {
      const on = await sbRpc('guest_booking_online', SB_KEY, { p_token: token });
      if (on) setOnline(await billing('deposit_quote')); else setOnline(null);
    } catch (e) { setOnline(null); }
  }, [token, loadMenu]);
  // Back from Paystack: confirm the payment straight away (the webhook does it too)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ref = q.get('reference') || q.get('trxref');
    if (q.get('paid') !== '1' || !ref) return;
    setPayNote('checking');
    billing('deposit_verify', { reference: ref })
      .then((r) => { setPayNote(r && r.ok !== false ? (r.refund_due ? 'refund' : 'paid') : 'pending'); load(); })
      .catch(() => { setPayNote('pending'); load(); })
      .finally(() => { try { window.history.replaceState(null, '', window.location.pathname); } catch (e) {} });
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => { if (bk?.business) document.title = `${bk.business} · Your booking`; }, [bk]);
  const page = { background: S.bg, color: S.ink, fontFamily: SF_FONT, minHeight: '100vh' };
  const btn = 'w-full py-3.5 rounded-xl text-[15px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black';
  if (bk === undefined) return <div className="flex items-center justify-center" style={page}><Loader2 className="animate-spin" size={22} style={{ color: S.muted }} /></div>;
  if (!bk) return (
    <div className="flex flex-col items-center justify-center px-6 text-center" style={page}>
      <div className="text-[20px] font-bold mb-2">This link isn't working</div>
      <div className="text-[14px] max-w-sm" style={{ color: S.muted }}>Check the link you were sent, or contact the business directly.</div>
    </div>
  );
  const day = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const when = (t) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' });
  const word = bk.price_unit === 'day' ? 'day' : 'night';
  const spaceDays = bk.is_space ? Math.round((new Date(bk.check_out + 'T00:00:00Z') - new Date(bk.check_in + 'T00:00:00Z')) / 86400000) : 0;
  const lastDay = bk.is_space ? new Date(new Date(bk.check_out + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10) : '';
  const eventWhenText = !bk.is_space ? '' : bk.start_time ? `${day(bk.check_in)}, ${eventTimeLabel(bk.start_time)} to ${eventTimeLabel(bk.end_time)}` : spaceDays > 1 ? `${day(bk.check_in)} to ${day(lastDay)}` : `${day(bk.check_in)}, all day`;
  const link = typeof window !== 'undefined' ? `${window.location.origin}/booking/${token}` : '';
  const waText = isNew && ['requested', 'confirmed'].includes(bk.status) ? `Hello ${bk.business}, I just sent a booking request: ${bk.item}${bk.units > 1 ? ` × ${bk.units}` : ''}, ${bk.is_space ? eventWhenText : `${day(bk.check_in)} to ${day(bk.check_out)}`}. My name is ${bk.customer_name}. My booking: ${link}` : '';
  const wa = bk.phone ? `https://wa.me/${toWhatsAppNumber(bk.phone)}${waText ? `?text=${encodeURIComponent(waText)}` : ''}` : null;
  const saveRefund = async () => {
    setBusy(true);
    try { await sbRpc('guest_refund_details', SB_KEY, { p_token: token, p_bank: rf.bank, p_number: rf.number, p_name: rf.name }); setRf({ bank: '', number: '', name: '', editing: false }); await load(); }
    catch (e) { brandAlert(e.message, { theme: 'light', title: 'Please check the details' }); }
    setBusy(false);
  };
  const owing = Math.max(0, Number(bk.deposit_due) - Number(bk.deposit_paid));
  const early = bk.free_cancel_until && Date.now() < new Date(bk.free_cancel_until).getTime();
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 2000); } catch (e) { brandAlert(text, { theme: 'light', title: 'Copy this' }); } };
  const act = async (action) => {
    if (action === 'cancel') {
      const msg = Number(bk.deposit_paid) > 0
        ? (early ? `${bk.business} will owe you your ${fmt(bk.deposit_paid)} deposit back.` : `It's less than ${bk.cancel_window_hours} hours before ${bk.is_space ? 'the event' : 'check-in'}, so the ${fmt(bk.deposit_paid)} deposit won't be refunded.`)
        : `${bk.business} will be told straight away, and the dates will be released.`;
      if (!(await brandConfirm(msg, { title: 'Cancel this booking?', confirm: 'Yes, cancel it', cancel: 'Keep my booking', danger: true, theme: 'light' }))) return;
    }
    setBusy(true);
    try { await sbRpc('guest_booking_action', SB_KEY, { p_token: token, p_action: action }); await load(); }
    catch (e) { brandAlert(e.message, { theme: 'light', title: 'Please try again' }); load(); }
    setBusy(false);
  };
  const states = {
    requested: ['#FFF4D6', '#8A5A00', 'Waiting for confirmation', `${bk.business} has your request. Your dates are held until ${bk.hold_until ? when(bk.hold_until) : 'they reply'}.`],
    confirmed: ['#DFF6EE', '#0E7A5F', 'Confirmed', owing > 0 ? `Your booking is confirmed. Send the deposit to secure it.` : `You're all set. See you on ${day(bk.check_in)}.`],
    checked_in: ['#DFF6EE', '#0E7A5F', 'Checked in', `Enjoy your stay at ${bk.business}.`],
    checked_out: ['#F1F2EF', '#3F4440', 'Completed', `Thanks for staying at ${bk.business}.`],
    cancelled: ['#FDECEA', '#B42318', 'Cancelled', bk.deposit_status === 'refund_due' ? (bk.refund_to ? `${bk.business} will send your ${fmt(bk.refund_amount)} refund to the account below.` : `You'll get your ${fmt(bk.refund_amount)} deposit back. Tell ${bk.business} where to send it below.`) : bk.deposit_status === 'refunded' ? `Your ${fmt(bk.refund_amount)} deposit has been refunded.` : bk.deposit_status === 'kept' ? 'The deposit was kept, as the cancellation was late.' : 'This booking has been cancelled.'],
    declined: ['#FDECEA', '#B42318', 'Not available', `${bk.business} couldn't take this booking${bk.cancel_reason ? `: ${bk.cancel_reason}` : ''}. Try other dates on their page.`],
    expired: ['#F1F2EF', '#3F4440', 'Request expired', `${bk.business} didn't confirm in time, so the dates were released. You can book again.`],
    no_show: ['#F1F2EF', '#3F4440', 'Missed', 'This booking was marked as not arrived.'],
  };
  const [stBg, stFg, stTitle, stBody] = states[bk.status] || states.requested;
  const payOnline = async () => {
    setBusy(true);
    try { const r = await billing('deposit_init'); window.location.href = r.url; }
    catch (e) { brandAlert(e.message, { theme: 'light', title: 'Payment could not start' }); setBusy(false); }
  };
  const row = (l, v, strong) => <div className="flex items-baseline justify-between gap-4 py-1.5"><span style={{ color: S.muted }}>{l}</span><span className={strong ? 'font-bold' : 'font-medium'} style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{v}</span></div>;
  return (
    <div style={page}>
      <div className="max-w-md mx-auto px-5 pt-8 pb-12">
        {bk.business_code && <a href={`/store/${bk.business_code}`} className="inline-flex items-center gap-1 -ml-1 mb-5 px-1 py-1 rounded-lg text-[14px] font-semibold" style={{ color: S.ink }}><ChevronLeft size={18} /> Back to {bk.business}</a>}
        <div className="text-[13px] font-semibold uppercase tracking-wide mb-1" style={{ color: S.muted }}>Your booking</div>
        <div className="text-[26px] font-bold leading-tight mb-5">{bk.business}</div>

        {isNew && ['requested', 'confirmed'].includes(bk.status) && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: S.ink, color: '#fff' }}>
            <div className="flex items-center gap-2 text-[15px] font-bold"><Check size={18} /> Request sent</div>
            <div className="text-[13.5px] mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}>Keep this page: it's your booking. Come back any time to check it, pay the deposit or cancel.</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={() => copy(link, 'link')} className="py-2.5 rounded-xl text-[13.5px] font-semibold" style={{ background: 'rgba(255,255,255,0.14)' }}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`My booking at ${bk.business}: ${link}`)}`} target="_blank" rel="noopener noreferrer" className="py-2.5 rounded-xl text-[13.5px] font-semibold text-center" style={{ background: '#fff', color: S.ink }}>Save on WhatsApp</a>
            </div>
          </div>
        )}

        {payNote && (
          <div className="rounded-2xl p-4 mb-4 flex items-start gap-3" style={{ background: payNote === 'paid' ? '#DFF6EE' : payNote === 'refund' ? '#FDECEA' : S.tile }}>
            {payNote === 'checking' ? <Loader2 size={18} className="animate-spin shrink-0 mt-0.5" /> : payNote === 'paid' ? <Check size={18} className="shrink-0 mt-0.5" style={{ color: '#0E7A5F' }} /> : <Clock size={18} className="shrink-0 mt-0.5" />}
            <div className="text-[13.5px] leading-relaxed">{payNote === 'checking' ? 'Confirming your payment…' : payNote === 'paid' ? <><strong>Payment received.</strong> Your deposit is paid and the booking is confirmed. {bk.business} has been told.</> : payNote === 'refund' ? <><strong>Payment received, but these dates were no longer available.</strong> {bk.business} owes you the deposit back.</> : <><strong>Payment not confirmed yet.</strong> If you paid by transfer, it can take a few minutes. This page updates once it arrives.</>}</div>
          </div>
        )}

        <div className="rounded-2xl p-4 mb-4" style={{ background: stBg }}>
          <div className="text-[15px] font-bold" style={{ color: stFg }}>{stTitle}</div>
          <div className="text-[13.5px] mt-1 leading-relaxed" style={{ color: S.ink }}>{stBody}</div>
        </div>

        <div className="rounded-2xl p-4 mb-4 text-[14px]" style={{ background: S.tile }}>
          <div className="text-[17px] font-bold mb-1">{bk.item}{bk.units > 1 ? ` × ${bk.units}` : ''}</div>
          {bk.is_space ? (<>
            {row('Date', spaceDays > 1 ? `${day(bk.check_in)} to ${day(lastDay)}` : day(bk.check_in))}
            {row('Time', bk.start_time ? `${eventTimeLabel(bk.start_time)} to ${eventTimeLabel(bk.end_time)}` : spaceDays > 1 ? `All day, ${spaceDays} days` : 'All day')}
            {(bk.event_type || bk.guest_count) ? row('Event', [bk.event_type, bk.guest_count ? `${bk.guest_count} guests` : ''].filter(Boolean).join(', ')) : null}
            {row('Booked by', bk.customer_name)}
          </>) : (<>
          {row('Check-in', `${day(bk.check_in)}, from ${hhmmLabel(bk.checkin_time || '14:00')}`)}
          {row('Check-out', `${day(bk.check_out)}, by ${hhmmLabel(bk.checkout_time || '12:00')}`)}
          {row(`${word[0].toUpperCase()}${word.slice(1)}s`, bk.nights)}
          {row('Guest', bk.customer_name)}
          </>)}
          <div className="my-1.5" style={{ borderTop: `1px solid ${S.line}` }} />
          {row('Total', fmt(bk.total), true)}
          {Number(bk.amount_paid) > 0 && row('Paid so far', fmt(bk.amount_paid))}
          {bk.address && <div className="text-[12.5px] mt-2 flex items-start gap-1.5" style={{ color: S.muted }}><MapPin size={14} className="shrink-0 mt-0.5" /> {bk.address}</div>}
        </div>

        {menu && (() => {
          const items = menu.items || [];
          const lines = items.filter((x) => roomCart[x.id] > 0);
          const total = lines.reduce((a, x) => a + Number(x.price) * roomCart[x.id], 0);
          const billTotal = (menu.bill || []).reduce((a, c) => a + Number(c.amount), 0);
          const setQty = (x, n) => { setRoomMsg(null); setRoomCart((c) => ({ ...c, [x.id]: Math.max(0, Math.min(20, n)) })); };
          const send = async () => {
            if (!lines.length || roomBusy) return;
            setRoomBusy(true); setRoomMsg(null);
            try {
              await sbRpc('guest_room_order', SB_KEY, { p_token: token, p_items: lines.map((x) => ({ productId: x.id, quantity: roomCart[x.id] })), p_note: roomNote.trim() });
              setRoomCart({}); setRoomNote('');
              setRoomMsg({ ok: true, text: `Ordered. It's on your bill, and ${bk.business} has been told. They'll bring it to ${menu.room ? `room ${menu.room}` : 'your room'}.` });
              loadMenu();
            } catch (e) { setRoomMsg({ ok: false, text: e.message }); }
            setRoomBusy(false);
          };
          if (!items.length && !(menu.bill || []).length) return null;
          return (
            <div className="rounded-2xl p-4 mb-4" style={{ border: `1px solid ${S.line}` }}>
              <div className="text-[17px] font-bold">Order to your room</div>
              <div className="text-[13px] mt-0.5 mb-3" style={{ color: S.muted }}>It goes on your bill{menu.room ? ` for room ${menu.room}` : ''}. Pay when you check out.</div>
              {roomMsg && <div className="text-[13px] rounded-xl px-3.5 py-2.5 mb-3" style={roomMsg.ok ? { background: '#DFF6EE', color: '#0E7A5F' } : { background: '#FDECEA', color: '#B42318' }}>{roomMsg.text}</div>}
              <div className="divide-y" style={{ borderColor: S.line }}>
                {items.map((x) => {
                  const n = roomCart[x.id] || 0;
                  return (
                    <div key={x.id} className="flex items-center gap-3 py-2.5" style={{ borderColor: S.line, opacity: x.out ? 0.5 : 1 }}>
                      {x.image_url ? <img src={x.image_url} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" style={{ background: S.tile }} /> : <span className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center" style={{ background: S.tile }}><Package size={16} style={{ color: S.soldOut }} /></span>}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold leading-snug">{x.name}</span>
                        <span className="block text-[13px]" style={{ color: S.muted, fontVariantNumeric: 'tabular-nums' }}>{fmt(x.price)}{x.out ? ' · out of stock' : ''}</span>
                      </span>
                      {x.out ? null : n === 0 ? (
                        <button onClick={() => setQty(x, 1)} className="shrink-0 px-4 h-9 rounded-full text-[13.5px] font-semibold" style={{ border: `1.5px solid ${S.ink}` }}>Add</button>
                      ) : (
                        <span className="shrink-0 flex items-center gap-2">
                          <button onClick={() => setQty(x, n - 1)} aria-label={`One fewer ${x.name}`} className="w-9 h-9 rounded-full text-[18px] font-semibold" style={{ background: S.tile }}>−</button>
                          <span className="w-5 text-center text-[15px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                          <button onClick={() => setQty(x, n + 1)} aria-label={`One more ${x.name}`} className="w-9 h-9 rounded-full text-[18px] font-semibold" style={{ background: S.tile }}>+</button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {lines.length > 0 && (
                <div className="sticky bottom-3 mt-3 rounded-2xl p-3 space-y-2.5" style={{ background: '#fff', boxShadow: '0 8px 28px rgba(0,0,0,0.14)', border: `1px solid ${S.line}` }}>
                  <input value={roomNote} onChange={(e) => setRoomNote(e.target.value)} maxLength={200} placeholder="Anything to add? e.g. Cold, please" className="w-full rounded-xl px-3.5 py-2.5 text-[14px] outline-none" style={{ background: S.tile, border: 'none', color: S.ink }} />
                  <button onClick={send} disabled={roomBusy} className={btn} style={{ background: S.ink, color: '#fff', opacity: roomBusy ? 0.6 : 1 }}>{roomBusy ? 'Sending…' : `Add to my bill · ${fmt(total)}`}</button>
                </div>
              )}
              {(menu.orders || []).length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {menu.orders.slice(0, 3).map((o) => (
                    <div key={o.id} className="flex items-start justify-between gap-3 text-[13px]">
                      <span className="min-w-0" style={{ color: S.muted }}>{(o.items || []).map((i) => `${i.quantity} × ${i.description}`).join(', ')}</span>
                      <span className="shrink-0 font-semibold" style={{ color: o.status === 'delivered' ? '#0E7A5F' : '#B54708' }}>{o.status === 'delivered' ? 'Delivered' : 'On its way'}</span>
                    </div>
                  ))}
                </div>
              )}
              {(menu.bill || []).length > 0 && (
                <details className="mt-4 rounded-xl px-3.5 py-3 text-[13px]" style={{ background: S.tile }}>
                  <summary className="flex items-center justify-between cursor-pointer font-semibold list-none"><span>Your extras so far</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(billTotal)}</span></summary>
                  <div className="mt-2 space-y-1">
                    {menu.bill.map((c, i) => <div key={i} className="flex justify-between gap-3" style={{ color: S.muted }}><span>{Number(c.quantity) > 1 ? `${Number(c.quantity)} × ` : ''}{c.item}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(c.amount)}</span></div>)}
                  </div>
                </details>
              )}
            </div>
          );
        })()}

        {bk.pay && owing > 0 && (
          <div className="rounded-2xl p-4 mb-4" style={{ border: `1.5px solid ${S.ink}` }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-bold">Deposit to secure it</span>
              <span className="text-[20px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(owing)}</span>
            </div>
            {online && (
              <>
                <div className="rounded-xl p-3.5 mt-3 text-[13.5px] space-y-1" style={{ background: S.tile }}>
                  <div className="flex justify-between"><span style={{ color: S.muted }}>Deposit</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(online.deposit)}</span></div>
                  <div className="flex justify-between"><span style={{ color: S.muted }}>Service fee</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(online.fee_total)}</span></div>
                  <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px solid ${S.line}` }}><span>You pay</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(online.total)}</span></div>
                </div>
                <button onClick={payOnline} disabled={busy} className={`${btn} mt-3 flex items-center justify-center gap-2`} style={{ background: S.ink, color: '#fff', opacity: busy ? 0.6 : 1 }}>{busy ? 'Opening Paystack…' : <><Lock size={15} /> Pay {fmt(online.total)} now</>}</button>
                <div className="text-[12px] text-center mt-2" style={{ color: S.muted }}>Card, bank transfer or USSD · secured by Paystack · confirms instantly</div>
                <div className="text-[11.5px] text-center mt-1" style={{ color: S.muted }}>If you cancel in time, your deposit is refunded. The service fee isn't.</div>
                {bk.pay.account_number && !showTransfer && <button onClick={() => setShowTransfer(true)} className="w-full mt-3 text-[13px] font-semibold" style={{ color: S.ink }}>Or pay {fmt(owing)} by direct bank transfer</button>}
              </>
            )}
            {online && !showTransfer ? null : bk.pay.account_number ? (
              <>
                <div className="text-[13px] mt-1 mb-3" style={{ color: S.muted }}>{online ? 'Or send it by bank transfer to:' : 'Send it by bank transfer to:'}</div>
                <div className="rounded-xl p-3.5 space-y-1" style={{ background: S.tile }}>
                  {bk.pay.bank_name && <div className="text-[13px]" style={{ color: S.muted }}>{bk.pay.bank_name}</div>}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[22px] font-bold tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>{bk.pay.account_number}</span>
                    <button onClick={() => copy(bk.pay.account_number, 'acct')} className="shrink-0 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5" style={{ background: '#fff', border: `1px solid ${S.line}` }}><Copy size={13} /> {copied === 'acct' ? 'Copied' : 'Copy'}</button>
                  </div>
                  {bk.pay.account_name && <div className="text-[13.5px] font-semibold">{bk.pay.account_name}</div>}
                </div>
                <div className="text-[12.5px] mt-2.5 leading-relaxed" style={{ color: S.muted }}>{bk.pay.note || `Use your name (${bk.customer_name}) as the reference.`}</div>
              </>
            ) : online ? null : <div className="text-[13px] mt-1.5 leading-relaxed" style={{ color: S.muted }}>Message {bk.business} for their payment details.</div>}
            {(online && !showTransfer) ? null : bk.guest_paid_said_at
              ? <div className="mt-3 rounded-xl px-3.5 py-3 text-[13px] leading-relaxed" style={{ background: '#DFF6EE', color: '#0E7A5F' }}><strong>Thanks!</strong> You told {bk.business} you sent it ({when(bk.guest_paid_said_at)}). They'll confirm once it arrives.</div>
              : <button onClick={() => act('paid')} disabled={busy} className={`${btn} mt-3`} style={{ background: S.ink, color: '#fff', opacity: busy ? 0.6 : 1 }}>{busy ? 'Sending…' : "I've sent the deposit"}</button>}
          </div>
        )}

        {bk.deposit_status === 'refund_due' && (
          <div className="rounded-2xl p-4 mb-4" style={{ border: `1.5px solid ${S.ink}` }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-bold">Your refund</span>
              <span className="text-[20px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(bk.refund_amount)}</span>
            </div>
            {bk.refund_to && !rf.editing ? (
              <>
                <div className="text-[13px] mt-1 mb-2.5" style={{ color: S.muted }}>{bk.business} will send it to:</div>
                <div className="rounded-xl p-3.5" style={{ background: S.tile }}>
                  <div className="text-[13px]" style={{ color: S.muted }}>{bk.refund_to.bank_name}</div>
                  <div className="text-[19px] font-bold tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>{bk.refund_to.account_number}</div>
                  <div className="text-[13.5px] font-semibold">{bk.refund_to.account_name}</div>
                </div>
                <button onClick={() => setRf({ bank: bk.refund_to.bank_name || '', number: bk.refund_to.account_number || '', name: bk.refund_to.account_name || '', editing: true })} className="mt-2 text-[13px] font-semibold" style={{ color: S.ink }}>Change account</button>
              </>
            ) : (
              <>
                <div className="text-[13px] mt-1 mb-3 leading-relaxed" style={{ color: S.muted }}>Where should {bk.business} send it? Use an account in your own name.</div>
                <div className="space-y-2">
                  <input value={rf.bank} onChange={(e) => setRf({ ...rf, bank: e.target.value })} placeholder="Bank, e.g. GTBank, Opay, Moniepoint" className="w-full rounded-xl px-4 py-3 text-[15px] outline-none" style={{ background: S.tile, color: S.ink }} />
                  <input value={rf.number} inputMode="numeric" onChange={(e) => setRf({ ...rf, number: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })} placeholder="Account number (10 digits)" className="w-full rounded-xl px-4 py-3 text-[15px] outline-none tracking-wider" style={{ background: S.tile, color: S.ink, fontVariantNumeric: 'tabular-nums' }} />
                  <input value={rf.name} onChange={(e) => setRf({ ...rf, name: e.target.value })} placeholder="Name on the account" className="w-full rounded-xl px-4 py-3 text-[15px] outline-none" style={{ background: S.tile, color: S.ink }} />
                </div>
                <button onClick={saveRefund} disabled={busy || rf.number.length !== 10 || !rf.bank.trim() || rf.name.trim().length < 3} className={`${btn} mt-3`} style={{ background: S.ink, color: '#fff', opacity: busy || rf.number.length !== 10 || !rf.bank.trim() || rf.name.trim().length < 3 ? 0.4 : 1 }}>{busy ? 'Sending…' : `Send to ${bk.business}`}</button>
              </>
            )}
          </div>
        )}

        {['requested', 'confirmed'].includes(bk.status) && (
          <div className="flex items-start gap-2.5 text-[13px] leading-relaxed mb-5 px-1" style={{ color: S.muted }}>
            <ShieldCheck size={16} className="shrink-0 mt-0.5" style={{ color: '#0E7A5F' }} />
            <span>{early ? <>Free cancellation until <strong style={{ color: S.ink }}>{when(bk.free_cancel_until)}</strong>.{Number(bk.deposit_due) > 0 ? ' After that, the deposit is not refunded.' : ''}</> : Number(bk.deposit_paid) > 0 ? 'The free cancellation time has passed, so the deposit would not be refunded.' : 'You can still cancel if your plans change.'}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={btn} style={{ border: `1.5px solid ${S.ink}`, textAlign: 'center' }}>Message {bk.business}</a>}
          {bk.can_cancel && <button onClick={() => act('cancel')} disabled={busy} className="py-3 text-[14px] font-semibold" style={{ color: '#B42318' }}>Cancel booking</button>}
          {bk.business_code && ['declined', 'expired', 'cancelled', 'checked_out'].includes(bk.status) && <a href={`/store/${bk.business_code}`} className={btn} style={{ background: S.ink, color: '#fff', textAlign: 'center' }}>Book again</a>}
        </div>
        <div className="text-center text-[11.5px] mt-10" style={{ color: S.soldOut }}>Bookings by Xorla</div>
      </div>
    </div>
  );
}

// ---------- The customer's own order page (/order/…): track it, and pay online once the business confirms ----------
function CustomerOrder({ token }) {
  const [od, setOd] = useState(undefined);
  const [xr, setXr] = useState(null);   // a Xorla rider on this delivery: who, and the code to give them
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [quote, setQuote] = useState(null);           // { amount, fee_total, total } once there's something to pay online
  const [payNote, setPayNote] = useState('');
  const [rf, setRf] = useState({ bank: '', number: '', name: '', editing: false });
  const billing = async (action, extra = {}) => {
    const res = await fetch(`${SB_URL}/functions/v1/billing`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, body: JSON.stringify({ action, token, ...extra }) });
    const data = (await res.json().catch(() => null)) || {};
    if (!res.ok || data.error) throw new Error(data.error || 'Payments are not available right now. Please try again.');
    return data;
  };
  const isNew = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1';
  const load = useCallback(async () => {
    let o = null;
    try { o = await sbRpc('customer_order', SB_KEY, { p_token: token }); setOd(o); } catch (e) { setOd((prev) => (prev === undefined ? null : prev)); return; }
    if (o && o.fulfil_mode === 'delivery') sbRpc('customer_order_rider', SB_KEY, { p_token: token }).then((x) => setXr(x || null)).catch(() => {});
    if (o && o.status === 'pending' && o.pay_status === 'requested' && o.online) {
      try { setQuote(await billing('order_quote')); } catch (e) { setQuote(null); }
    } else setQuote(null);
  }, [token]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ref = q.get('reference') || q.get('trxref');
    if (q.get('paid') !== '1' || !ref) return;
    setPayNote('checking');
    billing('order_verify', { reference: ref })
      .then((r) => { setPayNote(r && r.ok !== false ? (r.refund_due ? 'refund' : 'paid') : 'pending'); load(); })
      .catch(() => { setPayNote('pending'); load(); })
      .finally(() => { try { window.history.replaceState(null, '', window.location.pathname); } catch (e) {} });
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  // While waiting on the business, keep the page fresh so "Pay now" appears as soon as they confirm
  const waiting = od && od.status === 'pending' && od.pay_status !== 'paid';
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20000);
    return () => clearInterval(t);
  }, [waiting, load]);
  // While a rider is on the way, keep it fresh
  useEffect(() => { if (!xr || !['taken', 'picked_up'].includes(xr.status)) return undefined; const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20000); return () => clearInterval(t); }, [xr?.status, load]);
  useEffect(() => { if (od?.business) document.title = `${od.business} · Your ${od.business_type === 'services' ? 'request' : 'order'}`; }, [od]);
  const page = { background: S.bg, color: S.ink, fontFamily: SF_FONT, minHeight: '100vh' };
  const btn = 'w-full py-3.5 rounded-xl text-[15px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black';
  if (od === undefined) return <div className="flex items-center justify-center" style={page}><Loader2 className="animate-spin" size={22} style={{ color: S.muted }} /></div>;
  if (!od) return (
    <div className="flex flex-col items-center justify-center px-6 text-center" style={page}>
      <div className="text-[20px] font-bold mb-2">This link isn't working</div>
      <div className="text-[14px] max-w-sm" style={{ color: S.muted }}>Check the link you were sent, or contact the business directly.</div>
    </div>
  );
  const noun = od.business_type === 'services' ? 'request' : 'order';
  const Noun = noun[0].toUpperCase() + noun.slice(1);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/order/${token}` : '';
  const items = Array.isArray(od.items) ? od.items : [];
  const itemsTotal = items.reduce((a, it) => a + Number(it.quantity) * Number(it.unitPrice), 0);
  const discount = Number(od.discount_amount) || 0;
  const delivery = Number(od.delivery_fee) || 0;
  const total = Number(od.pay_amount ?? (Number(od.total) + delivery));
  // An appointment deposit: part of the price now to keep the time, the rest at the visit
  const isDeposit = od.pay_kind === 'deposit' || (od.pay_amount != null && Number(od.pay_amount) < Number(od.total) + delivery && (!!od.is_appointment || od.business_type === 'services'));
  const restAtVisit = Math.max(0, Number(od.total) + delivery - Number(od.pay_amount || 0));
  // Each kind of service in its own words
  const sk = od.service_kind || '';
  const timedVisit = !!od.is_appointment && !od.job_status;
  const restWhen = od.visit_mode === 'venue' ? 'later, as agreed' : timedVisit ? (sk === 'repairs' && od.visit_mode !== 'home' ? 'when you collect it' : 'at your visit') : sk === 'repairs' ? 'when you collect it' : "when it's done";
  const keepWhat = od.visit_mode === 'venue' ? 'your date' : timedVisit ? 'your time' : 'it going';
  const feeName = od.visit_mode === 'home' ? (sk === 'repairs' ? 'Call-out fee' : 'Home service') : 'Delivery';
  const jobWhat = items.filter((it) => !it.adjust).map((it) => it.description).join(', ') || 'item';
  const first = String(od.customer_name || '').split(' ')[0];
  const addr = String(od.delivery_address || '').replace(/[.\s]+$/, '');
  const lCollect = laundryCollect({ fulfilMode: od.fulfil_mode, note: od.note }); const lDrop = laundryDrop({ fulfilMode: od.fulfil_mode, note: od.note });
  const when = (t) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' });
  const tellText = `Hello ${od.business}, I just sent ${noun === 'order' ? 'an order' : 'a request'} on your page: ${items.map((it) => `${it.description}${Number(it.quantity) > 1 ? ` x${it.quantity}` : ''}`).join(', ')}. My name is ${od.customer_name}. My ${noun}: ${link}`;
  const wa = od.phone ? `https://wa.me/${toWhatsAppNumber(od.phone)}${isNew && od.status === 'pending' ? `?text=${encodeURIComponent(tellText)}` : ''}` : null;
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 2000); } catch (e) { brandAlert(text, { theme: 'light', title: 'Copy this' }); } };
  const payOnline = async () => {
    setBusy(true);
    try { const r = await billing('order_init'); window.location.href = r.url; }
    catch (e) { brandAlert(e.message, { theme: 'light', title: 'Payment could not start' }); setBusy(false); load(); }
  };
  const saveRefund = async () => {
    setBusy(true);
    try { await sbRpc('customer_order_refund_details', SB_KEY, { p_token: token, p_bank: rf.bank, p_number: rf.number, p_name: rf.name }); setRf({ bank: '', number: '', name: '', editing: false }); await load(); }
    catch (e) { brandAlert(e.message, { theme: 'light', title: 'Please check the details' }); }
    setBusy(false);
  };
  const st = od.pay_status === 'refund_due' ? ['#FDECEA', '#B42318', 'Refund on its way', od.refund_to ? `${od.business} will send your ${fmt(od.refund_amount)} back to the account below.` : `${od.business} owes you ${fmt(od.refund_amount)} back. Tell them where to send it below.`]
    : od.pay_status === 'kept' ? ['#FFF4D6', '#8A5A00', 'Deposit kept', `This appointment was missed or cancelled late, so ${od.business} kept your ${fmt(od.amount_paid)} deposit. You're welcome to book again.`]
    : od.pay_status === 'refunded' ? ['#F1F2EF', '#3F4440', 'Refunded', `${od.business} sent your ${fmt(od.refund_amount)} back${od.refunded_at ? ` on ${when(od.refunded_at)}` : ''}.`]
    : od.status === 'fulfilled' ? ['#DFF6EE', '#0E7A5F', 'Completed', `Thank you for ${noun === 'order' ? 'ordering from' : 'choosing'} ${od.business}.`]
    : od.status === 'cancelled' ? ['#FDECEA', '#B42318', 'Cancelled', `${od.business} couldn't take this ${noun}${od.cancel_reason ? `: ${od.cancel_reason}` : ''}.`]
    : lCollect && od.ready_at ? ['#DFF6EE', '#0E7A5F', 'Clean and on its way back', `Your laundry is on its way back to ${addr}.${od.rider_name ? ` Your rider is ${od.rider_name}${od.rider_phone ? ` (${formatPhoneDisplay(od.rider_phone)})` : ''}.` : ''}${od.delivery_pay !== 'before' && od.pay_status !== 'paid' && !od.delivery_paid ? ` Please have ${fmt(itemsTotal - discount + delivery)} ready for them.` : ''}`]
    : lCollect && od.delivery_pay !== 'before' ? (od.accepted ? ['#DFF6EE', '#0E7A5F', 'Confirmed', `A rider will collect your laundry from ${addr}, and bring it back when it's clean. You pay when it comes back.`] : ['#FFF4D6', '#8A5A00', 'Waiting for confirmation', `${od.business} will confirm the price and the pickup fee, then send a rider to collect your laundry.`])
    : lDrop && od.ready_at ? ['#DFF6EE', '#0E7A5F', 'Clean and ready', `Your laundry is clean. Collect it from ${od.address || od.business}.`]
    : lDrop ? ['#DFF6EE', '#0E7A5F', od.accepted ? 'Confirmed' : 'Request sent', `Bring your laundry to ${od.address || od.business}. You'll get a message when it's clean and ready to collect.`]
    : od.ready_at && od.fulfil_mode === 'pickup' ? ['#DFF6EE', '#0E7A5F', 'Ready for pick-up', `Your ${noun} is ready. Collect it from ${od.address || od.business}.${od.pay_status === 'requested' && od.online ? ' Pay below first, or when you collect it.' : ''}`]
    : od.ready_at && od.fulfil_mode === 'delivery' ? ['#DFF6EE', '#0E7A5F', 'On its way', `Your ${noun} is on its way to ${addr}.${od.rider_name ? ` Your rider is ${od.rider_name}${od.rider_phone ? ` (${formatPhoneDisplay(od.rider_phone)})` : ''}.` : ''}${od.delivery_pay === 'on_delivery' && od.pay_status !== 'paid' && !od.delivery_paid ? ` Please have ${fmt(Number(od.total) + Number(od.delivery_fee || 0))} ready for them.` : ''}`]
    : od.job_status === 'ready' ? ['#DFF6EE', '#0E7A5F', 'Ready for collection', `Your ${jobWhat} is ready. Collect it from ${od.address || od.business}.${od.pay_status === 'paid' ? (restAtVisit > 0 && isDeposit ? ` Pay the rest (${fmt(restAtVisit)}) when you collect it.` : ' It is fully paid.') : ''}`]
    : od.job_status === 'received' ? ['#DFF6EE', '#0E7A5F', 'In for repair', `${od.business} has your ${jobWhat} and is working on it. You'll get a message when it's ready to collect.`]
    : od.pay_status === 'paid' ? ['#DFF6EE', '#0E7A5F', 'Paid', `Thanks, ${first}! ${od.business} has your payment${isDeposit && restAtVisit > 0 ? ` (the rest, ${fmt(restAtVisit)}, is paid ${restWhen})` : ''}${timedVisit ? '.' : noun === 'request' ? (od.job_status ? '.' : ' and will get started on it.') : ` and is getting your ${noun} ready.`}`]
    : od.pay_status === 'requested' && isDeposit ? ['#DFF6EE', '#0E7A5F', `Confirmed: pay a deposit to ${timedVisit ? `keep ${keepWhat}` : 'get started'}`, `${od.business} has confirmed ${timedVisit ? od.preferred_time || 'your booking' : `your ${noun}`}. Pay the ${fmt(Number(od.pay_amount))} deposit below${timedVisit ? ' to keep it' : ' to get started'}. The rest (${fmt(restAtVisit)}) is paid ${restWhen}.`]
    : od.pay_status === 'requested' ? ['#DFF6EE', '#0E7A5F', 'Confirmed: ready to pay', `${od.business} has everything for your ${noun}.${od.online ? ' Pay below to complete it.' : ''}`]
    : od.fulfil_mode === 'delivery' && od.delivery_pay === 'before' && !od.delivery_paid ? ['#FFF4D6', '#8A5A00', 'Confirmed: waiting for your payment', `Pay ${fmt(Number(od.total) + Number(od.delivery_fee || 0))} as ${od.business} asked on WhatsApp. They'll send it out with their rider as soon as it's in.`]
    : od.fulfil_mode === 'delivery' && od.delivery_pay === 'on_delivery' ? ['#DFF6EE', '#0E7A5F', 'Confirmed', `You'll pay ${fmt(Number(od.total) + Number(od.delivery_fee || 0))} to the rider when it arrives (cash or transfer). You'll get a message when it's on its way.`]
    : od.accepted ? ['#DFF6EE', '#0E7A5F', 'Confirmed', `${od.business} has confirmed your ${noun}${od.fulfil_mode === 'pickup' ? ". You'll get a message when it's ready to collect." : od.fulfil_mode === 'delivery' ? ". You'll get a message when it's on its way." : ` and will contact you about payment${noun === 'order' ? ' and pickup or delivery' : ''}.`}`]
    : ['#FFF4D6', '#8A5A00', 'Waiting for confirmation', `${od.business} is checking your ${noun}.${od.fulfil_mode === 'pickup' ? " You'll get a message when it's ready to collect." : od.fulfil_mode === 'delivery' ? " They'll confirm the delivery fee, then send it." : ''}${od.online ? ` Once they confirm, you can pay here online.` : od.fulfil_mode ? '' : ` They'll contact you to confirm and arrange payment.`}`];
  const row = (l, v, strong, color) => <div className="flex items-baseline justify-between gap-4 py-1.5"><span style={{ color: color || S.muted }}>{l}</span><span className={strong ? 'font-bold' : 'font-medium'} style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color }}>{v}</span></div>;
  return (
    <div style={page}>
      <div className="max-w-md mx-auto px-5 pt-8 pb-12">
        {od.business_code && <a href={`/store/${od.business_code}`} className="inline-flex items-center gap-1 -ml-1 mb-5 px-1 py-1 rounded-lg text-[14px] font-semibold" style={{ color: S.ink }}><ChevronLeft size={18} /> Back to {od.business}</a>}
        <div className="text-[13px] font-semibold uppercase tracking-wide mb-1" style={{ color: S.muted }}>Your {noun}</div>
        <div className="text-[26px] font-bold leading-tight mb-5">{od.business}</div>

        {isNew && od.status === 'pending' && !od.pay_status && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: S.ink, color: '#fff' }}>
            <div className="flex items-center gap-2 text-[15px] font-bold"><Check size={18} /> {Noun} sent</div>
            <div className="text-[13.5px] mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}>Keep this page: it shows your {noun}{od.online ? ', and you pay here once it\'s confirmed' : ''}.</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={() => copy(link, 'link')} className="py-2.5 rounded-xl text-[13.5px] font-semibold" style={{ background: 'rgba(255,255,255,0.14)' }}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`My ${noun} from ${od.business}: ${link}`)}`} target="_blank" rel="noopener noreferrer" className="py-2.5 rounded-xl text-[13.5px] font-semibold text-center" style={{ background: '#fff', color: S.ink }}>Save on WhatsApp</a>
            </div>
          </div>
        )}

        {payNote && (
          <div className="rounded-2xl p-4 mb-4 flex items-start gap-3" style={{ background: payNote === 'paid' ? '#DFF6EE' : payNote === 'refund' ? '#FDECEA' : S.tile }}>
            {payNote === 'checking' ? <Loader2 size={18} className="animate-spin shrink-0 mt-0.5" /> : payNote === 'paid' ? <Check size={18} className="shrink-0 mt-0.5" style={{ color: '#0E7A5F' }} /> : <Clock size={18} className="shrink-0 mt-0.5" />}
            <div className="text-[13.5px] leading-relaxed">{payNote === 'checking' ? 'Confirming your payment…' : payNote === 'paid' ? <><strong>Payment received.</strong> {od.business} has been told.</> : payNote === 'refund' ? <><strong>Payment received, but this {noun} was already closed.</strong> {od.business} owes you the money back.</> : <><strong>Payment not confirmed yet.</strong> If you paid by transfer, it can take a few minutes. This page updates once it arrives.</>}</div>
          </div>
        )}

        <div className="rounded-2xl p-4 mb-4" style={{ background: st[0] }}>
          <div className="text-[15px] font-bold" style={{ color: st[1] }}>{st[2]}</div>
          <div className="text-[13.5px] mt-1 leading-relaxed" style={{ color: S.ink }}>{st[3]}</div>
        </div>

        {od.status === 'pending' && od.custom_state && (() => {
          // The customer's own colour/size: waiting, a choice of what the business has, or confirmed
          const own = items.filter((it) => String(it.custom || '').trim());
          const wanted = own.map((it) => it.custom).join(', ');
          const wa = (txt) => (od.phone ? `https://wa.me/${toWhatsAppNumber(od.phone)}?text=${encodeURIComponent(txt)}` : null);
          if (od.custom_state === 'suggested') return (
            <div className="rounded-2xl p-4 mb-4" style={{ background: '#FFF4E5' }}>
              <div className="text-[15px] font-bold" style={{ color: '#B54708' }}>Please choose</div>
              <div className="text-[13.5px] mt-1 leading-relaxed">{od.business} can't do {wanted || 'your choice'} right now, but has:{od.custom_note ? ` ${od.custom_note}` : ''}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                {(od.custom_suggest || []).map((v) => { const href = wa(`Hello ${od.business}, for my order I'd like ${v}, please. (${od.customer_name})`); return href
                  ? <a key={v} href={href} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 rounded-xl text-[14px] font-semibold" style={{ background: S.ink, color: '#fff' }}>I'd like {v}</a>
                  : <span key={v} className="px-4 py-2.5 rounded-xl text-[14px] font-semibold" style={{ background: '#fff' }}>{v}</span>; })}
              </div>
              <div className="text-[12.5px] mt-2.5" style={{ color: S.muted }}>{od.phone ? 'Tapping one sends your choice on WhatsApp.' : `Tell ${od.business} which one you'd like.`}</div>
            </div>
          );
          if (od.custom_state === 'confirmed') return (
            <div className="rounded-2xl p-4 mb-4" style={{ background: '#DFF6EE' }}>
              <div className="text-[15px] font-bold" style={{ color: '#0E7A5F' }}>{own.length ? `${wanted}: confirmed` : 'Your choice is confirmed'}</div>
              <div className="text-[13.5px] mt-1 leading-relaxed">{od.business} can make it for you.{od.custom_note ? ` ${/^ready|^it|^we/i.test(od.custom_note) ? od.custom_note : `Ready in about ${od.custom_note.replace(/^(about|in)\s+/i, '')}`}${/[.!?]$/.test(od.custom_note) ? '' : '.'}` : ''}</div>
            </div>
          );
          return (
            <div className="rounded-2xl p-4 mb-4" style={{ background: S.tile }}>
              <div className="text-[15px] font-bold">Checking your choice</div>
              <div className="text-[13.5px] mt-1 leading-relaxed">{od.business} is checking they can make {wanted || 'it'} for you, and will confirm here and on WhatsApp.</div>
            </div>
          );
        })()}

        {xr && od.status === 'pending' && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: xr.status === 'delivered' ? '#DFF6EE' : '#0B3B33', color: xr.status === 'delivered' ? '#0E7A5F' : '#fff' }}>
            {xr.status === 'delivered' ? (
              <div className="flex items-center gap-2 text-[14px] font-semibold"><Check size={17} /> Delivered by {xr.rider_name}. Enjoy!</div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}><Bike size={20} style={{ color: '#FFB020' }} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold">{xr.status === 'picked_up' ? `${xr.rider_name} is on the way` : `${xr.rider_name} is collecting your order`}</span>
                    <span className="block text-[12.5px]" style={{ color: 'rgba(255,255,255,0.75)' }}>Verified Xorla rider{xr.plate ? ` · ${xr.plate}` : ''}</span>
                  </span>
                  {xr.rider_phone && <a href={`tel:${String(xr.rider_phone).replace(/[^0-9+]/g, '')}`} aria-label={`Call ${xr.rider_name}`} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.14)' }}><Phone size={17} /></a>}
                </div>
                {xr.delivery_code && (
                  <div className="mt-3 rounded-xl px-3.5 py-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px dashed rgba(255,255,255,0.3)' }}>
                    <span className="flex-1 min-w-0 text-[12.5px] leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>Your delivery code. Give it to {xr.rider_name} <strong style={{ color: '#fff' }}>only after</strong> you have your order.</span>
                    <span className="text-[28px] font-bold tracking-[0.18em] shrink-0" style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: '#FFB020' }}>{xr.delivery_code}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <div className="rounded-2xl p-4 mb-4 text-[14px]" style={{ background: S.tile }}>
          {items.map((it, i) => <div key={i}>{row(`${it.description}${Number(it.quantity) > 1 ? ` × ${it.quantity}` : ''}${it.for ? ` (for ${it.for})` : ''}`, fmt(Number(it.quantity) * Number(it.unitPrice)), false, S.ink)}</div>)}
          {discount > 0 && row(`Discount${od.discount_code ? ` (${od.discount_code})` : ''}`, fmt(-discount), false, '#0E7A5F')}
          {delivery > 0 && row(feeName, fmt(delivery), false, S.ink)}
          <div className="my-1.5" style={{ borderTop: `1px solid ${S.line}` }} />
          {row('Total', fmt(isDeposit ? Number(od.total) + delivery : od.pay_status ? total : itemsTotal - discount + delivery), true, S.ink)}
          {od.pay_status === 'requested' && isDeposit && row(timedVisit ? `Deposit to keep ${keepWhat}` : 'Deposit to get started', fmt(Number(od.pay_amount)), false, S.ink)}
          {od.pay_status === 'paid' && row(isDeposit ? 'Deposit paid' : 'Paid online', fmt(od.amount_paid), false, '#0E7A5F')}
          {od.pay_status === 'paid' && isDeposit && restAtVisit > 0 && row(`To pay ${restWhen}`, fmt(restAtVisit), false, S.ink)}
          {od.visit_mode === 'home' && od.visit_address && <div className="text-[12.5px] mt-2" style={{ color: S.muted }}>{sk === 'repairs' ? 'They come to you at' : 'Home service at'}: <strong style={{ color: S.ink }}>{od.visit_address}</strong></div>}
          {od.visit_mode === 'venue' && <div className="text-[12.5px] mt-2" style={{ color: S.muted }}>{[od.event_type, od.guest_count ? `about ${Number(od.guest_count).toLocaleString('en-NG')} guests` : ''].filter(Boolean).join(', ')}{od.visit_address ? <>{od.event_type || od.guest_count ? ' · ' : ''}Venue: <strong style={{ color: S.ink }}>{od.visit_address}</strong></> : null}</div>}
          {od.fulfil_mode === 'delivery' && od.delivery_address && <div className="text-[12.5px] mt-2" style={{ color: S.muted }}>Delivering to: <strong style={{ color: S.ink }}>{addr}</strong>{od.delivery_zone ? ` (${od.delivery_zone})` : ''}</div>}
          {od.fulfil_mode === 'delivery' && od.ready_at && od.rider_phone && od.status === 'pending' && <a href={`tel:${String(od.rider_phone).replace(/[^0-9+]/g, '')}`} className="inline-flex items-center gap-1.5 mt-2 text-[13px] font-semibold" style={{ color: '#0E7A5F' }}><Phone size={14} /> Call {od.rider_name || 'your rider'}</a>}
          {od.fulfil_mode === 'pickup' && <div className="text-[12.5px] mt-2" style={{ color: S.muted }}>You'll pick it up{od.address ? <> from <strong style={{ color: S.ink }}>{od.address}</strong></> : ''}.</div>}
          {od.fulfil_mode === 'room' && <div className="text-[12.5px] mt-2" style={{ color: S.muted }}>{od.on_room_bill ? <>Added to your room bill{od.room_label ? <> (room <strong style={{ color: S.ink }}>{od.room_label}</strong>)</> : ''}. You'll pay at check-out.</> : <>For room <strong style={{ color: S.ink }}>{od.room_label}</strong>. The front desk will confirm it and add it to your room bill.</>}</div>}
          {od.preferred_time && <div className="text-[12.5px] mt-2" style={{ color: S.muted }}>{/^Needed by/.test(od.preferred_time) ? 'Deadline' : sk === 'repairs' && od.is_appointment ? (od.visit_mode === 'home' ? 'Visit' : 'Drop-off') : od.visit_mode === 'venue' ? 'Event' : od.is_appointment ? 'Time' : 'Preferred time'}: <strong style={{ color: S.ink }}>{od.preferred_time.replace(/^Needed by /, '')}</strong></div>}
          {noteWithout(od.note) && <div className="text-[12.5px] mt-1" style={{ color: S.muted }}>{sk === 'repairs' ? 'The problem' : sk === 'professional' && !od.is_appointment ? 'Your brief' : 'Your note'}: {noteWithout(od.note)}</div>}
          {od.address && <div className="text-[12.5px] mt-2 flex items-start gap-1.5" style={{ color: S.muted }}><MapPin size={14} className="shrink-0 mt-0.5" /> {od.address}</div>}
        </div>

        {od.pay && od.pay.account_number && (od.delivery_pay === 'on_delivery' || od.delivery_pay === 'before' || (od.ready_at && od.fulfil_mode === 'pickup')) && (
          <div className="rounded-2xl p-4 mb-4" style={{ border: `1.5px solid ${S.line}` }}>
            <div className="text-[14px] font-bold">{od.delivery_pay === 'before' ? `Pay ${fmt(itemsTotal - discount + delivery)} by transfer` : 'Paying by transfer?'}</div>
            <div className="text-[13px] mt-0.5 mb-3" style={{ color: S.muted }}>{od.delivery_pay === 'before' ? `${od.business} sends it out once the money is in.` : od.fulfil_mode === 'delivery' ? `Pay the rider cash, or transfer to ${od.business}:` : `Pay cash when you collect, or transfer to ${od.business}:`}</div>
            <div className="rounded-xl p-3.5" style={{ background: S.tile }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[19px] font-bold tracking-wide" style={{ fontVariantNumeric: 'tabular-nums' }}>{od.pay.account_number}</div>
                  <div className="text-[13px]" style={{ color: S.muted }}>{[od.pay.bank_name, od.pay.account_name].filter(Boolean).join(' · ')}</div>
                </div>
                <button onClick={() => copy(od.pay.account_number, 'acct')} className="shrink-0 px-3.5 py-2 rounded-xl text-[13px] font-semibold" style={{ background: S.ink, color: '#fff' }}>{copied === 'acct' ? 'Copied' : 'Copy'}</button>
              </div>
            </div>
            {wa && <a href={`https://wa.me/${toWhatsAppNumber(od.phone)}?text=${encodeURIComponent(`Hello ${od.business}, I've sent ${fmt(itemsTotal - discount + delivery)} by transfer for my ${noun} (${od.customer_name}). Here is my receipt: `)}`} target="_blank" rel="noopener noreferrer" className="block text-center mt-3 text-[13.5px] font-semibold" style={{ color: '#0E7A5F' }}>Sent it? Send your receipt on WhatsApp</a>}
          </div>
        )}

        {od.status === 'pending' && od.pay_status === 'requested' && (
          <div className="rounded-2xl p-4 mb-4" style={{ border: `1.5px solid ${S.ink}` }}>
            {quote ? (
              <>
                <div className="rounded-xl p-3.5 text-[13.5px] space-y-1" style={{ background: S.tile }}>
                  <div className="flex justify-between"><span style={{ color: S.muted }}>{isDeposit ? (timedVisit ? `Deposit to keep ${keepWhat}` : 'Deposit to get started') : `Your ${noun}`}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(quote.amount)}</span></div>
                  <div className="flex justify-between"><span style={{ color: S.muted }}>Service fee</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(quote.fee_total)}</span></div>
                  <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px solid ${S.line}` }}><span>You pay</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(quote.total)}</span></div>
                </div>
                <button onClick={payOnline} disabled={busy} className={`${btn} mt-3 flex items-center justify-center gap-2`} style={{ background: S.ink, color: '#fff', opacity: busy ? 0.6 : 1 }}>{busy ? 'Opening Paystack…' : <><Lock size={15} /> Pay {fmt(quote.total)} now</>}</button>
                <div className="text-[12px] text-center mt-2" style={{ color: S.muted }}>Card, bank transfer or USSD · secured by Paystack</div>
                <div className="text-[11.5px] text-center mt-1 leading-relaxed" style={{ color: S.muted }}>{isDeposit ? `The rest (${fmt(restAtVisit)}) is paid ${restWhen}. ` : ''}If {od.business} can't complete your {noun}, they refund what you paid for it. The service fee isn't refunded.</div>
              </>
            ) : (
              <div className="text-[13.5px] leading-relaxed" style={{ color: S.muted }}>Online payment isn't available right now. Message {od.business} to pay them directly.</div>
            )}
            {quote && <div className="text-[12.5px] text-center mt-3" style={{ color: S.muted }}>Prefer to pay {od.business} directly? Message them below.</div>}
          </div>
        )}

        {od.pay_status === 'refund_due' && (
          <div className="rounded-2xl p-4 mb-4" style={{ border: `1.5px solid ${S.ink}` }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-bold">Your refund</span>
              <span className="text-[20px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(od.refund_amount)}</span>
            </div>
            {od.refund_to && !rf.editing ? (
              <>
                <div className="text-[13px] mt-1 mb-2.5" style={{ color: S.muted }}>{od.business} will send it to:</div>
                <div className="rounded-xl p-3.5" style={{ background: S.tile }}>
                  <div className="text-[13px]" style={{ color: S.muted }}>{od.refund_to.bank_name}</div>
                  <div className="text-[19px] font-bold tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>{od.refund_to.account_number}</div>
                  <div className="text-[13.5px] font-semibold">{od.refund_to.account_name}</div>
                </div>
                <button onClick={() => setRf({ bank: od.refund_to.bank_name || '', number: od.refund_to.account_number || '', name: od.refund_to.account_name || '', editing: true })} className="mt-2 text-[13px] font-semibold" style={{ color: S.ink }}>Change account</button>
              </>
            ) : (
              <>
                <div className="text-[13px] mt-1 mb-3 leading-relaxed" style={{ color: S.muted }}>Where should {od.business} send it? Use an account in your own name.</div>
                <div className="space-y-2">
                  <input value={rf.bank} onChange={(e) => setRf({ ...rf, bank: e.target.value })} placeholder="Bank, e.g. GTBank, Opay, Moniepoint" className="w-full rounded-xl px-4 py-3 text-[15px] outline-none" style={{ background: S.tile, color: S.ink }} />
                  <input value={rf.number} inputMode="numeric" onChange={(e) => setRf({ ...rf, number: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })} placeholder="Account number (10 digits)" className="w-full rounded-xl px-4 py-3 text-[15px] outline-none tracking-wider" style={{ background: S.tile, color: S.ink, fontVariantNumeric: 'tabular-nums' }} />
                  <input value={rf.name} onChange={(e) => setRf({ ...rf, name: e.target.value })} placeholder="Name on the account" className="w-full rounded-xl px-4 py-3 text-[15px] outline-none" style={{ background: S.tile, color: S.ink }} />
                </div>
                <button onClick={saveRefund} disabled={busy || rf.number.length !== 10 || !rf.bank.trim() || rf.name.trim().length < 3} className={`${btn} mt-3`} style={{ background: S.ink, color: '#fff', opacity: busy || rf.number.length !== 10 || !rf.bank.trim() || rf.name.trim().length < 3 ? 0.4 : 1 }}>{busy ? 'Sending…' : `Send to ${od.business}`}</button>
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={btn} style={isNew && od.status === 'pending' && !od.pay_status ? { background: '#25D366', color: '#fff', textAlign: 'center' } : { border: `1.5px solid ${S.ink}`, textAlign: 'center' }}>{isNew && od.status === 'pending' && !od.pay_status ? `Also tell ${od.business} on WhatsApp` : `Message ${od.business}`}</a>}
          {od.business_code && ['fulfilled', 'cancelled'].includes(od.status) && <a href={`/store/${od.business_code}`} className={btn} style={{ background: S.ink, color: '#fff', textAlign: 'center' }}>{noun === 'order' ? 'Order again' : 'Book again'}</a>}
        </div>
        <div className="text-center text-[11.5px] mt-10" style={{ color: S.soldOut }}>Orders by Xorla</div>
      </div>
    </div>
  );
}
export { CustomerOrder, GuestBooking, AppointmentOffer };
