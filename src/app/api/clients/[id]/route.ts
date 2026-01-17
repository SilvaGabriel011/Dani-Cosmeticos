import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { updateClientSchema } from "@/schemas/client"

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await prisma.client.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        sales: {
          where: { status: "COMPLETED" },
          include: {
            items: { include: { product: true } },
            payments: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    })

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Cliente não encontrado" } },
        { status: 404 }
      )
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error("Error fetching client:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao buscar cliente" } },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validation = updateClientSchema.safeParse(body)

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

    const existing = await prisma.client.findFirst({
      where: { id: params.id, deletedAt: null },
    })

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Cliente não encontrado" } },
        { status: 404 }
      )
    }

    const client = await prisma.client.update({
      where: { id: params.id },
      data: validation.data,
    })

    return NextResponse.json(client)
  } catch (error) {
    console.error("Error updating client:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao atualizar cliente" } },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.client.findFirst({
      where: { id: params.id, deletedAt: null },
    })

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Cliente não encontrado" } },
        { status: 404 }
      )
    }

    await prisma.client.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting client:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao excluir cliente" } },
      { status: 500 }
    )
  }
}
