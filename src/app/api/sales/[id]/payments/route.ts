import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { PAYMENT_TOLERANCE } from '@/lib/constants'
import { AppError, ErrorCodes, handleApiError } from '@/lib/errors'
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
      throw new AppError(ErrorCodes.VALIDATION, 400, validation.error.flatten().fieldErrors as Record<string, unknown>)
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
    })

    if (!sale) {
      throw new AppError(ErrorCodes.SALE_NOT_FOUND, 404)
    }

    if (sale.status === 'CANCELLED') {
      throw new AppError(ErrorCodes.SALE_CANCELLED, 400)
    }

    if (sale.status === 'COMPLETED') {
      throw new AppError(ErrorCodes.SALE_COMPLETED, 400)
    }

    const { method, amount, feePercent, feeAbsorber, installments, confirmOverpayment } = validation.data

    const remainingAmount = Number(sale.total) - Number(sale.paidAmount)
    const isOverpayment = amount > remainingAmount + PAYMENT_TOLERANCE
    
    if (isOverpayment && !confirmOverpayment) {
      throw new AppError(ErrorCodes.PAYMENT_OVERPAYMENT_UNCONFIRMED, 400, {
        amount,
        remainingAmount,
        excess: amount - remainingAmount,
      })
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
    cache.invalidatePrefix(CACHE_KEYS.DEBTORS)

    return NextResponse.json(updatedSale)
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
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
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}
