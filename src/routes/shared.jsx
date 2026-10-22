// Xorla: shared screens (loaded only when needed). Shared code lives in ../App.jsx.
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Lock, Eye, Download, MessageCircle, Check, FileText, Send, AlertCircle, BadgeCheck, Upload } from 'lucide-react';
import { C, CAC_STATUS, CAC_SUGGEST, SB_KEY, SB_URL, VAULT_KINDS, VaultArt, XorlaMark, brandAlert, resizeImageToBlob, sbRpc, tint, toWhatsAppNumber, vaultExpiry, vaultFileUrl } from '../App.jsx';

// The page someone opens from a shared link (no login needed)
function VaultShared({ token }) {
  const [v, setV] = useState(undefined);
  const [thumbs, setThumbs] = useState({});
  useEffect(() => {
    document.title = 'Shared documents · Xorla';
    sbRpc('vault_open', SB_KEY, { p_token: token }).then((d) => setV(d || { state: 'missing' })).catch(() => setV({ state: 'error' }));
  }, [token]);
  useEffect(() => {
    if (v?.state !== 'ok') return;
    if (v.business) document.title = `${v.business} · Shared documents`;
    v.docs.filter((d) => d.file_path && d.file_type === 'image').forEach((d) => vaultFileUrl(SB_KEY, d.bucket, d.file_path).then((u) => setThumbs((t) => ({ ...t, [d.id]: u }))).catch(() => {}));
  }, [v]);
  const openDoc = async (d, download) => {
    const win = window.open('', '_blank');
    try { const u = await vaultFileUrl(SB_KEY, d.bucket, d.file_path, download ? `${d.title}.${d.file_type === 'pdf' ? 'pdf' : 'jpg'}` : false); if (win) win.location.href = u; else window.location.href = u; }
    catch (e) { if (win) win.close(); brandAlert(e.message); }
  };
  const shell = (body) => (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink, fontFamily: "'Poppins', 'Inter', system-ui, sans-serif" }}>
      <div className="max-w-xl mx-auto px-4 pb-16" style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        {body}
        <div className="mt-10 flex items-center justify-center gap-2 text-[12px]" style={{ color: C.inkFaint }}><XorlaMark size={16} /> Shared securely with Xorla</div>
      </div>
    </div>
  );
  if (v === undefined) return shell(<div className="py-24 flex justify-center"><Loader2 className="animate-spin" size={22} style={{ color: C.inkFaint }} /></div>);
  if (v.state !== 'ok') return shell(
    <div className="text-center py-20">
      <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.surfaceRaised }}><Lock size={24} style={{ color: C.inkFaint }} /></div>
      <div className="text-[19px] font-bold">{v.state === 'expired' ? 'This link has expired' : v.state === 'revoked' ? 'This link was stopped' : 'This link doesn\'t work'}</div>
      <div className="text-[13.5px] mt-2 leading-relaxed max-w-sm mx-auto" style={{ color: C.inkDim }}>{v.business ? `Ask ${v.business} to send you a new link.` : 'Check the link, or ask the business to send it again.'}</div>
    </div>
  );
  return shell(
    <>
      <div data-xt="dark" className="relative rounded-[24px] overflow-hidden mt-2" style={{ background: 'radial-gradient(120% 100% at 100% 0%, #22604F 0%, #133A32 45%, #0B221E 100%)', border: '1px solid rgba(var(--c-hi),0.08)' }}>
        <div className="relative p-5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: C.sage }}>Shared with you{v.label ? `, ${v.label}` : ''}</div>
            <div className="text-[22px] font-extrabold leading-tight mt-1.5" style={{ letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>{v.business}</div>
            <div className="text-[12.5px] mt-1.5" style={{ color: C.inkDim }}>{v.docs.length} document{v.docs.length === 1 ? '' : 's'} · link works until {new Date(v.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</div>
          </div>
          <div className="shrink-0 -mr-3 hidden min-[380px]:block"><VaultArt size={0.62} /></div>
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        {v.docs.map((d) => { const [kl, Ic, col] = VAULT_KINDS[d.kind] || VAULT_KINDS.other; const ex = vaultExpiry(d); return (
          <div key={d.id} className="rounded-2xl p-3.5" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-3">
              {thumbs[d.id] ? <button onClick={() => openDoc(d)} className="w-14 h-14 rounded-xl overflow-hidden shrink-0" style={{ border: `1px solid ${C.line}` }}><img src={thumbs[d.id]} alt="" className="w-full h-full object-cover" onError={() => setThumbs((t) => ({ ...t, [d.id]: '' }))} /></button>
                : <span className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint(col, 0.13) }}><Ic size={22} style={{ color: col }} /></span>}
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-semibold" style={{ overflowWrap: 'anywhere' }}>{d.title}</div>
                {kl !== d.title && <div className="text-[11.5px] mt-0.5" style={{ color: C.inkFaint }}>{kl}</div>}
                {d.number && <div className="text-[13px] font-semibold cx-mono mt-1">{d.number}</div>}
                {ex && <div className="text-[11.5px] mt-1 font-semibold" style={{ color: ex.tone }}>{ex.text}</div>}
              </div>
            </div>
            {d.file_path && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button onClick={() => openDoc(d)} className="h-10 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5" style={{ background: C.sageFill, color: C.onAccent }}><Eye size={15} /> View</button>
                <button onClick={() => openDoc(d, true)} className="h-10 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5" style={{ border: `1px solid ${C.line}`, color: C.ink }}><Download size={15} /> Download</button>
              </div>
            )}
          </div>
        ); })}
      </div>
      {v.phone && <a href={`https://wa.me/${toWhatsAppNumber(v.phone)}`} target="_blank" rel="noopener noreferrer" className="mt-4 w-full h-11 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2" style={{ border: `1px solid ${C.line}`, color: C.inkDim }}><MessageCircle size={15} /> Message {v.business}</a>}
    </>
  );
}

