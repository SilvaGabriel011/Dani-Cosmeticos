import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { calculateSalePrice } from '@/lib/utils'
import { updateProductSchema } from '@/schemas/product'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const product = await prisma.product.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { category: true, brand: true },
    })

    if (!product) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Produto não encontrado' } },
        { status: 404 }
      )
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao buscar produto' } },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const validation = updateProductSchema.safeParse(body)

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

    const existing = await prisma.product.findFirst({
      where: { id: params.id, deletedAt: null },
    })

    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Produto não encontrado' } },
        { status: 404 }
      )
    }

    const { costPrice, profitMargin, salePrice: submittedSalePrice, code, ...rest } = validation.data
    const newCostPrice = costPrice ?? Number(existing.costPrice)
    const newProfitMargin = profitMargin ?? Number(existing.profitMargin)
    const calculatedSalePrice = calculateSalePrice(newCostPrice, newProfitMargin)
    const salePrice = submittedSalePrice !== undefined && newCostPrice === 0
      ? submittedSalePrice
      : calculatedSalePrice

    const sanitizedCode = code === '' ? null : code

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(code !== undefined && { code: sanitizedCode }),
        ...(costPrice !== undefined && { costPrice }),
        ...(profitMargin !== undefined && { profitMargin }),
        salePrice,
      },
      include: { category: true, brand: true },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao atualizar produto' } },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: params.id, deletedAt: null },
    })

    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Produto não encontrado' } },
        { status: 404 }
      )
    }

    await prisma.product.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao excluir produto' } },
      { status: 500 }
    )
  }
}
