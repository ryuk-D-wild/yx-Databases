# How to Setup Neon Postgres in Any Next.js Project

This guide shows you how to set up Neon Postgres database for any Next.js project. Perfect for production apps that need scalability, performance, and proper database features.

## What is Neon Postgres?

Neon is a serverless Postgres database that:
- ✅ Scales automatically
- ✅ Has no operation limits
- ✅ Provides ACID transactions
- ✅ Supports complex queries
- ✅ Offers 256MB free tier
- ✅ Integrates seamlessly with Vercel

## When to Use Postgres

Use Postgres when you need:
- Production-ready database
- Complex queries and relationships
- High traffic (1000+ users)
- Data integrity (transactions)
- Real-time updates
- Unlimited operations

## Step 1: Create Neon Database

### Method A: Via Vercel (Easiest)

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click **Storage** → **Create Database**
4. Select **Neon Postgres**
5. Choose name and region
6. Click **Create**
7. ✅ `DATABASE_URL` is automatically added to your environment variables

### Method B: Direct Neon Setup

1. Go to https://console.neon.tech
2. Sign up/login
3. Click **New Project**
4. Name your project
5. Select region (closest to your users)
6. Click **Create Project**
7. Copy the connection string:
   ```
   postgresql://user:pass@host/db?sslmode=require
   ```

## Step 2: Install Dependencies

```bash
npm install @neondatabase/serverless
# or
pnpm add @neondatabase/serverless
# or
yarn add @neondatabase/serverless
```

## Step 3: Add Environment Variables

Create `.env.local`:

```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

Add to `.env.example`:

```bash
# Neon Postgres Database
DATABASE_URL=your_postgres_connection_string_here
```

## Step 4: Create Database Utility

Create `lib/db.ts`:

```typescript
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
if (typeof window === 'undefined') {
  config({ path: resolve(process.cwd(), '.env.local') })
}

// Initialize database connection
const sql = neon(process.env.DATABASE_URL!)

// Example: Users table
export interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

// Initialize database schema
export async function initDatabase() {
  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Create index for faster queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}

// Get all users
export async function getUsers(): Promise<User[]> {
  const result = await sql`
    SELECT 
      id,
      name,
      email,
      created_at::text as "createdAt"
    FROM users
    ORDER BY created_at DESC
  `
  return result as User[]
}

// Get user by ID
export async function getUserById(id: string): Promise<User | null> {
  const result = await sql`
    SELECT 
      id,
      name,
      email,
      created_at::text as "createdAt"
    FROM users
    WHERE id = ${id}
  `
  return result.length > 0 ? (result[0] as User) : null
}

// Create user
export async function createUser(user: User): Promise<User> {
  await sql`
    INSERT INTO users (id, name, email, created_at)
    VALUES (${user.id}, ${user.name}, ${user.email}, ${user.createdAt})
  `
  return user
}

// Update user
export async function updateUser(id: string, name: string, email: string): Promise<void> {
  await sql`
    UPDATE users
    SET name = ${name}, email = ${email}
    WHERE id = ${id}
  `
}

// Delete user
export async function deleteUser(id: string): Promise<void> {
  await sql`
    DELETE FROM users WHERE id = ${id}
  `
}

export { sql }
```

## Step 5: Create Initialization Script

Create `scripts/init-db.ts`:

```typescript
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

import { initDatabase } from '../lib/db'

async function main() {
  console.log('Initializing database...')
  try {
    await initDatabase()
    console.log('✅ Database initialized successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)
    process.exit(1)
  }
}

main()
```

Add to `package.json`:

```json
{
  "scripts": {
    "db:init": "tsx scripts/init-db.ts"
  },
  "devDependencies": {
    "tsx": "^4.21.0",
    "dotenv": "^16.0.0"
  }
}
```

Install tsx:

```bash
npm install -D tsx dotenv
```

## Step 6: Initialize Database

```bash
npm run db:init
```

Expected output:
```
Initializing database...
Database initialized successfully
✅ Database initialized successfully!
```

## Step 7: Create API Routes

### Example: Get Users

Create `app/api/users/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getUsers } from '@/lib/db'

