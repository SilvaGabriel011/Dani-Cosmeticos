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

    const { items, fixedInstallmentAmount: customInstallmentAmount } = validation.data

    // Find the sale with all receivables for recalculation
    const sale = (await prisma.sale.findUnique({
      where: { id },
      include: {
        receivables: { orderBy: { installment: 'asc' } },
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

    // Calculate new items total
    let newItemsTotal = 0
    const newSaleItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!
      const originalPrice = Number(product.salePrice)
      const unitPrice = item.unitPrice ?? originalPrice
      const total = unitPrice * item.quantity
      const isBackorder = product.stock < item.quantity
      newItemsTotal += total
      return {
        saleId: id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: new Decimal(unitPrice),
        originalPrice: new Decimal(originalPrice),
        costPrice: product.costPrice,
        total: new Decimal(total),
        addedAt: new Date(),
        isBackorder,
      }
    })

    // Separate receivables into paid and pending
    const pendingReceivables = sale.receivables.filter(
      (r) => r.status === 'PENDING' || r.status === 'PARTIAL'
    )
    const lastReceivable = sale.receivables[sale.receivables.length - 1]
    const lastInstallmentNumber = lastReceivable?.installment || 0
    const paymentDay = sale.paymentDay || (lastReceivable?.dueDate ? new Date(lastReceivable.dueDate).getDate() : new Date().getDate())

    // Calculate new totals
    const newTotal = Number(sale.total) + newItemsTotal
    const newSubtotal = Number(sale.subtotal) + newItemsTotal
    const newNetTotal = Number(sale.netTotal) + newItemsTotal

    // Calculate new remaining balance (what's still owed after adding new items)
    const alreadyPaid = Number(sale.paidAmount)
    const newRemainingBalance = newTotal - alreadyPaid

    // Determine the effective installment amount
    // Priority: user-provided custom amount > sale's existing fixedInstallmentAmount > redistribute evenly
    const effectiveFixedAmount = customInstallmentAmount
      ? customInstallmentAmount
      : sale.fixedInstallmentAmount
        ? Number(sale.fixedInstallmentAmount)
        : null

    // Recalculate receivables
    let updatedInstallmentPlan = sale.installmentPlan
    let updatedFixedInstallmentAmount = sale.fixedInstallmentAmount

    // Execute in transaction
    const updatedSale = await prisma.$transaction(async (tx) => {
      // Add new items
      await tx.saleItem.createMany({ data: newSaleItems })

      if (customInstallmentAmount) {
        // User wants to set/change the installment amount
        // Delete all pending receivables and recreate with the new amount
        const pendingIds = pendingReceivables.map((r) => r.id)
        if (pendingIds.length > 0) {
          await tx.receivable.deleteMany({ where: { id: { in: pendingIds } } })
        }

        // Calculate how many installments are needed for the new remaining balance
        const numNewInstallments = Math.ceil(newRemainingBalance / customInstallmentAmount)
        const paidReceivablesCount = sale.receivables.length - pendingReceivables.length

        // Determine the start date for new receivables
        const firstPendingDueDate = pendingReceivables.length > 0
          ? new Date(pendingReceivables[0].dueDate)
          : (lastReceivable?.dueDate ? new Date(lastReceivable.dueDate) : new Date())

        const newReceivables = Array.from({ length: numNewInstallments }, (_, i) => {
          const dueDate = new Date(firstPendingDueDate)
          dueDate.setMonth(dueDate.getMonth() + i)
          const targetDay = paymentDay
          const lastDayOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()
          dueDate.setDate(Math.min(targetDay, lastDayOfMonth))

          // Last installment may be smaller to avoid overpaying
          const remainingForThis = newRemainingBalance - (customInstallmentAmount * i)
          const amount = Math.min(customInstallmentAmount, remainingForThis)

          return {
            saleId: id,
            installment: paidReceivablesCount + i + 1,
            amount: new Decimal(Math.max(0.01, amount)),
            dueDate,
          }
        })

        if (newReceivables.length > 0) {
          await tx.receivable.createMany({ data: newReceivables })
        }

        updatedInstallmentPlan = paidReceivablesCount + numNewInstallments
        updatedFixedInstallmentAmount = customInstallmentAmount
      } else if (effectiveFixedAmount) {
        // Sale already has a fixed amount, keep it and add extra installments as needed
        const currentPendingTotal = pendingReceivables.reduce(
          (sum, r) => sum + (Number(r.amount) - Number(r.paidAmount)),
          0
        )
        const extraNeeded = newRemainingBalance - currentPendingTotal
        const extraInstallments = Math.ceil(extraNeeded / effectiveFixedAmount)

        if (extraInstallments > 0) {
          const lastPendingDueDate = pendingReceivables.length > 0
            ? new Date(pendingReceivables[pendingReceivables.length - 1].dueDate)
            : (lastReceivable?.dueDate ? new Date(lastReceivable.dueDate) : new Date())

          const newReceivables = Array.from({ length: extraInstallments }, (_, i) => {
            const dueDate = new Date(lastPendingDueDate)
            dueDate.setMonth(dueDate.getMonth() + i + 1)
            const targetDay = paymentDay
            const lastDayOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()
            dueDate.setDate(Math.min(targetDay, lastDayOfMonth))

            return {
              saleId: id,
              installment: lastInstallmentNumber + i + 1,
              amount: new Decimal(effectiveFixedAmount),
              dueDate,
            }
          })

          await tx.receivable.createMany({ data: newReceivables })
          updatedInstallmentPlan = sale.installmentPlan + extraInstallments
        }
      } else {
        // Variable mode: redistribute the new remaining balance across existing pending receivables
        for (const receivable of pendingReceivables) {
          const alreadyPaidOnThis = Number(receivable.paidAmount)
          const newAmount = alreadyPaidOnThis + (newRemainingBalance / pendingReceivables.length)
          await tx.receivable.update({
            where: { id: receivable.id },
            data: {
              amount: new Decimal(newAmount),
            },
          })
        }
      }

      // Update sale totals
      const updated = await tx.sale.update({
        where: { id },
        data: {
          subtotal: new Decimal(newSubtotal),
          total: new Decimal(newTotal),
          netTotal: new Decimal(newNetTotal),
          installmentPlan: updatedInstallmentPlan,
          ...(updatedFixedInstallmentAmount !== sale.fixedInstallmentAmount && {
            fixedInstallmentAmount: updatedFixedInstallmentAmount
              ? new Decimal(updatedFixedInstallmentAmount)
              : undefined,
          }),
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
        const isBackorder = product.stock < item.quantity

        if (isBackorder) {
          const availableToDecrement = Math.max(0, product.stock)
          if (availableToDecrement > 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: availableToDecrement } },
            })
          }

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'BACKORDER',
              quantity: -item.quantity,
              previousStock,
              newStock: Math.max(0, previousStock - item.quantity),
              saleId: id,
              notes: `Encomenda: ${item.quantity - availableToDecrement} un. pendente(s) (adicionado a venda existente)`,
            },
          })
        } else {
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
      }

      return updated
    })

    // Invalidate dashboard cache after adding items
    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)

    return NextResponse.json({
      sale: updatedSale,
      addedItemsTotal: newItemsTotal,
      newInstallmentPlan: updatedInstallmentPlan,
    })
  } catch (error) {
    console.error('Error adding items to sale:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao adicionar itens à venda' } },
      { status: 500 }
    )
  }
}
