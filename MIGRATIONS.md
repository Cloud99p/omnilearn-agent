# Database Migrations Guide

**Tool:** Drizzle ORM  
**Database:** PostgreSQL (Supabase)  
**Dialect:** PostgreSQL

---

## Quick Reference

```bash
# Generate migration files from schema changes
pnpm run db:generate

# Apply migrations to database (production-safe)
pnpm run db:migrate

# Push schema directly (development only, NOT migration-based)
pnpm run db:push

# Force push schema (DANGEROUS - can drop columns)
pnpm run db:push-force

# Open database GUI (Drizzle Studio)
pnpm run db:studio
```

---

## Workflow

### 1. Make Schema Changes

Edit schema files in `lib/db/src/schema/`:

```typescript
// lib/db/src/schema/users.ts
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // Add new field
  updatedAt: timestamp("updated_at").defaultNow(), // NEW FIELD
});
```

### 2. Generate Migration

```bash
pnpm run db:generate
```

This creates a migration file in `lib/db/drizzle/meta/`:

```
lib/db/drizzle/
├── 0000_initial.sql
├── 0001_add_updated_at.sql  ← NEW MIGRATION
└── meta/
    ├── 0000_snapshot.json
    └── 0001_snapshot.json
```

### 3. Review Migration

Check the generated SQL:

```bash
cat lib/db/drizzle/0001_add_updated_at.sql
```

Expected output:

```sql
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now();
```

### 4. Test Locally (Optional)

```bash
# Test migration on local database
DATABASE_URL=postgresql://localhost:5432/omnilearn pnpm run db:migrate
```

### 5. Deploy to Production

**Option A: Manual deployment (recommended for first time)**

```bash
# Connect to Supabase and run migration
psql $DATABASE_URL < lib/db/drizzle/0001_add_updated_at.sql
```

**Option B: Automated (Railway deployment)**

Add to Railway deployment:

```bash
pnpm run db:migrate
```

Or use Railway's startup command:

```bash
pnpm run db:migrate && node dist/index.js
```

---

## Migration vs Push

| Command                      | Use Case               | Safe for Production?  |
| ---------------------------- | ---------------------- | --------------------- |
| `db:generate` + `db:migrate` | Production deployments | ✅ YES                |
| `db:push`                    | Local development only | ❌ NO (can drop data) |
| `db:push-force`              | Reset local database   | ❌❌ DANGEROUS        |

**Rule of thumb:**

- **Development:** Use `db:push` for rapid iteration
- **Production:** Always use `db:generate` + `db:migrate`

---

## Common Operations

### Add a Column

```typescript
// Schema
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"), // NEW
});

// Generate migration
pnpm run db:generate

// Apply
pnpm run db:migrate
```

### Remove a Column

```typescript
// Schema - remove field
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  // name: text("name"), // REMOVED
});

// Generate migration
pnpm run db:generate

// Review carefully - this will DROP COLUMN!
cat lib/db/drizzle/xxxx.sql

// Apply
pnpm run db:migrate
```

### Create a New Table

```typescript
// lib/db/src/schema/conversations.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Generate migration
pnpm run db:generate

// Apply
pnpm run db:migrate
```

### Add an Index

```typescript
// Schema
import { index } from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId), // NEW INDEX
}));

// Generate migration
pnpm run db:generate

// Apply
pnpm run db:migrate
```

---

## Rollback Migrations

Drizzle doesn't support automatic rollback. To rollback:

### 1. Revert Schema

```typescript
// Undo your schema changes
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  // updatedAt: timestamp("updated_at"), // REMOVED
});
```

### 2. Generate New Migration

```bash
pnpm run db:generate
```

### 3. Manually Write Rollback SQL

Edit the generated migration file:

```sql
-- Instead of DROP COLUMN, consider:
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "updated_at";

-- Or keep the column but make it nullable:
-- ALTER TABLE "users" ALTER COLUMN "updated_at" DROP NOT NULL;
```

### 4. Apply Rollback

```bash
pnpm run db:migrate
```

---

## Supabase-Specific Notes

### Connection String

Get your connection string from Supabase Dashboard:

1. Go to **Project Settings** → **Database**
2. Copy **Connection string** (URI mode)
3. Format: `postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres`

### Pooling Mode

For production, use **Transaction Mode** pooling:

```
postgresql://postgres.[PROJECT].[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Migration in Railway

Add to Railway startup command:

```bash
pnpm run db:migrate && pnpm --filter @workspace/api-server run start
```

Or create a separate deployment job:

```yaml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "pnpm run db:migrate && pnpm --filter @workspace/api-server run start"
```

---

## Drizzle Studio

Open the database GUI:

```bash
pnpm run db:studio
```

This opens http://localhost:3000 with:

- Table browser
- SQL editor
- Data editor
- Schema visualizer

---

## Troubleshooting

### Error: "relation already exists"

**Cause:** Migration ran twice or schema was pushed manually.

**Fix:**

```bash
# Option 1: Reset migration history (development only)
rm -rf lib/db/drizzle/meta/*.json
pnpm run db:generate

# Option 2: Manually sync (production)
pnpm run db:push --force
```

### Error: "column does not exist"

**Cause:** Migration didn't run or schema is out of sync.

**Fix:**

```bash
# Check if migration file exists
ls lib/db/drizzle/*.sql

# Run migrations
pnpm run db:migrate

# Or push schema (development)
pnpm run db:push
```

### Error: "connection refused"

**Cause:** DATABASE_URL not set or database not accessible.

**Fix:**

```bash
# Check environment variable
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

---

## Best Practices

1. **Always review generated migrations** before applying to production
2. **Never use `db:push` in production** - always use `db:generate` + `db:migrate`
3. **Test migrations locally** before deploying
4. **Backup before major changes** - Supabase has point-in-time recovery
5. **Keep migrations small** - one change per migration when possible
6. **Document breaking changes** in commit messages
7. **Use nullable columns** for new optional fields
8. **Add indexes** for frequently queried columns

---

## Example: Complete Migration Flow

```bash
# 1. Make schema change
# Edit lib/db/src/schema/users.ts

# 2. Generate migration
pnpm run db:generate

# 3. Review migration
cat lib/db/drizzle/0002_add_user_preferences.sql

# 4. Test locally
DATABASE_URL=postgresql://localhost:5432/test pnpm run db:migrate

# 5. Commit migration
git add lib/db/drizzle/
git commit -m "Add user_preferences table"

# 6. Deploy to production
git push origin main
# Railway will auto-deploy and run migrations

# 7. Verify
psql $DATABASE_URL -c "SELECT * FROM user_preferences LIMIT 1"
```

---

## Resources

- **Drizzle Docs:** https://orm.drizzle.team/
- **Drizzle Kit CLI:** https://orm.drizzle.team/kit-docs/overview
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Railway Dashboard:** https://railway.app/

---

**Last Updated:** May 7, 2026  
**Version:** 1.0.0
