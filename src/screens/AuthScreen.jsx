import React, { useState } from "react";
import { Mail, Lock, User as UserIcon, Phone, School } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { C, Wordmark, SolidButton, Pill } from "../components/ui";

export default function AuthScreen() {
  const { signIn, signUp, sendPhoneOtp, verifyPhoneOtp } = useAuth();

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

  const inputStyle = { background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: C.text };

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
      <div className="w-full max-w-md flex flex-col justify-center px-6" style={{ background: C.app, minHeight: "100vh" }}>
        <div className="mb-8 flex justify-center">
          <Wordmark />
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
            <p className="text-xs mb-6" style={{ color: C.muted }}>
              {mode === "login" ? "Login karke apna practice track karo" : "30 second me shuru karo"}
            </p>

            <form onSubmit={submitEmail} className="space-y-3">
              {mode === "signup" && (
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={inputStyle}>
                  <UserIcon size={16} style={{ color: C.muted }} />
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Pura naam" className="bg-transparent outline-none text-sm flex-1" style={{ color: C.text }} />
                </div>
              )}
              <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={inputStyle}>
                <Mail size={16} style={{ color: C.muted }} />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="bg-transparent outline-none text-sm flex-1" style={{ color: C.text }} />
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={inputStyle}>
                <Lock size={16} style={{ color: C.muted }} />
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="bg-transparent outline-none text-sm flex-1" style={{ color: C.text }} />
              </div>
              {mode === "signup" && (
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={inputStyle}>
                  <School size={16} style={{ color: C.muted }} />
                  <input value={academyCode} onChange={(e) => setAcademyCode(e.target.value)} placeholder="Academy code (optional)" className="bg-transparent outline-none text-sm flex-1" style={{ color: C.text }} />
                </div>
              )}


              {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}
              {info && <div className="text-xs" style={{ color: C.green }}>{info}</div>}

              <SolidButton type="submit" tone="green" disabled={loading} className="mt-2">
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
            <p className="text-xs mb-6" style={{ color: C.muted }}>
              {otpStep === "enter-phone" ? "Naya ya purana dono chalega — OTP aayega" : "SMS me aaya OTP daalo"}
            </p>

            {otpStep === "enter-phone" ? (
              <form onSubmit={submitSendOtp} className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={inputStyle}>
                  <UserIcon size={16} style={{ color: C.muted }} />
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Pura naam (naye account ke liye)" className="bg-transparent outline-none text-sm flex-1" style={{ color: C.text }} />
                </div>
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={inputStyle}>
                  <Phone size={16} style={{ color: C.muted }} />
                  <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" className="bg-transparent outline-none text-sm flex-1" style={{ color: C.text }} />
                </div>
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={inputStyle}>
                  <School size={16} style={{ color: C.muted }} />
                  <input value={academyCode} onChange={(e) => setAcademyCode(e.target.value)} placeholder="Academy code (optional)" className="bg-transparent outline-none text-sm flex-1" style={{ color: C.text }} />
                </div>
                <div className="text-[10px]" style={{ color: C.muted }}>Country code ke saath daalo, jaise +91</div>

                {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}

                <SolidButton type="submit" tone="green" disabled={loading} className="mt-2">
                  {loading ? "Bhej rahe hain..." : "OTP Bhejo"}
                </SolidButton>
              </form>
            ) : (
              <form onSubmit={submitVerifyOtp} className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={inputStyle}>
                  <Lock size={16} style={{ color: C.muted }} />
                  <input inputMode="numeric" required value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit OTP" className="bg-transparent outline-none text-sm flex-1" style={{ color: C.text }} />
                </div>

                {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}
                {info && <div className="text-xs" style={{ color: C.green }}>{info}</div>}

                <SolidButton type="submit" tone="green" disabled={loading} className="mt-2">
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
