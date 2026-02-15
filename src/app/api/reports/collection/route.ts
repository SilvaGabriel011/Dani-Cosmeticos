import { startOfDay, endOfDay, parseISO, subDays, startOfWeek, startOfMonth } from 'date-fns'
import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface CollectionSummary {
  totalCollection: number | null
  paymentCount: bigint
  totalFees: number | null
}

interface CollectionByMethod {
  method: string
  total: number | null
  count: bigint
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const period = searchParams.get('period') // today, week, biweekly, month

    let startDate: Date
    let endDate: Date = endOfDay(new Date())

    // Determine date range based on period or explicit dates
    if (period) {
      const now = new Date()
      switch (period) {
        case 'today':
          startDate = startOfDay(now)
          break
        case 'week':
          startDate = startOfWeek(now, { weekStartsOn: 0 })
          break
        case 'biweekly':
          startDate = subDays(startOfDay(now), 14)
          break
        case 'month':
        default:
          startDate = startOfMonth(now)
          break
      }
    } else {
      startDate = startDateParam ? startOfDay(parseISO(startDateParam)) : startOfMonth(new Date())
      endDate = endDateParam ? endOfDay(parseISO(endDateParam)) : endOfDay(new Date())
    }

    // Query payments by paidAt date - this is the actual money received
    const [summary] = await prisma.$queryRaw<CollectionSummary[]>`
      SELECT 
        COALESCE(SUM(amount), 0) as "totalCollection",
        COUNT(*) as "paymentCount",
        COALESCE(SUM(CASE WHEN "feeAbsorber" = 'SELLER' THEN "feeAmount" ELSE 0 END), 0) as "totalFees"
      FROM "Payment"
      WHERE "paidAt" >= ${startDate}
        AND "paidAt" <= ${endDate}
    `

    // Breakdown by payment method
    const byMethod = await prisma.$queryRaw<CollectionByMethod[]>`
      SELECT 
        method,
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as count
      FROM "Payment"
      WHERE "paidAt" >= ${startDate}
        AND "paidAt" <= ${endDate}
      GROUP BY method
      ORDER BY total DESC
    `

    // Get comparison with previous period (same duration)
    const periodDuration = endDate.getTime() - startDate.getTime()
    const previousStartDate = new Date(startDate.getTime() - periodDuration)
    const previousEndDate = new Date(startDate.getTime() - 1)

    const [previousSummary] = await prisma.$queryRaw<CollectionSummary[]>`
      SELECT 
        COALESCE(SUM(amount), 0) as "totalCollection",
        COUNT(*) as "paymentCount",
        COALESCE(SUM(CASE WHEN "feeAbsorber" = 'SELLER' THEN "feeAmount" ELSE 0 END), 0) as "totalFees"
      FROM "Payment"
      WHERE "paidAt" >= ${previousStartDate}
        AND "paidAt" <= ${previousEndDate}
    `

    const totalCollection = Number(summary.totalCollection || 0)
    const paymentCount = Number(summary.paymentCount)
    const totalFees = Number(summary.totalFees || 0)
    const netCollection = totalCollection - totalFees

    const previousCollection = Number(previousSummary.totalCollection || 0)
    const collectionChange =
      previousCollection > 0
        ? ((totalCollection - previousCollection) / previousCollection) * 100
        : totalCollection > 0
          ? 100
          : 0

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      totalCollection,
      paymentCount,
      totalFees,
      netCollection,
      averagePayment: paymentCount > 0 ? totalCollection / paymentCount : 0,
      byMethod: byMethod.map((m) => ({
        method: m.method,
        total: Number(m.total || 0),
        count: Number(m.count),
        percentage: totalCollection > 0 ? (Number(m.total || 0) / totalCollection) * 100 : 0,
      })),
      comparison: {
        previousPeriod: {
          startDate: previousStartDate.toISOString(),
          endDate: previousEndDate.toISOString(),
        },
        previousCollection,
        change: collectionChange,
        trend: collectionChange > 0 ? 'up' : collectionChange < 0 ? 'down' : 'stable',
      },
    })
  } catch (error) {
    console.error('Error fetching collection report:', error)
    return NextResponse.json({ error: 'Erro ao gerar relatório de arrecadação' }, { status: 500 })
  }
}