// ---------- The CAC agent's page: everything for one registration, and buttons to post updates ----------
async function cacAgentCall(body) {
  const res = await fetch(`${SB_URL}/functions/v1/cac-agent`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error) throw new Error(d.error || 'Something went wrong. Check your connection and try again.');
  return d;
}
function CacAgentPage({ token }) {
  const [v, setV] = useState(undefined);
  const [copied, setCopied] = useState('');
  const [act, setAct] = useState({ mode: '', message: '', bn: '', name: '', tin: '', cert: null, report: null, busy: false, error: '', done: '' });
  const load = useCallback(async () => {
    try { const d = await cacAgentCall({ action: 'open', token }); setV(d); if (d.request) setAct((a) => ({ ...a, name: a.name || d.request.registered_name || d.request.name_1 || '' })); }
    catch (e) { setV({ state: 'error', error: e.message }); }
  }, [token]);
  useEffect(() => { document.title = 'Business name registration · Xorla'; load(); }, [load]);
  const copy = async (text, key) => { try { await navigator.clipboard.writeText(String(text || '')); } catch (e) { /* older phones */ } setCopied(key); setTimeout(() => setCopied(''), 1500); };
  const upload = async (file, kind) => {
    const pdf = file.type === 'application/pdf';
    if (pdf && file.size > 5.5 * 1024 * 1024) throw new Error('That PDF is too large. Use one under 5 MB.');
    const blob = pdf ? file : await resizeImageToBlob(file, 2000, 0.9);
    const { path, url } = await cacAgentCall({ action: 'upload', token, kind, type: pdf ? 'pdf' : 'image' });
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': pdf ? 'application/pdf' : 'image/jpeg', 'x-upsert': 'true' }, body: blob });
    if (!res.ok) throw new Error("That file didn't upload. Try again.");
    return path;
  };
  const send = async () => {
    setAct((a) => ({ ...a, busy: true, error: '' }));
    try {
      const cert = act.mode === 'registered' && act.cert ? await upload(act.cert, 'certificate') : null;
      const report = act.mode === 'registered' && act.report ? await upload(act.report, 'status-report') : null;
      await cacAgentCall({ action: 'update', token, status: act.mode, message: act.message, bn: act.bn, registered_name: act.name, tin: act.tin, certificate: cert, status_report: report });
      const done = act.mode;
      setAct({ mode: '', message: '', bn: '', name: '', tin: '', cert: null, report: null, busy: false, error: '', done });
      await load(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setAct((a) => ({ ...a, busy: false, error: e.message })); }
  };
  const field = { background: C.surfaceRaised, border: `1px solid ${C.line}`, color: C.ink };
  const shell = (body) => (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink, fontFamily: "'Poppins', 'Inter', system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 pb-16" style={{ paddingTop: 'max(18px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2 mb-4"><XorlaMark size={22} /><span className="text-[15px] font-extrabold">Xorla</span><span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.copperSoft, color: C.copper }}>For the CAC agent</span></div>
        {body}
      </div>
    </div>
  );
  if (v === undefined) return shell(<div className="py-24 flex justify-center"><Loader2 className="animate-spin" size={22} style={{ color: C.inkFaint }} /></div>);
  if (v.state !== 'ok') return shell(
    <div className="text-center py-20">
      <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.surfaceRaised }}><Lock size={24} style={{ color: C.inkFaint }} /></div>
      <div className="text-[19px] font-bold">{v.state === 'expired' ? 'This link has expired' : v.state === 'revoked' ? 'This link was stopped' : v.state === 'error' ? "Couldn't open this page" : "This link doesn't work"}</div>
      <div className="text-[13.5px] mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: C.inkDim }}>{v.state === 'error' ? v.error : 'Ask Xorla to send you a new link.'}</div>
      {v.state === 'error' && <button onClick={() => { setV(undefined); load(); }} className="mt-5 px-5 py-2.5 rounded-xl text-[13.5px] font-semibold" style={{ background: C.copperFill, color: C.onAccent }}>Try again</button>}
    </div>
  );
  const r = v.request; const d = v.docs || {};
  const [word, tone] = CAC_STATUS[r.status] || [r.status, C.inkDim];
  const date = (x) => (x ? new Date(x + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const sections = [
    ['Business name', [['First name choice', r.name_1], ['Second name choice', r.name_2]]],
    ['The business', [['Nature of business', r.nature], ['Type of business', r.sub_category], ['Description', r.description], ['Date of commencement', date(r.commencement_date)], ['Number of staff', r.staff_size], ['Source of funds', r.fund_source]]],
    ['Business address', [['State', r.biz_state], ['Local government', r.biz_lga], ['Business address', r.biz_address]]],
    ['Proprietor', [['Full name', r.owner_name], ['Date of birth', date(r.owner_dob)], ['Gender', r.owner_gender], ['Nationality', r.owner_nationality || 'Nigerian'], ['Occupation', r.owner_occupation], ['Phone', r.owner_phone], ['Email', r.owner_email], ['NIN', r.owner_nin], ['Residential address', r.owner_address], ['ID type', r.id_type]]],
  ];
  const closed = ['registered', 'rejected', 'cancelled'].includes(r.status);
  const doneText = { filed: 'Marked as filed. The owner and Xorla have been told.', query: 'Sent. The owner has been asked to fix it, and Xorla has been told.', registered: 'Done! The owner can now download the certificate in Xorla.' }[act.done];
  return shell(
    <>
      {doneText && <div className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-2.5 text-[13.5px] font-semibold" style={{ background: C.sageSoft, color: C.sage, border: '1px solid rgba(31,217,196,0.3)' }}><Check size={17} /> {doneText}</div>}
      <div data-xt="dark" className="rounded-[22px] p-5" style={{ background: 'radial-gradient(120% 100% at 100% 0%, #22604F 0%, #133A32 45%, #0B221E 100%)', border: '1px solid rgba(var(--c-hi),0.08)' }}>
        <div className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: tone }}>{word}</div>
        <div className="text-[23px] font-extrabold leading-tight mt-1" style={{ letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>{r.registered_name || r.name_1}</div>
        <div className="text-[13px] mt-1.5" style={{ color: C.inkDim }}>Business name registration for {r.owner_name}{v.agent_name ? `. Sent to ${v.agent_name}` : ''}.</div>
        {r.bn_number && <div className="mt-3 inline-flex px-3 py-1.5 rounded-xl text-[14px] font-bold cx-mono" style={{ background: C.sageSoft, color: C.sage }}>{r.bn_number}</div>}
        {r.status === 'query' && r.message && <div className="mt-3 rounded-xl px-3.5 py-2.5 text-[12.5px]" style={{ background: C.rustSoft, color: C.ink }}><strong style={{ color: C.rust }}>Waiting for the owner to fix:</strong> {r.message}</div>}
        {r.status === 'paid' && (r.fixed_fields || []).length > 0 && <div className="mt-3 rounded-xl px-3.5 py-2.5 text-[12.5px]" style={{ background: C.copperSoft, color: C.ink, border: '1px solid rgba(255,176,32,0.35)' }}><strong style={{ color: C.copper }}>The owner fixed it{r.fixed_at ? ` on ${new Date(r.fixed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}.</strong> Changed: {r.fixed_fields.join(', ')}. Marked below. Please file it again.</div>}
      </div>

      <div className="mt-4">
        <div className="text-[12px] font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: C.inkFaint }}>Documents</div>
        <div className="grid grid-cols-3 gap-2">
          {[['id_doc', r.id_type || 'ID'], ['passport_doc', 'Passport photograph'], ['signature_doc', 'Signature']].map(([k, l]) => (
            <div key={k} className="rounded-2xl overflow-hidden" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
              <a href={d[k]?.view || undefined} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] flex items-center justify-center" style={{ background: C.bg }}>
                {d[k] ? (d[k].pdf ? <FileText size={26} style={{ color: C.copper }} /> : <img src={d[k].view} alt={l} className="w-full h-full object-cover" />) : <span className="text-[11px]" style={{ color: C.inkFaint }}>Not added</span>}
              </a>
              <div className="px-2.5 py-2">
                <div className="text-[11.5px] font-semibold truncate" style={{ color: r.status === 'paid' && (r.fixed_fields || []).includes({ id_doc: 'ID', passport_doc: 'Passport photograph', signature_doc: 'Signature' }[k]) ? C.copper : C.ink }}>{l}{r.status === 'paid' && (r.fixed_fields || []).includes({ id_doc: 'ID', passport_doc: 'Passport photograph', signature_doc: 'Signature' }[k]) ? ' · new' : ''}</div>
                {d[k] && <a href={d[k].download} className="inline-flex items-center gap-1 text-[11.5px] font-semibold mt-0.5" style={{ color: C.copper }}><Download size={12} /> Download</a>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {sections.map(([title, rows]) => (
        <div key={title} className="mt-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide mb-2 px-1" style={{ color: C.inkFaint }}>{title}</div>
          <div className="rounded-2xl overflow-hidden" style={{ background: C.surfaceRaised, border: `1px solid ${C.line}` }}>
            {rows.filter(([, val]) => val).map(([k, val], i) => { const changed = r.status === 'paid' && (r.fixed_fields || []).includes(k); return (
              <div key={k} className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderTop: i ? `1px solid ${C.line}` : 'none', background: changed ? 'rgba(255,176,32,0.10)' : 'transparent' }}>
                <span className="w-32 sm:w-40 shrink-0 text-[12px]" style={{ color: changed ? C.copper : C.inkFaint }}>{k}{changed && <span className="block text-[10px] font-bold uppercase tracking-wide">Changed</span>}</span>
                <span className={`flex-1 min-w-0 text-[13.5px] ${k === 'NIN' ? 'cx-mono' : ''}`} style={{ overflowWrap: 'anywhere' }}>{val}</span>
                <button onClick={() => copy(val, title + k)} className="shrink-0 text-[11.5px] font-semibold px-2 py-1 rounded-lg" style={{ color: copied === title + k ? C.sage : C.copper }}>{copied === title + k ? 'Copied' : 'Copy'}</button>
              </div>
            ); })}
          </div>
        </div>
      ))}

      {!closed && (
        <div className="mt-6 rounded-[22px] p-4 sm:p-5 space-y-3" style={{ background: C.surface, border: `1px solid ${C.lineStrong || C.line}` }}>
          <div className="text-[16px] font-bold">Update Xorla and the owner</div>
          <div className="text-[12.5px] -mt-1.5" style={{ color: C.inkDim }}>They're notified straight away.</div>
          <div className="grid grid-cols-3 gap-2">
            {[['filed', 'Filed with CAC', Send], ['query', 'CAC needs a fix', AlertCircle], ['registered', 'Registered', BadgeCheck]].map(([m, l, Ic]) => (
              <button key={m} onClick={() => setAct({ ...act, mode: act.mode === m ? '' : m, error: '', message: m === act.mode ? act.message : '' })} disabled={m === 'filed' && r.status === 'filed'} className="rounded-xl px-2 py-3 text-[12.5px] font-semibold flex flex-col items-center gap-1.5" style={act.mode === m ? { background: m === 'query' ? C.rustFill : m === 'registered' ? C.sageFill : C.copperFill, color: C.onAccent } : { ...field, opacity: m === 'filed' && r.status === 'filed' ? 0.4 : 1 }}><Ic size={17} /> {l}</button>
            ))}
          </div>
          {act.mode === 'query' && (<>
            <div className="flex flex-wrap gap-1.5">{CAC_SUGGEST.query.map((t) => <button key={t} type="button" onClick={() => setAct({ ...act, message: t })} className="text-left px-2.5 py-1.5 rounded-lg text-[11.5px] leading-snug" style={act.message === t ? { background: C.copperSoft, color: C.copper, border: '1px solid rgba(255,176,32,0.4)' } : { border: `1px solid ${C.line}`, color: C.inkDim }}>{t}</button>)}</div>
            <textarea rows={3} value={act.message} onChange={(e) => setAct({ ...act, message: e.target.value })} placeholder="What should the owner fix? Write it for them." className="w-full rounded-xl px-3.5 py-3 text-[14px] outline-none resize-none" style={field} />
          </>)}
          {act.mode === 'registered' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input value={act.bn} onChange={(e) => setAct({ ...act, bn: e.target.value })} placeholder="BN number, e.g. BN 1234567" className="rounded-xl px-3.5 py-3 text-[14px] outline-none cx-mono" style={field} />
                <input value={act.name} onChange={(e) => setAct({ ...act, name: e.target.value })} placeholder="Name as registered" className="rounded-xl px-3.5 py-3 text-[14px] outline-none" style={field} />
                <input value={act.tin} onChange={(e) => setAct({ ...act, tin: e.target.value })} placeholder="TIN (if issued)" className="rounded-xl px-3.5 py-3 text-[14px] outline-none cx-mono" style={field} />
                <label className="flex items-center gap-2 rounded-xl px-3.5 py-3 text-[13.5px] cursor-pointer min-w-0" style={field}><Upload size={15} className="shrink-0" style={{ color: C.copper }} /> <span className="truncate">{act.report ? act.report.name : 'Status report (optional)'}</span><input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setAct({ ...act, report: e.target.files?.[0] || null })} /></label>
              </div>
              <label className="flex items-center gap-2 rounded-xl px-3.5 py-3.5 text-[13.5px] font-semibold cursor-pointer" style={{ ...field, border: `1.5px dashed ${act.cert ? C.sage : C.copper}` }}><Upload size={16} style={{ color: act.cert ? C.sage : C.copper }} /> {act.cert ? act.cert.name : 'Upload the certificate (PDF or photo)'}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setAct({ ...act, cert: e.target.files?.[0] || null })} /></label>
              <input value={act.message} onChange={(e) => setAct({ ...act, message: e.target.value })} placeholder="A note for the owner (optional)" className="w-full rounded-xl px-3.5 py-3 text-[14px] outline-none" style={field} />
            </div>
          )}
          {act.error && <div className="rounded-xl px-3.5 py-2.5 text-[12.5px]" style={{ background: C.rustSoft, color: C.rust }}>{act.error}</div>}
          {act.mode && <button onClick={send} disabled={act.busy} className="w-full h-12 rounded-xl text-[14.5px] font-bold" style={{ background: C.sageFill, color: C.onAccent, opacity: act.busy ? 0.6 : 1 }}>{act.busy ? 'Sending…' : act.mode === 'filed' ? 'Confirm: filed with CAC' : act.mode === 'query' ? 'Send to the owner' : 'Confirm: registered'}</button>}
        </div>
      )}
      <div className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-center" style={{ color: C.inkFaint }}><Lock size={12} /> Private page. Please don't share this link.</div>
    </>
  );
}
export { CacAgentPage, VaultShared };
