// Xorla: admin screens (loaded only when needed). Shared code lives in ../App.jsx.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Search, Loader2, ThumbsUp, ThumbsDown, Eye, ChevronLeft, Check, Users, Info, ChevronRight, SendHorizontal, Phone, Smartphone, Megaphone, Lock, ShieldCheck, Gift, Trash2, Headphones, MessageCircle, X, FileText, Send, Link2, Upload, RefreshCw, LogOut, Copy, Bike, AlertCircle, Clock, Sparkles, TrendingUp, Receipt, Store, Lightbulb, Shapes, Wallet, ArrowDownRight, History, Building2, ScanFace, BadgeCheck, Landmark, Pencil, Truck, MapPin, Package, RotateCcw, Ban, KeyRound, StickyNote } from 'lucide-react';
import { createPortal } from 'react-dom';
import { NG_LGAS, NG_STATES, BrandSelect, C, CAC_STATUS, CAC_SUGGEST, LazyChart, PasswordChecks, PasswordInput, RIDER_ID_TYPES, RIDER_VEHICLES, SB_KEY, SB_URL, SPOT_CTA, SUPPORT, SUPPORT_TOPICS, Sheet, SupportImage, ThemeToggle, TypingBubble, UPDATE_KIND, XorlaMark, XorlaSpotlight, brandAlert, brandConfirm, cacDocUrl, cacUpload, fmt, formatNumInput, formatPhoneDisplay, friendlyAuthError, loadSession, parseNumInput, passwordError, riderBilling, riderInitials, saveSession, sbRefresh, sbRpc, sbSignIn, sbSignUp, supportWhen, toWhatsAppNumber, useXorlaTheme, vaultFileUrl } from '../App.jsx';

