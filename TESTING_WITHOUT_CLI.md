# Testing Without Inngest CLI

Since the Inngest CLI can't be installed due to network issues, we can test using production Inngest directly or verify components separately.

## Option 1: Test with Production Inngest (Recommended)

You can deploy to Vercel and register the webhook with Inngest Cloud, then test in production.

### Steps:

1. **Deploy to Vercel First**
   ```bash
   git add .
   git commit -m "Add Inngest + Redis background jobs"
   git push
   ```

2. **Add Environment Variables to Vercel**
   - Go to Vercel project → Settings → Environment Variables
   - Add all 4 Inngest/Redis variables from `.env.local`

3. **Register Webhook in Inngest Dashboard**
   - Go to https://app.inngest.com
   - Navigate to your app → Endpoints
   - Click "Add Endpoint"
   - Enter: `https://special-trips.vercel.app/api/inngest`
   - Click "Sync"
   - Should discover "generate-bundles" function

4. **Test in Production**
   - Go to your Vercel URL
   - Complete onboarding
   - Generate bundles
   - Watch Inngest dashboard for execution

---

## Option 2: Component Testing (Without Full Integration)

Test individual pieces to verify they work:

### Test 1: Verify API Routes Work

```bash
# Start Next.js dev server
npm run dev

# In another terminal, test the endpoints
curl http://localhost:3000/api/inngest
```

Expected: Should return JSON with Inngest configuration (not an error)

### Test 2: Test Direct Worker Function

Create a test file to run the worker logic directly:

**Create: `test-worker.js`**
```javascript
import { generateBundles } from './src/lib/inngest/functions.js';

// Simulate Inngest event
const mockEvent = {
  event: {
    data: {
      sessionId: 'test-session-123',
      preferences: {
        interests: ['concerts', 'culinary'],
        musicProfile: 'Indie Rock, Electronic',
        timeframe: 'April 2025',
        otherPreferences: 'Budget friendly'
      }
    }
  }
};

console.log('🧪 Testing worker function directly...\n');

// Run the function
generateBundles.fn(mockEvent)
  .then(() => {
    console.log('\n✅ Worker completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Worker failed:', error);
    process.exit(1);
  });
```

**Run it:**
```bash
npx tsx test-worker.js
```

This will test the OpenAI streaming logic directly without Inngest.

### Test 3: Verify Redis Operations

```bash
# Create test-session.js
cat > test-session.js << 'EOF'
import { createSession, getSession, addSessionSummary, completeSession } from './src/lib/redis.js';

async function testRedisOperations() {
  const testSessionId = 'test-' + Date.now();

  console.log('🧪 Testing Redis session operations...\n');

  // Test 1: Create session
  console.log('1. Creating session...');
  await createSession(testSessionId);

  // Test 2: Get session
  console.log('2. Reading session...');
  const session1 = await getSession(testSessionId);
  console.log('   Status:', session1.status);
  console.log('   Summaries:', session1.summaries.length);

  // Test 3: Add summaries
  console.log('3. Adding summaries...');
  await addSessionSummary(testSessionId, 'Test summary 1');
  await addSessionSummary(testSessionId, 'Test summary 2');

  const session2 = await getSession(testSessionId);
  console.log('   Summaries count:', session2.summaries.length);

  // Test 4: Complete session
  console.log('4. Completing session...');
  const mockBundles = [{ city: 'Test City', title: 'Test Bundle' }];
  await completeSession(testSessionId, mockBundles);

  const session3 = await getSession(testSessionId);
  console.log('   Status:', session3.status);
  console.log('   Bundles count:', session3.bundles.length);

  console.log('\n✅ All Redis operations work!\n');
}

testRedisOperations().catch(console.error);
EOF

npx tsx test-session.js
```

---

## Option 3: Simplified Testing Flow

Skip Inngest CLI and just verify the application flow:

### Steps:

1. **Start Next.js Dev Server**
   ```bash
   npm run dev
   ```

2. **Check Inngest Endpoint**
   - Go to: http://localhost:3000/api/inngest
   - Should see JSON (not error page)

3. **Test Generation Flow**
   - Complete onboarding
   - Click generate bundles
   - Watch browser console

4. **Monitor Logs**
   - Browser console: Should see session creation and polling
   - Server terminal: Should see API calls
   - **Note:** Worker won't execute locally without CLI, but you can see it fail gracefully

5. **Check Inngest Cloud Dashboard**
   - Even locally, Inngest may receive the event trigger
   - Go to https://app.inngest.com → Events
   - Check if `bundle.generate` event was received
   - It won't execute until webhook is registered

---

## Option 4: Skip Local Testing, Go Straight to Production

Given the CLI issues, the fastest path is:

### Quick Deploy Path:

1. **Commit and Push**
   ```bash
   git add .
   git commit -m "Add Inngest + Redis background jobs"
   git push
   ```

2. **Add Vercel Environment Variables**
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `INNGEST_EVENT_KEY`
   - `INNGEST_SIGNING_KEY`

3. **Wait for Deployment**
   - Vercel will build and deploy

4. **Register Inngest Webhook**
   - Inngest Dashboard → Add Endpoint
   - URL: `https://special-trips.vercel.app/api/inngest`
   - Click Sync

5. **Test in Production**
   - Go to your Vercel URL
   - Complete onboarding
   - Generate bundles
   - Monitor Inngest dashboard for execution

### Monitoring in Production:

- **Inngest Dashboard:** https://app.inngest.com
  - See function executions in real-time
  - View detailed logs
  - Check for errors

- **Vercel Logs:**
  - Go to Vercel project → Functions
  - Click on `/api/inngest` function
  - See invocation logs

- **Upstash Dashboard:**
  - Go to Data Browser
  - See session data being created

---

## Recommended Approach

**Given your network situation, I recommend Option 4 (Deploy to Production)**

Reasons:
1. Inngest CLI isn't essential - it's just a nice-to-have dev tool
2. Testing in production will work exactly the same
3. You'll get the same monitoring via Inngest Cloud dashboard
4. Faster to verify everything works

**After production testing succeeds, you can troubleshoot the CLI network issue separately if needed.**

---

## If You Want to Debug CLI Issue

The error suggests DNS resolution failure for `cli.inngest.com`. Possible causes:

1. **VPN/Proxy:** Are you behind a corporate VPN/proxy?
2. **Firewall:** Is something blocking Inngest domains?
3. **DNS:** Try alternative DNS (8.8.8.8, 1.1.1.1)

**Quick DNS test:**
```bash
# Try pinging Inngest
ping cli.inngest.com

# If that fails, try changing DNS temporarily
# macOS: System Settings → Network → DNS Servers
```

But honestly, deploying to production is faster than debugging this! 🚀

---

## What to Do Next?

I recommend:

**Option A (Fastest):** Deploy to Vercel now, test in production
**Option B (Thorough):** Run component tests (Redis, API routes) locally first
**Option C (Debug):** Fix network/DNS issue, then use CLI

Which would you like to do?
