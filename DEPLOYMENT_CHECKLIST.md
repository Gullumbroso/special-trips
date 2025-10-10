# Deployment Checklist - OpenAI Background Mode Migration

## Pre-Deployment Steps

### 1. Environment Variables (Vercel Dashboard)

**REMOVE these variables:**
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`
- [ ] `INNGEST_EVENT_KEY`
- [ ] `INNGEST_SIGNING_KEY`

**KEEP these variables:**
- [ ] `OPENAI_API_KEY` (required)
- [ ] `OPENGRAPH_API_KEY` (required)

### 2. Local Environment

**Update `.env.local`:**
- [ ] Remove the 4 Redis/Inngest variables
- [ ] Ensure `OPENAI_API_KEY` is present
- [ ] Ensure `OPENGRAPH_API_KEY` is present

### 3. External Services Cleanup

**Upstash:**
- [ ] Delete Redis database (or keep for other projects)

**Inngest:**
- [ ] Delete the `special-trips` app/functions
- [ ] Or unregister webhook from project

**Vercel Integrations:**
- [ ] Remove Inngest integration (if installed)
- [ ] Remove Upstash integration (if installed)

## Deployment Steps

### 1. Build Verification
```bash
npm run build
```
- [ ] Build succeeds
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Routes show: `/api/openai/responses/[id]` (new)
- [ ] Routes DO NOT show: `/api/inngest`, `/api/session/[id]` (old, deleted)

### 2. Deploy to Vercel
```bash
git add .
git commit -m "Migrate to OpenAI Background Mode - eliminate Redis/Inngest"
git push
```

### 3. Monitor Deployment
- [ ] Check Vercel deployment logs
- [ ] Ensure no build errors
- [ ] Verify environment variables are set

## Post-Deployment Testing

### 1. Fresh Generation Test
- [ ] Clear localStorage: `localStorage.clear()`
- [ ] Navigate to `/interests`
- [ ] Complete preferences flow
- [ ] Verify generation starts
- [ ] Monitor browser console for logs
- [ ] Check reasoning summaries appear
- [ ] Verify bundles load after completion
- [ ] Navigate to `/bundles` successfully

**Expected Console Logs:**
```
[API] Starting background OpenAI response generation
[API] Created background response resp_abc123 with status: queued
✅ Generation started with response ID: resp_abc123
⏳ Starting polling...
📊 Response status: in_progress
[OpenAI Proxy] Found X reasoning summaries
✅ Generation complete!
```

### 2. Resume Test (Page Refresh)
- [ ] Start a generation
- [ ] Wait for 2-3 summaries to appear
- [ ] Refresh the page
- [ ] Verify summaries are restored
- [ ] Verify polling resumes
- [ ] Verify generation completes

**Expected Console Logs:**
```
🔍 Checking OpenAI response resp_abc123
📊 Response status: in_progress
🔄 Resuming response (in_progress) with X summaries
⏳ Starting polling...
```

### 3. Function Calling Test
- [ ] Complete a full generation
- [ ] Open `/bundles`
- [ ] Click on a bundle
- [ ] Verify event images are displayed
- [ ] Check that OpenGraph images loaded successfully

### 4. Error Handling Test
- [ ] Simulate network error (disable internet mid-generation)
- [ ] Verify polling continues when reconnected
- [ ] Check error states are handled gracefully

### 5. Multiple Tabs Test
- [ ] Open app in two browser tabs
- [ ] Complete flow in Tab 1
- [ ] Switch to Tab 2
- [ ] Verify Tab 2 shows cached bundles
- [ ] Clear localStorage in Tab 2
- [ ] Start new generation in Tab 2
- [ ] Verify Tab 1 and Tab 2 are independent

## Monitoring

### Vercel Logs to Watch
- [ ] Monitor `/api/generate-bundles` - should return immediately
- [ ] Monitor `/api/openai/responses/[id]` - should poll every 5 seconds
- [ ] Check for NO timeout errors (300s limit)
- [ ] Verify NO Redis connection errors
- [ ] Verify NO Inngest retry errors

### Expected Improvements
- [ ] ✅ No Vercel timeout errors (previous: 31 instances)
- [ ] ✅ No infinite retry loops (previous: 5 retries × 15 summaries = 75 summaries)
- [ ] ✅ No Redis ECONNRESET errors
- [ ] ✅ Faster API responses (<100ms instead of 5-10 minutes)
- [ ] ✅ Simplified error logs

## Rollback Plan

If critical issues occur:

```bash
# 1. Find the last working commit before migration
git log --oneline | grep -B 5 "Migrate to OpenAI Background Mode"

# 2. Revert to that commit
git revert <commit-hash>

# 3. Reinstall old packages
npm install inngest @upstash/redis

# 4. Re-add environment variables in Vercel
# UPSTASH_REDIS_REST_URL
# UPSTASH_REDIS_REST_TOKEN
# INNGEST_EVENT_KEY
# INNGEST_SIGNING_KEY

# 5. Redeploy
git push
```

## Success Criteria

### Performance
- [ ] Generation completes in 5-10 minutes
- [ ] No timeout errors
- [ ] API responses < 500ms
- [ ] Polling works reliably

### Functionality
- [ ] Reasoning summaries display correctly
- [ ] Bundles load successfully
- [ ] Function calling (images) works
- [ ] Page refresh resumes correctly
- [ ] Error states handled gracefully

### Code Quality
- [ ] ~340 lines of code removed
- [ ] 2 packages removed (167 npm packages)
- [ ] 2 services eliminated (Redis, Inngest)
- [ ] Build time maintained (~4s)
- [ ] Bundle size reduced

## Notes

### Architecture Change
**Before:** Client → Vercel API → Inngest → Worker (timeout at 300s) → Redis → Client polling
**After:** Client → Vercel API → OpenAI Background Mode → Client polling

### Key Benefits
1. **No timeouts** - OpenAI handles long tasks
2. **No retries** - Task completes successfully
3. **No Redis** - OpenAI stores state
4. **Simpler code** - Single API call
5. **Lower costs** - No external services

### Security
- OpenAI API key stays server-side
- Response IDs are safe to expose to client
- No changes to authentication/authorization

### User Experience
- Same polling pattern (5-second intervals)
- Same reasoning summaries display
- Same bundles navigation
- No visible changes to UX

## Contact

If issues arise:
- Check Vercel logs: https://vercel.com/[your-project]/logs
- Check OpenAI dashboard: https://platform.openai.com/
- Review migration docs: `/docs/apis/MIGRATION_TO_BACKGROUND_MODE.md`
