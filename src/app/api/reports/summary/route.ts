import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, parseISO } from "date-fns"

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

    const sales = await prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true,
      },
    })

    const totalSales = sales.length
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0)
    const totalCost = sales.reduce(
      (sum, sale) =>
        sum +
        sale.items.reduce(
          (itemSum, item) => itemSum + Number(item.costPrice) * item.quantity,
          0
        ),
      0
    )
    const totalProfit = totalRevenue - totalCost
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0
    const totalFees = sales.reduce((sum, sale) => sum + Number(sale.totalFees), 0)
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
