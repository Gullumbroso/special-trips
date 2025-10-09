# Inngest + Redis Setup Guide

This guide walks you through setting up Upstash Redis and Inngest for the background job queue system.

## Prerequisites

- Vercel account (for deployment)
- Email address (for Upstash and Inngest sign-ups)

## Step 1: Set Up Upstash Redis (5 minutes)

1. **Sign up for Upstash**
   - Go to https://upstash.com
   - Click "Sign Up" and create an account (GitHub/Google/Email)

2. **Create a Redis Database**
   - Click "Create Database"
   - Choose a name (e.g., "special-trips")
   - Select region closest to your primary Vercel region (e.g., `us-east-1` for IAD)
   - Choose **Global** for better edge performance (optional but recommended)
   - Click "Create"

3. **Get Your Credentials**
   - On the database dashboard, scroll to "REST API" section
   - Copy `UPSTASH_REDIS_REST_URL`
   - Copy `UPSTASH_REDIS_REST_TOKEN`

4. **Add to Local Environment**
   ```bash
   # Add to .env.local
   UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token_here
   ```

5. **Add to Vercel Environment Variables**
   - Go to your Vercel project settings
   - Navigate to "Environment Variables"
   - Add both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   - Make sure they're available for all environments (Production, Preview, Development)

---

## Step 2: Set Up Inngest (5 minutes)

1. **Sign up for Inngest**
   - Go to https://inngest.com
   - Click "Sign Up" and create an account

2. **Create a New App**
   - After logging in, click "Create App"
   - Name it "special-trips"
   - Click "Create"

3. **Get Your Event Key**
   - Go to "Settings" → "Event Keys"
   - Copy the event key (starts with `evt_`)
   - Store it as `INNGEST_EVENT_KEY`

4. **Get Your Signing Key**
   - Go to "Settings" → "Signing Keys"
   - Click "Create Signing Key"
   - Copy the signing key (starts with `signkey_`)
   - Store it as `INNGEST_SIGNING_KEY`

5. **Add to Local Environment**
   ```bash
   # Add to .env.local
   INNGEST_EVENT_KEY=evt_your_key_here
   INNGEST_SIGNING_KEY=signkey_your_key_here
   ```

6. **Add to Vercel Environment Variables**
   - Go to your Vercel project settings
   - Navigate to "Environment Variables"
   - Add both `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`
   - Make sure they're available for all environments

---

## Step 3: Deploy to Vercel

1. **Push Your Code**
   ```bash
   git add .
   git commit -m "Add Inngest + Redis background job queue"
   git push
   ```

2. **Wait for Deployment**
   - Vercel will automatically deploy
   - Wait for deployment to complete
   - Note your production URL (e.g., `https://special-trips.vercel.app`)

---

## Step 4: Register Inngest Webhook (5 minutes)

1. **Get Your Inngest Endpoint URL**
   - Your Inngest endpoint is: `https://your-vercel-url.vercel.app/api/inngest`
   - Example: `https://special-trips.vercel.app/api/inngest`

2. **Register the Endpoint in Inngest**
   - Go to Inngest dashboard
   - Navigate to "Apps" → "special-trips"
   - Click "Manage" → "Endpoints"
   - Click "Add Endpoint"
   - Enter your URL: `https://your-vercel-url.vercel.app/api/inngest`
   - Click "Sync" to discover your function
   - You should see "generate-bundles" function appear

3. **Verify the Integration**
   - In Inngest dashboard, you should see:
     - ✅ Endpoint connected
     - ✅ Function "Generate Trip Bundles" discovered
     - ✅ Status: Active

---

## Step 5: Test the System

1. **Start Local Development**
   ```bash
   npm run dev
   ```

2. **Test Locally with Inngest Dev Server**
   ```bash
   # In a separate terminal
   npx inngest-cli@latest dev
   ```

   This starts a local Inngest dev server that:
   - Runs on `http://localhost:8288`
   - Provides a UI to see function executions
   - Works alongside your Next.js dev server

3. **Trigger a Bundle Generation**
   - Go to your app in browser
   - Complete the onboarding flow
   - Click "Generate Bundles"
   - Watch the Inngest dev UI (`http://localhost:8288`) to see the function execute

4. **Verify the Flow**
   - Check browser console for logs
   - Check Next.js terminal for API logs
   - Check Inngest dev UI for function execution
   - Redis should have session data (can verify in Upstash console → "Data Browser")

---

## Step 6: Test in Production

1. **Generate Bundles on Production**
   - Go to your production Vercel URL
   - Complete the onboarding
   - Generate bundles

2. **Monitor in Inngest Dashboard**
   - Go to Inngest dashboard
   - Click "Functions" → "Generate Trip Bundles"
   - You should see executions appearing in real-time
   - Click on an execution to see logs and status

3. **Verify Session Persistence**
   - During generation, refresh the page
   - You should see summaries restore from Redis
   - Generation continues in background
   - Completion happens even if you navigate away

---

## Troubleshooting

### Issue: "Session not found" errors
- Check Upstash Redis credentials are correct in Vercel
- Verify Redis instance is active (not paused)
- Check Vercel deployment logs for Redis connection errors

### Issue: "Function not executing"
- Verify Inngest endpoint is registered correctly
- Check Inngest signing key matches in Vercel env vars
- Look at Inngest dashboard for error messages
- Check Vercel function logs for `/api/inngest` route

### Issue: "Worker times out"
- Inngest has no timeout on free tier (should work)
- Check OpenAI API key is valid
- Look for errors in Inngest function execution logs

### Issue: "Polling never completes"
- Check if worker function is actually running (Inngest dashboard)
- Verify Redis session is being updated (Upstash data browser)
- Look for errors in browser console

---

## Architecture Summary

```
Client Request
    ↓
POST /api/generate-bundles (Edge Function, <1s)
    ↓
Creates session in Redis + Triggers Inngest
    ↓
Returns sessionId immediately
    ↓
Client starts polling GET /api/session/[id]

Meanwhile...

Inngest Worker (Background, no timeout)
    ↓
Streams from OpenAI (5-10 minutes)
    ↓
Writes summaries to Redis incrementally
    ↓
Writes final bundles to Redis
    ↓
Client polling detects completion → navigates to /bundles
```

---

## Free Tier Limits

### Upstash Redis
- **10,000 commands/day** (plenty for polling every 2s)
- **256 MB storage** (more than enough for sessions)
- **Global replication** (optional, costs extra)

### Inngest
- **1,000 function runs/month** (enough for testing and small usage)
- **Unlimited execution time**
- **100,000 steps/month**

### Upgrading
- Upstash: ~$0.20/100K commands beyond free tier
- Inngest: $20/month for 10K runs (pay-as-you-go available)

---

## Next Steps

Once everything is working:

1. **Monitor Usage**
   - Check Upstash dashboard for Redis usage
   - Check Inngest dashboard for function execution count
   - Both have generous free tiers

2. **Error Handling**
   - Inngest automatically retries failed functions
   - Check Inngest dashboard for failed executions
   - Redis TTL (1 hour) auto-cleans old sessions

3. **Performance**
   - Average generation time: 3-8 minutes
   - Polling overhead: ~1 request/2s = ~180 requests total
   - Well within free tier limits

---

## Support

- **Upstash Docs**: https://docs.upstash.com/redis
- **Inngest Docs**: https://www.inngest.com/docs
- **Vercel Docs**: https://vercel.com/docs

Happy coding! 🚀
