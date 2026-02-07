import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { handleApiError } from '@/lib/errors'
import { payReceivableSchema } from '@/schemas/receivable'
import { receivableService } from '@/services/receivable.service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { amount, paymentMethod, paidAt } = payReceivableSchema.parse(body)

    const data = await receivableService.registerPayment(
      params.id,
      amount,
      paymentMethod,
      paidAt ? new Date(paidAt) : undefined
    )

    // Invalidate caches after payment
    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)

    return NextResponse.json(data)
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
