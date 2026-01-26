import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_TTL, CACHE_KEYS } from '@/lib/cache'
import { receivableService } from '@/services/receivable.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build cache key based on filters
    const cacheKey = `${CACHE_KEYS.RECEIVABLES_SUMMARY}:${startDate || 'all'}:${endDate || 'all'}`

    // Check cache first
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const data = await receivableService.getDashboardSummary(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    )

    // Cache the result
    cache.set(cacheKey, data, CACHE_TTL.DASHBOARD)

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error fetching receivables summary:', error)
    const message = error instanceof Error ? error.message : 'Erro ao buscar resumo'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
