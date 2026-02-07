import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { handleApiError } from '@/lib/errors'
import { receivableService } from '@/services/receivable.service'

export const dynamic = 'force-dynamic'

const paySaleSchema = z.object({
  saleId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'PIX', 'DEBIT', 'CREDIT']).default('CASH'),
  paidAt: z.string().datetime().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { saleId, amount, paymentMethod, paidAt } = paySaleSchema.parse(body)

    const data = await receivableService.registerPaymentWithDistribution(
      saleId,
      amount,
      paymentMethod,
      paidAt ? new Date(paidAt) : undefined
    )

    // Invalidate dashboard cache after payment
    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)

    return NextResponse.json(data)
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
