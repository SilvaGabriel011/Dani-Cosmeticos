import { type ReceivableStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { PAYMENT_TOLERANCE } from '@/lib/constants'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { addPaymentSchema } from '@/schemas/sale'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const validation = addPaymentSchema.safeParse(body)

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

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { payments: true },
    })

    if (!sale) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Venda não encontrada' } },
        { status: 404 }
      )
    }

    if (sale.status === 'CANCELLED') {
      return NextResponse.json(
        {
          error: {
            code: 'SALE_CANCELLED',
            message: 'Não é possível adicionar pagamento a uma venda cancelada',
          },
        },
        { status: 400 }
      )
    }

    if (sale.status === 'COMPLETED') {
      return NextResponse.json(
        { error: { code: 'SALE_COMPLETED', message: 'Esta venda já está totalmente paga' } },
        { status: 400 }
      )
    }

    const { method, amount, feePercent, feeAbsorber, installments } = validation.data

    const remainingAmount = Number(sale.total) - Number(sale.paidAmount)
    if (amount > remainingAmount + 0.01) {
      return NextResponse.json(
        {
          error: {
            code: 'AMOUNT_EXCEEDS',
            message: `Valor máximo permitido: R$ ${remainingAmount.toFixed(2)}`,
          },
        },
        { status: 400 }
      )
    }

    const feeAmount = amount * (feePercent / 100)

    // Update fees if seller absorbs
    let newTotalFees = Number(sale.totalFees)
    if (feeAbsorber === 'SELLER') {
      newTotalFees += feeAmount
    }
    const newNetTotal = Number(sale.total) - newTotalFees

    const updatedSale = await prisma.$transaction(async (tx) => {
      // Create Payment record
      await tx.payment.create({
        data: {
          saleId: id,
          method,
          amount: new Decimal(amount),
          feePercent: new Decimal(feePercent),
          feeAmount: new Decimal(feeAmount),
          feeAbsorber,
          installments,
        },
      })

      // Distribute payment into pending receivables (FIFO by installment number)
      const pendingReceivables = await tx.receivable.findMany({
        where: { saleId: id, status: { in: ['PENDING', 'PARTIAL'] } },
        orderBy: { installment: 'asc' },
      })

      if (pendingReceivables.length > 0) {
        let remainingPayment = amount
        for (const receivable of pendingReceivables) {
          if (remainingPayment <= PAYMENT_TOLERANCE) break

          const receivableRemaining = Number(receivable.amount) - Number(receivable.paidAmount)
          const paymentForThis = Math.min(remainingPayment, receivableRemaining)
          const newRecPaidAmount = Number(receivable.paidAmount) + paymentForThis

          let newRecStatus: ReceivableStatus = 'PENDING'
          if (newRecPaidAmount >= Number(receivable.amount) - PAYMENT_TOLERANCE) {
            newRecStatus = 'PAID'
          } else if (newRecPaidAmount > 0) {
            newRecStatus = 'PARTIAL'
          }

          await tx.receivable.update({
            where: { id: receivable.id },
            data: {
              paidAmount: newRecPaidAmount,
              status: newRecStatus,
              paidAt: newRecStatus === 'PAID' ? new Date() : null,
            },
          })

          remainingPayment -= paymentForThis
        }
      }

      // Calculate paidAmount from all Payment records (includes initial + new)
      const allPayments = await tx.payment.findMany({ where: { saleId: id } })
      const newPaidAmount = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)
      const isPaid = newPaidAmount >= Number(sale.total) - PAYMENT_TOLERANCE

      // Check if all receivables are paid
      const allReceivables = await tx.receivable.findMany({
        where: { saleId: id, status: { not: 'CANCELLED' } },
      })
      const allReceivablesPaid = allReceivables.length > 0
        ? allReceivables.every((r) => r.status === 'PAID')
        : isPaid

      const newStatus = (isPaid || allReceivablesPaid) ? 'COMPLETED' : 'PENDING'

      return tx.sale.update({
        where: { id },
        data: {
          paidAmount: new Decimal(newPaidAmount),
          totalFees: new Decimal(newTotalFees),
          netTotal: new Decimal(newNetTotal),
          status: newStatus as 'COMPLETED' | 'PENDING',
        },
        include: {
          client: true,
          items: { include: { product: true } },
          payments: { orderBy: { paidAt: 'asc' } },
        },
      })
    })

    // Invalidate caches after payment
    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)

    return NextResponse.json(updatedSale)
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const payments = await prisma.payment.findMany({
      where: { saleId: id },
      orderBy: { paidAt: 'asc' },
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao buscar pagamentos' } },
      { status: 500 }
    )
  }
}
