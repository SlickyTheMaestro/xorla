// Xorla: store screens (loaded only when needed). Shared code lives in ../App.jsx.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Loader2, Check, Sparkles, X, ShieldCheck, Building2, Package, Camera, Plus, ChevronLeft, ChevronRight, ShoppingBag, MessageCircle, MapPin, Search } from 'lucide-react';
import { BOOKED_GUEST_NOTE, EVENT_TIMES, HALF_HOURS, LAGOS_TIME, LAUNDRY_COLLECT_NOTE, LAUNDRY_DROP_NOTE, PERSON_WORDS, S, SB_KEY, SERVICE_KINDS, SF_FONT, STAY_SERVICE_RE, SlotPicker, apptDay, apptTime, brandAlert, calEndOf, cleanOptions, displayLocationName, eventEndAfter, eventTimeLabel, examplesFor, fmt, formatPhoneDisplay, fromSbProduct, hasOptions, hhmmLabel, isBookable, kindOf, locationWords, optionAddon, optionCombos, optionWords, priceLabel, rentsByDay, sbRpc, stayServiceKind, toWhatsAppNumber, todayKey } from '../App.jsx';

// "How long" in the words a customer reads, for this kind of business
const durationWords = (kind, d) => { const x = String(d || '').toLowerCase(); if (!x) return ''; if (kind === 'repairs') return /within|same/.test(x) ? `Ready ${x}` : `Ready in about ${x}`; if (kind === 'events') return x === 'full day' ? 'Covers a full day' : `Covers ${x}`; return `Takes ${x}`; };
const EVENT_TYPES = ['Wedding', 'Birthday', 'Burial', 'Church event', 'Corporate', 'Party', 'Other'];
// Cheapest and dearest a product can be with its extras
function optionPriceRange(p, base) {
  const o = cleanOptions(p?.options); const b = Number(base ?? p?.sellingPrice) || 0;
  if (!o.length || !o.some((g) => g.prices)) return [b, b];
  const lo = o.reduce((a, g) => a + Math.min(0, ...g.values.map((v) => Number((g.prices || {})[v]) || 0)), 0);
  const hi = o.reduce((a, g) => a + Math.max(0, ...g.values.map((v) => Number((g.prices || {})[v]) || 0)), 0);
  return [Math.max(0, b + lo), Math.max(0, b + hi)];
}
// A little dot of colour next to colour names customers know (Red, Navy blue, Wine…); unknown names get none
const SWATCHES = { black: '#111111', white: '#FFFFFF', red: '#D32F2F', blue: '#1E63D6', navy: '#1B2A4A', 'navy blue': '#1B2A4A', 'sky blue': '#7EC8F2', 'royal blue': '#2348C9', green: '#2E8B57', 'olive': '#6B7A2F', 'olive green': '#6B7A2F', 'emerald': '#0F9D6B', 'emerald green': '#0F9D6B', 'lemon': '#E9E35A', 'lemon green': '#A7D93A', yellow: '#F4C430', mustard: '#D9A21B', orange: '#F07C1B', pink: '#F48FB1', 'baby pink': '#F8C8D8', 'hot pink': '#E9407A', purple: '#7B3FA0', lilac: '#C8A2C8', lavender: '#B9A6E0', brown: '#7B4B2A', 'chocolate': '#5A3420', 'coffee': '#6F4E37', beige: '#E8D9BC', nude: '#E3BC9A', cream: '#F3E9D2', 'off white': '#F5F1E6', 'off-white': '#F5F1E6', ivory: '#FFFDF0', gold: '#C9A227', silver: '#BFC4C9', grey: '#8A8F94', gray: '#8A8F94', 'ash': '#9EA3A8', maroon: '#7A1F2B', wine: '#6E1B2D', burgundy: '#7A1F35', teal: '#1E8C8C', turquoise: '#33C1C1', peach: '#F6B98E', coral: '#F2765B', khaki: '#BDB07A', 'army green': '#4B5320', 'rose gold': '#C9967F', 'multicolour': 'conic-gradient(#D32F2F, #F4C430, #2E8B57, #1E63D6, #7B3FA0, #D32F2F)', 'multicolor': 'conic-gradient(#D32F2F, #F4C430, #2E8B57, #1E63D6, #7B3FA0, #D32F2F)' };
const swatchFor = (name) => SWATCHES[String(name || '').trim().toLowerCase()] || null;
const isColourGroup = (g) => /colou?r|shade/i.test(g?.name || '');

