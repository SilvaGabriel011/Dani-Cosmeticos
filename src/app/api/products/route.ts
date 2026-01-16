import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createProductSchema } from "@/schemas/product"
import { calculateSalePrice } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const categoryId = searchParams.get("categoryId")
    const lowStock = searchParams.get("lowStock") === "true"

    const where = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { code: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(lowStock && {
        stock: { lte: prisma.product.fields.minStock },
      }),
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching products:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao buscar produtos" } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = createProductSchema.safeParse(body)

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

    const { costPrice, profitMargin, ...rest } = validation.data
    const salePrice = calculateSalePrice(costPrice, profitMargin)

    const product = await prisma.product.create({
      data: {
        ...rest,
        costPrice,
        profitMargin,
        salePrice,
      },
      include: { category: true },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error("Error creating product:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao criar produto" } },
      { status: 500 }
    )
  }
}
