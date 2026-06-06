import { useState, useMemo, useEffect } from "react";

// ── Constants ──────────────────────────────────────────────────────
const OFFICIAL_FLAG_FALL = 54;
const OFFICIAL_RATE_PER_KM = 36;
const OFFICIAL_WAIT_PER_MIN = 175 / 60;
const BOSPHORUS_TOLL = 47;
const TUNNEL_TOLL = 225;

const PLATFORMS = ["Uber", "BiTaksi", "Street Taxi"];
const PLATFORM_COLORS = { Uber: "#1dbf73", BiTaksi: "#4f8ef7", "Street Taxi": "#e8b84b" };
const PLATFORM_BG = { Uber: "#0a1f16", BiTaksi: "#0a1428", "Street Taxi": "#1e1a10" };

const CURRENCIES = [
  { code: "ZAR", symbol: "R",  name: "South African Rand",  defaultRate: 0.3542 },
  { code: "USD", symbol: "$",  name: "US Dollar",           defaultRate: 0.0280 },
  { code: "EUR", symbol: "€",  name: "Euro",                defaultRate: 0.0258 },
  { code: "GBP", symbol: "£",  name: "British Pound",       defaultRate: 0.0221 },
  { code: "AED", symbol: "د.إ",name: "UAE Dirham",          defaultRate: 0.1028 },
];

const TABS = [
  { key: "log",      label: "Trip Log" },
  { key: "estimate", label: "Estimate" },
  { key: "compare",  label: "Compare" },
  { key: "history",  label: "History" },
  { key: "stats",    label: "My Rates" },
];

// ── Helpers ────────────────────────────────────────────────────────
function num(v) { return parseFloat(v) || 0; }
function fmt(val, symbol) { return `${symbol}${Number(val).toFixed(2)}`; }
function fmtTL(val) { return `₺${Number(val).toFixed(2)}`; }
function today() { return new Date().toISOString().split("T")[0]; }

const emptyForm = {
  platform: "Uber", from: "", to: "",
  distanceKm: "", durationMin: "",
  bookingFee: "", meterFare: "", tip: "",
  totalTL: "", notes: "",
  inputMode: "breakdown",
  date: today(),
};

const emptyEstimate = {
  platform: "Uber", distanceKm: "", durationMin: "", toll: "none", tip: "",
};

