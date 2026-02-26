import { Decimal } from '@prisma/client/runtime/library'
import { type NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { calculateProfitMargin } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const entries = await prisma.productCostEntry.findMany({
      where: { productId: params.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(entries)
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { price, quantity, notes } = body

    if (price === undefined || price === null || Number(price) < 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Preço de custo inválido' } },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id },
    })

    if (!product) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Produto não encontrado' } },
        { status: 404 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create the new cost entry
      const entry = await tx.productCostEntry.create({
        data: {
          productId: params.id,
          price: new Decimal(Number(price)),
          quantity: quantity ? Math.max(1, Math.round(Number(quantity))) : 1,
          notes: notes || null,
        },
      })

      // Calculate weighted average of all entries
      const allEntries = await tx.productCostEntry.findMany({
        where: { productId: params.id },
      })

      let totalWeightedCost = 0
      let totalQuantity = 0
      for (const e of allEntries) {
        totalWeightedCost += Number(e.price) * e.quantity
        totalQuantity += e.quantity
      }

      const avgCostPrice = totalQuantity > 0 ? totalWeightedCost / totalQuantity : 0

      // Recalculate profit margin based on new average cost and existing sale price
      const salePrice = Number(product.salePrice)
      const newProfitMargin = calculateProfitMargin(avgCostPrice, salePrice)

      // Update product with new average cost price and recalculated margin
      const updatedProduct = await tx.product.update({
        where: { id: params.id },
        data: {
          costPrice: new Decimal(Number(avgCostPrice.toFixed(2))),
          profitMargin: new Decimal(Number(Math.max(0, newProfitMargin).toFixed(2))),
        },
        include: { category: true, brand: true, costEntries: { orderBy: { createdAt: 'desc' } } },
      })

      return { product: updatedProduct, entry }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get('entryId')

    if (!entryId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'ID da entrada é obrigatório' } },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id },
    })

    if (!product) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Produto não encontrado' } },
        { status: 404 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.productCostEntry.delete({
        where: { id: entryId },
      })

      // Recalculate weighted average
      const remainingEntries = await tx.productCostEntry.findMany({
        where: { productId: params.id },
      })

      let totalWeightedCost = 0
      let totalQuantity = 0
      for (const e of remainingEntries) {
        totalWeightedCost += Number(e.price) * e.quantity
        totalQuantity += e.quantity
      }

      const avgCostPrice = totalQuantity > 0 ? totalWeightedCost / totalQuantity : 0
      const salePrice = Number(product.salePrice)
      const newProfitMargin = calculateProfitMargin(avgCostPrice, salePrice)

      const updatedProduct = await tx.product.update({
        where: { id: params.id },
        data: {
          costPrice: new Decimal(Number(avgCostPrice.toFixed(2))),
          profitMargin: new Decimal(Number(Math.max(0, newProfitMargin).toFixed(2))),
        },
        include: { category: true, brand: true, costEntries: { orderBy: { createdAt: 'desc' } } },
      })

      return updatedProduct
    })

    return NextResponse.json(result)
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
