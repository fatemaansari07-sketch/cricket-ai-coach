import React, { useEffect, useState } from "react";
import { ShieldCheck, Check, X, Users as UsersIcon, Store } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { C, GlassCard, Pill, SectionTitle } from "../components/ui";

export default function AdminScreen() {
  const [section, setSection] = useState("ads"); // "ads" | "users"
  const [pendingAds, setPendingAds] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAds = async () => {
    const { data } = await supabase
      .from("shop_ads")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingAds(data || []);
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers(data || []);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAds(), loadUsers()]).finally(() => setLoading(false));
  }, []);

  const decideAd = async (id, status) => {
    await supabase.from("shop_ads").update({ status }).eq("id", id);
    setPendingAds((prev) => prev.filter((a) => a.id !== id));
  };

  const changePlan = async (userId, plan_tier) => {
    await supabase.from("profiles").update({ plan_tier }).eq("id", userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, plan_tier } : u)));
  };

  const toggleAdmin = async (userId, is_admin) => {
    await supabase.from("profiles").update({ is_admin: !is_admin }).eq("id", userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_admin: !is_admin } : u)));
  };

  return (
    <div className="space-y-4">
      <SectionTitle sub="Sirf admins ko dikhta hai — shop ads approve karo, users manage karo">
        Admin Panel
      </SectionTitle>

      <div className="flex gap-2">
        <Pill active={section === "ads"} onClick={() => setSection("ads")}>
          Pending Ads {pendingAds.length > 0 ? `(${pendingAds.length})` : ""}
        </Pill>
        <Pill active={section === "users"} onClick={() => setSection("users")}>Users ({users.length})</Pill>
      </div>

      {loading && <div className="text-xs" style={{ color: C.muted }}>Loading...</div>}

      {!loading && section === "ads" && (
        <div className="space-y-2.5">
          {pendingAds.length === 0 && (
            <GlassCard className="p-6 text-center text-sm" style={{ color: C.muted }}>
              Koi pending ad nahi hai.
            </GlassCard>
          )}
          {pendingAds.map((a) => (
            <GlassCard key={a.id} className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.1)" }}>
                  <Store size={18} style={{ color: C.green }} />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: C.text }}>{a.product_name}</div>
                  <div className="text-xs" style={{ color: C.gold }}>₹{a.price_inr} · {a.category}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>{a.shop_name} · {a.address}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{a.phone}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => decideAd(a.id, "approved")}
                  className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  style={{ background: C.green, color: "#06110B" }}
                >
                  <Check size={13} /> Approve
                </button>
                <button
                  onClick={() => decideAd(a.id, "rejected")}
                  className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  style={{ background: "rgba(239,68,68,0.15)", color: C.red, border: `1px solid ${C.red}55` }}
                >
                  <X size={13} /> Reject
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {!loading && section === "users" && (
        <div className="space-y-2.5">
          {users.map((u) => (
            <GlassCard key={u.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-bold" style={{ color: C.text }}>{u.full_name || "No name"}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{u.phone || u.id.slice(0, 8) + "..."}</div>
                </div>
                {u.is_admin && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ background: "rgba(245,158,11,0.15)", color: C.gold }}>
                    <ShieldCheck size={11} /> Admin
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {["free", "basic", "pro"].map((t) => (
                  <button
                    key={t}
                    onClick={() => changePlan(u.id, t)}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full active:scale-95 transition-transform"
                    style={
                      u.plan_tier === t
                        ? { background: C.green, color: "#06110B" }
                        : { background: "rgba(255,255,255,0.04)", color: C.muted, border: `1px solid ${C.border}` }
                    }
                  >
                    {t}
                  </button>
                ))}
                <button
                  onClick={() => toggleAdmin(u.id, u.is_admin)}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full active:scale-95 transition-transform ml-auto"
                  style={{ background: "rgba(255,255,255,0.04)", color: C.muted, border: `1px solid ${C.border}` }}
                >
                  {u.is_admin ? "Remove admin" : "Make admin"}
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
