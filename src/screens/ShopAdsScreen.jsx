import React, { useEffect, useState } from "react";
import { Store, MapPin, Phone, Plus } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { SHOP_ADS_SEED } from "../data/content";
import { C, GlassCard, SolidButton, SectionTitle } from "../components/ui";

export default function ShopAdsScreen() {
  const { user } = useAuth();
  const [ads, setAds] = useState(SHOP_ADS_SEED);
  const [form, setForm] = useState({ shop_name: "", product_name: "", price_inr: "", category: "Bat", address: "", phone: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("shop_ads")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (!error && data && data.length > 0) setAds(data);
    }
    load();
  }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.shop_name || !form.product_name || !form.price_inr) return;
    setLoading(true);
    const payload = { ...form, price_inr: Number(form.price_inr), vendor_user_id: user?.id ?? null };
    const { error } = await supabase.from("shop_ads").insert(payload);
    if (!error) {
      setForm({ shop_name: "", product_name: "", price_inr: "", category: "Bat", address: "", phone: "" });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2500);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <SectionTitle sub="Sports shops apna product yahan advertise kar sakte hain">Shop Ads</SectionTitle>

      <div className="space-y-2.5">
        {ads.map((a) => (
          <GlassCard key={a.id} className="p-3.5 flex gap-3">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.1)", border: `1px solid ${C.border}` }}>
              <Store size={19} style={{ color: C.green }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold" style={{ color: C.text }}>{a.product_name}</div>
              <div className="text-xs font-semibold" style={{ color: C.gold }}>₹{a.price_inr} · {a.category}</div>
              <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: C.muted }}><Store size={11} />{a.shop_name}</div>
              <div className="text-xs flex items-center gap-1" style={{ color: C.muted }}><MapPin size={11} />{a.address}</div>
              <div className="text-xs flex items-center gap-1" style={{ color: C.muted }}><Phone size={11} />{a.phone}</div>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-4 space-y-3">
        <div className="text-sm font-bold flex items-center gap-1.5" style={{ color: C.text }}>
          <Plus size={15} style={{ color: C.green }} /> Apna Ad Daalo
        </div>
        {[
          ["shop_name", "Shop ka naam"],
          ["product_name", "Product ka naam (jaise: SG Bat)"],
          ["price_inr", "Price (₹)"],
          ["address", "Dukan ka address"],
          ["phone", "Phone number"],
        ].map(([k, ph]) => (
          <input
            key={k}
            value={form[k]}
            onChange={(e) => update(k, e.target.value)}
            placeholder={ph}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
            style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: C.text }}
          />
        ))}
        <select
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
          style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: C.text }}
        >
          {["Bat", "Ball", "Shoes", "Gloves", "Pads", "Kit Bag", "Other"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <SolidButton tone="green" onClick={submit} disabled={loading}>{loading ? "Submit ho raha hai..." : "Ad Submit Karo"}</SolidButton>
        {submitted && <div className="text-xs text-center font-medium" style={{ color: C.green }}>Ad bhej diya — review ke baad live hoga.</div>}
      </GlassCard>
    </div>
  );
}
