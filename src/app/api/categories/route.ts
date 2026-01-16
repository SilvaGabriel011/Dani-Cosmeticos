import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
})

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao buscar categorias" } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = createCategorySchema.safeParse(body)

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

    const category = await prisma.category.create({
      data: validation.data,
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("Error creating category:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao criar categoria" } },
      { status: 500 }
    )
  }
}
