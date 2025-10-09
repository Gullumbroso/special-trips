# Local Testing Plan - Inngest + Redis Background Jobs

This document provides a comprehensive test plan to verify all flows work correctly before deploying to production.

---

## Prerequisites

Before starting, ensure:
- ✅ `.env.local` has all required environment variables
- ✅ Redis connection tested successfully
- ✅ No existing bundles in localStorage (clear browser data if needed)

---

## Setup: Start Both Servers

### Terminal 1: Next.js Dev Server
```bash
npm run dev
```

Expected output:
```
▲ Next.js 15.5.4
- Local:        http://localhost:3000
✓ Starting...
✓ Ready in 2.5s
```

### Terminal 2: Inngest Dev Server
```bash
npx inngest-cli@latest dev
```

Expected output:
```
Inngest Dev Server running at:
  http://localhost:8288

Functions discovered:
  ✓ generate-bundles (Generate Trip Bundles)
```

**Keep both terminals running during all tests!**

---

## Test Flow 1: Fresh Bundle Generation (Happy Path)

**Goal:** Verify the complete end-to-end flow works correctly.

### Steps:

1. **Clear Browser Data**
   - Open browser DevTools (F12)
   - Go to Application → Storage → Clear site data
   - This ensures clean state (no cached sessionId or bundles)

2. **Start Onboarding**
   - Go to `http://localhost:3000`
   - Should see welcome page

3. **Complete Onboarding Form**
   - Select 2-3 interests (e.g., Concerts, Sports, Culinary)
   - Skip Spotify or connect (your choice)
   - Enter music taste manually if skipping (e.g., "Indie Rock, Electronic")
   - Enter timeframe (e.g., "April 2025")
   - Click continue

4. **Trigger Bundle Generation**
   - Should land on `/loading_bundles` page
   - Should see:
     - "Working on it..." heading
     - Spinning loader
     - "This might take a few minutes" message

5. **Monitor Browser Console**
   ```
   Expected logs (in order):
   ✅ 🔍 Checking session {sessionId}
   ✅ 🆕 Creating new session
   ✅ ✅ Generation started
   ✅ ⏳ Starting polling...
   ```

