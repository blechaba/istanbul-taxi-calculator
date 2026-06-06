import { useState, useMemo, useEffect, useRef } from "react";

// ── Constants ──────────────────────────────────────────────────────
const OFFICIAL_FLAG_FALL = 54;
const OFFICIAL_RATE_PER_KM = 36;
const OFFICIAL_WAIT_PER_MIN = 175 / 60;
const BOSPHORUS_TOLL = 47;
const TUNNEL_TOLL = 225;

const PLATFORMS = ["Uber", "BiTaksi", "Street"];
const P_COLOR  = { Uber: "#22c55e", BiTaksi: "#6366f1", Street: "#f59e0b" };
const P_GLOW   = { Uber: "rgba(34,197,94,0.18)", BiTaksi: "rgba(99,102,241,0.18)", Street: "rgba(245,158,11,0.18)" };
const P_BG     = { Uber: "rgba(34,197,94,0.08)", BiTaksi: "rgba(99,102,241,0.08)", Street: "rgba(245,158,11,0.08)" };

const CURRENCIES = [
  { code:"ZAR", symbol:"R",    name:"S. African Rand",  defaultRate:0.3542 },
  { code:"USD", symbol:"$",    name:"US Dollar",         defaultRate:0.0280 },
  { code:"EUR", symbol:"€",    name:"Euro",              defaultRate:0.0258 },
  { code:"GBP", symbol:"£",    name:"British Pound",     defaultRate:0.0221 },
  { code:"AED", symbol:"د.إ",  name:"UAE Dirham",        defaultRate:0.1028 },
];

const TABS = [
  { key:"log",      icon:"⊕",  label:"Log" },
  { key:"estimate", icon:"◎",  label:"Estimate" },
  { key:"compare",  icon:"⇄",  label:"Compare" },
  { key:"history",  icon:"≡",  label:"History" },
  { key:"settings", icon:"◈",  label:"Settings" },
];

// ── Helpers ────────────────────────────────────────────────────────
const num = v => parseFloat(v) || 0;
const fmtTL = v => `₺${Number(v).toFixed(2)}`;
const fmtC  = (v, sym) => `${sym}${Number(v).toFixed(2)}`;
const today = () => new Date().toISOString().split("T")[0];
const formatDate = d => { if(!d) return "—"; const dt = new Date(d+"T12:00:00"); return dt.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); };

const emptyForm = {
  platform:"Uber", from:"", to:"",
  distanceKm:"", durationMin:"",
  bookingFee:"", meterFare:"", tip:"",
  totalTL:"", notes:"", inputMode:"breakdown", date:today(),
};
const emptyEst = { platform:"Uber", distanceKm:"", durationMin:"", toll:"none", tip:"" };

// ── CSS-in-JS tokens ───────────────────────────────────────────────
const C = {
  bg:       "#0e0e12",
  surface:  "#16161e",
  surface2: "#1e1e28",
  border:   "rgba(255,255,255,0.06)",
  border2:  "rgba(255,255,255,0.1)",
  accent:   "#ff6b35",
  accentDim:"rgba(255,107,53,0.15)",
  text:     "#f0f0f5",
  muted:    "#6b6b80",
  muted2:   "#3a3a4a",
  green:    "#22c55e",
  red:      "#ef4444",
};

// ── Reusable components ────────────────────────────────────────────
const Label = ({ children, style={} }) => (
  <div style={{ fontSize:"10px", letterSpacing:"1.5px", textTransform:"uppercase", color:C.muted, marginBottom:"6px", fontWeight:600, ...style }}>
    {children}
  </div>
);

const Input = ({ style={}, ...props }) => (
  <input {...props} style={{
    width:"100%", boxSizing:"border-box",
    background:C.surface2, border:`1px solid ${C.border}`,
    color:C.text, borderRadius:"12px",
    padding:"12px 14px", fontSize:"14px",
    fontFamily:"'Syne','DM Mono',monospace", outline:"none",
    transition:"border-color 0.2s",
    ...style,
  }}
  onFocus={e => e.target.style.borderColor = "rgba(255,107,53,0.5)"}
  onBlur={e => e.target.style.borderColor = C.border}
  />
);

const Select = ({ style={}, children, ...props }) => (
  <select {...props} style={{
    width:"100%", boxSizing:"border-box",
    background:C.surface2, border:`1px solid ${C.border}`,
    color:C.text, borderRadius:"12px",
    padding:"12px 14px", fontSize:"14px",
    fontFamily:"'Syne','DM Mono',monospace", outline:"none",
    cursor:"pointer", appearance:"none",
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b6b80' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,
    backgroundRepeat:"no-repeat", backgroundPosition:"right 14px center",
    ...style,
  }}>{children}</select>
);

const Pill = ({ platform }) => (
  <span style={{
    fontSize:"10px", padding:"3px 10px", borderRadius:"20px",
    background:P_BG[platform], color:P_COLOR[platform],
    border:`1px solid ${P_COLOR[platform]}30`,
    letterSpacing:"1px", fontWeight:700,
  }}>{platform}</span>
);

