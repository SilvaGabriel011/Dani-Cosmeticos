import { NextResponse } from 'next/server'

import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [lowStockResult, totalProducts, noPriceCount, zeradosCount] = await Promise.all([
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM "Product"
        WHERE "deletedAt" IS NULL
        AND "stock" <= "minStock"
      `,
      prisma.product.count({
        where: { deletedAt: null },
      }),
      prisma.product.count({
        where: { deletedAt: null, salePrice: { equals: 0 } },
      }),
      prisma.product.count({
        where: {
          deletedAt: null,
          stock: { equals: 0 },
          stockMovements: { some: { type: 'SALE' } },
        },
      }),
    ])

    const lowStockCount = Number(lowStockResult[0]?.count || 0)

    return NextResponse.json({
      lowStockCount,
      totalProducts,
      noPriceCount,
      zeradosCount,
    })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
