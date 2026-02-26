import { NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const saleItem = await prisma.saleItem.findUnique({
      where: { id },
      include: { product: true },
    })

    if (!saleItem) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Item não encontrado' } },
        { status: 404 }
      )
    }

    if (!saleItem.isBackorder) {
      return NextResponse.json(
        { error: { code: 'NOT_BACKORDER', message: 'Este item não é uma encomenda' } },
        { status: 400 }
      )
    }

    if (saleItem.backorderFulfilledAt) {
      return NextResponse.json(
        { error: { code: 'ALREADY_FULFILLED', message: 'Encomenda já foi cumprida' } },
        { status: 400 }
      )
    }

    // Just mark as fulfilled — items go directly from supplier to customer,
    // no stock change needed (they were never on the shelf)
    const updated = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.saleItem.update({
        where: { id },
        data: { backorderFulfilledAt: new Date() },
        include: {
          product: {
            select: { id: true, name: true, stock: true },
          },
          sale: {
            select: {
              id: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      })

      // Record a traceability movement (no stock change)
      await tx.stockMovement.create({
        data: {
          productId: saleItem.productId,
          type: 'SALE',
          quantity: 0,
          previousStock: updatedItem.product.stock,
          newStock: updatedItem.product.stock,
          saleId: saleItem.saleId,
          notes: `Encomenda cumprida manualmente: ${saleItem.quantity} un. entregue(s) direto ao cliente`,
        },
      })

      return updatedItem
    })

    // Invalidate dashboard cache
    cache.invalidate(CACHE_KEYS.DASHBOARD)

    return NextResponse.json(updated)
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
