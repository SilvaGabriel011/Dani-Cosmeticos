import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns"

export async function GET() {
  try {
    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const weekStart = startOfWeek(now, { weekStartsOn: 0 })
    const monthStart = startOfMonth(now)

    const [
      salesToday,
      salesWeek,
      salesMonth,
      totalProducts,
      totalClients,
      lowStockProducts,
      recentSales,
      stockValue,
    ] = await Promise.all([
      // Sales today
      prisma.sale.aggregate({
        where: {
          status: "COMPLETED",
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { total: true },
        _count: true,
      }),

      // Sales this week
      prisma.sale.aggregate({
        where: {
          status: "COMPLETED",
          createdAt: { gte: weekStart },
        },
        _sum: { total: true },
        _count: true,
      }),

      // Sales this month
      prisma.sale.aggregate({
        where: {
          status: "COMPLETED",
          createdAt: { gte: monthStart },
        },
        _sum: { total: true },
        _count: true,
      }),

      // Total products
      prisma.product.count({
        where: { deletedAt: null },
      }),

      // Total clients
      prisma.client.count({
        where: { deletedAt: null },
      }),

      // Low stock products
      prisma.$queryRaw`
        SELECT * FROM "Product"
        WHERE "deletedAt" IS NULL
        AND "stock" <= "minStock"
        ORDER BY "stock" ASC
        LIMIT 5
      `,

      // Recent sales
      prisma.sale.findMany({
        where: { status: "COMPLETED" },
        include: {
          client: true,
          items: { include: { product: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // Stock value
      prisma.$queryRaw`
        SELECT COALESCE(SUM("costPrice" * "stock"), 0) as "totalValue"
        FROM "Product"
        WHERE "deletedAt" IS NULL
      `,
    ])

    return NextResponse.json({
      sales: {
        today: {
          total: salesToday._sum.total || 0,
          count: salesToday._count,
        },
        week: {
          total: salesWeek._sum.total || 0,
          count: salesWeek._count,
        },
        month: {
          total: salesMonth._sum.total || 0,
          count: salesMonth._count,
        },
      },
      products: {
        total: totalProducts,
        stockValue: (stockValue as any)[0]?.totalValue || 0,
      },
      clients: {
        total: totalClients,
      },
      lowStockProducts,
      recentSales,
    })
  } catch (error) {
    console.error("Error fetching dashboard:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao buscar dashboard" } },
      { status: 500 }
    )
  }
}
