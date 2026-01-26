import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { cache, CACHE_KEYS } from '@/lib/cache'
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
  } catch (error: unknown) {
    console.error('Error registering payment:', error)
    const message = error instanceof Error ? error.message : 'Erro ao registrar pagamento'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
