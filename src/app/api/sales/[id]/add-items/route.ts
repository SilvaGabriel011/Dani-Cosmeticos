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

    const { items, fixedInstallmentAmount: customInstallmentAmount, mode } = validation.data

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

    // Apply the sale's discount to new items for consistency
    const saleDiscountPercent = Number(sale.discountPercent)
    const newItemsDiscount = newItemsTotal * (saleDiscountPercent / 100)
    const discountedNewItemsTotal = newItemsTotal - newItemsDiscount

    // Calculate new totals
    const newSubtotal = Number(sale.subtotal) + newItemsTotal
    const newDiscountAmount = Number(sale.discountAmount) + newItemsDiscount
    const newTotal = Number(sale.total) + discountedNewItemsTotal
    const newNetTotal = Number(sale.netTotal) + discountedNewItemsTotal

    // Calculate new remaining balance (what's still owed after adding new items)
    const alreadyPaid = Number(sale.paidAmount)
    const newRemainingBalance = newTotal - alreadyPaid

    // Recalculate receivables based on explicit mode
    let updatedInstallmentPlan = sale.installmentPlan
    let updatedFixedInstallmentAmount = sale.fixedInstallmentAmount

    // Determine the installment amount to use for increase_installments mode
    const effectiveInstallmentAmount = customInstallmentAmount
      ? customInstallmentAmount
      : sale.fixedInstallmentAmount
        ? Number(sale.fixedInstallmentAmount)
        : pendingReceivables.length > 0
          ? Number(pendingReceivables[0].amount)
          : null

    // Execute in transaction
    const updatedSale = await prisma.$transaction(async (tx) => {
      // Add new items
      await tx.saleItem.createMany({ data: newSaleItems })

      if (mode === 'increase_installments') {
        // MODE: Keep installment amount the same, add new installments at the END of the queue
        // This guarantees the new purchase goes to the "end of the line"

        if (effectiveInstallmentAmount && effectiveInstallmentAmount > 0) {
          // Calculate how many extra installments are needed for the new items (use discounted total)
          const extraInstallments = Math.ceil(discountedNewItemsTotal / effectiveInstallmentAmount)

          if (extraInstallments > 0) {
            // Find the last receivable due date (paid or pending) to append after it
            const lastDueDate = pendingReceivables.length > 0
              ? new Date(pendingReceivables[pendingReceivables.length - 1].dueDate)
              : (lastReceivable?.dueDate ? new Date(lastReceivable.dueDate) : new Date())

            const newReceivables = Array.from({ length: extraInstallments }, (_, i) => {
              const dueDate = new Date(lastDueDate)
              dueDate.setMonth(dueDate.getMonth() + i + 1)
              const targetDay = paymentDay
              const lastDayOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()
              dueDate.setDate(Math.min(targetDay, lastDayOfMonth))

              // Last installment: correct the remainder so total matches exactly
              let amount: number
              if (i === extraInstallments - 1) {
                // Last installment = whatever is left
                const previousInstallmentsTotal = effectiveInstallmentAmount * i
                amount = Math.max(0.01, discountedNewItemsTotal - previousInstallmentsTotal)
              } else {
                amount = effectiveInstallmentAmount
              }

              return {
                saleId: id,
                installment: lastInstallmentNumber + i + 1,
                amount: new Decimal(Number(amount.toFixed(2))),
                dueDate,
              }
            })

            await tx.receivable.createMany({ data: newReceivables })
            updatedInstallmentPlan = sale.installmentPlan + extraInstallments
            if (customInstallmentAmount) {
              updatedFixedInstallmentAmount = customInstallmentAmount
            }
          }
        } else {
          // No fixed amount exists — create a single new installment for the full discounted items total
          const lastDueDate = lastReceivable?.dueDate ? new Date(lastReceivable.dueDate) : new Date()
          const dueDate = new Date(lastDueDate)
          dueDate.setMonth(dueDate.getMonth() + 1)
          const lastDayOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()
          dueDate.setDate(Math.min(paymentDay, lastDayOfMonth))

          await tx.receivable.create({
            data: {
              saleId: id,
              installment: lastInstallmentNumber + 1,
              amount: new Decimal(Number(discountedNewItemsTotal.toFixed(2))),
              dueDate,
            },
          })
          updatedInstallmentPlan = sale.installmentPlan + 1
        }
      } else {
        // MODE: increase_value — Keep same number of pending installments, increase their amount
        // Redistribute the new remaining balance across existing pending receivables

        if (pendingReceivables.length > 0) {
          const totalAlreadyPaidOnPending = pendingReceivables.reduce(
            (sum, r) => sum + Number(r.paidAmount), 0
          )
          const newTotalForPending = newRemainingBalance + totalAlreadyPaidOnPending
          const newAmountPerInstallment = Math.floor((newTotalForPending / pendingReceivables.length) * 100) / 100

          for (let i = 0; i < pendingReceivables.length; i++) {
            const receivable = pendingReceivables[i]
            let newAmount: number

            if (i === pendingReceivables.length - 1) {
              const previousTotal = newAmountPerInstallment * i
              newAmount = newTotalForPending - previousTotal
            } else {
              newAmount = newAmountPerInstallment
            }

            await tx.receivable.update({
              where: { id: receivable.id },
              data: {
                amount: new Decimal(Number(Math.max(0.01, newAmount).toFixed(2))),
              },
            })
          }
        } else {
          // No pending receivables — create one for the full amount
          const lastDueDate = lastReceivable?.dueDate ? new Date(lastReceivable.dueDate) : new Date()
          const dueDate = new Date(lastDueDate)
          dueDate.setMonth(dueDate.getMonth() + 1)
          const lastDayOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()
          dueDate.setDate(Math.min(paymentDay, lastDayOfMonth))

          await tx.receivable.create({
            data: {
              saleId: id,
              installment: lastInstallmentNumber + 1,
              amount: new Decimal(Number(newRemainingBalance.toFixed(2))),
              dueDate,
            },
          })
          updatedInstallmentPlan = sale.installmentPlan + 1
        }
      }

      // Update sale totals
      const updated = await tx.sale.update({
        where: { id },
        data: {
          subtotal: new Decimal(newSubtotal),
          discountAmount: new Decimal(newDiscountAmount),
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
              quantity: -availableToDecrement,
              previousStock,
              newStock: previousStock - availableToDecrement,
              saleId: id,
              notes: `Encomenda: ${item.quantity - availableToDecrement} un. pendente(s) de ${item.quantity} un. (adicionado a venda existente)`,
            },
          })
        } else {
          const updatedProduct = await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          })

          // Safety: detect concurrent stock race condition
          if (updatedProduct.stock < 0) {
            throw new Error(`Estoque insuficiente para ${product.name}. Estoque atual: ${previousStock}, solicitado: ${item.quantity}`)
          }

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'SALE',
              quantity: -item.quantity,
              previousStock,
              newStock: updatedProduct.stock,
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
