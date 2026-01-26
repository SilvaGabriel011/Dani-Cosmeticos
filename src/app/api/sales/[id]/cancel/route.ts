import { type NextRequest, NextResponse } from 'next/server'

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

    // Cancel sale and restore stock in transaction
    const cancelledSale = await prisma.$transaction(async (tx) => {
      // Update sale status
      const updated = await tx.sale.update({
        where: { id: params.id },
        data: { status: 'CANCELLED' },
        include: {
          client: true,
          items: { include: { product: true } },
          payments: true,
        },
      })

      // Restore stock and create stock movements
      for (const item of sale.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        })

        if (product) {
          const previousStock = product.stock
          const newStock = previousStock + item.quantity

          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          })

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'CANCELLATION',
              quantity: item.quantity,
              previousStock,
              newStock,
              saleId: params.id,
              notes: 'Estoque restaurado por cancelamento de venda',
            },
          })
        }
      }

      return updated
    })

    return NextResponse.json(cancelledSale)
  } catch (error) {
    console.error('Error cancelling sale:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao cancelar venda' } },
      { status: 500 }
    )
  }
}
