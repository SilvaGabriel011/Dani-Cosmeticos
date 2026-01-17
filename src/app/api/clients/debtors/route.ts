import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const sortBy = searchParams.get("sortBy") || "totalDebt"

    const debtors = await prisma.client.findMany({
      where: {
        deletedAt: null,
        sales: {
          some: {
            status: "PENDING",
            receivables: {
              some: {
                status: { in: ["PENDING", "PARTIAL", "OVERDUE"] }
              }
            }
          }
        },
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      },
      include: {
        sales: {
          where: { status: "PENDING" },
          include: {
            items: {
              include: { product: true }
            },
            receivables: {
              where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
              orderBy: { dueDate: "asc" }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    })

    const now = new Date()

    const result = debtors.map(client => {
      let totalDebt = 0
      let overdueAmount = 0
      let oldestDueDate: Date | null = null

      client.sales.forEach(sale => {
        sale.receivables.forEach(receivable => {
          const remaining = Number(receivable.amount) - Number(receivable.paidAmount)
          totalDebt += remaining

          const dueDate = new Date(receivable.dueDate)
          if (dueDate < now) {
            overdueAmount += remaining
          }

          if (!oldestDueDate || dueDate < oldestDueDate) {
            oldestDueDate = dueDate
          }
        })
      })

      return {
        client: {
          id: client.id,
          name: client.name,
          phone: client.phone,
          address: client.address,
          discount: client.discount,
        },
        sales: client.sales.map(sale => ({
          id: sale.id,
          createdAt: sale.createdAt,
          total: sale.total,
          items: sale.items.map(item => ({
            id: item.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            product: {
              id: item.product.id,
              name: item.product.name,
              code: item.product.code,
            }
          })),
          receivables: sale.receivables.map(r => ({
            id: r.id,
            installment: r.installment,
            amount: r.amount,
            paidAmount: r.paidAmount,
            dueDate: r.dueDate,
            status: r.status,
          }))
        })),
        totalDebt,
        overdueAmount,
        salesCount: client.sales.length,
        oldestDueDate,
        isOverdue: overdueAmount > 0,
      }
    })

    if (sortBy === "totalDebt") {
      result.sort((a, b) => b.totalDebt - a.totalDebt)
    } else if (sortBy === "overdueAmount") {
      result.sort((a, b) => b.overdueAmount - a.overdueAmount)
    } else if (sortBy === "oldestDueDate") {
      result.sort((a, b) => {
        const aDate = a.oldestDueDate as Date | null
        const bDate = b.oldestDueDate as Date | null
        if (!aDate) return 1
        if (!bDate) return -1
        return aDate.getTime() - bDate.getTime()
      })
    } else if (sortBy === "name") {
      result.sort((a, b) => a.client.name.localeCompare(b.client.name))
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching debtors:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao buscar devedores" } },
      { status: 500 }
    )
  }
}
