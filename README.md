# Cricket AI Coach

Vite + React + Supabase. Ready to push to GitHub and deploy on Vercel.

## 1. Supabase setup
1. Create a project at supabase.com
2. Open **SQL Editor** → paste everything from `supabase/schema.sql` → Run
3. Go to **Storage** → confirm `videos` (private) and `ad-images` (public) buckets exist
4. Go to **Project Settings → API** → copy your **Project URL** and **anon public key**

## 2. Local setup
```bash
npm install
cp .env.example .env
# paste your Supabase URL + anon key into .env
npm run dev
```

## 3. Push to GitHub
```bash
git init
git add .
git commit -m "Cricket AI Coach"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

## 4. Deploy on Vercel
1. Import the GitHub repo in Vercel
2. Framework preset: **Vite**
3. Add environment variables (Project Settings → Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

## Fix: email confirmation link going to localhost
1. Supabase dashboard → **Authentication → URL Configuration**
2. **Site URL** → change to your real Vercel URL (e.g. `https://your-app.vercel.app`)
3. **Redirect URLs** → add the same URL here too
Without this, confirmation emails and Google login will redirect back to `localhost:3000` and fail.

## Google Sign-In (the "one-tap" option)
1. Supabase dashboard → **Authentication → Providers → Google** → turn it ON
2. Follow Supabase's on-screen instructions to create a Google OAuth Client ID/Secret (in Google Cloud Console), paste them in
3. Make sure your Vercel URL is in **Redirect URLs** (see above)
4. That's it — the app already has a "Google se Continue Karo" button wired up

## Phone number (OTP) login
1. Supabase dashboard → **Authentication → Providers → Phone** → turn it ON
2. Supabase needs an SMS provider to actually send the OTP — connect **Twilio** (or MessageBird/Vonage) there and fill in its keys. Without this, phone OTP will fail to send.
3. In the app, the login screen has an **Email / Phone (OTP)** toggle — phone signup asks for name + phone, sends an OTP, then verifies it.

## Making yourself an admin
1. Sign up normally in the app once (email or phone)
2. In Supabase → **SQL Editor**, run (replace with your real email or phone):
```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
-- or, if you signed up by phone:
-- where id = (select id from auth.users where phone = '+91XXXXXXXXXX');
```
3. Log out and log back in — a new **Admin** tab appears in the bottom nav where you can approve/reject shop ads and manage users' plans.

## How the "AI" actually works (read this!)
Two separate pieces, both real, no fake data anymore:
1. **Pose detection** (`src/lib/poseEstimation.js`) — uses Google's free, open MediaPipe Pose Landmarker model, running entirely in the user's browser (no server needed). It just finds where the body's joints are in one frame of the video. This part is a well-known off-the-shelf model — same idea as the "detection" folders you saw in that face-swap project.
2. **Coaching brain** (`src/data/biomechanics.js`) — this is **ours**. It defines what "correct" looks like for batting/bowling/fielding (ideal joint-angle ranges), measures the real angles MediaPipe found, and writes the correct/incorrect feedback. Tune the numbers in `IDEAL_RANGES` as you bring in real coaches — that's the actual product IP.

Current limitation: it checks **one representative frame**, not the full motion of the shot. Full temporal analysis (tracking the whole swing) is a bigger next step — happy to help with that later.

## Auto-delete videos after 7 days
- `api/cleanup-old-videos.js` is a Vercel serverless function that runs every night (`vercel.json` cron, 3 AM) and deletes video **files** older than 7 days from Storage.
- Text data — scores, feedback, angles, plans — is never touched, so history keeps working forever, storage just doesn't fill up.
- Needed env vars on Vercel (Project Settings → Environment Variables): `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` (see `.env.example`). **Never** put the service role key behind `VITE_` — it must stay server-only.

## Academies
- Any user can create a free academy from the Home screen banner ("Coach ho?..."). This gives them an **invite code**.
- Students enter that code on signup (optional field) → their `profile.academy_id` links to the academy.
- The academy owner gets an **Academy tab** with every linked student's batting/bowling/fielding average scores — completely free, no paywall, since academies are the main growth channel.
- Ads stay light for academy-linked free students (just the normal home banner) — non-academy free users see the full 2-ad flow below.

## Current plan/analysis behavior
- Free: video analysis with moving skeleton replay + basic ball tracking, plus 5 analyses/day.
- ₹99 AI Coach: full skeleton/angles, motion phases, compare, progress, 30-day plan and limited Gemini credits.
- ₹499 AI Coach Video: professional annotated replay with ball trajectory/release/bounce candidate markers and separate coaching-video credits.
- Live Speed Gun: phone-camera speed estimate; it is explicitly not a Doppler-radar measurement.

## Gemini video analysis
- Gemini is server-side only. Never expose the API key with a `VITE_` variable.
- Production billing should use a trusted backend credit transaction.

## What's real vs. still to build
- Real browser MediaPipe pose detection, rule-based biomechanics, DB coaching loop, local annotated replay, ball candidate tracking, motion-based phase selection, and Live Speed Gun UI are implemented in this source.
- Ball tracking is intentionally conservative: difficult footage may produce no ball path rather than a fake path.
- The current payment buttons still directly flip `plan_tier` for demo purposes; production must use Razorpay/UPI checkout + webhook.
- The current credit ledger is a prototype localStorage guard; move it to an atomic server-side DB transaction before launch.

## New Cricket AI Coach video layer
- Free/basic analysis samples many video frames and renders a moving MediaPipe skeleton replay locally.
- A lightweight ball candidate tracker adds a visible ball marker and trajectory when the ball is visually separable.
- Phase selection is motion-based rather than fixed first/middle/last timestamps.
- `Speed Gun` is a local phone-camera prototype and labels results as estimates, not Doppler radar readings.
- ₹99 is the AI Coach tier; ₹499 is the AI Coach Video tier. The schema includes separate Gemini and coaching-video credit buckets; production payment/webhook code should grant and consume those credits server-side.
- Prototype credit ledger: 3 annotated-video credits/month for Free and 3 professional-video credits/month for ₹499; production should replace localStorage with an atomic server-side credit transaction.
