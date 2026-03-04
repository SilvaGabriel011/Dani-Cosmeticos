import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * POST /api/products/fix-stock
 *
 * One-time fix: for every product whose costPrice > 0,
 *   1. Divide stock by 2 (floor)
 *   2. Set costPrice to 0
 *
 * Products with costPrice = 0 are left unchanged.
 * Each adjustment is recorded as a StockMovement for audit.
 *
 * Returns a summary of all changes made.
 */
export async function POST() {
  try {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        costPrice: { gt: 0 },
      },
      select: { id: true, name: true, stock: true, costPrice: true },
    })

    if (products.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum produto com costPrice > 0 encontrado. Nada a corrigir.',
        fixed: [],
      })
    }

    const fixed: Array<{
      id: string
      name: string
      oldStock: number
      newStock: number
      oldCostPrice: number
    }> = []

    await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        for (const product of products) {
          const oldStock = product.stock
          const newStock = Math.floor(oldStock / 2)
          const diff = oldStock - newStock

          await tx.product.update({
            where: { id: product.id },
            data: {
              stock: newStock,
              costPrice: new Prisma.Decimal(0),
            },
          })

          // Register stock movement for audit trail
          if (diff !== 0) {
            await tx.stockMovement.create({
              data: {
                productId: product.id,
                type: 'ADJUSTMENT',
                quantity: -diff,
                previousStock: oldStock,
                newStock: newStock,
                notes: 'Correção automática: estoque duplicado por costPrice > 0',
              },
            })
          }

          fixed.push({
            id: product.id,
            name: product.name,
            oldStock,
            newStock,
            oldCostPrice: Number(product.costPrice),
          })
        }
      },
      {
        maxWait: 15000,
        timeout: 120000,
      }
    )

    return NextResponse.json({
      success: true,
      message: `${fixed.length} produto(s) corrigido(s): estoque dividido por 2 e costPrice zerado.`,
      fixed,
    })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
