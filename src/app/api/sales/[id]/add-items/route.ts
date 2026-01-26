import { type Sale, type Receivable, type SaleItem } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import { addItemsToSaleSchema } from '@/schemas/sale'


type SaleWithRelations = Omit<Sale, 'fixedInstallmentAmount' | 'paymentDay'> & {
  receivables: Receivable[]
  items: SaleItem[]
  fixedInstallmentAmount: number | null
  paymentDay: number | null
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const validation = addItemsToSaleSchema.safeParse(body)

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

    const { items } = validation.data

    // Find the sale with all necessary fields
    const sale = (await prisma.sale.findUnique({
      where: { id },
      include: {
        receivables: { orderBy: { installment: 'desc' }, take: 1 },
        items: true,
      },
    })) as SaleWithRelations | null

    if (!sale) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Venda não encontrada' } },
        { status: 404 }
      )
    }

    if (sale.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STATUS',
            message: 'Só é possível adicionar itens a vendas pendentes (fiado)',
          },
        },
        { status: 400 }
      )
    }

    // Fetch products and validate stock
    const productIds = items.map((item) => item.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, deletedAt: null },
    })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: { code: 'INVALID_PRODUCT', message: 'Produto inválido ou inativo' } },
        { status: 400 }
      )
    }

    // Check stock
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)!
      if (product.stock < item.quantity) {
        return NextResponse.json(
          {
            error: {
              code: 'INSUFFICIENT_STOCK',
              message: `Estoque insuficiente para ${product.name}`,
            },
          },
          { status: 400 }
        )
      }
    }

    // Calculate new items total
    let newItemsTotal = 0
    const newSaleItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!
      const unitPrice = item.unitPrice ?? Number(product.salePrice)
      const total = unitPrice * item.quantity
      newItemsTotal += total
      return {
        saleId: id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: new Decimal(unitPrice),
        costPrice: product.costPrice,
        total: new Decimal(total),
        addedAt: new Date(),
      }
    })

    // Calculate new receivables needed
    const installmentAmount = sale.fixedInstallmentAmount
      ? Number(sale.fixedInstallmentAmount)
      : Number(sale.total) / sale.installmentPlan

    const newInstallmentsNeeded = Math.ceil(newItemsTotal / installmentAmount)

    // Get last receivable info
    const lastReceivable = sale.receivables[0]
    const lastInstallmentNumber = lastReceivable?.installment || 0
    const lastDueDate = lastReceivable?.dueDate || new Date()
    const paymentDay = sale.paymentDay || lastDueDate.getDate()

    // Create new receivables
    const newReceivables = Array.from({ length: newInstallmentsNeeded }, (_, i) => {
      const dueDate = new Date(lastDueDate)
      dueDate.setMonth(dueDate.getMonth() + i + 1)
      dueDate.setDate(paymentDay)

      // Handle months with fewer days
      if (dueDate.getDate() !== paymentDay) {
        dueDate.setDate(0) // Last day of previous month
      }

      return {
        saleId: id,
        installment: lastInstallmentNumber + i + 1,
        amount: new Decimal(installmentAmount),
        dueDate,
      }
    })

    // Execute in transaction
    const updatedSale = await prisma.$transaction(async (tx) => {
      // Add new items
      await tx.saleItem.createMany({ data: newSaleItems })

      // Create new receivables
      if (newReceivables.length > 0) {
        await tx.receivable.createMany({ data: newReceivables })
      }

      // Update sale totals
      const newTotal = Number(sale.total) + newItemsTotal
      const newSubtotal = Number(sale.subtotal) + newItemsTotal
      const newNetTotal = Number(sale.netTotal) + newItemsTotal

      const updated = await tx.sale.update({
        where: { id },
        data: {
          subtotal: new Decimal(newSubtotal),
          total: new Decimal(newTotal),
          netTotal: new Decimal(newNetTotal),
          installmentPlan: lastInstallmentNumber + newInstallmentsNeeded,
        },
        include: {
          client: true,
          items: {
            include: { product: true },
            orderBy: { addedAt: 'asc' },
          },
          receivables: { orderBy: { installment: 'asc' } },
          payments: true,
        },
      })

      // Decrement stock and create stock movements
      for (const item of items) {
        const product = products.find((p) => p.id === item.productId)!
        const previousStock = product.stock
        const newStock = previousStock - item.quantity

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: -item.quantity,
            previousStock,
            newStock,
            saleId: id,
            notes: 'Item adicionado a venda existente',
          },
        })
      }

      return updated
    })

    // Invalidate dashboard cache after adding items
    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)

    return NextResponse.json({
      sale: updatedSale,
      addedItemsTotal: newItemsTotal,
      newReceivablesCount: newInstallmentsNeeded,
    })
  } catch (error) {
    console.error('Error adding items to sale:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao adicionar itens à venda' } },
      { status: 500 }
    )
  }
}