function Storefront({ businessCode }) {
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState(null);
  const [storeProducts, setStoreProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [guestRoom, setGuestRoom] = useState('');
  const [laundryWay, setLaundryWay] = useState('');   // laundry, not staying: 'collect' (they fetch it) | 'drop' (customer brings it)
  const [guestStay, setGuestStay] = useState('');   // hotel service extras: '' | 'yes' (staying here) | 'no'   // hotels: a guest staying here can say which room (staff check it before billing)
  // How the customer gets their order: pick-up, delivery (address + landmark), or brought to their room at a hotel
  const [orderModesRaw, setOrderModes] = useState([]);
  const [branchDelivers, setBranchDelivers] = useState(true);   // a branch can be pick-up only
  const orderModes = branchDelivers ? orderModesRaw : orderModesRaw.filter((m) => m !== 'delivery');
  const [fulfilMode, setFulfilMode] = useState('');
  const [deliverAddr, setDeliverAddr] = useState('');
  const [deliverLandmark, setDeliverLandmark] = useState('');
  const [storeZones, setStoreZones] = useState([]);   // delivery areas with fixed fees
  const [zoneId, setZoneId] = useState('');           // '' = not chosen, 'other' = somewhere else (the business quotes)
  const [submitting, setSubmitting] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [heroIndex, setHeroIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [preferredTime, setPreferredTime] = useState('');
  // Discount codes: a ?code= link fills the code in for the customer
  const [codeInput, setCodeInput] = useState(() => { try { return (new URLSearchParams(window.location.search).get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16); } catch (e) { return ''; } });
  const [codeOpen, setCodeOpen] = useState(() => { try { return !!new URLSearchParams(window.location.search).get('code'); } catch (e) { return false; } });
  const [discount, setDiscount] = useState(null); // { code, amount }
  const [codeError, setCodeError] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  // The branch a customer shops from is remembered on their phone, so they choose it once
  const branchKey = `xorla:sf-branch:${businessCode}`;
  const [storeShopId, setStoreShopId] = useState(() => { try { return localStorage.getItem(branchKey) || null; } catch (e) { return null; } });
  const [branchAsk, setBranchAsk] = useState(false);
  const [viewItem, setViewItem] = useState(null);    // the product page open on top of the store
  const [viewIdx, setViewIdx] = useState(0);         // which photo of it
  const [viewQty, setViewQty] = useState(1);
  const [viewTouch, setViewTouch] = useState(null);
  const [viewSel, setViewSel] = useState({});        // chosen colour/size on the product page: { 0: 'Red', 1: 'M' }
  const [viewOther, setViewOther] = useState('');    // the customer's own colour, when the business allows it
  const [viewOtherOn, setViewOtherOn] = useState(false);
  // Appointments: free times for the services in the basket
  const [apptCal, setApptCal] = useState(null);
  const [apptCalLoading, setApptCalLoading] = useState(false);
  const [apptCalError, setApptCalError] = useState(false);           // the free times couldn't load (network): offer to try again
  const [dayPeople, setDayPeople] = useState({ key: '', people: null, loading: false });   // each stylist's own times on the chosen day
  const [groupPlan, setGroupPlan] = useState({ key: '', plan: null, loading: false });    // a group: who is served when, at the chosen time
  const [apptPickDay, setApptPickDay] = useState('');
  const [apptSlot, setApptSlot] = useState('');
  const [apptPerson, setApptPerson] = useState(null);
  const [sentWhen, setSentWhen] = useState('');
  // Booking for more than one person (a lady and her husband, friends): who each service is for. '' is the person booking.
  const [party, setParty] = useState([]);
  const [forEdit, setForEdit] = useState(null);   // { key, mode: 'move' | 'copy', name }
  const [guestPick, setGuestPick] = useState({});  // in a group: the stylist each person chose ('' = the person booking)
  // Bookings (hotels and rentals): chosen dates, live availability, and the booking form
  const [stayIn, setStayIn] = useState('');
  const [stayOut, setStayOut] = useState('');
  const [stayFree, setStayFree] = useState({});
  const [bookItem, setBookItem] = useState(null);
  const [bookTimes, setBookTimes] = useState({ pickup: '', ret: '' });   // rentals: when they pick it up and bring it back
  const [bookUnits, setBookUnits] = useState(1);
  const [bookName, setBookName] = useState('');
  const [bookPhone, setBookPhone] = useState('');
  const [bookNote, setBookNote] = useState('');
  const [bookBusy, setBookBusy] = useState(false);
  const [bookError, setBookError] = useState('');
  const [bookingSent, setBookingSent] = useState(null);
  const [thanks, setThanks] = useState(null);   // the thank-you card after a booking or order: they stay on the store
  const [bookTerms, setBookTerms] = useState(null);   // deposit rule, cancellation window and how to pay
  // Halls and event spaces: one date, the whole day(s) or a few hours
  const [spaceItem, setSpaceItem] = useState(null);
  const [spaceAsk, setSpaceAsk] = useState({ date: '', mode: 'day', days: 1, start: '10:00', end: '14:00', guests: '', event: '' });
  const [spaceTaken, setSpaceTaken] = useState([]);
  useEffect(() => {
    if (!spaceItem || !business) return;
    const from = todayKey(); const to = new Date(Date.now() + 120 * 86400000).toLocaleDateString('sv-SE');
    sbRpc('space_taken', SB_KEY, { p_business_code: businessCode, p_shop_id: business.shop_id || null, p_product_id: spaceItem.id, p_from: from, p_to: to })
      .then((rows) => setSpaceTaken(Array.isArray(rows) ? rows : [])).catch(() => setSpaceTaken([]));
  }, [spaceItem?.id, business?.shop_id]);
  const [dateNudge, setDateNudge] = useState(false);
  const datesValid = !!stayIn && !!stayOut && stayOut > stayIn;
  useEffect(() => {
    if (!datesValid || !business) { setStayFree({}); return; }
    sbRpc('storefront_availability', SB_KEY, { p_business_code: businessCode, p_shop_id: business.shop_id || null, p_check_in: stayIn, p_check_out: stayOut })
      .then((rows) => setStayFree(Object.fromEntries((rows || []).map((r) => [r.productId, r.free]))))
      .catch(() => setStayFree({}));
  }, [stayIn, stayOut, business?.shop_id]);
  const [switchingShop, setSwitchingShop] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  // Each kind of service asks for what it needs: home visits, event details, a project's deadline
  const [visitTerms, setVisitTerms] = useState(null);   // { home_service, home_fee }
  const [visitWay, setVisitWay] = useState('shop');      // 'shop' | 'home'
  const [visitAddr, setVisitAddr] = useState('');
  const [eventInfo, setEventInfo] = useState({ type: '', venue: '', guests: '' });
  const [deadline, setDeadline] = useState('');
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
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = meta?.getAttribute('content');
    meta?.setAttribute('content', '#FFFFFF');
    return () => { if (meta && prevTheme) meta.setAttribute('content', prevTheme); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Secure function returns only shopper-safe fields — never cost prices or private settings
        const store = await sbRpc('get_storefront', SB_KEY, { p_business_code: businessCode, ...(storeShopId ? { p_shop_id: storeShopId } : {}) });
        if (!store) { setLoadError(true); setLoading(false); return; }
        // A business that only sells products has no "kind of service" (an old hotel setting must not make it ask about rooms)
        const kind = store.business_type === 'products' ? null : store.service_kind;
        setBusiness({ ...store, service_kind: kind });
        document.title = store.name;
        setStoreProducts((store.products || []).map((r) => ({ ...fromSbProduct(r), variantStock: r.variant_stock && typeof r.variant_stock === 'object' ? r.variant_stock : null })).filter((p) => store.business_type !== 'products' || !isBookable(p)));
        sbRpc('storefront_booking_terms', SB_KEY, { p_business_code: businessCode }).then((t) => setBookTerms(t || null)).catch(() => {});
        // This branch's delivery areas and prices (each branch can have its own), and whether it delivers at all
        setZoneId('');
        sbRpc('storefront_delivery', SB_KEY, { p_business_code: businessCode, p_shop: store.shop_id || null })
          .then((d) => { setStoreZones(Array.isArray(d?.zones) ? d.zones : []); setBranchDelivers(d?.delivers !== false); })
          .catch(() => { setBranchDelivers(true); sbRpc('storefront_delivery_zones', SB_KEY, { p_business_code: businessCode }).then((z) => setStoreZones(Array.isArray(z) ? z : [])).catch(() => setStoreZones([])); });
        sbRpc('storefront_visit_terms', SB_KEY, { p_business_code: businessCode }).then((v) => setVisitTerms(v || null)).catch(() => setVisitTerms(null));
        sbRpc('storefront_order_modes', SB_KEY, { p_business_code: businessCode })
          .then((m) => { const list = (Array.isArray(m) ? m : []).filter((v) => v !== 'room' || kind === 'accommodation'); setOrderModes(list); if (list.length === 1) setFulfilMode(list[0]); })
          .catch(() => setOrderModes(kind === 'accommodation' ? ['room', 'pickup'] : store.business_type !== 'services' ? ['pickup', 'delivery'] : []));
      } catch (e) { if (!business) setLoadError(true); }
      setLoading(false);
      setSwitchingShop(false);
    })();
  }, [businessCode, storeShopId]);
  useEffect(() => {
    if (!business || (business.shops || []).length < 2) return;
    let saved = null; try { saved = localStorage.getItem(branchKey); } catch (e) {}
    if (!saved || !(business.shops || []).some((sh) => sh.id === saved)) setBranchAsk(true);
  }, [business?.name, (business?.shops || []).length]);
  const chooseBranch = (id) => {
    try { localStorage.setItem(branchKey, id); } catch (e) {}
    setBranchAsk(false);
    if (id !== business?.shop_id) { setSwitchingShop(true); setStoreShopId(id); }
  };
  // The product page: open, swipe photos, and close with the back button on phones
  const openItem = (p) => { setViewItem(p); setViewIdx(0); setViewQty(1); setViewSel({}); setViewOther(''); setViewOtherOn(false); try { window.history.pushState({ sfItem: p.id }, ''); } catch (e) {} };
  const closeItem = () => { if (viewItem) { try { if (window.history.state?.sfItem) window.history.back(); else setViewItem(null); } catch (e) { setViewItem(null); } } };
  useEffect(() => { const onPop = () => setViewItem(null); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);

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
  // "All": one full grid, like a shop window. Group by category only when there are several items per group,
  // or when the store mixes rooms, halls and extras (each is its own kind of thing).
  const perCategory = hasCategories ? visibleProducts.length / Math.max(1, categories.length - 1) : 0;
  const mixedKinds = storeProducts.some((p) => p.isSpace || isBookable(p));
  const sections = (activeCategory === 'All' && hasCategories && !query.trim() && sortBy === 'featured' && (mixedKinds || perCategory >= 3))
    ? categories.slice(1).map((cat) => ({ title: cat, items: visibleProducts.filter((p) => p.category === cat) }))
        .concat([{ title: 'More', items: visibleProducts.filter((p) => !p.category) }])
        .filter((s) => s.items.length)
    : [{ title: null, items: visibleProducts }];

  // A basket line is one product, or one colour/size of it ("id::Red / M"), or the customer's own choice ("id::~Emerald"),
  // and, for appointments booked for someone else, who it's for ("id@@Chidi")
  const cartKeyOf = (productId, variant, custom, guest = '') => (custom ? `${productId}::~${custom}` : variant ? `${productId}::${variant}` : productId) + (guest ? `@@${guest}` : '');
  const cartList = Object.entries(cart).filter(([, qty]) => qty > 0).map(([key, qty]) => {
    const at = key.indexOf('@@'); const base = at >= 0 ? key.slice(0, at) : key; const guest = at >= 0 ? key.slice(at + 2) : '';
    const [id, rest] = [base.split('::')[0], base.includes('::') ? base.slice(base.indexOf('::') + 2) : ''];
    const custom = rest.startsWith('~') ? rest.slice(1) : '';
    return { key, product: storeProducts.find((p) => p.id === id), qty, variant: custom ? '' : rest, custom, guest };
  }).filter((c) => c.product);
  const inCartOf = (productId) => cartList.filter((c) => c.product.id === productId).reduce((a, c) => a + c.qty, 0);
  const lineLabel = (c) => (c.custom ? `Own choice: ${c.custom}` : c.variant || '');
  // Who a service is for, when the booking is for more than one person
  const hasGuests = cartList.some((c) => c.guest);
  const youName = customerName.trim().split(' ')[0] || 'You';
  const forText = (c) => (c.guest ? ` · for ${c.guest}` : hasGuests && storeKind(c.product) === 'service' ? ` · for ${youName}` : '');
  // Times under each stylist for the chosen day: "Anyone free" first, then each person with their own times
  const renderPeopleTimes = (sel) => {
    if (!sel) return <div className="text-[12.5px] py-2 text-center" style={{ color: S.muted }}>Choose a day with a dot to see free times.</div>;
    const people = dayPeople.people;
    const rows = [{ id: null, name: 'Anyone free', slots: sel.slots || [] }, ...(people || [])];
    return (
      <>
        <div className="text-[12.5px] font-semibold mb-2" style={{ color: S.ink }}>{new Date(sel.date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id || 'any'} className="rounded-xl p-2.5" style={{ background: S.tile }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11.5px] font-bold shrink-0" style={{ background: r.id ? '#fff' : S.ink, color: r.id ? S.ink : '#fff' }}>{r.id ? r.name.trim()[0]?.toUpperCase() : <Users size={13} />}</span>
                <span className="text-[13.5px] font-semibold">{r.name}</span>
                <span className="text-[11.5px] ml-auto" style={{ color: S.muted }}>{r.slots.length ? `${r.slots.length} free` : 'Fully booked'}</span>
              </div>
              {r.slots.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={`${r.name}: free times`}>
                  {r.slots.map((t) => {
                    const on = apptSlot === t && (apptPerson || null) === r.id;
                    return <button key={t} type="button" aria-pressed={on} onClick={() => { setApptPerson(r.id); setApptSlot(t); }} className={`py-2 rounded-lg text-[12.5px] font-semibold ${focusRing}`} style={on ? { background: S.ink, color: '#fff' } : { background: '#fff', color: S.ink }}>{apptTime(t)}</button>;
                  })}
                </div>
              )}
            </div>
          ))}
          {people === null && <div className="flex items-center gap-2 text-[12.5px] px-1" style={{ color: S.muted }}><Loader2 size={14} className="animate-spin" /> Checking each person's times…</div>}
        </div>
      </>
    );
  };
  // Group bookings (several people, each with their own time) are for salons, barbers and spas
  const groupable = (c) => !!business && storeKind(c.product) === 'service' && !isBookable(c.product) && business.service_kind === 'personal_care';
  const partyName = (raw) => {
    const n = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!n || /^(you|me|myself)$/i.test(n)) return '';
    const same = party.find((x) => x.toLowerCase() === n.toLowerCase());
    if (!same) setParty((p) => [...p, n]);
    return same || n;
  };
  // Move a service to someone else, or book the same service for them too
  const moveLine = (c, guest) => setCart((prev) => {
    const to = cartKeyOf(c.product.id, c.variant, c.custom, guest);
    if (to === c.key) return prev;
    const next = { ...prev }; const q = next[c.key] || 0; delete next[c.key];
    next[to] = Math.min(Math.max(1, lineMax(c.product, c.variant, c.custom)), (next[to] || 0) + q);
    return next;
  });
  const copyLine = (c, guest) => setCart((prev) => { const to = cartKeyOf(c.product.id, c.variant, c.custom, guest); return prev[to] ? prev : { ...prev, [to]: c.qty }; });
  const pickFor = (c, mode, raw) => {
    const n = raw === '' && mode === 'move' ? '' : partyName(raw);
    if (n === '' && raw !== '') return;
    if (mode === 'move') moveLine(c, n); else if (n) copyLine(c, n);
    setForEdit(null);
  };
  // How many a basket line may hold: the stock of that colour/size, unlimited for made to order and own choices
  const lineMax = (product, variant, custom) => {
    if (storeKind(product) === 'service') return product.priceUnit === 'hour' ? 24 : 1;
    if (product.madeToOrder || custom) return 99;
    if (variant && product.variantStock) return Math.max(0, Number(product.variantStock[variant]) || 0);
    return product.stockQuantity !== null ? product.stockQuantity : Infinity;
  };
  // A line's price: the product's price here, plus any extra for the colour/size chosen
  const linePrice = (c) => Math.max(0, Number(c.product.sellingPrice) + optionAddon(c.product.options, c.variant || c.custom));
  const cartTotal = cartList.reduce((a, c) => a + linePrice(c) * c.qty, 0);
  const cartCount = cartList.reduce((a, c) => a + c.qty, 0);
  const discountOff = discount ? Math.min(cartTotal, Number(discount.amount) || 0) : 0;
  const cartKey = JSON.stringify(cartList.map((c) => [c.key, c.qty]));
  const phoneReady = customerPhone.replace(/\D/g, '').length >= 10 ? customerPhone.replace(/\D/g, '').slice(-10) : '';
  const applyCode = async (codeArg, quiet) => {
    const code = String(codeArg ?? codeInput).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) { setCodeError('Enter a discount code.'); return; }
    if (!cartList.length) return;
    setCodeBusy(true); if (!quiet) setCodeError('');
    try {
      const r = await sbRpc('check_discount', SB_KEY, { p_business_code: businessCode, p_code: code, p_items: cartList.map((c) => ({ productId: c.product.id, quantity: c.qty, ...(c.variant ? { variant: c.variant } : {}), ...(c.custom ? { custom: c.custom } : {}) })), p_shop_id: business?.shop_id || null, p_phone: customerPhone.trim() || null });
      if (r && r.error) { setDiscount(null); setCodeError(r.error); }
      else if (r) { setDiscount({ code: r.code, amount: Number(r.amount) || 0, perCustomer: r.per_customer || null }); setCodeError(''); setCodeInput(r.code); }
    } catch (e) { setDiscount(null); setCodeError(e.message || "Couldn't check that code. Try again."); }
    setCodeBusy(false);
  };
  const storeShops = business?.shops || [];
  const currentStoreShop = storeShops.find((sh) => sh.id === business?.shop_id) || storeShops[0];
  // Hotels and rentals: extras (water, laundry, drinks) are counted like goods, not booked like a haircut
  const storeKind = (p) => { const k = kindOf(p, business?.business_type); return k === 'service' && ['accommodation', 'rentals'].includes(business?.service_kind) && !isBookable(p) ? 'product' : k; };
  const cartHasService = cartList.some((c) => storeKind(c.product) === 'service');
  // Hotels and rentals: extras that are a service done for the guest (airport pickup, laundry, spa), not something handed over
  const stayService = (p) => ['accommodation', 'rentals'].includes(business?.service_kind) && !isBookable(p) && STAY_SERVICE_RE.test(`${p.name} ${p.category || ''}`);
  const svcExtras = cartList.filter((c) => stayService(c.product));
  const svcKinds = [...new Set(svcExtras.map((c) => stayServiceKind(c.product.name)))];
  const svcKind = svcKinds.length === 1 ? svcKinds[0] : svcKinds.length ? 'mixed' : null;
  // Ask "how do you want it?" when there are goods to hand over (not for appointments or pure services)
  // A pick-up-only branch: delivery isn't offered, and pick-up is chosen for them
  useEffect(() => { if (!branchDelivers && fulfilMode === 'delivery') setFulfilMode(orderModes.length === 1 ? orderModes[0] : ''); else if (!branchDelivers && orderModes.length === 1 && !fulfilMode) setFulfilMode(orderModes[0]); }, [branchDelivers, orderModesRaw]); // eslint-disable-line react-hooks/exhaustive-deps
  const askHow = orderModes.length > 0 && cartList.some((c) => storeKind(c.product) !== 'service' && !isBookable(c.product) && !stayService(c.product));
  const askStay = svcExtras.length > 0 && !askHow && orderModes.includes('room');
  const sk = business?.service_kind || '';
  const homeOffered = !!visitTerms?.home_service && ['personal_care', 'repairs'].includes(sk) && cartHasService && !askHow;
  const goingHome = homeOffered && visitWay === 'home';
  const homeFee = goingHome ? Math.max(0, Number(visitTerms?.home_fee) || 0) : 0;
  const payable = cartTotal - discountOff + homeFee;
  // A professional service with no set length: a project, sent as a brief (no time slot)
  const projectReq = sk === 'professional' && cartHasService && !apptCalLoading && !apptCal && !apptCalError;
  const svcTurnaround = (() => { const ds = [...new Set(cartList.filter((c) => storeKind(c.product) === 'service').map((c) => c.product.duration).filter(Boolean))]; return ds.length === 1 ? ds[0] : ''; })();
  // Laundry for someone not staying: first, how does the bag get to the business?
  const laundryOut = svcKinds.includes('laundry') && !askHow && !cartHasService && (askStay ? guestStay === 'no' : true);
  const laundryOpts = [['collect', 'Collect it from me', "We pick it up and bring it back"], ['drop', "I'll drop it off", "And collect it when it's ready"]].filter(([v]) => orderModes.includes(v === 'collect' ? 'delivery' : 'pickup'));
  const lineQtyText = (c) => {
    if (storeKind(c.product) !== 'service') return ` ×${c.qty}`;
    return c.product.priceUnit === 'hour' ? ` (${c.qty} hr${c.qty !== 1 ? 's' : ''})` : '';
  };

  const serviceKey = JSON.stringify(cartList.filter((c) => storeKind(c.product) === 'service').map((c) => [c.product.id, c.qty, c.guest || '', (hasGuests && guestPick[c.guest || '']) || '']));
  const loadStoreCalendar = useCallback(async () => {
    const items = JSON.parse(serviceKey).map(([productId, quantity, guest, withId]) => ({ productId, quantity, ...(guest ? { for: guest } : {}), ...(withId ? { with: withId } : {}) }));
    // Hotels and rentals don't take appointments: their extras (water, laundry, airport pickup) are simply ordered
    if (!items.length || !business || ['accommodation', 'rentals'].includes(business.service_kind)) { setApptCal(null); setApptCalError(false); return; }
    setApptCalLoading(true); setApptCalError(false);
    try {
      // The calendar shows when anyone is free; each stylist's own times for the chosen day load separately (below)
      const cal = await sbRpc('appointment_calendar', SB_KEY, { p_business_code: businessCode, p_shop_id: business.shop_id || null, p_items: items, p_days: business.service_kind === 'events' ? 90 : 14 });
      setApptCal(cal && cal.minutes ? cal : null);
      if (apptPerson && cal && !(cal.people || []).some((x) => x.id === apptPerson)) setApptPerson(null);   // that person is no longer listed
      setApptPickDay((d) => (cal?.days || []).some((x) => x.date === d && x.slots.length) ? d : ((cal?.days || []).find((x) => x.slots.length)?.date || ''));
    } catch (e) { setApptCal(null); setApptCalError(true); }
    setApptCalLoading(false);
  }, [serviceKey, business, businessCode]);
  // Free times load as soon as a service is in the basket: on a computer the basket and its form are always on screen,
  // and on a phone they refresh each time the basket is opened
  useEffect(() => { setApptSlot(''); loadStoreCalendar(); }, [loadStoreCalendar]);
  // One person, with a team: each stylist's free times on the chosen day, so the times sit under each person
  useEffect(() => {
    if (!apptCal || apptCal.group || !(apptCal.people || []).length || !apptPickDay) return undefined;
    const key = `${serviceKey}|${apptPickDay}|${business?.shop_id || ''}`;
    if (dayPeople.key === key && dayPeople.people) return undefined;
    let live = true;
    setDayPeople({ key, people: null, loading: true });
    const items = JSON.parse(serviceKey).map(([productId, quantity]) => ({ productId, quantity }));
    sbRpc('appointment_day_people', SB_KEY, { p_business_code: businessCode, p_shop_id: business?.shop_id || null, p_items: items, p_date: apptPickDay })
      .then((r) => { if (live) setDayPeople({ key, people: Array.isArray(r?.people) ? r.people : [], loading: false }); })
      .catch(() => { if (live) setDayPeople({ key, people: [], loading: false, error: true }); });
    return () => { live = false; };
  }, [apptCal, apptPickDay, serviceKey]);
  // A group: once a time is picked, show who is served when, and by whom
  useEffect(() => {
    if (!apptCal?.group || !apptSlot) { if (groupPlan.plan) setGroupPlan({ key: '', plan: null, loading: false }); return undefined; }
    const key = `${serviceKey}|${apptSlot}`;
    let live = true;
    setGroupPlan({ key, plan: null, loading: true });
    const items = JSON.parse(serviceKey).map(([productId, quantity, guest, withId]) => ({ productId, quantity, ...(guest ? { for: guest } : {}), ...(withId ? { with: withId } : {}) }));
    sbRpc('appointment_group_preview', SB_KEY, { p_business_code: businessCode, p_shop_id: business?.shop_id || null, p_items: items, p_start: apptSlot })
      .then((r) => { if (live) setGroupPlan({ key, plan: Array.isArray(r) ? r : null, loading: false }); })
      .catch(() => { if (live) setGroupPlan({ key, plan: null, loading: false }); });
    return () => { live = false; };
  }, [apptCal, apptSlot, serviceKey]);
  useEffect(() => { if (showCheckout) loadStoreCalendar(); }, [showCheckout]);
  const usesSlots = !!(apptCal && apptCal.minutes);
  // The discount follows the basket: re-checked whenever the items change (minimums and percentages depend on them)
  useEffect(() => {
    if (!business || !cartList.length) { if (discount) setDiscount(null); return undefined; }
    const code = discount?.code || (codeOpen && codeInput && !codeError ? codeInput : '');
    if (!code) return undefined;
    const t = setTimeout(() => applyCode(code, true), 400);
    return () => clearTimeout(t);
  }, [cartKey, business?.shop_id, phoneReady]);

  const changeQty = (product, delta, variant = '', custom = '', guest = '') => {
    const key = cartKeyOf(product.id, variant, custom, guest);
    setCart((prev) => {
      const current = prev[key] || 0;
      // Without options the whole product's stock is the limit; one colour/size is limited by its own stock
      const max = Math.max(0, lineMax(product, variant, custom));
      return { ...prev, [key]: Math.max(0, Math.min(max, current + delta)) };
    });
  };

  const submitOrder = async () => {
    if (!customerName.trim() || cartList.length === 0) return;
    if (askHow) {
      if (!fulfilMode) { brandAlert(`Please choose how you want your ${W.short.toLowerCase()}.`, { theme: 'light' }); return; }
      if (fulfilMode === 'delivery' && storeZones.length && !zoneId) { brandAlert('Please choose your area, so you can see the delivery fee.', { theme: 'light' }); return; }
      if (fulfilMode === 'delivery' && deliverAddr.trim().length < 6) { brandAlert('Please add the address to deliver to.', { theme: 'light' }); return; }
      if (fulfilMode === 'room' && !guestRoom.trim()) { brandAlert('Please add your room number.', { theme: 'light' }); return; }
    }
    if (askStay) {
      if (!guestStay) { brandAlert('Please say whether you are staying with us.', { theme: 'light' }); return; }
      if (guestStay === 'yes' && !guestRoom.trim()) { brandAlert('Please add your room number.', { theme: 'light' }); return; }
      if (guestStay === 'booked' && customerPhone.replace(/\D/g, '').length < 10) { brandAlert('Please add the phone number you booked with, so the front desk can find your booking.', { theme: 'light' }); return; }
    }
    if (goingHome && visitAddr.trim().length < 6) { brandAlert(`Please add the address ${sk === 'repairs' ? 'they should come to' : 'for your home service'}.`, { theme: 'light' }); return; }
    if (sk === 'repairs' && cartHasService && orderNote.trim().length < 3) { brandAlert("Please say what's wrong, so they can get ready for it.", { theme: 'light', title: "What's wrong?" }); return; }
    if (projectReq && orderNote.trim().length < 3) { brandAlert('Please describe what you need in a few words, so they can give you a price.', { theme: 'light', title: 'Your brief' }); return; }
    if (sk === 'events' && cartHasService && usesSlots && apptSlot && eventInfo.venue.trim().length < 4) { brandAlert('Please add where the event is.', { theme: 'light', title: 'Venue' }); return; }
    if (laundryOut && laundryOpts.length) {
      if (!laundryWay) { brandAlert('Please choose how we get your laundry.', { theme: 'light' }); return; }
      if (laundryWay === 'collect' && deliverAddr.trim().length < 6) { brandAlert('Please add the address to collect your laundry from.', { theme: 'light' }); return; }
    }
    setSubmitting(true);
    try {
      // Only product IDs + quantities are sent — the database looks up the real prices itself
      const items = cartList.map((c) => ({ productId: c.product.id, quantity: c.qty, ...(c.variant ? { variant: c.variant } : {}), ...(c.custom ? { custom: c.custom } : {}), ...(c.guest ? { for: c.guest } : {}), ...(hasGuests && guestPick[c.guest || ''] && storeKind(c.product) === 'service' ? { with: guestPick[c.guest || ''] } : {}) }));
      const when = usesSlots && apptSlot
        ? (sk === 'repairs' ? `${apptDay(apptSlot)}, ${apptTime(apptSlot)}` : `${apptDay(apptSlot)}, ${apptTime(apptSlot)} to ${apptTime(calEndOf(apptCal, apptSlot))}`)
        : projectReq ? (deadline ? `Needed by ${new Date(`${deadline}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}` : '')
        : preferredTime ? new Date(preferredTime).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
      const lway = laundryOut && laundryOpts.some(([v]) => v === laundryWay) ? laundryWay : '';
      const laundryNote = lway === 'collect' || (svcKinds.includes('laundry') && askHow && fulfilMode === 'delivery') ? LAUNDRY_COLLECT_NOTE : lway === 'drop' ? LAUNDRY_DROP_NOTE : '';
      const fullAddr = `${deliverAddr.trim()}${deliverLandmark.trim() ? ` (near ${deliverLandmark.trim().replace(/^(near|opposite|beside)\s+/i, '')})` : ''}`;
      const orderArgs = { p_shop_id: business.shop_id || null, p_business_code: businessCode, p_customer_name: customerName.trim(), p_customer_phone: customerPhone.trim(), p_items: items, p_preferred_time: when, p_note: [askStay && guestStay === 'booked' ? BOOKED_GUEST_NOTE : '', laundryNote, orderNote.trim()].filter(Boolean).join(' ').trim(), ...(usesSlots && apptSlot ? { p_start_at: apptSlot, ...(apptPerson ? { p_person: apptPerson } : {}) } : {}), ...(discount ? { p_discount_code: discount.code } : {}), ...(askHow && fulfilMode ? { p_mode: fulfilMode } : {}), ...(askHow && fulfilMode === 'room' ? { p_room: guestRoom.trim() } : {}), ...(askStay && guestStay === 'yes' ? { p_mode: 'room', p_room: guestRoom.trim() } : {}), ...(askHow && fulfilMode === 'delivery' && zoneId && zoneId !== 'other' ? { p_zone: zoneId } : {}), ...(askHow && fulfilMode === 'delivery' ? { p_address: fullAddr } : {}), ...(lway === 'collect' ? { p_mode: 'delivery', p_address: fullAddr } : lway === 'drop' ? { p_mode: 'pickup' } : {}), ...(goingHome ? { p_visit: 'home', p_address: visitAddr.trim() } : {}), ...(sk === 'events' && cartHasService ? { p_event: { venue: eventInfo.venue.trim(), type: eventInfo.type, guests: eventInfo.guests ? Number(eventInfo.guests) : null } } : {}) };
      // Orders get the customer's own page (track it, pay online once confirmed). Appointments keep their own flow.
      let placed = null;
      try { placed = await sbRpc('place_order_v2', SB_KEY, orderArgs); }
      catch (e) {
        if (!/place_order_v2|does not exist|schema cache/i.test(e.message || '')) throw e;
        // An older database: keep the home visit and event details in the note
        const { p_visit, p_event, ...v2 } = orderArgs;
        const extraNote = [p_visit === 'home' ? `Come to: ${visitAddr.trim()}` : '', p_event ? [p_event.type, p_event.venue && `Venue: ${p_event.venue}`, p_event.guests && `${p_event.guests} guests`].filter(Boolean).join(', ') : ''].filter(Boolean).join(' · ');
        const withNote = { ...v2, p_note: [v2.p_note, extraNote].filter(Boolean).join(' · ') };
        if (p_visit === 'home') { delete withNote.p_address; }
        try { if (!(p_visit || p_event)) throw e; placed = await sbRpc('place_order_v2', SB_KEY, withNote); }
        catch (e2) {
          if (!/place_order_v2|does not exist|schema cache/i.test(e2.message || '')) throw e2;
          const { p_room, p_mode, p_address, p_zone, ...older } = withNote;
          await sbRpc('place_order', SB_KEY, { ...older, p_note: [older.p_note, p_mode === 'delivery' ? `Deliver to: ${p_address}` : p_mode === 'room' ? `Room ${p_room}` : p_mode === 'pickup' ? 'Pick-up' : ''].filter(Boolean).join(' · ') });
        }
      }
      if (placed?.token && !(usesSlots && apptSlot)) {
        setThanks({ kind: 'order', name: customerName.trim(), phone: customerPhone.trim(), link: `/order/${placed.token}`, total: payable,
          lines: cartList.map((c) => `${c.product.name}${lineLabel(c) ? ` (${lineLabel(c)})` : ''}${c.qty > 1 ? ` ×${c.qty}` : ''}${forText(c)}`),
          when: when || '', room: (askHow && fulfilMode === 'room') || (askStay && guestStay === 'yes') ? guestRoom.trim() : '', service: isService || cartHasService || svcExtras.length > 0 });
        setShowCheckout(false); setCart({}); setParty([]); setForEdit(null); setGuestPick({}); setOrderNote(''); setPreferredTime(''); setGuestStay(''); setLaundryWay(''); setDeadline(''); setEventInfo({ type: '', venue: '', guests: '' });
        setSubmitting(false);   // so "Keep exploring" goes back to a working store, not a stuck "Sending…"
        return;
      }
      const who = usesSlots && apptSlot && apptPerson ? (apptCal.people || []).find((p) => p.id === apptPerson)?.name : '';
      setSentWhen(usesSlots && apptSlot ? `${when}${who ? `, with ${who}` : ''}` : '');
      if (business.owner_phone) {
        const lines = cartList.map((c) => `• ${c.product.name}${lineLabel(c) ? ` (${lineLabel(c)})` : ''}${lineQtyText(c)}${forText(c)} — ${fmt(linePrice(c) * c.qty)}`).join('\n');
        const extra = `${homeFee > 0 ? `\n${sk === 'repairs' ? 'Call-out fee' : 'Home service'}: ${fmt(homeFee)}` : ''}${goingHome ? `\nCome to: ${visitAddr.trim()}` : ''}${sk === 'events' && cartHasService && (eventInfo.venue.trim() || eventInfo.type) ? `\nEvent: ${[eventInfo.type, eventInfo.venue.trim() && `at ${eventInfo.venue.trim()}`, eventInfo.guests && `${eventInfo.guests} guests`].filter(Boolean).join(', ')}` : ''}${lway === 'collect' ? `\nCollect the laundry from: ${orderArgs.p_address}` : lway === 'drop' ? "\nWill drop the laundry off" : ''}${askHow && fulfilMode === 'delivery' ? `\nDeliver to: ${orderArgs.p_address}` : (askHow && fulfilMode === 'room') || (askStay && guestStay === 'yes') ? `\nRoom: ${guestRoom.trim()}` : askHow && fulfilMode === 'pickup' ? '\nPick-up' : ''}${when ? `\n${projectReq ? 'Deadline' : sk === 'repairs' ? (goingHome ? 'Visit' : 'Drop-off') : 'Preferred time'}: ${when.replace(/^Needed by /, '')}` : ''}${orderNote.trim() ? `\n${sk === 'repairs' ? 'The problem' : projectReq ? 'Brief' : 'Note'}: ${orderNote.trim()}` : ''}`;
        const shopLabel = storeShops.length > 1 ? ` for ${displayLocationName(currentStoreShop, locationWords(business?.business_type, business?.service_kind))}` : '';
        const msg = `New ${sk === 'repairs' && cartHasService ? 'repair job' : projectReq ? 'project request' : isService || cartHasService ? 'request' : 'order'}${shopLabel} from ${customerName.trim()}${customerPhone ? ` (${customerPhone.trim()})` : ''}:\n\n${lines}${discountOff ? `\n\nSubtotal: ${fmt(cartTotal)}\nDiscount (${discount.code}): ${fmt(-discountOff)}` : ''}\n\nTotal: ${fmt(payable)}${extra}`;
        window.open(`https://wa.me/${toWhatsAppNumber(business.owner_phone)}?text=${encodeURIComponent(msg)}`, '_blank');
      }
      setOrderSent(true);
      setShowCheckout(false);
    } catch (e) {
      if (/code|fully used|expired|orders of/i.test(e.message || '')) { setDiscount(null); setCodeOpen(true); setCodeError(e.message); brandAlert(`${e.message} Your ${W.short.toLowerCase()} wasn't sent. Remove the code or try another, then send again.`, { theme: 'light', title: 'Discount code' }); }
      else if (/too many|requests waiting|receiving a lot|phone number|address|room number|how you want|sold out|left\. Please|Please choose the/i.test(e.message || '')) brandAlert(e.message, { theme: 'light' });
      else if (/time|closed|opening hours|booked/i.test(e.message || '')) { brandAlert(e.message, { theme: 'light', title: 'Please pick another time' }); setApptSlot(''); loadStoreCalendar(); }
      else brandAlert(`Your ${W.short.toLowerCase()} didn't go through. Check your connection and tap ${W.send} again.`, { theme: 'light' });
    }
    setSubmitting(false);
  };

  const isService = business?.business_type === 'services';
  const searchWord = business?.business_type === 'services' ? (business?.service_kind === 'accommodation' ? 'Search rooms' : 'Search services') : business?.business_type === 'both' ? 'Search' : 'Search products';
  const W = isService
    ? { your: 'Your request', send: 'Send request', view: 'View request', sent: 'Request sent to', short: 'Request', inYour: 'your request', empty: 'Tap Request on anything you need, and it shows up here.' }
    : { your: 'Your order', send: 'Send order', view: 'View order', sent: 'Order sent to', short: 'Order', inYour: 'your order', empty: 'Tap Add on anything you like, and it shows up here.' };
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
  if (bookingSent) {
    return (
      <div className="flex flex-col items-center justify-center px-6 text-center" style={page}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: S.ink }}><Check size={26} color="#fff" /></div>
        <div className="text-[24px] font-bold mb-2">Booking request sent</div>
        <div className="text-[15px] font-semibold mb-1">{bookingSent.item}{bookingSent.units > 1 ? ` × ${bookingSent.units}` : ''}</div>
        <div className="text-[14px] mb-1" style={{ color: S.muted }}>{bookingSent.dates} · {bookingSent.nights}</div>
        <div className="text-[18px] font-bold mb-4" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(bookingSent.total)}</div>
        <div className="text-[14px] max-w-sm mb-8 leading-relaxed" style={{ color: S.muted }}>{business.name} has 24 hours to confirm. Your dates are held for you until then, and they'll contact you{bookingSent.phone ? ` on ${bookingSent.phone}` : ''} about payment.</div>
        <button onClick={() => setBookingSent(null)} className={`px-6 py-3 rounded-full text-[14px] font-semibold ${focusRing}`} style={{ border: `1.5px solid ${S.ink}` }}>Back to {business.name}</button>
      </div>
    );
  }
  if (orderSent) {
    return (
      <div className="flex flex-col items-center justify-center px-6 text-center" style={page}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: S.ink }}><Check size={26} color="#fff" /></div>
        <div className="text-[24px] font-bold mb-2">{W.sent} {business.name}</div>
        {sentWhen && <div className="text-[15px] font-semibold mb-2">{sentWhen}</div>}
        <div className="text-[14px] max-w-sm mb-8" style={{ color: S.muted }}>{sentWhen ? `This ${business.service_kind === 'events' ? 'date' : 'time'} is held for you. ${business.name} will confirm it${customerPhone ? ` on ${customerPhone}` : ''} soon.` : `They'll contact you${customerPhone ? ` on ${customerPhone}` : ''} to confirm ${W.inYour} and arrange payment${isService ? '' : ' and delivery'}.`}</div>
        <button onClick={() => { setOrderSent(false); setCart({}); setParty([]); setForEdit(null); setGuestPick({}); }} className={`px-6 py-3 rounded-full text-[14px] font-semibold ${focusRing}`} style={{ border: `1.5px solid ${S.ink}` }}>Back to the store</button>
      </div>
    );
  }

  const renderThanks = () => {
    if (!thanks) return null;
    const t = thanks; const first = String(t.name || '').split(' ')[0];
    const payNow = t.kind === 'booking' && t.deposit > 0 && bookTerms?.online_pay;
    const steps = t.kind === 'booking'
      ? [`${business.name} confirms your booking, usually within 24 hours. Your ${t.when.includes('·') ? 'dates are' : 'date is'} held until then.`,
         `They'll reach you on WhatsApp or by phone${t.phone ? ` at ${t.phone}` : ''}.`,
         t.deposit > 0 ? (payNow ? `Pay the ${fmt(t.deposit)} deposit online to confirm it straight away, or pay it later from your booking page.` : `Pay the ${fmt(t.deposit)} deposit the way they tell you, to secure it.`) : 'Pay when you arrive, or as they tell you.']
      : [`${business.name} checks your ${t.service ? 'request' : 'order'}${t.when ? (/^Needed by/.test(t.when) ? ` (${t.when.replace(/^Needed/, 'needed')})` : ` for ${t.when}`) : ''}${business.service_kind === 'professional' && t.service ? ' and replies with the price' : ''}.`,
         t.room ? `It goes on your room ${t.room} bill, paid at check-out.` : `They'll message you${t.phone ? ` on ${t.phone}` : ''} to confirm${bookTerms?.online_pay ? ', then you can pay online by card, transfer or USSD, or pay them directly' : ' and arrange payment'}.`,
         'Follow it any time from your page.'];
    const saveLink = `${window.location.origin}${t.link}`;
    return (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-5" style={{ background: 'rgba(23,25,26,0.55)' }} onClick={() => setThanks(null)}>
        <div role="dialog" aria-modal="true" aria-label="Thank you" className="w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] px-5 pt-6 pb-5 max-h-[92vh] overflow-y-auto" style={{ background: '#fff', color: S.ink, paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: S.ink, boxShadow: '0 0 0 8px rgba(23,25,26,0.06)' }}><Check size={30} color="#fff" strokeWidth={2.6} /></div>
            <div className="text-[23px] font-bold mt-4 leading-tight">Thank you{first ? `, ${first}` : ''}!</div>
            <div className="text-[14px] mt-1" style={{ color: S.muted }}>Your {t.kind === 'booking' ? 'booking request' : t.service ? 'request' : 'order'} is with {business.name}.</div>
          </div>
          <div className="rounded-2xl px-4 py-3.5 mt-5" style={{ background: S.tile }}>
            {t.lines.slice(0, 4).map((l) => <div key={l} className="text-[14.5px] font-semibold leading-snug">{l}</div>)}
            {t.lines.length > 4 && <div className="text-[13px]" style={{ color: S.muted }}>and {t.lines.length - 4} more</div>}
            {t.when && <div className="text-[13px] mt-1" style={{ color: S.muted }}>{t.when}</div>}
            <div className="flex items-baseline justify-between mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${S.line}` }}>
              <span className="text-[13px]" style={{ color: S.muted }}>Total</span>
              <span className="text-[18px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t.total)}</span>
            </div>
            {t.deposit > 0 && <div className="flex items-baseline justify-between mt-1"><span className="text-[13px]" style={{ color: S.muted }}>Deposit to secure it</span><span className="text-[14px] font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t.deposit)}</span></div>}
          </div>
          <div className="mt-4">
            <div className="text-[13px] font-semibold mb-2">What happens next</div>
            <div className="space-y-2">{steps.map((x, i) => (
              <div key={i} className="flex gap-3 text-[13px] leading-relaxed"><span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5" style={{ background: S.tile }}>{i + 1}</span><span style={{ color: S.ink }}>{x}</span></div>
            ))}</div>
          </div>
          <div className="mt-5 space-y-2">
            {payNow && <a href={t.link} className={`w-full h-12 rounded-xl text-[14.5px] font-semibold flex items-center justify-center gap-2 ${focusRing}`} style={{ background: S.ink, color: '#fff' }}>Pay {fmt(t.deposit)} deposit now</a>}
            <button onClick={() => setThanks(null)} className={`w-full h-12 rounded-xl text-[14.5px] font-semibold ${focusRing}`} style={payNow ? { border: `1.5px solid ${S.line}`, color: S.ink } : { background: S.ink, color: '#fff' }}>Keep exploring {business.name}</button>
            <div className="flex items-center justify-center gap-4 pt-1.5 text-[13px] font-semibold">
              {!payNow && <a href={t.link} className="underline underline-offset-4" style={{ color: S.ink }}>{t.kind === 'booking' ? 'View my booking' : 'Track it'}</a>}
              {t.phone && String(t.phone).replace(/\D/g, '').length >= 10 && <a href={`https://wa.me/${toWhatsAppNumber(t.phone)}?text=${encodeURIComponent(`My ${t.kind === 'booking' ? 'booking' : t.service ? 'request' : 'order'} at ${business.name}: ${saveLink}`)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" style={{ color: S.muted }}>Save the link to my WhatsApp</a>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const kindWords = SERVICE_KINDS[business.service_kind] || {};
  const anyNightly = storeProducts.some((p) => p.priceUnit === 'night');
  const inLabel = kindWords.checkIn || (anyNightly ? 'Check in' : 'From');
  const outLabel = kindWords.checkOut || (anyNightly ? 'Check out' : 'Until');
  const todayStr = new Date().toISOString().slice(0, 10);
  const plusDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const stayNights = datesValid ? Math.round((new Date(stayOut + 'T00:00:00Z') - new Date(stayIn + 'T00:00:00Z')) / 86400000) : 0;
  const prettyDay = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const unitWordOf = (p) => (p.priceUnit === 'day' ? 'day' : 'night');
  const renderDateBar = () => (
    <div id="xorla-dates" className="rounded-3xl p-4 mb-6 transition-shadow" style={{ background: '#fff', boxShadow: dateNudge ? `0 0 0 3px ${S.ink}` : '0 8px 30px rgba(23,25,26,0.08)', border: `1px solid ${S.line}` }}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[12px] font-semibold mb-1" style={{ color: S.muted }}>{inLabel}</span>
          <input type="date" min={todayStr} value={stayIn} onChange={(e) => { setStayIn(e.target.value); setDateNudge(false); if (!stayOut || stayOut <= e.target.value) setStayOut(plusDays(e.target.value, 1)); }} className={`w-full rounded-xl px-3 py-2.5 text-[15px] font-semibold ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
        </label>
        <label className="block">
          <span className="block text-[12px] font-semibold mb-1" style={{ color: S.muted }}>{outLabel}</span>
          <input type="date" min={stayIn ? plusDays(stayIn, 1) : todayStr} value={stayOut} onChange={(e) => { setStayOut(e.target.value); setDateNudge(false); }} className={`w-full rounded-xl px-3 py-2.5 text-[15px] font-semibold ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
        </label>
      </div>
      <div className="text-[13px] mt-3" style={{ color: S.muted }}>
        {datesValid ? <><strong style={{ color: S.ink }}>{stayNights} {anyNightly ? 'night' : 'day'}{stayNights !== 1 ? 's' : ''}</strong> · {prettyDay(stayIn)} to {prettyDay(stayOut)}. Prices and availability below are for these dates.</> : 'Choose your dates to see prices and what\'s available.'}
      </div>
    </div>
  );
  const askForDates = () => { setDateNudge(true); document.getElementById('xorla-dates')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const openBook = (p) => {
    if (!datesValid) { askForDates(); return; }
    setBookError(''); setBookUnits(1); setBookItem(p);
    if (rentsByDay(p)) { const t = (bookTerms?.checkin_time || '09:00').slice(0, 5); setBookTimes({ pickup: t, ret: t }); } else setBookTimes({ pickup: '', ret: '' });
  };
  const renderBookableCard = (p) => {
    const free = datesValid ? (stayFree[p.id] ?? null) : null;
    const full = free !== null && free <= 0;
    return (
      <div className="flex flex-col">
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-3 flex items-center justify-center" style={{ background: S.tile }}>
          {p.imageUrl ? <img src={p.imageUrl} alt={p.name} loading="lazy" className="w-full h-full object-cover" style={full ? { opacity: 0.5, filter: 'grayscale(1)' } : {}} /> : <Sparkles size={30} style={{ color: S.soldOut }} />}
          {full && <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#fff', color: S.muted }}>Booked for these dates</span>}
          {!full && free !== null && free <= 2 && <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#fff', color: S.ink }}>Only {free} left for your dates</span>}
        </div>
        <div className="text-[15px] font-semibold leading-snug" style={{ color: full ? S.muted : S.ink }}>{p.name}</div>
        {p.description && <div className="text-[13px] leading-snug mt-1 line-clamp-2" style={{ color: S.muted }}>{p.description}</div>}
        <div className="mt-2">
          <span className="text-[16px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.sellingPrice)}</span>
          <span className="text-[13px]" style={{ color: S.muted }}> / {unitWordOf(p)}</span>
          {datesValid && <div className="text-[13px] mt-0.5" style={{ color: S.ink }}>{stayNights} {unitWordOf(p)}{stayNights !== 1 ? 's' : ''}: <strong>{fmt(p.sellingPrice * stayNights)}</strong></div>}
        </div>
        <div className="flex-1 min-h-[12px]" />
        <button onClick={() => !full && openBook(p)} disabled={full} className={`w-full py-2.5 rounded-xl text-[14px] font-semibold ${focusRing}`} style={full ? { background: S.tile, color: S.soldOut } : { background: S.ink, color: '#fff' }}>
          {full ? 'Not available' : datesValid ? 'Book' : 'Choose dates to book'}
        </button>
      </div>
    );
  };
  const submitBooking = async () => {
    if (!bookName.trim()) { setBookError('Please enter your name.'); return; }
    if (bookPhone.replace(/[^0-9]/g, '').length < 10) { setBookError('Please enter your phone number, so they can confirm your booking.'); return; }
    setBookBusy(true); setBookError('');
    try {
      if (rentsByDay(bookItem) && !bookTimes.pickup) throw new Error('Please choose when you will pick it up.');
      const timed = rentsByDay(bookItem) && bookTimes.pickup && bookTimes.ret;
      const timeNote = timed ? `Pick up ${hhmmLabel(bookTimes.pickup)}, return by ${hhmmLabel(bookTimes.ret)}` : '';
      const args = { p_business_code: businessCode, p_shop_id: business.shop_id || null, p_product_id: bookItem.id, p_check_in: stayIn, p_check_out: stayOut, p_units: bookUnits, p_name: bookName.trim(), p_phone: bookPhone.trim(), p_note: bookNote.trim() };
      let placed = null;
      try { placed = await sbRpc('place_booking_v2', SB_KEY, timed ? { ...args, p_pickup: bookTimes.pickup, p_return: bookTimes.ret } : args); }
      catch (e) {
        if (!/place_booking_v2|schema cache|function/i.test(e.message || '')) throw e;
        // An older database: keep the times in the note
        const older = { ...args, p_note: [args.p_note, timeNote].filter(Boolean).join(' · ') };
        try { placed = await sbRpc('place_booking_v2', SB_KEY, older); }
        catch (e2) { if (/place_booking_v2|schema cache|function/i.test(e2.message || '')) await sbRpc('place_booking', SB_KEY, older); else throw e2; }
      }
      const total = bookItem.sellingPrice * stayNights * bookUnits;
      const nightsText = `${stayNights} ${unitWordOf(bookItem)}${stayNights !== 1 ? 's' : ''}`;
      if (business.owner_phone && !placed?.token) {
        const msg = `New booking request from ${bookName.trim()}${bookPhone ? ` (${bookPhone.trim()})` : ''}:\n\n${bookItem.name}${bookUnits > 1 ? ` × ${bookUnits}` : ''}\n${prettyDay(stayIn)}${timed ? `, ${hhmmLabel(bookTimes.pickup)}` : ''} to ${prettyDay(stayOut)}${timed ? `, ${hhmmLabel(bookTimes.ret)}` : ''} (${nightsText})\nTotal: ${fmt(total)}${bookNote.trim() ? `\nNote: ${bookNote.trim()}` : ''}\n\nThe dates are held for 24 hours. Confirm it in Xorla.`;
        window.open(`https://wa.me/${toWhatsAppNumber(business.owner_phone)}?text=${encodeURIComponent(msg)}`, '_blank');
      }
      if (placed?.token) {
        const pct = Number(bookTerms?.deposit_percent ?? 0), cap = Number(bookTerms?.deposit_cap_nights ?? 0);
        const dep = pct > 0 ? Math.round(cap > 0 ? Math.min(total * pct / 100, bookItem.sellingPrice * bookUnits * cap) : total * pct / 100) : 0;
        setThanks({ kind: 'booking', name: bookName.trim(), phone: bookPhone.trim(), link: `/booking/${placed.token}`, total, deposit: dep,
          lines: [`${bookItem.name}${bookUnits > 1 ? ` × ${bookUnits}` : ''}`], when: `${prettyDay(stayIn)} to ${prettyDay(stayOut)} · ${nightsText}` });
        setBookItem(null); setBookName(''); setBookPhone(''); setBookNote('');
        return;
      }
      setBookingSent({ item: bookItem.name, units: bookUnits, dates: `${prettyDay(stayIn)} to ${prettyDay(stayOut)}`, nights: nightsText, total, phone: bookPhone.trim() });
      setBookItem(null); setBookName(''); setBookPhone(''); setBookNote('');
    } catch (e) { setBookError(e.message); }
    finally { setBookBusy(false); }
  };
  const renderBookSheet = () => {
    if (!bookItem) return null;
    const free = stayFree[bookItem.id] ?? bookItem.units ?? 1;
    const maxUnits = Math.max(1, Math.min(20, free));
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-5" style={{ background: 'rgba(23,25,26,0.5)' }} onClick={() => !bookBusy && setBookItem(null)}>
        <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[92vh] overflow-y-auto" style={{ background: '#fff', color: S.ink }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="text-[20px] font-bold leading-tight">{bookItem.name}</div>
            <button onClick={() => setBookItem(null)} aria-label="Close" className={focusRing} style={{ color: S.muted }}><X size={20} /></button>
          </div>
          <div className="text-[14px] mb-5" style={{ color: S.muted }}>{prettyDay(stayIn)} to {prettyDay(stayOut)} · {stayNights} {unitWordOf(bookItem)}{stayNights !== 1 ? 's' : ''}</div>
          {maxUnits > 1 && (
            <div className="flex items-center justify-between rounded-2xl px-4 py-3 mb-4" style={{ background: S.tile }}>
              <span className="text-[14px] font-semibold">How many</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setBookUnits(Math.max(1, bookUnits - 1))} aria-label="One fewer" className={`w-9 h-9 rounded-full text-[18px] font-semibold ${focusRing}`} style={{ background: '#fff' }}>−</button>
                <span className="text-[16px] font-bold w-5 text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>{bookUnits}</span>
                <button onClick={() => setBookUnits(Math.min(maxUnits, bookUnits + 1))} aria-label="One more" disabled={bookUnits >= maxUnits} className={`w-9 h-9 rounded-full text-[18px] font-semibold ${focusRing}`} style={{ background: '#fff', opacity: bookUnits >= maxUnits ? 0.35 : 1 }}>+</button>
              </div>
            </div>
          )}
          {rentsByDay(bookItem) && (() => {
            const today = new Date().toLocaleDateString('sv-SE', LAGOS_TIME);
            const nowHm = new Date().toLocaleTimeString('en-GB', { ...LAGOS_TIME, hour: '2-digit', minute: '2-digit', hour12: false });
            const pickOpts = HALF_HOURS.filter((t) => stayIn !== today || t > nowHm);
            const sel = { background: S.tile, border: 'none', color: S.ink };
            const late = bookTimes.pickup && bookTimes.ret && bookTimes.ret > bookTimes.pickup;
            return (
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[13px] font-semibold" htmlFor="bk-pickup">Pick up
                    <span className="block text-[12px] font-normal mb-1" style={{ color: S.muted }}>{prettyDay(stayIn)}</span>
                    <select id="bk-pickup" value={bookTimes.pickup} onChange={(e) => setBookTimes({ ...bookTimes, pickup: e.target.value })} className={`w-full rounded-xl px-3 py-3 text-[15px] ${focusRing}`} style={sel}>
                      {!pickOpts.includes(bookTimes.pickup) && <option value="">Choose a time</option>}
                      {pickOpts.map((t) => <option key={t} value={t}>{hhmmLabel(t)}</option>)}
                    </select>
                  </label>
                  <label className="block text-[13px] font-semibold" htmlFor="bk-return">Bring it back
                    <span className="block text-[12px] font-normal mb-1" style={{ color: S.muted }}>{prettyDay(stayOut)}</span>
                    <select id="bk-return" value={bookTimes.ret} onChange={(e) => setBookTimes({ ...bookTimes, ret: e.target.value })} className={`w-full rounded-xl px-3 py-3 text-[15px] ${focusRing}`} style={sel}>
                      {HALF_HOURS.map((t) => <option key={t} value={t}>{hhmmLabel(t)}</option>)}
                    </select>
                  </label>
                </div>
                <div className="text-[12px] mt-1.5 leading-relaxed" style={{ color: late ? '#B54708' : S.muted }}>{late ? `That's later than your pick-up time, so ${business.name} may count an extra day. They'll confirm.` : `Each ${unitWordOf(bookItem)} runs from your pick-up time to the same time the next day.`}</div>
              </div>
            );
          })()}
          <label className="block text-[13px] font-semibold mb-1.5" htmlFor="bk-name">Your name</label>
          <input id="bk-name" value={bookName} onChange={(e) => setBookName(e.target.value)} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-3 ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
          <label className="block text-[13px] font-semibold mb-1.5" htmlFor="bk-phone">Phone number</label>
          <input id="bk-phone" type="tel" value={bookPhone} onChange={(e) => setBookPhone(e.target.value)} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-3 ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
          <label className="block text-[13px] font-semibold mb-1.5" htmlFor="bk-note">Anything they should know? <span className="font-normal" style={{ color: S.muted }}>(optional)</span></label>
          <textarea id="bk-note" rows={2} value={bookNote} onChange={(e) => setBookNote(e.target.value)} placeholder="e.g. Arriving late, need an extra bed" className={`w-full rounded-xl px-4 py-3 text-[15px] mb-4 resize-none ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
          <div className="flex items-center justify-between py-3 mb-1" style={{ borderTop: `1px solid ${S.line}` }}>
            <span className="text-[14px]" style={{ color: S.muted }}>{fmt(bookItem.sellingPrice)} × {stayNights}{bookUnits > 1 ? ` × ${bookUnits}` : ''}</span>
            <span className="text-[20px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(bookItem.sellingPrice * stayNights * bookUnits)}</span>
          </div>
          {(() => {
            const total = bookItem.sellingPrice * stayNights * bookUnits;
            const pct = Number(bookTerms?.deposit_percent ?? 0), cap = Number(bookTerms?.deposit_cap_nights ?? 0);
            const dep = pct > 0 ? Math.round(cap > 0 ? Math.min(total * pct / 100, bookItem.sellingPrice * bookUnits * cap) : total * pct / 100) : 0;
            const hrs = Number(bookTerms?.cancel_window_hours ?? 24);
            return (
              <div className="rounded-2xl px-4 py-3.5 mb-4 space-y-2 text-[13px]" style={{ background: S.tile }}>
                {bookTerms && dep > 0 ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3"><span className="font-semibold">Deposit to secure it</span><span className="text-[16px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(dep)}</span></div>
                    <div className="flex items-baseline justify-between gap-3" style={{ color: S.muted }}><span>Pay at check-in</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(total - dep)}</span></div>
                    <div className="pt-1 leading-relaxed" style={{ color: S.muted }}>{bookTerms.online_pay ? 'Nothing to pay right now. Send the request, then pay the deposit on the next page by card, transfer or USSD, and your booking confirms straight away.' : 'Nothing to pay right now. Send the request first; your dates are held for 24 hours, and the next page shows how to pay the deposit.'}</div>
                  </>
                ) : <div className="leading-relaxed" style={{ color: S.muted }}>No payment now. Your dates are held for 24 hours while {business.name} confirms.</div>}
                {bookTerms && <div className="flex items-start gap-2 pt-1 leading-relaxed"><ShieldCheck size={15} className="shrink-0 mt-0.5" style={{ color: '#0E7A5F' }} /><span>Check-in from {hhmmLabel(bookTerms.checkin_time || '14:00')}, check-out by {hhmmLabel(bookTerms.checkout_time || '12:00')}. Free cancellation until {hrs} hours before check-in.{dep > 0 ? ' After that, the deposit is not refunded.' : ''}</span></div>}
              </div>
            );
          })()}
          {bookError && <div className="text-[13px] rounded-xl px-4 py-3 mb-3" style={{ background: '#FDECEA', color: '#B42318' }}>{bookError}</div>}
          <button onClick={submitBooking} disabled={bookBusy} className={`w-full py-3.5 rounded-xl text-[15px] font-semibold ${focusRing}`} style={{ background: S.ink, color: '#fff', opacity: bookBusy ? 0.6 : 1 }}>{bookBusy ? 'Sending…' : 'Request booking'}</button>
        </div>
      </div>
    );
  };
  const hasStoreBookables = business.business_type !== 'products' && storeProducts.some((p) => isBookable(p) && !p.isSpace);
  const openSpace = (p) => { setBookError(''); setSpaceAsk({ date: '', mode: 'day', days: 1, start: '10:00', end: '14:00', guests: '', event: '' }); setSpaceTaken([]); setSpaceItem(p); };
  const spaceHours = (a) => Math.max(0, ((Number(a.end.slice(0, 2)) * 60 + Number(a.end.slice(3, 5))) - (Number(a.start.slice(0, 2)) * 60 + Number(a.start.slice(3, 5)))) / 60);
  const renderSpaceCard = (p) => (
    <div className="flex flex-col">
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-3 flex items-center justify-center" style={{ background: S.tile }}>
        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} loading="lazy" className="w-full h-full object-cover" /> : <Building2 size={30} style={{ color: S.soldOut }} />}
        {p.capacity ? <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#fff', color: S.ink }}>Holds {Number(p.capacity).toLocaleString('en-NG')} guests</span> : null}
      </div>
      <div className="text-[15px] font-semibold leading-snug">{p.name}</div>
      {p.description && <div className="text-[13px] leading-snug mt-1 line-clamp-2" style={{ color: S.muted }}>{p.description}</div>}
      <div className="mt-2">
        <span className="text-[16px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.sellingPrice)}</span><span className="text-[13px]" style={{ color: S.muted }}> / day</span>
        {p.hourPrice ? <div className="text-[13px] mt-0.5" style={{ color: S.ink }}>or <strong>{fmt(p.hourPrice)}</strong> an hour</div> : null}
      </div>
      <div className="flex-1 min-h-[12px]" />
      <button onClick={() => openSpace(p)} className={`w-full py-2.5 rounded-xl text-[14px] font-semibold ${focusRing}`} style={{ background: S.ink, color: '#fff' }}>Check dates & book</button>
    </div>
  );
  const submitSpace = async () => {
    const a = spaceAsk; const hourly = a.mode === 'hour' && spaceItem.hourPrice;
    if (!a.date) { setBookError('Choose the date of your event.'); return; }
    if (!bookName.trim()) { setBookError('Please enter your name.'); return; }
    if (bookPhone.replace(/[^0-9]/g, '').length < 10) { setBookError('Please enter your phone number, so they can confirm your booking.'); return; }
    setBookBusy(true); setBookError('');
    try {
      const placed = await sbRpc('place_space_booking', SB_KEY, { p_business_code: businessCode, p_shop_id: business.shop_id || null, p_product_id: spaceItem.id, p_date: a.date,
        p_days: hourly ? null : Math.max(1, Number(a.days) || 1), p_start: hourly ? a.start : null, p_end: hourly ? a.end : null,
        p_name: bookName.trim(), p_phone: bookPhone.trim(), p_note: bookNote.trim(), p_guests: Number(a.guests) > 0 ? Math.round(Number(a.guests)) : null, p_event: a.event.trim() });
      if (placed?.token) {
        const days = Math.max(1, Number(a.days) || 1);
        const total = hourly ? Math.round(spaceItem.hourPrice * spaceHours(a)) : spaceItem.sellingPrice * days;
        const pct = Number(bookTerms?.deposit_percent ?? 0);
        const prettyD = new Date(a.date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
        setThanks({ kind: 'booking', name: bookName.trim(), phone: bookPhone.trim(), link: `/booking/${placed.token}`, total, deposit: pct > 0 ? Math.round(total * pct / 100) : 0,
          lines: [`${spaceItem.name}${a.event ? ` · ${a.event}` : ''}`], when: hourly ? `${prettyD}, ${a.start} to ${a.end}` : `${prettyD}${days > 1 ? ` · ${days} days` : ''}` });
        setSpaceItem(null); setBookName(''); setBookPhone(''); setBookNote('');
        return;
      }
      setSpaceItem(null);
    } catch (e) { setBookError(e.message); }
    finally { setBookBusy(false); }
  };
  const renderSpaceSheet = () => {
    if (!spaceItem) return null;
    const p = spaceItem; const a = spaceAsk; const set = (patch) => setSpaceAsk({ ...a, ...patch });
    const hourly = a.mode === 'hour' && p.hourPrice;
    const days = Math.max(1, Number(a.days) || 1);
    const total = hourly ? Math.round(p.hourPrice * spaceHours(a)) : p.sellingPrice * days;
    const out = a.date ? new Date(new Date(a.date + 'T00:00:00Z').getTime() + (hourly ? 1 : days) * 86400000).toISOString().slice(0, 10) : '';
    const onDay = a.date ? spaceTaken.filter((x) => x.from <= a.date && a.date < x.to) : [];
    const clash = a.date && spaceTaken.find((x) => x.from < out && a.date < x.to && (!x.start || !hourly || (x.start < a.end && a.start < x.end)));
    const pct = Number(bookTerms?.deposit_percent ?? 0);
    const dep = pct > 0 ? Math.round(total * pct / 100) : 0;
    const hrs = Number(bookTerms?.cancel_window_hours ?? 24);
    const inputStyle = { background: S.tile, border: 'none', color: S.ink };
    const pretty = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-5" style={{ background: 'rgba(23,25,26,0.5)' }} onClick={() => !bookBusy && setSpaceItem(null)}>
        <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[92vh] overflow-y-auto" style={{ background: '#fff', color: S.ink }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="text-[20px] font-bold leading-tight">{p.name}</div>
            <button onClick={() => setSpaceItem(null)} aria-label="Close" className={focusRing} style={{ color: S.muted }}><X size={20} /></button>
          </div>
          <div className="text-[14px] mb-5" style={{ color: S.muted }}>{fmt(p.sellingPrice)} a day{p.hourPrice ? `, or ${fmt(p.hourPrice)} an hour` : ''}{p.capacity ? ` · holds ${Number(p.capacity).toLocaleString('en-NG')}` : ''}</div>
          <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sp-date">Date of your event</label>
          <input id="sp-date" type="date" min={todayKey()} value={a.date} onChange={(e) => set({ date: e.target.value })} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-3 ${focusRing}`} style={inputStyle} />
          {p.hourPrice ? (
            <div className="flex gap-1 p-1 rounded-xl mb-3" style={{ background: S.tile }}>
              {[['day', 'Full day'], ['hour', 'By the hour']].map(([v, l]) => <button key={v} type="button" onClick={() => set({ mode: v })} className={`flex-1 py-2 rounded-lg text-[13.5px] font-semibold ${focusRing}`} style={(hourly ? 'hour' : 'day') === v ? { background: '#fff', color: S.ink, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } : { color: S.muted }}>{l}</button>)}
            </div>
          ) : null}
          {hourly ? (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[['start', 'From'], ['end', 'Until']].map(([k, l]) => (
                <label key={k} className="block text-[13px] font-semibold">{l}
                  <select value={a[k]} onChange={(e) => set(k === 'start' ? { start: e.target.value, end: eventEndAfter(e.target.value, a.end) } : { end: e.target.value })} className={`w-full mt-1.5 rounded-xl px-3 py-3 text-[15px] ${focusRing}`} style={inputStyle}>
                    {EVENT_TIMES.filter((t) => (k === 'start' ? t < '24:00' : t > a.start)).map((t) => <option key={t} value={t}>{eventTimeLabel(t)}</option>)}
                  </select>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl px-4 py-3 mb-3" style={{ background: S.tile }}>
              <span className="text-[14px] font-semibold">How many days</span>
              <div className="flex items-center gap-3">
                <button onClick={() => set({ days: Math.max(1, days - 1) })} aria-label="One day fewer" className={`w-9 h-9 rounded-full text-[18px] font-semibold ${focusRing}`} style={{ background: '#fff' }}>−</button>
                <span className="text-[16px] font-bold w-5 text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>{days}</span>
                <button onClick={() => set({ days: Math.min(30, days + 1) })} aria-label="One more day" className={`w-9 h-9 rounded-full text-[18px] font-semibold ${focusRing}`} style={{ background: '#fff' }}>+</button>
              </div>
            </div>
          )}
          {a.date && (
            <div className="rounded-2xl px-4 py-3 mb-4 text-[13px]" style={clash ? { background: '#FDECEA', color: '#B42318' } : { background: '#E8F6F1', color: '#0E7A5F' }}>
              {clash
                ? <><strong>Not available then.</strong> {onDay.length ? `Booked on ${pretty(a.date)}: ${onDay.map((x) => (x.start ? `${eventTimeLabel(x.start)} to ${eventTimeLabel(x.end)}` : 'all day')).join(', ')}.` : 'Part of those days is already booked.'} Please choose another {hourly ? 'time or ' : ''}date.</>
                : <><strong>Available.</strong> {onDay.length ? `Also booked that day: ${onDay.map((x) => `${eventTimeLabel(x.start)} to ${eventTimeLabel(x.end)}`).join(', ')}.` : `${pretty(a.date)}${!hourly && days > 1 ? ` for ${days} days` : ''} is free.`}</>}
            </div>
          )}
          <div className="grid grid-cols-[1fr_100px] gap-2 mb-3">
            <label className="block text-[13px] font-semibold">What's the event?
              <input value={a.event} onChange={(e) => set({ event: e.target.value })} placeholder="e.g. Wedding, Meeting" className={`w-full mt-1.5 rounded-xl px-4 py-3 text-[15px] ${focusRing}`} style={inputStyle} />
            </label>
            <label className="block text-[13px] font-semibold">Guests
              <input type="number" min="1" inputMode="numeric" value={a.guests} onChange={(e) => set({ guests: e.target.value })} className={`w-full mt-1.5 rounded-xl px-3 py-3 text-[15px] ${focusRing}`} style={inputStyle} />
            </label>
          </div>
          {p.capacity && Number(a.guests) > p.capacity ? <div className="text-[12.5px] -mt-1.5 mb-3" style={{ color: '#B54708' }}>{p.name} holds up to {p.capacity} guests.</div> : null}
          <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sp-name">Your name</label>
          <input id="sp-name" value={bookName} onChange={(e) => setBookName(e.target.value)} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-3 ${focusRing}`} style={inputStyle} />
          <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sp-phone">Phone number</label>
          <input id="sp-phone" type="tel" value={bookPhone} onChange={(e) => setBookPhone(e.target.value)} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-3 ${focusRing}`} style={inputStyle} />
          <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sp-note">Anything they should know? <span className="font-normal" style={{ color: S.muted }}>(optional)</span></label>
          <textarea id="sp-note" rows={2} value={bookNote} onChange={(e) => setBookNote(e.target.value)} placeholder="e.g. Decorators arrive early, need a projector" className={`w-full rounded-xl px-4 py-3 text-[15px] mb-4 resize-none ${focusRing}`} style={inputStyle} />
          <div className="flex items-center justify-between py-3 mb-1" style={{ borderTop: `1px solid ${S.line}` }}>
            <span className="text-[14px]" style={{ color: S.muted }}>{hourly ? `${fmt(p.hourPrice)} × ${spaceHours(a)} hour${spaceHours(a) !== 1 ? 's' : ''}` : `${fmt(p.sellingPrice)} × ${days} day${days !== 1 ? 's' : ''}`}</span>
            <span className="text-[20px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</span>
          </div>
          <div className="rounded-2xl px-4 py-3.5 mb-4 space-y-2 text-[13px]" style={{ background: S.tile }}>
            {bookTerms && dep > 0 ? (
              <>
                <div className="flex items-baseline justify-between gap-3"><span className="font-semibold">Deposit to secure it</span><span className="text-[16px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(dep)}</span></div>
                <div className="flex items-baseline justify-between gap-3" style={{ color: S.muted }}><span>Balance before the event</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(total - dep)}</span></div>
                <div className="pt-1 leading-relaxed" style={{ color: S.muted }}>{bookTerms.online_pay ? 'Nothing to pay right now. Send the request, then pay the deposit on the next page and your booking confirms straight away.' : `Send the request, then pay the deposit to ${business.name}. Your date is held for 24 hours.`}</div>
              </>
            ) : <div className="leading-relaxed" style={{ color: S.muted }}>No payment now. Your date is held for 24 hours while {business.name} confirms.</div>}
            {bookTerms && <div className="flex items-start gap-2 pt-1 leading-relaxed"><ShieldCheck size={15} className="shrink-0 mt-0.5" style={{ color: '#0E7A5F' }} /><span>Free cancellation until {hrs} hours before your event starts.</span></div>}
          </div>
          {bookError && <div className="text-[13px] rounded-xl px-4 py-3 mb-3" style={{ background: '#FDECEA', color: '#B42318' }}>{bookError}</div>}
          <button onClick={submitSpace} disabled={bookBusy || !!clash || !a.date} className={`w-full py-3.5 rounded-xl text-[15px] font-semibold ${focusRing}`} style={{ background: S.ink, color: '#fff', opacity: bookBusy || clash || !a.date ? 0.5 : 1 }}>{bookBusy ? 'Sending…' : !a.date ? 'Choose a date' : clash ? 'Not available then' : 'Request booking'}</button>
        </div>
      </div>
    );
  };

  const renderProductCard = (p) => {
    if (p.isSpace) return renderSpaceCard(p);
    if (isBookable(p)) return renderBookableCard(p);
    const qty = cart[p.id] || 0;
    const svc = storeKind(p) === 'service';
    const svcAny = svc ? inCartOf(p.id) : 0;   // booked for anyone (the person booking, or someone with them)
    const opts = !svc && hasOptions(p);
    const inCart = opts ? inCartOf(p.id) : qty;
    const isOut = !svc && p.stockQuantity === 0 && !(opts && p.customChoice);
    const fewLeft = !svc && !opts && p.stockQuantity !== null && p.stockQuantity > 0 && p.stockQuantity <= 3;
    const colours = opts ? cleanOptions(p.options).find(isColourGroup) : null;
    return (
      <div className="group flex flex-col">
        <button type="button" onClick={() => openItem(p)} aria-label={`See ${p.name}`} className={`relative w-full ${svc ? 'aspect-square' : 'aspect-[4/5]'} rounded-2xl overflow-hidden mb-3 flex items-center justify-center ${focusRing}`} style={{ background: S.tile }}>
          {p.imageUrl
            ? <img src={p.imageUrl} alt={p.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" style={isOut ? { opacity: 0.45, filter: 'grayscale(1)' } : {}} />
            : svc ? <Sparkles size={30} style={{ color: S.soldOut }} /> : <Package size={32} style={{ color: S.soldOut }} />}
          {(p.images || []).length > 0 && <span className="absolute bottom-2.5 right-2.5 px-2 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.92)', color: S.ink }}><Camera size={12} /> {(p.images || []).length + 1}</span>}
          {isOut && <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#fff', color: S.muted }}>Sold out</span>}
          {fewLeft && <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#fff', color: S.ink }}>Only {p.stockQuantity} left</span>}
          {svc && p.duration && <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1" style={{ background: '#fff', color: S.ink }}>{p.duration}</span>}
          {!svc && !isOut && !fewLeft && p.madeToOrder && <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#fff', color: S.ink }}>Made to order</span>}
        </button>
        <button type="button" onClick={() => openItem(p)} className={`text-left ${focusRing}`}>
          <div className="text-[14px] font-semibold leading-snug line-clamp-2" style={{ color: isOut ? S.muted : S.ink }}>{p.name}</div>
          {!svc && (() => { const [lo, hi] = optionPriceRange(p); return <div className="text-[15px] font-bold mt-1" style={{ fontVariantNumeric: 'tabular-nums', color: isOut ? S.muted : S.ink }}>{lo !== hi ? <><span className="text-[12px] font-medium" style={{ color: S.muted }}>From </span>{fmt(lo)}</> : fmt(p.sellingPrice)}</div>; })()}
          {opts && (
            <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
              {colours && colours.values.some((v) => swatchFor(v))
                ? <>{colours.values.slice(0, 5).map((v) => <span key={v} title={v} className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: swatchFor(v) || S.tile, border: '1px solid rgba(0,0,0,0.15)' }} />)}{colours.values.length > 5 && <span className="text-[11.5px]" style={{ color: S.muted }}>+{colours.values.length - 5}</span>}</>
                : <span className="text-[12px] truncate" style={{ color: S.muted }}>{cleanOptions(p.options).map((g) => `${g.values.length} ${g.values.length === 1 ? g.name.toLowerCase() : g.name.toLowerCase().replace(/(?<!s)$/, 's')}`).join(' · ')}</span>}
            </div>
          )}
        </button>
        {svc && p.description && <div className="text-[12.5px] leading-snug mt-1 line-clamp-2" style={{ color: S.muted }}>{p.description}</div>}
        {svc && <div className="text-[14px] font-bold mt-1.5" style={{ fontVariantNumeric: 'tabular-nums' }}>{priceLabel(p)}</div>}
        <div className="flex-1 min-h-[10px]" />
        {isOut ? (
          <div className="w-full py-2.5 rounded-xl text-center text-[13px] font-semibold" style={{ background: S.tile, color: S.soldOut }}>Sold out</div>
        ) : opts ? (
          <button onClick={() => openItem(p)} aria-label={`Choose ${optionWords(p.options)} of ${p.name}`} className={`w-full py-2.5 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform ${focusRing}`} style={inCart ? { border: `1.5px solid ${S.ink}`, color: S.ink } : { background: S.ink, color: '#fff' }}>
            {inCart ? <><Check size={15} strokeWidth={2.5} /> {inCart} in your {W.short.toLowerCase()}</> : <>Choose {cleanOptions(p.options)[0].name.toLowerCase()}{p.options.length > 1 ? ' & more' : ''}</>}
          </button>
        ) : svc ? (
          (p.priceUnit === 'hour' ? qty : svcAny) === 0 ? (
            <button onClick={() => changeQty(p, 1)} aria-label={`Request ${p.name}`} className={`w-full py-2.5 rounded-xl text-[13.5px] font-semibold active:scale-[0.98] transition-transform ${focusRing}`} style={{ background: S.ink, color: '#fff' }}>Request</button>
          ) : p.priceUnit === 'hour' ? (
            <div className="w-full flex items-center justify-between rounded-xl" style={{ border: `1.5px solid ${S.ink}` }}>
              <button onClick={() => changeQty(p, -1)} aria-label={`One hour less of ${p.name}`} className={`w-11 py-2 text-[18px] font-semibold rounded-l-xl ${focusRing}`}>−</button>
              <span className="text-[13.5px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{qty} hr{qty !== 1 ? 's' : ''}</span>
              <button onClick={() => changeQty(p, 1)} aria-label={`One hour more of ${p.name}`} className={`w-11 py-2 text-[18px] font-semibold rounded-r-xl ${focusRing}`}>+</button>
            </div>
          ) : (
            <button onClick={() => { if (qty > 0) changeQty(p, -1); else { const k = cartList.find((c) => c.product.id === p.id)?.key; if (k) setCart((prev) => ({ ...prev, [k]: 0 })); } }} aria-label={`Remove ${p.name} from your request`} className={`w-full py-2.5 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-1.5 ${focusRing}`} style={{ border: `1.5px solid ${S.ink}`, color: S.ink }}><Check size={15} strokeWidth={2.5} /> Added</button>
          )
        ) : qty === 0 ? (
          <button onClick={() => changeQty(p, 1)} aria-label={`Add ${p.name} to your order`} className={`w-full py-2.5 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform ${focusRing}`} style={{ background: S.ink, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            <Plus size={15} strokeWidth={2.5} /> Add
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

  // A product's own page: every photo, the full description, how many, and add to the order
  const renderItemSheet = () => {
    const p0 = viewItem; if (!p0) return null;
    const p = storeProducts.find((x) => x.id === p0.id) || p0;
    const photos = [p.imageUrl, ...(p.images || [])].filter(Boolean);
    const idx = photos.length ? ((viewIdx % photos.length) + photos.length) % photos.length : 0;
    const svc = storeKind(p) === 'service';
    // Colours and sizes: the customer picks one of each (or types their own, when the business allows it)
    const opts = !svc && hasOptions(p) ? cleanOptions(p.options) : [];
    const otherOk = opts.length > 0 && p.customChoice;
    const otherOn = otherOk && viewOtherOn;
    const missing = opts.find((g, i) => !(i === 0 && otherOn ? viewOther.trim().length >= 2 : viewSel[i]));
    const resolved = !missing;
    const variant = opts.length && !otherOn && resolved ? opts.map((g, i) => viewSel[i]).join(' / ') : '';
    const custom = otherOn && resolved ? [viewOther.trim().slice(0, 50), ...opts.slice(1).map((g, i) => viewSel[i + 1])].join(' / ') : '';
    const counted = opts.length > 0 && !!p.variantStock && !p.madeToOrder;
    const stockOf = (v) => (counted ? Math.max(0, Number(p.variantStock[v]) || 0) : Infinity);
    const combos = optionCombos(opts);
    const partsOf = (c) => (opts.length === 1 ? [c] : c.split(' / '));
    // How many are left with this value, given what's already chosen in the other list
    const valueLeft = (gi, val) => (!counted ? Infinity : combos.filter((c) => { const parts = partsOf(c); return parts[gi] === val && opts.every((g, j) => j === gi || (j === 0 && otherOn) || !viewSel[j] || parts[j] === viewSel[j]); }).reduce((a, c) => a + stockOf(c), 0));
    const lineKey = cartKeyOf(p.id, variant, custom);
    const inCart = opts.length ? (resolved ? cart[lineKey] || 0 : 0) : cart[p.id] || 0;
    const inCartAll = opts.length ? inCartOf(p.id) : inCart;
    const isOut = !svc && p.stockQuantity === 0 && !otherOk;
    const lineLeft = opts.length && resolved ? stockOf(variant || '') : null;
    const max = opts.length
      ? (!resolved ? 0 : custom || !counted ? Math.max(0, 99 - inCart) : Math.max(0, lineLeft - inCart))
      : svc ? (p.priceUnit === 'hour' ? 24 : 1) : p.madeToOrder ? Math.max(0, 99 - inCart) : p.stockQuantity !== null ? Math.max(0, p.stockQuantity - inCart) : 99;
    const step = (d) => setViewQty((q) => Math.max(1, Math.min(Math.max(1, max), q + d)));
    const add = () => { if (isOut || max <= 0) return; changeQty(p, Math.min(viewQty, max), variant, custom); closeItem(); };
    // Price shown: the product's price plus the extras of what's picked so far
    const pickedAddon = opts.reduce((a, g, i) => a + (i === 0 && otherOn ? 0 : Number((g.prices || {})[viewSel[i]]) || 0), 0);
    const unitNow = Math.max(0, Number(p.sellingPrice) + pickedAddon);
    const [loP, hiP] = optionPriceRange(p);
    const pickOption = (gi, v) => { setViewSel((cur) => ({ ...cur, [gi]: cur[gi] === v && !(gi === 0 && otherOn) ? undefined : v })); if (gi === 0) setViewOtherOn(false); setViewQty(1); };
    const ask = business.owner_phone ? `https://wa.me/${toWhatsAppNumber(business.owner_phone)}?text=${encodeURIComponent(`Hello ${business.name}, I'm interested in "${p.name}"${variant || custom ? ` (${variant || custom})` : ''} (${fmt(unitNow)}) on your store.`)}` : null;
    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6" style={{ background: 'rgba(23,25,26,0.55)' }} onClick={closeItem}>
        <div className="w-full md:max-w-4xl max-h-[94vh] md:max-h-[88vh] overflow-y-auto rounded-t-3xl md:rounded-3xl sf-rise md:grid md:grid-cols-[1.1fr_1fr]" style={{ background: '#fff', color: S.ink }} onClick={(e) => e.stopPropagation()}>
          <div className="relative md:sticky md:top-0 md:self-start">
            <div className="relative w-full aspect-[4/5] md:rounded-l-3xl overflow-hidden flex items-center justify-center" style={{ background: S.tile }}
              onTouchStart={(e) => setViewTouch(e.touches[0].clientX)}
              onTouchEnd={(e) => { if (viewTouch === null || photos.length < 2) return; const dx = e.changedTouches[0].clientX - viewTouch; if (Math.abs(dx) > 40) setViewIdx(idx + (dx < 0 ? 1 : -1)); setViewTouch(null); }}>
              {photos.length ? photos.map((src, i) => <img key={src + i} src={src} alt={`${p.name}, photo ${i + 1} of ${photos.length}`} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300" style={{ opacity: i === idx ? 1 : 0 }} />)
                : svc ? <Sparkles size={40} style={{ color: S.soldOut }} /> : <Package size={44} style={{ color: S.soldOut }} />}
              {photos.length > 1 && (
                <>
                  <button onClick={() => setViewIdx(idx - 1)} aria-label="Previous photo" className={`hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full items-center justify-center ${focusRing}`} style={{ background: 'rgba(255,255,255,0.92)' }}><ChevronLeft size={20} /></button>
                  <button onClick={() => setViewIdx(idx + 1)} aria-label="Next photo" className={`hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full items-center justify-center ${focusRing}`} style={{ background: 'rgba(255,255,255,0.92)' }}><ChevronRight size={20} /></button>
                  <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 md:hidden">{photos.map((_, i) => <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === idx ? 18 : 6, background: i === idx ? '#fff' : 'rgba(255,255,255,0.6)' }} />)}</div>
                </>
              )}
              <button onClick={closeItem} aria-label="Close" className={`absolute top-3 right-3 md:hidden w-10 h-10 rounded-full flex items-center justify-center ${focusRing}`} style={{ background: 'rgba(255,255,255,0.92)' }}><X size={19} /></button>
            </div>
            {photos.length > 1 && (
              <div className="hidden md:flex gap-2 p-3 overflow-x-auto">
                {photos.map((src, i) => <button key={src + i} onClick={() => setViewIdx(i)} aria-label={`Photo ${i + 1}`} className={`w-16 h-20 rounded-xl overflow-hidden shrink-0 ${focusRing}`} style={{ outline: i === idx ? `2px solid ${S.ink}` : 'none', outlineOffset: 2, opacity: i === idx ? 1 : 0.7 }}><img src={src} alt="" className="w-full h-full object-cover" /></button>)}
              </div>
            )}
          </div>
          <div className="p-6 md:p-8 flex flex-col" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <div className="hidden md:flex justify-end -mt-2 -mr-2 mb-2"><button onClick={closeItem} aria-label="Close" className={`w-10 h-10 rounded-full flex items-center justify-center ${focusRing}`} style={{ background: S.tile }}><X size={18} /></button></div>
            {p.category && <div className="text-[12px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: S.muted }}>{p.category}</div>}
            <h2 className="text-[24px] md:text-[28px] font-extrabold leading-tight" style={{ letterSpacing: '-0.02em' }}>{p.name}</h2>
            <div className="text-[22px] font-bold mt-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{svc ? priceLabel(p) : loP !== hiP && !resolved && !pickedAddon ? <><span className="text-[15px] font-semibold" style={{ color: S.muted }}>From </span>{fmt(loP)}</> : fmt(unitNow)}</div>
            {!svc && p.madeToOrder && <div className="text-[13px] mt-1.5 font-medium" style={{ color: '#0E7A5F' }}>Made to order{p.leadTime ? ` · ready in about ${p.leadTime.replace(/^(about|in)\s+/i, '')}` : ''}</div>}
            {!svc && !p.madeToOrder && !opts.length && p.stockQuantity !== null && <div className="text-[13px] mt-1.5 font-medium" style={{ color: isOut ? '#B42318' : p.stockQuantity <= 3 ? '#B54708' : '#0E7A5F' }}>{isOut ? 'Sold out at this branch' : p.stockQuantity <= 3 ? `Only ${p.stockQuantity} left` : 'In stock'}</div>}
            {!svc && !p.madeToOrder && opts.length > 0 && counted && (
              <div className="text-[13px] mt-1.5 font-medium" style={{ color: custom ? '#0E7A5F' : isOut ? '#B42318' : lineLeft !== null && lineLeft <= 3 ? (lineLeft === 0 ? '#B42318' : '#B54708') : '#0E7A5F' }}>
                {custom ? 'Made specially for you' : isOut ? 'Sold out at this branch' : lineLeft === null ? 'In stock' : lineLeft === 0 ? `Sold out in ${variant}` : lineLeft <= 3 ? `Only ${lineLeft} left in ${variant}` : `In stock in ${variant}`}
              </div>
            )}
            {svc && p.duration && <div className="text-[13px] mt-1.5" style={{ color: S.muted }}>{durationWords(business?.service_kind, p.duration)}</div>}
            {opts.map((g, gi) => (
              <div key={g.name} className="mt-5">
                <div className="text-[13.5px] font-semibold mb-2">{g.name}{gi === 0 && otherOn ? <span className="font-normal" style={{ color: S.muted }}>: your own choice</span> : viewSel[gi] ? <span className="font-normal" style={{ color: S.muted }}>: {viewSel[gi]}</span> : null}</div>
                <div className="flex flex-wrap gap-2">
                  {g.values.map((v) => {
                    const on = viewSel[gi] === v && !(gi === 0 && otherOn);
                    const gone = valueLeft(gi, v) <= 0;
                    const sw = isColourGroup(g) ? swatchFor(v) : null;
                    return (
                      <button key={v} type="button" onClick={() => pickOption(gi, v)} aria-pressed={on} aria-label={`${g.name} ${v}${gone ? ', sold out' : ''}`}
                        className={`min-h-[40px] px-3.5 rounded-xl text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors ${focusRing}`}
                        style={{ border: `1.5px solid ${on ? S.ink : S.line}`, background: on ? S.ink : '#fff', color: on ? '#fff' : gone ? S.soldOut : S.ink }}>
                        {sw && <span className="w-4 h-4 rounded-full shrink-0" style={{ background: sw, border: `1px solid ${on ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.15)'}` }} />}
                        <span style={{ textDecoration: gone && !on ? 'line-through' : 'none' }}>{v}</span>
                        {Number((g.prices || {})[v]) ? <span className="text-[12px] font-medium" style={{ color: on ? 'rgba(255,255,255,0.8)' : S.muted }}>{Number(g.prices[v]) > 0 ? '+' : '−'}{fmt(Math.abs(Number(g.prices[v])))}</span> : null}
                      </button>
                    );
                  })}
                  {gi === 0 && otherOk && (
                    <button type="button" onClick={() => { setViewOtherOn(!otherOn); setViewQty(1); }} aria-pressed={otherOn} className={`min-h-[40px] px-3.5 rounded-xl text-[13.5px] font-semibold ${focusRing}`} style={{ border: `1.5px ${otherOn ? 'solid' : 'dashed'} ${otherOn ? S.ink : S.line}`, background: otherOn ? S.ink : '#fff', color: otherOn ? '#fff' : S.ink }}>Another {g.name.toLowerCase()}…</button>
                  )}
                </div>
                {gi === 0 && otherOn && (
                  <div className="mt-2.5">
                    <input autoFocus maxLength={50} value={viewOther} onChange={(e) => setViewOther(e.target.value)} placeholder={isColourGroup(g) ? 'Which colour? e.g. Emerald green' : `Which ${g.name.toLowerCase()} would you like?`} aria-label={`Your own ${g.name.toLowerCase()}`}
                      className={`w-full rounded-xl px-4 py-3 text-[15px] ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
                    <div className="text-[12.5px] mt-1.5" style={{ color: S.muted }}>{business.name} will confirm it with you{p.leadTime ? ` and how long it takes (usually about ${p.leadTime.replace(/^(about|in)\s+/i, '')})` : ''}.</div>
                  </div>
                )}
              </div>
            ))}
            {p.description && <p className="text-[14.5px] leading-relaxed mt-5 whitespace-pre-line" style={{ color: '#3F4440' }}>{p.description}</p>}
            <div className="flex-1 min-h-[20px]" />
            {!isOut && (
              <div className="mt-5 flex items-center gap-3">
                {!svc || p.priceUnit === 'hour' ? (
                  <div className="flex items-center rounded-xl shrink-0" style={{ border: `1.5px solid ${S.line}` }}>
                    <button onClick={() => step(-1)} aria-label="One fewer" className={`w-11 h-12 text-[20px] font-semibold ${focusRing}`}>−</button>
                    <span className="w-8 text-center text-[16px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{viewQty}</span>
                    <button onClick={() => step(1)} aria-label="One more" disabled={viewQty >= max} className={`w-11 h-12 text-[20px] font-semibold ${focusRing}`} style={{ opacity: viewQty >= max ? 0.3 : 1 }}>+</button>
                  </div>
                ) : null}
                <button onClick={add} disabled={max <= 0} className={`flex-1 h-12 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 ${focusRing}`} style={{ background: S.ink, color: '#fff', opacity: max <= 0 ? 0.4 : 1 }}>
                  {missing ? (missing === opts[0] && otherOn ? `Type your ${missing.name.toLowerCase()}` : `Choose ${missing.name.toLowerCase()}`) : max <= 0 ? (svc ? 'Already in your request' : lineLeft === 0 && !custom ? 'Sold out — choose another' : 'All in your order') : <><ShoppingBag size={17} /> {svc ? 'Add to request' : `Add to order · ${fmt(unitNow * (svc && p.priceUnit !== 'hour' ? 1 : viewQty))}`}</>}
                </button>
              </div>
            )}
            {inCartAll > 0 && <div className="text-[12.5px] mt-2.5" style={{ color: S.muted }}>{opts.length ? (inCart > 0 ? `${inCart} of this already in your ${W.short.toLowerCase()}` : `${inCartAll} already in your ${W.short.toLowerCase()}`) : `${inCart} already in your ${W.short.toLowerCase()}`}{opts.length && inCart !== inCartAll ? ` (${inCartAll} in all)` : ''}.</div>}
            {ask && <a href={ask} target="_blank" rel="noopener noreferrer" className={`mt-3 h-11 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 ${focusRing}`} style={{ border: `1.5px solid ${S.line}`, color: S.ink }}><MessageCircle size={16} /> Ask about this on WhatsApp</a>}
          </div>
        </div>
      </div>
    );
  };
  // First visit to a store with several branches: choose where you're shopping from
  const renderBranchChooser = () => {
    if (!branchAsk || storeShops.length < 2) return null;
    const words = locationWords(business.business_type, business.service_kind);
    let saved = null; try { saved = localStorage.getItem(branchKey); } catch (e) {}
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-5" style={{ background: 'rgba(23,25,26,0.55)' }} onClick={() => saved && setBranchAsk(false)}>
        <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 sf-rise max-h-[88vh] overflow-y-auto" style={{ background: '#fff', color: S.ink, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
          {business.logo_url && <img src={business.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover mb-3" />}
          <div className="text-[21px] font-extrabold leading-tight" style={{ letterSpacing: '-0.015em' }}>Which {words.one} are you shopping from?</div>
          <div className="text-[14px] mt-1 mb-5" style={{ color: S.muted }}>{business.name} has {storeShops.length} {words.many}. Prices and what's in stock can differ between them.</div>
          <div className="space-y-2.5">
            {storeShops.map((sh) => {
              const on = sh.id === (saved || '');
              return (
                <button key={sh.id} onClick={() => chooseBranch(sh.id)} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors ${focusRing}`} style={{ border: `1.5px solid ${on ? S.ink : S.line}`, background: on ? S.tile : '#fff' }}>
                  <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: S.tile }}><MapPin size={18} /></span>
                  <span className="flex-1 min-w-0"><span className="block text-[15.5px] font-bold">{displayLocationName(sh, words)}</span>{sh.address && <span className="block text-[13px]" style={{ color: S.muted }}>{sh.address}</span>}</span>
                  <ChevronRight size={18} style={{ color: S.muted }} className="shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
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
            {hasGuests && <div className="text-[12.5px] rounded-xl px-3 py-2" style={{ background: S.tile, color: S.muted }}>Booking for {new Set(cartList.filter(groupable).map((c) => c.guest)).size} people. Each person gets their own time and {(PERSON_WORDS[business?.service_kind] || PERSON_WORDS._default).one}, so you're served together where possible.</div>}
            {cartList.map((c) => (
              <div key={c.key}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: S.tile }}>
                  {c.product.imageUrl ? <img src={c.product.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package size={16} style={{ color: S.soldOut }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">{c.product.name}</div>
                  {lineLabel(c) && <div className="text-[12.5px] truncate" style={{ color: S.ink }}>{lineLabel(c)}</div>}
                  <div className="text-[12.5px]" style={{ color: S.muted, fontVariantNumeric: 'tabular-nums' }}>{storeKind(c.product) === 'service' ? (c.product.priceUnit === 'hour' ? `${c.qty} hr${c.qty !== 1 ? 's' : ''} × ${fmt(c.product.sellingPrice)}` : priceLabel(c.product)) : `${c.qty} × ${fmt(linePrice(c))}`}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(c.product, -1, c.variant, c.custom, c.guest)} aria-label={`Remove one ${c.product.name}`} className={`w-7 h-7 rounded-full text-[15px] font-semibold ${focusRing}`} style={{ background: S.tile }}>−</button>
                  <button onClick={() => changeQty(c.product, 1, c.variant, c.custom, c.guest)} disabled={c.qty >= lineMax(c.product, c.variant, c.custom)} aria-label={`Add one more ${c.product.name}`} className={`w-7 h-7 rounded-full text-[15px] font-semibold ${focusRing}`} style={{ background: S.tile, opacity: c.qty >= lineMax(c.product, c.variant, c.custom) ? 0.35 : 1 }}>+</button>
                </div>
              </div>
              {groupable(c) && (() => {
                const others = party.filter((n) => n !== c.guest && !(forEdit?.mode === 'copy' && cartList.some((x) => x.product.id === c.product.id && x.variant === c.variant && x.custom === c.custom && x.guest === n)));
                const editing = forEdit && forEdit.key === c.key;
                return (
                  <div className="pl-[60px] mt-1.5">
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[12px]">
                      <label className="flex items-center gap-1" style={{ color: S.muted }}>For
                        <select value={c.guest} aria-label={`Who ${c.product.name} is for`} onChange={(e) => { const v = e.target.value; if (v === '__new') setForEdit({ key: c.key, mode: 'move', name: '' }); else pickFor(c, 'move', v); }}
                          className={`font-semibold rounded-md pl-1.5 pr-1 py-0.5 ${focusRing}`} style={{ background: S.tile, color: S.ink, border: 'none' }}>
                          <option value="">{youName === 'You' ? 'You' : `${youName} (you)`}</option>
                          {party.map((n) => <option key={n} value={n}>{n}</option>)}
                          <option value="__new">Someone else…</option>
                        </select>
                      </label>
                      {!editing && <button type="button" onClick={() => setForEdit({ key: c.key, mode: 'copy', name: '' })} className={`font-semibold underline underline-offset-2 ${focusRing}`} style={{ color: S.ink }}>+ Also for someone else</button>}
                    </div>
                    {editing && (
                      <div className="mt-2 rounded-xl p-2.5" style={{ background: S.tile }}>
                        <div className="text-[12px] font-semibold mb-1.5">{forEdit.mode === 'copy' ? `${c.product.name} for who else?` : `Who is ${c.product.name} for?`}</div>
                        {others.length > 0 && <div className="flex flex-wrap gap-1.5 mb-2">{others.map((n) => <button key={n} type="button" onClick={() => pickFor(c, forEdit.mode, n)} className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold ${focusRing}`} style={{ background: '#fff', color: S.ink }}>{n}</button>)}</div>}
                        <div className="flex flex-wrap gap-2">
                          <input autoFocus value={forEdit.name} onChange={(e) => setForEdit((f) => f && { ...f, name: e.target.value.slice(0, 40) })} onKeyDown={(e) => e.key === 'Enter' && pickFor(c, forEdit.mode, forEdit.name)}
                            placeholder="Their name, e.g. Chidi" className={`w-full rounded-lg px-3 py-2.5 text-[14px] ${focusRing}`} style={{ background: '#fff', border: 'none', color: S.ink }} />
                          <button type="button" onClick={() => pickFor(c, forEdit.mode, forEdit.name)} disabled={!forEdit.name.trim()} className={`flex-1 py-2 rounded-lg text-[13px] font-semibold ${focusRing}`} style={{ background: S.ink, color: '#fff', opacity: forEdit.name.trim() ? 1 : 0.4 }}>Add</button>
                          <button type="button" onClick={() => setForEdit(null)} className={`px-2 text-[12.5px] font-semibold ${focusRing}`} style={{ color: S.muted }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              </div>
            ))}
          </div>
          <div className="pt-3 mb-1" style={{ borderTop: `1px solid ${S.line}` }}>
            {!codeOpen && !discount ? (
              <button type="button" onClick={() => setCodeOpen(true)} className={`text-[13px] font-semibold underline underline-offset-4 ${focusRing}`} style={{ color: S.ink }}>Have a discount code?</button>
            ) : discount ? (
              <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: '#EAF6F0' }}>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: '#1F7A5C' }}>{discount.code} applied</div>
                  <div className="text-[12px]" style={{ color: S.muted }}>You save {fmt(discountOff)}{discount.perCustomer ? ` · ${Number(discount.perCustomer) === 1 ? 'One use per customer' : `Up to ${discount.perCustomer} uses per customer`}, checked with your phone number` : ''}</div>
                </div>
                <button type="button" onClick={() => { setDiscount(null); setCodeInput(''); setCodeOpen(false); setCodeError(''); }} className={`text-[12.5px] font-semibold ${focusRing}`} style={{ color: S.muted }}>Remove</button>
              </div>
            ) : (
              <div>
                <label htmlFor="sf-code" className="block text-[13px] font-semibold mb-1.5">Discount code</label>
                <div className="flex gap-2">
                  <input id="sf-code" value={codeInput} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={16} placeholder="e.g. SALLAH10"
                    onChange={(e) => { setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setCodeError(''); }} onKeyDown={(e) => e.key === 'Enter' && applyCode()}
                    className={`flex-1 min-w-0 rounded-xl px-4 py-3 text-[15px] tracking-wider ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
                  <button type="button" onClick={() => applyCode()} disabled={codeBusy || !codeInput} className={`px-5 rounded-xl text-[14px] font-semibold shrink-0 ${focusRing}`} style={{ background: S.ink, color: '#fff', opacity: codeBusy || !codeInput ? 0.4 : 1 }}>{codeBusy ? 'Checking…' : 'Apply'}</button>
                </div>
                {codeError && <div role="alert" className="text-[12.5px] mt-1.5" style={{ color: '#B3261E' }}>{codeError}</div>}
              </div>
            )}
          </div>
          <div className="py-4 mb-4">
            {discountOff > 0 && (
              <>
                <div className="flex items-center justify-between text-[13.5px] mb-1" style={{ color: S.muted, fontVariantNumeric: 'tabular-nums' }}><span>Subtotal</span><span>{fmt(cartTotal)}</span></div>
                <div className="flex items-center justify-between text-[13.5px] mb-2" style={{ color: '#1F7A5C', fontVariantNumeric: 'tabular-nums' }}><span>Discount ({discount.code})</span><span>{fmt(-discountOff)}</span></div>
              </>
            )}
            {homeFee > 0 && <div className="flex items-center justify-between text-[13.5px] mb-2" style={{ color: S.muted, fontVariantNumeric: 'tabular-nums' }}><span>{sk === 'repairs' ? 'Call-out fee' : 'Home service'}</span><span>{fmt(homeFee)}</span></div>}
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold">{cartList.some((c) => c.product.priceUnit === 'from') ? 'Total, from' : 'Total'}</span>
              <span className="text-[18px] font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(payable)}</span>
            </div>
            {cartList.some((c) => c.product.priceUnit === 'from') && <div className="text-[12px] mt-1 leading-relaxed" style={{ color: S.muted }}>{sk === 'repairs' ? `The final price is confirmed after ${business.name} checks it. Nothing is charged before you agree.` : `${business.name} confirms the final price with you before anything is paid.`}</div>}
          </div>
        </>
      )}
    </div>
  );

  const renderCheckoutFields = () => (
    <div>
      <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sf-name">Your name</label>
      <input id="sf-name" type="text" autoComplete="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-4 ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
      <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sf-phone">Phone number{usesSlots ? '' : <span className="font-normal" style={{ color: S.muted }}> (recommended)</span>}</label>
      <input id="sf-phone" type="tel" autoComplete="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="WhatsApp number, e.g. 0803 123 4567" className={`w-full rounded-xl px-4 py-3 text-[15px] mb-2 ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
      <div className="text-[12px] mb-2 -mt-0.5" style={{ color: S.muted }}>Updates about your order, and your delivery code, come to this number on WhatsApp.</div>
      {askHow && (() => {
        const opts = [
          ['room', "I'm staying here", 'Brought to your room'],
          ['pickup', "I'll pick it up", currentStoreShop?.address ? `From ${currentStoreShop.address}` : `From ${business.name}`],
          ['delivery', 'Deliver to me', 'Add your address'],
        ].filter(([v]) => orderModes.includes(v));
        const inputStyle = { background: S.tile, border: 'none', color: S.ink };
        return (
          <div className="mt-2 mb-3">
            <div className="text-[13px] font-semibold mb-1.5">{svcExtras.length ? `How do you want the ${cartList.filter((c) => !stayService(c.product)).length === 1 ? cartList.find((c) => !stayService(c.product)).product.name.toLowerCase() : 'items'}?` : 'How do you want it?'}</div>
            <div className={`grid gap-2 ${opts.length === 3 ? 'grid-cols-3' : opts.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`} role="radiogroup" aria-label="How do you want it?">
              {opts.map(([v, l, d]) => {
                const on = fulfilMode === v;
                return (
                  <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setFulfilMode(v)} className={`rounded-xl px-3 py-2.5 text-left ${focusRing}`} style={on ? { background: S.ink, color: '#fff' } : { background: S.tile, color: S.ink }}>
                    <span className="block text-[13px] font-semibold leading-tight">{l}</span>
                    <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: on ? 'rgba(255,255,255,0.75)' : S.muted }}>{d}</span>
                  </button>
                );
              })}
            </div>
            {svcKinds.includes('laundry') && (fulfilMode === 'delivery' || fulfilMode === 'pickup') && <div className="text-[12px] mt-2 rounded-xl px-3 py-2" style={{ background: S.tile, color: S.muted }}>{fulfilMode === 'delivery' ? 'The rider also collects your laundry, and brings it back when it\'s clean.' : 'Bring your laundry with you when you come.'}</div>}
            {fulfilMode === 'room' && (
              <>
                <input id="sf-room" value={guestRoom} onChange={(e) => setGuestRoom(e.target.value.slice(0, 20))} placeholder="Your room number, e.g. 204" className={`w-full mt-2 rounded-xl px-4 py-3 text-[15px] ${focusRing}`} style={inputStyle} />
                <div className="text-[12px] mt-1" style={{ color: S.muted }}>The front desk checks it, then {svcExtras.length ? 'everything, including the services,' : 'it'} goes on your room bill, paid at check-out.</div>
              </>
            )}
            {fulfilMode === 'delivery' && (
              <>
                {storeZones.length > 0 && (
                  <select id="sf-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={`w-full mt-2 rounded-xl px-4 py-3 text-[15px] ${focusRing}`} style={{ ...inputStyle, color: zoneId ? S.ink : S.muted }}>
                    <option value="">Choose your area</option>
                    {storeZones.map((z) => <option key={z.id} value={z.id}>{z.name}: {Number(z.fee) > 0 ? fmt(z.fee) : 'free delivery'}</option>)}
                    <option value="other">Somewhere else</option>
                  </select>
                )}
                <textarea id="sf-address" rows={2} maxLength={220} value={deliverAddr} onChange={(e) => setDeliverAddr(e.target.value)} placeholder="Address, e.g. 12 Faulks Road, Aba" className={`w-full mt-2 rounded-xl px-4 py-3 text-[15px] resize-none ${focusRing}`} style={inputStyle} />
                <input id="sf-landmark" value={deliverLandmark} onChange={(e) => setDeliverLandmark(e.target.value.slice(0, 70))} placeholder="Landmark (optional), e.g. opposite First Bank" className={`w-full mt-2 rounded-xl px-4 py-3 text-[15px] ${focusRing}`} style={inputStyle} />
                {(() => { const z = storeZones.find((x) => x.id === zoneId); return z
                  ? <div className="text-[12.5px] mt-1.5" style={{ color: S.ink }}>Delivery to {z.name}: <strong>{Number(z.fee) > 0 ? fmt(z.fee) : 'free'}</strong>. Total with delivery: <strong>{fmt(payable + Number(z.fee))}</strong>.</div>
                  : <div className="text-[12px] mt-1" style={{ color: S.muted }}>{business.name} confirms the delivery fee before you pay.</div>; })()}
              </>
            )}
          </div>
        );
      })()}
      {svcExtras.length > 0 && (() => {
        const inputStyle = { background: S.tile, border: 'none', color: S.ink };
        const many = svcExtras.length > 1;
        const whenLabel = svcKind === 'ride' ? 'When should we pick you up?' : svcKind === 'laundry' ? (laundryOut && laundryWay === 'drop' ? 'When will you drop it off?' : 'When should we collect it?') : svcKind === 'checkin' ? 'What time?' : many ? 'When do you need these?' : 'When do you need it?';
        const part = { ride: 'Pickup: flight number and arrival time', laundry: 'Laundry: how many items', checkin: 'Check-in or check-out time you want', other: 'Anything else they should know' };
        const notePh = svcKind === 'ride' ? 'Flight number and arrival time, or where to pick you up' : svcKind === 'laundry' ? 'How many items, and anything special (e.g. dry clean only)' : svcKind === 'mixed' ? svcKinds.map((k) => part[k]).join('. ') : 'Anything they should know';
        const names = svcExtras.map((c) => c.product.name);
        return (
          <div className="mt-2 mb-1">
            {askStay && (
              <div className="mb-3">
                <div className="text-[13px] font-semibold mb-1.5">Are you staying with us?</div>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Are you staying with us?">
                  {[['yes', "I'm checked in", 'Add it to my room bill'], ['booked', "I've booked", 'Not arrived yet'], ['no', 'Not staying', "They'll confirm how to pay"]].map(([v, l, d]) => { const on = guestStay === v; return (
                    <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setGuestStay(v)} className={`rounded-xl px-3 py-2.5 text-left ${focusRing}`} style={on ? { background: S.ink, color: '#fff' } : { background: S.tile, color: S.ink }}>
                      <span className="block text-[13px] font-semibold leading-tight">{l}</span>
                      <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: on ? 'rgba(255,255,255,0.75)' : S.muted }}>{d}</span>
                    </button>
                  ); })}
                </div>
                {guestStay === 'yes' && <input value={guestRoom} onChange={(e) => setGuestRoom(e.target.value.slice(0, 20))} placeholder="Your room number, e.g. 204" className={`w-full mt-2 rounded-xl px-4 py-3 text-[15px] ${focusRing}`} style={inputStyle} />}
                {guestStay === 'no' && !laundryOut && <div className="text-[12px] mt-2 leading-relaxed" style={{ color: S.muted }}>{business.name} will confirm the details and how to pay.</div>}
                {guestStay === 'booked' && <div className="text-[12px] mt-2 leading-relaxed" style={{ color: S.muted }}>You'll get your room when you check in. Use the same name and phone number as your booking, so the front desk can add this to your booking and you pay with your stay.</div>}
              </div>
            )}
            {laundryOut && laundryOpts.length > 0 && (
              <div className="mb-3">
                <div className="text-[13px] font-semibold mb-1.5">How do we get your laundry?</div>
                <div className={`grid gap-2 ${laundryOpts.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`} role="radiogroup" aria-label="How do we get your laundry?">
                  {laundryOpts.map(([v, l, d]) => { const on = laundryWay === v; return (
                    <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setLaundryWay(v)} className={`rounded-xl px-3 py-2.5 text-left ${focusRing}`} style={on ? { background: S.ink, color: '#fff' } : { background: S.tile, color: S.ink }}>
                      <span className="block text-[13px] font-semibold leading-tight">{l}</span>
                      <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: on ? 'rgba(255,255,255,0.75)' : S.muted }}>{d}</span>
                    </button>
                  ); })}
                </div>
                {laundryWay === 'collect' && (
                  <>
                    <textarea id="sf-laundry-address" rows={2} maxLength={220} value={deliverAddr} onChange={(e) => setDeliverAddr(e.target.value)} placeholder="Where do we collect it? e.g. 12 Faulks Road, Aba" className={`w-full mt-2 rounded-xl px-4 py-3 text-[15px] resize-none ${focusRing}`} style={inputStyle} />
                    <input value={deliverLandmark} onChange={(e) => setDeliverLandmark(e.target.value.slice(0, 70))} placeholder="Landmark (optional), e.g. opposite First Bank" className={`w-full mt-2 rounded-xl px-4 py-3 text-[15px] ${focusRing}`} style={inputStyle} />
                    <div className="text-[12px] mt-1.5 leading-relaxed" style={{ color: S.muted }}>A rider collects the bag, and brings it back to the same address when it's clean. {business.name} confirms the price and the pickup fee first. You pay when it comes back.</div>
                  </>
                )}
                {laundryWay === 'drop' && <div className="text-[12px] mt-1.5 leading-relaxed" style={{ color: S.muted }}>Bring it to {currentStoreShop?.address || business.name}. You'll get a message when it's clean and ready to collect.</div>}
              </div>
            )}
            {!cartHasService && (<>
              {(many || askHow) && <div className="text-[12px] mb-2 rounded-xl px-3 py-2" style={{ background: S.tile, color: S.muted }}>For {names.length > 2 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join(' and ')}. If they need different times, say so below.</div>}
              <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sf-svc-when">{whenLabel}</label>
              <input id="sf-svc-when" type="datetime-local" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-3 ${focusRing}`} style={inputStyle} />
              <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sf-svc-note">{svcKind === 'ride' ? 'Pickup details' : svcKind === 'mixed' ? 'Details' : 'Anything they should know?'} <span className="font-normal" style={{ color: S.muted }}>(optional)</span></label>
              <textarea id="sf-svc-note" rows={2} maxLength={300} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder={notePh} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-3 resize-none ${focusRing}`} style={inputStyle} />
            </>)}
          </div>
        );
      })()}
      {cartHasService && (
        <>
          {homeOffered && (
            <div className="mt-2 mb-4">
              <div className="text-[13px] font-semibold mb-1.5">{sk === 'repairs' ? 'Where should it be fixed?' : 'Where would you like it done?'}</div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Where">
                {[['shop', sk === 'repairs' ? "I'll bring it in" : `At ${business.name}`, currentStoreShop?.address || 'At their place'], ['home', 'Come to me', Number(visitTerms?.home_fee) > 0 ? `+${fmt(visitTerms.home_fee)} ${sk === 'repairs' ? 'call-out fee' : 'home service'}` : 'At your home or office']].map(([v, l, d]) => { const on = visitWay === v; return (
                  <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setVisitWay(v)} className={`rounded-xl px-3 py-2.5 text-left min-w-0 ${focusRing}`} style={on ? { background: S.ink, color: '#fff' } : { background: S.tile, color: S.ink }}>
                    <span className="block text-[13px] font-semibold leading-tight">{l}</span>
                    <span className="block text-[11px] mt-0.5 leading-snug break-words" style={{ color: on ? 'rgba(255,255,255,0.75)' : S.muted }}>{d}</span>
                  </button>
                ); })}
              </div>
              {goingHome && <textarea id="sf-visit-address" rows={2} maxLength={220} value={visitAddr} onChange={(e) => setVisitAddr(e.target.value)} placeholder="Your address, with a landmark, e.g. 12 Faulks Road, Aba, opposite First Bank" className={`w-full mt-2 rounded-xl px-4 py-3 text-[15px] resize-none ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />}
            </div>
          )}
          {apptCalLoading && !apptCal && <div className="flex items-center gap-2 text-[13px] mb-4 mt-2" style={{ color: S.muted }}><Loader2 size={15} className="animate-spin" /> Checking free times…</div>}
          {usesSlots ? (() => {
            const anyFree = apptCal.days.some((d) => d.slots.length);
            return (
              <div className="mb-4 mt-2">
                <div className="text-[13px] font-semibold mb-1">{sk === 'repairs' ? (goingHome ? 'When should they come?' : 'When will you bring it in?') : sk === 'events' ? 'Pick the date and start time' : sk === 'professional' ? 'Pick a time for your consultation' : goingHome ? 'When should they come?' : 'Pick a time'}</div>
                {apptCal.group && (apptCal.people || []).length > 0 && (
                  <div className="mb-3 space-y-2.5">
                    <div className="text-[12.5px]" style={{ color: S.muted }}>Who would each person like?</div>
                    {(apptCal.guests || []).map((g) => {
                      const cur = guestPick[g.guest || ''] || null;
                      const label = g.guest || (youName === 'You' ? 'You' : youName);
                      return (
                        <div key={g.guest || '_me'}>
                          <div className="text-[12.5px] font-semibold mb-1">{label} <span className="font-normal" style={{ color: S.muted }}>· {(g.items || []).join(', ')}</span></div>
                          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Who ${label} would like`}>
                            {[{ id: null, name: 'Anyone free' }, ...apptCal.people].map((p) => {
                              const on = cur === p.id;
                              return <button key={p.id || 'any'} type="button" role="radio" aria-checked={on} onClick={() => { setGuestPick((x) => ({ ...x, [g.guest || '']: p.id })); setApptSlot(''); }} className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold ${focusRing}`} style={on ? { background: S.ink, color: '#fff' } : { background: S.tile, color: S.ink }}>{p.name}</button>;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                                <div className="text-[12px] mb-2" style={{ color: S.muted }}>{apptCal.group
                  ? `For ${apptCal.party} people. Only times that work for everyone are shown, with when you'll all be done.`
                  : sk === 'repairs' ? `${goingHome ? 'Pick when they should come.' : "A short drop-off: you hand it over and they take it from there."}${svcTurnaround ? ` ${durationWords('repairs', svcTurnaround)}.` : ''}${(apptCal.people || []).length ? ' Pick a day, then a time under the person you want.' : ''}`
                  : sk === 'events' ? `${apptCal.minutes >= 1440 ? 'Covers more than one day' : `Covers about ${apptCal.minutes / 60} hour${apptCal.minutes !== 60 ? 's' : ''}`} from your start time. Only dates they can still take are shown.`
                  : `Takes about ${apptCal.minutes >= 60 ? `${apptCal.minutes / 60} hour${apptCal.minutes !== 60 ? 's' : ''}` : `${apptCal.minutes} minutes`}. ${(apptCal.people || []).length ? 'Pick a day, then a time under the person you want.' : 'Only free times are shown.'}`}</div>
                {!anyFree ? <div className="text-[13px] rounded-xl px-4 py-3" style={{ background: S.tile }}>{apptPerson ? `${(apptCal.people.find((p) => p.id === apptPerson) || {}).name || 'They'} has no free times in the next two weeks. Try "Anyone free", or send your request anyway.` : sk === 'events' ? "No free dates in the next few months. Send your request anyway with the date you want, and they'll reply." : "No free times in the next two weeks. Send your request anyway and they'll suggest a time."}</div> : (
                  <>
                    <SlotPicker light cal={apptCal} day={apptPickDay} onDay={setApptPickDay} slot={apptSlot} onSlot={(t) => { setApptSlot(t); if (!t) setApptPerson(null); }}
                      chosenLabel={sk === 'repairs' ? (t) => `${goingHome ? 'Visit' : 'Drop-off'}: ${apptDay(t)}, ${apptTime(t)}` : sk === 'events' ? (t) => `${apptDay(t)}, from ${apptTime(t)} (about ${apptCal.minutes >= 1440 ? '2+ days' : `${apptCal.minutes / 60} hours`})` : undefined}
                      belowDay={!apptCal.group && (apptCal.people || []).length ? (sel) => renderPeopleTimes(sel) : undefined} />
                    {!apptCal.group && (apptCal.people || []).length > 0 && apptSlot && (
                      <div className="mt-2.5 rounded-xl px-3.5 py-3 flex items-center gap-2 text-[13px] font-semibold" style={{ background: '#EAF6F0', color: '#17191A' }}>
                        <Check size={15} style={{ color: '#1F7A5C' }} className="shrink-0" />
                        <span>{apptDay(apptSlot)}, {apptTime(apptSlot)} to {apptTime(calEndOf(apptCal, apptSlot))} · {apptPerson ? `with ${(apptCal.people.find((p) => p.id === apptPerson) || {}).name || ''}` : 'with whoever is free'}</span>
                      </div>
                    )}
                    {apptCal.group && apptSlot && (
                      <div className="mt-2.5 rounded-xl p-3.5" style={{ background: '#EAF6F0' }}>
                        <div className="text-[13px] font-semibold mb-2 flex items-center gap-2"><Check size={15} style={{ color: '#1F7A5C' }} /> Your group's plan</div>
                        {groupPlan.loading && <div className="flex items-center gap-2 text-[12.5px]" style={{ color: S.muted }}><Loader2 size={14} className="animate-spin" /> Working it out…</div>}
                        {groupPlan.plan && (
                          <div className="space-y-2">
                            {groupPlan.plan.map((pt, i) => (
                              <div key={i} className="flex items-start gap-2.5 text-[13px] leading-snug">
                                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11.5px] font-bold shrink-0" style={{ background: '#fff', color: '#17191A' }}>{(pt.guest || youName || '?').trim()[0]?.toUpperCase()}</span>
                                <span className="min-w-0">
                                  <span className="block font-semibold">{pt.guest || (youName === 'You' ? 'You' : youName)} · {apptTime(pt.start_at)} to {apptTime(pt.end_at)}</span>
                                  <span className="block" style={{ color: S.muted }}>{(pt.items || []).join(', ')}{pt.person ? ` · with ${pt.person}` : ''}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!groupPlan.loading && !groupPlan.plan && <div className="text-[12.5px]" style={{ color: S.muted }}>{apptDay(apptSlot)}, {apptTime(apptSlot)} to {apptTime(calEndOf(apptCal, apptSlot))}</div>}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })() : !apptCalLoading && apptCalError ? (
            <div className="mb-4 mt-2 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-[13px]" style={{ background: S.tile }}>
              <span>The free times didn't load. Check your connection.</span>
              <button type="button" onClick={loadStoreCalendar} className={`shrink-0 px-3.5 py-2 rounded-lg text-[12.5px] font-semibold ${focusRing}`} style={{ background: S.ink, color: '#fff' }}>Try again</button>
            </div>
          ) : !apptCalLoading && projectReq ? (
            <div className="mt-2">
              <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sf-deadline">When do you need it by? <span className="font-normal" style={{ color: S.muted }}>(optional)</span></label>
              <input id="sf-deadline" type="date" min={new Date().toLocaleDateString('sv-SE', LAGOS_TIME)} value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-4 ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
            </div>
          ) : !apptCalLoading && (
            <>
              <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sf-when">{sk === 'events' ? 'When is the event?' : 'When would you like it?'} <span className="font-normal" style={{ color: S.muted }}>(optional)</span></label>
              <input id="sf-when" type="datetime-local" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-4 ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
            </>
          )}
          {sk === 'events' && (
            <div className="mb-4 space-y-2.5">
              <div className="text-[13px] font-semibold">About the event</div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type of event">
                {EVENT_TYPES.map((t) => { const on = eventInfo.type === t; return <button key={t} type="button" role="radio" aria-checked={on} onClick={() => setEventInfo({ ...eventInfo, type: on ? '' : t })} className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold ${focusRing}`} style={on ? { background: S.ink, color: '#fff' } : { background: S.tile, color: S.ink }}>{t}</button>; })}
              </div>
              <div>
                <label className="block text-[12.5px] mb-1" htmlFor="sf-venue" style={{ color: S.muted }}>Venue (where it is)</label>
                <input id="sf-venue" value={eventInfo.venue} maxLength={200} onChange={(e) => setEventInfo({ ...eventInfo, venue: e.target.value })} placeholder="e.g. Royal Event Centre, Umuahia" className={`w-full rounded-xl px-4 py-3 text-[15px] ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
              </div>
              <div>
                <label className="block text-[12.5px] mb-1" htmlFor="sf-guests" style={{ color: S.muted }}>About how many guests? <span>(optional)</span></label>
                <input id="sf-guests" type="number" inputMode="numeric" min="1" max="100000" value={eventInfo.guests} onChange={(e) => setEventInfo({ ...eventInfo, guests: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })} placeholder="e.g. 200" className={`w-full rounded-xl px-4 py-3 text-[15px] ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
              </div>
            </div>
          )}
          {(() => {
            const must = sk === 'repairs' || projectReq;
            const label = sk === 'repairs' ? "What's wrong?" : projectReq ? 'Your brief' : sk === 'events' ? 'Anything else they should know?' : 'Anything they should know?';
            const ph = sk === 'repairs' ? 'e.g. Toyota Corolla 2012: the brakes make a noise. Or: iPhone 12, the screen is cracked.'
              : projectReq ? 'What you need, in a few lines. e.g. A logo for my bakery, red and gold, for signage and Instagram.'
              : sk === 'professional' ? 'e.g. What you would like to discuss'
              : examplesFor(business.business_type === 'products' ? null : business.service_kind).note.replace((apptCal?.people || []).length ? /, preferred stylist$/ : /^$/, '');
            return (
              <>
                <label className="block text-[13px] font-semibold mb-1.5" htmlFor="sf-note">{label} {!must && <span className="font-normal" style={{ color: S.muted }}>(optional)</span>}</label>
                <textarea id="sf-note" rows={must ? 3 : 2} maxLength={must ? 600 : 300} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder={ph} className={`w-full rounded-xl px-4 py-3 text-[15px] mb-4 resize-none ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
              </>
            );
          })()}
        </>
      )}
      <div className="text-[12px] mb-5" style={{ color: S.muted }}>{usesSlots && apptSlot ? `No payment now. Your ${sk === 'events' ? 'date' : sk === 'repairs' && !goingHome ? 'drop-off time' : 'time'} is held while ${business.name} confirms it.` : projectReq ? `No payment now. ${business.name} will reply with the price and when it can be ready.` : bookTerms?.online_pay ? `No payment now. ${business.name} will confirm${cartHasService ? ' the time' : ' what you ordered'}, then you can pay online by card, transfer or USSD, or pay them directly.` : `No payment now. ${business.name} will contact you to confirm${cartHasService ? ' the time' : ''} and arrange payment.`}</div>
      <div className="sticky bottom-0 -mx-5 px-5 lg:-mx-6 lg:px-6 pt-3 pb-5" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #fff 22%)' }}>
  {(() => { const needSlot = usesSlots && apptCal.days.some((d) => d.slots.length) && !apptSlot; const needPhone = usesSlots && apptSlot && customerPhone.replace(/[^0-9]/g, '').length < 10; const off = submitting || !customerName.trim() || cartList.length === 0 || needSlot || needPhone; return (
  <button onClick={submitOrder} disabled={off} className={`w-full py-3.5 rounded-xl text-[14.5px] font-semibold ${focusRing}`} style={{ background: S.ink, color: '#fff', opacity: off ? 0.4 : 1 }}>{submitting ? 'Sending…' : needSlot && customerName.trim() ? 'Pick a time to continue' : needPhone ? 'Add your phone number to continue' : `${W.send} · ${fmt(payable)}`}</button>); })()}
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
      <header className="fixed top-0 inset-x-0 z-30 transition-all duration-300" style={overlay ? { paddingTop: 'env(safe-area-inset-top)', background: 'linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0) 100%)' } : { paddingTop: 'env(safe-area-inset-top)', background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${S.line}` }}>
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 md:h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {business.logo_url && <img src={business.logo_url} alt="" className="w-9 h-9 md:w-11 md:h-11 rounded-xl object-cover shrink-0" style={overlay ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.9)' } : {}} />}
            <span className="text-[16px] md:text-[18px] font-bold truncate transition-colors" style={{ color: overlay ? '#fff' : S.ink, letterSpacing: '-0.01em' }}>{business.name}</span>
          </div>
          {storeShops.length > 1 && (
            <button onClick={() => setBranchAsk(true)} className={`hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold shrink-0 ${focusRing}`} style={overlay ? { background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' } : { background: S.tile, color: S.ink }}>
              <MapPin size={14} /> {displayLocationName(currentStoreShop, locationWords(business.business_type, business.service_kind))} <ChevronRight size={14} className="rotate-90" />
            </button>
          )}
          <div className="hidden md:block flex-1 max-w-sm">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: overlay ? 'rgba(255,255,255,0.85)' : S.muted }} />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchWord} aria-label={searchWord} className={`w-full rounded-full pl-10 pr-4 py-2.5 text-[13.5px] ${overlay ? 'placeholder-white/80' : ''} ${focusRing}`} style={overlay ? { background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' } : { background: S.tile, border: '1px solid transparent', color: S.ink }} />
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
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
              <button onClick={() => document.getElementById('sf-shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={`h-12 px-6 rounded-full text-[14.5px] font-semibold ${focusRing}`} style={hasHero ? { background: '#fff', color: S.ink } : { background: S.ink, color: '#fff' }}>{hasStoreBookables ? 'See rooms & prices' : isService ? 'See what we offer' : 'Shop now'}</button>
              {business.owner_phone && <a href={`https://wa.me/${toWhatsAppNumber(business.owner_phone)}?text=${encodeURIComponent(`Hello ${business.name}, I found you on your Xorla store.`)}`} target="_blank" rel="noopener noreferrer" className={`h-12 px-5 rounded-full text-[14.5px] font-semibold flex items-center gap-2 ${focusRing}`} style={hasHero ? { background: 'rgba(255,255,255,0.16)', color: '#fff', border: '1px solid rgba(255,255,255,0.45)' } : { background: '#fff', color: S.ink, border: `1.5px solid ${S.line}` }}><MessageCircle size={17} /> Chat with us</a>}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 md:px-8 pt-6 lg:pt-8 lg:grid lg:grid-cols-[1fr_340px] lg:gap-10" style={{ paddingBottom: cartCount ? '110px' : '40px' }}>
        <main id="sf-shop" className="scroll-mt-24">
          {hasStoreBookables && renderDateBar()}
          {storeShops.length > 1 && (
            <button onClick={() => setBranchAsk(true)} className={`w-full mb-5 rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left ${focusRing}`} style={{ background: '#fff', border: `1.5px solid ${S.ink}` }}>
              <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: S.ink, color: '#fff' }}><MapPin size={18} /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: S.muted }}>You're shopping from</span>
                <span className="block text-[16px] font-bold leading-tight truncate">{displayLocationName(currentStoreShop, locationWords(business.business_type, business.service_kind))}</span>
                {currentStoreShop?.address && <span className="block text-[12.5px] truncate" style={{ color: S.muted }}>{currentStoreShop.address}</span>}
              </span>
              {switchingShop ? <Loader2 size={16} className="animate-spin shrink-0" style={{ color: S.muted }} /> : <span className="shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-semibold" style={{ background: S.tile }}>Change</span>}
            </button>
          )}
          {/* Mobile search */}
          <div className="md:hidden relative mb-4">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchWord} aria-label={searchWord} className={`w-full rounded-full pl-10 pr-4 py-3 text-[14px] ${focusRing}`} style={{ background: S.tile, border: 'none', color: S.ink }} />
          </div>

          {/* Categories + sort */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
            <div className="relative min-w-0 flex-1">
              <div ref={catRef} onScroll={updateCatFade} className="flex gap-1.5 overflow-x-auto sf-scroll" style={{ scrollbarWidth: 'none' }}>
                {hasCategories && categories.map((cat) => (
                  <button key={cat} onClick={(e) => { setActiveCategory(cat); e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }} className={`px-4 py-2 rounded-full text-[13.5px] font-semibold whitespace-nowrap transition-colors ${focusRing}`} style={activeCategory === cat ? { background: S.ink, color: '#fff' } : { background: S.tile, color: S.ink }}>{cat}</button>
                ))}
                {!hasCategories && <span className="text-[14px] font-semibold py-2">{storeProducts.length} {(() => { const w = business.business_type === 'products' ? 'product' : business.business_type === 'services' ? (business.service_kind === 'accommodation' ? 'room' : 'service') : 'item'; return storeProducts.length !== 1 ? `${w}s` : w; })()}</span>}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 md:gap-x-5 gap-y-8">
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
      {renderBookSheet()}{renderSpaceSheet()}{renderThanks()}
      {renderItemSheet()}{renderBranchChooser()}
      <footer className="mt-4" style={{ background: S.tile }}>
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 grid gap-8 md:grid-cols-[1.2fr_1fr_1fr] text-[13.5px]" style={{ color: S.muted }}>
          <div>
            <div className="flex items-center gap-2.5 mb-2">{business.logo_url && <img src={business.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover" />}<span className="text-[17px] font-bold" style={{ color: S.ink }}>{business.name}</span></div>
            {heroSub && <div className="leading-relaxed max-w-xs">{heroSub}</div>}
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: S.ink }}>{storeShops.length > 1 ? `Our ${locationWords(business.business_type, business.service_kind).many}` : 'Visit us'}</div>
            {(storeShops.length ? storeShops : [{ id: 'x', name: business.name, address: business.address }]).map((sh) => (
              <div key={sh.id} className="mb-2 leading-snug"><span className="font-semibold" style={{ color: S.ink }}>{storeShops.length > 1 ? displayLocationName(sh, locationWords(business.business_type, business.service_kind)) : ''}</span>{storeShops.length > 1 && sh.address ? <br /> : null}{sh.address || (storeShops.length > 1 ? '' : business.address)}</div>
            ))}
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: S.ink }}>Talk to us</div>
            {business.owner_phone ? <a href={`https://wa.me/${toWhatsAppNumber(business.owner_phone)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold underline-offset-4 hover:underline" style={{ color: S.ink }}><MessageCircle size={15} /> WhatsApp {formatPhoneDisplay(business.owner_phone)}</a> : <div>Order here and {business.name} will contact you.</div>}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-5 flex items-center justify-between gap-3 text-[12px]" style={{ borderTop: `1px solid ${S.line}`, color: S.muted }}>
          <span>© {new Date().getFullYear()} {business.name}</span>
          <span className="flex items-center gap-3">{business.show_branding !== false && <span>Store powered by Xorla</span>}<a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy</a></span>
        </div>
      </footer>

      {/* Mobile order bar */}
      {cartCount > 0 && !showCheckout && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-4 pt-3" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #fff 35%)' }}>
          <button onClick={() => setShowCheckout(true)} className={`w-full rounded-2xl py-4 px-5 flex items-center justify-between ${focusRing}`} style={{ background: S.ink, color: '#fff', boxShadow: '0 10px 30px rgba(23,25,26,0.25)' }}>
            <span className="flex items-center gap-2.5 text-[14.5px] font-semibold">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: '#fff', color: S.ink }}>{cartCount}</span>
              {W.view}
            </span>
            <span className="text-[15px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(payable)}</span>
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
function StoreBySlug({ slug }) {
  const [code, setCode] = useState(undefined);
  useEffect(() => { sbRpc('store_code_for', SB_KEY, { p_slug: slug }).then((c) => setCode(c || null)).catch(() => setCode(null)); }, [slug]);
  if (code === undefined) return <div className="flex items-center justify-center" style={{ background: S.bg, minHeight: '100vh' }}><Loader2 className="animate-spin" size={22} style={{ color: S.muted }} /></div>;
  if (!code) return (
    <div className="flex flex-col items-center justify-center px-6 text-center" style={{ background: S.bg, color: S.ink, minHeight: '100vh', fontFamily: SF_FONT }}>
      <div className="text-[20px] font-bold mb-2">We couldn't find that store</div>
      <div className="text-[14px] max-w-sm mb-6" style={{ color: S.muted }}>Check the link you were sent. The business may have changed its store name.</div>
      <a href="/" className="text-[14px] font-semibold underline underline-offset-4">Go to Xorla</a>
    </div>
  );
  return <Storefront businessCode={code} />;
}
export { Storefront, StoreBySlug };
