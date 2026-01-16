import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createSaleSchema } from "@/schemas/sale"
import { Decimal } from "@prisma/client/runtime/library"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const status = searchParams.get("status")
    const clientId = searchParams.get("clientId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const categoryId = searchParams.get("categoryId")
    const productId = searchParams.get("productId")
    const paymentMethod = searchParams.get("paymentMethod")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (status) {
      where.status = status as "COMPLETED" | "PENDING" | "CANCELLED"
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(startDate),
      }
    }

    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(endDate + "T23:59:59.999Z"),
      }
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
        some: { method: paymentMethod },
      }
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          items: { select: { id: true, quantity: true, unitPrice: true, total: true } },
          payments: { select: { method: true, amount: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
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
    console.error("Error fetching sales:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao buscar vendas" } },
      { status: 500 }
    )
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
            code: "VALIDATION_ERROR",
            message: "Dados inválidos",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { items, payments, clientId, discountPercent, notes, paymentDay, installmentPlan } = validation.data

    // Fetch products and validate stock
    const productIds = items.map((item) => item.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, deletedAt: null },
    })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: { code: "INVALID_PRODUCT", message: "Produto inválido ou inativo" } },
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
              code: "INSUFFICIENT_STOCK",
              message: `Estoque insuficiente para ${product.name}`,
            },
          },
          { status: 400 }
        )
      }
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
    const finalDiscountPercent = discountPercent || clientDiscount
    let subtotal = 0
    const saleItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!
      const total = Number(product.salePrice) * item.quantity
      subtotal += total
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.salePrice,
        costPrice: product.costPrice,
        total: new Decimal(total),
      }
    })

    const discountAmount = subtotal * (finalDiscountPercent / 100)
    const subtotalAfterDiscount = subtotal - discountAmount

    // Calculate fees and paid amount
    let totalFees = 0
    let paidAmount = 0
    const salePayments = payments.map((payment) => {
      const feeAmount = payment.amount * (payment.feePercent / 100)
      if (payment.feeAbsorber === "SELLER") {
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
    const isPaid = paidAmount >= total - 0.01
    const saleStatus = (isPaid ? "COMPLETED" : "PENDING") as "COMPLETED" | "PENDING"

    // Fiado sales require a client
    if (!isPaid && !clientId) {
      return NextResponse.json(
        { error: { code: "CLIENT_REQUIRED", message: "Vendas fiado precisam de um cliente vinculado" } },
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
          items: { create: saleItems },
          payments: { create: salePayments.length > 0 ? salePayments : undefined },
        },
        include: {
          client: true,
          items: { include: { product: true } },
          payments: true,
        },
      })

      // Decrement stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })
      }

      // Create receivables for fiado sales (always, even without installments)
      if (!isPaid) {
        const remainingAmount = total - paidAmount
        const numInstallments = installmentPlan && installmentPlan >= 1 ? installmentPlan : 1
        const installmentAmount = remainingAmount / numInstallments
        
        // Calculate due dates based on paymentDay (day of month)
        const now = new Date()
        const day = paymentDay || 10 // Default to day 10 if not specified
        
        const receivables = Array.from({ length: numInstallments }, (_, i) => {
          // Start from current month, but if the day has passed, start from next month
          let targetMonth = now.getMonth() + i
          let targetYear = now.getFullYear()
          
          // If first installment and the day has already passed this month, start next month
          if (i === 0 && now.getDate() >= day) {
            targetMonth += 1
          }
          
          // Handle year overflow
          while (targetMonth > 11) {
            targetMonth -= 12
            targetYear += 1
          }
          
          // Create date, handling months with fewer days
          const dueDate = new Date(targetYear, targetMonth, day)
          // If the day doesn't exist in that month (e.g., Feb 30), it will roll over
          // So we need to check and adjust to last day of month if needed
          if (dueDate.getDate() !== day) {
            dueDate.setDate(0) // Last day of previous month
          }

          return {
            saleId: newSale.id,
            installment: i + 1,
            amount: new Decimal(installmentAmount),
            dueDate,
          }
        })

        await tx.receivable.createMany({ data: receivables })
      }

      return newSale
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (error) {
    console.error("Error creating sale:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao criar venda" } },
      { status: 500 }
    )
  }
}
