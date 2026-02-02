# Production Deployment Guide (Vercel)

This guide walks you through deploying the `cryo-supernova` (CLICR SaaS) application to Vercel.

## 1. Prerequisites (Fixed)
I have fixed the build errors in the application:
- **Server Actions**: Moved sensitive logic (database/fs) to `app/actions` to strictly enforce server-side execution.
- **Onboarding Page**: Fixed a type error where `createVenue` was being used (it is named `addVenue` in the store).
- **Environment**: Your `.env.local` is configured for development.

## 2. Push to GitHub
If you haven't already, push your code to a GitHub repository:
1. Initialize git: `git init` (already done)
2. Add remote: `git remote add origin https://github.com/YOUR_USERNAME/clicr-app.git`
3. Commit & Push:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push -u origin main
   ```

## 3. Deploy on Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** > **"Project"**.
3. Import your Git repository.
4. **Configure Project**:
   - **Framework Preset**: Next.js (Auto-detected).
   - **Root Directory**: `./` (Default).
   - **Environment Variables**:
     You MUST add these in the Vercel dashboard:
     - `NEXT_PUBLIC_SUPABASE_URL`: (Your URL)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Your Key)
     - `RESEND_API_KEY`: (Your Resend Key)

5. Click **"Deploy"**.

## 4. Post-Deployment Checks
- **Supabase Connectivity**: Ensure your Supabase project is active and accessible from Vercel's IP range (usually open 0.0.0.0/0 for SaaS).
- **Email**: Test the support form to ensure Resend works in production.
- **Database**: Since we are using a local JSON file for the *mock* DB in development (which won't persist on Vercel serverless functions), you **MUST** ensure you are using the Supabase integration for production data.
   - *Note*: Currently, `lib/db.ts` writes to a local JSON file. **This will not work for long-term storage on Vercel.**
   - **Recommendation**: Before "Launch", we need to fully swap `lib/db.ts` to read/write ONLY from Supabase, removing the JSON file fallbacks.

## 5. Verification
Once deployed, visit your `https://your-project.vercel.app` URL and log in!
