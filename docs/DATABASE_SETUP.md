# Database Setup Guide

This project uses Supabase (via Vercel integration) to store generation state and enable resilient bundle generation.

## Prerequisites

- Vercel account (free tier works fine)
- Project deployed to Vercel or linked via Vercel CLI

## Setup Steps

### 1. Create Supabase Database via Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to the "Storage" tab
4. Click "Create Database"
5. Select **"Supabase"** (under "Managed by Partner")
6. Choose a database name (e.g., `special-trips-db`)
7. Select your region (choose closest to your users)
8. Click "Create"

Vercel will:
- Create a Supabase project for you automatically
- Set up the integration
- Add environment variables to your Vercel project

### 2. Get Database Connection String

**Option A: From Vercel Dashboard (Recommended)**
1. After creation, click on your database in Vercel Storage tab
2. Look for "Connection String" section
3. Copy the `DATABASE_URL` value

**Option B: From Supabase Dashboard**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Find your project (it will have the same name you chose in Vercel)
3. Go to Project Settings → Database
4. Under "Connection String", select "Connection Pooling" tab
5. Copy the connection string (it uses port 6543 with pgbouncer)

### 3. Add to Your Local Environment

**For local development:**

1. Create a `.env.local` file in the project root:
   ```bash
   cp .env.example .env.local
   ```

2. Add your environment variables:
   ```bash
   # Required for database access
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true

   # Required for OpenAI
   OPENAI_API_KEY=sk-proj-...
   ```

3. Get your database password:
   - If you created via Vercel: Check Vercel Dashboard → Storage → Your Database → Settings
   - If you need to reset it: Supabase Dashboard → Project Settings → Database → Reset Password

**For production (Vercel):**
- Environment variables are automatically added when you create the database via Vercel integration
- Verify in: Vercel Project → Settings → Environment Variables

### 4. Run Database Migration

Push the schema to your database:

```bash
npm run db:push
```

This will create the `generations` table in your Supabase database.

You should see output like:
```
✓ Pushing schema changes to database
✓ Executing SQL statements...
✓ Table "generations" created successfully
```

### 5. Verify Setup

**Option A: Using Drizzle Studio (Recommended)**

```bash
npm run db:studio
```

This opens a web UI at `https://local.drizzle.studio` where you can:
- View your database schema
- Inspect the `generations` table
- Run queries

**Option B: Using Supabase Dashboard**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to "Table Editor" in the sidebar
4. You should see the `generations` table

**Option C: Using SQL Editor**

In Supabase Dashboard → SQL Editor, run:
```sql
SELECT * FROM generations LIMIT 5;
```

## Database Schema

The `generations` table stores:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier (auto-generated) |
| `status` | TEXT | Current status: `pending`, `processing`, `completed`, or `failed` |
| `preferences` | JSONB | User preferences (interests, music, timeframe, etc.) |
| `bundles` | JSONB | Generated trip bundles (only when completed) |
| `openaiResponseId` | TEXT | OpenAI response ID for fetching reasoning summaries |
| `error` | TEXT | Error message if generation failed |
| `createdAt` | TIMESTAMP | When the generation was created |
| `updatedAt` | TIMESTAMP | When the generation was last updated |
| `expiresAt` | TIMESTAMP | When the generation record expires (24 hours after creation) |

## Troubleshooting

### Connection Errors

**Issue**: "Failed to connect to database" or "Connection refused"

**Solutions**:
1. **Check DATABASE_URL format**: It should use port `6543` (connection pooling) not `5432`
   ```
   ✅ Good: postgresql://postgres:password@ref.supabase.co:6543/postgres?pgbouncer=true
   ❌ Bad:  postgresql://postgres:password@ref.supabase.co:5432/postgres
   ```

2. **Verify password**: Your Supabase database password should be correct
   - Find it in Vercel Dashboard → Storage → Database → Settings
   - Or reset it in Supabase Dashboard → Project Settings → Database

3. **Check database is active**: Go to Supabase Dashboard and verify project is not paused

4. **Network issues**: Ensure your IP is allowed (Supabase allows all IPs by default)

### Schema Not Created

**Issue**: Table doesn't exist after running `db:push`

**Solutions**:
1. Check the console output for errors
2. Verify your `DATABASE_URL` is correct in `.env.local`
3. Try running with verbose output:
   ```bash
   npm run db:push -- --verbose
   ```
4. Manually create via Supabase SQL Editor:
   ```sql
   -- Run this in Supabase Dashboard → SQL Editor
   CREATE TABLE IF NOT EXISTS generations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     status TEXT NOT NULL DEFAULT 'pending',
     preferences JSONB NOT NULL,
     bundles JSONB,
     openai_response_id TEXT,
     error TEXT,
     created_at TIMESTAMP NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
     expires_at TIMESTAMP NOT NULL
   );
   ```

### Local Development vs Production

**Issue**: Works locally but not in production (or vice versa)

**Check**:
1. **Local**: Verify `.env.local` has `DATABASE_URL`
2. **Production**: Verify Vercel Environment Variables are set
   - Go to Vercel → Project → Settings → Environment Variables
   - Should see `DATABASE_URL` auto-added by Supabase integration
3. **Both environments should use the SAME database** (or create separate databases for dev/prod)

### Cleanup Old Data

Generations expire after 24 hours automatically. To manually clean up:

**Using Drizzle Studio**:
```bash
npm run db:studio
# Filter generations where expires_at < now
# Delete rows manually
```

**Using Supabase Dashboard SQL Editor**:
```sql
DELETE FROM generations WHERE expires_at < NOW();
```

**Using a Cron Job** (recommended for production):
See DEPLOYMENT_GUIDE.md for setting up automated cleanup.

## Supabase Features You Can Use

### 1. Real-time Subscriptions (Future Enhancement)

Supabase supports real-time database changes. Instead of polling, you could use:

```typescript
// Listen for generation updates in real-time
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...)
supabase
  .channel('generations')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'generations',
    filter: `id=eq.${generationId}`
  }, (payload) => {
    // Update UI instantly when generation completes
  })
  .subscribe()
```

### 2. Row Level Security (RLS)

When you add user authentication, enable RLS:

```sql
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own generations"
ON generations FOR SELECT
USING (auth.uid() = user_id);
```

### 3. Database Backups

Supabase (free tier) includes:
- Daily backups (retained for 7 days)
- Point-in-time recovery (paid plans)

Access via: Supabase Dashboard → Database → Backups

### 4. Monitoring

View database metrics:
- Supabase Dashboard → Database → Logs
- Query performance
- Connection pooling stats

## Next Steps

After setup:

1. ✅ Run `npm run db:push` to create schema
2. ✅ Verify table exists in Drizzle Studio or Supabase
3. ✅ Test locally with `npm run dev`
4. ✅ Deploy to Vercel
5. ✅ Verify production environment variables

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Drizzle ORM with Supabase](https://orm.drizzle.team/docs/get-started-postgresql#supabase)
- [Vercel Supabase Integration](https://vercel.com/docs/storage/vercel-postgres)

## Support

If you encounter issues:
1. Check Supabase Dashboard → Database → Logs for errors
2. Verify connection string format (port 6543 with pgbouncer)
3. Test connection with: `npm run db:studio`
4. Check Vercel deployment logs for database errors
