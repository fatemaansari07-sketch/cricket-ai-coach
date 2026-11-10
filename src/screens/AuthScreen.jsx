import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { C, HeroWordmark, SolidButton } from "../components/ui";

export default function AuthScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const continueWithGoogle = async () => {
    setLoading(true);
    setError("");
    const { error } = await signInWithGoogle();
    if (error) setError(error.message || "Google login nahi ho paya. Dubara try karo.");
    setLoading(false);
  };

  return (
    <div className="w-full flex items-center justify-center px-6 app-shell-center" style={{ background: C.bg, minHeight: "100dvh" }}>
      <div className="w-full max-w-sm text-center mx-auto">
        <div className="flex justify-center mb-1"><HeroWordmark /></div>
        <p className="text-sm mb-8" style={{ color: C.muted }}>Train smarter · Play sharper</p>

        <button
          onClick={continueWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 mb-5 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-60"
          style={{ background: "#FFFFFF", color: "#202124", border: "1px solid #E5E7EB" }}
        >
          <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 13.9-5.4l-6.4-5.4C29.4 34.9 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.6 39.5 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.4 5.4C40.9 36.6 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"/>
          </svg>
          {loading ? "Google khul raha hai..." : "Continue with Google"}
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="h-px flex-1" style={{ background: C.border }} />
          <span className="text-[10px] font-semibold" style={{ color: C.muted }}>SECURE LOGIN</span>
          <div className="h-px flex-1" style={{ background: C.border }} />
        </div>

        <div className="text-xs leading-relaxed" style={{ color: C.muted }}>
          Google account se login karo. Aapka purana Supabase Auth account isi app me continue kiya ja sakta hai.
        </div>
        {error && <div className="text-xs mt-4" style={{ color: C.red }}>{error}</div>}
      </div>
    </div>
  );
}
