import { useState, useMemo } from "react";

// ─────────────────────────────────────────────
//  Constants & helpers
// ─────────────────────────────────────────────
const BANKS = [
  { name: "RBC",        rate: 6.99, color: "#003A70", accent: "#005DAA" },
  { name: "TD",         rate: 7.29, color: "#54B848", accent: "#008000" },
  { name: "Scotiabank", rate: 6.99, color: "#C8102E", accent: "#FF2A3B" },
  { name: "BMO",        rate: 7.49, color: "#0079C1", accent: "#005A8E" },
  { name: "CIBC",       rate: 7.20, color: "#C41F3A", accent: "#A3001B" },
];
const DEFAULT_CAR_PRICE    = 22200;
const DEFAULT_DOWN_PAYMENT = 8200;
const DEFAULT_LOAN         = DEFAULT_CAR_PRICE - DEFAULT_DOWN_PAYMENT;

function fmt(n, dec = 2) {
  return "$" + Math.abs(+n || 0).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function fmtN(n) { return (+(n || 0)).toFixed(2); }

// ─────────────────────────────────────────────
//  Amortisation calculators
// ─────────────────────────────────────────────
function calcMonthly(principal, annualRate, months, extra = 0) {
  const r = annualRate / 100 / 12;
  const base = r === 0 ? principal / months
    : (principal * r * Math.pow(1+r, months)) / (Math.pow(1+r, months) - 1);
  let bal = principal, rows = [], ti = 0;
  for (let i = 1; bal > 0.005 && i <= months * 3; i++) {
    const interest = bal * r;
    const toP = Math.min(base - interest + extra, bal);
    bal -= toP; ti += interest;
    rows.push({ period: i, payment: interest + toP, principal: toP, interest, balance: Math.max(0, bal), extra });
    if (bal <= 0.005) break;
  }
  return { basePayment: base, rows, totalInterest: ti, periods: rows.length };
}

function calcBiweekly(principal, annualRate, months, extra = 0) {
  const r = annualRate / 100 / 26;
  const n = months * 26 / 12;
  const base = r === 0 ? principal / n
    : (principal * r * Math.pow(1+r, n)) / (Math.pow(1+r, n) - 1);
  let bal = principal, rows = [], ti = 0, p = 1;
  while (bal > 0.005 && p <= n * 3) {
    const interest = bal * r;
    const toP = Math.min(base - interest + extra, bal);
    bal -= toP; ti += interest;
    rows.push({ period: p, payment: interest + toP, principal: toP, interest, balance: Math.max(0, bal), extra });
    if (bal <= 0.005) break;
    p++;
  }
  return { basePayment: base, rows, totalInterest: ti, periods: rows.length };
}

// ─────────────────────────────────────────────
//  Shared UI components
// ─────────────────────────────────────────────
function ProgressRing({ percent, color, size = 90 }) {
  const r = (size - 10) / 2, circ = 2 * Math.PI * r;
  const dash = circ * (Math.min(100, percent) / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)" }}/>
    </svg>
  );
}

