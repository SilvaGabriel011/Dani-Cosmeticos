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

    // Calculate pending backorder quantity from original stock movement
    const backorderMovement = await prisma.stockMovement.findFirst({
      where: {
        saleId: saleItem.saleId,
        productId: saleItem.productId,
        type: 'BACKORDER',
      },
    })

    // pendingQty = total ordered - what was already taken from stock at sale time
    const alreadyDeducted = backorderMovement
      ? Math.min(saleItem.quantity, Math.max(0, backorderMovement.previousStock))
      : 0
    const pendingQty = saleItem.quantity - alreadyDeducted

    // Use transaction: mark fulfilled + decrement stock + create movement
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

      // Decrement stock for the pending backorder quantity
      if (pendingQty > 0) {
        const product = await tx.product.update({
          where: { id: saleItem.productId },
          data: { stock: { decrement: pendingQty } },
        })

        // Safety: check stock didn't go negative
        if (product.stock < 0) {
          throw new Error(
            `Estoque insuficiente para cumprir encomenda. Estoque atual: ${product.stock + pendingQty}, necessário: ${pendingQty}`
          )
        }

        await tx.stockMovement.create({
          data: {
            productId: saleItem.productId,
            type: 'SALE',
            quantity: -pendingQty,
            previousStock: product.stock + pendingQty,
            newStock: product.stock,
            saleId: saleItem.saleId,
            notes: `Encomenda cumprida: ${pendingQty} un. entregue(s)`,
          },
        })
      }

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
