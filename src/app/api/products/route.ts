import { Prisma } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { calculateSalePrice } from '@/lib/utils'
import { createProductSchema } from '@/schemas/product'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId')
    const brandId = searchParams.get('brandId')
    const priceStatus = searchParams.get('priceStatus')
    const stockStatus = searchParams.get('stockStatus')

    let where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(priceStatus === 'no-price' && { salePrice: { equals: 0 } }),
      ...(stockStatus === 'zeroed' && {
        stock: { equals: 0 },
        stockMovements: { some: { type: 'SALE' } },
      }),
    }

    // Multi-word accent-insensitive search via unaccent()
    // Searches: product name, code, brand name, category name
    if (search.trim()) {
      const words = search.trim().split(/\s+/).filter(Boolean)
      const wordConditions = words.map(
        (word) =>
          Prisma.sql`(
            unaccent(p."name") ILIKE unaccent(${'%' + word + '%'})
            OR unaccent(COALESCE(p."code", '')) ILIKE unaccent(${'%' + word + '%'})
            OR unaccent(COALESCE(b."name", '')) ILIKE unaccent(${'%' + word + '%'})
            OR unaccent(COALESCE(c."name", '')) ILIKE unaccent(${'%' + word + '%'})
          )`
      )
      const searchCondition = wordConditions.reduce((acc, condition) =>
        Prisma.sql`${acc} AND ${condition}`
      )
      
      // Build ranking expression for relevance sorting
      const firstWord = words[0]
      const rankingExpr = Prisma.sql`
        CASE
          WHEN unaccent(p."name") ILIKE unaccent(${firstWord}) THEN 1
          WHEN unaccent(p."code") ILIKE unaccent(${firstWord}) THEN 2
          WHEN unaccent(p."name") ILIKE unaccent(${firstWord + '%'}) THEN 3
          WHEN unaccent(p."code") ILIKE unaccent(${firstWord + '%'}) THEN 4
          WHEN unaccent(p."name") ILIKE unaccent(${'%' + firstWord + '%'}) THEN 5
          WHEN unaccent(b."name") ILIKE unaccent(${'%' + firstWord + '%'}) THEN 6
          WHEN unaccent(c."name") ILIKE unaccent(${'%' + firstWord + '%'}) THEN 7
          ELSE 8
        END
      `
      
      const matchingProducts = await prisma.$queryRaw<{ id: string; rank: number }[]>(
        Prisma.sql`
          SELECT p."id", ${rankingExpr} as rank
          FROM "Product" p
          LEFT JOIN "Brand" b ON p."brandId" = b."id"
          LEFT JOIN "Category" c ON p."categoryId" = c."id"
          WHERE p."deletedAt" IS NULL
          AND ${searchCondition}
          ORDER BY rank, unaccent(p."name")
          LIMIT 100
        `
      )
      const ids = matchingProducts.map((r) => r.id)

      if (ids.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        })
      }

      where = { ...where, id: { in: ids } }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true, brand: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: search.trim() ? { name: 'asc' } : { name: 'asc' },
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
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
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
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos',
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { costPrice, profitMargin, salePrice: submittedSalePrice, code, ...rest } = validation.data
    const calculatedSalePrice = calculateSalePrice(costPrice, profitMargin)
    const salePrice = submittedSalePrice !== undefined && costPrice === 0
      ? submittedSalePrice
      : calculatedSalePrice
    const sanitizedCode = code === '' ? null : code

    const product = await prisma.product.create({
      data: {
        ...rest,
        code: sanitizedCode,
        costPrice,
        profitMargin,
        salePrice,
      },
      include: { category: true, brand: true },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
