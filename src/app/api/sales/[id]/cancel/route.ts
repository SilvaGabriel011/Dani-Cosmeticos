import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: params.id },
      include: { items: true },
    })

    if (!sale) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Venda não encontrada' } },
        { status: 404 }
      )
    }

    if (sale.status === 'CANCELLED') {
      return NextResponse.json(
        { error: { code: 'ALREADY_CANCELLED', message: 'Venda já cancelada' } },
        { status: 400 }
      )
    }

    // Fetch full sale data for audit log before deleting
    const fullSale = await prisma.sale.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        items: { include: { product: true } },
        payments: true,
      },
    })

    if (!fullSale) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Venda não encontrada' } },
        { status: 404 }
      )
    }

    // Restore stock, create audit log, then hard delete sale
    await prisma.$transaction(async (tx) => {
      // Restore stock for each item
      for (const item of sale.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        })

        if (product) {
          let quantityToRestore = item.quantity
          if (item.isBackorder) {
            const backorderMovement = await tx.stockMovement.findFirst({
              where: {
                saleId: params.id,
                productId: item.productId,
                type: 'BACKORDER',
              },
            })
            if (backorderMovement) {
              quantityToRestore = Math.min(item.quantity, backorderMovement.previousStock)
              quantityToRestore = Math.max(0, quantityToRestore)
            }
          }

          if (quantityToRestore > 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: quantityToRestore } },
            })
          }
        }
      }

      // Build audit log summary
      const itemsSummary = fullSale.items
        .map((i) => `${i.product.name} x${i.quantity}`)
        .join(', ')
      const paymentMethods = Array.from(new Set(fullSale.payments.map((p) => p.method))).join(', ') || null

      // Create audit log
      await tx.cancelledSaleLog.create({
        data: {
          originalSaleId: fullSale.id,
          clientName: fullSale.client?.name || null,
          total: fullSale.total,
          itemCount: fullSale.items.reduce((sum, i) => sum + i.quantity, 0),
          itemsSummary,
          paymentMethods,
          saleCreatedAt: fullSale.createdAt,
          notes: fullSale.notes,
        },
      })

      // Delete stock movements (no cascade on Sale? relation)
      await tx.stockMovement.deleteMany({
        where: { saleId: params.id },
      })

      // Delete the sale (cascades to SaleItem, Payment, Receivable)
      await tx.sale.delete({
        where: { id: params.id },
      })
    })

    // Invalidate caches
    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)

    return NextResponse.json({ success: true, message: 'Venda cancelada e removida' })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
