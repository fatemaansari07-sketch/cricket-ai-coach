// App.jsx
import React, { useState } from "react";
import { Home, Video, Calendar, Store, ArrowLeftRight, LogOut, Crown, ShieldCheck, School, TrendingUp } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { C, Wordmark } from "./components/ui";
import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import AnalyzeScreen from "./screens/AnalyzeScreen";
import PlanScreen from "./screens/PlanScreen";
import CompareScreen from "./screens/CompareScreen";
import ShopAdsScreen from "./screens/ShopAdsScreen";
import PricingScreen from "./screens/PricingScreen";
import AdminScreen from "./screens/AdminScreen";
import AcademyScreen from "./screens/AcademyScreen";
import ProgressScreen from "./screens/ProgressScreen";

const BASE_NAV = [
  { id: "home", icon: Home, label: "Home" },
  { id: "analyze", icon: Video, label: "Analyze" },
  { id: "plan", icon: Calendar, label: "Plan" },
  { id: "compare", icon: ArrowLeftRight, label: "Compare" },
  { id: "shop", icon: Store, label: "Shop" },
];

export default function App() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const [tab, setTab] = useState("home");
  const [analysis, setAnalysis] = useState(null);
  const [plan, setPlan] = useState(null);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ background: C.bg, minHeight: "100vh" }}>
        <div className="text-sm" style={{ color: C.muted }}>Loading...</div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const planTier = profile?.plan_tier ?? "free";
  const isPaid = planTier !== "free";
  const isAdmin = !!profile?.is_admin;
  const isAcademyOwner = !!profile?.is_academy_owner;
  const NAV = [
    ...BASE_NAV,
    ...(planTier === "pro" ? [{ id: "progress", icon: TrendingUp, label: "Progress" }] : []),
    ...(isAcademyOwner ? [{ id: "academy", icon: School, label: "Academy" }] : []),
    ...(isAdmin ? [{ id: "admin", icon: ShieldCheck, label: "Admin" }] : []),
  ];

  return (
    <div className="w-full flex justify-center" style={{ background: C.bg, height: "100vh" }}>
      <div className="w-full max-w-md flex flex-col" style={{ background: C.app, height: "100vh" }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-4 shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
          <Wordmark compact />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("pricing")}
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full active:scale-95 transition-transform"
              style={{ background: C.gold, color: "#0B0F17" }}
            >
              <Crown size={11} /> {planTier === "free" ? "FREE" : planTier.toUpperCase()}
            </button>
            <button onClick={signOut} className="p-1.5 rounded-full" style={{ color: C.muted }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === "home" && (
            <HomeScreen 
              isPaid={isPaid} 
              planTier={planTier} 
              isAcademyOwner={isAcademyOwner} 
              setTab={setTab}
              recentAnalysisData={analysis}
              onStartUpload={() => setTab("analyze")}
            />
          )}
          {tab === "analyze" && (
            <AnalyzeScreen 
              isPaid={isPaid} 
              onPlanReady={(r) => { setAnalysis(r); setPlan(null); }} 
              setTab={setTab} 
              onRetest={() => {
                setTab("analyze");
              }}
            />
          )}
          {tab === "plan" && <PlanScreen analysis={analysis} plan={plan} setPlan={setPlan} isPaid={isPaid} />}
          {tab === "compare" && <CompareScreen planTier={planTier} />}
          {tab === "shop" && <ShopAdsScreen />}
          {tab === "pricing" && <PricingScreen planTier={planTier} refreshProfile={refreshProfile} />}
          {tab === "progress" && <ProgressScreen planTier={planTier} />}
          {tab === "academy" && <AcademyScreen />}
          {tab === "admin" && isAdmin && <AdminScreen />}
        </div>

        {/* Bottom nav */}
        <div className="flex justify-around py-2.5 shrink-0" style={{ background: "rgba(11,15,23,0.95)", borderTop: `1px solid ${C.border}` }}>
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)} className="flex flex-col items-center gap-1 px-3 py-1 active:scale-90 transition-transform">
                <Icon size={18} style={{ color: active ? C.green : "#4B5563" }} />
                <span className="text-[9px] font-semibold tracking-wide" style={{ color: active ? C.green : "#4B5563" }}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