// ── App ────────────────────────────────────────────────────────────
export default function App() {
  // localStorage-backed trips
  const [trips, setTripsRaw] = useState(() => {
    try { const s = localStorage.getItem("ist_trips"); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });

  // localStorage-backed exchange rates (per currency code)
  const [rates, setRatesRaw] = useState(() => {
    try {
      const s = localStorage.getItem("ist_rates");
      const saved = s ? JSON.parse(s) : {};
      const merged = {};
      CURRENCIES.forEach(c => { merged[c.code] = saved[c.code] ?? c.defaultRate; });
      return merged;
    } catch {
      const merged = {};
      CURRENCIES.forEach(c => { merged[c.code] = c.defaultRate; });
      return merged;
    }
  });

  const [activeCurrency, setActiveCurrencyRaw] = useState(() => {
    return localStorage.getItem("ist_currency") || "ZAR";
  });

  const [form, setForm] = useState(emptyForm);
  const [estimate, setEstimate] = useState(emptyEstimate);
  const [tab, setTab] = useState("log");
  const [formError, setFormError] = useState("");
  const [historyFilter, setHistoryFilter] = useState({ platform: "All", dateFrom: "", dateTo: "" });

  // Persist on change
  function setTrips(t) { setTripsRaw(t); try { localStorage.setItem("ist_trips", JSON.stringify(t)); } catch {} }
  function setRates(r) { setRatesRaw(r); try { localStorage.setItem("ist_rates", JSON.stringify(r)); } catch {} }
  function setActiveCurrency(c) { setActiveCurrencyRaw(c); try { localStorage.setItem("ist_currency", c); } catch {} }

  const currency = CURRENCIES.find(c => c.code === activeCurrency) || CURRENCIES[0];
  const rate = rates[activeCurrency];

  // ── stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (trips.length === 0) return null;
    const byPlatform = {};
    PLATFORMS.forEach(p => { byPlatform[p] = { trips: [], totalTL: 0, totalKm: 0, totalMin: 0 }; });
    trips.forEach(t => {
      const p = t.platform;
      byPlatform[p].trips.push(t);
      byPlatform[p].totalTL += num(t.resolvedTotal);
      byPlatform[p].totalKm += num(t.distanceKm);
      byPlatform[p].totalMin += num(t.durationMin);
    });
    const allTotal = trips.reduce((s, t) => s + num(t.resolvedTotal), 0);
    const allKm = trips.reduce((s, t) => s + num(t.distanceKm), 0);
    const avgFare = allTotal / trips.length;
    const tripsWithKm = trips.filter(t => num(t.distanceKm) > 0);
    const effectiveRatePerKm = tripsWithKm.length > 0
      ? (tripsWithKm.reduce((s, t) => s + num(t.resolvedTotal), 0) - OFFICIAL_FLAG_FALL * tripsWithKm.length)
        / tripsWithKm.reduce((s, t) => s + num(t.distanceKm), 0)
      : OFFICIAL_RATE_PER_KM;
    const platformStats = {};
    PLATFORMS.forEach(p => {
      const d = byPlatform[p];
      if (!d.trips.length) return;
      platformStats[p] = {
        count: d.trips.length, avgFare: d.totalTL / d.trips.length,
        avgKm: d.totalKm / d.trips.length, avgMin: d.totalMin / d.trips.length,
        totalTL: d.totalTL,
      };
    });
    const ranked = Object.entries(platformStats).sort((a, b) => a[1].avgFare - b[1].avgFare);
    return { avgFare, effectiveRatePerKm, totalTrips: trips.length, allKm, platformStats, ranked };
  }, [trips]);

  // ── estimate ───────────────────────────────────────────────────
  const estimatedFare = useMemo(() => {
    const km = num(estimate.distanceKm);
    const min = num(estimate.durationMin);
    const tip = num(estimate.tip);
    const ratePerKm = stats?.effectiveRatePerKm ?? OFFICIAL_RATE_PER_KM;
    const distCharge = km > 0 ? km * ratePerKm : min * OFFICIAL_WAIT_PER_MIN;
    const flagFall = OFFICIAL_FLAG_FALL;
    let toll = 0;
    if (estimate.toll === "bridge") toll = BOSPHORUS_TOLL;
    if (estimate.toll === "tunnel") toll = TUNNEL_TOLL;
    const bookingFee = estimate.platform === "Uber" ? 50 : 0;
    const subtotal = flagFall + bookingFee + distCharge + toll;
    const total = subtotal + tip;
    return { flagFall, bookingFee, distCharge, toll, tip, subtotal, total, ratePerKm, km, min };
  }, [estimate, stats]);

  // ── filtered history ───────────────────────────────────────────
  const filteredTrips = useMemo(() => {
    return [...trips].filter(t => {
      if (historyFilter.platform !== "All" && t.platform !== historyFilter.platform) return false;
      if (historyFilter.dateFrom && t.date < historyFilter.dateFrom) return false;
      if (historyFilter.dateTo && t.date > historyFilter.dateTo) return false;
      return true;
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [trips, historyFilter]);

  // ── helpers ────────────────────────────────────────────────────
  function resolveTotal(f) {
    if (f.inputMode === "total") return num(f.totalTL);
    return num(f.bookingFee) + num(f.meterFare) + num(f.tip);
  }

  function addTrip() {
    const resolved = resolveTotal(form);
    if (!form.from || !form.to) { setFormError("From and To are required."); return; }
    if (!form.durationMin && !form.distanceKm) { setFormError("Enter at least duration or distance."); return; }
    if (resolved <= 0) { setFormError("Fare must be greater than zero."); return; }
    if (!form.date) { setFormError("Please enter a date."); return; }
    setFormError("");
    const rateSnapshot = {};
    CURRENCIES.forEach(c => { rateSnapshot[c.code] = rates[c.code]; });
    setTrips([...trips, { ...form, resolvedTotal: resolved, id: Date.now(), rateSnapshot }]);
    setForm({ ...emptyForm, platform: form.platform, date: form.date });
  }

  function removeTrip(id) { setTrips(trips.filter(t => t.id !== id)); }

  function updateRate(code, val) {
    setRates({ ...rates, [code]: parseFloat(val) || 0 });
  }

  // ── shared styles ──────────────────────────────────────────────
  const IS = {
    width: "100%", boxSizing: "border-box",
    background: "#0d0d0d", border: "1px solid #2a2820",
    color: "#f0ece0", borderRadius: "6px", padding: "10px 12px",
    fontSize: "13px", fontFamily: "'DM Mono','Courier New',monospace", outline: "none",
  };
  const LS = {
    display: "block", fontSize: "10px", letterSpacing: "2px",
    color: "#5a5040", textTransform: "uppercase", marginBottom: "5px",
  };
  const Card = ({ children, border, bg, style = {} }) => (
    <div style={{
      background: bg || "#161613", border: `1px solid ${border || "#2a2820"}`,
      borderRadius: "10px", padding: "16px", ...style,
    }}>{children}</div>
  );

  function PlatformPill({ platform }) {
    return (
      <span style={{
        fontSize: "10px", padding: "2px 8px", borderRadius: "20px",
        background: PLATFORM_BG[platform], color: PLATFORM_COLORS[platform],
        border: `1px solid ${PLATFORM_COLORS[platform]}40`,
        letterSpacing: "1px", fontWeight: 700, whiteSpace: "nowrap",
      }}>{platform}</span>
    );
  }

  function PlatformSelector({ value, onChange }) {
    return (
      <div style={{ marginBottom: "12px" }}>
        <label style={LS}>Platform</label>
        <div style={{ display: "flex", gap: "8px" }}>
          {PLATFORMS.map(p => (
            <button key={p} onClick={() => onChange(p)} style={{
              flex: 1, padding: "9px 4px",
              border: `1px solid ${value === p ? PLATFORM_COLORS[p] : "#2a2820"}`,
              background: value === p ? PLATFORM_BG[p] : "#0d0d0d",
              color: value === p ? PLATFORM_COLORS[p] : "#4a4030",
              borderRadius: "6px", cursor: "pointer", fontFamily: "inherit",
              fontSize: "11px", fontWeight: value === p ? 700 : 400, letterSpacing: "1px",
            }}>{p}</button>
          ))}
        </div>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", fontFamily: "'DM Mono','Courier New',monospace", color: "#f0ece0" }}>

      {/* HEADER */}
      <div style={{
        background: "linear-gradient(135deg,#c8922a 0%,#e8b84b 45%,#c8922a 100%)",
        padding: "26px 22px 18px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(0,0,0,0.05) 8px,rgba(0,0,0,0.05) 16px)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: "10px", letterSpacing: "4px", color: "rgba(0,0,0,0.45)", textTransform: "uppercase", marginBottom: "3px" }}>Istanbul · Taksi Hesaplayıcı</div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#1a0e00", letterSpacing: "-0.5px" }}>Taxi Fare Calculator</h1>
          <div style={{ marginTop: "3px", fontSize: "11px", color: "rgba(0,0,0,0.4)" }}>Uber · BiTaksi · Street · Multi-currency · ₺</div>
        </div>
        <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap", background: "rgba(0,0,0,0.15)", borderRadius: "8px", padding: "10px 12px" }}>
          {[["Flag fall", fmtTL(OFFICIAL_FLAG_FALL)], ["Per km", fmtTL(OFFICIAL_RATE_PER_KM)], ["Wait/min", fmtTL(OFFICIAL_WAIT_PER_MIN.toFixed(2))], ["Night rate", "None"]].map(([l, v]) => (
            <div key={l} style={{ flex: "1 1 60px" }}>
              <div style={{ fontSize: "9px", color: "rgba(0,0,0,0.38)", letterSpacing: "2px", textTransform: "uppercase" }}>{l}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#1a0e00" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CURRENCY BAR */}
      <div style={{ background: "#161613", borderBottom: "1px solid #2a2820", padding: "12px 16px" }}>
        {/* Active currency selector */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => setActiveCurrency(c.code)} style={{
              padding: "5px 10px", borderRadius: "20px", cursor: "pointer", fontFamily: "inherit",
              fontSize: "11px", fontWeight: activeCurrency === c.code ? 700 : 400,
              border: `1px solid ${activeCurrency === c.code ? "#e8b84b" : "#2a2820"}`,
              background: activeCurrency === c.code ? "#1e1a10" : "#0d0d0d",
              color: activeCurrency === c.code ? "#e8b84b" : "#4a4030",
            }}>{c.symbol} {c.code}</button>
          ))}
        </div>
        {/* Rate editor for active currency */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "10px", letterSpacing: "2px", color: "#5a5040", textTransform: "uppercase" }}>1 TRY =</span>
          <input type="number" step="0.0001" value={rates[activeCurrency]}
            onChange={e => updateRate(activeCurrency, e.target.value)}
            style={{ ...IS, width: "80px", padding: "5px 8px", fontSize: "12px" }} />
          <span style={{ fontSize: "11px", color: "#c8922a" }}>{currency.code}</span>
          <span style={{ fontSize: "10px", color: "#3a3020" }}>· {currency.name}</span>
          <button onClick={() => updateRate(activeCurrency, currency.defaultRate)} style={{
            background: "none", border: "1px solid #2a2820", color: "#4a4030",
            borderRadius: "4px", padding: "3px 8px", fontSize: "9px", cursor: "pointer",
            fontFamily: "inherit", letterSpacing: "1px", textTransform: "uppercase",
          }}>Reset</button>
        </div>
        <div style={{ marginTop: "8px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {CURRENCIES.filter(c => c.code !== activeCurrency).map(c => (
            <span key={c.code} style={{ fontSize: "10px", color: "#3a3020" }}>
              {c.symbol}{(OFFICIAL_FLAG_FALL * rates[c.code]).toFixed(0)} flag · {c.code}
            </span>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", borderBottom: "1px solid #2a2820", background: "#111110", overflowX: "auto" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: "1 0 auto", padding: "12px 6px", background: "none", border: "none",
            borderBottom: tab === key ? "2px solid #e8b84b" : "2px solid transparent",
            color: tab === key ? "#e8b84b" : "#4a4030",
            fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase",
            cursor: "pointer", fontFamily: "inherit", fontWeight: tab === key ? 700 : 400,
            whiteSpace: "nowrap",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "18px 16px", maxWidth: "600px", margin: "0 auto" }}>

        {/* ══ LOG ══ */}
        {tab === "log" && (
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#7a7060", textTransform: "uppercase", marginBottom: "14px" }}>Add a trip</div>
            <PlatformSelector value={form.platform} onChange={p => setForm({ ...form, platform: p })} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div><label style={LS}>From</label><input placeholder="e.g. Taksim" value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} style={IS} /></div>
              <div><label style={LS}>To</label><input placeholder="e.g. Sultanahmet" value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} style={IS} /></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={LS}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  style={{ ...IS, colorScheme: "dark" }} />
              </div>
              <div>
                <label style={LS}>Distance km {form.platform === "BiTaksi" ? "(opt)" : ""}</label>
                <input type="number" min="0" placeholder="6.42" value={form.distanceKm} onChange={e => setForm({ ...form, distanceKm: e.target.value })} style={IS} />
              </div>
              <div>
                <label style={LS}>Duration (min)</label>
                <input type="number" min="0" placeholder="18" value={form.durationMin} onChange={e => setForm({ ...form, durationMin: e.target.value })} style={IS} />
              </div>
            </div>

            {/* Fare entry mode */}
            <div style={{ marginBottom: "10px" }}>
              <label style={LS}>Fare entry</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {[["breakdown", "Breakdown (Uber-style)"], ["total", "Total only"]].map(([m, l]) => (
                  <button key={m} onClick={() => setForm({ ...form, inputMode: m })} style={{
                    flex: 1, padding: "8px",
                    border: `1px solid ${form.inputMode === m ? "#e8b84b" : "#2a2820"}`,
                    background: form.inputMode === m ? "#1e1a10" : "#0d0d0d",
                    color: form.inputMode === m ? "#e8b84b" : "#4a4030",
                    borderRadius: "6px", cursor: "pointer", fontFamily: "inherit", fontSize: "11px",
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {form.inputMode === "breakdown" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div><label style={LS}>Booking (₺)</label><input type="number" min="0" placeholder="50.66" value={form.bookingFee} onChange={e => setForm({ ...form, bookingFee: e.target.value })} style={IS} /></div>
                <div><label style={LS}>Meter (₺)</label><input type="number" min="0" placeholder="372.00" value={form.meterFare} onChange={e => setForm({ ...form, meterFare: e.target.value })} style={IS} /></div>
                <div><label style={LS}>Tip (₺)</label><input type="number" min="0" placeholder="40.00" value={form.tip} onChange={e => setForm({ ...form, tip: e.target.value })} style={IS} /></div>
              </div>
            ) : (
              <div style={{ marginBottom: "10px" }}>
                <label style={LS}>Total paid (₺)</label>
                <input type="number" min="0" placeholder="e.g. 462.66" value={form.totalTL} onChange={e => setForm({ ...form, totalTL: e.target.value })} style={IS} />
              </div>
            )}

            {resolveTotal(form) > 0 && (
              <div style={{ marginBottom: "10px", padding: "10px 14px", background: "#1a1a18", border: "1px solid #2a2820", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "#4a4030" }}>Trip total</span>
                <div>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: "#e8b84b" }}>{fmtTL(resolveTotal(form))}</span>
                  <span style={{ fontSize: "13px", color: "#8ab884", marginLeft: "10px" }}>
                    {fmt(resolveTotal(form) * rate, currency.symbol)} {currency.code}
                  </span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "10px" }}>
              <label style={LS}>Notes (optional)</label>
              <input placeholder="e.g. heavy traffic, bridge crossing" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={IS} />
            </div>

            {formError && <div style={{ color: "#e05040", fontSize: "12px", marginBottom: "8px" }}>{formError}</div>}

            <button onClick={addTrip} style={{
              width: "100%", background: "#c8922a", color: "#1a0e00", border: "none",
              borderRadius: "6px", padding: "13px", fontSize: "11px", fontWeight: 700,
              letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
            }}>+ Log Trip</button>

            {/* Recent trips preview */}
            {trips.length > 0 && (
              <div style={{ marginTop: "22px" }}>
                <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#7a7060", textTransform: "uppercase", marginBottom: "10px" }}>
                  Recent · {trips.length} total
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[...trips].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5).map(t => (
                    <div key={t.id} style={{ background: "#161613", border: "1px solid #2a2820", borderRadius: "8px", padding: "11px 13px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "4px", flexWrap: "wrap" }}>
                          <PlatformPill platform={t.platform} />
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#f0ece0" }}>{t.from || "—"} → {t.to || "—"}</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#4a4030", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          <span style={{ color: "#3a5030" }}>{t.date || "no date"}</span>
                          {t.distanceKm && <span>{t.distanceKm} km</span>}
                          {t.durationMin && <span>{t.durationMin} min</span>}
                          <span style={{ color: "#e8b84b" }}>{fmtTL(t.resolvedTotal)}</span>
                          <span style={{ color: "#8ab884" }}>{fmt(num(t.resolvedTotal) * rate, currency.symbol)}</span>
                        </div>
                      </div>
                      <button onClick={() => removeTrip(t.id)} style={{ background: "none", border: "none", color: "#2a2020", cursor: "pointer", fontSize: "18px", padding: "0 0 0 10px" }}>×</button>
                    </div>
                  ))}
                  {trips.length > 5 && (
                    <button onClick={() => setTab("history")} style={{ background: "none", border: "1px solid #2a2820", color: "#5a5040", borderRadius: "6px", padding: "8px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
                      View all {trips.length} trips →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ ESTIMATE ══ */}
        {tab === "estimate" && (
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#7a7060", textTransform: "uppercase", marginBottom: "14px" }}>Estimate a fare</div>
            <PlatformSelector value={estimate.platform} onChange={p => setEstimate({ ...estimate, platform: p })} />

            {stats && (
              <div style={{ background: "#161613", border: "1px solid #3a3020", borderRadius: "6px", padding: "9px 12px", marginBottom: "12px", fontSize: "11px", color: "#4a4030" }}>
                Using your calibrated rate: <span style={{ color: "#e8b84b" }}>{fmtTL(stats.effectiveRatePerKm)}/km</span> from {stats.totalTrips} trip{stats.totalTrips !== 1 ? "s" : ""}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div><label style={LS}>Distance km (optional)</label><input type="number" min="0" placeholder="e.g. 6.42" value={estimate.distanceKm} onChange={e => setEstimate({ ...estimate, distanceKm: e.target.value })} style={IS} /></div>
              <div><label style={LS}>Duration (min)</label><input type="number" min="0" placeholder="e.g. 18" value={estimate.durationMin} onChange={e => setEstimate({ ...estimate, durationMin: e.target.value })} style={IS} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={LS}>Toll crossing</label>
                <select value={estimate.toll} onChange={e => setEstimate({ ...estimate, toll: e.target.value })} style={{ ...IS, cursor: "pointer" }}>
                  <option value="none">None</option>
                  <option value="bridge">Bosphorus Bridge (₺47)</option>
                  <option value="tunnel">Eurasia Tunnel (₺225)</option>
                </select>
              </div>
              <div><label style={LS}>Tip (₺)</label><input type="number" min="0" placeholder="0" value={estimate.tip} onChange={e => setEstimate({ ...estimate, tip: e.target.value })} style={IS} /></div>
            </div>

            {(num(estimate.distanceKm) > 0 || num(estimate.durationMin) > 0) && (
              <div style={{ marginTop: "16px", background: PLATFORM_BG[estimate.platform], border: `1px solid ${PLATFORM_COLORS[estimate.platform]}60`, borderRadius: "10px", padding: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <span style={{ fontSize: "10px", letterSpacing: "2px", color: "#4a4030", textTransform: "uppercase" }}>Breakdown</span>
                  <PlatformPill platform={estimate.platform} />
                  {num(estimate.distanceKm) === 0 && <span style={{ fontSize: "10px", color: "#3a3020" }}>· time-based</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {[
                    ["Flag fall", fmtTL(estimatedFare.flagFall)],
                    estimate.platform === "Uber" && ["Booking fee (approx)", fmtTL(estimatedFare.bookingFee)],
                    num(estimate.distanceKm) > 0
                      ? [`Distance (${estimate.distanceKm}km × ${fmtTL(estimatedFare.ratePerKm)})`, fmtTL(estimatedFare.distCharge)]
                      : [`Time est. (${estimate.durationMin}min)`, fmtTL(estimatedFare.distCharge)],
                    estimate.toll !== "none" && ["Toll", fmtTL(estimatedFare.toll)],
                    num(estimate.tip) > 0 && ["Tip", fmtTL(estimatedFare.tip)],
                  ].filter(Boolean).map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "#4a4030" }}>{l}</span>
                      <span style={{ color: PLATFORM_COLORS[estimate.platform] }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid #2a2820", paddingTop: "10px", marginTop: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: "11px", color: "#4a4030", textTransform: "uppercase", letterSpacing: "1px" }}>Total (TRY)</span>
                      <span style={{ fontSize: "22px", fontWeight: 700, color: "#e8b84b" }}>{fmtTL(estimatedFare.total)}</span>
                    </div>
                    {/* All currencies */}
                    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
                      {CURRENCIES.map(c => (
                        <div key={c.code} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                          <span style={{ color: activeCurrency === c.code ? "#7a7060" : "#3a3020" }}>{c.symbol} {c.code} · {c.name}</span>
                          <span style={{ color: activeCurrency === c.code ? "#8ab884" : "#4a4030", fontWeight: activeCurrency === c.code ? 700 : 400 }}>
                            {fmt(estimatedFare.total * rates[c.code], c.symbol)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ COMPARE ══ */}
        {tab === "compare" && (
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#7a7060", textTransform: "uppercase", marginBottom: "14px" }}>Platform comparison</div>
            {!stats || stats.ranked.length < 2 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#3a3020", fontSize: "13px" }}>
                Log trips on at least 2 platforms to compare.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {stats.ranked.map(([platform, d], i) => (
                  <div key={platform} style={{
                    background: i === 0 ? PLATFORM_BG[platform] : "#161613",
                    border: `1px solid ${i === 0 ? PLATFORM_COLORS[platform] : "#2a2820"}`,
                    borderRadius: "10px", padding: "16px", position: "relative",
                  }}>
                    {i === 0 && <div style={{ position: "absolute", top: "12px", right: "12px", fontSize: "9px", letterSpacing: "2px", color: PLATFORM_COLORS[platform], fontWeight: 700, textTransform: "uppercase" }}>Cheapest avg ✓</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <PlatformPill platform={platform} />
                      <span style={{ fontSize: "11px", color: "#4a4030" }}>{d.count} trip{d.count !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {[
                        ["Avg fare (TRY)", fmtTL(d.avgFare)],
                        [`Avg fare (${currency.code})`, fmt(d.avgFare * rate, currency.symbol)],
                        d.avgKm > 0 && ["Avg distance", `${d.avgKm.toFixed(1)} km`],
                        d.avgMin > 0 && ["Avg duration", `${d.avgMin.toFixed(0)} min`],
                      ].filter(Boolean).map(([l, v]) => (
                        <div key={l}>
                          <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#3a3020", textTransform: "uppercase" }}>{l}</div>
                          <div style={{ fontSize: "15px", fontWeight: 700, color: i === 0 ? PLATFORM_COLORS[platform] : "#e8b84b" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {stats.ranked.length >= 2 && (() => {
                  const cheapest = stats.ranked[0][1].avgFare;
                  const priciest = stats.ranked[stats.ranked.length - 1][1].avgFare;
                  const delta = priciest - cheapest;
                  return (
                    <div style={{ background: "#0d0d0d", border: "1px dashed #2a2820", borderRadius: "8px", padding: "12px 14px", fontSize: "12px", color: "#4a4030", lineHeight: 1.7 }}>
                      Avg saving with <span style={{ color: PLATFORM_COLORS[stats.ranked[0][0]] }}>{stats.ranked[0][0]}</span> vs{" "}
                      <span style={{ color: PLATFORM_COLORS[stats.ranked[stats.ranked.length - 1][0]] }}>{stats.ranked[stats.ranked.length - 1][0]}</span>:{" "}
                      <span style={{ color: "#e8b84b" }}>{fmtTL(delta)}</span>{" / "}
                      <span style={{ color: "#8ab884" }}>{fmt(delta * rate, currency.symbol)} {currency.code}</span> per trip
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ══ HISTORY ══ */}
        {tab === "history" && (
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#7a7060", textTransform: "uppercase", marginBottom: "14px" }}>Trip history</div>

            {/* Filters */}
            <div style={{ background: "#161613", border: "1px solid #2a2820", borderRadius: "8px", padding: "14px", marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#4a4030", textTransform: "uppercase", marginBottom: "10px" }}>Filter</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={LS}>Platform</label>
                  <select value={historyFilter.platform} onChange={e => setHistoryFilter({ ...historyFilter, platform: e.target.value })} style={{ ...IS, cursor: "pointer" }}>
                    <option value="All">All</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LS}>From date</label>
                  <input type="date" value={historyFilter.dateFrom} onChange={e => setHistoryFilter({ ...historyFilter, dateFrom: e.target.value })} style={{ ...IS, colorScheme: "dark" }} />
                </div>
                <div>
                  <label style={LS}>To date</label>
                  <input type="date" value={historyFilter.dateTo} onChange={e => setHistoryFilter({ ...historyFilter, dateTo: e.target.value })} style={{ ...IS, colorScheme: "dark" }} />
                </div>
              </div>
              {(historyFilter.platform !== "All" || historyFilter.dateFrom || historyFilter.dateTo) && (
                <button onClick={() => setHistoryFilter({ platform: "All", dateFrom: "", dateTo: "" })} style={{ marginTop: "8px", background: "none", border: "1px solid #2a2820", color: "#4a4030", borderRadius: "4px", padding: "4px 10px", fontSize: "10px", cursor: "pointer", fontFamily: "inherit" }}>
                  Clear filters
                </button>
              )}
            </div>

            {/* Rate change callout if rates vary across logged trips */}
            {(() => {
              const rateChanges = trips.filter(t => t.rateSnapshot && Math.abs((t.rateSnapshot[activeCurrency] || 0) - rate) > 0.001);
              if (rateChanges.length === 0) return null;
              return (
                <div style={{ background: "#1a1008", border: "1px solid #4a3010", borderRadius: "8px", padding: "10px 12px", marginBottom: "12px", fontSize: "11px", color: "#8a6030", lineHeight: 1.6 }}>
                  ⚡ {rateChanges.length} trip{rateChanges.length !== 1 ? "s" : ""} logged at a different {currency.code} rate. Totals below show the rate at time of logging.
                </div>
              );
            })()}

            {filteredTrips.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#2a2418", fontSize: "13px" }}>
                {trips.length === 0 ? "No trips logged yet." : "No trips match the current filter."}
              </div>
            ) : (
              <div>
                {/* Summary row */}
                <div style={{ marginBottom: "12px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {[
                    ["Showing", `${filteredTrips.length} trips`],
                    ["Total spent", fmtTL(filteredTrips.reduce((s, t) => s + num(t.resolvedTotal), 0))],
                    ["In " + currency.code, fmt(filteredTrips.reduce((s, t) => s + num(t.resolvedTotal), 0) * rate, currency.symbol)],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: "#161613", border: "1px solid #2a2820", borderRadius: "6px", padding: "8px 12px" }}>
                      <div style={{ fontSize: "9px", color: "#3a3020", letterSpacing: "2px", textTransform: "uppercase" }}>{l}</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#e8b84b" }}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {filteredTrips.map(t => {
                    const snapshotRate = t.rateSnapshot?.[activeCurrency] ?? rate;
                    const rateChanged = Math.abs(snapshotRate - rate) > 0.001;
                    return (
                      <div key={t.id} style={{ background: "#161613", border: "1px solid #2a2820", borderRadius: "8px", padding: "12px 13px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px", flexWrap: "wrap" }}>
                              <PlatformPill platform={t.platform} />
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#f0ece0" }}>{t.from || "—"} → {t.to || "—"}</span>
                            </div>
                            <div style={{ fontSize: "11px", color: "#4a4030", display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
                              <span style={{ color: "#3a5030" }}>📅 {t.date || "no date"}</span>
                              {t.distanceKm && <span>{t.distanceKm} km</span>}
                              {t.durationMin && <span>{t.durationMin} min</span>}
                            </div>
                            <div style={{ fontSize: "11px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                              <span style={{ color: "#e8b84b", fontWeight: 700 }}>{fmtTL(t.resolvedTotal)}</span>
                              <span style={{ color: "#8ab884" }}>{fmt(num(t.resolvedTotal) * snapshotRate, currency.symbol)} {currency.code}</span>
                              {rateChanged && <span style={{ color: "#6a5020", fontSize: "10px" }}>@ {snapshotRate.toFixed(4)}</span>}
                              {t.inputMode === "breakdown" && num(t.bookingFee) > 0 && <span style={{ color: "#3a4030" }}>booking: {fmtTL(t.bookingFee)}</span>}
                              {num(t.tip) > 0 && <span style={{ color: "#3a4030" }}>tip: {fmtTL(t.tip)}</span>}
                            </div>
                            {t.notes && <div style={{ marginTop: "4px", fontSize: "10px", color: "#3a3020" }}>{t.notes}</div>}
                          </div>
                          <button onClick={() => removeTrip(t.id)} style={{ background: "none", border: "none", color: "#2a2020", cursor: "pointer", fontSize: "18px", padding: "0 0 0 10px" }}>×</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ STATS ══ */}
        {tab === "stats" && (
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#7a7060", textTransform: "uppercase", marginBottom: "14px" }}>My rate profile</div>
            {!stats ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#2a2418", fontSize: "13px" }}>Log at least one trip to see stats.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Total trips", value: stats.totalTrips, sub: "across all platforms" },
                  { label: "Total km logged", value: `${stats.allKm.toFixed(1)} km`, sub: "where distance provided" },
                  { label: "Avg fare (TRY)", value: fmtTL(stats.avgFare), sub: fmt(stats.avgFare * rate, currency.symbol) + " " + currency.code + " per trip" },
                  { label: "Effective rate/km", value: fmtTL(stats.effectiveRatePerKm), sub: `vs official ${fmtTL(OFFICIAL_RATE_PER_KM)}/km` },
                ].map(item => (
                  <div key={item.label} style={{ background: "#161613", border: "1px solid #2a2820", borderRadius: "8px", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#4a4030", textTransform: "uppercase" }}>{item.label}</div>
                      <div style={{ fontSize: "10px", color: "#2a2418", marginTop: "2px" }}>{item.sub}</div>
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#e8b84b" }}>{item.value}</div>
                  </div>
                ))}

                {/* All currency equivalents for avg fare */}
                <div style={{ background: "#0d0d0d", border: "1px solid #2a2820", borderRadius: "8px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#4a4030", textTransform: "uppercase", marginBottom: "10px" }}>Avg fare in all currencies</div>
                  {CURRENCIES.map(c => (
                    <div key={c.code} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                      <span style={{ color: activeCurrency === c.code ? "#7a7060" : "#3a3020" }}>{c.symbol} {c.code}</span>
                      <span style={{ color: activeCurrency === c.code ? "#8ab884" : "#4a4030", fontWeight: activeCurrency === c.code ? 700 : 400 }}>
                        {fmt(stats.avgFare * rates[c.code], c.symbol)}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ background: "#0d0d0d", border: "1px dashed #2a2820", borderRadius: "8px", padding: "12px 14px", fontSize: "11px", color: "#3a3020", lineHeight: 1.7 }}>
                  {stats.effectiveRatePerKm > OFFICIAL_RATE_PER_KM
                    ? `Your rate is ${fmtTL(stats.effectiveRatePerKm - OFFICIAL_RATE_PER_KM)}/km above official — booking fees, tips, or tolls are pushing it up.`
                    : `Your rate is ${fmtTL(OFFICIAL_RATE_PER_KM - stats.effectiveRatePerKm)}/km below official — shorter trips lower the per-km average.`
                  } The Estimate tab uses this calibrated rate.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 16px", textAlign: "center", fontSize: "9px", color: "#2a2418", letterSpacing: "1px" }}>
        2026 OFFICIAL TARIFF · ₺54 FLAG FALL · ₺36/KM · NO NIGHT RATE · TOLLS EXTRA
      </div>
    </div>
  );
}
