import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// This endpoint is called daily by Vercel Cron.
// It creates a Neon database branch as a point-in-time snapshot.
//
// Required environment variables:
//   NEON_API_KEY     – API key from Neon dashboard (Account Settings → API Keys)
//   NEON_PROJECT_ID  – Project ID from the Neon project URL
//   CRON_SECRET      – Set in Vercel dashboard; Vercel sends it as Authorization: Bearer <secret>

const NEON_API = 'https://console.neon.tech/api/v2'
// Keep backup branches for 30 days before auto-deleting
const RETENTION_DAYS = 30

export async function GET(request: NextRequest) {
  // Verify the request comes from Vercel Cron (or manual call with secret)
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
            'Variáveis NEON_API_KEY e NEON_PROJECT_ID não configuradas. Adicione-as nas variáveis de ambiente do projeto.',
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

  const today = new Date().toISOString().slice(0, 10) // "2026-02-27"
  const branchName = `backup-${today}`

  // 1. Create the backup branch
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

  // 2. Clean up backup branches older than RETENTION_DAYS
  const deletedBranches: string[] = []
  try {
    const listRes = await fetch(`${NEON_API}/projects/${neonProjectId}/branches`, {
      headers: neonHeaders,
    })

    if (listRes.ok) {
      const listData = (await listRes.json()) as {
        branches: Array<{ id: string; name: string; created_at: string }>
      }

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)

      const oldBackups = listData.branches.filter(
        (b) =>
          b.name.startsWith('backup-') &&
          b.id !== createdBranch.branch.id &&
          new Date(b.created_at) < cutoff
      )

      for (const branch of oldBackups) {
        const delRes = await fetch(
          `${NEON_API}/projects/${neonProjectId}/branches/${branch.id}`,
          { method: 'DELETE', headers: neonHeaders }
        )
        if (delRes.ok) {
          deletedBranches.push(branch.name)
        }
      }
    }
  } catch {
    // Cleanup failure is non-fatal — backup was already created successfully
  }

  return NextResponse.json({
    success: true,
    message: `Branch de backup "${branchName}" criada com sucesso no Neon.`,
    branch: createdBranch.branch,
    deletedOldBranches: deletedBranches,
    createdAt: new Date().toISOString(),
  })
}
