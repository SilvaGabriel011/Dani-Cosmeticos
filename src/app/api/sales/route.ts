import { Prisma, type PaymentMethod } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { PAYMENT_TOLERANCE, DEFAULT_PAYMENT_DAY } from '@/lib/constants'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { createSaleSchema } from '@/schemas/sale'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const clientId = searchParams.get('clientId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const categoryId = searchParams.get('categoryId')
    const productId = searchParams.get('productId')
    const paymentMethod = searchParams.get('paymentMethod')
    const search = searchParams.get('search')

    const where: Prisma.SaleWhereInput = {}

    if (status) {
      where.status = status as 'COMPLETED' | 'PENDING' | 'CANCELLED'
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (search) {
      where.client = {
        name: { contains: search, mode: 'insensitive' },
      }
    }

    if (startDate || endDate) {
      const createdAtFilter: Prisma.DateTimeFilter = {}
      if (startDate) createdAtFilter.gte = new Date(startDate)
      if (endDate) createdAtFilter.lte = new Date(endDate + 'T23:59:59.999Z')
      where.createdAt = createdAtFilter
    }

    if (categoryId || productId) {
      where.items = {
        some: {
          product: {
            ...(categoryId && { categoryId }),
            ...(productId && { id: productId }),
          },
        },
      }
    }

    if (paymentMethod) {
      where.payments = {
        some: { method: paymentMethod as PaymentMethod },
      }
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          items: { select: { id: true, quantity: true, unitPrice: true, originalPrice: true, total: true, addedAt: true, product: { select: { id: true, name: true } } } },
          payments: { select: { method: true, amount: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sale.count({ where }),
    ])

    return NextResponse.json({
      data: sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = createSaleSchema.safeParse(body)

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

    const {
      items,
      payments,
      clientId,
      discountPercent,
      notes,
      paymentDay,
      installmentPlan,
      fixedInstallmentAmount,
      createdAt: customCreatedAt,
      startMonth,
      startYear,
    } = validation.data

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

    // Get client discount if any
    let clientDiscount = 0
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, deletedAt: null },
      })
      if (client) {
        clientDiscount = Number(client.discount)
      }
    }

    // Calculate totals
    const finalDiscountPercent = discountPercent ?? clientDiscount
    let subtotal = 0
    const saleItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!
      const originalPrice = Number(product.salePrice)
      const unitPrice = item.unitPrice ?? originalPrice
      const total = unitPrice * item.quantity
      const isBackorder = product.stock < item.quantity
      subtotal += total
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: new Decimal(unitPrice),
        originalPrice: new Decimal(originalPrice),
        costPrice: product.costPrice,
        total: new Decimal(total),
        isBackorder,
      }
    })

    const discountAmount = subtotal * (finalDiscountPercent / 100)
    const subtotalAfterDiscount = subtotal - discountAmount

    // Calculate fees and paid amount
    let totalFees = 0
    let paidAmount = 0
    const salePayments = payments.map((payment) => {
      const feeAmount = payment.amount * (payment.feePercent / 100)
      if (payment.feeAbsorber === 'SELLER') {
        totalFees += feeAmount
      }
      paidAmount += payment.amount
      return {
        method: payment.method,
        amount: new Decimal(payment.amount),
        feePercent: new Decimal(payment.feePercent),
        feeAmount: new Decimal(feeAmount),
        feeAbsorber: payment.feeAbsorber,
        installments: payment.installments,
      }
    })

    const total = subtotalAfterDiscount
    const netTotal = total - totalFees

    // Determine sale status based on payment
    const isPaid = paidAmount >= total - PAYMENT_TOLERANCE
    const saleStatus = (isPaid ? 'COMPLETED' : 'PENDING') as 'COMPLETED' | 'PENDING'

    // Fiado sales require a client
    if (!isPaid && !clientId) {
      return NextResponse.json(
        {
          error: {
            code: 'CLIENT_REQUIRED',
            message: 'Vendas fiado precisam de um cliente vinculado',
          },
        },
        { status: 400 }
      )
    }

    // Create sale in transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          ...(clientId && { client: { connect: { id: clientId } } }),
          subtotal: new Decimal(subtotal),
          discountPercent: new Decimal(finalDiscountPercent),
          discountAmount: new Decimal(discountAmount),
          totalFees: new Decimal(totalFees),
          total: new Decimal(total),
          netTotal: new Decimal(netTotal),
          paidAmount: new Decimal(paidAmount),
          status: saleStatus,
          notes,
          paymentDay: paymentDay || null,
          installmentPlan: installmentPlan || 1,
          fixedInstallmentAmount: fixedInstallmentAmount
            ? new Decimal(fixedInstallmentAmount)
            : null,
          items: { create: saleItems },
          payments: { create: salePayments.length > 0 ? salePayments : undefined },
        },
        include: {
          client: true,
          items: { include: { product: true } },
          payments: true,
        },
      })

      // Decrement stock and create stock movements
      for (const item of items) {
        const product = products.find((p) => p.id === item.productId)!
        const previousStock = product.stock
        const isBackorder = product.stock < item.quantity

        if (isBackorder) {
          // Backorder: decrement only available stock (to 0), rest is backorder
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
              saleId: newSale.id,
              notes: `Encomenda: ${item.quantity - availableToDecrement} un. pendente(s) de ${item.quantity} un.`,
            },
          })
        } else {
          // Normal sale: decrement full quantity
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
              saleId: newSale.id,
            },
          })
        }
      }

      // Create receivables for fiado sales (always, even without installments)
      if (!isPaid) {
        const remainingAmount = total - paidAmount
        const numInstallments = installmentPlan && installmentPlan >= 1 ? installmentPlan : 1
        const installmentAmount = Math.floor((remainingAmount / numInstallments) * 100) / 100

        // Calculate due dates based on paymentDay (day of month)
        // Use customCreatedAt if provided (for imports), otherwise use current date
        const referenceDate = customCreatedAt ? new Date(customCreatedAt) : new Date()
        const day = paymentDay || DEFAULT_PAYMENT_DAY

        // If startMonth/startYear provided, use them as the base for first installment
        const hasCustomStart = startMonth && startYear

        const receivables = Array.from({ length: numInstallments }, (_, i) => {
          let targetMonth: number
          let targetYear: number

          if (hasCustomStart) {
            // User chose a custom start month (startMonth is 1-12, convert to 0-11)
            targetMonth = (startMonth - 1) + i
            targetYear = startYear
          } else {
            // Start from current month, but if the day has passed, start from next month
            const monthOffset = referenceDate.getDate() >= day ? 1 : 0
            targetMonth = referenceDate.getMonth() + i + monthOffset
            targetYear = referenceDate.getFullYear()
          }

          // Handle year overflow
          while (targetMonth > 11) {
            targetMonth -= 12
            targetYear += 1
          }

          // Create date, handling months with fewer days (e.g., day=30 in Feb → Feb 28)
          const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
          const dueDate = new Date(targetYear, targetMonth, Math.min(day, lastDayOfMonth))

          // Last installment absorbs rounding remainder
          const isLast = i === numInstallments - 1
          const thisAmount = isLast
            ? Math.max(0.01, remainingAmount - installmentAmount * (numInstallments - 1))
            : installmentAmount

          return {
            saleId: newSale.id,
            installment: i + 1,
            amount: new Decimal(Number(thisAmount.toFixed(2))),
            dueDate,
          }
        })

        await tx.receivable.createMany({ data: receivables })
      }

      return newSale
    })

    // Invalidate dashboard cache after sale creation
    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)

    return NextResponse.json(sale, { status: 201 })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