6. **Monitor Inngest Dev Server (http://localhost:8288)**
   - Go to Inngest UI in browser
   - Should see "generate-bundles" function execution start
   - Status should show "Running"

7. **Watch Loading Page**
   - Summaries should start appearing (bolded text)
   - Each new summary should fade in at the top
   - Older summaries should become faded (25% opacity)
   - Examples:
     - "Analyzing user preferences and interests"
     - "Searching for events in April 2025"
     - "Finding concerts matching Indie Rock taste"

8. **Monitor Polling Logs**
   ```
   Browser console should show every 2 seconds:
   Polling... (implicit in fetch calls)

   Eventually:
   ✅ Generation complete!
   ```

9. **Verify Completion**
   - After 3-10 minutes (depending on OpenAI API speed)
   - Should automatically navigate to `/bundles`
   - Should see generated trip bundles
   - Each bundle should have:
     - City name
     - Date range
     - Bundle title and description
     - Key events with images

10. **Check Inngest Dev Server**
    - Go back to `http://localhost:8288`
    - Function execution should show "Completed" status
    - Click on the execution to see detailed logs
    - Should see:
      - Summary events being written
      - Image fetching logs
      - Final completion message

11. **Verify Redis (Optional)**
    - Go to Upstash dashboard → Data Browser
    - Search for `session:{your-sessionId}`
    - Should see session data with status: "complete"

### Expected Results:
- ✅ Session created in Redis
- ✅ Inngest worker executed successfully
- ✅ Summaries appeared in real-time on loading page
- ✅ Bundles generated and displayed
- ✅ Bundles saved to localStorage
- ✅ No errors in browser console or server logs

---

## Test Flow 2: Resume After Page Refresh

**Goal:** Verify session persistence and resume functionality.

### Steps:

1. **Start Fresh Generation**
   - Clear browser data
   - Complete onboarding
   - Trigger bundle generation
   - Loading page should appear

2. **Wait for 2-3 Summaries**
   - Let generation run for ~30-60 seconds
   - Should see 2-3 reasoning summaries appear

3. **Refresh the Page (F5 or Cmd+R)**
   - Browser will reload

4. **Verify Resume Behavior**
   - Should land back on `/loading_bundles`
   - Previous summaries should restore from Redis
   - Should see:
     ```
     Browser console:
     🔍 Checking session {sessionId}
     📊 Session status: generating
     🔄 Resuming session with X summaries
     ⏳ Starting polling...
     ```

5. **Watch for New Summaries**
   - New summaries should continue appearing
   - Generation should complete normally
   - Should navigate to `/bundles` when done

### Expected Results:
- ✅ SessionId persisted in localStorage
- ✅ Previous summaries restored from Redis
- ✅ Polling resumed seamlessly
- ✅ Generation completed successfully
- ✅ No duplicate function executions in Inngest

---

## Test Flow 3: Return to Completed Bundles

**Goal:** Verify localStorage caching works correctly.

### Steps:

1. **Complete a Generation**
   - Follow Test Flow 1 until bundles are displayed on `/bundles`
   - Verify bundles are showing correctly

2. **Navigate Away**
   - Click browser back button or manually go to `http://localhost:3000`
   - Go to homepage

3. **Try to Navigate Back to Loading Page**
   - Manually go to `http://localhost:3000/loading_bundles`

4. **Verify Immediate Redirect**
   - Should immediately redirect to `/bundles`
   - Should NOT show loading screen
   - Should see:
     ```
     Browser console:
     ✅ Bundles already cached, navigating to /bundles
     ```

5. **Verify Bundles Load from localStorage**
   - Bundles should appear instantly (no API call)
   - Same bundles as before

### Expected Results:
- ✅ Bundles loaded from localStorage
- ✅ No unnecessary API calls to Redis
- ✅ Immediate navigation to bundles page
- ✅ No new Inngest function executions

---

## Test Flow 4: Session Expiry (After 1 Hour)

**Goal:** Verify TTL cleanup works correctly.

**Note:** This test requires waiting 1 hour or manually deleting Redis key.

### Option A: Wait 1 Hour
1. Complete a generation
2. Wait 1 hour
3. Try to refresh `/loading_bundles`
4. Should create new session (Redis key expired)

### Option B: Manual Test (Faster)
1. Complete a generation
2. Go to Upstash dashboard → Data Browser
3. Find and delete `session:{sessionId}` key
4. Clear localStorage in browser DevTools
5. Go to `/loading_bundles`
6. Should start fresh generation

### Expected Results:
- ✅ Old session cleaned up (automatically or manually)
- ✅ New session created when needed
- ✅ No stale data issues

---

## Test Flow 5: Error Handling

**Goal:** Verify error states are handled gracefully.

### Test 5A: OpenAI API Error

1. **Temporarily Break OpenAI Key**
   - Edit `.env.local`
   - Change `OPENAI_API_KEY` to invalid value
   - Restart Next.js dev server (Terminal 1)

2. **Trigger Generation**
   - Complete onboarding
   - Should start generation normally

3. **Verify Error Handling**
   - Inngest function should fail
   - Check Inngest dev UI for error details
   - Session in Redis should have status: "error"

4. **Restore OpenAI Key**
   - Fix `.env.local`
   - Restart dev server

### Test 5B: Redis Connection Error

1. **Temporarily Break Redis Token**
   - Edit `.env.local`
   - Change `UPSTASH_REDIS_REST_TOKEN` to invalid value
   - Restart dev server

2. **Trigger Generation**
   - Should get error when trying to create session
   - Check browser console for errors

3. **Restore Redis Token**
   - Fix `.env.local`
   - Restart dev server

### Expected Results:
- ✅ Errors logged clearly in console
- ✅ User sees error page (not infinite loading)
- ✅ Inngest shows failure reason in dev UI
- ✅ System recovers when credentials fixed

---

## Test Flow 6: Multiple Concurrent Sessions

**Goal:** Verify multiple users can generate bundles simultaneously.

### Steps:

1. **Open Two Browser Windows**
   - Window 1: Chrome
   - Window 2: Chrome Incognito (or different browser)

2. **Start Generation in Both**
   - Complete onboarding in Window 1
   - Start generation in Window 1
   - Switch to Window 2
   - Complete onboarding in Window 2
   - Start generation in Window 2

3. **Monitor Inngest Dev UI**
   - Should see TWO separate function executions
   - Both should run concurrently
   - Each should have different sessionId

4. **Verify Both Complete**
   - Both loading pages should work independently
   - Both should show their own summaries
   - Both should complete successfully

### Expected Results:
- ✅ Two separate sessions created
- ✅ Two Inngest workers running in parallel
- ✅ No session ID collision
- ✅ Both complete independently

---

## Monitoring Checklist

During all tests, watch for:

### Browser Console (`F12 → Console`)
- ✅ No errors (red messages)
- ✅ Proper log flow (sessionId, polling, completion)
- ✅ Clear state transitions

### Next.js Server (Terminal 1)
- ✅ No compilation errors
- ✅ API routes responding (200 status codes)
- ✅ Logs showing Redis operations

### Inngest Dev Server (Terminal 2)
- ✅ Functions discovered on startup
- ✅ Executions appearing when triggered
- ✅ Detailed logs available for each execution
- ✅ "Completed" status for successful runs

### Inngest Dev UI (`http://localhost:8288`)
- ✅ Function list shows "generate-bundles"
- ✅ Executions list shows recent runs
- ✅ Click execution → see full event payload
- ✅ Step-by-step logs visible

### Upstash Dashboard (Optional)
- ✅ Redis commands counter increasing
- ✅ Session data visible in Data Browser
- ✅ No connection errors

---

## Success Criteria

All tests pass if:

1. ✅ **Happy Path Works**
   - Fresh generation completes successfully
   - Bundles display correctly
   - Summaries appear in real-time

2. ✅ **Resume Works**
   - Page refresh doesn't break generation
   - Summaries restore from Redis
   - Generation continues to completion

3. ✅ **Caching Works**
   - Completed bundles load from localStorage
   - No unnecessary API calls
   - Immediate navigation

4. ✅ **Error Handling Works**
   - API errors don't cause infinite loading
   - Clear error messages shown
   - System recovers when fixed

5. ✅ **No Resource Leaks**
   - Redis sessions expire properly
   - LocalStorage doesn't grow unbounded
   - Inngest functions complete (not stuck)

6. ✅ **Performance Acceptable**
   - Generation completes in 3-10 minutes
   - Summaries appear smoothly (no lag)
   - Page navigation instant

---

## Troubleshooting

### Issue: Inngest dev server won't start
```bash
# Kill any existing Inngest processes
pkill -f inngest

# Try again
npx inngest-cli@latest dev
```

### Issue: No functions discovered in Inngest
```bash
# Restart Next.js dev server
# Restart Inngest dev server
# Check /api/inngest route loads: http://localhost:3000/api/inngest
```

### Issue: Summaries not appearing
- Check Inngest dev UI - is function running?
- Check Redis - is session being updated?
- Check browser console - is polling working?

### Issue: Generation takes too long (>15 minutes)
- Check OpenAI API status
- Check Inngest logs for errors
- Verify OpenGraph API is responding

---

## After Testing

Once all flows pass:

1. ✅ Document any issues found
2. ✅ Clear test data:
   - Clear browser localStorage
   - Delete test sessions from Redis (optional)
3. ✅ Ready to deploy to Vercel!

---

## Quick Test Checklist

For fast verification:

- [ ] Start both dev servers
- [ ] Clear browser data
- [ ] Complete onboarding
- [ ] Generate bundles
- [ ] Wait for 2-3 summaries
- [ ] Refresh page (should resume)
- [ ] Wait for completion
- [ ] Navigate to /loading_bundles again (should redirect)
- [ ] Check Inngest UI (should show completed execution)
- [ ] ✅ All working? Ready to deploy!
