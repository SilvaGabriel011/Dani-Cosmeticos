import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, parseISO } from "date-fns"

export const dynamic = 'force-dynamic'

interface SaleSummary {
  totalSales: bigint
  totalRevenue: number | null
  totalFees: number | null
}

interface CostSummary {
  totalCost: number | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

    const startDate = startDateParam
      ? startOfDay(parseISO(startDateParam))
      : startOfDay(new Date(new Date().setDate(1)))
    const endDate = endDateParam
      ? endOfDay(parseISO(endDateParam))
      : endOfDay(new Date())

    // Usar agregacoes SQL nativas para melhor performance
    const [saleSummary] = await prisma.$queryRaw<SaleSummary[]>`
      SELECT 
        COUNT(*) as "totalSales",
        COALESCE(SUM(total), 0) as "totalRevenue",
        COALESCE(SUM("totalFees"), 0) as "totalFees"
      FROM "Sale"
      WHERE status != 'CANCELLED'
        AND "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
    `

    const [costSummary] = await prisma.$queryRaw<CostSummary[]>`
      SELECT COALESCE(SUM(si."costPrice" * si.quantity), 0) as "totalCost"
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      WHERE s.status != 'CANCELLED'
        AND s."createdAt" >= ${startDate}
        AND s."createdAt" <= ${endDate}
    `

    const totalSales = Number(saleSummary.totalSales)
    const totalRevenue = Number(saleSummary.totalRevenue || 0)
    const totalFees = Number(saleSummary.totalFees || 0)
    const totalCost = Number(costSummary.totalCost || 0)
    const totalProfit = totalRevenue - totalCost
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0
    const netProfit = totalProfit - totalFees

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      totalSales,
      totalRevenue,
      totalCost,
      totalProfit,
      totalFees,
      netProfit,
      averageTicket,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    })
  } catch (error) {
    console.error("Error fetching report summary:", error)
    return NextResponse.json(
      { error: "Erro ao gerar relatório" },
      { status: 500 }
    )
  }
}
