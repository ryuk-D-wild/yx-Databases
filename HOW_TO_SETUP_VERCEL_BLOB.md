# How to Setup Vercel Blob Storage in Any Next.js Project

This guide shows you how to set up Vercel Blob Storage for file and data storage in any Next.js project.

## What is Vercel Blob?

Vercel Blob is a simple file storage solution that lets you store and retrieve files/data using a REST API. It's good for:
- Small to medium projects
- Prototypes and MVPs
- Simple data storage needs
- Projects with < 2k advanced operations/month

## Step 1: Create Blob Storage

### Via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project (or create one)
3. Click **Storage** tab
4. Click **Create Database**
5. Select **Blob**
6. Click **Create**
7. Copy the `BLOB_READ_WRITE_TOKEN`

### Via Vercel CLI

```bash
vercel blob create
```

## Step 2: Install Dependencies

```bash
npm install @vercel/blob
# or
pnpm add @vercel/blob
# or
yarn add @vercel/blob
```

## Step 3: Add Environment Variables

Create `.env.local`:

```bash
BLOB_READ_WRITE_TOKEN=your_token_here
```

Add to `.env.example`:

```bash
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_blob_token_here
```

## Step 4: Create Blob Utility File

Create `lib/blob.ts`:

```typescript
import { put, list } from '@vercel/blob'

// Save data to blob
export async function saveData(filename: string, data: any): Promise<string> {
  const jsonData = JSON.stringify(data, null, 2)
  const blob = await put(filename, jsonData, {
    access: 'public',
    contentType: 'application/json'
  })
  return blob.url
}

// Get data from blob
export async function getData(filename: string): Promise<any> {
  try {
    const { blobs } = await list({ prefix: filename })
    
    if (blobs.length === 0) {
      return null
    }

    // Get the latest blob
    const latestBlob = blobs.sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0]

    const response = await fetch(latestBlob.url, { cache: 'no-store' })
    if (!response.ok) return null

    return await response.json()
  } catch (error) {
    console.error('Error fetching data:', error)
    return null
  }
}

// List all blobs with a prefix
export async function listBlobs(prefix: string = '') {
  const { blobs } = await list({ prefix })
  return blobs
}
```

## Step 5: Create API Routes

### Example: Save Data

Create `app/api/data/save/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { saveData } from '@/lib/blob'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filename, data } = body

    if (!filename || !data) {
      return NextResponse.json(
        { error: 'Missing filename or data' },
        { status: 400 }
      )
    }

    const url = await saveData(filename, data)

    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error('Error saving data:', error)
    return NextResponse.json(
      { error: 'Failed to save data' },
      { status: 500 }
    )
  }
}
```

### Example: Get Data

Create `app/api/data/get/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getData } from '@/lib/blob'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')

    if (!filename) {
      return NextResponse.json(
        { error: 'Missing filename' },
        { status: 400 }
      )
    }

    const data = await getData(filename)

    if (!data) {
      return NextResponse.json(
        { error: 'Data not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error getting data:', error)
    return NextResponse.json(
      { error: 'Failed to get data' },
      { status: 500 }
    )
  }
}
```

## Step 6: Use in Your App

### Client-side Example

```typescript
'use client'

import { useState } from 'react'

export function DataManager() {
  const [data, setData] = useState(null)

  const saveData = async () => {
    const response = await fetch('/api/data/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'my-data.json',
        data: { name: 'John', age: 30 }
      })
    })
    const result = await response.json()
    console.log('Saved:', result)
  }

  const loadData = async () => {
    const response = await fetch('/api/data/get?filename=my-data.json')
    const result = await response.json()
    setData(result)
  }

  return (
    <div>
      <button onClick={saveData}>Save Data</button>
      <button onClick={loadData}>Load Data</button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  )
}
```

## Common Patterns

### 1. Storing Lists (e.g., Users, Products)

```typescript
interface User {
  id: string
  name: string
  email: string
}

export async function getUsers(): Promise<User[]> {
  const data = await getData('users/users.json')
  return data || []
}

export async function saveUsers(users: User[]): Promise<void> {
  await saveData('users/users.json', users)
}

export async function addUser(user: User): Promise<void> {
  const users = await getUsers()
  users.push(user)
  await saveUsers(users)
}
```

### 2. Caching Data

```typescript
let cache: any = null
let cacheTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getCachedData(): Promise<any> {
  const now = Date.now()
  
  if (cache && now - cacheTime < CACHE_DURATION) {
    return cache
  }

  cache = await getData('cache.json')
  cacheTime = now
  return cache
}
```

### 3. Versioning Data

```typescript
export async function saveVersionedData(data: any): Promise<void> {
  const timestamp = new Date().toISOString()
  const filename = `data/data-${timestamp}.json`
  await saveData(filename, data)
}

export async function getLatestVersion(): Promise<any> {
  const blobs = await listBlobs('data/')
  
  if (blobs.length === 0) return null

  const latest = blobs.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )[0]

  const response = await fetch(latest.url)
  return await response.json()
}
```

## Limitations

### Free Tier
- Storage: 1 GB
- Simple Operations: 10,000/month
- Advanced Operations: 2,000/month

### When to Use
✅ Prototypes and MVPs
✅ Small projects (< 100 users)
✅ Simple data storage
✅ File uploads

### When NOT to Use
❌ High-traffic apps (> 2k operations/month)
❌ Complex queries
❌ Real-time updates
❌ Transactional data
❌ Large-scale production apps

## Best Practices

1. **Use Prefixes for Organization**
   ```typescript
   await saveData('users/user-123.json', userData)
   await saveData('products/product-456.json', productData)
   ```

2. **Handle Errors Gracefully**
   ```typescript
   try {
     const data = await getData('file.json')
     return data || defaultValue
   } catch (error) {
     console.error('Error:', error)
     return defaultValue
   }
   ```

3. **Cache Frequently Accessed Data**
   - Reduce API calls
   - Improve performance
   - Stay within operation limits

4. **Version Your Data**
   - Keep history of changes
   - Easy rollback
   - Debugging

5. **Monitor Usage**
   - Check Vercel dashboard regularly
   - Track operation counts
   - Plan for scaling

## Troubleshooting

### "Blob not found"
- Check filename is correct
- Verify blob was created
- Check prefix in list()

### "Too many requests"
- You've exceeded operation limits
- Implement caching
- Consider upgrading or migrating to Postgres

### "Invalid token"
- Check BLOB_READ_WRITE_TOKEN is set
- Verify token is correct
- Regenerate token if needed

## Migration to Postgres

When your app grows, migrate to Postgres:
- See `HOW_TO_SETUP_POSTGRES.md`
- Better performance
- No operation limits
- Proper database queries

## Resources

- [Vercel Blob Docs](https://vercel.com/docs/storage/vercel-blob)
- [Blob API Reference](https://vercel.com/docs/storage/vercel-blob/using-blob-sdk)
- [Pricing](https://vercel.com/docs/storage/vercel-blob/usage-and-pricing)

---

**Vercel Blob is great for getting started quickly, but plan to migrate to a proper database (like Postgres) as your app grows!**
