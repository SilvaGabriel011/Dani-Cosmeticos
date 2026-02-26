import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { receivableService } from '@/services/receivable.service'

export const dynamic = 'force-dynamic'

const updatePaymentSchema = z.object({
  amount: z.number().positive().optional(),
  method: z.enum(['CASH', 'PIX', 'DEBIT', 'CREDIT']).optional(),
  paidAt: z.string().datetime().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const data = updatePaymentSchema.parse(body)

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { sale: true },
    })
    if (!payment) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Pagamento não encontrado' } }, { status: 404 })
    }
    if (payment.sale.status === 'CANCELLED') {
      return NextResponse.json({ error: { code: 'SALE_CANCELLED', message: 'Venda cancelada' } }, { status: 400 })
    }

    if (data.amount) {
      const otherPayments = await prisma.payment.findMany({ where: { saleId: payment.saleId, id: { not: id } } })
      const otherTotal = otherPayments.reduce((s, p) => s + Number(p.amount), 0)
      if (otherTotal + data.amount > Number(payment.sale.total) + 0.01) {
        return NextResponse.json({ error: { code: 'AMOUNT_EXCEEDS', message: `Valor excede o total da venda` } }, { status: 400 })
      }
    }

    await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {}
      if (data.amount !== undefined) {
        updateData.amount = data.amount
        const oldFeePercent = Number(payment.feePercent)
        updateData.feeAmount = data.amount * (oldFeePercent / 100)
      }
      if (data.method !== undefined) updateData.method = data.method
      if (data.paidAt !== undefined) updateData.paidAt = new Date(data.paidAt)

      await tx.payment.update({ where: { id }, data: updateData })
      await receivableService.recalculateAfterPaymentChange(payment.saleId, tx)
    })

    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)

    const updated = await prisma.payment.findUnique({ where: { id }, include: { sale: { include: { client: true } } } })
    return NextResponse.json(updated)
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { sale: true },
    })
    if (!payment) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Pagamento não encontrado' } }, { status: 404 })
    }
    if (payment.sale.status === 'CANCELLED') {
      return NextResponse.json({ error: { code: 'SALE_CANCELLED', message: 'Venda cancelada' } }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id } })
      await receivableService.recalculateAfterPaymentChange(payment.saleId, tx)
    })

    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)

    return NextResponse.json({ success: true, message: 'Pagamento excluído com sucesso' })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
