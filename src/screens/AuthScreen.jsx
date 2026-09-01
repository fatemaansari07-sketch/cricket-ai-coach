import React, { useState } from "react";
import { School } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { C, Wordmark, SolidButton, Pill } from "../components/ui";

function Field({ label, ...inputProps }) {
  return (
    <div className="text-left">
      <label className="block text-xs font-semibold mb-1.5" style={{ color: C.text }}>{label}</label>
      <input
        {...inputProps}
        className="w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, color: C.text }}
      />
    </div>
  );
}

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, sendPhoneOtp, verifyPhoneOtp } = useAuth();

  const [method, setMethod] = useState("email");
  const [mode, setMode] = useState("login");
  const [otpStep, setOtpStep] = useState("enter-phone");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [academyCode, setAcademyCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const resetMessages = () => { setError(null); setInfo(null); };

  const linkAcademyIfAny = async (userId) => {
    if (!academyCode.trim()) return;
    const { data: acad } = await supabase
      .from("academies")
      .select("id")
      .eq("invite_code", academyCode.trim().toUpperCase())
      .maybeSingle();
    if (acad) await supabase.from("profiles").update({ academy_id: acad.id }).eq("id", userId);
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      const { data, error } = await signUp(email, password, fullName);
      if (error) setError(error.message);
      else {
        if (data?.user?.id) await linkAcademyIfAny(data.user.id);
        setInfo("Account ban gaya! Email confirm karo, phir login karo.");
      }
    }
    setLoading(false);
  };

  const submitSendOtp = async (e) => {
    e.preventDefault();
    resetMessages();
    if (!phone) return;
    setLoading(true);
    const { error } = await sendPhoneOtp(phone);
    if (error) setError(error.message);
    else { setOtpStep("enter-otp"); setInfo("OTP bhej diya hai."); }
    setLoading(false);
  };

  const submitVerifyOtp = async (e) => {
    e.preventDefault();
    resetMessages();
    if (!otp) return;
    setLoading(true);
    const { data, error } = await verifyPhoneOtp(phone, otp, fullName);
    if (error) setError(error.message);
    else if (data?.user?.id) await linkAcademyIfAny(data.user.id);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: C.bg }}>
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-1">
          <Wordmark />
        </div>
        <p className="text-sm mb-8" style={{ color: C.muted }}>
          {method === "email" ? (mode === "login" ? "Hi! Wapas swagat hai" : "Hi! Account banate hain") : "Hi! Phone se login karte hain"}
        </p>

        <button
          onClick={() => signInWithGoogle(academyCode)}
          className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-3.5 mb-5 font-semibold text-sm active:scale-95 transition-transform"
          style={{ background: "#FFFFFF", color: "#1F2937", border: "1px solid #E5E7EB" }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z" />
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 13.9-5.4l-6.4-5.4C29.4 34.9 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.6 39.5 16.3 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.4 5.4C40.9 36.6 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
          </svg>
          Google se Login Karo
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="h-px flex-1" style={{ background: C.border }} />
          <span className="text-[10px] font-semibold" style={{ color: C.muted }}>YA PHIR</span>
          <div className="h-px flex-1" style={{ background: C.border }} />
        </div>

        <div className="flex gap-2 justify-center mb-6">
          <Pill active={method === "email"} onClick={() => { setMethod("email"); resetMessages(); }}>Email</Pill>
          <Pill active={method === "phone"} onClick={() => { setMethod("phone"); setOtpStep("enter-phone"); resetMessages(); }}>Phone (OTP)</Pill>
        </div>

        {method === "email" ? (
          <form onSubmit={submitEmail} className="space-y-4">
            {mode === "signup" && (
              <Field label="Aapka naam?" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Pura naam" />
            )}
            <Field label="Aapka email address?" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <Field label="Password?" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            {mode === "signup" && (
              <Field label="Academy code (optional)" value={academyCode} onChange={(e) => setAcademyCode(e.target.value)} placeholder="Agar coach ne diya ho" />
            )}

            {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}
            {info && <div className="text-xs" style={{ color: C.green }}>{info}</div>}

            <SolidButton type="submit" tone="green" disabled={loading}>
              {loading ? "Wait karo..." : mode === "login" ? "Login Karo" : "Sign Up Karo"}
            </SolidButton>
          </form>
        ) : otpStep === "enter-phone" ? (
          <form onSubmit={submitSendOtp} className="space-y-4">
            <Field label="Aapka naam? (naye account ke liye)" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Pura naam" />
            <Field label="Phone number?" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" />
            <Field label="Academy code (optional)" value={academyCode} onChange={(e) => setAcademyCode(e.target.value)} placeholder="Agar coach ne diya ho" />

            {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}

            <SolidButton type="submit" tone="green" disabled={loading}>
              {loading ? "Bhej rahe hain..." : "OTP Bhejo"}
            </SolidButton>
          </form>
        ) : (
          <form onSubmit={submitVerifyOtp} className="space-y-4">
            <Field label="6-digit OTP daalo" inputMode="numeric" required value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" />

            {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}
            {info && <div className="text-xs" style={{ color: C.green }}>{info}</div>}

            <SolidButton type="submit" tone="green" disabled={loading}>
              {loading ? "Verify ho raha hai..." : "Verify Karo"}
            </SolidButton>
            <button type="button" onClick={() => { setOtpStep("enter-phone"); resetMessages(); }} className="text-xs w-full" style={{ color: C.muted }}>
              Phone number badalna hai?
            </button>
          </form>
        )}

        {method === "email" && (
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); resetMessages(); }} className="text-xs mt-6" style={{ color: C.muted }}>
            {mode === "login" ? (
              <>Account nahi hai? <span style={{ color: C.green, fontWeight: 700 }}>Free trial shuru karo</span></>
            ) : (
              <>Already account hai? <span style={{ color: C.green, fontWeight: 700 }}>Login karo</span></>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
