import { Prisma } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { createClientSchema } from '@/schemas/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const hasDebt = searchParams.get('hasDebt')
    const missingPhone = searchParams.get('missingPhone')

    let where: Prisma.ClientWhereInput = {
      deletedAt: null,
      ...(hasDebt === 'true' && {
        sales: {
          some: {
            status: 'PENDING' as const,
          },
        },
      }),
      ...(missingPhone === 'true' && {
        AND: [{ OR: [{ phone: null }, { phone: '' }] }],
      }),
    }

    // Multi-word accent-insensitive search via unaccent()
    if (search.trim()) {
      const words = search.trim().split(/\s+/).filter(Boolean)
      const wordConditions = words.map(
        (word) =>
          Prisma.sql`(
            unaccent("name") ILIKE unaccent(${'%' + word + '%'})
            OR unaccent(COALESCE("phone", '')) ILIKE unaccent(${'%' + word + '%'})
          )`
      )
      const searchCondition = wordConditions.reduce((acc, condition) =>
        Prisma.sql`${acc} AND ${condition}`
      )
      const matchingIds = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          SELECT "id" FROM "Client"
          WHERE "deletedAt" IS NULL
          AND ${searchCondition}
        `
      )
      const ids = matchingIds.map((r) => r.id)

      if (ids.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        })
      }

      where = { ...where, id: { in: ids } }
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.client.count({ where }),
    ])

    return NextResponse.json({
      data: clients,
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
    const validation = createClientSchema.safeParse(body)

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

    const client = await prisma.client.create({
      data: validation.data,
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
