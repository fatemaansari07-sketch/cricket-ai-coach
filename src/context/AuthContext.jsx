import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
const PENDING_ACADEMY_CODE_KEY = "pendingAcademyCode";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error) setProfile(data);
  }, []);

  const refreshProfile = useCallback(() => {
    if (session?.user?.id) return fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  // If someone typed an academy code before a Google redirect took them away
  // and back, link it now that we actually have a logged-in user.
  const linkPendingAcademyCode = useCallback(async (userId) => {
    const code = localStorage.getItem(PENDING_ACADEMY_CODE_KEY);
    if (!code || !userId) return;
    const { data: acad } = await supabase
      .from("academies")
      .select("id")
      .eq("invite_code", code.trim().toUpperCase())
      .maybeSingle();
    if (acad) {
      await supabase.from("profiles").update({ academy_id: acad.id }).eq("id", userId);
    }
    localStorage.removeItem(PENDING_ACADEMY_CODE_KEY);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        await linkPendingAcademyCode(session.user.id);
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        await linkPendingAcademyCode(session.user.id);
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [fetchProfile, linkPendingAcademyCode]);

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // fixes the "confirm link goes to localhost:3000" issue — points the
        // confirmation email back at whichever domain the app is actually
        // running on (also add this URL under Supabase → Auth → URL
        // Configuration → Redirect URLs, or the link will still fail)
        emailRedirectTo: window.location.origin,
      },
    });
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  // One-tap login — no password, no email confirmation step at all.
  // Requires the Google provider to be turned on in Supabase → Auth → Providers.
  const signInWithGoogle = async (academyCode) => {
    if (academyCode?.trim()) {
      localStorage.setItem(PENDING_ACADEMY_CODE_KEY, academyCode.trim());
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Phone-based registration/login: step 1, send an OTP SMS
  const sendPhoneOtp = async (phone) => {
    const { data, error } = await supabase.auth.signInWithOtp({ phone });
    return { data, error };
  };

  // Phone-based registration/login: step 2, verify the code the user typed
  const verifyPhoneOtp = async (phone, token, fullName) => {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    if (!error && data?.user && fullName) {
      // save the name + phone on their profile the first time they verify
      await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", data.user.id);
    }
    return { data, error };
  };

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    refreshProfile,
    sendPhoneOtp,
    verifyPhoneOtp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
