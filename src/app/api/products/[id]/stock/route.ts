import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const stockAdjustmentSchema = z.object({
  quantity: z.number().int(),
  type: z.enum(['ADJUSTMENT', 'ENTRY']),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const validation = stockAdjustmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados invalidos',
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { quantity, type, notes } = validation.data

    const product = await prisma.product.findUnique({
      where: { id: params.id },
    })

    if (!product || product.deletedAt) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Produto nao encontrado' } },
        { status: 404 }
      )
    }

    const previousStock = product.stock
    const entryQty = type === 'ENTRY' ? Math.abs(quantity) : quantity

    // For ENTRY type, auto-fulfill pending backorders before adding to stock
    if (type === 'ENTRY') {
      const pendingBackorders = await prisma.saleItem.findMany({
        where: {
          productId: params.id,
          isBackorder: true,
          backorderFulfilledAt: null,
        },
        include: {
          sale: { select: { id: true } },
        },
        orderBy: { addedAt: 'asc' }, // FIFO: oldest backorders first
      })

      // Calculate how many pending units need fulfilling
      // (only units that were NOT already deducted from stock at sale time)
      let totalPending = 0
      const backorderDetails: { item: typeof pendingBackorders[0]; pendingQty: number }[] = []

      if (pendingBackorders.length > 0) {
        const saleIds = Array.from(new Set(pendingBackorders.map((i) => i.saleId)))
        const backorderMovements = await prisma.stockMovement.findMany({
          where: { saleId: { in: saleIds }, productId: params.id, type: 'BACKORDER' },
        })

        for (const item of pendingBackorders) {
          const movement = backorderMovements.find(
            (m) => m.saleId === item.saleId && m.productId === item.productId
          )
          const alreadyDeducted = movement
            ? Math.min(item.quantity, Math.max(0, movement.previousStock))
            : 0
          const pendingQty = item.quantity - alreadyDeducted
          if (pendingQty > 0) {
            totalPending += pendingQty
            backorderDetails.push({ item, pendingQty })
          } else {
            // Fully deducted at sale time, just mark as fulfilled
            backorderDetails.push({ item, pendingQty: 0 })
          }
        }
      }

      if (totalPending > 0) {
        // Deduct backorder quantities from the incoming entry
        const fulfilledFromEntry = Math.min(entryQty, totalPending)
        const excessForStock = entryQty - fulfilledFromEntry
        const newStock = previousStock + excessForStock

        const result = await prisma.$transaction(async (tx) => {
          // Fulfill backorders FIFO
          let remaining = fulfilledFromEntry
          for (const { item, pendingQty } of backorderDetails) {
            if (remaining <= 0) break
            if (pendingQty === 0) {
              // Item was fully deducted at sale time, just mark fulfilled
              await tx.saleItem.update({
                where: { id: item.id },
                data: { backorderFulfilledAt: new Date() },
              })
              continue
            }

            const toFulfill = Math.min(remaining, pendingQty)
            remaining -= toFulfill

            // Mark as fulfilled if fully covered
            if (toFulfill >= pendingQty) {
              await tx.saleItem.update({
                where: { id: item.id },
                data: { backorderFulfilledAt: new Date() },
              })
            }

            await tx.stockMovement.create({
              data: {
                productId: params.id,
                type: 'SALE',
                quantity: 0,
                previousStock,
                newStock: previousStock,
                saleId: item.saleId,
                notes: `Encomenda cumprida via entrada de estoque: ${toFulfill} un. entregue(s) direto ao cliente`,
              },
            })
          }

          // Also fulfill zero-pending items that weren't covered above
          for (const { item, pendingQty } of backorderDetails) {
            if (pendingQty === 0 && !item.backorderFulfilledAt) {
              await tx.saleItem.update({
                where: { id: item.id },
                data: { backorderFulfilledAt: new Date() },
              })
            }
          }

          // Update stock with only the excess
          const updatedProduct = await tx.product.update({
            where: { id: params.id },
            data: { stock: newStock },
            include: { category: true, brand: true },
          })

          // Record entry movement (only the net effect on stock)
          const movement = await tx.stockMovement.create({
            data: {
              productId: params.id,
              type: 'ENTRY',
              quantity: entryQty,
              previousStock,
              newStock,
              notes: notes
                ? `${notes} (${fulfilledFromEntry} un. destinada(s) a encomendas)`
                : `${fulfilledFromEntry} un. destinada(s) a encomendas, ${excessForStock} un. adicionada(s) ao estoque`,
            },
          })

          return { product: updatedProduct, movement }
        })

        return NextResponse.json({
          product: result.product,
          movement: result.movement,
          backordersFulfilled: fulfilledFromEntry,
        })
      }
    }

    // Regular flow (no pending backorders, or ADJUSTMENT type)
    const newStock =
      type === 'ENTRY' ? previousStock + Math.abs(quantity) : previousStock + quantity

    if (newStock < 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_STOCK', message: 'Estoque nao pode ser negativo' } },
        { status: 400 }
      )
    }

    const [updatedProduct, stockMovement] = await prisma.$transaction([
      prisma.product.update({
        where: { id: params.id },
        data: { stock: newStock },
        include: { category: true, brand: true },
      }),
      prisma.stockMovement.create({
        data: {
          productId: params.id,
          type,
          quantity: type === 'ENTRY' ? Math.abs(quantity) : quantity,
          previousStock,
          newStock,
          notes,
        },
      }),
    ])

    return NextResponse.json({
      product: updatedProduct,
      movement: stockMovement,
    })
  } catch (error) {
    console.error('Error adjusting stock:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao ajustar estoque' } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const movements = await prisma.stockMovement.findMany({
      where: { productId: params.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sale: {
          select: {
            id: true,
            createdAt: true,
            client: {
              select: { name: true },
            },
          },
        },
      },
    })

    return NextResponse.json(movements)
  } catch (error) {
    console.error('Error fetching stock movements:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao buscar historico de estoque' } },
      { status: 500 }
    )
  }
}
