import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        items: { include: { product: true } },
        payments: true,
      },
    })

    if (!sale) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Venda não encontrada" } },
        { status: 404 }
      )
    }

    return NextResponse.json(sale)
  } catch (error) {
    console.error("Error fetching sale:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao buscar venda" } },
      { status: 500 }
    )
  }
}
