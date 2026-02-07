import { NextResponse } from 'next/server'

import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get all pending backorder items (not yet fulfilled)
    const backorderItems = await prisma.saleItem.findMany({
      where: {
        isBackorder: true,
        backorderFulfilledAt: null,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            stock: true,
            salePrice: true,
            brand: { select: { name: true } },
            category: { select: { name: true } },
          },
        },
        sale: {
          select: {
            id: true,
            createdAt: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { addedAt: 'desc' },
    })

    // Group by product for summary
    const byProduct = new Map<
      string,
      {
        productId: string
        productName: string
        productCode: string | null
        brandName: string | null
        categoryName: string | null
        currentStock: number
        totalPending: number
        items: typeof backorderItems
      }
    >()

    for (const item of backorderItems) {
      const existing = byProduct.get(item.productId)
      if (existing) {
        existing.totalPending += item.quantity
        existing.items.push(item)
      } else {
        byProduct.set(item.productId, {
          productId: item.productId,
          productName: item.product.name,
          productCode: item.product.code,
          brandName: item.product.brand?.name || null,
          categoryName: item.product.category?.name || null,
          currentStock: item.product.stock,
          totalPending: item.quantity,
          items: [item],
        })
      }
    }

    return NextResponse.json({
      totalPendingItems: backorderItems.length,
      totalPendingQuantity: backorderItems.reduce((sum, i) => sum + i.quantity, 0),
      byProduct: Array.from(byProduct.values()),
    })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