const PlatformBtn = ({ platform, active, onClick }) => (
  <button onClick={onClick} style={{
    flex:1, padding:"10px 6px",
    border:`1px solid ${active ? P_COLOR[platform] : C.border}`,
    background: active ? P_BG[platform] : "transparent",
    color: active ? P_COLOR[platform] : C.muted,
    borderRadius:"12px", cursor:"pointer",
    fontFamily:"'Syne',sans-serif",
    fontSize:"12px", fontWeight: active ? 700 : 500,
    letterSpacing:"0.5px",
    transition:"all 0.2s",
    boxShadow: active ? `0 0 16px ${P_GLOW[platform]}` : "none",
  }}>{platform}</button>
);

const StatCard = ({ label, value, sub, accent=false }) => (
  <div style={{
    background:C.surface, border:`1px solid ${accent ? "rgba(255,107,53,0.3)" : C.border}`,
    borderRadius:"16px", padding:"18px",
    display:"flex", justifyContent:"space-between", alignItems:"center",
    boxShadow: accent ? `0 0 24px rgba(255,107,53,0.08)` : "none",
  }}>
    <div>
      <Label style={{ marginBottom:"4px" }}>{label}</Label>
      {sub && <div style={{ fontSize:"11px", color:C.muted2, marginTop:"2px" }}>{sub}</div>}
    </div>
    <div style={{ fontSize:"20px", fontWeight:800, color: accent ? C.accent : C.text, letterSpacing:"-0.5px" }}>{value}</div>
  </div>
);

