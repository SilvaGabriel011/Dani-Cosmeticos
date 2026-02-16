import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    // Verify client exists
    const client = await prisma.client.findFirst({
      where: { id, deletedAt: null },
    })

    if (!client) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Cliente não encontrado' } },
        { status: 404 }
      )
    }

    // Get all pending sales for this client
    const pendingSales = await prisma.sale.findMany({
      where: {
        clientId: id,
        status: 'PENDING',
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
        receivables: {
          where: { status: { in: ['PENDING', 'PARTIAL'] } },
          orderBy: { installment: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate remaining amount for each sale
    const salesWithDetails = pendingSales.map((sale) => {
      const remaining = Number(sale.total) - Number(sale.paidAmount)
      const pendingReceivablesCount = sale.receivables.length
      const nextDueDate = sale.receivables[0]?.dueDate || null

      return {
        id: sale.id,
        total: Number(sale.total),
        remaining,
        paidAmount: Number(sale.paidAmount),
        installmentPlan: sale.installmentPlan,
        fixedInstallmentAmount: sale.fixedInstallmentAmount
          ? Number(sale.fixedInstallmentAmount)
          : null,
        paymentDay: sale.paymentDay,
        createdAt: sale.createdAt,
        itemsCount: sale.items.length,
        pendingReceivablesCount,
        nextDueDate,
        pendingReceivables: sale.receivables.map((r) => ({
          id: r.id,
          installment: r.installment,
          amount: Number(r.amount),
          paidAmount: Number(r.paidAmount),
          dueDate: r.dueDate,
          status: r.status,
        })),
      }
    })

    return NextResponse.json({ pendingSales: salesWithDetails })
  } catch (error) {
    console.error('Error fetching pending sales:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao buscar vendas pendentes' } },
      { status: 500 }
    )
  }
}
