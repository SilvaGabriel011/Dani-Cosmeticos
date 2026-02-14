import { startOfDay, endOfDay, parseISO } from 'date-fns'
import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    const startDate = startDateParam
      ? startOfDay(parseISO(startDateParam))
      : startOfDay(new Date(new Date().setDate(1)))
    const endDate = endDateParam ? endOfDay(parseISO(endDateParam)) : endOfDay(new Date())

    const payments = await prisma.payment.findMany({
      where: {
        sale: {
          status: { not: 'CANCELLED' },
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
    })

    const methodMap = new Map<
      string,
      {
        method: string
        count: number
        totalAmount: number
        totalFees: number
        netAmount: number
      }
    >()

    for (const payment of payments) {
      const existing = methodMap.get(payment.method)
      const amount = Number(payment.amount)
      const sellerFee = payment.feeAbsorber === 'SELLER' ? Number(payment.feeAmount) : 0

      if (existing) {
        existing.count += 1
        existing.totalAmount += amount
        existing.totalFees += sellerFee
        existing.netAmount += amount - sellerFee
      } else {
        methodMap.set(payment.method, {
          method: payment.method,
          count: 1,
          totalAmount: amount,
          totalFees: sellerFee,
          netAmount: amount - sellerFee,
        })
      }
    }

    const methods = Array.from(methodMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)

    const totalAmount = methods.reduce((sum, m) => sum + m.totalAmount, 0)

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      methods: methods.map((m) => ({
        ...m,
        percentage: totalAmount > 0 ? (m.totalAmount / totalAmount) * 100 : 0,
      })),
      totalAmount,
    })
  } catch (error) {
    console.error('Error fetching payment report:', error)
    return NextResponse.json({ error: 'Erro ao gerar relatório por pagamento' }, { status: 500 })
  }
}