export async function GET() {
  try {
    const users = await getUsers()
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
```

### Example: Create User

Create `app/api/users/create/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { name, email } = await request.json()

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const newUser = {
      id: randomUUID(),
      name,
      email,
      createdAt: new Date().toISOString(),
    }

    await createUser(newUser)

    return NextResponse.json(newUser, { status: 201 })
  } catch (error: any) {
    console.error('Error creating user:', error)
    
    // Handle unique constraint violations
    if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
```

## Step 8: Use in Your App

### Client-side Example

```typescript
'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

export function UserList() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const createUser = async (name: string, email: string) => {
    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })

      if (response.ok) {
        fetchUsers() // Refresh list
      }
    } catch (error) {
      console.error('Error creating user:', error)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <h2>Users</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            {user.name} - {user.email}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## Common Patterns

### 1. Relationships (One-to-Many)

```typescript
// Posts table with foreign key to users
await sql`
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`

// Get user with their posts
export async function getUserWithPosts(userId: string) {
  const user = await getUserById(userId)
  
  const posts = await sql`
    SELECT * FROM posts WHERE user_id = ${userId}
  `
  
  return { ...user, posts }
}
```

### 2. Transactions

```typescript
export async function transferPoints(fromUserId: string, toUserId: string, points: number) {
  try {
    // Start transaction
    await sql`BEGIN`

    // Deduct points from sender
    await sql`
      UPDATE users
      SET points = points - ${points}
      WHERE id = ${fromUserId} AND points >= ${points}
    `

    // Add points to receiver
    await sql`
      UPDATE users
      SET points = points + ${points}
      WHERE id = ${toUserId}
    `

    // Commit transaction
    await sql`COMMIT`
  } catch (error) {
    // Rollback on error
    await sql`ROLLBACK`
    throw error
  }
}
```

### 3. Pagination

```typescript
export async function getUsersPaginated(page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit

  const users = await sql`
    SELECT * FROM users
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const [{ count }] = await sql`
    SELECT COUNT(*) as count FROM users
  `

  return {
    users,
    total: count,
    page,
    totalPages: Math.ceil(count / limit),
  }
}
```

### 4. Search

```typescript
export async function searchUsers(query: string) {
  return await sql`
    SELECT * FROM users
    WHERE name ILIKE ${'%' + query + '%'}
    OR email ILIKE ${'%' + query + '%'}
    ORDER BY created_at DESC
  `
}
```

### 5. Aggregations

```typescript
export async function getUserStats() {
  const [stats] = await sql`
    SELECT 
      COUNT(*) as total_users,
      COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_users_week,
      COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_users_month
    FROM users
  `
  return stats
}
```

## Best Practices

### 1. Use Indexes

```typescript
// Add indexes for frequently queried columns
await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`
await sql`CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)`
```

### 2. Use Prepared Statements

```typescript
// ✅ Good - parameterized query
await sql`SELECT * FROM users WHERE email = ${email}`

// ❌ Bad - SQL injection risk
await sql`SELECT * FROM users WHERE email = '${email}'`
```

### 3. Handle Errors

```typescript
try {
  await createUser(user)
} catch (error: any) {
  if (error.message?.includes('unique')) {
    return { error: 'Email already exists' }
  }
  throw error
}
```

### 4. Use Transactions for Multiple Operations

```typescript
await sql`BEGIN`
try {
  await sql`INSERT INTO users ...`
  await sql`INSERT INTO profiles ...`
  await sql`COMMIT`
} catch (error) {
  await sql`ROLLBACK`
  throw error
}
```

### 5. Monitor Performance

Check Neon Console for:
- Slow queries
- Connection count
- Storage usage
- Compute hours

## Deployment

### Vercel

1. Push your code to Git
2. Connect to Vercel
3. Add `DATABASE_URL` to environment variables (if not auto-added)
4. Deploy

### Initialize Production Database

After first deployment, initialize the database:

Option A: Create temporary API route:
```typescript
// app/api/init-db/route.ts
import { initDatabase } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  await initDatabase()
  return NextResponse.json({ success: true })
}
```

Visit: `https://your-domain.vercel.app/api/init-db`

Then delete the route.

Option B: Use Vercel CLI:
```bash
vercel env pull .env.production
npm run db:init
```

## Monitoring

### Neon Console

1. Go to https://console.neon.tech
2. Select your project
3. View:
   - Active connections
   - Query performance
   - Storage usage
   - Compute hours

### Query Performance

```typescript
// Log slow queries
const start = Date.now()
const result = await sql`SELECT * FROM users`
const duration = Date.now() - start

if (duration > 1000) {
  console.warn(`Slow query: ${duration}ms`)
}
```

## Troubleshooting

### Connection Error
```
Error: connect ECONNREFUSED
```
**Fix:** Check `DATABASE_URL` is set correctly

### Table Not Found
```
Error: relation "users" does not exist
```
**Fix:** Run `npm run db:init`

### Unique Constraint Violation
```
Error: duplicate key value violates unique constraint
```
**Fix:** Handle in your code or check for existing records first

### Slow Queries
- Add indexes
- Optimize queries
- Check Neon dashboard

## Cost

### Free Tier
- Storage: 256 MB
- Compute: 60 hours/month
- Operations: Unlimited
- Perfect for most apps!

### Paid Plans
- Pro: $19/month
- Unlimited storage
- Unlimited compute
- Priority support

## Resources

- [Neon Documentation](https://neon.tech/docs)
- [Neon SDK Reference](https://neon.tech/docs/serverless/serverless-driver)
- [SQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)
- [Neon Discord](https://discord.gg/neon)

---

**Postgres is the right choice for production apps. Start with Neon's free tier and scale as you grow!**