// ============ Founder dashboard (/admin): only for people in platform_admins, and only with two-step verification ============
// Two-step verification uses Supabase Auth's authenticator-app codes (TOTP). A stolen password alone can't open this page.
async function sbAuthReq(path, token, method = 'GET', body) {
  const res = await fetch(`${SB_URL}/auth/v1${path}`, { method, headers: { apikey: SB_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  if (!res.ok) throw new Error((data && (data.msg || data.message || data.error_description)) || 'Something went wrong. Please try again.');
  return data;
}
// ---------- Founder dashboard: support inbox, What's new, announcements and the support team ----------
const SUPPORT_REPLIES = [
  ['Thanks, looking into it', "Thanks for letting us know. I'm looking into this now and will get back to you shortly."],
  ['Ask for a screenshot', 'Could you send a screenshot of what you see on your screen? Tap the paperclip below to attach it. That will help me fix this faster.'],
  ['Update the app', 'Please close Xorla fully and open it again so you have the latest version, then try once more. Let me know if it still happens.'],
  ['Fixed', "This is fixed now. Please try again, and reply here if anything still isn't right."],
  ['Payment check', "I'm checking your payment with our payment provider now. Please don't pay again in the meantime. I'll confirm here as soon as I see it."],
  ['Thanks for the idea', "Thank you for the idea. I've shared it with the team building Xorla. We'll let you know in What's new if we add it."],
];
const PLAN_CHIP = { business: ['Business', 'sage'], pro: ['Pro', 'sage'], free: ['Free', 'dim'] };
function AdminChip({ tone, children }) {
  const c = tone === 'copper' ? [C.copperSoft, C.copper] : tone === 'sage' ? [C.sageSoft, C.sage] : tone === 'rust' ? [C.rustSoft, C.rust] : [C.surfaceRaised, C.inkFaint];
  return <span className="shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-semibold" style={{ background: c[0], color: c[1] }}>{children}</span>;
}

function SupportInbox({ call, token, agentName, initialTicket, onCounts }) {
  const [status, setStatus] = useState(initialTicket ? 'all' : 'open');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(initialTicket || null);
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef(null);
  const load = useCallback(async () => {
    try { const d = await call('support_inbox', { p_status: status, p_search: search }); setData(d); onCounts?.(d.counts); setErr(''); }
    catch (e) { setErr(/support_inbox|schema cache/i.test(e.message) ? 'Run support.sql in Supabase to switch on the support inbox.' : e.message); }
  }, [call, status, search]);
  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [status, search]);
  // The list refreshes every 20 seconds; an open conversation every 5, so new messages and "typing…" show quickly
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (!openId) return undefined; const t = setInterval(() => { if (document.visibilityState === 'visible') loadThread(openId, true); }, 5000); return () => clearInterval(t); }, [openId]);
  const typedAtRef = useRef(0);
  const noteTyping = () => { if (openId && Date.now() - typedAtRef.current > 3000) { typedAtRef.current = Date.now(); call('support_typing', { p_ticket: openId }).catch(() => {}); } };
  const loadThread = async (id, quiet) => {
    try { const th = await call('support_thread', { p_ticket: id }); setThread(th); if (!quiet) load(); }
    catch (e) { if (!quiet) brandAlert(e.message); }
  };
  useEffect(() => { if (openId) { setThread(null); setReply(''); loadThread(openId); } }, [openId]);
  // Stay at the latest message (and "typing…") unless the rep has scrolled up to read; then offer a jump button
  const listRef = useRef(null);
  const nearBottomRef = useRef(true);
  const [newBelow, setNewBelow] = useState(false);
  const toBottom = (smooth) => { const el = listRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); setNewBelow(false); };
  const onListScroll = () => { const el = listRef.current; if (!el) return; nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140; if (nearBottomRef.current) setNewBelow(false); };
  const lastOpenRef = useRef(null);
  useEffect(() => {
    if (!thread) return;
    const first = lastOpenRef.current !== openId; lastOpenRef.current = openId;
    if (first || nearBottomRef.current) setTimeout(() => toBottom(!first), 30); else setNewBelow(true);
  }, [thread?.messages?.length, openId, !!thread]);
  useEffect(() => { if (thread?.ticket?.customer_typing && nearBottomRef.current) setTimeout(() => toBottom(true), 30); }, [thread?.ticket?.customer_typing]);
  const growBox = (el) => { if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(180, Math.max(52, el.scrollHeight))}px`; };
  // Replies are guarded: if someone else has this conversation, you must choose to take it over,
  // and if a new message arrived while you typed, nothing is sent until you've read it.
  const send = async (next, takeOver = false) => {
    if (!reply.trim() || busy) return;
    const tk = thread?.ticket;
    if (!takeOver && tk?.assigned_to && !tk.mine) {
      if (!(await brandConfirm(`${tk.assigned_name || 'Someone else'} is handling this conversation. If you send this, it becomes yours and they'll see you took over.`, { title: 'Take over this conversation?', confirm: 'Take over and send' }))) return;
      takeOver = true;
    }
    setBusy(true);
    const lastSeen = thread?.messages?.length ? thread.messages[thread.messages.length - 1].id : null;
    try {
      await call('support_reply', { p_ticket: openId, p_body: reply.trim(), p_status: next, p_last_seen: lastSeen, p_take_over: takeOver });
      setReply(''); nearBottomRef.current = true; await loadThread(openId);
    } catch (e) {
      const msg = String(e.message || '');
      if (msg.startsWith('CHANGED:')) { await loadThread(openId, true); brandAlert(msg.slice(8), { title: 'New message in this conversation' }); }
      else if (msg.startsWith('TAKEN:')) { await loadThread(openId, true); setBusy(false); return send(next, false); }
      else brandAlert(msg);
    }
    setBusy(false);
  };
  const assign = async (action) => { try { await call('support_assign', { p_ticket: openId, p_action: action }); await loadThread(openId); } catch (e) { brandAlert(e.message); } };
  const setTicketStatus = async (next) => { try { await call('support_set_status', { p_ticket: openId, p_status: next }); await loadThread(openId); } catch (e) { brandAlert(e.message); } };
  const counts = data?.counts || {};
  const tickets = data?.tickets || [];
  const t = thread?.ticket;
  const biz = thread?.business;
  const topic = (id) => (SUPPORT_TOPICS.find((x) => x.id === id) || SUPPORT_TOPICS[2]);
  const first = (agentName || '').split(' ')[0];

  const listPane = (
    <div className={`${openId ? 'hidden lg:flex' : 'flex'} flex-col min-h-0 lg:w-[380px] lg:shrink-0`}>
      <div className="flex gap-1 p-1 rounded-xl mb-2.5 overflow-x-auto" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        {[['open', 'Needs reply', counts.open], ['mine', 'Mine', counts.mine], ['unassigned', 'Unassigned', counts.unassigned], ['waiting', 'Waiting', counts.waiting], ['solved', 'Solved'], ['all', 'All']].map(([k, l, n]) => (
          <button key={k} onClick={() => setStatus(k)} className="shrink-0 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap" style={status === k ? { background: C.copperFill, color: C.onAccent } : { color: C.inkDim }}>{l}{n ? ` ${n}` : ''}</button>
        ))}
      </div>
      <div className="relative mb-2.5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.inkFaint }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business, name, email or #number" className="w-full rounded-xl pl-9 pr-3 py-2.5 text-[13px] outline-none" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.ink }} />
      </div>
      {err && <div className="rounded-xl px-3.5 py-2.5 text-[12.5px] mb-2" style={{ background: C.copperSoft, color: C.ink }}>{err}</div>}
      <div className="rounded-2xl overflow-hidden lg:overflow-y-auto lg:max-h-[calc(100vh-250px)]" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        {!data ? <div className="flex justify-center py-10" style={{ color: C.inkFaint }}><Loader2 size={18} className="animate-spin" /></div>
          : !tickets.length ? <div className="px-4 py-10 text-center text-[13px]" style={{ color: C.inkFaint }}>{status === 'open' ? 'Nothing waiting for a reply. Well done.' : 'No conversations here.'}</div>
          : tickets.map((x, i) => {
            const T2 = topic(x.topic);
            return (
              <button key={x.id} onClick={() => setOpenId(x.id)} className="w-full text-left px-4 py-3 flex gap-3" style={{ borderTop: i ? `1px solid ${C.line}` : 'none', background: openId === x.id ? 'rgba(255,176,32,0.07)' : 'transparent' }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative" style={{ background: x.topic === 'billing' || x.topic === 'complaint' ? C.copperSoft : C.surfaceRaised }}>
                  <T2.Icon size={15} style={{ color: x.topic === 'billing' || x.topic === 'complaint' ? C.copper : C.inkDim }} />
                  {x.agent_unread && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{ background: C.copperFill, border: `2px solid ${C.surface}` }} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2"><span className="text-[13px] font-semibold truncate">{x.business_name || x.user_name || 'Customer'}</span><span className="ml-auto text-[11px] shrink-0" style={{ color: C.inkFaint }}>{supportWhen(x.last_message_at)}</span></span>
                  <span className="block text-[12.5px] truncate" style={{ color: x.agent_unread ? C.ink : C.inkDim, fontWeight: x.agent_unread ? 600 : 400 }}>{x.subject}</span>
                  <span className="block text-[11.5px] truncate mt-0.5" style={{ color: C.inkFaint }}>{x.last_from === 'agent' ? 'You: ' : ''}{x.preview}</span>
                  <span className="flex items-center gap-1.5 mt-1.5">
                    <AdminChip tone="dim">#{x.ref}</AdminChip><AdminChip tone={x.topic === 'billing' || x.topic === 'complaint' ? 'copper' : 'dim'}>{T2.short}</AdminChip>
                    {x.plan && <AdminChip tone={(PLAN_CHIP[x.plan] || PLAN_CHIP.free)[1]}>{(PLAN_CHIP[x.plan] || PLAN_CHIP.free)[0]}</AdminChip>}
                    {x.rating === 1 && <ThumbsUp size={12} style={{ color: C.sage }} />}{x.rating === -1 && <ThumbsDown size={12} style={{ color: C.rust }} />}
                    {x.status !== 'solved' && (x.mine ? <AdminChip tone="sage">You</AdminChip> : x.assigned_name ? <AdminChip tone="dim">{x.assigned_name.split(' ')[0]}</AdminChip> : <AdminChip tone="copper">Unassigned</AdminChip>)}
                    {x.viewing_name && <span className="inline-flex items-center gap-1 text-[10.5px]" style={{ color: C.inkFaint }}><Eye size={11} />{x.viewing_name.split(' ')[0]}</span>}
                  </span>
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
  const threadPane = openId && (
    <div className="fixed inset-0 z-[70] lg:static lg:z-auto flex-1 min-w-0 flex flex-col lg:rounded-2xl p-3.5 lg:p-5 h-[100dvh] lg:h-[calc(100dvh-190px)] lg:min-h-[520px]" style={{ background: C.surface, border: `1px solid ${C.line}`, paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
      {!thread ? <div className="flex justify-center py-16" style={{ color: C.inkFaint }}><Loader2 size={18} className="animate-spin" /></div> : (
        <>
          <div className="flex items-start gap-3 shrink-0 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
            <button onClick={() => setOpenId(null)} aria-label="Back to inbox" className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.surfaceRaised, color: C.inkDim }}><ChevronLeft size={17} /></button>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-semibold truncate">{t.subject}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <AdminChip tone="dim">#{t.ref}</AdminChip><AdminChip tone={t.topic === 'billing' || t.topic === 'complaint' ? 'copper' : 'dim'}>{topic(t.topic).short}</AdminChip>
                <AdminChip tone={t.status === 'open' ? 'copper' : t.status === 'waiting' ? 'sage' : 'dim'}>{t.status === 'open' ? 'Needs reply' : t.status === 'waiting' ? 'Waiting on customer' : 'Solved'}</AdminChip>
              </div>
            </div>
            <BrandSelect value={t.status} onChange={(e) => setTicketStatus(e.target.value)} aria-label="Status" className="w-[124px] lg:w-[150px] shrink-0">
              <option value="open">Needs reply</option><option value="waiting">Waiting on customer</option><option value="solved">Solved</option>
            </BrandSelect>
          </div>
          {(() => {
            const viewer = t.other_viewer || null;   // another team member who has this open right now
            const bar = (tone, Icon, text, action) => { const c = tone === 'sage' ? [C.sageSoft, C.sage] : tone === 'copper' ? [C.copperSoft, C.copper] : [C.surfaceRaised, C.inkDim]; return (
              <div className="mt-3 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-[12.5px] shrink-0" style={{ background: c[0] }}>
                <Icon size={15} style={{ color: c[1] }} className="shrink-0" /><span className="flex-1 min-w-0" style={{ color: C.ink }}>{text}</span>{action}
              </div>
            ); };
            if (t.status === 'solved' && !t.assigned_to) return null;
            if (t.mine) return bar('sage', Check, <><strong>You're handling this.</strong> The customer gets replies from you{viewer ? <span style={{ color: C.inkDim }}> · {viewer.split(' ')[0]} is looking at it too</span> : null}.</>, <button onClick={() => assign('release')} className="shrink-0 text-[12px] font-semibold" style={{ color: C.inkDim }}>Hand back</button>);
            if (t.assigned_to) return bar('dim', Users, <><strong>{t.assigned_name || 'Someone'} is handling this{viewer && viewer === t.assigned_name ? ' and has it open now' : ''}.</strong> Only reply if you're taking it over.</>, <button onClick={() => assign('take')} className="shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-semibold" style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}>Take over</button>);
            return bar('copper', Info, <><strong>Nobody has taken this yet.</strong>{viewer ? ` ${viewer.split(' ')[0]} is looking at it now.` : ' Reply or take it so others know it\'s yours.'}</>, <button onClick={() => assign('take')} className="shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-semibold" style={{ background: C.copperFill, color: C.onAccent }}>Take it</button>);
          })()}
          <div className="grid grid-cols-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_230px] gap-4 flex-1 min-h-0 pt-3 [&>*]:min-w-0">
            <div className="flex flex-col min-h-0 relative">
              <div ref={listRef} onScroll={onListScroll} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 pb-2">
                {thread.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from_agent ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%]">
                      <div className={`text-[11px] mb-1 ${m.from_agent ? 'text-right' : ''}`} style={{ color: C.inkFaint }}>{m.from_agent ? <><strong style={{ color: C.sage }}>{m.author_name}</strong> · Xorla Support</> : <strong style={{ color: C.inkDim }}>{m.author_name || t.user_name || 'Customer'}</strong>} · {supportWhen(m.created_at)}</div>
                      <div className="rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words" style={m.from_agent ? { background: C.sageSoft, border: '1px solid rgba(31,217,196,0.22)', borderTopRightRadius: 6 } : { background: C.surfaceRaised, border: `1px solid ${C.line}`, borderTopLeftRadius: 6 }}>
                        {m.body}{m.attachment && <SupportImage path={m.attachment} token={token} />}
                      </div>
                    </div>
                  </div>
                ))}
                {t.customer_typing && <TypingBubble avatar={false} name={(t.user_name || 'Customer').split(' ')[0]} />}
                <div ref={endRef} />
              </div>
              {newBelow && <button onClick={() => toBottom(true)} className="absolute left-1/2 -translate-x-1/2 bottom-[150px] z-10 px-3.5 py-2 rounded-full text-[12px] font-bold flex items-center gap-1.5 xorla-fade-up" style={{ background: C.copperFill, color: C.onAccent, boxShadow: '0 10px 24px -8px rgba(var(--c-lo),calc(0.6 * var(--c-lok)))' }}>New message <ChevronRight size={14} className="rotate-90" /></button>}
              <div className="shrink-0 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
                <div className="h-6 flex items-center text-[11.5px]" aria-live="polite" style={{ color: C.inkFaint }}>
                  {t.customer_typing
                    ? <button onClick={() => toBottom(true)} className="inline-flex items-center gap-2" style={{ color: C.sage }}><span className="xorla-dots scale-75 -mx-1"><span /><span /><span /></span><span><strong>{(t.user_name || 'Customer').split(' ')[0]}</strong> is typing…</span></button>
                    : t.other_viewer ? <span className="inline-flex items-center gap-1.5"><Eye size={12} />{t.other_viewer.split(' ')[0]} is looking at this too</span>
                    : <span>{t.status === 'solved' ? 'Solved. A reply reopens it.' : 'Seen by you'}</span>}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
                  {SUPPORT_REPLIES.map(([l, text]) => <button key={l} onClick={() => setReply((r) => (r ? `${r}\n\n${text}` : `Hi ${(t.user_name || '').split(' ')[0] || 'there'}, ${/^I\b/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1)}`))} className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.inkDim }}>{l}</button>)}
                </div>
                <textarea ref={(el) => { if (el && !reply) el.style.height = ''; }} value={reply} onChange={(e) => { setReply(e.target.value); noteTyping(); growBox(e.target); }} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send('waiting'); } }} rows={2} placeholder={`Reply as ${first || 'you'} from Xorla Support…`} className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none resize-none" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.ink, minHeight: 52, maxHeight: 180 }} />
                <div className="flex flex-wrap gap-2 mt-2">
                  <button onClick={() => send('waiting')} disabled={!reply.trim() || busy} className="flex-1 min-w-[140px] h-10 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2" style={{ background: C.copperFill, color: C.onAccent, opacity: !reply.trim() || busy ? 0.5 : 1 }}><SendHorizontal size={15} /> {t.assigned_to && !t.mine ? 'Take over and send' : 'Send'}</button>
                  <button onClick={() => send('solved')} disabled={!reply.trim() || busy} className="flex-1 min-w-[140px] h-10 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2" style={{ background: C.sageSoft, color: C.sage, opacity: !reply.trim() || busy ? 0.5 : 1 }}><Check size={15} /> Send and mark solved</button>
                </div>
                <div className="text-[10.5px] mt-1.5 truncate" style={{ color: C.inkFaint }}>They get a phone notification · Never ask for passwords, PINs or card details<span className="hidden lg:inline"> · Ctrl+Enter sends</span></div>
              </div>
            </div>
            <div className="hidden lg:block overflow-y-auto space-y-3 text-[12.5px]">
              <div className="rounded-xl p-3.5" style={{ background: C.surfaceRaised }}>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkFaint }}>Customer</div>
                <div className="font-semibold">{t.user_name || '—'}</div>
                <div className="break-all" style={{ color: C.inkDim }}>{t.user_email}</div>
                <div className="mt-1.5" style={{ color: C.inkDim }}>{t.context?.role === 'owner' ? 'Owner' : t.context?.role === 'staff' ? 'Staff' : t.context?.role || ''}</div>
              </div>
              {biz && (
                <div className="rounded-xl p-3.5" style={{ background: C.surfaceRaised }}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkFaint }}>Business</div>
                  <div className="font-semibold">{biz.name}</div>
                  <div style={{ color: C.inkDim }}>{t.context?.plan ? `${(PLAN_CHIP[t.context.plan] || PLAN_CHIP.free)[0]} plan` : ''}{biz.type ? ` · ${biz.type.replace(/_/g, ' ')}` : ''}</div>
                  <div style={{ color: C.inkFaint }}>Joined {new Date(biz.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  {biz.phone && <a href={`https://wa.me/${toWhatsAppNumber(biz.phone)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2 font-semibold" style={{ color: C.sage }}><Phone size={13} /> WhatsApp the owner</a>}
                </div>
              )}
              {(t.context?.device || t.context?.screen) && (
                <div className="rounded-xl p-3.5" style={{ background: C.surfaceRaised }}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkFaint }}>Their phone</div>
                  <div style={{ color: C.inkDim }}>{t.context.device}</div><div style={{ color: C.inkFaint }}>{t.context.screen}</div>
                </div>
              )}
              {thread.history?.length > 0 && (
                <div className="rounded-xl p-3.5" style={{ background: C.surfaceRaised }}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkFaint }}>Earlier conversations</div>
                  {thread.history.slice(0, 6).map((h) => <button key={h.id} onClick={() => setOpenId(h.id)} className="block w-full text-left py-1 truncate" style={{ color: C.inkDim }}>#{h.ref} {h.subject}</button>)}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {listPane}
      {threadPane || <div className="hidden lg:flex flex-1 items-center justify-center rounded-2xl text-[13px]" style={{ border: `1px dashed ${C.line}`, color: C.inkFaint, minHeight: 360 }}>Choose a conversation</div>}
    </div>
  );
}
// Ready-made announcements the founder can send in one tap (and edit first)
const ANN_TEMPLATES = [
  { key: 'vault', label: 'Document vault', title: 'Keep your important papers safe', message: 'Save your CAC certificate, TIN, permits and tenancy in your document vault. Share them with your bank or a supplier in one tap, and Xorla reminds you before anything expires.', tone: 'info', cta: 'vault', audience: 'owners' },
  { key: 'cac', label: 'Register your business', title: 'Make your business official', message: 'Register your business name with CAC right here in Xorla. Fill it in once, pay securely, and follow every step until your certificate arrives.', tone: 'success', cta: 'cac', audience: 'owners' },
  { key: 'vault-due', label: 'Renewal reminder', title: 'Is anything about to expire?', message: 'Add the expiry date of your permits, fire certificate or insurance in your document vault, and Xorla will remind you before they run out.', tone: 'info', cta: 'vault', audience: 'owners' },
];

const AUD_LABEL = { all: 'Everyone', owners: 'Business owners', products: 'Shops (sell products)', services: 'Service businesses', free: 'Free plan', trial: 'On trial', paying: 'Paying customers' };
function SupportPublishing({ call }) {
  const [data, setData] = useState(null);
  const [up, setUp] = useState({ title: '', body: '', kind: 'new', audience: 'all', busy: false });
  const [an, setAn] = useState({ title: '', message: '', tone: 'info', cta: 'none', audience: 'all', days: '7', busy: false });
  const [reach, setReach] = useState({});
  const [previewOf, setPreviewOf] = useState('ann');
  const load = useCallback(async () => { try { setData(await call('admin_updates')); } catch (e) { setData({ error: e.message, updates: [], announcements: [] }); } }, [call]);
  useEffect(() => { load(); }, []);
  // How many people the chosen audience reaches right now
  const countReach = useCallback(async (aud) => {
    if (reach[aud]) return;
    try { const r = await call('audience_reach', { p_audience: aud }); setReach((x) => ({ ...x, [aud]: r })); } catch (e) { setReach((x) => ({ ...x, [aud]: { error: true } })); }
  }, [call, reach]);
  useEffect(() => { countReach(an.audience); }, [an.audience]);
  useEffect(() => { countReach(up.audience); }, [up.audience]);
  const reachLine = (aud) => {
    const r = reach[aud];
    if (!r) return <span style={{ color: C.inkFaint }}>Counting who this reaches…</span>;
    if (r.error) return <span style={{ color: C.inkFaint }}>Run support.sql again to see who this reaches.</span>;
    return <span><strong style={{ color: C.ink }}>{Number(r.people).toLocaleString('en-NG')} {r.people === 1 ? 'person' : 'people'}</strong> in {Number(r.businesses).toLocaleString('en-NG')} {r.businesses === 1 ? 'business' : 'businesses'} right now</span>;
  };
  const field = { background: C.bg, border: `1px solid ${C.line}`, color: C.ink };
  const postUpdate = async () => {
    if (up.title.trim().length < 3) { brandAlert('Add a title.'); return; }
    const r = reach[up.audience];
    if (!(await brandConfirm(`"${up.title.trim()}" goes to ${AUD_LABEL[up.audience].toLowerCase()}${r && !r.error ? ` (${r.people} ${r.people === 1 ? 'person' : 'people'})` : ''}. It pops up once when they next open Xorla and stays in Help → What's new.`, { title: 'Publish this update?', confirm: 'Publish' }))) return;
    setUp({ ...up, busy: true });
    try { await call('post_update', { p_title: up.title, p_body: up.body, p_kind: up.kind, p_audience: up.audience }); setUp({ title: '', body: '', kind: 'new', audience: up.audience, busy: false }); load(); brandAlert(`It's live. ${AUD_LABEL[up.audience]} will see it the next time they open Xorla.`, { title: 'Update published' }); }
    catch (e) { setUp((x) => ({ ...x, busy: false })); brandAlert(e.message); }
  };
  const postAnn = async () => {
    if (an.message.trim().length < 5) { brandAlert('Write the announcement first.'); return; }
    const r = reach[an.audience];
    if (!(await brandConfirm(`This pops up for ${AUD_LABEL[an.audience].toLowerCase()}${r && !r.error ? ` (${r.people} ${r.people === 1 ? 'person' : 'people'})` : ''} the next time they open Xorla, and stays on their home screen for ${an.days === '1' ? '1 day' : an.days === '7' ? '1 week' : an.days === '30' ? '1 month' : `${an.days} days`}.`, { title: 'Send this announcement?', confirm: 'Send' }))) return;
    setAn({ ...an, busy: true });
    try {
      const res = await call('post_announcement', { p_message: an.message, p_tone: an.tone, p_audience: an.audience, p_days: Number(an.days), p_title: an.title, p_cta: an.cta });
      setAn({ title: '', message: '', tone: 'info', cta: 'none', audience: an.audience, days: '7', busy: false }); load();
      const n = res && typeof res === 'object' ? Number(res.reach) : null;
      brandAlert(n !== null && !Number.isNaN(n) ? `${n.toLocaleString('en-NG')} ${n === 1 ? 'person' : 'people'} will see it as a pop-up the next time they open Xorla. Watch "Seen by" below.` : 'It will pop up the next time they open Xorla.', { title: 'Announcement is live' });
    } catch (e) { setAn((x) => ({ ...x, busy: false })); brandAlert(/function|schema cache|p_title/i.test(e.message) ? 'Run the latest support.sql in Supabase first, then try again.' : e.message); }
  };
  const box = { background: C.surface, border: `1px solid ${C.line}` };
  const lbl = (t) => <div className="text-[12px] font-semibold mb-1.5 mt-3" style={{ color: C.inkFaint }}>{t}</div>;
  const seg = (value, options, onPick) => (
    <div className="flex flex-wrap gap-1.5">{options.map(([k, l]) => <button key={k} onClick={() => onPick(k)} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={value === k ? { background: C.copperFill, color: C.onAccent } : { background: C.surfaceRaised, color: C.inkDim, border: `1px solid ${C.line}` }}>{l}</button>)}</div>
  );
  const seenBar = (seen, of) => {
    const pct = of ? Math.min(100, Math.round((Number(seen) / Number(of)) * 100)) : 0;
    return (
      <div className="mt-2">
        <div className="flex items-center justify-between text-[11.5px]" style={{ color: C.inkDim }}><span className="inline-flex items-center gap-1"><Eye size={12} /> Seen by <strong style={{ color: C.ink }}>{Number(seen || 0).toLocaleString('en-NG')}</strong> of {Number(of || 0).toLocaleString('en-NG')}</span><span>{pct}%</span></div>
        <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(var(--c-hi),0.06)' }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${C.sageFill}, ${C.copperFill})` }} /></div>
      </div>
    );
  };
  const reachBox = (aud) => (
    <div className="mt-3 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-[12.5px]" style={{ background: C.sageSoft, border: '1px solid rgba(31,217,196,0.22)', color: C.inkDim }}>
      <Users size={15} style={{ color: C.sage }} className="shrink-0" /><span className="min-w-0">Reaches {reachLine(aud)}</span>
    </div>
  );
  const preview = (
    <div className="rounded-2xl p-4 lg:p-5 lg:sticky lg:top-4 self-start" style={{ background: 'radial-gradient(120% 80% at 50% 0%, rgba(31,217,196,0.08), transparent 60%), #071815', border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[15px] font-semibold flex items-center gap-2"><Smartphone size={16} style={{ color: C.copper }} /> What they'll see</div>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: C.surface }}>
          {[['ann', 'Announcement'], ['update', "What's new"]].map(([k, l]) => <button key={k} onClick={() => setPreviewOf(k)} className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold" style={previewOf === k ? { background: C.copperFill, color: C.onAccent } : { color: C.inkDim }}>{l}</button>)}
        </div>
      </div>
      <div className="text-[12px] mb-4" style={{ color: C.inkDim }}>A pop-up over their home screen the next time they open Xorla, shown once to each person. Changes as you type.</div>
      <div className="flex justify-center py-5 px-3 rounded-2xl" style={{ background: 'rgba(var(--c-scrim),0.7)' }}>
        <XorlaSpotlight preview spot={previewOf === 'ann' ? { kind: 'ann', item: { title: an.title, message: an.message, tone: an.tone, cta: an.cta } } : { kind: 'update', item: { title: up.title || 'Your feature title', body: up.body, kind: up.kind } }} onClose={() => {}} />
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-4 [&>*]:min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-4 [&>*]:min-w-0 self-start">
        <div className="rounded-2xl p-4 lg:p-5" style={box} onFocusCapture={() => setPreviewOf('ann')}>
          <div className="flex items-center gap-2 mb-1"><Megaphone size={17} style={{ color: C.copper }} /><div className="text-[15px] font-semibold">Announcement</div></div>
          <div className="text-[12.5px] mb-3" style={{ color: C.inkDim }}>For offers, planned maintenance or holidays. It pops up once, then stays as a banner on their home screen until they dismiss it.</div>
          <div className="mb-3">
            <div className="text-[11.5px] font-semibold mb-1.5" style={{ color: C.inkFaint }}>Ready-made: tap to fill in, then edit</div>
            <div className="flex flex-wrap gap-1.5">{ANN_TEMPLATES.map((t) => <button key={t.key} type="button" onClick={() => setAn({ ...an, title: t.title, message: t.message, tone: t.tone, cta: t.cta, audience: t.audience })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={an.title === t.title ? { background: C.sageSoft, color: C.sage, border: '1px solid rgba(31,217,196,0.35)' } : { border: `1px dashed ${C.line}`, color: C.inkDim }}>{t.cta === 'vault' ? <Lock size={12} /> : <ShieldCheck size={12} />} {t.label}</button>)}</div>
          </div>
          <input value={an.title} maxLength={70} onChange={(e) => setAn({ ...an, title: e.target.value })} placeholder="Headline (optional), e.g. Sallah offer" className="w-full rounded-xl px-3.5 py-3 text-[14px] font-semibold outline-none mb-2" style={field} />
          <textarea value={an.message} rows={3} maxLength={280} onChange={(e) => setAn({ ...an, message: e.target.value })} placeholder="e.g. Pay for a year this week and get 2 months free." className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none resize-y mb-1" style={field} />
          <div className="text-right text-[11px]" style={{ color: C.inkFaint }}>{an.message.length}/280</div>
          {lbl('Style')}
          {seg(an.tone, [['info', 'Information'], ['warning', 'Important'], ['success', 'Good news']], (k) => setAn({ ...an, tone: k }))}
          {lbl('Button')}
          {seg(an.cta, [['none', 'Just "Got it"'], ['plan', 'See plans'], ['updates', "What's new"], ['support', 'Message support'], ['sales', 'Sales'], ['products', 'Products'], ['vault', 'Document vault'], ['cac', 'Register business']], (k) => setAn({ ...an, cta: k }))}
          {['plan', 'vault', 'cac'].includes(an.cta) && <div className="text-[11px] mt-1.5" style={{ color: C.inkFaint }}>Only owners see this button; staff just get "Got it".</div>}
          {lbl('Who sees it')}
          {seg(an.audience, [['all', 'Everyone'], ['owners', 'Owners'], ['free', 'Free plan'], ['trial', 'On trial'], ['paying', 'Paying']], (k) => setAn({ ...an, audience: k }))}
          {reachBox(an.audience)}
          {lbl('Show for')}
          {seg(an.days, [['1', '1 day'], ['3', '3 days'], ['7', '1 week'], ['30', '1 month']], (k) => setAn({ ...an, days: k }))}
          <button onClick={postAnn} disabled={an.busy} className="w-full mt-4 h-11 rounded-xl text-[13.5px] font-semibold" style={{ background: C.copperFill, color: C.onAccent, opacity: an.busy ? 0.6 : 1 }}>{an.busy ? 'Sending…' : 'Send announcement'}</button>
          <div className="mt-5 space-y-2">
            {(data?.announcements || []).map((a) => (
              <div key={a.id} className="rounded-xl px-3.5 py-3" style={{ background: C.surfaceRaised, opacity: a.live ? 1 : 0.6 }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {a.title && <div className="text-[13px] font-semibold">{a.title}</div>}
                    <div className="text-[12.5px]" style={{ color: a.title ? C.inkDim : C.ink }}>{a.message}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <AdminChip tone={a.live ? 'sage' : 'dim'}>{a.live ? `Live until ${new Date(a.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Ended'}</AdminChip>
                      <AdminChip tone="dim">{AUD_LABEL[a.audience] || a.audience}</AdminChip>
                      {a.cta && a.cta !== 'none' && <AdminChip tone="copper">{SPOT_CTA[a.cta]}</AdminChip>}
                    </div>
                  </div>
                  {a.live && <button onClick={async () => { if (await brandConfirm('It stops showing straight away for everyone.', { title: 'End this announcement?', confirm: 'End now', danger: true })) { try { await call('end_announcement', { p_id: a.id }); load(); } catch (e) { brandAlert(e.message); } } }} className="shrink-0 text-[12px] font-semibold" style={{ color: C.rust }}>End now</button>}
                </div>
                {a.reach !== undefined && seenBar(a.seen, a.reach)}
              </div>
            ))}
          </div>
          {data?.error && <div className="mt-3 text-[12.5px]" style={{ color: C.rust }}>{/admin_updates|schema cache/i.test(data.error) ? 'Run support.sql in Supabase first.' : data.error}</div>}
        </div>
        <div className="rounded-2xl p-4 lg:p-5" style={box} onFocusCapture={() => setPreviewOf('update')}>
          <div className="flex items-center gap-2 mb-1"><Gift size={17} style={{ color: C.sage }} /><div className="text-[15px] font-semibold">What's new</div></div>
          <div className="text-[12.5px] mb-4" style={{ color: C.inkDim }}>Tell businesses about new features and fixes. It pops up once, and stays in Help → What's new.</div>
          <input value={up.title} maxLength={120} onChange={(e) => setUp({ ...up, title: e.target.value })} placeholder="Title, e.g. Bring in your past sales" className="w-full rounded-xl px-3.5 py-3 text-[14px] outline-none mb-2" style={field} />
          <textarea value={up.body} rows={4} maxLength={2000} onChange={(e) => setUp({ ...up, body: e.target.value })} placeholder="A few plain sentences: what it does and where to find it." className="w-full rounded-xl px-3.5 py-3 text-[13.5px] outline-none resize-y" style={field} />
          {lbl('Type')}
          {seg(up.kind, [['new', 'New'], ['improved', 'Improved'], ['fixed', 'Fixed'], ['tip', 'Tip']], (k) => { setUp({ ...up, kind: k }); setPreviewOf('update'); })}
          {lbl('Who sees it')}
          {seg(up.audience, [['all', 'Everyone'], ['owners', 'Owners only'], ['products', 'Shops'], ['services', 'Service businesses']], (k) => { setUp({ ...up, audience: k }); setPreviewOf('update'); })}
          {reachBox(up.audience)}
          <button onClick={postUpdate} disabled={up.busy} className="w-full mt-4 h-11 rounded-xl text-[13.5px] font-semibold" style={{ background: C.copperFill, color: C.onAccent, opacity: up.busy ? 0.6 : 1 }}>{up.busy ? 'Publishing…' : 'Publish update'}</button>
          <div className="mt-5 space-y-2">
            {(data?.updates || []).map((u) => (
              <div key={u.id} className="rounded-xl px-3.5 py-3" style={{ background: C.surfaceRaised }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold">{u.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5"><AdminChip tone="copper">{UPDATE_KIND[u.kind] || u.kind}</AdminChip><AdminChip tone="dim">{AUD_LABEL[u.audience] || u.audience}</AdminChip><span className="text-[11px]" style={{ color: C.inkFaint }}>{new Date(u.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>
                  </div>
                  <button onClick={async () => { if (await brandConfirm(`Remove "${u.title}" from What's new?`, { title: 'Remove update?', confirm: 'Remove', danger: true })) { try { await call('delete_update', { p_id: u.id }); load(); } catch (e) { brandAlert(e.message); } } }} aria-label="Remove" style={{ color: C.inkFaint }}><Trash2 size={15} /></button>
                </div>
                {u.reach !== undefined && seenBar(u.seen, u.reach)}
              </div>
            ))}
          </div>
        </div>
      </div>
      {preview}
    </div>
  );
}

function SupportTeamAdmin({ call }) {
  const [team, setTeam] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', busy: false });
  const load = useCallback(async () => { try { setTeam(await call('support_team')); } catch (e) { setTeam([]); } }, [call]);
  useEffect(() => { load(); }, []);
  const add = async () => {
    setForm({ ...form, busy: true });
    try { await call('support_add_agent', { p_email: form.email, p_name: form.name }); setForm({ name: '', email: '', busy: false }); load(); }
    catch (e) { setForm((f) => ({ ...f, busy: false })); brandAlert(e.message); }
  };
  const field = { background: C.bg, border: `1px solid ${C.line}`, color: C.ink };
  const link = `${window.location.origin}/admin`;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 [&>*]:min-w-0">
      <div className="rounded-2xl p-4 lg:p-5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2 mb-1"><Headphones size={17} style={{ color: C.sage }} /><div className="text-[15px] font-semibold">Support team</div></div>
        <div className="text-[12.5px] mb-4" style={{ color: C.inkDim }}>People you add can answer support messages. They only see the support inbox, never your revenue, the list of businesses, or this page.</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Their name, e.g. Ada Nwosu" className="rounded-xl px-3.5 py-3 text-[13.5px] outline-none" style={field} />
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Their email" className="rounded-xl px-3.5 py-3 text-[13.5px] outline-none" style={field} />
        </div>
        <button onClick={add} disabled={form.busy || !form.name.trim() || !form.email.trim()} className="w-full mt-2.5 h-11 rounded-xl text-[13.5px] font-semibold" style={{ background: C.copperFill, color: C.onAccent, opacity: form.busy || !form.name.trim() || !form.email.trim() ? 0.5 : 1 }}>{form.busy ? 'Adding…' : 'Add to support team'}</button>
        <div className="mt-5 space-y-2">
          {team === null ? <div className="flex justify-center py-6" style={{ color: C.inkFaint }}><Loader2 size={17} className="animate-spin" /></div>
            : !team.length ? <div className="text-[12.5px] py-2" style={{ color: C.inkFaint }}>Nobody added yet. You can answer everything yourself from the Support tab.</div>
            : team.map((a) => (
              <div key={a.id} className="rounded-xl px-3.5 py-3 flex items-center gap-3" style={{ background: C.surfaceRaised }}>
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-bold shrink-0" style={{ background: C.sageSoft, color: C.sage }}>{(a.name[0] || '?').toUpperCase()}</span>
                <div className="flex-1 min-w-0"><div className="text-[13.5px] font-semibold truncate">{a.name}</div><div className="text-[11.5px] truncate" style={{ color: C.inkFaint }}>{a.email}</div><div className="text-[11.5px]" style={{ color: a.joined ? C.sage : C.copper }}>{a.joined ? `${a.replies_30d} repl${Number(a.replies_30d) === 1 ? 'y' : 'ies'} in 30 days${Number(a.handling) ? ` · handling ${a.handling}` : ''}` : 'Hasn\'t logged in yet'}</div></div>
                <button onClick={async () => { if (await brandConfirm(`${a.name} loses access straight away.${Number(a.handling) ? ` The ${a.handling} open conversation${a.handling > 1 ? 's' : ''} they're handling go${a.handling > 1 ? '' : 'es'} back to Unassigned for the team.` : ''} Their past replies stay in each conversation, signed with their name.`, { title: 'Remove from support team?', confirm: 'Remove', danger: true })) { try { const n = await call('support_remove_agent', { p_id: a.id }); load(); if (Number(n)) brandAlert(`${n} conversation${n > 1 ? 's are' : ' is'} now in Unassigned. Open the Support tab to pick ${n > 1 ? 'them' : 'it'} up.`, { title: `${a.name} removed`, tone: 'info' }); } catch (e) { brandAlert(e.message); } } }} className="shrink-0 text-[12px] font-semibold" style={{ color: C.rust }}>Remove</button>
              </div>
            ))}
        </div>
      </div>
      <div className="rounded-2xl p-4 lg:p-5 text-[13px] leading-relaxed" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.inkDim }}>
        <div className="text-[15px] font-semibold mb-3" style={{ color: C.ink }}>What to send your support person</div>
        <ol className="space-y-2.5 list-decimal pl-5">
          <li>Open <strong className="break-all" style={{ color: C.ink }}>{link}</strong> on their phone or computer.</li>
          <li>Choose <strong style={{ color: C.ink }}>"First time? Create your login"</strong> and use the same email you added here, with a password of their own.</li>
          <li>Set up an authenticator app (Google Authenticator) when asked. Support messages include customers' business details, so a code is needed every time.</li>
          <li>Turn on notifications on that device to hear about new messages, or keep the inbox open during support hours ({SUPPORT.hoursText}).</li>
        </ol>
        <div className="mt-4 rounded-xl px-3.5 py-3 text-[12.5px]" style={{ background: C.copperSoft, color: C.ink }}>Good habits: reply within working hours, never ask for passwords, PINs or card numbers, and mark conversations solved once the customer is happy.</div>
      </div>
    </div>
  );
}
const cacAgentLink = (tok) => `${typeof window !== 'undefined' ? window.location.origin : 'https://xorla.vercel.app'}/agent/${tok}`;
function CacAdmin({ call, token, isFounder = true, initialId = null, onCounts }) {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(null);      // the full request
  const [docs, setDocs] = useState({});
  const [st, setSt] = useState(null);
  const [act, setAct] = useState({ mode: '', message: '', bn: '', name: '', tin: '', cert: null, report: null, busy: false, error: '' });
  const [copied, setCopied] = useState(false);
  const field = { background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.ink };
  const loadList = useCallback(async (s = filter) => { try { setList(await call('admin_cac_list', { p_status: s })); } catch (e) { setList([]); } }, [call, filter]);
  useEffect(() => { loadList(filter); }, [filter]);
  useEffect(() => { call('admin_cac_settings', {}).then(setSt).catch(() => {}); if (initialId) show(initialId); }, []);
  const counts = useCallback(() => { if (onCounts) call('admin_cac_counts', {}).then(onCounts).catch(() => {}); }, [call, onCounts]);
  // Paying the agent (founder only): what Xorla owes them, and what has been paid
  const [pay, setPay] = useState(null);          // from admin_cac_payouts
  const [payOpen, setPayOpen] = useState('');   // '', 'pay', 'history'
  const [payPick, setPayPick] = useState([]);
  const [payRef, setPayRef] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payDone, setPayDone] = useState(null);  // { count, total, names } after recording
  const loadPay = useCallback(() => { if (isFounder) call('admin_cac_payouts', {}).then((d) => { setPay(d); setPayPick((p) => (p.length ? p.filter((id) => d.owed.some((o) => o.id === id)) : d.owed.map((o) => o.id))); }).catch(() => setPay(null)); }, [call, isFounder]);
  useEffect(() => { loadPay(); }, [loadPay]);
  const recordPay = async () => {
    const chosen = (pay?.owed || []).filter((o) => payPick.includes(o.id));
    if (!chosen.length) return;
    const total = chosen.reduce((a, o) => a + Number(o.amount || 0), 0);
    if (!(await brandConfirm(`Record that you've sent ${fmt(total)} to ${st?.agent_name || 'the agent'} for ${chosen.length} registration${chosen.length === 1 ? '' : 's'}?`, { title: 'Record the payment?', confirm: 'Yes, I sent it' }))) return;
    setPayBusy(true);
    try { const r = await call('admin_cac_mark_agent_paid', { p_ids: chosen.map((o) => o.id), p_ref: payRef || null }); setPayDone({ count: r.count, total: r.total, names: chosen.map((o) => o.name) }); setPayRef(''); setPayPick([]); setPayOpen(''); loadPay(); }
    catch (e) { brandAlert(e.message); }
    setPayBusy(false);
  };
  const undoPay = async (x) => {
    if (!(await brandConfirm(`${x.name} goes back to "owed".`, { title: 'Undo this payment?', confirm: 'Undo', danger: true }))) return;
    try { await call('admin_cac_undo_agent_paid', { p_id: x.id }); loadPay(); } catch (e) { brandAlert(e.message); }
  };
  const saveBank = async (patch) => {
    const b = { bank: st?.agent_bank || '', number: st?.agent_account_number || '', name: st?.agent_account_name || '', ...patch };
    try { const r = await call('admin_cac_agent_bank', { p_bank: b.bank, p_number: b.number, p_name: b.name }); setSt((x) => ({ ...x, ...r })); } catch (e) { brandAlert(e.message); }
  };
  // Stay up to date by itself: every 30 seconds while this page is on screen, and when you come back to it
  const openRef = useRef(null); const actRef = useRef(act);
  useEffect(() => { openRef.current = open; actRef.current = act; });
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      loadList(); counts(); loadPay();
      const o = openRef.current;
      if (o && !actRef.current.mode && !actRef.current.busy) { try { const r = await call('admin_cac_get', { p_id: o.id }); setOpen((cur) => (cur && cur.id === r.id ? { ...cur, ...r } : cur)); } catch (e) { /* try again next time */ } }
    };
    const t = setInterval(tick, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [loadList, counts, loadPay]);
  const [emailFor, setEmailFor] = useState(null);   // { subject, body } while choosing how to send the email
  const show = async (id) => {
    try {
      const r = await call('admin_cac_get', { p_id: id }); setOpen(r); setDocs({}); setAct({ mode: '', message: '', bn: '', name: r.name_1, tin: '', cert: null, report: null, busy: false, error: '' });
      ['id_doc', 'passport_doc', 'signature_doc', 'certificate_doc'].forEach((k) => { if (r[k]) cacDocUrl(token(), r[k]).then((u) => setDocs((d) => ({ ...d, [k]: u }))).catch(() => {}); });
    } catch (e) { brandAlert(e.message); }
  };
  const saveSettings = async (patch) => { try { setSt(await call('admin_cac_settings', { p: patch })); } catch (e) { brandAlert(e.message); } };
  // Send the agent their private page for this registration: every detail, the documents, and buttons to post updates
  const [sending, setSending] = useState('');
  const sendToAgent = async (r, how, fixed = false) => {
    const win = how === 'whatsapp' ? window.open('', '_blank') : null;   // opened now so the browser doesn't block it
    setSending(how);
    try {
      const tok = await call('admin_cac_agent_link', { p_id: r.id });
      const link = cacAgentLink(tok);
      const hi = `Hello${st?.agent_name ? ` ${st.agent_name.split(' ')[0]}` : ''},`;
      const body = fixed
        ? `${hi}\n\nThe owner has fixed ${r.name_1}${(r.fixed_fields || []).length ? `. What changed: ${r.fixed_fields.join(', ')}` : ''}.\n\nThe updated details are on the same page (changes are marked):\n${link}\n\nPlease file it again and update the page. Thank you.`
        : `${hi}\n\nA new business name registration from Xorla: ${r.name_1}${r.owner_name ? ` (${r.owner_name})` : ''}.\n\nEverything you need is on this page: the details, the ID, passport photograph and signature. You can also tell us when it's filed, if CAC needs a fix, and upload the certificate there when it's approved:\n${link}\n\nThank you.`;
      if (how === 'whatsapp') { const url = `https://wa.me/${toWhatsAppNumber(st.agent_phone)}?text=${encodeURIComponent(body)}`; if (win) win.location.href = url; else window.open(url, '_blank'); }
      else if (how === 'copy') { try { await navigator.clipboard.writeText(link); } catch (e) { /* older phones */ } setCopied('link'); setTimeout(() => setCopied(false), 2000); }
      else setEmailFor({ to: st.agent_email, subject: `${fixed ? 'Fixed: ' : ''}Business name registration: ${r.name_1}${r.owner_name ? ` (${r.owner_name})` : ''}`, body });
      setOpen((o) => (o && o.id === r.id ? { ...o, sent_to_agent_at: new Date().toISOString(), agent_link: tok } : o));
      loadList(); counts();
    } catch (e) { if (win) win.close(); brandAlert(e.message); }
    setSending('');
  };
  const agentText = (r) => [
    `Business name registration: ${r.name_1} (second choice: ${r.name_2})`,
    `Nature of business: ${r.nature} / ${r.sub_category}. ${r.description}`,
    `Date of commencement: ${r.commencement_date || ''}. Staff: ${r.staff_size}. Source of funds: ${r.fund_source}`,
    `Business address: ${r.biz_address}, ${r.biz_lga ? `${r.biz_lga}, ` : ''}${r.biz_state} State`,
    `Proprietor: ${r.owner_name}, ${r.owner_gender}, ${r.owner_nationality || 'Nigerian'}, ${r.owner_occupation}, born ${r.owner_dob}`,
    `Phone: ${r.owner_phone}. Email: ${r.owner_email}. NIN: ${r.owner_nin}`,
    `Residential address: ${r.owner_address}`,
    `ID: ${r.id_type} (photo attached), passport photograph and signature attached.`,
  ].join('\n');
  const update = async () => {
    const r = open; if (!r || act.busy) return;
    setAct({ ...act, busy: true, error: '' });
    try {
      let cert = null;
      if (act.mode === 'registered' && act.cert) cert = await cacUpload(token(), r.business_id, act.cert, 'certificate');
      const report = act.mode === 'registered' && act.report ? await cacUpload(token(), r.business_id, act.report, 'status-report') : null;
      await call('admin_cac_update', { p_id: r.id, p_status: act.mode, p_message: act.message, p_bn: act.bn || null, p_registered_name: act.name || null, p_certificate: cert, p_status_report: report, p_tin: act.tin || null });
      await show(r.id); loadList(); counts(); loadPay();
    } catch (e) { setAct((a) => ({ ...a, busy: false, error: e.message })); }
  };
  const chips = [['', 'All'], ['submitted', 'Not paid'], ['paid', 'To check'], ['filed', 'With CAC'], ['query', 'Waiting on owner'], ['registered', 'Registered'], ['rejected', 'Rejected']];
  return (
    <div className="space-y-5">
      {st && !isFounder && (
        <div className="rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.inkDim }}>
          <span><strong style={{ color: C.ink }}>Agent:</strong> {st.agent_name || 'not set'}{st.agent_phone ? ` · ${st.agent_phone}` : ''}{st.agent_email ? ` · ${st.agent_email}` : ''}</span>
          <span>Owners pay <strong className="cx-mono" style={{ color: C.ink }}>{fmt(Number(st.cac_fee) + Number(st.service_fee))}</strong></span>
          <span style={{ color: C.inkFaint }}>Only the founder changes these.</span>
        </div>
      )}
      {st && isFounder && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-[14px] font-semibold">Business name registration</div><div className="text-[12px]" style={{ color: C.inkFaint }}>{st.open ? 'Open: owners can pay and send requests.' : 'Closed: owners can fill in details and are told it opens soon.'}</div></div>
            <button onClick={() => saveSettings({ open: !st.open })} className="shrink-0 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold" style={st.open ? { border: `1px solid ${C.line}`, color: C.inkDim } : { background: C.sageFill, color: C.onAccent }}>{st.open ? 'Close' : 'Open it'}</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[['cac_fee', 'CAC + agent fee (₦)'], ['service_fee', 'Xorla charge (₦)']].map(([k, l]) => (
              <label key={k} className="text-[11.5px]" style={{ color: C.inkFaint }}>{l}
                <input defaultValue={formatNumInput(st[k])} inputMode="numeric" placeholder="0" onInput={(e) => { e.target.value = formatNumInput(String(e.target.value).replace(/[^0-9]/g, '')); }} onBlur={(e) => { const v = Number(parseNumInput(e.target.value)) || 0; if (v !== Number(st[k])) saveSettings({ [k]: v }); }} className="w-full mt-1 rounded-lg px-3 py-2 text-[13px] outline-none cx-mono" style={field} />
              </label>
            ))}
            <label className="text-[11.5px] col-span-2" style={{ color: C.inkFaint }}>How long it takes
              <input defaultValue={st.turnaround} onBlur={(e) => e.target.value !== st.turnaround && saveSettings({ turnaround: e.target.value })} className="w-full mt-1 rounded-lg px-3 py-2 text-[13px] outline-none" style={field} />
            </label>
            {[['agent_name', 'Agent name'], ['agent_phone', 'Agent WhatsApp'], ['agent_email', 'Agent email']].map(([k, l]) => (
              <label key={k} className={`text-[11.5px] ${k === 'agent_email' ? 'col-span-2' : ''}`} style={{ color: C.inkFaint }}>{l}
                <input defaultValue={st[k] || ''} onBlur={(e) => (e.target.value || '') !== (st[k] || '') && saveSettings({ [k]: e.target.value })} className="w-full mt-1 rounded-lg px-3 py-2 text-[13px] outline-none" style={field} />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <label className="text-[11.5px]" style={{ color: C.inkFaint }}>Agent's bank
              <input defaultValue={st.agent_bank || ''} placeholder="e.g. GTBank" onBlur={(e) => (e.target.value || '') !== (st.agent_bank || '') && saveBank({ bank: e.target.value })} className="w-full mt-1 rounded-lg px-3 py-2 text-[13px] outline-none" style={field} />
            </label>
            <label className="text-[11.5px]" style={{ color: C.inkFaint }}>Account number
              <input defaultValue={st.agent_account_number || ''} inputMode="numeric" maxLength={10} placeholder="10 digits" onBlur={(e) => (e.target.value || '') !== (st.agent_account_number || '') && saveBank({ number: e.target.value })} className="w-full mt-1 rounded-lg px-3 py-2 text-[13px] outline-none cx-mono" style={field} />
            </label>
            <label className="text-[11.5px] col-span-2" style={{ color: C.inkFaint }}>Account name
              <input defaultValue={st.agent_account_name || ''} placeholder="As the bank shows it" onBlur={(e) => (e.target.value || '') !== (st.agent_account_name || '') && saveBank({ name: e.target.value })} className="w-full mt-1 rounded-lg px-3 py-2 text-[13px] outline-none" style={field} />
            </label>
          </div>
          <div className="text-[12px]" style={{ color: C.inkDim }}>Owners pay <strong className="cx-mono" style={{ color: C.ink }}>{fmt(Number(st.cac_fee) + Number(st.service_fee))}</strong>. Paystack pays it all to Xorla; you send the agent <strong className="cx-mono" style={{ color: C.ink }}>{fmt(Number(st.cac_fee))}</strong> once it's filed, and Xorla keeps <strong className="cx-mono" style={{ color: C.ink }}>{fmt(Number(st.service_fee))}</strong> (less Paystack's fee).</div>
        </div>
      )}
      {isFounder && pay && (() => {
        const owed = pay.owed || []; const total = owed.reduce((a, o) => a + Number(o.amount || 0), 0);
        const chosen = owed.filter((o) => payPick.includes(o.id)); const chosenTotal = chosen.reduce((a, o) => a + Number(o.amount || 0), 0);
        const agent = st?.agent_name || 'the agent';
        return (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: total ? 'linear-gradient(150deg, rgba(255,176,32,0.12), rgba(255,176,32,0.03))' : C.surface, border: `1px solid ${total ? 'rgba(255,176,32,0.35)' : C.line}` }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>Agent payments</div>
                {total ? <div className="text-[19px] font-extrabold mt-0.5">You owe {agent} <span className="cx-mono" style={{ color: C.copper }}>{fmt(total)}</span></div> : <div className="text-[16px] font-bold mt-0.5 flex items-center gap-1.5" style={{ color: C.sage }}><Check size={17} /> All paid up</div>}
                <div className="text-[12px] mt-1" style={{ color: C.inkDim }}>{total ? `For ${owed.length} filed registration${owed.length === 1 ? '' : 's'}. ` : ''}{pay.waiting ? `${pay.waiting} more paid but not filed yet (owed once filed). ` : ''}Paid this month: <span className="cx-mono">{fmt(pay.paid_month)}</span></div>
              </div>
              <div className="flex gap-2 shrink-0">
                {total > 0 && <button onClick={() => { setPayOpen(payOpen === 'pay' ? '' : 'pay'); setPayDone(null); }} className="px-3.5 py-2 rounded-xl text-[12.5px] font-bold" style={{ background: C.copperFill, color: C.onAccent }}>{payOpen === 'pay' ? 'Close' : 'Record a payment'}</button>}
                {(pay.paid || []).length > 0 && <button onClick={() => setPayOpen(payOpen === 'history' ? '' : 'history')} className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>{payOpen === 'history' ? 'Close' : 'Past payments'}</button>}
              </div>
            </div>
            {st?.agent_account_number && total > 0 && (
              <div className="rounded-xl px-3.5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]" style={{ background: C.bg }}>
                <span style={{ color: C.inkFaint }}>Send to</span>
                <span className="font-semibold">{st.agent_bank || 'Bank'} · <span className="cx-mono">{st.agent_account_number}</span>{st.agent_account_name ? ` · ${st.agent_account_name}` : ''}</span>
                <button onClick={() => { navigator.clipboard?.writeText(st.agent_account_number); setCopied('acct'); setTimeout(() => setCopied(false), 1500); }} className="text-[12px] font-semibold" style={{ color: copied === 'acct' ? C.sage : C.copper }}>{copied === 'acct' ? 'Copied' : 'Copy number'}</button>
              </div>
            )}
            {!st?.agent_account_number && total > 0 && <div className="text-[12px]" style={{ color: C.inkFaint }}>Add the agent's bank details above to see them here when you pay.</div>}
            {payOpen === 'pay' && (
              <div className="space-y-2">
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                  {owed.map((o, i) => { const on = payPick.includes(o.id); return (
                    <button key={o.id} onClick={() => setPayPick((p) => (on ? p.filter((x) => x !== o.id) : [...p, o.id]))} className="w-full text-left flex items-center gap-3 px-3.5 py-2.5" style={{ background: C.surface, borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                      <span className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center" style={{ background: on ? C.sageFill : 'transparent', border: `2px solid ${on ? C.sage : C.inkFaint}` }}>{on && <Check size={13} style={{ color: C.onAccent }} />}</span>
                      <span className="flex-1 min-w-0"><span className="block text-[13.5px] font-semibold truncate">{o.name}</span><span className="block text-[11.5px] truncate" style={{ color: C.inkFaint }}>{o.business}{o.owner_name ? ` · ${o.owner_name}` : ''} · filed {new Date(o.filed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></span>
                      <span className="shrink-0 cx-mono text-[13px] font-semibold">{fmt(o.amount)}</span>
                    </button>
                  ); })}
                </div>
                <input value={payRef} onChange={(e) => setPayRef(e.target.value)} maxLength={60} placeholder="Transfer reference or note (optional)" className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none" style={field} />
                <button onClick={recordPay} disabled={!chosen.length || payBusy} className="w-full h-11 rounded-xl text-[13.5px] font-bold" style={{ background: C.sageFill, color: C.onAccent, opacity: !chosen.length || payBusy ? 0.5 : 1 }}>{payBusy ? 'Saving…' : chosen.length ? `I've sent ${fmt(chosenTotal)} for ${chosen.length}` : 'Choose what you paid for'}</button>
              </div>
            )}
            {payDone && (
              <div className="rounded-xl px-3.5 py-3 text-[12.5px] flex flex-wrap items-center gap-2" style={{ background: C.sageSoft, color: C.ink }}>
                <span className="flex-1 min-w-0"><strong style={{ color: C.sage }}>Recorded:</strong> {fmt(payDone.total)} for {payDone.count} registration{payDone.count === 1 ? '' : 's'}.</span>
                {st?.agent_phone && <a href={`https://wa.me/${toWhatsAppNumber(st.agent_phone)}?text=${encodeURIComponent(`Hello${st.agent_name ? ` ${st.agent_name.split(' ')[0]}` : ''}, I've sent ${fmt(payDone.total)} for: ${payDone.names.join(', ')}. Thank you.`)}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-[12px] font-bold inline-flex items-center gap-1.5" style={{ background: C.sageFill, color: C.onAccent }}><MessageCircle size={13} /> Tell {st.agent_name ? st.agent_name.split(' ')[0] : 'the agent'}</a>}
              </div>
            )}
            {payOpen === 'history' && (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                {(pay.paid || []).map((x, i) => (
                  <div key={x.id} className="flex items-center gap-3 px-3.5 py-2.5 text-[12.5px]" style={{ background: C.surface, borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                    <span className="flex-1 min-w-0"><span className="block font-semibold truncate">{x.name}</span><span className="block text-[11.5px] truncate" style={{ color: C.inkFaint }}>Paid {new Date(x.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{x.ref ? ` · ${x.ref}` : ''}</span></span>
                    <span className="shrink-0 cx-mono font-semibold">{fmt(x.amount)}</span>
                    <button onClick={() => undoPay(x)} className="shrink-0 text-[11.5px] font-semibold" style={{ color: C.inkFaint }}>Undo</button>
                  </div>
                ))}
                <div className="px-3.5 py-2 text-[11.5px] text-right" style={{ background: C.bg, color: C.inkFaint }}>Paid to the agent in all: <span className="cx-mono" style={{ color: C.ink }}>{fmt(pay.paid_all)}</span></div>
              </div>
            )}
          </div>
        );
      })()}
      <div className="flex flex-wrap gap-1.5">{chips.map(([v, l]) => <button key={v || 'all'} onClick={() => setFilter(v)} className="px-3 py-1.5 rounded-full text-[12px] font-semibold" style={filter === v ? { background: C.copperFill, color: C.onAccent } : { color: C.inkDim, border: `1px solid ${C.line}` }}>{l}</button>)}</div>
      {list === null ? <Loader2 className="animate-spin" size={18} style={{ color: C.inkFaint }} /> : list.length === 0 ? <div className="text-[13px] py-8 text-center" style={{ color: C.inkFaint }}>No registrations here yet.</div> : (
        <div className="space-y-2">
          {list.map((r) => { const [w, t] = CAC_STATUS[r.status] || ['', C.inkDim]; return (
            <button key={r.id} onClick={() => show(r.id)} className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: C.surface, border: `1px solid ${open?.id === r.id ? C.copper : C.line}` }}>
              <div className="flex-1 min-w-0"><div className="text-[14px] font-semibold truncate">{r.name_1}</div><div className="text-[12px] truncate" style={{ color: C.inkFaint }}>{r.business} · {r.for_other ? `for ${r.owner_name || "someone else"}` : r.owner_name} · {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</div></div>
              {r.status === 'paid' && !r.sent_to_agent_at && <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: C.onAccent, background: C.copperFill }}>New</span>}
              {r.status === 'paid' && r.sent_to_agent_at && r.fixed_at && new Date(r.fixed_at) > new Date(r.sent_to_agent_at) && <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: C.onAccent, background: C.copperFill }}>Fixed</span>}
              <span className="shrink-0 text-[11.5px] font-semibold px-2 py-0.5 rounded-full" style={{ color: t, background: 'rgba(var(--c-hi),0.05)' }}>{w}</span>
            </button>
          ); })}
        </div>
      )}
      {open && (
        <div className="rounded-2xl p-4 space-y-4" style={{ background: C.surface, border: `1px solid ${C.lineStrong || C.line}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><div className="text-[17px] font-bold" style={{ overflowWrap: 'anywhere' }}>{open.name_1}</div><div className="text-[12.5px]" style={{ color: C.inkFaint }}>Second choice: {open.name_2} · {open.business}</div></div>
            <button onClick={() => setOpen(null)} aria-label="Close" style={{ color: C.inkFaint }}><X size={18} /></button>
          </div>
          <pre className="text-[12.5px] leading-relaxed whitespace-pre-wrap rounded-xl p-3" style={{ background: C.bg, color: C.inkDim, fontFamily: 'inherit' }}>{agentText(open)}</pre>
          <div className="grid grid-cols-3 gap-2">
            {[['id_doc', 'ID'], ['passport_doc', 'Passport photo'], ['signature_doc', 'Signature']].map(([k, l]) => (
              <a key={k} href={docs[k] || undefined} target="_blank" rel="noopener noreferrer" className="rounded-xl overflow-hidden block" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                <div className="aspect-[4/3] flex items-center justify-center">{docs[k] ? (/\.pdf/i.test(open[k]) ? <FileText size={24} style={{ color: C.inkDim }} /> : <img src={docs[k]} alt={l} className="w-full h-full object-cover" />) : <Loader2 size={16} className="animate-spin" style={{ color: C.inkFaint }} />}</div>
                <div className="text-[11.5px] px-2 py-1.5" style={{ color: C.inkDim }}>{l}</div>
              </a>
            ))}
          </div>
          {open.status === 'paid' && open.fixed_at && open.sent_to_agent_at && new Date(open.fixed_at) > new Date(open.sent_to_agent_at) && (
            <div className="rounded-xl p-3.5" style={{ background: C.copperSoft, border: '1px solid rgba(255,176,32,0.35)' }}>
              <div className="text-[13.5px] font-semibold" style={{ color: C.copper }}>{open.owner_name || 'The owner'} fixed it. Tell the agent.</div>
              {(open.fixed_fields || []).length > 0 && <div className="text-[12.5px] mt-1" style={{ color: C.ink }}>Changed: {open.fixed_fields.join(', ')}</div>}
              <div className="flex flex-wrap gap-2 mt-2.5">
                {st?.agent_phone && <button onClick={() => sendToAgent(open, 'whatsapp', true)} disabled={!!sending} className="px-3 py-2 rounded-xl text-[12.5px] font-bold inline-flex items-center gap-1.5" style={{ background: C.copperFill, color: C.onAccent }}><MessageCircle size={14} /> Tell the agent on WhatsApp</button>}
                {st?.agent_email && <button onClick={() => sendToAgent(open, 'email', true)} disabled={!!sending} className="px-3 py-2 rounded-xl text-[12.5px] font-semibold inline-flex items-center gap-1.5" style={{ border: '1px solid rgba(255,176,32,0.4)', color: C.ink }}><Send size={14} /> Email the agent</button>}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {open.paid_at ? (<>
              {st?.agent_phone && <button onClick={() => sendToAgent(open, 'whatsapp')} disabled={!!sending} className="px-3 py-2 rounded-xl text-[12.5px] font-semibold inline-flex items-center gap-1.5" style={{ background: C.sageFill, color: C.onAccent, opacity: sending ? 0.6 : 1 }}><MessageCircle size={14} /> {sending === 'whatsapp' ? 'Preparing…' : 'WhatsApp the agent'}</button>}
              {st?.agent_email && <button onClick={() => sendToAgent(open, 'email')} disabled={!!sending} className="px-3 py-2 rounded-xl text-[12.5px] font-semibold inline-flex items-center gap-1.5" style={{ border: `1px solid ${C.line}`, color: C.ink, opacity: sending ? 0.6 : 1 }}><Send size={14} /> {sending === 'email' ? 'Preparing…' : 'Email the agent'}</button>}
              <button onClick={() => sendToAgent(open, 'copy')} disabled={!!sending} className="px-3 py-2 rounded-xl text-[12.5px] font-semibold inline-flex items-center gap-1.5" style={{ border: `1px solid ${C.line}`, color: copied === 'link' ? C.sage : C.ink }}><Link2 size={14} /> {copied === 'link' ? 'Link copied' : "Copy the agent's link"}</button>
              {!st?.agent_phone && !st?.agent_email && <span className="px-1 py-2 text-[12px]" style={{ color: C.inkFaint }}>{isFounder ? "Add your agent's WhatsApp or email above to send this in one tap." : 'The founder has not added the agent yet.'}</span>}
            </>) : <span className="px-1 py-2 text-[12px]" style={{ color: C.inkFaint }}>It goes to the agent once it's paid.</span>}
            <button onClick={() => { navigator.clipboard?.writeText(agentText(open)); setCopied('text'); setTimeout(() => setCopied(false), 2000); }} className="px-3 py-2 rounded-xl text-[12.5px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>{copied === 'text' ? 'Copied' : 'Copy the details'}</button>
            {open.owner_phone && <a href={`https://wa.me/${toWhatsAppNumber(open.owner_phone)}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-xl text-[12.5px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>WhatsApp the owner</a>}
          </div>
          <div className="text-[12.5px]" style={{ color: C.inkDim }}>Status: <strong style={{ color: (CAC_STATUS[open.status] || [])[1] }}>{(CAC_STATUS[open.status] || [open.status])[0]}</strong>{open.paid_at ? ` · paid ${fmt(open.amount)} on ${new Date(open.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ' · not paid'}{open.bn_number ? ` · ${open.bn_number}` : ''}{open.sent_to_agent_at ? ` · sent to the agent ${new Date(open.sent_to_agent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}{isFounder && open.agent_paid_at ? ` · agent paid ${fmt(open.agent_paid_amount)}` : isFounder && open.filed_at ? ' · agent not paid yet' : ''}</div>
          {(open.events || []).length > 0 && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: C.bg }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>What's happened</div>
              {open.events.map((e, i) => { const [w, tone] = CAC_STATUS[e.status] || [e.status, C.inkDim]; const who = { agent: e.by_name ? `${e.by_name} (agent)` : 'The agent', team: e.by_name || 'Xorla', owner: e.by_name || 'The owner', payment: 'Paystack' }[e.by] || e.by; return (
                <div key={i} className="flex items-start gap-2.5 text-[12.5px]">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: tone }} />
                  <span className="flex-1 min-w-0"><strong style={{ color: C.ink }}>{w}</strong> <span style={{ color: C.inkFaint }}>by {who} · {new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>{e.message ? <span className="block mt-0.5" style={{ color: C.inkDim }}>{e.message}</span> : null}</span>
                </div>
              ); })}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {[['filed', 'Filed with CAC'], ['query', 'Ask the owner to fix'], ['registered', 'Registered'], ['rejected', 'Reject']].map(([m, l]) => (
              <button key={m} onClick={() => setAct({ ...act, mode: act.mode === m ? '' : m, error: '' })} className="px-3 py-2 rounded-xl text-[12.5px] font-semibold" style={act.mode === m ? { background: m === 'rejected' ? C.rustFill : C.copperFill, color: C.onAccent } : { border: `1px solid ${C.line}`, color: C.ink }}>{l}</button>
            ))}
          </div>
          {act.mode && (
            <div className="space-y-2.5">
              {act.mode === 'registered' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input value={act.bn} onChange={(e) => setAct({ ...act, bn: e.target.value })} placeholder="BN number, e.g. BN 1234567" className="rounded-xl px-3 py-2.5 text-[13px] outline-none cx-mono" style={field} />
                  <input value={act.name} onChange={(e) => setAct({ ...act, name: e.target.value })} placeholder="Name as registered" className="rounded-xl px-3 py-2.5 text-[13px] outline-none" style={field} />
                  <input value={act.tin} onChange={(e) => setAct({ ...act, tin: e.target.value })} placeholder="TIN (if issued)" className="rounded-xl px-3 py-2.5 text-[13px] outline-none cx-mono" style={field} />
                  <label className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] cursor-pointer min-w-0" style={field}><Upload size={14} className="shrink-0" /> <span className="truncate">{act.report ? act.report.name : 'Status report (optional)'}</span><input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setAct({ ...act, report: e.target.files?.[0] || null })} /></label>
                  <label className="sm:col-span-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] cursor-pointer" style={field}><Upload size={14} /> {act.cert ? act.cert.name : 'Upload the certificate (PDF or photo)'}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setAct({ ...act, cert: e.target.files?.[0] || null })} /></label>
                </div>
              )}
              {CAC_SUGGEST[act.mode] && (
                <div className="flex flex-wrap gap-1.5">{CAC_SUGGEST[act.mode].map((t) => <button key={t} type="button" onClick={() => setAct({ ...act, message: t })} className="text-left px-2.5 py-1.5 rounded-lg text-[11.5px] leading-snug" style={act.message === t ? { background: C.copperSoft, color: C.copper, border: `1px solid rgba(255,176,32,0.4)` } : { border: `1px solid ${C.line}`, color: C.inkDim }}>{t}</button>)}</div>
              )}
              {act.mode !== 'filed' && <textarea rows={3} value={act.message} onChange={(e) => setAct({ ...act, message: e.target.value })} placeholder={act.mode === 'query' ? 'What should the owner fix? e.g. Your ID photo is blurry. Please upload a clearer one.' : act.mode === 'rejected' ? "Why, and whether they'll get their money back" : 'A note for the owner (optional)'} className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none resize-none" style={field} />}
              {act.error && <div className="text-[12.5px]" style={{ color: C.rust }}>{act.error}</div>}
              <button onClick={update} disabled={act.busy} className="w-full h-11 rounded-xl text-[13.5px] font-bold" style={{ background: C.sageFill, color: C.onAccent, opacity: act.busy ? 0.6 : 1 }}>{act.busy ? 'Saving…' : 'Save and notify the owner'}</button>
            </div>
          )}
        </div>
      )}
      {emailFor && (
        <Sheet onClose={() => setEmailFor(null)} title="Email the agent">
          <div className="space-y-2.5">
            <div className="text-[12.5px] leading-relaxed" style={{ color: C.inkDim }}>To <strong style={{ color: C.ink }}>{emailFor.to}</strong>. Choose how to send it:</div>
            <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailFor.to)}&su=${encodeURIComponent(emailFor.subject)}&body=${encodeURIComponent(emailFor.body)}`} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(() => setEmailFor(null), 300)} className="w-full h-12 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2" style={{ background: C.sageFill, color: C.onAccent }}><Send size={16} /> Open in Gmail</a>
            <a href={`mailto:${emailFor.to}?subject=${encodeURIComponent(emailFor.subject)}&body=${encodeURIComponent(emailFor.body)}`} onClick={() => setTimeout(() => setEmailFor(null), 300)} className="w-full h-11 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2" style={{ border: `1px solid ${C.line}`, color: C.ink }}>Open my email app</a>
            <button onClick={async () => { try { await navigator.clipboard.writeText(`${emailFor.subject}\n\n${emailFor.body}`); } catch (e) { /* older phones */ } setCopied('email'); setTimeout(() => setCopied(false), 2000); }} className="w-full h-11 rounded-xl text-[13.5px] font-semibold" style={{ border: `1px solid ${C.line}`, color: copied === 'email' ? C.sage : C.inkDim }}>{copied === 'email' ? 'Copied. Paste it into any email' : 'Copy the message'}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function AdminDashboard() {
  useXorlaTheme();
  const [state, setState] = useState({ phase: 'loading', error: '' });
  const [ov, setOv] = useState(null);
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loadingList, setLoadingList] = useState(false);
  const [updated, setUpdated] = useState(null);
  const [mfa, setMfa] = useState({ factorId: '', qr: '', secret: '', uri: '', code: '', busy: false, error: '', copied: false });
  const [detail, setDetail] = useState(null);   // { b, data }
  const [role, setRole] = useState('founder');    // founder sees everything; a support person sees only the inbox
  const [agentName, setAgentName] = useState('');
  const [section, setSection] = useState(() => { try { const q = new URLSearchParams(window.location.search); return q.get('ticket') ? 'support' : q.get('cac') ? 'cac' : q.get('rider') ? 'riders' : 'overview'; } catch (e) { return 'overview'; } });
  const [cacFromLink] = useState(() => { try { return new URLSearchParams(window.location.search).get('cac') || null; } catch (e) { return null; } });
  const [riderFromLink] = useState(() => { try { return new URLSearchParams(window.location.search).get('rider') || null; } catch (e) { return null; } });
  const [riderCounts, setRiderCounts] = useState(null);   // rider applications waiting for the team
  const [ticketFromLink] = useState(() => { try { return new URLSearchParams(window.location.search).get('ticket') || null; } catch (e) { return null; } });
  const [supportCounts, setSupportCounts] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cacCounts, setCacCounts] = useState(null);   // registrations waiting for the team
  const [refreshKey, setRefreshKey] = useState(0);   // bumps to reload whichever section is open
  const [justUpdated, setJustUpdated] = useState(false);
  const [login, setLogin] = useState({ email: '', password: '', confirm: '', create: false, busy: false, error: '' });
  const tokenRef = useRef(null);
  // The browser tab says who this page is for
  useEffect(() => {
    document.title = state.phase === 'ready' || state.phase === 'mfa-code' || state.phase === 'mfa-setup'
      ? (role === 'agent' ? 'Xorla · Support inbox' : 'Xorla · Founder dashboard') : 'Xorla · Team';
  }, [role, state.phase]);
  useEffect(() => {
    document.title = 'Xorla · Team';
    const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex, nofollow'; document.head.appendChild(m);
    return () => m.remove();
  }, []);

  const freshToken = useCallback(async () => {
    const sess = await loadSession();
    if (!sess) return null;
    const r = await sbRefresh(sess.refresh_token);
    const next = { access_token: r.access_token, refresh_token: r.refresh_token, user_id: r.user.id };
    await saveSession(next); tokenRef.current = next.access_token;
    return next.access_token;
  }, []);
  const call = useCallback(async (fn, params = {}) => {
    try { return await sbRpc(fn, tokenRef.current, params); }
    catch (e) { if (!/jwt|expired|token/i.test(e.message)) throw e; await freshToken(); return sbRpc(fn, tokenRef.current, params); }
  }, [freshToken]);
  const loadList = useCallback(async (q, f) => {
    setLoadingList(true);
    try { setList(await call('admin_businesses', { p_search: q, p_filter: f, p_limit: 100, p_offset: 0 }) || []); } catch (e) { /* shown by the overview */ }
    setLoadingList(false);
  }, [call]);

  // Decide what to show: log in, set up the authenticator, enter today's code, or the dashboard
  const loadAll = useCallback(async () => {
    const sess = await loadSession();
    if (!sess) { setState({ phase: 'login', error: '' }); return; }
    tokenRef.current = sess.access_token;
    try {
      let access;
      // support_access also knows about the support team; older databases only have admin_access
      const ask = async () => { try { const a = await sbRpc('support_access', tokenRef.current, {}); if (a && typeof a === 'object') return a; } catch (e) { if (/jwt|expired|token/i.test(e.message)) throw e; } return sbRpc('admin_access', tokenRef.current, {}); };
      try { access = await ask(); }
      catch (e) { if (!/jwt|expired|token/i.test(e.message)) throw e; await freshToken(); access = await ask(); }
      if (!access?.admin && !access?.agent) { setState({ phase: 'denied', error: '' }); return; }
      setRole(access.admin ? 'founder' : 'agent'); setAgentName(access.name || '');
      if (!access.admin) setSection((x) => (['cac', 'riders'].includes(x) ? x : 'support'));
      if (!access.verified) {
        const user = await sbAuthReq('/user', tokenRef.current);
        const verified = (user.factors || []).find((f) => f.factor_type === 'totp' && f.status === 'verified');
        if (verified) { setMfa((m) => ({ ...m, factorId: verified.id, qr: '', code: '', error: '' })); setState({ phase: 'mfa-code', error: '' }); return; }
        // clear any half-finished setup, then start a new one
        await Promise.all((user.factors || []).filter((f) => f.status !== 'verified').map((f) => sbAuthReq(`/factors/${f.id}`, tokenRef.current, 'DELETE').catch(() => null)));
        const f = await sbAuthReq('/factors', tokenRef.current, 'POST', { factor_type: 'totp', friendly_name: `Xorla team ${Date.now()}` });
        // Build our own setup link and QR picture (Supabase's own picture doesn't show in some browsers)
        const fromUri = (() => { try { return new URL(f.totp?.uri || '').searchParams.get('secret') || ''; } catch { return ''; } })();
        const secret = String(f.totp?.secret || fromUri).replace(/\s/g, '').toUpperCase();
        const uri = secret ? `otpauth://totp/${encodeURIComponent(access.admin ? 'Xorla:Founder dashboard' : 'Xorla:Support inbox')}?secret=${secret}&issuer=Xorla&algorithm=SHA1&digits=6&period=30` : (f.totp?.uri || '');
        let qr = '';
        try { const QR = await import('qrcode'); qr = await QR.toDataURL(uri, { margin: 1, width: 320, errorCorrectionLevel: 'M', color: { dark: '#0A1F1C', light: '#FFFFFF' } }); }
        catch { qr = ''; }
        setMfa({ factorId: f.id, qr, secret, uri, code: '', busy: false, error: '', copied: false });
        setState({ phase: 'mfa-setup', error: '' }); return;
      }
      if (!access.admin) { setUpdated(new Date()); setState({ phase: 'ready', error: '' }); call('support_inbox', { p_status: 'open', p_search: '' }).then((d) => setSupportCounts(d.counts)).catch(() => {}); call('admin_cac_counts', {}).then(setCacCounts).catch(() => {}); call('admin_rider_counts', {}).then(setRiderCounts).catch(() => {}); return; }
      const o = await call('admin_overview');
      try { o.deposits = await call('admin_deposit_earnings'); } catch (e) { o.deposits = null; }
      try { o.revenue = await call('admin_revenue'); } catch (e) { o.revenue = null; }
      setOv(o); setUpdated(new Date()); setState({ phase: 'ready', error: '' });
      loadList(search, filter);
      call('support_inbox', { p_status: 'open', p_search: '' }).then((d) => setSupportCounts(d.counts)).catch(() => {});
      call('admin_cac_counts', {}).then(setCacCounts).catch(() => {}); call('admin_rider_counts', {}).then(setRiderCounts).catch(() => {});
    } catch (e) { setState({ phase: /not allowed/i.test(e.message) ? 'denied' : 'error', error: e.message }); }
  }, [call, freshToken, loadList, search, filter]);
  useEffect(() => { loadAll(); }, []);
  // Keep the numbers fresh by themselves: every minute while the page is on screen, and when you come back to it
  const sectionRef = useRef(section); sectionRef.current = section;
  useEffect(() => {
    if (state.phase !== 'ready') return undefined;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      call('support_inbox', { p_status: 'open', p_search: '' }).then((d) => setSupportCounts(d.counts)).catch(() => {});
      call('admin_cac_counts', {}).then(setCacCounts).catch(() => {}); call('admin_rider_counts', {}).then(setRiderCounts).catch(() => {});
      if (sectionRef.current === 'overview' && role === 'founder') loadAll();
    };
    const t = setInterval(tick, 60000);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [state.phase, role]);
  // Refresh: fetch the numbers again and reload the open section, with something to see while it works
  const refreshNow = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await loadAll(); setRefreshKey((k) => k + 1); } finally {
      setRefreshing(false); setJustUpdated(true);
      clearTimeout(window.__xorlaAdminUpd); window.__xorlaAdminUpd = setTimeout(() => setJustUpdated(false), 2500);
    }
  };
  useEffect(() => { if (state.phase !== 'ready') return undefined; const t = setTimeout(() => loadList(search, filter), 300); return () => clearTimeout(t); }, [search, filter]);

  const isPhone = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  const copyKey = async () => {
    try { await navigator.clipboard.writeText(mfa.secret); }
    catch { const t = document.createElement('textarea'); t.value = mfa.secret; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch { /* ignore */ } t.remove(); }
    setMfa((m) => ({ ...m, copied: true })); setTimeout(() => setMfa((m) => ({ ...m, copied: false })), 2000);
  };
  const verifyCode = async () => {
    const code = mfa.code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) { setMfa({ ...mfa, error: 'Enter the 6-digit code from your authenticator app.' }); return; }
    setMfa({ ...mfa, busy: true, error: '' });
    try {
      const ch = await sbAuthReq(`/factors/${mfa.factorId}/challenge`, tokenRef.current, 'POST', {});
      const r = await sbAuthReq(`/factors/${mfa.factorId}/verify`, tokenRef.current, 'POST', { challenge_id: ch.id, code });
      await saveSession({ access_token: r.access_token, refresh_token: r.refresh_token, user_id: r.user?.id || (await loadSession())?.user_id });
      tokenRef.current = r.access_token;
      setMfa({ factorId: '', qr: '', secret: '', uri: '', code: '', busy: false, error: '', copied: false });
      setState({ phase: 'loading', error: '' }); loadAll();
    } catch (e) { setMfa((m) => ({ ...m, busy: false, error: /invalid|expired/i.test(e.message) ? "That code didn't work. Codes change every 30 seconds, so try the newest one." : e.message })); }
  };

  const extendTrial = async (b) => {
    if (!(await brandConfirm(`${b.name} gets 14 more days of the full Business plan, free. Their records stay as they are.`, { title: `Extend ${b.name}'s trial?`, confirm: 'Add 14 days' }))) return;
    try { await call('admin_extend_trial', { p_business: b.id, p_days: 14 }); await loadAll(); if (detail) openDetail(b); }
    catch (e) { brandAlert(e.message); }
  };
  const setStorefront = async (b, on) => {
    if (!(await brandConfirm(on ? `${b.name}'s storefront will be visible to customers again.` : `${b.name}'s storefront will stop taking orders and bookings immediately. Use this for scams or abuse. The owner can see it's off.`, { title: on ? 'Turn the storefront back on?' : 'Turn off this storefront?', confirm: on ? 'Turn on' : 'Turn off', danger: !on }))) return;
    try { await call('admin_set_storefront', { p_business: b.id, p_on: on }); setDetail((d) => d && { ...d, b: { ...d.b, storefront_enabled: on } }); loadAll(); }
    catch (e) { brandAlert(e.message); }
  };
  const openDetail = async (b) => {
    setDetail({ b, data: null });
    try { const data = await call('admin_business_detail', { p_business: b.id }); setDetail({ b, data }); }
    catch (e) { setDetail(null); brandAlert(e.message); }
  };

  // Log out of this page (and of Xorla on this browser, which shares the same login)
  const logOut = async () => {
    if (!(await brandConfirm(role === 'agent' ? 'You will need your password and authenticator code to come back in.' : 'You will need your password and authenticator code to open the dashboard again. This also logs you out of Xorla on this browser.', { title: 'Log out?', confirm: 'Log out' }))) return;
    try { if (tokenRef.current) await sbAuthReq('/logout', tokenRef.current, 'POST'); } catch (e) { /* the login is cleared below either way */ }
    await saveSession(null); tokenRef.current = null;
    setOv(null); setList([]); setDetail(null); setSupportCounts(null); setRole('founder'); setAgentName(''); setSection('overview');
    setLogin({ email: '', password: '', confirm: '', create: false, busy: false, error: '' });
    setState({ phase: 'login', error: '' });
  };
  const shell = (body) => (
    <div className="min-h-screen cx-body" style={{ overflowX: 'clip', background: C.bg, color: C.ink, fontFamily: "'Poppins', 'Inter', system-ui, sans-serif" }}>
      <header className="sticky top-0 z-20" style={{ background: 'rgba(var(--c-bg-rgb),0.98)', borderBottom: `1px solid ${C.line}`, paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><XorlaMark size={26} /><span className="text-[16px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>Xorla</span><span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: role === 'agent' ? C.sageSoft : C.copperSoft, color: role === 'agent' ? C.sage : C.copper }}>{role === 'agent' ? 'Support' : 'Founder'}</span></div>
          {state.phase === 'ready' && (
            <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              {(role === 'founder' ? [['overview', 'Overview'], ['support', 'Support'], ['cac', 'CAC'], ['riders', 'Riders'], ['publish', "What's new"], ['team', 'Support team']] : [['support', 'Support'], ['cac', 'CAC registrations'], ['riders', 'Riders']]).map(([k, l]) => (
                <button key={k} onClick={() => setSection(k)} className="relative px-3 py-1.5 rounded-lg text-[12.5px] font-semibold" style={section === k ? { background: C.copperFill, color: C.onAccent } : { color: C.inkDim }}>{l}{(k === 'support' ? supportCounts?.open : k === 'cac' ? cacCounts?.todo : k === 'riders' ? riderCounts?.to_check : 0) ? <span className="ml-1.5 px-1.5 rounded-full text-[10.5px]" style={{ background: section === k ? C.bg : C.copperFill, color: section === k ? C.copper : C.onAccent }}>{k === 'support' ? supportCounts?.open : k === 'riders' ? riderCounts?.to_check : cacCounts?.todo}</span> : null}</button>
              ))}
            </nav>
          )}
          {['ready', 'denied', 'mfa-setup', 'mfa-code', 'error'].includes(state.phase) && (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {state.phase === 'ready' && (
                <button onClick={refreshNow} disabled={refreshing} aria-label="Get the latest numbers" title="Get the latest numbers and messages" className="flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ color: justUpdated ? C.sage : C.inkDim, border: `1px solid ${justUpdated ? 'rgba(31,217,196,0.4)' : C.line}` }}>
                  {justUpdated ? <Check size={14} /> : <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
                  <span className="hidden sm:inline">{refreshing ? 'Updating…' : justUpdated ? 'Up to date' : 'Refresh'}</span>
                  {updated && !refreshing && !justUpdated ? <span className="hidden sm:inline" style={{ color: C.inkFaint }}>· {updated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span> : null}
                </button>
              )}
              <button onClick={logOut} className="flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-lg" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}><LogOut size={14} /> Log out</button>
            </div>
          )}
        </div>
      </header>
      {state.phase === 'ready' && (
        <div className="md:hidden max-w-6xl mx-auto px-5 pt-4">
          <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            {(role === 'founder' ? [['overview', 'Overview'], ['support', 'Support'], ['cac', 'CAC'], ['riders', 'Riders'], ['publish', "What's new"], ['team', 'Team']] : [['support', 'Support'], ['cac', 'CAC'], ['riders', 'Riders']]).map(([k, l]) => (
              <button key={k} onClick={() => setSection(k)} className="flex-1 shrink-0 px-3 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap" style={section === k ? { background: C.copperFill, color: C.onAccent } : { color: C.inkDim }}>{l}{k === 'support' && supportCounts?.open ? ` ${supportCounts.open}` : ''}{k === 'cac' && cacCounts?.todo ? ` ${cacCounts.todo}` : ''}{k === 'riders' && riderCounts?.to_check ? ` ${riderCounts.to_check}` : ''}</button>
            ))}
          </div>
        </div>
      )}
      <main className="max-w-6xl mx-auto px-5 py-6 pb-20">{body}</main>
    </div>
  );
  const center = (title, text, extra) => shell(<div className="text-center py-16 max-w-md mx-auto"><div className="text-[19px] font-semibold mb-2">{title}</div><div className="text-[13.5px] leading-relaxed mb-5" style={{ color: C.inkDim }}>{text}</div>{extra}</div>);
  if (state.phase === 'loading') return shell(<div className="flex items-center gap-2 py-20 justify-center" style={{ color: C.inkFaint }}><Loader2 size={18} className="animate-spin" /> Loading…</div>);
  if (state.phase === 'login') {
    const f = login;
    const submit = async () => {
      if (!f.email.trim() || !f.password) return;
      if (f.create && passwordError(f.password)) { setLogin({ ...f, error: passwordError(f.password) }); return; }
      if (f.create && f.confirm !== f.password) { setLogin({ ...f, error: "The two passwords don't match." }); return; }
      setLogin({ ...f, busy: true, error: '' });
      try {
        let auth = f.create ? await sbSignUp(f.email.trim(), f.password) : await sbSignIn(f.email.trim(), f.password);
        if (f.create && !auth.access_token) { setLogin({ ...f, busy: false, create: false, error: 'Check your email to confirm your address, then log in here.' }); return; }
        await saveSession({ access_token: auth.access_token, refresh_token: auth.refresh_token, user_id: auth.user.id });
        setState({ phase: 'loading', error: '' }); loadAll();
      } catch (e) { setLogin((x) => ({ ...x, busy: false, error: friendlyAuthError(e.message) })); }
    };
    const field = { background: C.surface, border: `1px solid ${C.line}`, color: C.ink };
    return shell(
      <div className="max-w-sm mx-auto py-10">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.sageSoft }}><Headphones size={22} style={{ color: C.sage }} /></div>
        <h1 className="text-[22px] font-bold mb-1.5">{f.create ? 'Create your login' : 'Xorla team log in'}</h1>
        <p className="text-[13px] leading-relaxed mb-5" style={{ color: C.inkDim }}>{f.create ? 'For support team members. Use the email the founder added you with.' : 'For Xorla\'s founder and support team.'}</p>
        <div className="space-y-2.5">
          <input type="email" autoComplete="email" placeholder="Email address" value={f.email} onChange={(e) => setLogin({ ...f, email: e.target.value })} className="w-full rounded-xl px-3.5 py-3 text-[14px] outline-none" style={field} />
          <PasswordInput value={f.password} onChange={(e) => setLogin({ ...f, password: e.target.value })} placeholder={f.create ? 'Create a password' : 'Password'} autoComplete={f.create ? 'new-password' : 'current-password'} style={field} />
          {f.create && <PasswordInput value={f.confirm} onChange={(e) => setLogin({ ...f, confirm: e.target.value })} placeholder="Type the password again" autoComplete="new-password" style={field} />}
          {f.create && <PasswordChecks password={f.password} confirm={f.confirm} />}
        </div>
        {f.error && <div className="mt-3 rounded-xl px-3.5 py-2.5 text-[12.5px]" style={{ background: C.rustSoft, color: C.rust }}>{f.error}</div>}
        <button onClick={submit} disabled={f.busy || !f.email.trim() || !f.password} className="w-full mt-4 rounded-xl py-3.5 text-[14px] font-semibold" style={{ background: C.copperFill, color: C.onAccent, opacity: f.busy || !f.email.trim() || !f.password ? 0.6 : 1 }}>{f.busy ? 'Please wait…' : f.create ? 'Create login' : 'Log in'}</button>
        <button onClick={() => setLogin({ ...f, create: !f.create, error: '' })} className="w-full mt-3 text-[13px] font-medium" style={{ color: C.copper }}>{f.create ? 'Already have a login? Log in' : 'First time? Create your login'}</button>
      </div>
    );
  }
  if (state.phase === 'denied') return center("This page is for Xorla's team", "This account doesn't have access. If the founder just added you to the support team, make sure you logged in with that same email.", <div className="flex items-center justify-center gap-4"><a href="/" style={{ color: C.copper }}>Back to Xorla</a><button onClick={async () => { await saveSession(null); setLogin({ email: '', password: '', confirm: '', create: false, busy: false, error: '' }); setState({ phase: 'login', error: '' }); }} className="font-semibold" style={{ color: C.inkDim }}>Use another account</button></div>);
  if (state.phase === 'error') return center("Couldn't load the dashboard", state.error, <button onClick={loadAll} className="px-5 py-3 rounded-xl font-semibold" style={{ background: C.copperFill, color: C.onAccent }}>Try again</button>);
  if (state.phase === 'mfa-setup' || state.phase === 'mfa-code') {
    const setup = state.phase === 'mfa-setup';
    return shell(
      <div className="max-w-md mx-auto py-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.sageSoft }}><ShieldCheck size={22} style={{ color: C.sage }} /></div>
        <h1 className="text-[22px] font-bold mb-2">{setup ? (role === 'agent' ? 'Protect the support inbox' : 'Protect the founder dashboard') : 'Enter your code'}</h1>
        <p className="text-[13.5px] leading-relaxed mb-5" style={{ color: C.inkDim }}>{setup
          ? (role === 'agent' ? "Support messages include customers' names, phone numbers and business details, so this page needs a second step after your password: a 6-digit code from an authenticator app on your phone. Even if someone learns your password, they can't get in without your phone. You set it up once." : 'This page shows every business on Xorla, so it needs a second step after your password: a 6-digit code from an authenticator app on your phone. Set it up once.')
          : 'Open your authenticator app and type the 6-digit code for Xorla.'}</p>
        {setup && (
          <div className="space-y-3 mb-5 text-[13.5px]" style={{ color: C.inkDim }}>
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="text-[12px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.copper }}>Step 1</div>
              <div>Install <strong style={{ color: C.ink }}>Google Authenticator</strong> (or Microsoft Authenticator) from the Play Store or App Store. It's free.</div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="text-[12px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.copper }}>Step 2 · Add Xorla to the app</div>
              {isPhone ? (
                <>
                  <div className="mb-3">You're on your phone, so there's nothing to scan. Tap this and choose your authenticator app:</div>
                  {mfa.uri && <a href={mfa.uri} className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-[14px] font-semibold" style={{ background: C.sageFill, color: C.onAccent }}><ShieldCheck size={16} /> Add to authenticator app</a>}
                  <div className="mt-3 text-[12.5px]">If nothing opens: in the app tap <strong style={{ color: C.ink }}>+</strong> → <strong style={{ color: C.ink }}>Enter a setup key</strong>, name it <strong style={{ color: C.ink }}>Xorla</strong>, and paste this key:</div>
                </>
              ) : (
                <>
                  <div>In the app on your phone tap <strong style={{ color: C.ink }}>+</strong> → <strong style={{ color: C.ink }}>Scan a QR code</strong>, then point the camera at this:</div>
                  {mfa.qr
                    ? <div className="mt-3 flex justify-center"><div className="rounded-2xl p-3" style={{ background: '#fff' }}><img src={mfa.qr} alt="QR code to scan with your authenticator app" width={200} height={200} style={{ display: 'block' }} /></div></div>
                    : <div className="mt-3 text-[12.5px]" style={{ color: C.copper }}>The picture couldn't load. Use the key below instead.</div>}
                  <div className="mt-3 text-[12.5px]">Can't scan? Tap <strong style={{ color: C.ink }}>+</strong> → <strong style={{ color: C.ink }}>Enter a setup key</strong>, name it <strong style={{ color: C.ink }}>Xorla</strong>, and type this key:</div>
                </>
              )}
              {mfa.secret && (
                <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                  <span className="cx-mono select-all break-all flex-1 text-[13px] tracking-wider" style={{ color: C.ink }}>{mfa.secret.match(/.{1,4}/g).join(' ')}</span>
                  <button onClick={copyKey} className="shrink-0 flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg" style={{ background: C.copperSoft, color: C.copper }}>{mfa.copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}</button>
                </div>
              )}
              <div className="mt-2 text-[12px]" style={{ color: C.inkFaint }}>Key type: time-based. Spaces don't matter.</div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="text-[12px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.copper }}>Step 3</div>
              <div>The app now shows <strong style={{ color: C.ink }}>Xorla</strong> with a 6-digit code that changes every 30 seconds. Type it here:</div>
            </div>
          </div>
        )}
        <input inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} placeholder="123 456" value={mfa.code} onChange={(e) => setMfa({ ...mfa, code: e.target.value.replace(/[^0-9 ]/g, '') })} onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
          className="w-full rounded-xl px-4 py-3.5 text-[22px] tracking-[0.3em] text-center outline-none cx-mono" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.ink }} />
        {mfa.error && <div className="mt-3 rounded-xl px-3.5 py-2.5 text-[12.5px]" style={{ background: C.rustSoft, color: C.rust }}>{mfa.error}</div>}
        <button onClick={verifyCode} disabled={mfa.busy} className="w-full mt-4 rounded-xl py-3.5 text-[14px] font-semibold" style={{ background: C.copperFill, color: C.onAccent, opacity: mfa.busy ? 0.6 : 1 }}>{mfa.busy ? 'Checking…' : setup ? 'Turn on and continue' : 'Continue'}</button>
        <p className="text-[12px] mt-4 leading-relaxed" style={{ color: C.inkFaint }}>{setup ? 'Keep your phone safe. If you lose it, you can remove the old authenticator in Supabase → Authentication → Users, then set up a new one here.' : 'Lost your phone? Remove the old authenticator in Supabase → Authentication → Users, then set up a new one here.'}</p>
      </div>
    );
  }

  if (section !== 'overview' || role !== 'founder' || !ov) {
    const head = { support: ['Support inbox', role === 'agent' ? `Signed in as ${agentName || 'support'}. Replies go out as "${(agentName || 'Xorla').split(' ')[0]} from Xorla Support".` : 'Messages from businesses. Billing and complaints come first.'], publish: ["What's new and announcements", 'Keep every business up to date, in the app.'], team: ['Support team', 'Who can answer support messages.'], cac: ['Business name registrations', 'Requests from businesses, the agent you use, and the price.'], riders: ['Rider network', 'Delivery riders who applied to join Xorla. Check each one carefully before approving.'] }[section === 'overview' ? 'support' : section] || ['', ''];
    return shell(
      <>
        <div className="mb-5"><h1 className="text-[24px] font-extrabold" style={{ letterSpacing: '-0.02em' }}>{head[0]}</h1><div className="text-[13px] mt-0.5" style={{ color: C.inkDim }}>{head[1]}</div></div>
        {(section === 'support' || section === 'overview') && <SupportInbox key={`inbox-${refreshKey}`} call={call} token={tokenRef.current} agentName={agentName} initialTicket={ticketFromLink} onCounts={setSupportCounts} />}
        {section === 'publish' && role === 'founder' && <SupportPublishing key={`pub-${refreshKey}`} call={call} />}
        {section === 'team' && role === 'founder' && <SupportTeamAdmin key={`team-${refreshKey}`} call={call} />}
        {section === 'riders' && <RiderAdmin key={`riders-${refreshKey}`} call={call} token={() => tokenRef.current} isFounder={role === 'founder'} initialId={refreshKey === 0 ? riderFromLink : null} onCounts={setRiderCounts} />}
        {section === 'cac' && <CacAdmin key={`cac-${refreshKey}`} call={call} token={() => tokenRef.current} isFounder={role === 'founder'} initialId={refreshKey === 0 ? cacFromLink : null} onCounts={setCacCounts} />}
      </>
    );
  }
  const n = (x) => Number(x || 0).toLocaleString('en-NG');
  const tile = (label, value, sub, accent) => (
    <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <div className="text-[12px] font-medium" style={{ color: C.inkFaint }}>{label}</div>
      <div className="text-[26px] font-extrabold mt-1 cx-mono" style={{ letterSpacing: '-0.02em', color: accent || C.ink }}>{value}</div>
      {sub && <div className="text-[12px] mt-0.5" style={{ color: C.inkDim }}>{sub}</div>}
    </div>
  );
  const panel = (title, right, children) => (
    <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <div className="flex items-baseline justify-between mb-3 gap-3"><div className="text-[14px] font-semibold">{title}</div>{right && <div className="text-[12px]" style={{ color: C.inkFaint }}>{right}</div>}</div>
      {children}
    </div>
  );
  const empty = (t) => <div className="text-[12.5px] py-2" style={{ color: C.inkFaint }}>{t}</div>;
  const typeName = { products: 'Shops (products)', both: 'Products & services', services: 'Services (other)', accommodation: 'Hotels & stays', rentals: 'Rentals', personal_care: 'Salons & personal care', repairs: 'Repairs & trades', professional: 'Professional services', events: 'Events & media', 'not set': 'Not chosen yet' };
  const types = Object.entries(ov.by_type || {}).sort((a, b) => b[1] - a[1]);
  const maxType = Math.max(1, ...types.map(([, v]) => v));
  const signups = (ov.signups || []).map((d) => ({ ...d, label: new Date(d.day + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) }));
  const act = ov.activation || { cohort: 0, activated: 0 };
  const planOf = (b) => {
    if (Number(b.monthly_value) > 0) return [b.plan === 'business' ? 'Business' : 'Pro', C.sageSoft, C.sage, `${b.billing_interval === 'yearly' ? 'Yearly' : 'Monthly'}${b.early_supporter ? ' · early' : ''}`];
    if (b.status === 'trial' && new Date(b.trial_ends_at) > new Date()) { const left = Math.ceil((new Date(b.trial_ends_at) - Date.now()) / 86400000); return ['Trial', left <= 7 ? C.copperSoft : C.surfaceRaised, left <= 7 ? C.copper : C.inkDim, `${left} day${left !== 1 ? 's' : ''} left`]; }
    return ['Free', C.surfaceRaised, C.inkFaint, b.status === 'expired' ? 'Trial ended' : ''];
  };
  const ago = (iso) => {
    if (!iso) return 'Never';
    const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
    return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  const short = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const nudge = (b, text) => b.owner_phone && `https://wa.me/${toWhatsAppNumber(b.owner_phone)}?text=${encodeURIComponent(text || `Hi ${(b.owner_name || '').split(' ')[0] || 'there'}, this is Ikenna from Xorla. How is ${b.name} finding it so far? Anything I can help you set up?`)}`;
  const actionName = { extend_trial: 'Extended trial', storefront_off: 'Turned storefront off', storefront_on: 'Turned storefront on' };

  const HEADF = "'Poppins', 'Inter', sans-serif";
  const glass = { background: C.card, border: `1px solid ${C.line}` };
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' });
  const activation = act.cohort ? Math.round((act.activated / act.cohort) * 100) : null;
  const payRate = Number(ov.businesses) ? Math.round((Number(ov.paying) / Number(ov.businesses)) * 100) : 0;
  const early = Number(ov.early_taken || 0);
  const signupTotal = signups.reduce((a, d) => a + Number(d.count || 0), 0);
  const TYPE_COLORS = [C.sage, C.copper, '#7FB3FF', '#C792EA', '#F78C6C', '#89DDFF', '#FFCB6B', '#A3BE8C', '#E2A090', '#8A9A96'];
  const attention = [
    supportCounts?.open ? { Icon: Headphones, tone: 'copper', title: `${n(supportCounts.open)} support message${supportCounts.open > 1 ? 's' : ''} waiting`, sub: 'Billing and complaints first', go: () => setSection('support') } : null,
    riderCounts?.to_check ? { Icon: Bike, tone: 'copper', title: `${n(riderCounts.to_check)} rider application${riderCounts.to_check > 1 ? 's' : ''} to check`, sub: 'ID, selfie, guarantor and bank', go: () => setSection('riders') } : null,
    cacCounts?.todo ? { Icon: ShieldCheck, tone: 'copper', title: `${n(cacCounts.todo)} registration${cacCounts.todo > 1 ? 's' : ''} to send to the agent`, sub: 'Paid, or fixed by the owner', go: () => setSection('cac') } : null,
    Number(ov.renewals_at_risk) ? { Icon: AlertCircle, tone: 'rust', title: `${n(ov.renewals_at_risk)} renewal${ov.renewals_at_risk > 1 ? 's' : ''} at risk`, sub: 'Paying, auto-renew off, ending this week', go: () => document.getElementById('xa-risk')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } : null,
    Number(ov.trials_ending_7d) ? { Icon: Clock, tone: 'copper', title: `${n(ov.trials_ending_7d)} trial${ov.trials_ending_7d > 1 ? 's' : ''} ending this week`, sub: 'A friendly message now helps them stay', go: () => { setFilter('ending'); document.getElementById('xa-biz')?.scrollIntoView({ behavior: 'smooth' }); } } : null,
  ].filter(Boolean);
  const toneOf = (t) => (t === 'rust' ? [C.rustSoft, C.rust, 'rgba(226,98,75,0.3)'] : t === 'sage' ? [C.sageSoft, C.sage, 'rgba(31,217,196,0.25)'] : [C.copperSoft, C.copper, 'rgba(255,176,32,0.3)']);
  const stat = (Icon, label, value, sub, tone, extra) => {
    const [bg, fg] = toneOf(tone);
    return (
      <div className="rounded-[20px] p-4 lg:p-5 relative overflow-hidden" style={glass}>
        <div className="flex items-center gap-2.5 mb-3"><span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg, color: fg }}><Icon size={15} /></span><span className="text-[12.5px] font-medium leading-tight" style={{ color: C.inkDim }}>{label}</span></div>
        <div className="text-[26px] lg:text-[28px] font-extrabold tabular-nums leading-none" style={{ fontFamily: HEADF, letterSpacing: '-0.02em' }}>{value}</div>
        {sub && <div className="text-[12px] mt-2 leading-snug" style={{ color: C.inkFaint }}>{sub}</div>}
        {extra}
      </div>
    );
  };
  const meter = (pct, color) => <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(var(--c-hi),0.06)' }}><div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }} /></div>;
  const sectionTitle = (Icon, title, right, id) => (
    <div id={id} className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-2.5"><Icon size={16} style={{ color: C.inkFaint }} /><span className="text-[15px] font-semibold" style={{ fontFamily: HEADF }}>{title}</span></div>{right && <span className="text-[12px]" style={{ color: C.inkFaint }}>{right}</span>}</div>
  );

  return shell(
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <div className="text-[13px]" style={{ color: C.inkFaint }}>{today}</div>
          <h1 className="text-[28px] lg:text-[34px] font-extrabold leading-tight" style={{ fontFamily: HEADF, letterSpacing: '-0.03em' }}>{greet}. Here's Xorla today.</h1>
        </div>
        <div className="text-[12px] flex items-center gap-1.5" style={{ color: C.inkFaint }}><span className="w-2 h-2 rounded-full" style={{ background: C.sageFill, boxShadow: `0 0 0 3px ${C.sageSoft}` }} />Live from the database · your own test business left out</div>
      </div>

      {/* The headline: money and businesses */}
      <div data-xt="dark" className="relative overflow-hidden rounded-[28px] p-6 lg:p-8 mb-4" style={{ background: 'linear-gradient(150deg, #174339 0%, #0F2C27 50%, #0B211D 100%)', border: '1px solid rgba(var(--c-hi),0.09)', boxShadow: '0 30px 60px -30px rgba(var(--c-lo),calc(0.8 * var(--c-lok))), inset 0 1px 0 rgba(var(--c-hi),0.08)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(115deg, transparent 38%, rgba(255,176,32,0.08) 50%, transparent 62%)' }} />
        <div className="absolute -right-10 -bottom-14 opacity-[0.07] pointer-events-none"><XorlaMark size={260} /></div>
        <div className="relative grid lg:grid-cols-[1.25fr_1fr] gap-7 lg:gap-10 items-end">
          <div>
            {(() => {
              const rv = ov.revenue;
              const all = rv ? Number(rv.total_all) : Number(ov.revenue_all || 0) + Number(ov.deposits?.fees_all || 0);
              const d30 = rv ? Number(rv.total_30d) : Number(ov.revenue_30d || 0) + Number(ov.deposits?.fees_30d || 0);
              const kinds = [['plans', 'Plans', C.copper], ['payments', 'Payment fees', C.sage], ['cac', 'CAC service fees', '#7FB3FF']];
              const months = rv?.by_month || [];
              const top = Math.max(1, ...months.map((m) => Number(m.plans) + Number(m.payments) + Number(m.cac)));
              return (<>
                <div className="text-[13px] font-medium" style={{ color: C.inkDim }}>Total revenue, all time</div>
                <div className="text-[44px] lg:text-[58px] font-extrabold tabular-nums leading-[1.05] mt-1" style={{ fontFamily: HEADF, letterSpacing: '-0.035em', color: '#FFD27A' }}>{fmt(all)}</div>
                <div className="text-[13.5px] mt-2 flex flex-wrap gap-x-4 gap-y-1" style={{ color: C.inkDim }}>
                  <span><span className="font-semibold" style={{ color: C.ink }}>{fmt(d30)}</span> in the last 30 days</span>
                  {rv && <span><span className="font-semibold" style={{ color: C.ink }}>{fmt(rv.total_month)}</span> this month</span>}
                  <span>MRR <span className="font-semibold" style={{ color: C.ink }}>{fmt(ov.mrr)}</span></span>
                </div>
                {rv && <div className="mt-3 flex flex-wrap gap-1.5">
                  {kinds.map(([k, l, col]) => (
                    <span key={k} className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(var(--c-lo),calc(0.22 * var(--c-lok)))', border: '1px solid rgba(var(--c-hi),0.07)', color: C.inkDim }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: col }} />{l} <span className="font-semibold tabular-nums" style={{ color: C.ink }}>{fmt(rv.by_kind?.[k]?.all || 0)}</span>
                    </span>
                  ))}
                </div>}
                {months.length > 0 && <div className="mt-4 max-w-sm">
                  <div className="flex items-end gap-2 h-[64px]">
                    {months.map((m) => { const tot = Number(m.plans) + Number(m.payments) + Number(m.cac); return (
                      <div key={m.month} className="flex-1 flex flex-col justify-end h-full" title={`${new Date(m.month + '-15').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}: ${fmt(tot)}`}>
                        <div className="w-full rounded-t-md overflow-hidden flex flex-col-reverse" style={{ height: `${Math.max(tot ? 6 : 2, (tot / top) * 100)}%`, background: tot ? 'transparent' : 'rgba(var(--c-hi),0.08)' }}>
                          {kinds.map(([k, , col]) => Number(m[k]) > 0 && <div key={k} style={{ height: `${(Number(m[k]) / tot) * 100}%`, background: col }} />)}
                        </div>
                      </div>
                    ); })}
                  </div>
                  <div className="flex gap-2 mt-1">{months.map((m) => <div key={m.month} className="flex-1 text-center text-[10.5px]" style={{ color: C.inkFaint }}>{new Date(m.month + '-15').toLocaleDateString('en-GB', { month: 'short' })}</div>)}</div>
                </div>}
                {!rv && <div className="text-[11.5px] mt-2" style={{ color: C.inkFaint }}>Run founder-revenue.sql to see CAC fees and a monthly breakdown here.</div>}
              </>);
            })()}
            <div className="mt-5 max-w-sm">
              <div className="flex justify-between text-[12px] mb-1.5"><span style={{ color: C.inkDim }}>Early supporters</span><span className="tabular-nums" style={{ color: C.ink }}>{n(early)} of 100 <span style={{ color: C.inkFaint }}>· {n(Math.max(0, 100 - early))} left</span></span></div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(var(--c-hi),0.08)' }}><div className="h-full rounded-full" style={{ width: `${Math.max(1.5, early)}%`, background: `linear-gradient(90deg, ${C.sageFill}, ${C.copperFill})` }} /></div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[['Businesses', n(ov.businesses), `+${n(ov.new_7d)} this week`], ['Paying', n(ov.paying), `${payRate}% of all`], ['Active', n(ov.active_7d), 'sold this week']].map(([l, v, sub]) => (
              <div key={l} className="rounded-2xl p-3.5" style={{ background: 'rgba(var(--c-lo),calc(0.18 * var(--c-lok)))', border: '1px solid rgba(var(--c-hi),0.07)' }}>
                <div className="text-[11.5px]" style={{ color: C.inkFaint }}>{l}</div>
                <div className="text-[24px] lg:text-[28px] font-extrabold tabular-nums leading-tight mt-0.5" style={{ fontFamily: HEADF, letterSpacing: '-0.02em' }}>{v}</div>
                <div className="text-[11px] mt-0.5" style={{ color: C.sage }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* What needs you today */}
      {attention.length > 0 ? (
        <div className={`grid gap-2.5 mb-4 ${attention.length === 2 ? 'md:grid-cols-2' : attention.length > 2 ? 'md:grid-cols-3' : ''}`}>
          {attention.map((a) => { const [bg, fg, bd] = toneOf(a.tone); return (
            <button key={a.title} onClick={a.go} className="rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left" style={{ background: bg, border: `1px solid ${bd}` }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(var(--c-lo),calc(0.2 * var(--c-lok)))', color: fg }}><a.Icon size={17} /></span>
              <span className="flex-1 min-w-0"><span className="block text-[13.5px] font-semibold">{a.title}</span><span className="block text-[11.5px]" style={{ color: C.inkDim }}>{a.sub}</span></span>
              <ChevronRight size={16} style={{ color: fg }} className="shrink-0" />
            </button>
          ); })}
        </div>
      ) : (
        <div className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 text-[13px]" style={{ background: C.sageSoft, border: '1px solid rgba(31,217,196,0.22)' }}><Check size={16} style={{ color: C.sage }} /><span>Nothing needs you right now. No waiting support messages, renewals at risk or trials ending this week.</span></div>
      )}

      {/* The numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {stat(Sparkles, 'On free trial', n(ov.trials), ov.trials_ending_7d ? `${n(ov.trials_ending_7d)} ending this week` : 'None ending this week', 'sage')}
        {stat(TrendingUp, 'Got started in week one', activation === null ? '–' : `${activation}%`, act.cohort ? `${n(act.activated)} of ${n(act.cohort)} recorded a sale` : 'Shows once businesses are a week old', 'sage', activation !== null && meter(activation, C.sage))}
        {stat(Receipt, 'Sales recorded', n(ov.sales_30d), `${fmt(ov.gmv_30d)} through Xorla in 30 days`, 'copper')}
        {stat(Store, 'Storefronts live', n(ov.storefronts), `${n(ov.orders_30d)} orders and requests in 30 days`, 'copper')}
        {stat(Lightbulb, 'Oga questions', n(ov.ai_month), 'This month · each one costs you', 'copper')}
        {stat(Send, 'WhatsApp messages', n(ov.wa_month), 'Sent this month', 'sage')}
        {stat(ShieldCheck, 'Renewals at risk', n(ov.renewals_at_risk), 'Paying, auto-renew off, ending this week', Number(ov.renewals_at_risk) ? 'rust' : 'sage')}
        {stat(Users, 'Plans', `${n(ov.paying_pro)} · ${n(ov.paying_business)}`, 'Pro · Business', 'sage')}
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3 mb-4">
        <div className="rounded-[22px] p-5" style={glass}>
          {sectionTitle(TrendingUp, 'New businesses', `${n(signupTotal)} in the last 30 days`)}
          <div style={{ height: 230 }} role="img" aria-label={`New businesses per day over the last 30 days, ${n(ov.new_30d)} in total`}>
            <LazyChart>{(R) => (
<R.ResponsiveContainer width="100%" height="100%">
              <R.AreaChart data={signups} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                <defs><linearGradient id="xaSign" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.sage} stopOpacity={0.4} /><stop offset="100%" stopColor={C.sage} stopOpacity={0} /></linearGradient></defs>
                <R.CartesianGrid vertical={false} stroke="rgba(var(--c-hi),0.05)" />
                <R.XAxis dataKey="label" tick={{ fill: C.inkFaint, fontSize: 11 }} tickLine={false} axisLine={false} interval={6} />
                <R.YAxis allowDecimals={false} tick={{ fill: C.inkFaint, fontSize: 11 }} tickLine={false} axisLine={false} width={26} />
                <R.Tooltip contentStyle={{ background: C.surfaceRaised, border: `1px solid ${C.line}`, borderRadius: 12, fontSize: 12, color: C.ink }} labelStyle={{ color: C.inkDim }} formatter={(v) => [v, 'New businesses']} />
                <R.Area type="monotone" dataKey="count" stroke={C.sage} strokeWidth={2.2} fill="url(#xaSign)" />
              </R.AreaChart>
            </R.ResponsiveContainer>
)}</LazyChart>
          </div>
        </div>
        <div className="rounded-[22px] p-5" style={glass}>
          {sectionTitle(Shapes, 'Kinds of business', `${n(ov.businesses)} total`)}
          {types.length ? (
            <>
              <div className="flex h-3 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(var(--c-hi),0.05)' }}>
                {types.map(([t, v], i) => <div key={t} style={{ width: `${(v / Math.max(1, types.reduce((a, [, x]) => a + x, 0))) * 100}%`, background: TYPE_COLORS[i % TYPE_COLORS.length] }} />)}
              </div>
              <div className="space-y-2.5">
                {types.map(([t, v], i) => (
                  <div key={t} className="flex items-center gap-2.5 text-[13px]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                    <span className="flex-1 min-w-0 truncate" style={{ color: C.inkDim }}>{typeName[t] || t}</span>
                    <span className="tabular-nums font-semibold">{v}</span>
                    <span className="w-10 text-right tabular-nums text-[11.5px]" style={{ color: C.inkFaint }}>{Math.round((v / Math.max(1, types.reduce((a, [, x]) => a + x, 0))) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : empty('No businesses yet.')}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="rounded-[22px] p-5" style={glass}>
          {sectionTitle(AlertCircle, 'Renewals at risk', null, 'xa-risk')}
          {(ov.at_risk || []).length ? (
            <div className="space-y-2">{ov.at_risk.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(var(--c-hi),0.03)' }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold shrink-0" style={{ background: C.rustSoft, color: C.rust }}>{(r.name || '?')[0].toUpperCase()}</span>
                <span className="flex-1 min-w-0"><span className="block text-[13px] font-semibold truncate">{r.name}</span><span className="block text-[11.5px]" style={{ color: C.inkFaint }}>{r.plan === 'business' ? 'Business' : 'Pro'} · ends {short(r.current_period_end)}</span></span>
                {r.owner_phone && <a href={nudge(r, `Hi, this is Ikenna from Xorla. Your ${r.plan === 'business' ? 'Business' : 'Pro'} plan for ${r.name} ends on ${short(r.current_period_end)}. Would you like help renewing, or is there anything we could do better?`)} target="_blank" rel="noopener noreferrer" className="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: C.copperSoft, color: C.copper }}>Message</a>}
              </div>))}</div>
          ) : <div className="flex items-center gap-2 text-[12.5px] py-1" style={{ color: C.inkFaint }}><Check size={14} style={{ color: C.sage }} /> None this week.</div>}
        </div>
        <div className="rounded-[22px] p-5" style={glass}>
          {sectionTitle(Wallet, 'Latest payments')}
          {(ov.recent_payments || []).length ? (
            <div className="space-y-2">{ov.recent_payments.map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(var(--c-hi),0.03)' }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.sageSoft, color: C.sage }}><ArrowDownRight size={15} /></span>
                <span className="flex-1 min-w-0"><span className="block text-[13px] font-semibold truncate">{p.business}</span><span className="block text-[11.5px]" style={{ color: C.inkFaint }}>{p.plan === 'business' ? 'Business' : 'Pro'}, {p.billing_interval} · {short(p.paid_at)}</span></span>
                <span className="shrink-0 tabular-nums text-[13.5px] font-bold" style={{ color: C.sage }}>{fmt(p.amount)}</span>
              </div>))}</div>
          ) : <div className="text-[12.5px] py-1" style={{ color: C.inkFaint }}>No payments yet. They appear here the moment one comes in.</div>}
        </div>
        <div className="rounded-[22px] p-5" style={glass}>
          {sectionTitle(History, 'Your recent actions')}
          {(ov.log || []).length ? (
            <div className="relative pl-4 space-y-3">
              <div className="absolute left-[3px] top-1.5 bottom-1.5 w-px" style={{ background: C.line }} />
              {ov.log.map((l, i) => (
                <div key={i} className="relative text-[12.5px]">
                  <span className="absolute -left-4 top-1.5 w-[7px] h-[7px] rounded-full" style={{ background: C.copperFill }} />
                  <span className="font-medium">{actionName[l.action] || l.action}</span>{l.detail ? <span style={{ color: C.inkFaint }}> ({l.detail})</span> : null}<span style={{ color: C.inkDim }}> · {l.business || 'a business'}</span>
                  <div className="text-[11px]" style={{ color: C.inkFaint }}>{new Date(l.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{l.admin ? ` · ${l.admin}` : ''}</div>
                </div>))}
            </div>
          ) : <div className="text-[12.5px] py-1" style={{ color: C.inkFaint }}>Nothing yet. Trial extensions and storefront changes are recorded here.</div>}
        </div>
      </div>

      <div id="xa-biz" className="mt-6 rounded-[22px] overflow-hidden" style={glass}>
        <div className="p-4 lg:p-5 flex flex-col lg:flex-row lg:items-center gap-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2.5 flex-1"><Building2 size={16} style={{ color: C.inkFaint }} /><span className="text-[15px] font-semibold" style={{ fontFamily: HEADF }}>Businesses</span></div>
          <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'rgba(var(--c-lo),calc(0.2 * var(--c-lok)))', border: `1px solid ${C.line}` }}>
            {[['all', 'All'], ['paying', 'Paying'], ['trial', 'On trial'], ['ending', 'Trial ending'], ['free', 'Free']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className="shrink-0 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold" style={filter === k ? { background: C.copperFill, color: C.onAccent } : { color: C.inkDim }}>{l}</button>
            ))}
          </div>
          <div className="relative lg:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.inkFaint }} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or phone" className="w-full rounded-xl pl-9 pr-3 py-2.5 text-[13px] outline-none" style={{ background: 'rgba(var(--c-lo),calc(0.2 * var(--c-lok)))', border: `1px solid ${C.line}`, color: C.ink }} />
          </div>
        </div>
        {loadingList && !list.length ? <div className="p-8 flex justify-center" style={{ color: C.inkFaint }}><Loader2 size={18} className="animate-spin" /></div>
          : !list.length ? <div className="p-8 text-center text-[13px]" style={{ color: C.inkFaint }}>No businesses match.</div> : (
          <div>
            {list.map((b, i) => {
              const [pl, pbg, pfg, psub] = planOf(b);
              return (
                <div key={b.id} className="px-4 lg:px-5 py-3.5 grid gap-2.5 lg:grid-cols-[1.5fr_1.3fr_0.9fr_0.9fr_170px] lg:items-center" style={{ borderTop: i ? `1px solid ${C.line}` : 'none', opacity: loadingList ? 0.6 : 1 }}>
                  <button onClick={() => openDetail(b)} className="min-w-0 text-left flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[14px] font-extrabold shrink-0" style={{ fontFamily: HEADF, background: 'linear-gradient(140deg, #FFC85A, #FFB020)', color: C.onAccent }}>{(b.name || '?').trim()[0].toUpperCase()}</span>
                    <span className="min-w-0"><span className="block text-[13.5px] font-semibold truncate underline-offset-2 hover:underline">{b.name}</span>
                    <span className="block text-[11.5px] truncate" style={{ color: C.inkFaint }}>{typeName[b.business_type === 'services' && b.service_kind ? b.service_kind : b.business_type || 'not set'] || b.business_type} · joined {new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>
                  </button>
                  <div className="min-w-0 text-[12.5px] lg:pl-0 pl-12">
                    <div className="truncate">{b.owner_name || 'Owner'}</div>
                    <div className="truncate text-[11.5px]" style={{ color: C.inkFaint }}>{b.owner_email || ''}{b.owner_phone ? ` · ${formatPhoneDisplay(b.owner_phone)}` : ''}</div>
                  </div>
                  <div className="pl-12 lg:pl-0"><span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: pbg, color: pfg }}>{pl}</span>{psub && <span className="text-[11px] ml-1.5" style={{ color: C.inkFaint }}>{psub}</span>}</div>
                  <div className="text-[12px] pl-12 lg:pl-0" style={{ color: C.inkDim }}><span className="tabular-nums">{n(b.sales_30d)}</span> sales in 30 days<div className="text-[11px]" style={{ color: C.inkFaint }}>Last seen {ago(b.last_seen_at)}</div></div>
                  <div className="flex items-center gap-2 lg:justify-end pl-12 lg:pl-0">
                    {nudge(b) && <a href={nudge(b)} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: C.copperSoft, color: C.copper }}>WhatsApp</a>}
                    <button onClick={() => openDetail(b)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: C.sageSoft, color: C.sage }}>Details</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="text-[11.5px] mt-3" style={{ color: C.inkFaint }}>Showing up to 100 businesses, newest first. Search to find anyone else. Monthly recurring revenue counts yearly plans as one twelfth a month.</div>

      {detail && (() => {
        const { b, data } = detail;
        const [pl, pbg, pfg, psub] = planOf(b);
        return (
          <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(var(--c-scrim),0.7)' }} onClick={() => setDetail(null)}>
            <div className="w-full max-w-md h-full overflow-y-auto p-5 xorla-fade-up" style={{ background: C.surface, borderLeft: `1px solid ${C.line}` }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0"><div className="text-[18px] font-bold truncate">{b.name}</div><div className="text-[12px]" style={{ color: C.inkFaint }}>{typeName[b.business_type === 'services' && b.service_kind ? b.service_kind : b.business_type || 'not set']} · joined {short(b.created_at)}</div></div>
                <button onClick={() => setDetail(null)} aria-label="Close" style={{ color: C.inkFaint }}><X size={18} /></button>
              </div>
              <div className="rounded-xl p-3.5 mb-3 text-[12.5px] space-y-1" style={{ background: C.surfaceRaised }}>
                <div><span style={{ color: C.inkFaint }}>Owner: </span>{b.owner_name || '–'}</div>
                <div><span style={{ color: C.inkFaint }}>Email: </span>{b.owner_email || '–'}</div>
                <div><span style={{ color: C.inkFaint }}>Phone: </span>{b.owner_phone ? formatPhoneDisplay(b.owner_phone) : '–'}</div>
                <div className="pt-1"><span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: pbg, color: pfg }}>{pl}</span>{psub && <span className="text-[11px] ml-1.5" style={{ color: C.inkFaint }}>{psub}</span>}</div>
              </div>
              {!data ? <div className="flex items-center gap-2 text-[12.5px] py-4" style={{ color: C.inkFaint }}><Loader2 size={14} className="animate-spin" /> Loading…</div> : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[['Sales, 30 days', n(data.sales_30d?.count)], ['Value, 30 days', fmt(data.sales_30d?.total)], ['All sales', n(data.sales_all)], ['Catalog items', n(data.catalog)], ['Unpaid invoices', n(data.invoices_open)], ['Oga questions', n(data.ai_month)]].map(([l, v]) => (
                      <div key={l} className="rounded-xl p-2.5" style={{ background: C.surfaceRaised }}><div className="text-[10.5px]" style={{ color: C.inkFaint }}>{l}</div><div className="text-[14px] font-bold cx-mono">{v}</div></div>
                    ))}
                  </div>
                  <div className="text-[12.5px] font-semibold mb-1.5">Locations</div>
                  <div className="text-[12.5px] mb-3" style={{ color: C.inkDim }}>{(data.locations || []).map((l) => `${l.name}${l.kind === 'warehouse' ? ' (warehouse)' : ''}${l.closed ? ' (closed)' : ''}`).join(', ') || '–'}</div>
                  <div className="text-[12.5px] font-semibold mb-1.5">People</div>
                  <div className="space-y-1 mb-3">{(data.staff || []).map((p, i) => <div key={i} className="text-[12.5px] flex justify-between"><span>{p.name} <span style={{ color: C.inkFaint }}>({p.role === 'pending' ? 'waiting for approval' : p.role})</span></span><span style={{ color: C.inkFaint }}>{ago(p.last_seen_at)}</span></div>)}</div>
                  <div className="text-[12.5px] font-semibold mb-1.5">Payments</div>
                  <div className="space-y-1 mb-4">{(data.payments || []).length ? data.payments.map((p, i) => <div key={i} className="text-[12.5px] flex justify-between"><span style={{ color: C.inkDim }}>{short(p.paid_at)} · {p.plan === 'business' ? 'Business' : 'Pro'}, {p.interval}</span><span className="cx-mono">{fmt(p.amount)}</span></div>) : <div className="text-[12.5px]" style={{ color: C.inkFaint }}>None yet</div>}</div>
                </>
              )}
              <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
                {nudge(b) && <a href={nudge(b)} target="_blank" rel="noopener noreferrer" className="block w-full text-center rounded-xl py-2.5 text-[13px] font-semibold mt-3" style={{ background: C.copperFill, color: C.onAccent }}>Message the owner on WhatsApp</a>}
                {!(Number(b.monthly_value) > 0) && <button onClick={() => extendTrial(b)} className="w-full rounded-xl py-2.5 text-[13px] font-semibold" style={{ color: C.ink, border: `1px solid ${C.line}` }}>Extend trial by 14 days</button>}
                {b.business_code && b.storefront_enabled && <a href={`/store/${b.business_code}`} target="_blank" rel="noopener noreferrer" className="block w-full text-center rounded-xl py-2.5 text-[13px] font-semibold" style={{ color: C.ink, border: `1px solid ${C.line}` }}>Open their storefront</a>}
                {b.storefront_enabled
                  ? <button onClick={() => setStorefront(b, false)} className="w-full rounded-xl py-2.5 text-[13px] font-semibold" style={{ color: C.rust }}>Turn off storefront (abuse)</button>
                  : <button onClick={() => setStorefront(b, true)} className="w-full rounded-xl py-2.5 text-[12.5px] font-medium" style={{ color: C.inkFaint }}>Storefront is off · turn on</button>}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ============ Founder / support: checking rider applications ============
const RIDER_ADMIN_STATUS = {
  submitted: ['To check', C.copper], needs_fix: ['Waiting for a fix', C.inkDim], approved: ['Approved', C.sage], suspended: ['Paused', C.rust], rejected: ['Turned down', C.rust], draft: ['Still filling in', C.inkFaint],
};
const RIDER_CHECKS = [
  ['face', 'Face matches the ID photo', 'Same person, clear photo, not a photo of a photo.'],
  ['id', 'ID number checked', 'The number is real and the name on it matches.'],
  ['guarantor', 'Guarantor called', 'They know the rider and agreed to stand for them.'],
  ['bank', 'Bank name matches', 'The name the bank gave matches the rider.'],
];
const RIDER_FIX_SUGGEST = [
  'Your selfie is not clear. Please take it again in good light, facing the camera, with no cap or glasses.',
  'Your ID photo is not clear. Please take it again, flat on a table, with all four corners showing.',
  "We couldn't reach your guarantor. Please check their phone number, or add someone else.",
  "The name on your bank account doesn't match your name. Please use an account in your own name.",
  'Your plate number looks wrong. Please check it.',
];
const riderAgo = (t) => { if (!t) return ''; const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)} day${Math.round(m / 1440) !== 1 ? 's' : ''} ago`; };
const namesClose = (a, b) => { const w = (s) => String(s || '').toLowerCase().split(/[^a-z]+/).filter((x) => x.length >= 3); const x = w(a), y = w(b); if (!x.length || !y.length) return 0; return x.filter((t) => y.includes(t)).length / Math.min(x.length, y.length); };

// Riders: applications to join, and the delivery jobs running on the network
function RiderAdmin(props) {
  const [view, setView] = useState('people');
  return (
    <div>
      <div className="inline-flex p-1 rounded-xl mb-4" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }} role="tablist" aria-label="Riders">
        {[['people', 'Applications', Users], ['jobs', 'Delivery jobs', Truck], ['moves', 'Moves', MapPin]].map(([k, l, Ic]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold" style={view === k ? { background: C.copperFill, color: C.onAccent } : { color: C.inkDim }}><Ic size={14} />{l}</button>
        ))}
      </div>
      {view === 'people' ? <RiderApplications {...props} /> : view === 'jobs' ? <RiderJobsAdmin call={props.call} /> : <RiderMovesAdmin call={props.call} />}
    </div>
  );
}

// Riders who moved to another state: the team checks, then approves (their jobs move with them) or declines with a reason
function RiderMovesAdmin({ call }) {
  const [list, setList] = useState(null);
  const [act, setAct] = useState({ id: '', mode: '', note: '', busy: false, error: '' });
  const field = { background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.ink };
  const load = useCallback(async () => {
    try { setList(await call('admin_rider_moves', {})); }
    catch (e) { setList({ error: /admin_rider_moves|schema cache|function/i.test(e.message || '') ? 'Run rider-trips.sql in Supabase to turn this on.' : e.message }); }
  }, [call]);
  useEffect(() => { load(); }, [load]);
  const decide = async (m, approve) => {
    if (!approve && !act.note.trim()) { setAct((a) => ({ ...a, error: 'Say why, so the rider knows what to do.' })); return; }
    setAct((a) => ({ ...a, busy: true, error: '' }));
    try { await call('admin_rider_move_decide', { p_id: m.id, p_approve: approve, p_note: act.note.trim() }); setAct({ id: '', mode: '', note: '', busy: false, error: '' }); load(); }
    catch (e) { setAct((a) => ({ ...a, busy: false, error: e.message })); }
  };
  if (list === null) return <div className="py-10 flex justify-center"><Loader2 size={20} className="animate-spin" style={{ color: C.inkFaint }} /></div>;
  if (list.error) return <div className="rounded-2xl px-4 py-3 text-[13px]" style={{ background: C.copperSoft, color: C.copper }}>{list.error}</div>;
  if (!list.length) return <div className="rounded-2xl px-4 py-8 text-center text-[13px]" style={{ background: C.card, border: `1px solid ${C.line}`, color: C.inkFaint }}>No riders waiting to move. When a rider taps "I've moved", it shows here.</div>;
  return (
    <div className="space-y-3">
      <div className="text-[12.5px] leading-relaxed" style={{ color: C.inkDim }}>The rider's guarantor and checks were done for the old place. Call them (and the guarantor if needed) before approving. Approving moves their areas and switches "Taking jobs" off until they open the app.</div>
      {list.map((m) => (
        <div key={m.id} className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold">{m.rider}</div>
              <div className="text-[12px]" style={{ color: C.inkFaint }}>{m.phone} · asked {new Date(m.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}</div>
            </div>
            {m.phone && <a href={`tel:${String(m.phone).replace(/[^0-9+]/g, '')}`} className="shrink-0 h-9 px-3 rounded-xl text-[12.5px] font-semibold flex items-center gap-1.5" style={{ border: `1px solid ${C.line}`, color: C.ink }}><Phone size={13} /> Call</a>}
          </div>
          <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <span style={{ color: C.inkFaint }}>From</span><span>{m.from_lga}, {m.from_state}</span>
            <span style={{ color: C.inkFaint }}>To</span><span className="font-semibold">{m.to_lga}, {m.to_state}</span>
            <span style={{ color: C.inkFaint }}>Areas</span><span>{(m.to_areas || []).join(', ')}</span>
            <span style={{ color: C.inkFaint }}>Address</span><span>{m.new_address}</span>
            {m.note && <><span style={{ color: C.inkFaint }}>Note</span><span>{m.note}</span></>}
          </div>
          {m.active_jobs > 0 && <div className="mt-2 text-[12px] font-semibold" style={{ color: C.copper }}>On a delivery now. Approve once it's finished.</div>}
          {act.id === m.id && act.mode === 'decline' ? (
            <div className="mt-3">
              <textarea rows={2} value={act.note} onChange={(e) => setAct({ ...act, note: e.target.value, error: '' })} placeholder="Why? The rider sees this." className="w-full rounded-xl px-3.5 py-2.5 text-[13px] outline-none resize-none" style={field} />
              {act.error && <div className="mt-2 text-[12.5px]" style={{ color: C.rust }}>{act.error}</div>}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => setAct({ id: '', mode: '', note: '', busy: false, error: '' })} className="h-10 rounded-xl text-[13px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>Back</button>
                <button onClick={() => decide(m, false)} disabled={act.busy} className="h-10 rounded-xl text-[13px] font-semibold" style={{ background: C.rustSoft, color: C.rust }}>Decline</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setAct({ id: m.id, mode: 'decline', note: '', busy: false, error: '' })} className="h-10 rounded-xl text-[13px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.rust }}>Decline</button>
              <button onClick={() => { setAct({ id: m.id, mode: 'approve', note: '', busy: false, error: '' }); decide(m, true); }} disabled={act.busy || m.active_jobs > 0} className="h-10 rounded-xl text-[13px] font-bold" style={{ background: C.sageFill, color: C.onAccent, opacity: m.active_jobs > 0 ? 0.5 : 1 }}>Approve move</button>
            </div>
          )}
          {act.id === m.id && act.mode === 'approve' && act.error && <div className="mt-2 text-[12.5px]" style={{ color: C.rust }}>{act.error}</div>}
        </div>
      ))}
    </div>
  );
}

// The team changes an approved rider's areas (after a call), with a note that goes into the rider's history
function RiderAreasEditor({ call, r, onDone, onCancel }) {
  const [st, setSt] = useState(r.state || '');
  const [lga, setLga] = useState(r.lga || '');
  const [areas, setAreas] = useState(r.areas || []);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const field = { background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.ink };
  const save = async () => {
    setBusy(true); setErr('');
    try { await call('admin_rider_set_areas', { p_rider: r.id, p_state: st, p_lga: lga, p_areas: areas, p_note: note.trim() }); onDone(); }
    catch (e) { setErr(/admin_rider_set_areas|schema cache/i.test(e.message || '') ? 'Run rider-trips.sql in Supabase first.' : e.message); setBusy(false); }
  };
  return (
    <div className="mt-4 rounded-2xl p-3.5" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
      <div className="text-[13px] font-semibold mb-2">Change where {String(r.full_name || '').split(' ')[0]} rides</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <BrandSelect value={st} onChange={(e) => { setSt(e.target.value); setLga(''); setAreas([]); }} aria-label="State" className="w-full min-w-0 rounded-xl px-3 py-2.5 text-[13px] outline-none" style={field}>
          {NG_STATES.map((x) => <option key={x} value={x}>{x}</option>)}
        </BrandSelect>
        <BrandSelect value={lga} onChange={(e) => { setLga(e.target.value); if (!areas.length) setAreas([e.target.value]); }} aria-label="Home area" className="w-full min-w-0 rounded-xl px-3 py-2.5 text-[13px] outline-none" style={field}>
          <option value="">Home area…</option>
          {(NG_LGAS[st] || []).map((l) => <option key={l} value={l}>{l}</option>)}
        </BrandSelect>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {(NG_LGAS[st] || []).map((l) => <button key={l} type="button" aria-pressed={areas.includes(l)} onClick={() => setAreas(areas.includes(l) ? areas.filter((x) => x !== l) : areas.length >= 12 ? areas : [...areas, l])} className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold" style={areas.includes(l) ? { background: C.copperFill, color: C.onAccent } : { background: C.card, color: C.inkDim, border: `1px solid ${C.line}` }}>{l}</button>)}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Why? e.g. Rider called: moved to Aba" className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none mb-2" style={field} />
      {st !== r.state && <div className="text-[12px] mb-2" style={{ color: C.copper }}>A new state: check the guarantor still works for them before saving.</div>}
      {err && <div className="text-[12.5px] mb-2" style={{ color: C.rust }}>{err}</div>}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="h-10 rounded-xl text-[13px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>Cancel</button>
        <button onClick={save} disabled={busy || !lga || !areas.length || !note.trim()} className="h-10 rounded-xl text-[13px] font-bold" style={{ background: C.sageFill, color: C.onAccent, opacity: busy || !lga || !areas.length || !note.trim() ? 0.5 : 1 }}>Save areas</button>
      </div>
    </div>
  );
}
// The team's view of delivery jobs: find the ones in trouble, see every step, and step in
const JOB_STATUS = { open: ['Waiting for a rider', 'copper'], taken: ['Rider on the way', 'sage'], picked_up: ['Out for delivery', 'sage'], delivered: ['Delivered', 'sage'], cancelled: ['Cancelled', 'rust'], expired: ['No rider took it', 'faint'] };
const JOB_STEP = { posted: 'Business posted the job', taken: 'Rider took it', picked_up: 'Picked up (code matched)', delivered: 'Delivered (code matched)', released: 'Given back to other riders', wrong_code: 'Wrong code entered', locked: 'Locked after 5 wrong codes', new_codes: 'New codes sent', cancelled: 'Cancelled', paid: 'Business marked the rider paid', got_paid: 'Rider confirmed the money arrived', note: 'Team note' };
function RiderJobsAdmin({ call }) {
  const [counts, setCounts] = useState(null);
  const [filter, setFilter] = useState('live');
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [act, setAct] = useState({ mode: '', note: '', busy: false, error: '' });
  const field = { background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.ink };
  const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '');
  const tone = (t) => ({ copper: [C.copperSoft, C.copper], sage: [C.sageSoft, C.sage], rust: [C.rustSoft, C.rust], faint: [C.surfaceRaised, C.inkFaint] }[t] || [C.surfaceRaised, C.inkDim]);
  const loadCounts = useCallback(() => call('admin_rider_job_counts', {}).then(setCounts).catch(() => {}), [call]);
  const loadList = useCallback(async () => {
    try { setList(await call('admin_rider_jobs', { p_filter: filter, p_search: q || null })); }
    catch (e) { setList({ error: /admin_rider_job|schema cache|function/i.test(e.message || '') ? 'Run admin-rider-jobs.sql in Supabase to turn this on.' : e.message }); }
  }, [call, filter, q]);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { setList(null); const t = setTimeout(loadList, q ? 300 : 0); return () => clearTimeout(t); }, [loadList]);
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === 'visible' && !open) { loadCounts(); loadList(); } }, 30000); return () => clearInterval(t); }, [loadCounts, loadList, open]);
  const openJob = async (id) => { setAct({ mode: '', note: '', busy: false, error: '' }); try { setOpen(await call('admin_rider_job', { p_id: id })); window.scrollTo({ top: 0 }); } catch (e) { brandAlert(e.message); } };
  const runAct = async (mode) => {
    if (act.busy) return;
    setAct((a) => ({ ...a, busy: true, error: '' }));
    try { const r = await call('admin_rider_job_act', { p_id: open.id, p_action: mode, p_note: act.note }); setOpen(r); setAct({ mode: '', note: '', busy: false, error: '' }); loadCounts(); loadList(); }
    catch (e) { setAct((a) => ({ ...a, busy: false, error: e.message })); }
  };
  const badge = (status) => { const [l, t] = JOB_STATUS[status] || [status, 'faint']; const [bg, fg] = tone(t); return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ background: bg, color: fg }}>{l}</span>; };

  // ---------- One job ----------
  if (open) {
    const j = open;
    const can = { new_codes: ['taken', 'picked_up'].includes(j.status), release: j.status === 'taken', cancel: ['open', 'taken', 'picked_up'].includes(j.status) };
    const acts = [
      can.new_codes && ['new_codes', KeyRound, 'Send new codes', 'Unlocks the job and gives the business new pick-up and delivery codes. Use when codes were lost or the job is locked.', false],
      can.release && ['release', RotateCcw, 'Give to other riders', 'Takes the job from this rider and opens it to nearby riders again, with new codes.', true],
      can.cancel && ['cancel', Ban, 'Cancel the job', j.status === 'picked_up' ? 'The rider has the package. Agree with the business and rider what happens to it first.' : 'The business and the rider are told.', true],
      ['note', StickyNote, 'Add a team note', 'Only the Xorla team sees it.', true],
    ].filter(Boolean);
    const row = (l, v) => v ? <div className="flex justify-between gap-4 py-1.5 text-[13px]" style={{ borderTop: `1px solid ${C.line}` }}><span style={{ color: C.inkFaint }}>{l}</span><span className="text-right min-w-0 break-words" style={{ color: C.ink }}>{v}</span></div> : null;
    return (
      <div className="max-w-3xl">
        <button onClick={() => { setOpen(null); loadList(); }} className="flex items-center gap-1 text-[13px] font-semibold mb-3" style={{ color: C.copper }}><ChevronLeft size={16} /> All jobs</button>
        <div className="rounded-2xl p-4 mb-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><div className="text-[17px] font-bold">{j.business} → {j.customer_name || 'customer'}</div><div className="text-[12.5px] mt-0.5" style={{ color: C.inkFaint }}>{fmt(j.fee)} · {j.pay_how === 'cash_pickup' ? 'cash at pick-up' : 'transfer'} · posted {when(j.created_at)}{j.posted_by_name ? ` by ${j.posted_by_name}` : ''}</div></div>
            {badge(j.status)}
          </div>
          {j.problems?.length > 0 && <div className="mt-3 rounded-xl px-3 py-2.5 text-[12.5px] space-y-0.5" style={{ background: C.rustSoft, color: C.rust }}>{j.problems.map((p) => <div key={p} className="flex items-center gap-1.5 font-semibold"><AlertCircle size={13} className="shrink-0" />{p}</div>)}</div>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <div className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: C.inkFaint }}>Pick-up</div>
            {row('From', j.pickup_name)}{row('Address', j.pickup_address)}{row('Area', [j.pickup_lga, j.pickup_state].filter(Boolean).join(', '))}
            {row('Phone', j.pickup_phone || j.business_phone ? <a href={`tel:${String(j.pickup_phone || j.business_phone).replace(/[^0-9+]/g, '')}`} style={{ color: C.copper }}>{j.pickup_phone || j.business_phone}</a> : null)}
            {row('Package', j.package)}{row('Note', j.note)}
          </div>
          <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <div className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: C.inkFaint }}>Delivery</div>
            {row('To', j.customer_name)}{row('Address', j.dropoff_address)}{row('Area', j.dropoff_area)}
            {row('Phone', j.customer_phone ? <a href={`tel:${String(j.customer_phone).replace(/[^0-9+]/g, '')}`} style={{ color: C.copper }}>{j.customer_phone}</a> : null)}
            {row('Rider', j.rider ? `${j.rider.name}${j.rider.vehicle ? ` · ${j.rider.vehicle}` : ''}${j.rider.plate ? ` · ${j.rider.plate}` : ''}` : 'None yet')}
            {row('Rider phone', j.rider?.phone ? <a href={`tel:${String(j.rider.phone).replace(/[^0-9+]/g, '')}`} style={{ color: C.copper }}>{j.rider.phone}</a> : null)}
            {row('Paid', j.paid_at ? `${when(j.paid_at)} by ${j.paid_by_name || 'the business'} (${j.paid_how || ''})${j.rider_confirmed_paid_at ? ' · rider confirmed' : ' · rider hasn\'t confirmed'}` : j.status === 'delivered' ? 'Not yet' : null)}
            {row('Wrong codes', j.code_tries ? `${j.code_tries} of 5${j.locked ? ' · locked' : ''}` : null)}
          </div>
        </div>
        <div className="rounded-2xl p-4 mb-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: C.inkFaint }}>What happened</div>
          <ol className="space-y-2">
            {(j.events || []).map((e, i) => (
              <li key={i} className="flex gap-3 text-[13px]">
                <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: e.who === 'xorla' ? C.copperFill : ['locked', 'wrong_code', 'cancelled'].includes(e.action) ? C.rustFill : C.sageFill }} />
                <span className="min-w-0"><span className="font-semibold">{JOB_STEP[e.action] || e.action}</span><span style={{ color: C.inkFaint }}> · {e.who === 'xorla' ? 'Xorla team' : e.who} · {when(e.at)}</span>{e.note && !['taken'].includes(e.action) && <span className="block break-words" style={{ color: C.inkDim }}>{e.note === 'pickup' ? 'At pick-up' : e.note === 'deliver' ? 'At delivery' : e.note === 'paid_cash' ? 'Cash' : e.note === 'paid_transfer' ? 'Transfer' : e.action === 'posted' ? `By ${e.note}` : e.note}</span>}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: C.inkFaint }}>Step in</div>
          {!act.mode ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {acts.map(([k, Ic, l, d]) => (
                <button key={k} onClick={() => setAct({ mode: k, note: '', busy: false, error: '' })} className="text-left rounded-xl p-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                  <span className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: k === 'cancel' ? C.rust : C.ink }}><Ic size={15} />{l}</span>
                  <span className="block text-[12px] mt-1 leading-snug" style={{ color: C.inkFaint }}>{d}</span>
                </button>
              ))}
            </div>
          ) : (() => {
            const [, Ic, l, d, needNote] = acts.find((a) => a[0] === act.mode) || [];
            return (
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold mb-1">{Ic && <Ic size={15} />}{l}</div>
                <div className="text-[12.5px] mb-2.5" style={{ color: C.inkFaint }}>{d}</div>
                <textarea rows={2} value={act.note} onChange={(e) => setAct({ ...act, note: e.target.value, error: '' })} placeholder={needNote ? 'Why? (the business and rider see this, except for team notes)' : 'Note (optional)'} className="w-full rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none resize-none" style={field} />
                {act.error && <div className="mt-2 rounded-xl px-3 py-2 text-[12.5px]" style={{ background: C.rustSoft, color: C.rust }}>{act.error}</div>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setAct({ mode: '', note: '', busy: false, error: '' })} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}>Back</button>
                  <button onClick={() => runAct(act.mode)} disabled={act.busy || (needNote && !act.note.trim())} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold" style={{ background: act.mode === 'cancel' ? C.rustFill : C.copperFill, color: C.onAccent, opacity: act.busy || (needNote && !act.note.trim()) ? 0.5 : 1 }}>{act.busy ? 'Saving…' : l}</button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ---------- The list ----------
  const filters = [['live', 'Live', counts?.live], ['problems', 'Needs a look', counts?.problems], ['delivered', 'Delivered'], ['closed', 'Cancelled or expired'], ['all', 'All']];
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[['Live now', counts?.live, C.sage, Truck], ['Needs a look', counts?.problems, counts?.problems ? C.rust : C.inkFaint, AlertCircle], ['Delivered today', counts?.delivered_today, C.sage, Check], ['Rider fees today', counts ? fmt(counts.fees_today) : null, C.copper, Wallet]].map(([l, v, col, Ic]) => (
          <div key={l} className="rounded-2xl px-4 py-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: C.inkFaint }}><Ic size={13} style={{ color: col }} />{l}</div>
            <div className="text-[22px] font-bold cx-mono mt-0.5" style={{ color: v ? col : C.inkFaint }}>{v ?? '–'}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {filters.map(([k, l, n]) => (
          <button key={k} onClick={() => setFilter(k)} className="px-3 py-1.5 rounded-full text-[12.5px] font-semibold" style={filter === k ? { background: C.copperFill, color: C.onAccent } : { background: C.surfaceRaised, color: C.inkDim, border: `1px solid ${C.line}` }}>{l}{n ? ` · ${n}` : ''}</button>
        ))}
      </div>
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.inkFaint }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business, rider, customer or phone" className="w-full rounded-xl pl-9 pr-3 py-2.5 text-[13.5px] outline-none" style={field} />
      </div>
      {list === null ? <div className="flex items-center gap-2 text-[13px] py-6" style={{ color: C.inkFaint }}><Loader2 size={15} className="animate-spin" /> Loading…</div>
        : list.error ? <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: C.rustSoft, color: C.rust }}>{list.error}</div>
        : !list.length ? <div className="rounded-2xl p-6 text-center text-[13px]" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.inkFaint }}>{filter === 'problems' ? 'Nothing needs a look. Every job is moving.' : 'No jobs here.'}</div>
        : (
          <div className="space-y-2">
            {list.map((j) => (
              <button key={j.id} onClick={() => openJob(j.id)} className="w-full text-left rounded-2xl p-3.5" style={{ background: C.surface, border: `1px solid ${j.problems?.length ? 'rgba(226,98,75,0.45)' : C.line}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold truncate">{j.business} → {j.customer_name || 'customer'}</div>
                    <div className="text-[12px] mt-0.5 leading-snug" style={{ color: C.inkFaint }}><MapPin size={11} className="inline -mt-0.5 mr-1" />{j.pickup_lga}{j.dropoff_area ? ` → ${j.dropoff_area}` : ''} · {fmt(j.fee)} · {j.rider ? `${j.rider}` : 'no rider yet'}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">{badge(j.status)}<span className="text-[11px]" style={{ color: C.inkFaint }}>{when(j.delivered_at || j.cancelled_at || j.picked_at || j.taken_at || j.created_at)}</span></div>
                </div>
                {j.problems?.length > 0 && <div className="mt-2 text-[12px] font-semibold flex items-center gap-1.5" style={{ color: C.rust }}><AlertCircle size={12} />{j.problems.join(' · ')}</div>}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}

function RiderApplications({ call, token, isFounder = true, initialId = null, onCounts }) {
  const [counts, setCounts] = useState(null);
  const [tab, setTab] = useState('submitted');
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [thumbs, setThumbs] = useState({});
  const [open, setOpen] = useState(null);
  const [pics, setPics] = useState({});
  const [act, setAct] = useState({ mode: '', note: '', busy: false, error: '' });
  const [zoom, setZoom] = useState('');
  const [nin, setNin] = useState({ busy: false, error: '' });
  const [editAreas, setEditAreas] = useState(false);
  const field = { background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.ink };
  // Ask NIMC (through Dojah, in the billing function) whether the NIN is real, whose it is, and whether the selfie matches its photo
  const checkNin = async () => {
    if (!open) return;
    setNin({ busy: true, error: '' });
    try { await riderBilling(token(), 'admin_rider_nin', { rider_id: open.id }); const r = await call('admin_rider', { p_id: open.id }); setOpen(r); setNin({ busy: false, error: '' }); }
    catch (e) { setNin({ busy: false, error: e.message }); }
  };
  const loadCounts = useCallback(() => call('admin_rider_counts', {}).then((c) => { setCounts(c); onCounts && onCounts(c); }).catch(() => {}), [call, onCounts]);
  const loadList = useCallback(async () => { try { setList(await call('admin_riders', { p_status: tab, p_search: q || null })); } catch (e) { setList([]); } }, [call, tab, q]);
  useEffect(() => { loadList(); }, [tab]);
  useEffect(() => { const t = setTimeout(loadList, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { loadCounts(); if (initialId) show(initialId); }, []);
  // Stay up to date on its own while on screen
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') { loadCounts(); loadList(); } };
    const t = setInterval(tick, 30000); document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [loadCounts, loadList]);
  // Selfie thumbnails for the list
  useEffect(() => {
    (list || []).forEach((r) => { if (r.selfie_doc && !thumbs[r.id]) vaultFileUrl(token(), 'rider-docs', r.selfie_doc).then((u) => setThumbs((x) => ({ ...x, [r.id]: u }))).catch(() => {}); });
  }, [list]);
  const show = async (id) => {
    setAct({ mode: '', note: '', busy: false, error: '' }); setPics({}); setNin({ busy: false, error: '' });
    try {
      const r = await call('admin_rider', { p_id: id }); setOpen(r);
      ['id_doc', 'selfie_doc'].forEach((k) => { if (r[k]) vaultFileUrl(token(), 'rider-docs', r[k]).then((u) => setPics((p) => ({ ...p, [k]: u }))).catch(() => {}); });
    } catch (e) { brandAlert(e.message); }
  };
  const tick = async (k, v) => {
    setOpen((r) => ({ ...r, checks: { ...(r.checks || {}), [k]: v } }));
    try { const r = await call('admin_rider_review', { p_id: open.id, p_action: 'checks', p_checks: { [k]: v } }); setOpen(r); } catch (e) { brandAlert(e.message); }
  };
  const wa = (r, kind, note) => {
    const first = String(r.full_name || '').split(' ')[0];
    const text = kind === 'approve' ? `Hello ${first}, this is the Xorla team. Good news: your rider application is approved! Your Xorla rider pass is now verified. We'll message you as soon as delivery jobs open in your area. Log in any time at ${window.location.origin}/ride`
      : kind === 'fix' ? `Hello ${first}, this is the Xorla team. We checked your rider application and need one thing fixed: ${note} Please log in at ${window.location.origin}/ride to fix it and send it again.`
      : kind === 'reject' ? `Hello ${first}, this is the Xorla team. Thank you for applying to ride with Xorla. We're sorry, we can't approve your application: ${note}`
      : kind === 'suspend' ? `Hello ${first}, this is the Xorla team. Your rider account is paused while we look into something: ${note} We'll be in touch.`
      : `Hello ${first}, this is the Xorla team. Your rider account is active again.`;
    return `https://wa.me/${toWhatsAppNumber(r.phone)}?text=${encodeURIComponent(text)}`;
  };
  const decide = async (mode) => {
    const note = act.note.trim();
    if (['fix', 'reject', 'suspend'].includes(mode) && !note) { setAct((a) => ({ ...a, error: mode === 'fix' ? 'Say what they need to fix.' : 'Give a short reason.' })); return; }
    setAct((a) => ({ ...a, busy: true, error: '' }));
    try {
      const r = await call('admin_rider_review', { p_id: open.id, p_action: mode, p_note: note || null });
      setOpen(r); setAct({ mode: '', note: '', busy: false, error: '' }); loadList(); loadCounts();
      if (r.phone) offerWhatsApp(r, mode, note);
    } catch (e) { setAct((a) => ({ ...a, busy: false, error: e.message })); }
  };
  const offerWhatsApp = async (r, mode, note) => {
    const ok = await brandConfirm(`Send ${String(r.full_name).split(' ')[0]} a WhatsApp message to let them know?`, { title: mode === 'approve' ? 'Approved' : mode === 'fix' ? 'Sent back for a fix' : mode === 'reject' ? 'Turned down' : mode === 'suspend' ? 'Paused' : 'Active again', confirm: 'Open WhatsApp', cancel: 'Not now' });
    if (ok) window.open(wa(r, mode, note), '_blank');
  };

  // ---------- One application ----------
  if (open) {
    const r = open; const checks = r.checks || {}; const allChecked = RIDER_CHECKS.every(([k]) => checks[k]);
    const st = RIDER_ADMIN_STATUS[r.status] || ['', C.inkDim];
    const veh = RIDER_VEHICLES.find(([k]) => k === r.vehicle);
    const idType = (RIDER_ID_TYPES.find(([k]) => k === r.id_type) || [])[1];
    const bankClose = namesClose(r.account_name, r.full_name);
    const row = (l, v, mono) => <div className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-[12.5px] shrink-0" style={{ color: C.inkFaint }}>{l}</span><span className={`text-[13.5px] text-right font-medium break-words min-w-0 ${mono ? 'cx-mono' : ''}`}>{v || '—'}</span></div>;
    const canDecide = r.status === 'submitted';
    return (
      <div className="max-w-5xl">
        <button onClick={() => { setOpen(null); loadList(); }} className="flex items-center gap-1 text-[13px] font-semibold mb-4" style={{ color: C.inkDim }}><ChevronLeft size={16} /> All riders</button>
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: C.surfaceRaised }}>{pics.selfie_doc ? <img src={pics.selfie_doc} alt="" className="w-full h-full object-cover" /> : <span className="text-[18px] font-bold" style={{ color: C.inkDim }}>{riderInitials(r.full_name)}</span>}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[22px] font-extrabold leading-tight" style={{ letterSpacing: '-0.02em' }}>{r.full_name || 'No name yet'}</div>
            <div className="text-[13px] mt-0.5" style={{ color: C.inkDim }}>{veh ? veh[1] : '—'}{r.plate_number ? ` · ${r.plate_number}` : ''} · {[r.lga, r.state].filter(Boolean).join(', ')}{r.age ? ` · ${r.age} years old` : ''}</div>
          </div>
          <span className="px-3 py-1.5 rounded-full text-[12px] font-bold" style={{ background: `${st[1]}22`, color: st[1] }}>{st[0]}</span>
        </div>
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4 items-start">
          <div className="space-y-4 min-w-0">
            {/* Side by side: does the face match the ID? */}
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="text-[14px] font-semibold mb-3 flex items-center gap-2"><ScanFace size={16} style={{ color: C.copper }} /> Does the face match the ID?</div>
              <div className="grid grid-cols-2 gap-3">
                {[['selfie_doc', 'Selfie'], ['id_doc', `ID${idType ? ` · ${idType}` : ''}`]].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => pics[k] && setZoom(pics[k])} className="rounded-xl overflow-hidden text-left" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
                    <div className="aspect-[4/5] flex items-center justify-center">{pics[k] ? <img src={pics[k]} alt={l} className={`w-full h-full ${k === 'id_doc' ? 'object-contain' : 'object-cover'}`} /> : r[k] ? <Loader2 size={18} className="animate-spin" style={{ color: C.inkFaint }} /> : <span className="text-[12px]" style={{ color: C.inkFaint }}>Not added</span>}</div>
                    <div className="px-3 py-2 text-[12px] font-semibold flex items-center justify-between gap-2" style={{ color: C.inkDim }}>
                      <span className="flex items-center gap-1.5 min-w-0">{l}{k === 'selfie_doc' && r.selfie_doc && (/selfie-live-/.test(r.selfie_doc)
                        ? <span className="px-1.5 py-0.5 rounded-md text-[10.5px] font-bold" style={{ background: C.sageSoft, color: C.sage }}>Live</span>
                        : <span className="px-1.5 py-0.5 rounded-md text-[10.5px] font-bold" style={{ background: C.copperSoft, color: C.copper }}>Uploaded</span>)}</span>
                      {pics[k] && <span style={{ color: C.copper }}>Open</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {/* NIN: confirmed with NIMC, and the selfie compared with the NIN photo */}
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="text-[14px] font-semibold mb-1 flex items-center gap-2"><BadgeCheck size={16} style={{ color: C.copper }} /> NIN check with NIMC</div>
              {r.id_type !== 'nin' ? (
                <div className="text-[12.5px] leading-relaxed" style={{ color: C.inkDim }}>This rider used {idType ? `a ${idType.toLowerCase()}` : 'another ID'}. Only a NIN can be checked automatically, so check the ID photo by eye. You can ask them for their NIN instead.</div>
              ) : (() => {
                const k = r.nin_check; const used = r.nin_checks_used || 0;
                const tone = !k ? C.inkDim : k.status === 'match' ? C.sage : k.status === 'mismatch' ? C.copper : C.rust;
                const yes = (ok, text) => <span style={{ color: ok === false ? C.rust : ok ? C.sage : C.inkDim }}>{ok === false ? <X size={13} className="inline -mt-0.5 mr-1" /> : ok ? <Check size={13} className="inline -mt-0.5 mr-1" /> : null}{text}</span>;
                return (
                  <>
                    {!k && <div className="text-[12.5px] leading-relaxed mb-3" style={{ color: C.inkDim }}>Confirms the NIN is real, shows the name and date of birth NIMC holds, and compares the selfie with the photo on the NIN. Each check is paid from the Dojah wallet.</div>}
                    {k && (
                      <div className="mt-2 mb-3">
                        <div className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold flex items-start gap-2" style={{ background: `${tone === C.sage ? C.sageSoft : tone === C.copper ? C.copperSoft : C.rustSoft}`, color: tone }}>
                          {k.status === 'match' ? <ShieldCheck size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                          <span>{k.status === 'match' ? 'NIN confirmed and the face matches' : k.status === 'mismatch' ? 'NIN found, but something doesn\'t match' : 'NIMC has no record of this NIN'}</span>
                        </div>
                        {k.status !== 'not_found' && <>
                          {row('Name on the NIN', yes(k.name_match === 'full' ? true : k.name_match === 'none' ? false : null, `${k.nimc_name || '—'}${k.name_match === 'partial' ? ' (part match)' : ''}`))}
                          {row('Date of birth on the NIN', yes(k.dob_match, k.nimc_dob ? new Date(k.nimc_dob + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'))}
                          <div className="py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
                            <div className="flex items-center justify-between text-[12.5px] mb-1.5"><span style={{ color: C.inkFaint }}>Selfie vs NIN photo{k.live === false ? ' (uploaded photo)' : ''}</span><span className="text-[13.5px] font-bold" style={{ color: k.face_match ? C.sage : C.rust }}>{k.face_score != null ? `${k.face_score}%` : '—'} {k.face_match ? 'match' : 'no match'}</span></div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.surfaceRaised }}><div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, k.face_score || 0))}%`, background: k.face_match ? C.sageFill : C.rustFill }} /></div>
                          </div>
                        </>}
                        <div className="text-[11.5px] mt-2" style={{ color: C.inkFaint }}>Checked {riderAgo(k.at)}{k.by ? ` by ${k.by}` : ''}</div>
                      </div>
                    )}
                    {nin.error && <div className="rounded-xl px-3 py-2 mb-2.5 text-[12.5px]" style={{ background: C.rustSoft, color: C.rust }}>{nin.error}</div>}
                    <button onClick={checkNin} disabled={nin.busy} className="w-full h-10 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5" style={k ? { border: `1px solid ${C.lineStrong}`, color: C.ink } : { background: C.copperFill, color: C.onAccent }}>
                      {nin.busy ? <><Loader2 size={15} className="animate-spin" /> Checking with NIMC…</> : k ? `Check again (${used} of 3 used)` : <><BadgeCheck size={15} /> Check NIN</>}
                    </button>
                  </>
                );
              })()}
            </div>
            <div className="rounded-2xl px-4 py-2" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="text-[14px] font-semibold pt-2 pb-1">Details</div>
              {row('Phone', r.phone ? formatPhoneDisplay(r.phone) : '')}
              {row('Email', r.email)}
              {row('Date of birth', r.date_of_birth ? `${new Date(r.date_of_birth + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (${r.age})` : '')}
              {row('Home address', r.home_address)}
              {row(idType || 'ID', r.id_number, true)}
              {row('Delivers in', (r.areas || []).join(', '))}
              {row('Applied', r.submitted_at ? `${new Date(r.submitted_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })} · ${riderAgo(r.submitted_at)}` : 'Not sent yet')}
            </div>
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="text-[14px] font-semibold mb-2 flex items-center gap-2"><Users size={16} style={{ color: C.copper }} /> Guarantor</div>
              <div className="text-[15px] font-semibold">{r.guarantor_name || '—'}</div>
              <div className="text-[12.5px] mt-0.5" style={{ color: C.inkDim }}>{r.guarantor_relationship}{r.guarantor_address ? ` · ${r.guarantor_address}` : ''}</div>
              {r.guarantor_phone && <div className="flex gap-2 mt-3">
                <a href={`tel:${r.guarantor_phone}`} className="flex-1 h-10 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5" style={{ background: C.sageFill, color: C.onAccent }}><Phone size={14} /> Call {formatPhoneDisplay(r.guarantor_phone)}</a>
                <a href={`https://wa.me/${toWhatsAppNumber(r.guarantor_phone)}?text=${encodeURIComponent(`Hello ${String(r.guarantor_name || '').split(' ')[0]}, this is the Xorla team. ${r.full_name} has applied to deliver for businesses with Xorla, and named you as their guarantor. Do you know them, and do you agree to stand for them?`)}`} target="_blank" rel="noopener noreferrer" className="h-10 px-3.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5" style={{ color: C.sage, border: '1px solid rgba(31,217,196,0.35)' }}><MessageCircle size={14} /> WhatsApp</a>
              </div>}
            </div>
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="text-[14px] font-semibold mb-2 flex items-center gap-2"><Landmark size={16} style={{ color: C.copper }} /> Bank account</div>
              {r.account_number ? <>
                <div className="text-[15px] font-semibold break-words">{r.account_name}</div>
                <div className="text-[12.5px] mt-0.5" style={{ color: C.inkDim }}>{r.bank_name} · <span className="cx-mono">{r.account_number}</span></div>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  <span className="px-2 py-1 rounded-lg text-[11.5px] font-semibold flex items-center gap-1" style={{ background: r.bank_verified ? C.sageSoft : C.copperSoft, color: r.bank_verified ? C.sage : C.copper }}>{r.bank_verified ? <><BadgeCheck size={12} /> Name from the bank</> : 'Not checked with the bank (test mode)'}</span>
                  <span className="px-2 py-1 rounded-lg text-[11.5px] font-semibold" style={{ background: bankClose >= 0.66 ? C.sageSoft : C.rustSoft, color: bankClose >= 0.66 ? C.sage : C.rust }}>{bankClose >= 0.66 ? 'Matches the rider\'s name' : bankClose > 0 ? 'Only partly matches the rider\'s name' : 'Different from the rider\'s name'}</span>
                </div>
              </> : <div className="text-[13px]" style={{ color: C.inkFaint }}>Not added yet.</div>}
            </div>
          </div>
          <div className="space-y-4 lg:sticky lg:top-24 min-w-0">
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${allChecked && canDecide ? 'rgba(31,217,196,0.4)' : C.line}` }}>
              <div className="text-[14px] font-semibold mb-1">Checks</div>
              <div className="text-[12px] mb-3" style={{ color: C.inkFaint }}>Tick each one as you do it. All four are needed to approve.</div>
              <div className="space-y-2">
                {RIDER_CHECKS.map(([k, t, d]) => { const on = !!checks[k]; return (
                  <button key={k} type="button" disabled={!['submitted'].includes(r.status)} onClick={() => tick(k, !on)} className="w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left" style={{ background: on ? C.sageSoft : C.surfaceRaised, border: `1px solid ${on ? 'rgba(31,217,196,0.35)' : C.line}` }}>
                    <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: on ? C.sageFill : 'transparent', border: `1.5px solid ${on ? C.sage : C.inkFaint}` }}>{on && <Check size={13} style={{ color: C.onAccent }} />}</span>
                    <span><span className="block text-[13.5px] font-semibold">{t}</span><span className="block text-[11.5px]" style={{ color: C.inkFaint }}>{d}</span></span>
                  </button>
                ); })}
              </div>
              {canDecide && !act.mode && (
                <div className="mt-4 space-y-2">
                  <button onClick={() => decide('approve')} disabled={!allChecked || act.busy} className="w-full h-11 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2" style={{ background: allChecked ? C.sageFill : 'rgba(31,217,196,0.2)', color: allChecked ? C.onAccent : C.inkFaint }}><BadgeCheck size={16} /> Approve {String(r.full_name || '').split(' ')[0]}</button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setAct({ mode: 'fix', note: '', busy: false, error: '' })} className="h-10 rounded-xl text-[13px] font-semibold" style={{ color: C.copper, border: `1px solid ${C.line}` }}>Ask for a fix</button>
                    <button onClick={() => setAct({ mode: 'reject', note: '', busy: false, error: '' })} className="h-10 rounded-xl text-[13px] font-semibold" style={{ color: C.rust, border: `1px solid ${C.line}` }}>Turn down</button>
                  </div>
                </div>
              )}
              {r.status === 'approved' && !act.mode && (editAreas
                ? <RiderAreasEditor call={call} r={r} onCancel={() => setEditAreas(false)} onDone={() => { setEditAreas(false); show(r.id); }} />
                : <button onClick={() => setEditAreas(true)} className="mt-4 w-full h-10 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5" style={{ color: C.ink, border: `1px solid ${C.line}` }}><MapPin size={14} /> Change areas</button>)}
              {r.status === 'approved' && !act.mode && <button onClick={() => setAct({ mode: 'suspend', note: '', busy: false, error: '' })} className="mt-4 w-full h-10 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5" style={{ color: C.rust, border: `1px solid ${C.line}` }}><Lock size={14} /> Pause this rider</button>}
              {r.status === 'suspended' && isFounder && !act.mode && <button onClick={() => decide('reinstate')} className="mt-4 w-full h-10 rounded-xl text-[13px] font-semibold" style={{ background: C.sageFill, color: C.onAccent }}>Make active again</button>}
              {act.mode && (
                <div className="mt-4">
                  <div className="text-[13px] font-semibold mb-1.5">{act.mode === 'fix' ? 'What do they need to fix?' : act.mode === 'reject' ? 'Why are you turning them down?' : 'Why are you pausing them?'}</div>
                  {act.mode === 'fix' && <div className="flex flex-wrap gap-1.5 mb-2">{RIDER_FIX_SUGGEST.map((x) => <button key={x} type="button" onClick={() => setAct((a) => ({ ...a, note: x, error: '' }))} className="px-2.5 py-1.5 rounded-lg text-[11.5px] text-left" style={{ background: C.surfaceRaised, color: C.inkDim, border: `1px solid ${C.line}` }}>{x.split('.')[0]}</button>)}</div>}
                  <textarea rows={3} value={act.note} onChange={(e) => setAct({ ...act, note: e.target.value, error: '' })} placeholder={act.mode === 'fix' ? 'They see this, so write it to them.' : 'They see this.'} className="w-full rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none resize-none" style={field} />
                  {act.error && <div className="mt-2 rounded-xl px-3 py-2 text-[12.5px]" style={{ background: C.rustSoft, color: C.rust }}>{act.error}</div>}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button onClick={() => setAct({ mode: '', note: '', busy: false, error: '' })} className="h-10 rounded-xl text-[13px] font-semibold" style={{ color: C.inkDim, border: `1px solid ${C.line}` }}>Back</button>
                    <button onClick={() => decide(act.mode)} disabled={act.busy} className="h-10 rounded-xl text-[13px] font-bold" style={{ background: act.mode === 'fix' ? C.copperFill : C.rustFill, color: act.mode === 'fix' ? C.onAccent : '#fff', opacity: act.busy ? 0.6 : 1 }}>{act.busy ? 'Saving…' : act.mode === 'fix' ? 'Send back' : act.mode === 'reject' ? 'Turn down' : 'Pause'}</button>
                  </div>
                </div>
              )}
              {r.review_note && !act.mode && r.status !== 'submitted' && <div className="mt-3 rounded-xl px-3 py-2 text-[12.5px]" style={{ background: C.surfaceRaised, color: C.inkDim }}>Note to rider: {r.review_note}</div>}
              {r.phone && <a href={wa(r, r.status === 'approved' ? 'approve' : r.status === 'needs_fix' ? 'fix' : r.status === 'rejected' ? 'reject' : r.status === 'suspended' ? 'suspend' : 'approve', r.review_note || '')} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold" style={{ color: C.sage }}><MessageCircle size={13} /> WhatsApp {String(r.full_name || '').split(' ')[0]}</a>}
            </div>
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="text-[14px] font-semibold mb-3">History</div>
              <ol className="space-y-2.5">
                {(r.history || []).slice().reverse().map((h, i) => (
                  <li key={i} className="flex gap-2.5 text-[12.5px]">
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: h.by_team ? C.copperFill : C.sageFill }} />
                    <span className="min-w-0"><span className="font-semibold">{{ started: 'Started applying', submitted: 'Sent the application', reach_changed: 'Changed where they ride', move_requested: 'Asked to move to another state', move_approved: 'Move approved', move_declined: 'Move declined', areas_changed: 'Areas changed by the team', job_taken_back: 'A job was taken back by the team', job_released: 'Gave back a job', nin_checked: 'Checked the NIN with NIMC', resubmitted: 'Fixed it and sent it again', approve: 'Approved', fix: 'Sent back for a fix', reject: 'Turned down', suspend: 'Paused', reinstate: 'Made active again' }[h.action] || h.action}</span>{h.by_team && h.by_name ? <span style={{ color: C.inkFaint }}> · {h.by_name}</span> : null}
                      <span className="block" style={{ color: C.inkFaint }}>{new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                      {h.note && <span className="block mt-0.5" style={{ color: C.inkDim }}>"{h.note}"</span>}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
        {zoom && createPortal(<div className="fixed inset-0 z-[150] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setZoom('')}><img src={zoom} alt="" className="max-w-full max-h-full rounded-xl" /><button aria-label="Close" className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}><X size={18} /></button></div>, document.body)}
      </div>
    );
  }

  // ---------- The list ----------
  const tabs = [['submitted', 'To check', counts?.to_check], ['needs_fix', 'Waiting for a fix', counts?.needs_fix], ['approved', 'Approved', counts?.approved], ['suspended', 'Paused', counts?.suspended], ['draft', 'Still filling in', counts?.started]];
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[['To check', counts?.to_check, C.copper, Clock], ['Approved riders', counts?.approved, C.sage, BadgeCheck], ['Waiting for a fix', counts?.needs_fix, C.inkDim, Pencil], ['Still filling in', counts?.started, C.inkFaint, Bike]].map(([l, n, col, Ic]) => (
          <div key={l} className="rounded-2xl px-4 py-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: C.inkFaint }}><Ic size={13} style={{ color: col }} />{l}</div>
            <div className="text-[24px] font-bold cx-mono mt-0.5" style={{ color: n ? col : C.inkFaint }}>{n ?? '–'}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          {tabs.map(([k, l, n]) => <button key={k} onClick={() => setTab(k)} className="shrink-0 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap" style={tab === k ? { background: C.copperFill, color: C.onAccent } : { color: C.inkDim }}>{l}{n ? ` ${n}` : ''}</button>)}
        </div>
        <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.inkFaint }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or area" className="w-full rounded-xl pl-9 pr-3 py-2.5 text-[13.5px] outline-none" style={field} /></div>
      </div>
      {list === null ? <div className="py-12 flex justify-center"><Loader2 size={18} className="animate-spin" style={{ color: C.inkFaint }} /></div>
        : !list.length ? (
          <div className="rounded-2xl py-12 px-6 text-center" style={{ border: `1px dashed ${C.lineStrong}` }}>
            <Bike size={26} className="mx-auto" style={{ color: C.inkFaint }} />
            <div className="text-[14.5px] font-semibold mt-2">{tab === 'submitted' ? 'No applications waiting' : 'Nobody here'}</div>
            <div className="text-[12.5px] mt-1" style={{ color: C.inkFaint }}>Riders apply at <span className="cx-mono" style={{ color: C.inkDim }}>{typeof window !== 'undefined' ? window.location.host : ''}/ride</span>. Share the link with dispatch riders you trust.</div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2.5">
            {list.map((r) => { const st = RIDER_ADMIN_STATUS[r.status] || ['', C.inkDim]; const v = RIDER_VEHICLES.find(([k]) => k === r.vehicle); return (
              <button key={r.id} onClick={() => show(r.id)} className="rounded-2xl p-3.5 flex items-center gap-3 text-left transition-colors" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <span className="w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: C.surfaceRaised }}>{thumbs[r.id] ? <img src={thumbs[r.id]} alt="" className="w-full h-full object-cover" /> : <span className="text-[14px] font-bold" style={{ color: C.inkDim }}>{riderInitials(r.full_name)}</span>}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold truncate">{r.full_name || 'No name yet'}</span>
                  <span className="block text-[12px] truncate" style={{ color: C.inkDim }}>{v ? v[1] : '—'} · {r.lga || r.state || '—'}{(r.areas || []).length > 1 ? ` +${r.areas.length - 1}` : ''}</span>
                  <span className="block text-[11.5px]" style={{ color: C.inkFaint }}>{r.submitted_at ? `Sent ${riderAgo(r.submitted_at)}` : `Started ${riderAgo(r.created_at)}`}</span>
                </span>
                <span className="shrink-0 px-2 py-1 rounded-full text-[10.5px] font-bold" style={{ background: `${st[1]}22`, color: st[1] }}>{st[0]}</span>
              </button>
            ); })}
          </div>
        )}
    </div>
  );
}
export { AdminDashboard };
