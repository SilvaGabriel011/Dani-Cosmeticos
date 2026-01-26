import { Decimal } from '@prisma/client/runtime/library'
import { type NextRequest, NextResponse } from 'next/server'

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
    const newPaidAmount = Number(sale.paidAmount) + amount
    const isPaid = newPaidAmount >= Number(sale.total) - 0.01
    const newStatus = isPaid ? 'COMPLETED' : 'PENDING'

    // Update fees if seller absorbs
    let newTotalFees = Number(sale.totalFees)
    if (feeAbsorber === 'SELLER') {
      newTotalFees += feeAmount
    }
    const newNetTotal = Number(sale.total) - newTotalFees

    const updatedSale = await prisma.$transaction(async (tx) => {
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

    return NextResponse.json(updatedSale)
  } catch (error) {
    console.error('Error adding payment:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao adicionar pagamento' } },
      { status: 500 }
    )
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
