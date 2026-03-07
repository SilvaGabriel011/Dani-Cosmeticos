import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { rescheduleSaleSchema } from '@/schemas/sale'
import { buildDueDateFromMonth } from '@/services/receivable.service'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const validation = rescheduleSaleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos',
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { newPaymentDay, newStartDate } = validation.data

    // Find the sale
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        receivables: {
          where: { status: { in: ['PENDING', 'PARTIAL'] } },
          orderBy: { installment: 'asc' },
        },
      },
    })

    if (!sale) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Venda não encontrada' } },
        { status: 404 }
      )
    }

    if (sale.status === 'CANCELLED') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATUS', message: 'Não é possível reagendar venda cancelada' } },
        { status: 400 }
      )
    }

    if (sale.receivables.length === 0) {
      return NextResponse.json(
        { error: { code: 'NO_RECEIVABLES', message: 'Não há parcelas pendentes para reagendar' } },
        { status: 400 }
      )
    }

    // Calculate new due dates
    const paymentDay = newPaymentDay || sale.paymentDay || 10

    // Determine base date for first installment
    let baseDate: Date
    if (newStartDate) {
      baseDate = new Date(newStartDate)
    } else {
      // Use buildDueDateFromMonth to avoid setDate overflow (e.g., day=31 in 30-day month)
      const now = new Date()
      const monthOffset = now.getDate() >= paymentDay ? 1 : 0
      baseDate = buildDueDateFromMonth(now, monthOffset, paymentDay)
    }

    // Update receivables in transaction
    const updatedSale = await prisma.$transaction(async (tx) => {
      // Update each pending receivable
      for (let i = 0; i < sale.receivables.length; i++) {
        const receivable = sale.receivables[i]
        const newDueDate = buildDueDateFromMonth(baseDate, i, paymentDay)

        await tx.receivable.update({
          where: { id: receivable.id },
          data: { dueDate: newDueDate },
        })
      }

      // Update sale's paymentDay
      const updated = await tx.sale.update({
        where: { id },
        data: { paymentDay },
        include: {
          client: true,
          items: { include: { product: true } },
          receivables: { orderBy: { installment: 'asc' } },
          payments: true,
        },
      })

      return updated
    })

    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)

    return NextResponse.json({
      sale: updatedSale,
      rescheduledCount: sale.receivables.length,
    })
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}
