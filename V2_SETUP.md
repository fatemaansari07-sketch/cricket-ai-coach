# Cricket AI Coach V2 — setup

## Same Supabase project
Keep the existing Supabase project, Auth users, Storage and data. Do not create a new database.

1. Back up the existing database first.
2. Review `supabase/v2_schema.sql`, then run it in the existing Supabase SQL editor. It is intended to be additive and does not delete tables or user data, but it updates legacy plan labels and adds a profile-field guard.
3. In Supabase Auth → Providers, enable Google.
4. Add the production Vercel domain and local dev URL to Auth → URL Configuration → Redirect URLs.
5. Set these Vercel environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
   - `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; never prefix with `VITE_`)
   - `GEMINI_API_KEY`
   - Optional: `GEMINI_MODEL` (defaults to `gemini-2.5-flash`)
6. Redeploy Vercel after adding environment variables.

## Login
V2 player login UI is Google-only. Phone/OTP and password forms are removed from the new UI.
Existing Supabase auth/data remains untouched.

## Launch
- Shop/Need It/Deals remain future architecture and should stay disabled until city supply is ready.
- Pricing UI shows ₹99, ₹499, ₹999 and a ₹1,00,000/month club-only plan marked Coming Soon.
- Paid checkout is not implemented in this code. Do not advertise payments as live until a gateway and verified server-side payment webhook are added.
- AI analysis endpoints validate the user session and plan server-side and consume visual credits through the SQL RPC.
