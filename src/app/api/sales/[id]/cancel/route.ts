import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: params.id },
      include: { items: true },
    })

    if (!sale) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Venda não encontrada" } },
        { status: 404 }
      )
    }

    if (sale.status === "CANCELLED") {
      return NextResponse.json(
        { error: { code: "ALREADY_CANCELLED", message: "Venda já cancelada" } },
        { status: 400 }
      )
    }

    // Cancel sale and restore stock in transaction
    const cancelledSale = await prisma.$transaction(async (tx) => {
      // Update sale status
      const updated = await tx.sale.update({
        where: { id: params.id },
        data: { status: "CANCELLED" },
        include: {
          client: true,
          items: { include: { product: true } },
          payments: true,
        },
      })

      // Restore stock
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })
      }

      return updated
    })

    return NextResponse.json(cancelledSale)
  } catch (error) {
    console.error("Error cancelling sale:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao cancelar venda" } },
      { status: 500 }
    )
  }
}
