import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cache, CACHE_TTL, CACHE_KEYS } from "@/lib/cache"
import { startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns"

export const dynamic = 'force-dynamic'

interface DashboardData {
  sales: {
    today: { total: number; count: number }
    week: { total: number; count: number }
    month: { total: number; count: number }
  }
  products: { total: number; stockValue: number }
  clients: { total: number }
  lowStockProducts: unknown[]
  recentSales: unknown[]
}

async function fetchDashboardData(): Promise<DashboardData> {
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

    // Low stock products - select only needed fields
    prisma.$queryRaw`
      SELECT "id", "name", "stock", "minStock" FROM "Product"
      WHERE "deletedAt" IS NULL
      AND "stock" <= "minStock"
      ORDER BY "stock" ASC
      LIMIT 5
    `,

    // Recent sales - optimized includes
    prisma.sale.findMany({
      where: { status: "COMPLETED" },
      select: {
        id: true,
        total: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
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

  return {
    sales: {
      today: {
        total: Number(salesToday._sum.total || 0),
        count: salesToday._count,
      },
      week: {
        total: Number(salesWeek._sum.total || 0),
        count: salesWeek._count,
      },
      month: {
        total: Number(salesMonth._sum.total || 0),
        count: salesMonth._count,
      },
    },
    products: {
      total: totalProducts,
      stockValue: Number((stockValue as { totalValue: number }[])[0]?.totalValue || 0),
    },
    clients: {
      total: totalClients,
    },
    lowStockProducts: lowStockProducts as unknown[],
    recentSales: recentSales as unknown[],
  }
}

export async function GET() {
  try {
    // Check cache first
    const cached = cache.get<DashboardData>(CACHE_KEYS.DASHBOARD)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Fetch fresh data
    const data = await fetchDashboardData()

    // Store in cache
    cache.set(CACHE_KEYS.DASHBOARD, data, CACHE_TTL.DASHBOARD)

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching dashboard:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao buscar dashboard" } },
      { status: 500 }
    )
  }
}