const TripCard = ({ trip, rate, currency, onRemove }) => {
  const snap = trip.rateSnapshot?.[currency.code] ?? rate;
  const rateChanged = Math.abs(snap - rate) > 0.001;
  return (
    <div style={{
      background:C.surface, border:`1px solid ${C.border}`,
      borderRadius:"16px", padding:"16px",
      transition:"border-color 0.2s",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px", flexWrap:"wrap" }}>
            <Pill platform={trip.platform} />
            <span style={{ fontSize:"13px", fontWeight:700, color:C.text }}>
              {trip.from||"—"} → {trip.to||"—"}
            </span>
          </div>
          <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", marginBottom:"6px" }}>
            <span style={{ fontSize:"11px", color:C.muted }}>📅 {formatDate(trip.date)}</span>
            {trip.distanceKm && <span style={{ fontSize:"11px", color:C.muted }}>{trip.distanceKm} km</span>}
            {trip.durationMin && <span style={{ fontSize:"11px", color:C.muted }}>{trip.durationMin} min</span>}
          </div>
          <div style={{ display:"flex", alignItems:"baseline", gap:"10px", flexWrap:"wrap" }}>
            <span style={{ fontSize:"18px", fontWeight:800, color:C.accent, letterSpacing:"-0.5px" }}>{fmtTL(trip.resolvedTotal)}</span>
            <span style={{ fontSize:"13px", color:C.green, fontWeight:600 }}>
              {fmtC(num(trip.resolvedTotal)*snap, currency.symbol)} {currency.code}
            </span>
            {rateChanged && <span style={{ fontSize:"10px", color:C.muted2 }}>@{snap.toFixed(4)}</span>}
          </div>
          {(num(trip.tip)>0 || trip.notes) && (
            <div style={{ display:"flex", gap:"10px", marginTop:"6px", flexWrap:"wrap" }}>
              {num(trip.tip)>0 && <span style={{ fontSize:"11px", color:C.muted2 }}>tip {fmtTL(trip.tip)}</span>}
              {trip.notes && <span style={{ fontSize:"11px", color:C.muted2 }}>{trip.notes}</span>}
            </div>
          )}
        </div>
        <button onClick={onRemove} style={{
          background:"none", border:"none", color:C.muted2,
          cursor:"pointer", fontSize:"20px", padding:"0 0 0 12px",
          lineHeight:1, flexShrink:0,
        }}>×</button>
      </div>
    </div>
  );
};

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [trips, setTripsRaw] = useState(() => {
    try { const s = localStorage.getItem("ist_trips"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [rates, setRatesRaw] = useState(() => {
    try {
      const s = localStorage.getItem("ist_rates");
      const saved = s ? JSON.parse(s) : {};
      const m = {}; CURRENCIES.forEach(c => { m[c.code] = saved[c.code] ?? c.defaultRate; }); return m;
    } catch { const m = {}; CURRENCIES.forEach(c => { m[c.code] = c.defaultRate; }); return m; }
  });
  const [activeCurrency, setActiveCurrencyRaw] = useState(() => localStorage.getItem("ist_currency") || "ZAR");
  const [form, setForm] = useState(emptyForm);
  const [estimate, setEstimate] = useState(emptyEst);
  const [tab, setTab] = useState("log");
  const [formError, setFormError] = useState("");
  const [histFilter, setHistFilter] = useState({ platform:"All", dateFrom:"", dateTo:"" });
  const [toast, setToast] = useState(null);

  const setTrips = t => { setTripsRaw(t); try { localStorage.setItem("ist_trips", JSON.stringify(t)); } catch {} };
  const setRates = r => { setRatesRaw(r); try { localStorage.setItem("ist_rates", JSON.stringify(r)); } catch {} };
  const setActiveCurrency = c => { setActiveCurrencyRaw(c); try { localStorage.setItem("ist_currency", c); } catch {} };

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const currency = CURRENCIES.find(c => c.code === activeCurrency) || CURRENCIES[0];
  const rate = rates[activeCurrency];

  // ── stats ──
  const stats = useMemo(() => {
    if (!trips.length) return null;
    const byP = {}; PLATFORMS.forEach(p => { byP[p] = { trips:[], tl:0, km:0, min:0 }; });
    trips.forEach(t => { byP[t.platform].trips.push(t); byP[t.platform].tl += num(t.resolvedTotal); byP[t.platform].km += num(t.distanceKm); byP[t.platform].min += num(t.durationMin); });
    const allTL = trips.reduce((s,t) => s+num(t.resolvedTotal), 0);
    const allKm = trips.reduce((s,t) => s+num(t.distanceKm), 0);
    const avgFare = allTL / trips.length;
    const tripsKm = trips.filter(t => num(t.distanceKm) > 0);
    const effRate = tripsKm.length
      ? (tripsKm.reduce((s,t) => s+num(t.resolvedTotal),0) - OFFICIAL_FLAG_FALL*tripsKm.length) / tripsKm.reduce((s,t) => s+num(t.distanceKm),0)
      : OFFICIAL_RATE_PER_KM;
    const pStats = {};
    PLATFORMS.forEach(p => {
      const d = byP[p]; if (!d.trips.length) return;
      pStats[p] = { count:d.trips.length, avg:d.tl/d.trips.length, avgKm:d.km/d.trips.length, avgMin:d.min/d.trips.length, total:d.tl };
    });
    const ranked = Object.entries(pStats).sort((a,b) => a[1].avg - b[1].avg);
    return { avgFare, effRate, totalTrips:trips.length, allKm, pStats, ranked };
  }, [trips]);

  // ── estimate ──
  const est = useMemo(() => {
    const km = num(estimate.distanceKm), min = num(estimate.durationMin), tip = num(estimate.tip);
    const rk = stats?.effRate ?? OFFICIAL_RATE_PER_KM;
    const dist = km > 0 ? km*rk : min*OFFICIAL_WAIT_PER_MIN;
    let toll = 0;
    if (estimate.toll==="bridge") toll = BOSPHORUS_TOLL;
    if (estimate.toll==="tunnel") toll = TUNNEL_TOLL;
    const booking = estimate.platform==="Uber" ? 50 : 0;
    const sub = OFFICIAL_FLAG_FALL + booking + dist + toll;
    const total = sub + tip;
    return { flagFall:OFFICIAL_FLAG_FALL, booking, dist, toll, tip, total, rk };
  }, [estimate, stats]);

  // ── filtered history ──
  const filteredTrips = useMemo(() => (
    [...trips].filter(t => {
      if (histFilter.platform !== "All" && t.platform !== histFilter.platform) return false;
      if (histFilter.dateFrom && t.date < histFilter.dateFrom) return false;
      if (histFilter.dateTo && t.date > histFilter.dateTo) return false;
      return true;
    }).sort((a,b) => (b.date||"").localeCompare(a.date||""))
  ), [trips, histFilter]);

  const resolveTotal = f => f.inputMode==="total" ? num(f.totalTL) : num(f.bookingFee)+num(f.meterFare)+num(f.tip);

  function addTrip() {
    const resolved = resolveTotal(form);
    if (!form.from||!form.to) { setFormError("Origin and destination required"); return; }
    if (!form.durationMin&&!form.distanceKm) { setFormError("Enter distance or duration"); return; }
    if (resolved<=0) { setFormError("Fare must be greater than zero"); return; }
    if (!form.date) { setFormError("Please select a date"); return; }
    setFormError("");
    const snap = {}; CURRENCIES.forEach(c => { snap[c.code] = rates[c.code]; });
    setTrips([...trips, { ...form, resolvedTotal:resolved, id:Date.now(), rateSnapshot:snap }]);
    setForm({ ...emptyForm, platform:form.platform, date:form.date });
    showToast("Trip saved ✓");
  }

  const removeTrip = id => { setTrips(trips.filter(t => t.id!==id)); showToast("Trip removed"); };

  // ── render ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Syne','DM Mono',sans-serif", color:C.text, paddingBottom:"90px" }}>

      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap');
        * { -webkit-tap-highlight-color: transparent; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        select option { background: #1e1e28; color: #f0f0f5; }
        ::-webkit-scrollbar { display: none; }
        input::placeholder { color: #3a3a4a; }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        .tab-content { animation: slideUp 0.25s ease; }
      `}</style>

      {/* HERO HEADER */}
      <div style={{
        background:`linear-gradient(160deg, #1a1a24 0%, #0e0e12 60%)`,
        padding:"44px 20px 24px", position:"relative", overflow:"hidden",
      }}>
        {/* Decorative glow orb */}
        <div style={{
          position:"absolute", top:"-40px", right:"-40px",
          width:"200px", height:"200px", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(255,107,53,0.12) 0%, transparent 70%)",
          pointerEvents:"none",
        }}/>
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ fontSize:"11px", letterSpacing:"3px", color:C.muted, textTransform:"uppercase", marginBottom:"6px" }}>
            İstanbul · Taksi
          </div>
          <h1 style={{ margin:"0 0 2px", fontSize:"28px", fontWeight:800, color:C.text, letterSpacing:"-1px", lineHeight:1.1 }}>
            Fare Calculator
          </h1>
          <p style={{ margin:0, fontSize:"13px", color:C.muted, fontWeight:400 }}>
            Uber · BiTaksi · Street · Multi-currency
          </p>
        </div>

        {/* Tariff strip */}
        <div style={{
          marginTop:"20px", display:"grid", gridTemplateColumns:"repeat(4,1fr)",
          background:"rgba(255,255,255,0.04)", borderRadius:"16px",
          padding:"14px 12px", border:`1px solid ${C.border}`, gap:"4px",
        }}>
          {[["Flag fall",fmtTL(OFFICIAL_FLAG_FALL)],["Per km",fmtTL(OFFICIAL_RATE_PER_KM)],["Wait/min",fmtTL(OFFICIAL_WAIT_PER_MIN.toFixed(2))],["Night rate","None"]].map(([l,v]) => (
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:"9px", color:C.muted2, letterSpacing:"1px", textTransform:"uppercase", marginBottom:"3px" }}>{l}</div>
              <div style={{ fontSize:"13px", fontWeight:700, color:C.text }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Active currency & amount */}
        {stats && (
          <div style={{ marginTop:"14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:"11px", color:C.muted, marginBottom:"2px" }}>Avg fare · {stats.totalTrips} trips</div>
              <div style={{ fontSize:"24px", fontWeight:800, color:C.accent, letterSpacing:"-1px" }}>{fmtTL(stats.avgFare)}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:"11px", color:C.muted, marginBottom:"2px" }}>{currency.code} equivalent</div>
              <div style={{ fontSize:"20px", fontWeight:700, color:C.green }}>{fmtC(stats.avgFare*rate, currency.symbol)}</div>
            </div>
          </div>
        )}
      </div>

      {/* CURRENCY SELECTOR */}
      <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, background:C.surface }}>
        <div style={{ display:"flex", gap:"8px", overflowX:"auto", paddingBottom:"2px" }}>
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => setActiveCurrency(c.code)} style={{
              flexShrink:0, padding:"7px 14px", borderRadius:"20px",
              border:`1px solid ${activeCurrency===c.code ? C.accent : C.border}`,
              background: activeCurrency===c.code ? C.accentDim : "transparent",
              color: activeCurrency===c.code ? C.accent : C.muted,
              fontSize:"12px", fontWeight: activeCurrency===c.code ? 700 : 500,
              cursor:"pointer", fontFamily:"inherit",
              transition:"all 0.2s",
            }}>{c.symbol} {c.code}</button>
          ))}
        </div>
        <div style={{ marginTop:"10px", display:"flex", alignItems:"center", gap:"8px" }}>
          <span style={{ fontSize:"12px", color:C.muted, flexShrink:0 }}>1 TRY =</span>
          <input type="number" step="0.0001" value={rates[activeCurrency]}
            onChange={e => setRates({ ...rates, [activeCurrency]: parseFloat(e.target.value)||0 })}
            style={{
              background:C.surface2, border:`1px solid ${C.border}`, color:C.accent,
              borderRadius:"8px", padding:"6px 10px", width:"90px", fontSize:"13px",
              fontFamily:"inherit", outline:"none", fontWeight:700,
            }} />
          <span style={{ fontSize:"12px", color:C.accent, fontWeight:700 }}>{currency.code}</span>
          <span style={{ fontSize:"11px", color:C.muted2, flex:1 }}>{currency.name}</span>
          <button onClick={() => setRates({ ...rates, [activeCurrency]: currency.defaultRate })} style={{
            background:"none", border:`1px solid ${C.border2}`, color:C.muted,
            borderRadius:"8px", padding:"5px 10px", fontSize:"10px", cursor:"pointer",
            fontFamily:"inherit", letterSpacing:"1px",
          }}>RESET</button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding:"20px", maxWidth:"600px", margin:"0 auto" }}>

        {/* ══ LOG TAB ══ */}
        {tab==="log" && (
          <div className="tab-content">
            <div style={{ fontSize:"18px", fontWeight:800, color:C.text, marginBottom:"20px", letterSpacing:"-0.5px" }}>Log a Trip</div>

            {/* Platform */}
            <div style={{ marginBottom:"16px" }}>
              <Label>Platform</Label>
              <div style={{ display:"flex", gap:"8px" }}>
                {PLATFORMS.map(p => <PlatformBtn key={p} platform={p} active={form.platform===p} onClick={() => setForm({...form, platform:p})} />)}
              </div>
            </div>

            {/* Route */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"14px" }}>
              <div><Label>From</Label><Input placeholder="e.g. Taksim" value={form.from} onChange={e => setForm({...form,from:e.target.value})} /></div>
              <div><Label>To</Label><Input placeholder="e.g. Sultanahmet" value={form.to} onChange={e => setForm({...form,to:e.target.value})} /></div>
            </div>

            {/* Date + Distance + Duration */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px", marginBottom:"14px" }}>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm({...form,date:e.target.value})} style={{ colorScheme:"dark" }} />
              </div>
              <div>
                <Label>km {form.platform==="BiTaksi"?"(opt)":""}</Label>
                <Input type="number" min="0" placeholder="6.42" value={form.distanceKm} onChange={e => setForm({...form,distanceKm:e.target.value})} />
              </div>
              <div>
                <Label>Minutes</Label>
                <Input type="number" min="0" placeholder="18" value={form.durationMin} onChange={e => setForm({...form,durationMin:e.target.value})} />
              </div>
            </div>

            {/* Fare mode toggle */}
            <div style={{ marginBottom:"14px" }}>
              <Label>Fare entry</Label>
              <div style={{ display:"flex", gap:"8px" }}>
                {[["breakdown","Breakdown (Uber-style)"],["total","Total only"]].map(([m,l]) => (
                  <button key={m} onClick={() => setForm({...form,inputMode:m})} style={{
                    flex:1, padding:"10px",
                    border:`1px solid ${form.inputMode===m ? C.accent : C.border}`,
                    background: form.inputMode===m ? C.accentDim : "transparent",
                    color: form.inputMode===m ? C.accent : C.muted,
                    borderRadius:"12px", cursor:"pointer", fontFamily:"inherit",
                    fontSize:"12px", fontWeight: form.inputMode===m ? 700 : 500,
                    transition:"all 0.2s",
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {form.inputMode==="breakdown" ? (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px", marginBottom:"14px" }}>
                <div><Label>Booking ₺</Label><Input type="number" min="0" placeholder="50.66" value={form.bookingFee} onChange={e => setForm({...form,bookingFee:e.target.value})} /></div>
                <div><Label>Meter ₺</Label><Input type="number" min="0" placeholder="372.00" value={form.meterFare} onChange={e => setForm({...form,meterFare:e.target.value})} /></div>
                <div><Label>Tip ₺</Label><Input type="number" min="0" placeholder="40.00" value={form.tip} onChange={e => setForm({...form,tip:e.target.value})} /></div>
              </div>
            ) : (
              <div style={{ marginBottom:"14px" }}>
                <Label>Total paid ₺</Label>
                <Input type="number" min="0" placeholder="462.66" value={form.totalTL} onChange={e => setForm({...form,totalTL:e.target.value})} />
              </div>
            )}

            {/* Live preview card */}
            {resolveTotal(form) > 0 && (
              <div style={{
                marginBottom:"14px", padding:"16px 18px",
                background:`linear-gradient(135deg, rgba(255,107,53,0.12) 0%, rgba(255,107,53,0.04) 100%)`,
                border:`1px solid rgba(255,107,53,0.25)`, borderRadius:"16px",
                display:"flex", justifyContent:"space-between", alignItems:"center",
              }}>
                <span style={{ fontSize:"12px", color:C.muted, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase" }}>Trip total</span>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:"22px", fontWeight:800, color:C.accent, letterSpacing:"-0.5px" }}>{fmtTL(resolveTotal(form))}</div>
                  <div style={{ fontSize:"13px", color:C.green, fontWeight:600 }}>{fmtC(resolveTotal(form)*rate, currency.symbol)} {currency.code}</div>
                </div>
              </div>
            )}

            <div style={{ marginBottom:"14px" }}>
              <Label>Notes (optional)</Label>
              <Input placeholder="e.g. bridge crossing, heavy traffic" value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} />
            </div>

            {formError && (
              <div style={{ padding:"10px 14px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:"10px", color:"#ef4444", fontSize:"13px", marginBottom:"12px" }}>
                {formError}
              </div>
            )}

            <button onClick={addTrip} style={{
              width:"100%", padding:"16px",
              background:`linear-gradient(135deg, #ff6b35, #ff8c5a)`,
              color:"#fff", border:"none", borderRadius:"16px",
              fontSize:"14px", fontWeight:800, letterSpacing:"1px",
              textTransform:"uppercase", cursor:"pointer", fontFamily:"inherit",
              boxShadow:"0 8px 24px rgba(255,107,53,0.35)",
              transition:"transform 0.15s, box-shadow 0.15s",
            }}
            onMouseDown={e => e.currentTarget.style.transform="scale(0.98)"}
            onMouseUp={e => e.currentTarget.style.transform="scale(1)"}
            >
              Save Trip
            </button>

            {/* Recent trips */}
            {trips.length > 0 && (
              <div style={{ marginTop:"28px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
                  <div style={{ fontSize:"16px", fontWeight:700, color:C.text }}>Recent trips</div>
                  {trips.length > 3 && (
                    <button onClick={() => setTab("history")} style={{
                      background:"none", border:"none", color:C.accent, fontSize:"12px", cursor:"pointer", fontFamily:"inherit", fontWeight:600,
                    }}>See all {trips.length} →</button>
                  )}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                  {[...trips].sort((a,b) => (b.date||"").localeCompare(a.date||"")).slice(0,3).map(t => (
                    <TripCard key={t.id} trip={t} rate={rate} currency={currency} onRemove={() => removeTrip(t.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ ESTIMATE TAB ══ */}
        {tab==="estimate" && (
          <div className="tab-content">
            <div style={{ fontSize:"18px", fontWeight:800, color:C.text, marginBottom:"20px", letterSpacing:"-0.5px" }}>Estimate Fare</div>
            <div style={{ marginBottom:"16px" }}>
              <Label>Platform</Label>
              <div style={{ display:"flex", gap:"8px" }}>
                {PLATFORMS.map(p => <PlatformBtn key={p} platform={p} active={estimate.platform===p} onClick={() => setEstimate({...estimate,platform:p})} />)}
              </div>
            </div>

            {stats && (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"12px", padding:"12px 14px", marginBottom:"14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:"12px", color:C.muted }}>Your calibrated rate</span>
                <span style={{ fontSize:"14px", fontWeight:700, color:C.accent }}>{fmtTL(stats.effRate)}/km · {stats.totalTrips} trips</span>
              </div>
            )}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"12px" }}>
              <div><Label>Distance km</Label><Input type="number" min="0" placeholder="6.42" value={estimate.distanceKm} onChange={e => setEstimate({...estimate,distanceKm:e.target.value})} /></div>
              <div><Label>Duration min</Label><Input type="number" min="0" placeholder="18" value={estimate.durationMin} onChange={e => setEstimate({...estimate,durationMin:e.target.value})} /></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"16px" }}>
              <div>
                <Label>Toll</Label>
                <Select value={estimate.toll} onChange={e => setEstimate({...estimate,toll:e.target.value})}>
                  <option value="none">No toll</option>
                  <option value="bridge">Bosphorus Bridge ₺47</option>
                  <option value="tunnel">Eurasia Tunnel ₺225</option>
                </Select>
              </div>
              <div><Label>Tip ₺</Label><Input type="number" min="0" placeholder="0" value={estimate.tip} onChange={e => setEstimate({...estimate,tip:e.target.value})} /></div>
            </div>

            {(num(estimate.distanceKm)>0 || num(estimate.durationMin)>0) && (
              <div style={{
                background:`linear-gradient(160deg, ${P_BG[estimate.platform]}, rgba(255,255,255,0.02))`,
                border:`1px solid ${P_COLOR[estimate.platform]}30`,
                borderRadius:"20px", padding:"20px",
                boxShadow:`0 0 40px ${P_GLOW[estimate.platform]}`,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px" }}>
                  <Pill platform={estimate.platform} />
                  {num(estimate.distanceKm)===0 && <span style={{ fontSize:"11px", color:C.muted }}>time-based estimate</span>}
                </div>

                {/* Breakdown rows */}
                {[
                  ["Flag fall", fmtTL(est.flagFall)],
                  estimate.platform==="Uber" && ["Booking fee (approx)", fmtTL(est.booking)],
                  num(estimate.distanceKm)>0
                    ? [`Distance · ${estimate.distanceKm}km × ${fmtTL(est.rk)}`, fmtTL(est.dist)]
                    : [`Time estimate · ${estimate.durationMin}min`, fmtTL(est.dist)],
                  estimate.toll!=="none" && ["Toll", fmtTL(est.toll)],
                  num(estimate.tip)>0 && ["Tip", fmtTL(est.tip)],
                ].filter(Boolean).map(([l,v]) => (
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:"13px", marginBottom:"8px" }}>
                    <span style={{ color:C.muted }}>{l}</span>
                    <span style={{ color:P_COLOR[estimate.platform], fontWeight:600 }}>{v}</span>
                  </div>
                ))}

                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:"14px", marginTop:"6px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"6px" }}>
                    <span style={{ fontSize:"12px", color:C.muted, textTransform:"uppercase", letterSpacing:"1px" }}>Total TRY</span>
                    <span style={{ fontSize:"26px", fontWeight:800, color:C.accent, letterSpacing:"-1px" }}>{fmtTL(est.total)}</span>
                  </div>
                  {/* All currencies */}
                  <div style={{ background:"rgba(0,0,0,0.2)", borderRadius:"12px", padding:"12px", marginTop:"8px" }}>
                    {CURRENCIES.map(c => (
                      <div key={c.code} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:`1px solid ${C.border}` }}>
                        <span style={{ fontSize:"12px", color: activeCurrency===c.code ? C.text : C.muted, fontWeight: activeCurrency===c.code ? 700 : 400 }}>
                          {c.symbol} {c.code}
                        </span>
                        <span style={{ fontSize:"13px", fontWeight: activeCurrency===c.code ? 800 : 500, color: activeCurrency===c.code ? C.green : C.muted2 }}>
                          {fmtC(est.total * rates[c.code], c.symbol)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(num(estimate.distanceKm)===0 && num(estimate.durationMin)===0) && (
              <div style={{ textAlign:"center", padding:"50px 20px", color:C.muted2 }}>
                <div style={{ fontSize:"32px", marginBottom:"10px" }}>◎</div>
                <div style={{ fontSize:"14px" }}>Enter distance or duration<br/>to estimate a fare</div>
              </div>
            )}
          </div>
        )}

        {/* ══ COMPARE TAB ══ */}
        {tab==="compare" && (
          <div className="tab-content">
            <div style={{ fontSize:"18px", fontWeight:800, color:C.text, marginBottom:"20px", letterSpacing:"-0.5px" }}>Platform Compare</div>
            {!stats || stats.ranked.length < 2 ? (
              <div style={{ textAlign:"center", padding:"60px 20px", color:C.muted2 }}>
                <div style={{ fontSize:"32px", marginBottom:"10px" }}>⇄</div>
                <div style={{ fontSize:"14px" }}>Log trips on 2+ platforms<br/>to unlock comparison</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                {stats.ranked.map(([platform, d], i) => (
                  <div key={platform} style={{
                    background: i===0 ? `linear-gradient(135deg, ${P_BG[platform]}, rgba(255,255,255,0.02))` : C.surface,
                    border:`1px solid ${i===0 ? P_COLOR[platform]+"50" : C.border}`,
                    borderRadius:"20px", padding:"20px",
                    boxShadow: i===0 ? `0 0 32px ${P_GLOW[platform]}` : "none",
                    position:"relative",
                  }}>
                    {i===0 && (
                      <div style={{
                        position:"absolute", top:"14px", right:"14px",
                        background:P_BG[platform], border:`1px solid ${P_COLOR[platform]}40`,
                        color:P_COLOR[platform], fontSize:"10px", letterSpacing:"1px",
                        fontWeight:700, padding:"3px 10px", borderRadius:"20px",
                      }}>CHEAPEST</div>
                    )}
                    <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"14px" }}>
                      <Pill platform={platform} />
                      <span style={{ fontSize:"12px", color:C.muted }}>{d.count} trip{d.count!==1?"s":""}</span>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                      {[
                        ["Avg fare (TRY)", fmtTL(d.avg)],
                        [`Avg fare (${currency.code})`, fmtC(d.avg*rate, currency.symbol)],
                        d.avgKm>0 && ["Avg distance", `${d.avgKm.toFixed(1)} km`],
                        d.avgMin>0 && ["Avg duration", `${d.avgMin.toFixed(0)} min`],
                      ].filter(Boolean).map(([l,v]) => (
                        <div key={l}>
                          <div style={{ fontSize:"10px", color:C.muted2, letterSpacing:"1px", textTransform:"uppercase", marginBottom:"2px" }}>{l}</div>
                          <div style={{ fontSize:"17px", fontWeight:800, color:i===0 ? P_COLOR[platform] : C.text, letterSpacing:"-0.5px" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {stats.ranked.length >= 2 && (() => {
                  const cheap = stats.ranked[0][1].avg;
                  const pricey = stats.ranked[stats.ranked.length-1][1].avg;
                  const delta = pricey - cheap;
                  return (
                    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"16px", padding:"16px 18px" }}>
                      <div style={{ fontSize:"12px", color:C.muted, marginBottom:"6px" }}>Avg saving per trip</div>
                      <div style={{ display:"flex", gap:"12px", alignItems:"baseline" }}>
                        <span style={{ fontSize:"22px", fontWeight:800, color:C.accent, letterSpacing:"-0.5px" }}>{fmtTL(delta)}</span>
                        <span style={{ fontSize:"16px", fontWeight:700, color:C.green }}>{fmtC(delta*rate, currency.symbol)} {currency.code}</span>
                      </div>
                      <div style={{ fontSize:"12px", color:C.muted, marginTop:"4px" }}>
                        Using <span style={{ color:P_COLOR[stats.ranked[0][0]], fontWeight:700 }}>{stats.ranked[0][0]}</span> vs <span style={{ color:P_COLOR[stats.ranked[stats.ranked.length-1][0]], fontWeight:700 }}>{stats.ranked[stats.ranked.length-1][0]}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ══ HISTORY TAB ══ */}
        {tab==="history" && (
          <div className="tab-content">
            <div style={{ fontSize:"18px", fontWeight:800, color:C.text, marginBottom:"20px", letterSpacing:"-0.5px" }}>Trip History</div>

            {/* Filters */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"16px", padding:"16px", marginBottom:"16px" }}>
              <Label>Filter</Label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px" }}>
                <div>
                  <Label>Platform</Label>
                  <Select value={histFilter.platform} onChange={e => setHistFilter({...histFilter,platform:e.target.value})}>
                    <option value="All">All</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>From</Label>
                  <Input type="date" value={histFilter.dateFrom} onChange={e => setHistFilter({...histFilter,dateFrom:e.target.value})} style={{ colorScheme:"dark" }} />
                </div>
                <div>
                  <Label>To</Label>
                  <Input type="date" value={histFilter.dateTo} onChange={e => setHistFilter({...histFilter,dateTo:e.target.value})} style={{ colorScheme:"dark" }} />
                </div>
              </div>
              {(histFilter.platform!=="All"||histFilter.dateFrom||histFilter.dateTo) && (
                <button onClick={() => setHistFilter({platform:"All",dateFrom:"",dateTo:""})} style={{
                  marginTop:"10px", background:"none", border:`1px solid ${C.border}`,
                  color:C.muted, borderRadius:"8px", padding:"5px 12px", fontSize:"11px",
                  cursor:"pointer", fontFamily:"inherit",
                }}>Clear filters ×</button>
              )}
            </div>

            {/* Rate change notice */}
            {(() => {
              const changed = trips.filter(t => t.rateSnapshot && Math.abs((t.rateSnapshot[activeCurrency]||0)-rate)>0.001);
              if (!changed.length) return null;
              return (
                <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:"12px", padding:"12px 14px", marginBottom:"14px", fontSize:"12px", color:"#f59e0b" }}>
                  ⚡ {changed.length} trip{changed.length!==1?"s":""} recorded at a different {currency.code} rate — shown at original rate
                </div>
              );
            })()}

            {filteredTrips.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px", color:C.muted2 }}>
                <div style={{ fontSize:"32px", marginBottom:"10px" }}>≡</div>
                <div style={{ fontSize:"14px" }}>{trips.length===0 ? "No trips logged yet" : "No trips match this filter"}</div>
              </div>
            ) : (
              <div>
                {/* Summary bar */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", marginBottom:"14px" }}>
                  {[
                    ["Trips", filteredTrips.length],
                    ["Total TRY", fmtTL(filteredTrips.reduce((s,t)=>s+num(t.resolvedTotal),0))],
                    [currency.code, fmtC(filteredTrips.reduce((s,t)=>s+num(t.resolvedTotal),0)*rate, currency.symbol)],
                  ].map(([l,v]) => (
                    <div key={l} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"12px", padding:"12px", textAlign:"center" }}>
                      <div style={{ fontSize:"9px", color:C.muted2, letterSpacing:"1px", textTransform:"uppercase", marginBottom:"4px" }}>{l}</div>
                      <div style={{ fontSize:"15px", fontWeight:800, color:C.text }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                  {filteredTrips.map(t => (
                    <TripCard key={t.id} trip={t} rate={rate} currency={currency} onRemove={() => removeTrip(t.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ SETTINGS TAB ══ */}
        {tab==="settings" && (
          <div className="tab-content">
            <div style={{ fontSize:"18px", fontWeight:800, color:C.text, marginBottom:"20px", letterSpacing:"-0.5px" }}>Settings</div>

            {/* All rates */}
            <div style={{ marginBottom:"20px" }}>
              <Label style={{ marginBottom:"12px" }}>Exchange Rates · 1 TRY =</Label>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {CURRENCIES.map(c => (
                  <div key={c.code} style={{
                    background:C.surface, border:`1px solid ${activeCurrency===c.code ? C.accent+"40" : C.border}`,
                    borderRadius:"14px", padding:"14px 16px",
                    display:"flex", alignItems:"center", gap:"12px",
                  }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"13px", fontWeight:700, color: activeCurrency===c.code ? C.accent : C.text }}>{c.symbol} {c.code}</div>
                      <div style={{ fontSize:"11px", color:C.muted }}>{c.name}</div>
                    </div>
                    <input type="number" step="0.0001" value={rates[c.code]}
                      onChange={e => setRates({...rates,[c.code]:parseFloat(e.target.value)||0})}
                      style={{
                        background:C.surface2, border:`1px solid ${C.border}`, color:C.accent,
                        borderRadius:"8px", padding:"8px 10px", width:"100px", fontSize:"13px",
                        fontFamily:"inherit", outline:"none", fontWeight:700, textAlign:"right",
                      }} />
                    <button onClick={() => setRates({...rates,[c.code]:c.defaultRate})} style={{
                      background:"none", border:`1px solid ${C.border}`, color:C.muted2,
                      borderRadius:"8px", padding:"8px 10px", fontSize:"10px",
                      cursor:"pointer", fontFamily:"inherit", flexShrink:0,
                    }}>↺</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tariff info */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"16px", padding:"16px", marginBottom:"16px" }}>
              <Label style={{ marginBottom:"12px" }}>Official 2026 Tariff</Label>
              {[["Flag fall (açılış)", fmtTL(OFFICIAL_FLAG_FALL)],["Per km", fmtTL(OFFICIAL_RATE_PER_KM)],["Waiting per hour", "₺175.00"],["Night surcharge", "None — flat rate 24/7"],["Bosphorus Bridge toll", fmtTL(BOSPHORUS_TOLL)],["Eurasia Tunnel toll", fmtTL(TUNNEL_TOLL)]].map(([l,v]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:"13px" }}>
                  <span style={{ color:C.muted }}>{l}</span>
                  <span style={{ color:C.text, fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Danger zone */}
            {trips.length > 0 && (
              <div style={{ background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:"16px", padding:"16px" }}>
                <Label style={{ color:"#ef4444", marginBottom:"10px" }}>Data</Label>
                <div style={{ fontSize:"13px", color:C.muted, marginBottom:"12px" }}>{trips.length} trips stored locally on this device</div>
                <button onClick={() => { if(window.confirm("Delete all trips? This cannot be undone.")) { setTrips([]); showToast("All trips cleared"); }}} style={{
                  background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)",
                  color:"#ef4444", borderRadius:"10px", padding:"10px 16px",
                  fontSize:"13px", cursor:"pointer", fontFamily:"inherit", fontWeight:600,
                }}>Clear all trips</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:`rgba(14,14,18,0.92)`,
        backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
        borderTop:`1px solid ${C.border}`,
        display:"flex", padding:"8px 0 max(8px, env(safe-area-inset-bottom))",
        zIndex:100,
      }}>
        {TABS.map(({ key, icon, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex:1, background:"none", border:"none",
            display:"flex", flexDirection:"column", alignItems:"center", gap:"3px",
            cursor:"pointer", padding:"6px 4px",
            color: tab===key ? C.accent : C.muted2,
            fontFamily:"inherit", transition:"color 0.2s",
          }}>
            <span style={{ fontSize:"18px", lineHeight:1 }}>{icon}</span>
            <span style={{ fontSize:"9px", letterSpacing:"0.5px", fontWeight: tab===key ? 700 : 500, textTransform:"uppercase" }}>{label}</span>
            {tab===key && (
              <div style={{ width:"4px", height:"4px", borderRadius:"50%", background:C.accent, marginTop:"1px" }} />
            )}
          </button>
        ))}
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position:"fixed", bottom:"80px", left:"50%",
          transform:"translateX(-50%)",
          background:`rgba(255,107,53,0.95)`,
          color:"#fff", borderRadius:"20px",
          padding:"10px 20px", fontSize:"13px", fontWeight:600,
          zIndex:200, whiteSpace:"nowrap",
          animation:"toastIn 0.25s ease",
          boxShadow:"0 8px 24px rgba(255,107,53,0.4)",
        }}>{toast}</div>
      )}
    </div>
  );
}
