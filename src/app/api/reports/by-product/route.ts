import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, parseISO } from "date-fns"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")
    const limit = parseInt(searchParams.get("limit") || "10")

    const startDate = startDateParam
      ? startOfDay(parseISO(startDateParam))
      : startOfDay(new Date(new Date().setDate(1)))
    const endDate = endDateParam
      ? endOfDay(parseISO(endDateParam))
      : endOfDay(new Date())

    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          status: { not: "CANCELLED" },
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    const productMap = new Map<
      string,
      {
        productId: string
        productName: string
        productCode: string | null
        quantitySold: number
        totalRevenue: number
        totalCost: number
        totalProfit: number
      }
    >()

    for (const item of saleItems) {
      const existing = productMap.get(item.productId)
      const revenue = Number(item.total)
      const cost = Number(item.costPrice) * item.quantity
      const profit = revenue - cost

      if (existing) {
        existing.quantitySold += item.quantity
        existing.totalRevenue += revenue
        existing.totalCost += cost
        existing.totalProfit += profit
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          productName: item.product.name,
          productCode: item.product.code,
          quantitySold: item.quantity,
          totalRevenue: revenue,
          totalCost: cost,
          totalProfit: profit,
        })
      }
    }

    const products = Array.from(productMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      products,
    })
  } catch (error) {
    console.error("Error fetching products report:", error)
    return NextResponse.json(
      { error: "Erro ao gerar relatório por produto" },
      { status: 500 }
    )
  }
}
