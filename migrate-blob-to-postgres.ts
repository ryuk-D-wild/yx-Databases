import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

import { list } from '@vercel/blob'
import { 
  initDatabase, 
  createProject, 
  addVote, 
  createJudge, 
  addJudgeScore,
  saveCategories,
  type Project,
  type Vote,
  type Judge,
  type JudgeScore
} from '../lib/db'

async function migrateProjects() {
  console.log('\n📦 Migrating projects...')
  try {
    const { blobs } = await list({ prefix: 'projects/' })
    const projectsBlobs = blobs.filter(blob => blob.pathname.includes('projects.json'))
    
    if (projectsBlobs.length === 0) {
      console.log('  No projects found in blob storage')
      return
    }

    const allProjects: Project[] = []
    const projectIds = new Set<string>()
    
    for (const blob of projectsBlobs) {
      const response = await fetch(blob.url, { cache: 'no-store' })
      if (response.ok) {
        const projects: Project[] = await response.json()
        for (const project of projects) {
          if (!projectIds.has(project.id)) {
            allProjects.push(project)
            projectIds.add(project.id)
          }
        }
      }
    }

    console.log(`  Found ${allProjects.length} unique projects`)
    
    for (const project of allProjects) {
      await createProject(project)
    }
    
    console.log(`  ✅ Migrated ${allProjects.length} projects`)
  } catch (error) {
    console.error('  ❌ Error migrating projects:', error)
  }
}

async function migrateVotes() {
  console.log('\n🗳️  Migrating votes...')
  try {
    const { blobs } = await list({ prefix: 'votes/' })
    const votesBlobs = blobs.filter(blob => blob.pathname.includes('votes-current.json'))
    
    if (votesBlobs.length === 0) {
      console.log('  No votes found in blob storage')
      return
    }

    const latestBlob = votesBlobs.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0]

    const response = await fetch(latestBlob.url, { cache: 'no-store' })
    if (!response.ok) {
      console.log('  No votes to migrate')
      return
    }

    const votes: Vote[] = await response.json()
    console.log(`  Found ${votes.length} votes`)
    
    let migrated = 0
    for (const vote of votes) {
      try {
        await addVote(
          vote.projectId,
          vote.hashedEmail,
          vote.deviceFingerprint,
          vote.rating
        )
        migrated++
      } catch (error) {
        // Skip duplicates
      }
    }
    
    console.log(`  ✅ Migrated ${migrated} votes`)
  } catch (error) {
    console.error('  ❌ Error migrating votes:', error)
  }
}

async function migrateJudges() {
  console.log('\n👨‍⚖️  Migrating judges...')
  try {
    const { blobs } = await list({ prefix: 'judges/' })
    const judgesBlobs = blobs.filter(blob => blob.pathname.includes('judges.json'))
    
    if (judgesBlobs.length === 0) {
      console.log('  No judges found in blob storage')
      return
    }

    const latestBlob = judgesBlobs.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0]

    const response = await fetch(latestBlob.url, { cache: 'no-store' })
    if (!response.ok) {
      console.log('  No judges to migrate')
      return
    }

    const judges: Judge[] = await response.json()
    console.log(`  Found ${judges.length} judges`)
    
    for (const judge of judges) {
      await createJudge(judge)
    }
    
    console.log(`  ✅ Migrated ${judges.length} judges`)
  } catch (error) {
    console.error('  ❌ Error migrating judges:', error)
  }
}

async function migrateJudgeScores() {
  console.log('\n📊 Migrating judge scores...')
  try {
    const { blobs } = await list({ prefix: 'scores/' })
    const scoresBlobs = blobs.filter(blob => blob.pathname.includes('judge-scores.json'))
    
    if (scoresBlobs.length === 0) {
      console.log('  No judge scores found in blob storage')
      return
    }

    const latestBlob = scoresBlobs.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0]

    const response = await fetch(latestBlob.url, { cache: 'no-store' })
    if (!response.ok) {
      console.log('  No judge scores to migrate')
      return
    }

    const scores: JudgeScore[] = await response.json()
    console.log(`  Found ${scores.length} judge scores`)
    
    for (const score of scores) {
      await addJudgeScore(score)
    }
    
    console.log(`  ✅ Migrated ${scores.length} judge scores`)
  } catch (error) {
    console.error('  ❌ Error migrating judge scores:', error)
  }
}

async function migrateCategories() {
  console.log('\n📁 Migrating categories...')
  try {
    const { blobs } = await list({ prefix: 'settings/' })
    const categoriesBlobs = blobs.filter(blob => blob.pathname.includes('categories.json'))
    
    if (categoriesBlobs.length === 0) {
      console.log('  No categories found, using defaults')
      await saveCategories(['speech', 'essay', 'quiz'])
      console.log('  ✅ Created default categories')
      return
    }

    const latestBlob = categoriesBlobs.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0]

    const response = await fetch(latestBlob.url, { cache: 'no-store' })
    if (!response.ok) {
      await saveCategories(['speech', 'essay', 'quiz'])
      console.log('  ✅ Created default categories')
      return
    }

    const categories: string[] = await response.json()
    console.log(`  Found ${categories.length} categories`)
    
    await saveCategories(categories)
    
    console.log(`  ✅ Migrated ${categories.length} categories`)
  } catch (error) {
    console.error('  ❌ Error migrating categories:', error)
  }
}

async function main() {
  console.log('🚀 Starting migration from Vercel Blob to Postgres...\n')
  
  try {
    // Initialize database schema
    console.log('📋 Initializing database schema...')
    await initDatabase()
    console.log('  ✅ Database schema created')

    // Migrate all data
    await migrateCategories()
    await migrateProjects()
    await migrateVotes()
    await migrateJudges()
    await migrateJudgeScores()

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📝 Next steps:')
    console.log('  1. Set DATABASE_URL in your .env.local file')
    console.log('  2. Test the application')
    console.log('  3. Deploy to Vercel with DATABASE_URL environment variable')
    
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

main()
