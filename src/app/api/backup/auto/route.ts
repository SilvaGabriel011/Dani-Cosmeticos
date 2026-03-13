import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// This endpoint is called daily by Vercel Cron.
// It creates a Neon database branch as a point-in-time snapshot.
//
// Required environment variables:
//   NEON_API_KEY     – API key from Neon dashboard (Account Settings → API Keys)
//   NEON_PROJECT_ID  – Project ID from the Neon project URL
//   CRON_SECRET      – Set in Vercel dashboard; Vercel sends it as Authorization: Bearer <secret>
//
// Neon free plan allows 10 branches per project (including main).
// We keep at most MAX_BACKUP_BRANCHES so we never hit the limit.

const NEON_API = 'https://console.neon.tech/api/v2'
// Keep the 7 most recent backup branches (7 + main = 8 of 10 — safe for the free plan)
const MAX_BACKUP_BRANCHES = 7

interface NeonBranch {
  id: string
  name: string
  created_at: string
  primary: boolean
}

export async function GET(request: NextRequest) {
  try {
    // Verify the request comes from Vercel Cron (or a manual call with the secret)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Não autorizado.' } },
        { status: 401 }
      )
    }

    const neonApiKey = process.env.NEON_API_KEY
    const neonProjectId = process.env.NEON_PROJECT_ID

    if (!neonApiKey || !neonProjectId) {
      return NextResponse.json(
        {
          error: {
            code: 'CONFIGURATION_ERROR',
            message:
              'Variáveis NEON_API_KEY e NEON_PROJECT_ID não configuradas. Adicione-as nas variáveis de ambiente do projeto na Vercel.',
          },
        },
        { status: 503 }
      )
    }

    const neonHeaders = {
      Authorization: `Bearer ${neonApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    // 1. List existing backup branches FIRST so we can clean up before creating a new one.
    //    This prevents hitting the 10-branch limit on the Neon free plan.
    const deletedBranches: string[] = []

    const listRes = await fetch(`${NEON_API}/projects/${neonProjectId}/branches`, {
      headers: neonHeaders,
    })

    if (!listRes.ok) {
      const errorBody = await listRes.text()
      return NextResponse.json(
        {
          error: {
            code: 'NEON_API_ERROR',
            message: `Falha ao listar branches do Neon: ${listRes.status}`,
            details: { response: errorBody },
          },
        },
        { status: 502 }
      )
    }

    const listData = (await listRes.json()) as { branches: NeonBranch[] }

    // Collect all backup branches, newest first.
    // Safety checks to never touch the active database:
    //   1. Name must start with "backup-"   → excludes "main" and any other user branch
    //   2. primary !== true                  → extra guard via Neon's own flag
    const backupBranches = listData.branches
      .filter((b) => b.name.startsWith('backup-') && !b.primary)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // 2. Check if today's backup already exists (idempotent — safe to re-run)
    const today = new Date().toISOString().slice(0, 10) // "2026-02-27"
    const branchName = `backup-${today}`
    const existingToday = backupBranches.find((b) => b.name === branchName)

    if (existingToday) {
      return NextResponse.json({
        success: true,
        message: `Backup de hoje já existe: "${branchName}". Nenhuma ação necessária.`,
        branch: { id: existingToday.id, name: existingToday.name },
        alreadyExisted: true,
        deletedOldBranches: [],
        createdAt: existingToday.created_at,
      })
    }

    // 3. Delete old branches that exceed the retention limit (keep the newest
    //    MAX_BACKUP_BRANCHES - 1 because we are about to add one more)
    const toDelete = backupBranches.slice(MAX_BACKUP_BRANCHES - 1)

    for (const branch of toDelete) {
      const delRes = await fetch(
        `${NEON_API}/projects/${neonProjectId}/branches/${branch.id}`,
        { method: 'DELETE', headers: neonHeaders }
      )
      if (delRes.ok) {
        deletedBranches.push(branch.name)
      }
    }

    // 4. Create the new backup branch
    const createRes = await fetch(`${NEON_API}/projects/${neonProjectId}/branches`, {
      method: 'POST',
      headers: neonHeaders,
      body: JSON.stringify({
        branch: { name: branchName },
        endpoints: [],
      }),
    })

    if (!createRes.ok) {
      const errorBody = await createRes.text()
      return NextResponse.json(
        {
          error: {
            code: 'NEON_API_ERROR',
            message: `Falha ao criar branch de backup no Neon: ${createRes.status}`,
            details: { response: errorBody },
          },
        },
        { status: 502 }
      )
    }

    const createdBranch = (await createRes.json()) as { branch: { id: string; name: string } }

    return NextResponse.json({
      success: true,
      message: `Branch de backup "${branchName}" criada com sucesso no Neon.`,
      branch: createdBranch.branch,
      alreadyExisted: false,
      deletedOldBranches: deletedBranches,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    )
  }
}