function StatBox({ label, value, highlight, sub }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px 13px", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ fontSize: 10, color: "#7a8499", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: highlight || "#e8eaf0" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#7a8499", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Pie chart (SVG, no deps)
// ─────────────────────────────────────────────
function PieChart({ slices, size = 200 }) {
  const [hovered, setHovered] = useState(null);
  const cx = size / 2, cy = size / 2, r = size / 2 - 18, ri = r * 0.55;
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total <= 0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={r - ri}/>
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#7a8499" fontSize={12}>No data</text>
    </svg>
  );
  let angle = -Math.PI / 2;
  const paths = slices.map((sl, idx) => {
    const sweep = (sl.value / total) * 2 * Math.PI;
    const midA  = angle + sweep / 2;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    // arc path for donut
    const d = [
      `M ${cx + ri * Math.cos(angle - sweep)} ${cy + ri * Math.sin(angle - sweep)}`,
      `L ${x1} ${y1}`,
      `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      `L ${cx + ri * Math.cos(angle)} ${cy + ri * Math.sin(angle)}`,
      `A ${ri} ${ri} 0 ${large} 0 ${cx + ri * Math.cos(angle - sweep)} ${cy + ri * Math.sin(angle - sweep)}`,
      "Z"
    ].join(" ");
    return { d, color: sl.color, label: sl.label, value: sl.value, pct: ((sl.value / total) * 100).toFixed(1), midA, idx };
  });
  const hov = hovered !== null ? paths[hovered] : null;
  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      {paths.map((p, i) => (
        <path key={i} d={p.d}
          fill={p.color}
          stroke="#111827" strokeWidth={2}
          opacity={hovered === null || hovered === i ? 1 : 0.45}
          style={{ cursor: "pointer", transition: "opacity 0.15s" }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          transform={hovered === i ? `translate(${Math.cos(p.midA) * 4} ${Math.sin(p.midA) * 4})` : ""}
        />
      ))}
      {/* Centre label */}
      {hov ? (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" fill="#fff" fontSize={13} fontWeight="800">{hov.pct}%</text>
          <text x={cx} y={cy + 8} textAnchor="middle" fill="#7a8499" fontSize={10}>{hov.label}</text>
        </>
      ) : (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" fill="#fff" fontSize={15} fontWeight="900">
            {((slices.find(s => s.label === "Remaining")?.value ?? 0) / total * 100).toFixed(0)}%
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle" fill="#7a8499" fontSize={10}>remaining</text>
        </>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────
//  MY TRACKER component
// ─────────────────────────────────────────────
function MyTracker({
  trackerRate, setTrackerRate, trackerRateIn, setTrackerRateIn,
  trackerLoan, setTrackerLoan, trackerLoanIn, setTrackerLoanIn,
  trackerTerm, setTrackerTerm, trackerTermIn, setTrackerTermIn,
  payments, setPayments,
  payFreq, setPayFreq,
  monthLabel, setMonthLabel,
  biweeklyDate, setBiweeklyDate,
}) {
  const [payInput,    setPayInput]    = useState("");
  const [noteInput,   setNoteInput]   = useState("");
  const [editIdx,     setEditIdx]     = useState(null);
  const [editAmt,     setEditAmt]     = useState("");
  const [trackerView, setTrackerView] = useState("summary");

  const isBiweekly = payFreq === "biweekly";

  // Scheduled amounts for each mode
  const monthlySchedule   = useMemo(() => calcMonthly(trackerLoan, trackerRate, trackerTerm, 0),   [trackerLoan, trackerRate, trackerTerm]);
  const biweeklySchedule  = useMemo(() => calcBiweekly(trackerLoan, trackerRate, trackerTerm, 0),  [trackerLoan, trackerRate, trackerTerm]);
  const schedule = isBiweekly ? biweeklySchedule : monthlySchedule;

  // Interest rate per period depends on frequency
  const periodRate = isBiweekly ? trackerRate / 100 / 26 : trackerRate / 100 / 12;

  const enrichedPayments = useMemo(() => {
    const r = trackerRate / 100 / (isBiweekly ? 26 : 12);
    let balance = trackerLoan;
    return payments.map(p => {
      const interest    = balance * r;
      const toPrincipal = Math.max(0, Math.min(p.amount - interest, balance));
      const intPaid     = Math.min(p.amount, interest);
      balance = Math.max(0, balance - toPrincipal);
      return { ...p, interest: intPaid, principal: toPrincipal, balanceAfter: balance };
    });
  }, [payments, trackerLoan, trackerRate, isBiweekly]);

  const totalPaid      = payments.reduce((s, p) => s + p.amount, 0);
  const totalInterest  = enrichedPayments.reduce((s, p) => s + p.interest,   0);
  const totalPrincipal = enrichedPayments.reduce((s, p) => s + p.principal,  0);
  const remaining      = Math.max(0, trackerLoan - totalPrincipal);
  const paidPct        = Math.min(100, (totalPrincipal / trackerLoan) * 100);
  const periodsLeft    = remaining > 0 ? Math.ceil(remaining / schedule.basePayment) : 0;

  const pieSlices = [
    { label: "Principal Paid", value: totalPrincipal, color: "#6ee7b7" },
    { label: "Interest Paid",  value: totalInterest,  color: "#f87171" },
    { label: "Remaining",      value: remaining,      color: "#1f2937" },
  ].filter(s => s.value > 0.01);

  function commitRate(raw)  { const v = parseFloat(raw); if (!isNaN(v) && v > 0)  { setTrackerRate(v); setTrackerRateIn(String(v)); } else { setTrackerRateIn(String(trackerRate)); } }
  function commitLoan(raw)  { const v = parseFloat(raw); if (!isNaN(v) && v > 0)  { setTrackerLoan(v); setTrackerLoanIn(String(v)); } else { setTrackerLoanIn(String(trackerLoan)); } }
  function commitTerm(raw)  { const v = parseInt(raw);   if (!isNaN(v) && v >= 1) { setTrackerTerm(v); setTrackerTermIn(String(v)); } else { setTrackerTermIn(String(trackerTerm)); } }

  // Advance biweekly date by 14 days
  function advanceBiweeklyDate(from) {
    const d = new Date(from + "T00:00:00");
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  }

  function formatBiweeklyLabel(dateStr) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  }

  function addPayment() {
    const amt = parseFloat(payInput);
    if (isNaN(amt) || amt <= 0) return;

    let label, freq;
    if (isBiweekly) {
      label = `Biweekly · ${formatBiweeklyLabel(biweeklyDate)}`;
      freq  = "biweekly";
      setBiweeklyDate(advanceBiweeklyDate(biweeklyDate));
    } else {
      label = monthLabel
        ? new Date(monthLabel + "-01").toLocaleDateString("en-CA", { month: "long", year: "numeric" })
        : `Payment ${payments.length + 1}`;
      freq = "monthly";
      const [yr, mo] = monthLabel.split("-").map(Number);
      const next = new Date(yr, mo, 1);
      setMonthLabel(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2,"0")}`);
    }

    setPayments(prev => [...prev, { id: Date.now(), label, amount: amt, note: noteInput, freq }]);
    setPayInput("");
    setNoteInput("");
  }

  function deletePayment(id) { setPayments(prev => prev.filter(p => p.id !== id)); }
  function saveEdit(id) {
    const amt = parseFloat(editAmt);
    if (!isNaN(amt) && amt > 0) setPayments(prev => prev.map(p => p.id === id ? { ...p, amount: amt } : p));
    setEditIdx(null); setEditAmt("");
  }

  // Last balance for preview
  const lastBalance = enrichedPayments.length > 0
    ? enrichedPayments[enrichedPayments.length - 1].balanceAfter
    : trackerLoan;

  // Live preview
  const previewAmt  = parseFloat(payInput) || 0;
  const previewInt  = previewAmt > 0 ? lastBalance * periodRate : 0;
  const previewPrin = previewAmt > 0 ? Math.max(0, Math.min(previewAmt - previewInt, lastBalance)) : 0;
  const previewIntA = previewAmt > 0 ? Math.min(previewAmt, previewInt) : 0;
  const showPreview = previewAmt > 0;

  return (
    <div style={{ paddingTop: 16 }}>
      {/* Loan config */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "16px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>Your Loan Details</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Loan ($)",  strVal: trackerLoanIn, setStr: setTrackerLoanIn, commit: commitLoan, prefix: "$", step: "100" },
            { label: "Rate (%)",  strVal: trackerRateIn, setStr: setTrackerRateIn, commit: commitRate, suffix: "%", step: "0.01" },
            { label: "Term (mo)", strVal: trackerTermIn, setStr: setTrackerTermIn, commit: commitTerm, step: "1" },
          ].map(({ label, strVal, setStr, commit, prefix, suffix, step }) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 10, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                {prefix && <span style={{ color: "#7a8499", fontSize: 13, fontWeight: 700 }}>{prefix}</span>}
                <input type="number" step={step} value={strVal}
                  onChange={e => setStr(e.target.value)}
                  onBlur={e => commit(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && commit(e.target.value)}
                  style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 16, fontWeight: 800, color: "#e8eaf0", padding: 0, minWidth: 0 }}/>
                {suffix && <span style={{ color: "#7a8499", fontSize: 13, fontWeight: 700 }}>{suffix}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Scheduled amounts for both modes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "8px 12px" }}>
            <div style={{ fontSize: 10, color: "#7a8499", marginBottom: 2 }}>📅 Monthly payment</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#e8eaf0" }}>{fmt(monthlySchedule.basePayment)}</div>
            <div style={{ fontSize: 10, color: "#7a8499", marginTop: 1 }}>Interest: {fmt(monthlySchedule.totalInterest)}</div>
          </div>
          <div style={{ background: "rgba(16,185,129,0.06)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(16,185,129,0.15)" }}>
            <div style={{ fontSize: 10, color: "#6ee7b7", marginBottom: 2 }}>⚡ Biweekly payment</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#6ee7b7" }}>{fmt(biweeklySchedule.basePayment)}</div>
            <div style={{ fontSize: 10, color: "#7a8499", marginTop: 1 }}>Interest: {fmt(biweeklySchedule.totalInterest)} · saves {fmt(monthlySchedule.totalInterest - biweeklySchedule.totalInterest)}</div>
          </div>
        </div>
      </div>

      {/* Pie + summary */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "18px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 16 }}>Repayment Progress</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flexShrink: 0 }}><PieChart slices={pieSlices} size={180}/></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {[
              { label: "Total Paid",  val: fmt(totalPaid),      color: "#fff",    dot: "#e8eaf0" },
              { label: "→ Principal", val: fmt(totalPrincipal), color: "#6ee7b7", dot: "#6ee7b7" },
              { label: "→ Interest",  val: fmt(totalInterest),  color: "#f87171", dot: "#f87171" },
              { label: "Remaining",   val: fmt(remaining),      color: "#facc15", dot: "#1f2937" },
            ].map(({ label, val, color, dot }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: dot, border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0 }}/>
                <div style={{ flex: 1, fontSize: 12, color: "#7a8499" }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
            {remaining > 0 && payments.length > 0 && (
              <div style={{ marginTop: 4, background: "rgba(250,204,21,0.08)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#facc15", fontWeight: 600 }}>
                ~{periodsLeft} {isBiweekly ? "biweekly periods" : `month${periodsLeft !== 1 ? "s" : ""}`} remaining
              </div>
            )}
            {remaining <= 0 && payments.length > 0 && (
              <div style={{ marginTop: 4, background: "rgba(16,185,129,0.1)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#6ee7b7", fontWeight: 700 }}>🎉 Loan fully paid off!</div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#7a8499", marginBottom: 6 }}>
            <span>{paidPct.toFixed(1)}% of principal paid</span>
            <span style={{ color: "#6ee7b7", fontWeight: 700 }}>{fmt(totalPrincipal)} / {fmt(trackerLoan)}</span>
          </div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.07)", borderRadius: 5, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100,(totalPaid/trackerLoan)*100)}%`, background: "rgba(248,113,113,0.35)", borderRadius: 5, transition: "width 0.5s" }}/>
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${paidPct}%`, background: "linear-gradient(90deg,#6ee7b7,#34d399)", borderRadius: 5, transition: "width 0.5s" }}/>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#7a8499", marginTop: 4 }}><span>$0</span><span>{fmt(trackerLoan)}</span></div>
        </div>
      </div>

      {/* Log a payment */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "16px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 14 }}>+ Log a Payment</div>

        {/* Frequency toggle */}
        <div style={{ display: "flex", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 16 }}>
          {[
            { key: "monthly",  icon: "📅", label: "Monthly",  sub: fmt(monthlySchedule.basePayment) + "/mo" },
            { key: "biweekly", icon: "⚡", label: "Biweekly", sub: fmt(biweeklySchedule.basePayment) + "/2wk" },
          ].map(({ key, icon, label, sub }) => (
            <button key={key} onClick={() => setPayFreq(key)} style={{
              flex: 1, padding: "12px 10px", border: "none", cursor: "pointer", transition: "all 0.2s",
              background: payFreq === key
                ? key === "biweekly"
                  ? "linear-gradient(135deg,rgba(16,185,129,0.5),rgba(5,150,105,0.4))"
                  : "linear-gradient(135deg,rgba(99,102,241,0.5),rgba(79,70,229,0.4))"
                : "rgba(255,255,255,0.03)",
              color: payFreq === key ? "#fff" : "#7a8499",
            }}>
              <div style={{ fontSize: 16 }}>{icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 3 }}>{label}</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1, fontWeight: 600 }}>{sub}</div>
            </button>
          ))}
        </div>

        {/* Live preview */}
        {showPreview && (
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, border: "1px solid rgba(255,255,255,0.09)" }}>
            <div style={{ fontSize: 10, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Payment Preview · {isBiweekly ? "biweekly rate" : "monthly rate"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: "rgba(110,231,183,0.1)", borderRadius: 9, padding: "8px 10px", border: "1px solid rgba(110,231,183,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#6ee7b7", marginBottom: 3 }}>→ PRINCIPAL</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#6ee7b7" }}>{fmt(previewPrin)}</div>
              </div>
              <div style={{ flex: 1, background: "rgba(248,113,113,0.1)", borderRadius: 9, padding: "8px 10px", border: "1px solid rgba(248,113,113,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#f87171", marginBottom: 3 }}>→ INTEREST</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#f87171" }}>{fmt(previewIntA)}</div>
              </div>
              <div style={{ flex: 1, background: "rgba(250,204,21,0.08)", borderRadius: 9, padding: "8px 10px", border: "1px solid rgba(250,204,21,0.15)", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#facc15", marginBottom: 3 }}>BALANCE AFTER</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#facc15" }}>{fmt(Math.max(0, lastBalance - previewPrin))}</div>
              </div>
            </div>
          </div>
        )}

        {/* Date/month picker */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: "#7a8499", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {isBiweekly ? "Payment Date" : "Month"}
            </div>
            {isBiweekly ? (
              <input type="date" value={biweeklyDate} onChange={e => setBiweeklyDate(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, padding: "10px 12px", color: "#e8eaf0", fontSize: 13, outline: "none", cursor: "pointer" }}/>
            ) : (
              <input type="month" value={monthLabel} onChange={e => setMonthLabel(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", color: "#e8eaf0", fontSize: 13, outline: "none", cursor: "pointer" }}/>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#7a8499", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Amount Paid</div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#7a8499", fontSize: 15, fontWeight: 800 }}>$</span>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={payInput}
                onChange={e => setPayInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addPayment()}
                style={{ width: "100%", boxSizing: "border-box", paddingLeft: 28, paddingRight: 10, paddingTop: 10, paddingBottom: 10, borderRadius: 10, fontSize: 16, fontWeight: 800, background: "rgba(255,255,255,0.07)", border: `1px solid ${isBiweekly ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.12)"}`, color: "#e8eaf0", outline: "none" }}/>
            </div>
          </div>
        </div>

        {/* Quick fill */}
        <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#7a8499", alignSelf: "center", whiteSpace: "nowrap" }}>Quick:</div>
          {[
            { label: "Scheduled", val: schedule.basePayment },
            { label: "+10%",      val: schedule.basePayment * 1.10 },
            { label: "+25%",      val: schedule.basePayment * 1.25 },
          ].map(({ label, val }) => (
            <button key={label} onClick={() => setPayInput(val.toFixed(2))}
              style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9aa3b2", fontSize: 10, fontWeight: 600, cursor: "pointer", lineHeight: 1.4 }}>
              {label}<br/>
              <span style={{ color: "#e8eaf0", fontWeight: 800, fontSize: 11 }}>{fmt(val)}</span>
            </button>
          ))}
        </div>

        {/* Note */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#7a8499", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Note (optional)</div>
          <input type="text" placeholder="e.g. extra payment, bonus..." value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addPayment()}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, fontSize: 13, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaf0", outline: "none" }}/>
        </div>

        <button onClick={addPayment} style={{
          width: "100%", padding: "13px", borderRadius: 11, border: "none",
          background: isBiweekly
            ? "linear-gradient(135deg,#10b981,#059669)"
            : "linear-gradient(135deg,#6366f1,#4f46e5)",
          color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
        }}>
          Add {isBiweekly ? "Biweekly" : "Monthly"} Payment
        </button>
      </div>

      {/* Payment history */}
      {payments.length > 0 ? (
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.09em" }}>
              Payment History · {payments.length} payment{payments.length !== 1 ? "s" : ""}
            </div>
            {payments.length >= 2 && (
              <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                {["summary","history"].map(v => (
                  <button key={v} onClick={() => setTrackerView(v)} style={{ padding: "5px 11px", background: trackerView === v ? "rgba(255,255,255,0.12)" : "none", border: "none", color: trackerView === v ? "#fff" : "#7a8499", fontSize: 11, fontWeight: trackerView === v ? 700 : 500, cursor: "pointer", textTransform: "capitalize" }}>{v}</button>
                ))}
              </div>
            )}
          </div>

          {trackerView === "summary" && (
            <div>
              {enrichedPayments.slice().reverse().slice(0, 6).map((p, i) => (
                <div key={p.id} style={{ padding: "12px 14px", background: i === 0 ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.03)", borderRadius: 12, marginBottom: 8, border: `1px solid ${i === 0 ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0" }}>{p.label}</div>
                        {p.freq === "biweekly" && (
                          <span style={{ fontSize: 9, background: "rgba(16,185,129,0.2)", color: "#6ee7b7", padding: "1px 6px", borderRadius: 8, fontWeight: 800, border: "1px solid rgba(16,185,129,0.3)" }}>⚡ BIWEEKLY</span>
                        )}
                      </div>
                      {p.note && <div style={{ fontSize: 11, color: "#7a8499", marginTop: 2 }}>{p.note}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: i === 0 ? "#6ee7b7" : "#e8eaf0" }}>{fmt(p.amount)}</div>
                      <button onClick={() => deletePayment(p.id)} style={{ padding: "4px 8px", borderRadius: 7, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 11, cursor: "pointer" }}>✕</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    <div style={{ background: "rgba(110,231,183,0.08)", borderRadius: 8, padding: "6px 8px", border: "1px solid rgba(110,231,183,0.15)" }}>
                      <div style={{ fontSize: 9, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Principal</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#6ee7b7" }}>{fmt(p.principal)}</div>
                    </div>
                    <div style={{ background: "rgba(248,113,113,0.08)", borderRadius: 8, padding: "6px 8px", border: "1px solid rgba(248,113,113,0.15)" }}>
                      <div style={{ fontSize: 9, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Interest</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#f87171" }}>{fmt(p.interest)}</div>
                    </div>
                    <div style={{ background: "rgba(250,204,21,0.07)", borderRadius: 8, padding: "6px 8px", border: "1px solid rgba(250,204,21,0.12)" }}>
                      <div style={{ fontSize: 9, color: "#facc15", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Balance</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#facc15" }}>{fmt(p.balanceAfter)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {payments.length > 6 && (
                <button onClick={() => setTrackerView("history")} style={{ width: "100%", padding: "9px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#7a8499", fontSize: 12, cursor: "pointer" }}>
                  View all {payments.length} payments →
                </button>
              )}
            </div>
          )}

          {trackerView === "history" && (
            <div style={{ maxHeight: 380, overflowY: "auto", borderRadius: 10, background: "rgba(0,0,0,0.2)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, background: "#111827" }}>
                    {["Month","Paid","Principal","Interest","Balance",""].map(h => (
                      <th key={h} style={{ padding: "9px 8px", textAlign: "right", color: "#7a8499", fontWeight: 700, fontSize: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enrichedPayments.map((p, i) => {
                    const isEditing = editIdx === p.id;
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                        <td style={{ padding: "8px", textAlign: "right", color: "#e8eaf0" }}>
                          <div style={{ fontWeight: 600 }}>{p.label}</div>
                          {p.freq === "biweekly" && <div style={{ fontSize: 9, color: "#6ee7b7", marginTop: 1 }}>⚡ biweekly</div>}
                          {p.note && <div style={{ fontSize: 10, color: "#7a8499" }}>{p.note}</div>}
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          {isEditing ? (
                            <input type="number" min="0" step="0.01" value={editAmt}
                              onChange={e => setEditAmt(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveEdit(p.id); if (e.key === "Escape") setEditIdx(null); }}
                              autoFocus
                              style={{ width: 72, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, padding: "3px 6px", color: "#e8eaf0", fontSize: 12, outline: "none", textAlign: "right" }}/>
                          ) : (
                            <span style={{ fontWeight: 700, color: "#e8eaf0", cursor: "pointer" }} onClick={() => { setEditIdx(p.id); setEditAmt(fmtN(p.amount)); }}>{fmt(p.amount)}</span>
                          )}
                        </td>
                        <td style={{ padding: "8px", textAlign: "right", color: "#6ee7b7", fontWeight: 600 }}>{fmt(p.principal)}</td>
                        <td style={{ padding: "8px", textAlign: "right", color: "#f87171", fontWeight: 600 }}>{fmt(p.interest)}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: p.balanceAfter === 0 ? "#6ee7b7" : "#facc15" }}>{fmt(p.balanceAfter)}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            {isEditing ? (
                              <>
                                <button onClick={() => saveEdit(p.id)} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: "#10b981", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700 }}>✓</button>
                                <button onClick={() => setEditIdx(null)} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: "rgba(255,255,255,0.08)", border: "none", color: "#7a8499", cursor: "pointer" }}>✕</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => { setEditIdx(p.id); setEditAmt(fmtN(p.amount)); }} style={{ fontSize: 11, padding: "3px 7px", borderRadius: 5, background: "rgba(255,255,255,0.07)", border: "none", color: "#9aa3b2", cursor: "pointer" }}>✏️</button>
                                <button onClick={() => deletePayment(p.id)} style={{ fontSize: 11, padding: "3px 7px", borderRadius: 5, background: "rgba(239,68,68,0.1)", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "rgba(16,185,129,0.08)", borderTop: "2px solid rgba(16,185,129,0.2)" }}>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 800, color: "#6ee7b7", fontSize: 12 }}>Total</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 800, color: "#e8eaf0" }}>{fmt(totalPaid)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 800, color: "#6ee7b7" }}>{fmt(totalPrincipal)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 800, color: "#f87171" }}>{fmt(totalInterest)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 800, color: remaining === 0 ? "#6ee7b7" : "#facc15" }}>{fmt(remaining)}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <button onClick={() => { if (window.confirm("Clear all payments?")) setPayments([]); }} style={{ marginTop: 12, width: "100%", padding: "9px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Clear All Payments
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "32px 20px", color: "#7a8499", fontSize: 13, background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 6, color: "#9aa3b2" }}>No payments logged yet</div>
          <div style={{ fontSize: 12 }}>Add your first payment above to start tracking.</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  SIMULATOR (extracted for clarity)
// ─────────────────────────────────────────────
function Simulator() {
  const [selectedBank,    setSelectedBank]    = useState(0);
  const [term,            setTerm]            = useState(48);
  const [termInput,       setTermInput]       = useState("48");
  const [simTab,          setSimTab]          = useState("overview");
  const [payMode,         setPayMode]         = useState("monthly");
  const [recurringInput,  setRecurringInput]  = useState("");
  const [oneTimeInput,    setOneTimeInput]    = useState("");
  const [monthlyExtra,    setMonthlyExtra]    = useState(0);
  const [biweeklyExtra,   setBiweeklyExtra]   = useState(0);
  const [paidPeriods,     setPaidPeriods]     = useState(0);
  const [oneTimeLog,      setOneTimeLog]      = useState([]);
  const [downPayment,     setDownPayment]     = useState(DEFAULT_DOWN_PAYMENT);
  const [dpInput,         setDpInput]         = useState(String(DEFAULT_DOWN_PAYMENT));
  const [carPrice,        setCarPrice]        = useState(DEFAULT_CAR_PRICE);
  const [carPriceInput,   setCarPriceInput]   = useState(String(DEFAULT_CAR_PRICE));
  const [customRate,      setCustomRate]      = useState(null);  // null = use bank rate
  const [customRateInput, setCustomRateInput] = useState("");
  const [startDate,       setStartDate]       = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 2).padStart(2,"0")}`;
  });

  const loanAmount = Math.max(0, carPrice - downPayment);
  const bank       = BANKS[selectedBank];
  const lowestRate = Math.min(...BANKS.map(b => b.rate));
  const activeRate = customRate !== null ? customRate : bank.rate;  // custom overrides bank

  const monthlyBase  = useMemo(() => calcMonthly(loanAmount, activeRate, term, 0),            [loanAmount, activeRate, term]);
  const monthlyWith  = useMemo(() => calcMonthly(loanAmount, activeRate, term, monthlyExtra), [loanAmount, activeRate, term, monthlyExtra]);
  const biweeklyBase = useMemo(() => calcBiweekly(loanAmount, activeRate, term, 0),             [loanAmount, activeRate, term]);
  const biweeklyWith = useMemo(() => calcBiweekly(loanAmount, activeRate, term, biweeklyExtra),[loanAmount, activeRate, term, biweeklyExtra]);

  const activeMonthly  = monthlyExtra  > 0 ? monthlyWith  : monthlyBase;
  const activeBiweekly = biweeklyExtra > 0 ? biweeklyWith : biweeklyBase;
  const active         = payMode === "monthly" ? activeMonthly : activeBiweekly;
  const currentExtra   = payMode === "monthly" ? monthlyExtra : biweeklyExtra;
  const baseSchedule   = payMode === "monthly" ? monthlyBase  : biweeklyBase;
  const interestSaved  = baseSchedule.totalInterest - active.totalInterest;
  const periodsSaved   = baseSchedule.periods - active.periods;
  const isBiweekly     = payMode === "biweekly";
  const periodLabel    = isBiweekly ? "period" : "month";
  const freqLabel      = isBiweekly ? "Biweekly" : "Monthly";

  const pct              = Math.round((paidPeriods / Math.max(1, active.rows.length)) * 100);
  const interestPaid     = active.rows.slice(0, paidPeriods).reduce((s, r) => s + r.interest,  0);
  const principalPaid    = active.rows.slice(0, paidPeriods).reduce((s, r) => s + r.principal, 0);
  const balanceRemaining = paidPeriods > 0 ? active.rows[paidPeriods - 1]?.balance ?? 0 : loanAmount;

  function getPeriodDate(offset) {
    const [yr, mo] = startDate.split("-").map(Number);
    if (!isBiweekly) {
      return new Date(yr, mo - 1 + offset, 1).toLocaleDateString("en-CA", { month: "short", year: "numeric" });
    }
    const d = new Date(yr, mo - 1, 1); d.setDate(d.getDate() + offset * 14);
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  }

  function applyExtra() {
    const val = parseFloat(recurringInput);
    if (isNaN(val) || val < 0) return;
    payMode === "monthly" ? setMonthlyExtra(val) : setBiweeklyExtra(val);
    setPaidPeriods(0); setRecurringInput("");
  }
  function clearExtra() {
    payMode === "monthly" ? setMonthlyExtra(0) : setBiweeklyExtra(0);
    setPaidPeriods(0); setRecurringInput("");
  }
  function logOneTime() {
    const val = parseFloat(oneTimeInput);
    if (isNaN(val) || val <= 0) return;
    const today = new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
    setOneTimeLog(prev => [{ date: today, amount: val, mode: freqLabel }, ...prev].slice(0, 30));
    setOneTimeInput("");
  }

  return (
    <div>
      {/* Down Payment */}
      <div style={{ padding: "14px 0 0" }}>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: "16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 14 }}>Loan Breakdown</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 14px", border: `1px solid ${carPrice !== DEFAULT_CAR_PRICE ? "#a78bfa66" : "rgba(255,255,255,0.07)"}`, transition: "border-color 0.2s" }}>
              <div style={{ fontSize: 10, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Vehicle Price</div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", color: carPrice !== DEFAULT_CAR_PRICE ? "#a78bfa" : "#7a8499", fontSize: 15, fontWeight: 800 }}>$</span>
                <input
                  type="number" min="1" step="100"
                  value={carPriceInput}
                  onChange={e => setCarPriceInput(e.target.value)}
                  onBlur={() => {
                    const v = Math.max(1, parseFloat(carPriceInput) || DEFAULT_CAR_PRICE);
                    setCarPrice(v); setCarPriceInput(String(v));
                    if (downPayment > v) { setDownPayment(v); setDpInput(String(v)); }
                    setPaidPeriods(0);
                  }}
                  onKeyDown={e => { if (e.key === "Enter") {
                    const v = Math.max(1, parseFloat(carPriceInput) || DEFAULT_CAR_PRICE);
                    setCarPrice(v); setCarPriceInput(String(v));
                    if (downPayment > v) { setDownPayment(v); setDpInput(String(v)); }
                    setPaidPeriods(0); e.target.blur();
                  }}}
                  style={{ width: "100%", boxSizing: "border-box", paddingLeft: 14, paddingRight: 0, background: "none", border: "none", outline: "none", fontSize: 17, fontWeight: 900, color: carPrice !== DEFAULT_CAR_PRICE ? "#a78bfa" : "#e8eaf0", letterSpacing: "-0.5px" }}
                />
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 14px", border: `1px solid ${downPayment !== DEFAULT_DOWN_PAYMENT ? "#facc1566" : "rgba(255,255,255,0.12)"}`, transition: "border-color 0.2s" }}>
              <div style={{ fontSize: 10, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Down Payment</div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", color: downPayment !== DEFAULT_DOWN_PAYMENT ? "#facc15" : "#7a8499", fontSize: 15, fontWeight: 800 }}>$</span>
                <input type="number" min="0" max={carPrice} step="100" value={dpInput}
                  onChange={e => setDpInput(e.target.value)}
                  onBlur={() => { const v = Math.min(carPrice, Math.max(0, parseFloat(dpInput)||0)); setDownPayment(v); setDpInput(String(v)); setPaidPeriods(0); }}
                  onKeyDown={e => { if (e.key === "Enter") { const v = Math.min(carPrice, Math.max(0, parseFloat(dpInput)||0)); setDownPayment(v); setDpInput(String(v)); setPaidPeriods(0); e.target.blur(); }}}
                  style={{ width: "100%", boxSizing: "border-box", paddingLeft: 14, paddingRight: 0, paddingTop: 0, paddingBottom: 0, background: "none", border: "none", outline: "none", fontSize: 17, fontWeight: 900, color: downPayment !== DEFAULT_DOWN_PAYMENT ? "#facc15" : "#e8eaf0", letterSpacing: "-0.5px" }}/>
              </div>
            </div>
            <div style={{ background: loanAmount !== DEFAULT_LOAN ? "rgba(250,204,21,0.08)" : "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 14px", border: `1px solid ${loanAmount !== DEFAULT_LOAN ? "#facc1566" : "rgba(255,255,255,0.07)"}`, transition: "all 0.3s" }}>
              <div style={{ fontSize: 10, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Loan Amount</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: loanAmount !== DEFAULT_LOAN ? "#facc15" : "#e8eaf0", transition: "color 0.3s" }}>{fmt(loanAmount)}</div>
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 11, color: "#7a8499", marginBottom: 12 }}>
            {fmt(carPrice)} − <span style={{ color: downPayment !== DEFAULT_DOWN_PAYMENT ? "#facc15" : "#e8eaf0", fontWeight: 700 }}>{fmt(downPayment)}</span> = <span style={{ color: loanAmount !== DEFAULT_LOAN ? "#facc15" : "#e8eaf0", fontWeight: 700 }}>{fmt(loanAmount)}</span>
          </div>
          <input type="range" min="0" max={carPrice} step="100" value={downPayment}
            onChange={e => { const v = +e.target.value; setDownPayment(v); setDpInput(String(v)); setPaidPeriods(0); }}
            style={{ width: "100%", accentColor: bank.color, cursor: "pointer" }}/>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#7a8499", marginTop: 3 }}>
            <span>$0</span>
            <span style={{ color: "#facc15", fontWeight: 700 }}>{((downPayment / carPrice) * 100).toFixed(0)}% down</span>
            <span>{fmt(carPrice)}</span>
          </div>
        </div>
      </div>

      {/* Bank selector */}
      <div style={{ paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8499", letterSpacing: "0.09em", marginBottom: 10, textTransform: "uppercase" }}>Canada's Big 5 Banks</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {BANKS.map((b, i) => (
            <button key={b.name} onClick={() => { setSelectedBank(i); setCustomRate(null); setCustomRateInput(""); setPaidPeriods(0); }} style={{ padding: "8px 13px", borderRadius: 22, border: selectedBank === i && customRate === null ? `2px solid ${b.color}` : "2px solid rgba(255,255,255,0.09)", background: selectedBank === i && customRate === null ? `${b.color}28` : "rgba(255,255,255,0.04)", color: selectedBank === i && customRate === null ? "#fff" : "#7a8499", cursor: "pointer", fontSize: 13, fontWeight: selectedBank === i && customRate === null ? 700 : 500, transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }}/>
              {b.name} <span style={{ fontSize: 11, opacity: 0.75 }}>{b.rate}%</span>
              {b.rate === lowestRate && <span style={{ fontSize: 9, background: "#10b981", color: "#fff", padding: "1px 5px", borderRadius: 10, fontWeight: 800 }}>LOW</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Custom interest rate override */}
      <div style={{ paddingTop: 12 }}>
        <div style={{ background: customRate !== null ? "rgba(250,204,21,0.07)" : "rgba(255,255,255,0.04)", borderRadius: 14, border: `1px solid ${customRate !== null ? "#facc1555" : "rgba(255,255,255,0.08)"}`, padding: "13px 16px", transition: "all 0.25s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: customRate !== null ? 10 : 0 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: customRate !== null ? "#facc15" : "#7a8499", textTransform: "uppercase", letterSpacing: "0.09em" }}>
                🎛️ Custom Interest Rate
              </div>
              <div style={{ fontSize: 11, color: "#7a8499", marginTop: 2 }}>
                {customRate !== null
                  ? `Using ${customRate}% — overrides bank selection`
                  : `Currently using ${bank.name} rate: ${bank.rate}%`}
              </div>
            </div>
            {customRate !== null && (
              <button onClick={() => { setCustomRate(null); setCustomRateInput(""); setPaidPeriods(0); }}
                style={{ padding: "5px 12px", borderRadius: 8, background: "rgba(250,204,21,0.15)", border: "1px solid rgba(250,204,21,0.3)", color: "#facc15", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Reset
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input
                type="number" min="0.01" max="30" step="0.01"
                placeholder={`Enter rate (e.g. ${bank.rate})`}
                value={customRateInput}
                onChange={e => setCustomRateInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const v = parseFloat(customRateInput);
                    if (!isNaN(v) && v > 0) { setCustomRate(v); setPaidPeriods(0); }
                  }
                }}
                style={{ width: "100%", boxSizing: "border-box", paddingLeft: 12, paddingRight: 28, paddingTop: 9, paddingBottom: 9, borderRadius: 10, fontSize: 14, fontWeight: 700, background: "rgba(255,255,255,0.07)", border: `1px solid ${customRate !== null ? "#facc1555" : "rgba(255,255,255,0.12)"}`, color: "#e8eaf0", outline: "none" }}
              />
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#7a8499", fontSize: 13, fontWeight: 700 }}>%</span>
            </div>
            <button
              onClick={() => { const v = parseFloat(customRateInput); if (!isNaN(v) && v > 0) { setCustomRate(v); setPaidPeriods(0); } }}
              style={{ padding: "9px 16px", borderRadius: 10, background: customRate !== null ? "#facc15" : "rgba(255,255,255,0.08)", border: "none", color: customRate !== null ? "#111" : "#7a8499", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s" }}>
              Apply
            </button>
          </div>
          {customRate !== null && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {BANKS.map(b => {
                const diff = customRate - b.rate;
                return (
                  <div key={b.name} style={{ fontSize: 11, color: "#7a8499" }}>
                    vs {b.name}: <span style={{ fontWeight: 700, color: diff > 0 ? "#f87171" : diff < 0 ? "#6ee7b7" : "#9aa3b2" }}>
                      {diff > 0 ? "+" : ""}{diff.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Term selector — customizable */}
      <div style={{ paddingTop: 14 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", padding: "13px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.09em" }}>Loan Term</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number" min="1" max="120" step="1"
                value={termInput}
                onChange={e => setTermInput(e.target.value)}
                onBlur={() => {
                  const v = Math.min(120, Math.max(1, parseInt(termInput) || 1));
                  setTerm(v); setTermInput(String(v)); setPaidPeriods(0);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const v = Math.min(120, Math.max(1, parseInt(termInput) || 1));
                    setTerm(v); setTermInput(String(v)); setPaidPeriods(0); e.target.blur();
                  }
                }}
                style={{ width: 52, textAlign: "center", background: "rgba(255,255,255,0.08)", border: `1px solid ${![12,24,36,48,60].includes(term) ? bank.color : "rgba(255,255,255,0.15)"}`, borderRadius: 8, padding: "5px 6px", color: "#e8eaf0", fontSize: 15, fontWeight: 800, outline: "none" }}
              />
              <span style={{ fontSize: 12, color: "#7a8499", fontWeight: 600 }}>months</span>
              <span style={{ fontSize: 12, color: "#7a8499" }}>·</span>
              <span style={{ fontSize: 12, color: "#6ee7b7", fontWeight: 700 }}>{(term / 12).toFixed(1)} yr{term !== 12 ? "s" : ""}</span>
            </div>
          </div>

          {/* Preset quick-pick chips */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[12, 24, 36, 48, 60, 72, 84].map(t => (
              <button key={t} onClick={() => { setTerm(t); setTermInput(String(t)); setPaidPeriods(0); }} style={{
                flex: 1, padding: "7px 0", borderRadius: 9,
                border: term === t ? `2px solid ${bank.color}` : "2px solid rgba(255,255,255,0.08)",
                background: term === t ? `${bank.color}22` : "rgba(255,255,255,0.03)",
                color: term === t ? "#fff" : "#7a8499",
                cursor: "pointer", fontSize: 11, fontWeight: term === t ? 700 : 500, transition: "all 0.2s",
              }}>{t}mo</button>
            ))}
          </div>

          {/* Slider */}
          <input type="range" min="1" max="120" step="1" value={term}
            onChange={e => { const v = +e.target.value; setTerm(v); setTermInput(String(v)); setPaidPeriods(0); }}
            style={{ width: "100%", accentColor: bank.color, cursor: "pointer", marginBottom: 4 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#7a8499" }}>
            <span>1 mo</span>
            <span>120 mo (10 yr)</span>
          </div>
        </div>
      </div>

      {/* Repayment frequency + extra */}
      <div style={{ paddingTop: 14 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>Repayment Frequency</div>
          <div style={{ display: "flex", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 18 }}>
            {[{ key:"monthly", label:"Monthly", sub: fmt(activeMonthly.basePayment)+"/mo", icon:"📅" },
              { key:"biweekly", label:"Biweekly", sub: fmt(activeBiweekly.basePayment)+"/2wk", icon:"⚡" }].map(({ key, label, sub, icon }) => (
              <button key={key} onClick={() => { setPayMode(key); setPaidPeriods(0); }} style={{ flex: 1, padding: "13px 10px", border: "none", cursor: "pointer", transition: "all 0.2s", background: payMode === key ? `linear-gradient(135deg,${bank.color}cc,${bank.accent}99)` : "rgba(255,255,255,0.03)", color: payMode === key ? "#fff" : "#7a8499" }}>
                <div style={{ fontSize: 14 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>{label}</div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2, fontWeight: 600 }}>{sub}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Monthly payment",   val: fmt(activeMonthly.basePayment),    active: payMode==="monthly" },
              { label: "Biweekly payment",  val: fmt(activeBiweekly.basePayment),   active: payMode==="biweekly" },
              { label: "Monthly interest",  val: fmt(activeMonthly.totalInterest),  active: payMode==="monthly" },
              { label: "Biweekly interest", val: fmt(activeBiweekly.totalInterest), active: payMode==="biweekly" },
              { label: "Monthly payoff",    val: `${activeMonthly.periods} mo`,     active: payMode==="monthly" },
              { label: "Biweekly payoff",   val: `${activeBiweekly.periods} periods`, active: payMode==="biweekly" },
            ].map(({ label, val, active: isA }) => (
              <div key={label} style={{ background: isA ? `${bank.color}22` : "rgba(255,255,255,0.03)", borderRadius: 10, padding: "8px 12px", border: `1px solid ${isA ? bank.color+"55" : "rgba(255,255,255,0.06)"}`, transition: "all 0.3s" }}>
                <div style={{ fontSize: 10, color: "#7a8499", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isA ? "#fff" : "#9aa3b2" }}>{val}</div>
              </div>
            ))}
          </div>

          {(() => {
            const saved = monthlyBase.totalInterest - biweeklyBase.totalInterest;
            const moSaved = monthlyBase.periods - Math.ceil(biweeklyBase.periods * 14 / 30);
            if (saved <= 0) return null;
            return <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 10, padding: "10px 13px", border: "1px solid rgba(16,185,129,0.2)", marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#6ee7b7", fontWeight: 700 }}>💡 Switching to biweekly saves {fmt(saved)} and pays off ~{moSaved} months earlier.</div>
            </div>;
          })()}

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>⚡ Extra {freqLabel} Payment</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", marginBottom: currentExtra > 0 ? 14 : 0 }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: currentExtra > 0 ? "#6ee7b7" : "#7a8499", fontSize: 15, fontWeight: 800 }}>$</span>
                <input type="number" min="0" placeholder="0.00"
                  value={recurringInput !== "" ? recurringInput : (currentExtra > 0 ? String(currentExtra) : "")}
                  onChange={e => setRecurringInput(e.target.value)}
                  onFocus={() => setRecurringInput(currentExtra > 0 ? String(currentExtra) : "")}
                  onBlur={() => { if (recurringInput === "") return; applyExtra(); }}
                  onKeyDown={e => e.key === "Enter" && applyExtra()}
                  style={{ width: "100%", boxSizing: "border-box", paddingLeft: 28, paddingRight: 12, paddingTop: 11, paddingBottom: 11, borderRadius: 10, fontSize: 15, fontWeight: 700, background: currentExtra > 0 ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.07)", border: `1px solid ${currentExtra > 0 ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.12)"}`, color: currentExtra > 0 ? "#6ee7b7" : "#e8eaf0", outline: "none", transition: "all 0.2s" }}/>
              </div>
              <button onClick={applyExtra} style={{ padding: "11px 16px", borderRadius: 10, fontWeight: 700, fontSize: 13, background: "#10b981", border: "none", color: "#fff", cursor: "pointer" }}>{currentExtra > 0 ? "Update" : "Set"}</button>
              {currentExtra > 0 && <button onClick={clearExtra} style={{ padding: "11px 13px", borderRadius: 10, fontWeight: 700, fontSize: 13, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#7a8499", cursor: "pointer" }}>✕</button>}
            </div>

            {currentExtra > 0 && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {[
                    { label: `Extra/${periodLabel}`, val: fmt(currentExtra) },
                    { label: "Interest Saved", val: fmt(interestSaved) },
                    { label: `${isBiweekly?"Periods":"Months"} Saved`, val: String(periodsSaved > 0 ? periodsSaved : "<1") },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ background: "rgba(16,185,129,0.1)", borderRadius: 10, padding: "9px 11px", textAlign: "center", border: "1px solid rgba(16,185,129,0.2)" }}>
                      <div style={{ fontSize: 9, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#6ee7b7" }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#7a8499", marginBottom: 6 }}>
                    <span>Without extra: <b style={{ color: "#f87171" }}>{baseSchedule.periods} {isBiweekly?"periods":"months"}</b></span>
                    <span>With extra: <b style={{ color: "#6ee7b7" }}>{active.periods} {isBiweekly?"periods":"months"}</b></span>
                  </div>
                  <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(active.periods / baseSchedule.periods)*100}%`, background: "linear-gradient(90deg,#10b981,#34d399)", borderRadius: 3, transition: "width 0.5s" }}/>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Log a One-Time Extra Payment</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#7a8499", fontSize: 14, fontWeight: 800 }}>$</span>
                      <input type="number" min="0" placeholder="Enter amount" value={oneTimeInput}
                        onChange={e => setOneTimeInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && logOneTime()}
                        style={{ width: "100%", boxSizing: "border-box", paddingLeft: 28, paddingRight: 10, paddingTop: 10, paddingBottom: 10, borderRadius: 10, fontSize: 15, fontWeight: 700, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaf0", outline: "none" }}/>
                    </div>
                    <button onClick={logOneTime} style={{ padding: "10px 16px", borderRadius: 10, fontWeight: 700, fontSize: 13, background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)", color: "#6ee7b7", cursor: "pointer" }}>+ Log</button>
                  </div>
                  {oneTimeLog.length > 0 && (
                    <div style={{ marginTop: 10, maxHeight: 130, overflowY: "auto" }}>
                      {oneTimeLog.map((e, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "rgba(16,185,129,0.06)", borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                          <span style={{ color: "#7a8499" }}>{e.date}</span>
                          <span style={{ color: "#9aa3b2", fontSize: 10 }}>{e.mode}</span>
                          <span style={{ fontWeight: 700, color: "#6ee7b7" }}>+{fmt(e.amount)}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "rgba(16,185,129,0.12)", borderRadius: 8, fontSize: 12, marginTop: 2 }}>
                        <span style={{ fontWeight: 700, color: "#6ee7b7" }}>Total extra</span>
                        <span style={{ fontWeight: 800, color: "#6ee7b7" }}>{fmt(oneTimeLog.reduce((s,e)=>s+e.amount,0))}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main tabs */}
      <div style={{ marginTop: 16, background: "rgba(255,255,255,0.04)", borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {["overview","schedule","compare"].map(t => (
            <button key={t} onClick={() => setSimTab(t)} style={{ flex: 1, padding: "14px 0", background: "none", border: "none", borderBottom: simTab===t ? `2px solid ${bank.color}` : "2px solid transparent", color: simTab===t ? "#fff" : "#7a8499", fontWeight: simTab===t ? 700 : 500, fontSize: 13, cursor: "pointer", textTransform: "capitalize", transition: "all 0.2s" }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: "22px 20px" }}>

          {/* overview */}
          {simTab === "overview" && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <div style={{ fontSize: 11, color: "#7a8499", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{freqLabel} Payment · {bank.name} · {activeRate}% APR</div>
                <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-1.5px" }}>{fmt(active.basePayment)}</div>
                <div style={{ fontSize: 12, color: "#7a8499", marginTop: 3 }}>per {periodLabel}{isBiweekly?" (every 2 weeks · 26×/year)":" (12×/year)"}</div>
                {currentExtra > 0 && <div style={{ fontSize: 13, color: "#6ee7b7", marginTop: 6 }}>+ {fmt(currentExtra)}/{periodLabel} extra → pays off {periodsSaved} {isBiweekly?"periods":"months"} earlier</div>}
                <div style={{ fontSize: 13, color: "#f87171", marginTop: 4 }}>Total interest: {fmt(active.totalInterest)}{currentExtra > 0 && <span style={{ color: "#6ee7b7" }}> (saving {fmt(interestSaved)})</span>}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <ProgressRing percent={pct} color={currentExtra > 0 ? "#10b981" : bank.color} size={90}/>
                  <div style={{ position: "absolute", top: 0, left: 0, width: 90, height: 90, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{pct}%</div>
                    <div style={{ fontSize: 10, color: "#7a8499" }}>done</div>
                  </div>
                </div>
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <StatBox label={`${freqLabel} Periods`} value={`${paidPeriods} / ${active.rows.length}`}/>
                  <StatBox label="Balance Left"   value={fmt(balanceRemaining)} highlight="#facc15"/>
                  <StatBox label="Interest Paid"  value={fmt(interestPaid)}     highlight="#f87171"/>
                  <StatBox label="Principal Paid" value={fmt(principalPaid)}    highlight="#6ee7b7"/>
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 16, marginBottom: 18, border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8499", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Log a {freqLabel} Payment</div>
                <div style={{ fontSize: 12, color: "#7a8499", marginBottom: 10 }}>
                  {paidPeriods < active.rows.length ? `Next due: ${getPeriodDate(paidPeriods)} · ${fmt(active.rows[paidPeriods]?.payment ?? active.basePayment)}` : "🎉 Loan fully paid off!"}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setPaidPeriods(p => Math.max(0,p-1))} disabled={paidPeriods===0} style={{ flex:1, padding:12, borderRadius:11, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color: paidPeriods===0?"#444":"#fff", fontSize:20, fontWeight:800, cursor: paidPeriods===0?"not-allowed":"pointer" }}>−</button>
                  <div style={{ flex:2, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.03)", borderRadius:11, fontSize:15, fontWeight:700, border:"1px solid rgba(255,255,255,0.07)" }}>{paidPeriods} paid</div>
                  <button onClick={() => setPaidPeriods(p => Math.min(active.rows.length,p+1))} disabled={paidPeriods===active.rows.length} style={{ flex:1, padding:12, borderRadius:11, background: paidPeriods<active.rows.length?`${bank.color}44`:"rgba(255,255,255,0.06)", border:`1px solid ${paidPeriods<active.rows.length?bank.color+"99":"rgba(255,255,255,0.1)"}`, color: paidPeriods<active.rows.length?"#fff":"#444", fontSize:20, fontWeight:800, cursor: paidPeriods===active.rows.length?"not-allowed":"pointer" }}>+</button>
                </div>
              </div>
              <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:14, padding:"12px 16px", marginBottom:18, border:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div><div style={{ fontSize:11, color:"#7a8499", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:2 }}>First Payment</div><div style={{ fontSize:13, fontWeight:600 }}>{getPeriodDate(0)}</div></div>
                <input type="month" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:9, padding:"7px 10px", color:"#e8eaf0", fontSize:13, cursor:"pointer" }}/>
              </div>
              <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, padding:"14px 16px", border:"1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#7a8499", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.08em" }}>Loan Summary</div>
                {[["Vehicle Price",fmt(carPrice)],["Down Payment",fmt(downPayment)],["Loan Principal",fmt(loanAmount)],["Bank",bank.name],["Interest Rate (APR)",`${activeRate}%${customRate !== null ? " (custom)" : ""}`],["Loan Term",`${term} months`],["Repayment Mode",freqLabel],[`${freqLabel} Payment`,fmt(active.basePayment)],currentExtra>0?[`Extra per ${periodLabel}`,fmt(currentExtra)]:null,["Total Interest",fmt(active.totalInterest)],currentExtra>0?["Interest Saved",fmt(interestSaved)]:null,["Total Loan Cost",fmt(loanAmount+active.totalInterest)]].filter(Boolean).map(([l,v],idx,arr) => (
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom: idx<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none", fontSize:13 }}>
                    <span style={{ color:"#7a8499" }}>{l}</span><span style={{ fontWeight:600, color: l==="Interest Saved"?"#6ee7b7":"#e8eaf0" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* schedule */}
          {simTab === "schedule" && (
            <div>
              <div style={{ fontSize:12, color:"#7a8499", marginBottom:14 }}>{freqLabel} amortization · {bank.name} · {activeRate}% APR{currentExtra>0&&<span style={{color:"#6ee7b7"}}> · +{fmt(currentExtra)}/{periodLabel} extra</span>}</div>
              <div style={{ maxHeight:430, overflowY:"auto", borderRadius:12, background:"rgba(0,0,0,0.25)" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead><tr style={{ position:"sticky", top:0, background:"#111827" }}>{["#","Date","Payment",currentExtra>0?"Extra":null,"Principal","Interest","Balance"].filter(Boolean).map(h=><th key={h} style={{ padding:"10px 7px", textAlign:"right", color:"#7a8499", fontWeight:700, fontSize:11 }}>{h}</th>)}</tr></thead>
                  <tbody>{active.rows.map((row,i)=>{const paid=i<paidPeriods;return(<tr key={i} style={{ background: paid?`${bank.color}18`:"transparent", borderBottom:"1px solid rgba(255,255,255,0.04)" }}><td style={{ padding:"8px 7px", textAlign:"right", color: paid?bank.color:"#fff", fontWeight:700 }}>{paid?"✓":row.period}</td><td style={{ padding:"8px 7px", textAlign:"right", color:"#7a8499", whiteSpace:"nowrap" }}>{getPeriodDate(i)}</td><td style={{ padding:"8px 7px", textAlign:"right" }}>{fmt(row.payment)}</td>{currentExtra>0&&<td style={{ padding:"8px 7px", textAlign:"right", color:"#6ee7b7" }}>{row.extra>0?`+${fmt(row.extra)}`:"—"}</td>}<td style={{ padding:"8px 7px", textAlign:"right", color:"#6ee7b7" }}>{fmt(row.principal)}</td><td style={{ padding:"8px 7px", textAlign:"right", color:"#f87171" }}>{fmt(row.interest)}</td><td style={{ padding:"8px 7px", textAlign:"right" }}>{fmt(row.balance)}</td></tr>);})}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* compare */}
          {simTab === "compare" && (
            <div>
              <div style={{ fontSize:12, color:"#7a8499", marginBottom:14 }}>All Big 5 · {fmt(loanAmount)} · {term}-month · {freqLabel} · 🇨🇦 CAD</div>
              {BANKS.map((b,i)=>{
                const bs = payMode==="monthly" ? calcMonthly(loanAmount,b.rate,term,monthlyExtra) : calcBiweekly(loanAmount,b.rate,term,biweeklyExtra);
                const maxTI = BANKS.reduce((mx,bk)=>{ const s=payMode==="monthly"?calcMonthly(loanAmount,bk.rate,term,0):calcBiweekly(loanAmount,bk.rate,term,0); return Math.max(mx,s.totalInterest); },0);
                return(<div key={b.name} onClick={()=>{setSelectedBank(i);setSimTab("overview");}} style={{ border:`2px solid ${selectedBank===i?b.color:"rgba(255,255,255,0.07)"}`, borderRadius:16, padding:"14px 16px", marginBottom:10, background: selectedBank===i?`${b.color}14`:"rgba(255,255,255,0.03)", cursor:"pointer", transition:"all 0.2s" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ width:10, height:10, borderRadius:"50%", background:b.color }}/><span style={{ fontWeight:800, fontSize:15 }}>{b.name}</span>{b.rate===lowestRate&&<span style={{ fontSize:10, background:"#10b981", color:"#fff", padding:"2px 7px", borderRadius:20, fontWeight:800 }}>BEST</span>}</div>
                    <span style={{ fontWeight:900, fontSize:17 }}>{fmt(bs.basePayment)}<span style={{ fontSize:11, fontWeight:400, color:"#7a8499" }}>/{periodLabel}</span></span>
                  </div>
                  <div style={{ display:"flex", gap:12, fontSize:12, marginBottom:10, flexWrap:"wrap" }}><span style={{ color:"#7a8499" }}>Rate: <b style={{ color:"#e8eaf0" }}>{b.rate}%</b></span><span style={{ color:"#7a8499" }}>Interest: <b style={{ color:"#f87171" }}>{fmt(bs.totalInterest)}</b></span><span style={{ color:"#7a8499" }}>Payoff: <b style={{ color:"#e8eaf0" }}>{bs.periods} {isBiweekly?"periods":"mo"}</b></span></div>
                  <div style={{ height:5, borderRadius:3, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}><div style={{ height:"100%", borderRadius:3, width:`${(bs.totalInterest/maxTI)*100}%`, background:`linear-gradient(90deg,${b.color},${b.accent})`, transition:"width 0.4s" }}/></div>
                </div>);
              })}
              {(()=>{const best=payMode==="monthly"?calcMonthly(loanAmount,lowestRate,term,0):calcBiweekly(loanAmount,lowestRate,term,0);const worst=payMode==="monthly"?calcMonthly(loanAmount,Math.max(...BANKS.map(b=>b.rate)),term,0):calcBiweekly(loanAmount,Math.max(...BANKS.map(b=>b.rate)),term,0);return(<div style={{ background:"rgba(16,185,129,0.1)", borderRadius:12, padding:"12px 14px", border:"1px solid rgba(16,185,129,0.25)", marginTop:4 }}><div style={{ fontSize:12, color:"#6ee7b7", fontWeight:700 }}>💡 Best vs worst rate saves {fmt(worst.totalInterest-best.totalInterest)} in interest over {term} months.</div></div>);})()}
              <div style={{ fontSize:11, color:"#444", marginTop:12, textAlign:"center" }}>Representative APRs for prime borrowers, May 2026.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────
export default function App() {
  const [appTab, setAppTab] = useState("simulator");

  // ── Tracker state lifted here so it survives tab switches ──
  const [trackerRate,   setTrackerRate]   = useState(BANKS[0].rate);
  const [trackerRateIn, setTrackerRateIn] = useState(String(BANKS[0].rate));
  const [trackerLoan,   setTrackerLoan]   = useState(DEFAULT_LOAN);
  const [trackerLoanIn, setTrackerLoanIn] = useState(String(DEFAULT_LOAN));
  const [trackerTerm,   setTrackerTerm]   = useState(48);
  const [trackerTermIn, setTrackerTermIn] = useState("48");
  const [payments,      setPayments]      = useState([]);
  const [payFreq,       setPayFreq]       = useState("monthly");  // "monthly" | "biweekly"
  const [monthLabel,    setMonthLabel]    = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}`;
  });
  const [biweeklyDate,  setBiweeklyDate]  = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });

  const bank = BANKS[0];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(155deg,#0b0f1a 0%,#111827 60%,#0d1420 100%)", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#e8eaf0" }}>

      {/* App Header */}
      <div style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 22px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#003A70,#005DAA)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🚗</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.3px" }}>Car Loan Tracker</div>
            <div style={{ fontSize: 11, color: "#7a8499" }}>{fmt(DEFAULT_CAR_PRICE)} vehicle · 🇨🇦 CAD · Open Loan</div>
          </div>
          <div style={{ marginLeft: "auto", background: "rgba(255,255,255,0.07)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#7a8499", fontWeight: 700 }}>🇨🇦 CAD</div>
        </div>

        {/* Top-level tab bar */}
        <div style={{ display: "flex", gap: 0 }}>
          {[
            { key: "simulator", label: "📊 Simulator",  desc: "Plan & compare" },
            { key: "tracker",   label: "📋 My Tracker", desc: "Log real payments" },
          ].map(({ key, label, desc }) => (
            <button key={key} onClick={() => setAppTab(key)} style={{ flex: 1, padding: "10px 0 12px", background: "none", border: "none", borderBottom: appTab === key ? "3px solid #6ee7b7" : "3px solid transparent", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
              <div style={{ fontSize: 13, fontWeight: appTab === key ? 800 : 500, color: appTab === key ? "#fff" : "#7a8499" }}>{label}</div>
              <div style={{ fontSize: 10, color: appTab === key ? "#6ee7b7" : "#5a6070", marginTop: 1 }}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Content — both always mounted, hidden via display to preserve state */}
      <div style={{ padding: "0 16px 30px" }}>
        <div style={{ display: appTab === "simulator" ? "block" : "none" }}><Simulator /></div>
        <div style={{ display: appTab === "tracker"   ? "block" : "none" }}>
          <MyTracker
            trackerRate={trackerRate}     setTrackerRate={setTrackerRate}
            trackerRateIn={trackerRateIn} setTrackerRateIn={setTrackerRateIn}
            trackerLoan={trackerLoan}     setTrackerLoan={setTrackerLoan}
            trackerLoanIn={trackerLoanIn} setTrackerLoanIn={setTrackerLoanIn}
            trackerTerm={trackerTerm}     setTrackerTerm={setTrackerTerm}
            trackerTermIn={trackerTermIn} setTrackerTermIn={setTrackerTermIn}
            payments={payments}           setPayments={setPayments}
            payFreq={payFreq}             setPayFreq={setPayFreq}
            monthLabel={monthLabel}       setMonthLabel={setMonthLabel}
            biweeklyDate={biweeklyDate}   setBiweeklyDate={setBiweeklyDate}
          />
        </div>
      </div>

      <div style={{ padding: "0 20px 30px", fontSize: 11, color: "#3d4659", textAlign: "center", lineHeight: 1.7 }}>
        Rates sourced from Canadian bank data (May 2026). Actual rates depend on credit score &amp; lender assessment.
      </div>
    </div>
  );
}
