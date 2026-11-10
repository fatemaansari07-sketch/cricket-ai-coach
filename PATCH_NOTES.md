# Cricket AI Coach V2 patch — 25 Oct 2026

This is a replacement-file patch, not a full repository export. Paths are relative to the repository root. Replace the files at the same paths in GitHub.

## Included changes
- Pricing UI: ₹99 / ₹499 / ₹999 plus club-only ₹1,00,000/month plan clearly marked Coming Soon.
- ₹499 Video Visualization upsell shown to Pro users after a coaching result.
- Removed free demo activation of paid tiers from the public pricing screen; payment checkout is explicitly shown as not connected yet.
- Admin tier labels updated to the four current tier IDs and credits initialized when an admin assigns a tier.
- Video credits use the current four-tier model: ₹99 gets no video credits; ₹499 and ₹999 get 100/month.
- Gemini video and three-frame endpoints verify login, verify server-side plan, enforce owned storage paths, and consume visual credits server-side.
- Coach chat verifies the session and checks the actual profile plan server-side; client-supplied planTier is not trusted.
- Legacy phase-detection endpoint accepts the current paid tier IDs.
- SQL migration normalizes legacy plan labels before the plan constraint and adds a trigger to stop normal users from granting themselves paid plans/credits.
- Setup docs updated for Google-only login and required server environment variables.

## Important before deployment
1. Back up the existing Supabase database.
2. Review and run `supabase/v2_schema.sql` in the existing project only after confirming the current schema. It is designed to preserve existing users/data, but it changes plan constraints and profile-update protections.
3. Configure Vercel environment variables: `SUPABASE_URL` (or `VITE_SUPABASE_URL`), `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`), `SUPABASE_SERVICE_ROLE_KEY` (server-only), `GEMINI_API_KEY`, plus the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. The payment gateway is not implemented. Paid plan purchase is not live; an administrator can assign a plan after separately verifying payment.
5. The build was not verified in this environment: `npm install` timed out and dependencies were unavailable. Run `npm install` and `npm run build` after replacing files, and fix any reported errors before publishing.

Do not replace or delete the existing Supabase project/database. Do not commit real API keys or the service-role key.
