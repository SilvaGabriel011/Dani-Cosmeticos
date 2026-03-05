import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { PAYMENT_TOLERANCE } from '@/lib/constants'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { addPaymentSchema } from '@/schemas/sale'
import { receivableService } from '@/services/receivable.service'

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

    const { method, amount, feePercent, feeAbsorber, installments, confirmOverpayment } = validation.data

    const remainingAmount = Number(sale.total) - Number(sale.paidAmount)
    const isOverpayment = amount > remainingAmount + PAYMENT_TOLERANCE
    
    if (isOverpayment && !confirmOverpayment) {
      return NextResponse.json(
        {
          error: {
            code: 'OVERPAYMENT_CONFIRMATION_REQUIRED',
            message: `O valor R$ ${amount.toFixed(2)} excede o saldo devedor de R$ ${remainingAmount.toFixed(2)}. Confirme para pagar a mais.`,
            data: {
              amount,
              remainingAmount,
              excess: amount - remainingAmount,
            },
          },
        },
        { status: 400 }
      )
    }

    await receivableService.registerPaymentWithDistribution(
      id,
      amount,
      method,
      undefined,
      { feePercent, feeAbsorber, installments }
    )

    const updatedSale = await prisma.sale.findUnique({
      where: { id },
      include: {
        client: true,
        items: { include: { product: true } },
        payments: { orderBy: { paidAt: 'asc' } },
      },
    })

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
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
