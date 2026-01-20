import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClientSchema } from "@/schemas/client"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""

    const where = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    }

        const [clients, total] = await Promise.all([
          prisma.client.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { name: "asc" },
            include: {
              sales: {
                where: {
                  status: { in: ["PENDING", "COMPLETED"] },
                },
                include: {
                  receivables: {
                    where: {
                      status: { not: "PAID" },
                    },
                    select: {
                      amount: true,
                      paidAmount: true,
                    },
                  },
                },
              },
            },
          }),
          prisma.client.count({ where }),
        ])

        // Calculate total debt for each client
        const clientsWithDebt = clients.map((client) => {
          const totalDebt = client.sales.reduce((saleSum, sale) => {
            const saleDebt = sale.receivables.reduce((recSum, rec) => {
              return recSum + (Number(rec.amount) - Number(rec.paidAmount))
            }, 0)
            return saleSum + saleDebt
          }, 0)
      
          // Remove the nested sales data to keep response clean
          const { sales, ...clientData } = client
          return {
            ...clientData,
            totalDebt,
          }
        })

        return NextResponse.json({
          data: clientsWithDebt,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching clients:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao buscar clientes" } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = createClientSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dados inválidos",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const client = await prisma.client.create({
      data: validation.data,
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error("Error creating client:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao criar cliente" } },
      { status: 500 }
    )
  }
}
