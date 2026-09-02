import React from "react";
import { Crown } from "lucide-react";

export const C = {
  bg: "#05070B",
  app: "#0B0F17",
  card: "rgba(18,24,36,0.75)",
  cardSolid: "#121824",
  border: "#1F2937",
  green: "#10B981",
  greenDeep: "#064E3B",
  gold: "#F59E0B",
  text: "#FFFFFF",
  muted: "#94A3B8",
  red: "#EF4444",
};

export function CrestLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill={C.cardSolid} stroke={C.green} strokeWidth="1.5" />
      <circle cx="32" cy="32" r="14" fill={C.green} />
      <path d="M22 24 Q32 32 22 40" stroke={C.app} strokeWidth="1.4" fill="none" opacity="0.8" />
      <path d="M42 24 Q32 32 42 40" stroke={C.app} strokeWidth="1.4" fill="none" opacity="0.8" />
    </svg>
  );
}

export function Wordmark({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <CrestLogo size={compact ? 32 : 42} />
      <div className="leading-none">
        <div
          className={compact ? "text-sm" : "text-lg"}
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.01em", fontWeight: 800 }}
        >
          <span style={{ color: C.text }}>CRICKET </span>
          <span style={{ color: C.green }}>AI</span>
          <span style={{ color: C.text }}> COACH</span>
        </div>
        {!compact && (
          <div className="text-[10px] tracking-widest mt-0.5 font-medium" style={{ color: C.muted }}>
            TRAIN SMARTER · PLAY SHARPER
          </div>
        )}
      </div>
    </div>
  );
}

/** Big icon-less lockup for the auth/splash screen — no crest, just bold type. */
export function HeroWordmark() {
  return (
    <div className="text-center">
      <div
        className="text-[2.15rem] leading-none tracking-tight"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 900 }}
      >
        <span style={{ color: C.text }}>CRICKET</span>
        <span style={{ color: C.green }}> AI </span>
        <span style={{ color: C.text }}>COACH</span>
      </div>
      <div className="text-xs tracking-[0.2em] mt-2.5 font-semibold" style={{ color: C.muted }}>
        TRAIN SMARTER · PLAY SHARPER
      </div>
    </div>
  );
}

export function GlassCard({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-2xl backdrop-blur-md ${className}`}
      style={{ background: C.card, border: `1px solid ${C.border}`, ...style }}
    >
      {children}
    </div>
  );
}

export function SolidButton({ children, onClick, disabled, tone = "green", className = "", type = "button" }) {
  const bg = tone === "green" ? C.green : tone === "gold" ? C.gold : C.cardSolid;
  const textColor = tone === "dark" ? C.text : "#06110B";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold tracking-wide active:scale-95 transition-transform disabled:opacity-30 ${className}`}
      style={{ background: bg, color: textColor, border: tone === "dark" ? `1px solid ${C.border}` : "none" }}
    >
      {children}
    </button>
  );
}

export function AdSlot({ label = "Sponsored" }) {
  const ads = [
    { title: "SG Cricket — Flat 20% off bats", tag: "Sunrise Sports" },
    { title: "New Balance spikes, starting ₹2,999", tag: "Cover Drive Store" },
    { title: "Get your kit reviewed free this week", tag: "Boundary Line Cricket" },
  ];
  const ad = ads[Math.floor(Math.random() * ads.length)];
  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
      style={{ border: `1px dashed ${C.gold}55`, background: "rgba(255,255,255,0.02)" }}
    >
      <div>
        <div className="text-[9px] uppercase tracking-widest mb-1 font-semibold" style={{ color: C.muted }}>{label}</div>
        <div className="text-sm font-semibold" style={{ color: C.text }}>{ad.title}</div>
        <div className="text-xs" style={{ color: C.muted }}>{ad.tag}</div>
      </div>
      <button className="shrink-0 text-[11px] font-bold px-3.5 py-1.5 rounded-xl" style={{ background: C.gold, color: "#0B0F17" }}>
        View
      </button>
    </div>
  );
}

