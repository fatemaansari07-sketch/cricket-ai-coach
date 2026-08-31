import React, { useState } from "react";
import { Mail, Lock, User as UserIcon, Phone, School } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { C, Wordmark, SolidButton, Pill, SettingsCard } from "../components/ui";

function FieldRow({ icon: Icon, ...inputProps }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={16} style={{ color: C.muted }} className="shrink-0" />
      <input {...inputProps} className="bg-transparent outline-none text-sm flex-1 py-0.5" style={{ color: C.text }} />
    </div>
  );
}

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, sendPhoneOtp, verifyPhoneOtp } = useAuth();

  const [method, setMethod] = useState("email"); // "email" | "phone"
  const [mode, setMode] = useState("login"); // "login" | "signup" (email only)
  const [otpStep, setOtpStep] = useState("enter-phone"); // "enter-phone" | "enter-otp" (phone only)

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
    if (acad) {
      await supabase.from("profiles").update({ academy_id: acad.id }).eq("id", userId);
    }
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
        setInfo("Account ban gaya! Email confirm karo (agar Supabase me confirmation on hai), phir login karo.");
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
    else {
      setOtpStep("enter-otp");
      setInfo("OTP bhej diya hai, apna phone check karo.");
    }
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
    <div className="w-full flex justify-center" style={{ background: C.bg, minHeight: "100vh" }}>
      <div
        className="w-full max-w-md flex flex-col justify-center px-6 py-10"
        style={{ background: `radial-gradient(circle at 50% 0%, ${C.greenDeep}55 0%, ${C.app} 45%)`, minHeight: "100vh" }}
      >
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>

        {/* One-tap Google login — simplest option, especially for younger users */}
        <button
          onClick={() => signInWithGoogle(academyCode)}
          className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-3.5 mb-4 font-semibold text-sm active:scale-95 transition-transform shadow-lg"
          style={{ background: "#FFFFFF", color: "#1F2937" }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z" />
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 13.9-5.4l-6.4-5.4C29.4 34.9 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.6 39.5 16.3 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.4 5.4C40.9 36.6 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
          </svg>
          Google se Continue Karo
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1" style={{ background: C.border }} />
          <span className="text-[10px] font-medium" style={{ color: C.muted }}>YA PHIR</span>
          <div className="h-px flex-1" style={{ background: C.border }} />
        </div>

        <div className="flex gap-2 mb-6 justify-center">
          <Pill active={method === "email"} onClick={() => { setMethod("email"); resetMessages(); }}>Email</Pill>
          <Pill active={method === "phone"} onClick={() => { setMethod("phone"); setOtpStep("enter-phone"); resetMessages(); }}>Phone (OTP)</Pill>
        </div>

        {method === "email" ? (
          <>
            <h1 className="text-xl font-extrabold mb-1" style={{ color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {mode === "login" ? "Wapas swagat hai" : "Account banao"}
            </h1>
            <p className="text-xs mb-5" style={{ color: C.muted }}>
              {mode === "login" ? "Login karke apna practice track karo" : "30 second me shuru karo"}
            </p>

            <form onSubmit={submitEmail} className="space-y-3">
              <SettingsCard>
                {mode === "signup" && (
                  <FieldRow icon={UserIcon} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Pura naam" />
                )}
                <FieldRow icon={Mail} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
                <FieldRow icon={Lock} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
                {mode === "signup" && (
                  <FieldRow icon={School} value={academyCode} onChange={(e) => setAcademyCode(e.target.value)} placeholder="Academy code (optional)" />
                )}
              </SettingsCard>

              {error && <div className="text-xs px-1" style={{ color: C.red }}>{error}</div>}
              {info && <div className="text-xs px-1" style={{ color: C.green }}>{info}</div>}

              <SolidButton type="submit" tone="green" disabled={loading} className="mt-1">
                {loading ? "Wait karo..." : mode === "login" ? "Login Karo" : "Sign Up Karo"}
              </SolidButton>
            </form>

            <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); resetMessages(); }} className="text-xs mt-5 text-center" style={{ color: C.muted }}>
              {mode === "login" ? (
                <>Account nahi hai? <span style={{ color: C.green, fontWeight: 600 }}>Sign up karo</span></>
              ) : (
                <>Already account hai? <span style={{ color: C.green, fontWeight: 600 }}>Login karo</span></>
              )}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold mb-1" style={{ color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Phone number se login
            </h1>
            <p className="text-xs mb-5" style={{ color: C.muted }}>
              {otpStep === "enter-phone" ? "Naya ya purana dono chalega — OTP aayega" : "SMS me aaya OTP daalo"}
            </p>

            {otpStep === "enter-phone" ? (
              <form onSubmit={submitSendOtp} className="space-y-3">
                <SettingsCard>
                  <FieldRow icon={UserIcon} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Pura naam (naye account ke liye)" />
                  <FieldRow icon={Phone} type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" />
                  <FieldRow icon={School} value={academyCode} onChange={(e) => setAcademyCode(e.target.value)} placeholder="Academy code (optional)" />
                </SettingsCard>
                <div className="text-[10px] px-1" style={{ color: C.muted }}>Country code ke saath daalo, jaise +91</div>

                {error && <div className="text-xs px-1" style={{ color: C.red }}>{error}</div>}

                <SolidButton type="submit" tone="green" disabled={loading} className="mt-1">
                  {loading ? "Bhej rahe hain..." : "OTP Bhejo"}
                </SolidButton>
              </form>
            ) : (
              <form onSubmit={submitVerifyOtp} className="space-y-3">
                <SettingsCard>
                  <FieldRow icon={Lock} inputMode="numeric" required value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit OTP" />
                </SettingsCard>

                {error && <div className="text-xs px-1" style={{ color: C.red }}>{error}</div>}
                {info && <div className="text-xs px-1" style={{ color: C.green }}>{info}</div>}

                <SolidButton type="submit" tone="green" disabled={loading} className="mt-1">
                  {loading ? "Verify ho raha hai..." : "Verify Karo"}
                </SolidButton>

                <button type="button" onClick={() => { setOtpStep("enter-phone"); resetMessages(); }} className="text-xs w-full text-center mt-1" style={{ color: C.muted }}>
                  Phone number badalna hai?
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
