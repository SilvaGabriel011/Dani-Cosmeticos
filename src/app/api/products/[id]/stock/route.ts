import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const stockAdjustmentSchema = z.object({
  quantity: z.number().int(),
  type: z.enum(["ADJUSTMENT", "ENTRY"]),
  notes: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validation = stockAdjustmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dados invalidos",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { quantity, type, notes } = validation.data

    const product = await prisma.product.findUnique({
      where: { id: params.id },
    })

    if (!product || product.deletedAt) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Produto nao encontrado" } },
        { status: 404 }
      )
    }

    const previousStock = product.stock
    const newStock = type === "ENTRY" 
      ? previousStock + Math.abs(quantity)
      : previousStock + quantity

    if (newStock < 0) {
      return NextResponse.json(
        { error: { code: "INVALID_STOCK", message: "Estoque nao pode ser negativo" } },
        { status: 400 }
      )
    }

    const [updatedProduct, stockMovement] = await prisma.$transaction([
      prisma.product.update({
        where: { id: params.id },
        data: { stock: newStock },
        include: { category: true, brand: true },
      }),
      prisma.stockMovement.create({
        data: {
          productId: params.id,
          type,
          quantity: type === "ENTRY" ? Math.abs(quantity) : quantity,
          previousStock,
          newStock,
          notes,
        },
      }),
    ])

    return NextResponse.json({
      product: updatedProduct,
      movement: stockMovement,
    })
  } catch (error) {
    console.error("Error adjusting stock:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao ajustar estoque" } },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50")

    const movements = await prisma.stockMovement.findMany({
      where: { productId: params.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        sale: {
          select: {
            id: true,
            createdAt: true,
            client: {
              select: { name: true }
            }
          }
        }
      }
    })

    return NextResponse.json(movements)
  } catch (error) {
    console.error("Error fetching stock movements:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao buscar historico de estoque" } },
      { status: 500 }
    )
  }
}