/** Compact ring for the 2x2 metric grid on the result screen. */
export function MetricRing({ value, size = 64 }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  const color = value >= 80 ? C.green : value >= 65 ? C.gold : C.red;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={C.border} strokeWidth="5" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="5" fill="none"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="16" fontWeight="800" fill={C.text} fontFamily="'Plus Jakarta Sans', sans-serif">
        {Math.round(value)}
      </text>
    </svg>
  );
}

/** Bordered stat box (label + MetricRing) used in the 2x2 result grid — border color follows the value. */
export function MetricBox({ label, value }) {
  const color = value >= 80 ? C.green : value >= 65 ? C.gold : C.red;
  return (
    <div className="rounded-xl p-3 flex flex-col items-center gap-2" style={{ border: `1px solid ${color}66`, background: C.cardSolid }}>
      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>{label}</span>
      <MetricRing value={value} />
    </div>
  );
}

export function ScoreRing({ score }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 80 ? C.green : score >= 65 ? C.gold : C.red;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} stroke={C.border} strokeWidth="8" fill="none" />
      <circle
        cx="55" cy="55" r={r} stroke={color} strokeWidth="8" fill="none"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 55 55)"
      />
      <text x="55" y="62" textAnchor="middle" fontSize="26" fontWeight="800" fill={C.text} fontFamily="'Plus Jakarta Sans', sans-serif">
        {score}
      </text>
    </svg>
  );
}

/** Abstract stick-figure used for pose comparison — not a real photo of any athlete */
export function StickFigure({ tilt = 0, kneeBend = 0, color = C.gold, label }) {
  return (
    <svg viewBox="0 0 100 180" width="100%" height="200">
      <line x1="50" y1="4" x2="50" y2="176" stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />
      <g transform={`rotate(${tilt} 50 30)`}>
        <circle cx="50" cy="22" r="12" fill="none" stroke={color} strokeWidth="2.5" />
        <line x1="50" y1="34" x2="50" y2="95" stroke={color} strokeWidth="2.5" />
        <line x1="50" y1="48" x2="24" y2="65" stroke={color} strokeWidth="2.5" />
        <line x1="50" y1="48" x2="76" y2="70" stroke={color} strokeWidth="2.5" />
      </g>
      <line x1="50" y1="95" x2={35 - kneeBend} y2="135" stroke={color} strokeWidth="2.5" />
      <line x1={35 - kneeBend} y1="135" x2={30 - kneeBend} y2="175" stroke={color} strokeWidth="2.5" />
      <line x1="50" y1="95" x2={65 + kneeBend} y2="135" stroke={color} strokeWidth="2.5" />
      <line x1={65 + kneeBend} y1="135" x2={70 + kneeBend} y2="175" stroke={color} strokeWidth="2.5" />
      {label && (
        <text x="50" y="196" textAnchor="middle" fontSize="9" fill={C.muted} fontFamily="'Inter', sans-serif">{label}</text>
      )}
    </svg>
  );
}

export function InfoHint({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-2 py-1">
      {Icon && <Icon size={13} style={{ color: C.muted }} className="shrink-0 mt-0.5" />}
      <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{children}</p>
    </div>
  );
}

export function SettingsCard({ children }) {
  const items = React.Children.toArray(children);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      {items.map((child, i) => (
        <div key={i} className="px-4 py-3.5" style={i > 0 ? { borderTop: `1px solid ${C.border}` } : undefined}>
          {child}
        </div>
      ))}
    </div>
  );
}

export function Pill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3.5 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform"
      style={
        active
          ? { background: C.green, color: "#06110B", border: "1px solid transparent" }
          : { background: "rgba(255,255,255,0.02)", color: C.muted, border: `1px solid ${C.border}` }
      }
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {children}
      </h2>
      {sub && <p className="text-xs mt-1" style={{ color: C.muted }}>{sub}</p>}
    </div>
  );
}

export function PlanBadge({ planTier }) {
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full"
      style={{ background: C.gold, color: "#0B0F17" }}
    >
      <Crown size={11} /> {planTier === "free" ? "FREE" : planTier.toUpperCase()}
    </span>
  );
}
