import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// Validation schema: requires explicit confirmation and at minimum the core tables
const restoreSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'É necessário confirmar a restauração com confirm: true' }),
  }),
  data: z.object({
    settings: z.array(z.record(z.unknown())).default([]),
    brands: z.array(z.record(z.unknown())).default([]),
    categories: z.array(z.record(z.unknown())).default([]),
    clients: z.array(z.record(z.unknown())).default([]),
    products: z.array(z.record(z.unknown())).default([]),
    sales: z.array(z.record(z.unknown())).default([]),
    saleItems: z.array(z.record(z.unknown())).default([]),
    payments: z.array(z.record(z.unknown())).default([]),
    receivables: z.array(z.record(z.unknown())).default([]),
    stockMovements: z.array(z.record(z.unknown())).default([]),
    cancelledSaleLogs: z.array(z.record(z.unknown())).default([]),
    productCostEntries: z.array(z.record(z.unknown())).default([]),
  }),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = restoreSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos para restauração',
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { data } = validation.data

    // Cast backup arrays to Prisma input types.
    // The backup was exported from the same schema, so the shape is guaranteed to match.
    const settings = data.settings as Prisma.SettingsCreateManyInput[]
    const brands = data.brands as Prisma.BrandCreateManyInput[]
    const categories = data.categories as Prisma.CategoryCreateManyInput[]
    const clients = data.clients as Prisma.ClientCreateManyInput[]
    const products = data.products as Prisma.ProductCreateManyInput[]
    const sales = data.sales as Prisma.SaleCreateManyInput[]
    const saleItems = data.saleItems as Prisma.SaleItemCreateManyInput[]
    const payments = data.payments as Prisma.PaymentCreateManyInput[]
    const receivables = data.receivables as Prisma.ReceivableCreateManyInput[]
    const stockMovements = data.stockMovements as Prisma.StockMovementCreateManyInput[]
    const cancelledSaleLogs = data.cancelledSaleLogs as Prisma.CancelledSaleLogCreateManyInput[]
    const productCostEntries = data.productCostEntries as Prisma.ProductCostEntryCreateManyInput[]

    // Run everything in a single transaction with extended timeout.
    // Delete order respects FK constraints (non-cascade relations deleted first).
    // Insert order respects FK dependencies.
    await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // --- DELETE (reverse FK order) ---

        // StockMovement references Product and Sale without cascade — must go first
        await tx.stockMovement.deleteMany()

        // ProductCostEntry references Product with cascade — explicit for clarity
        await tx.productCostEntry.deleteMany()

        // CancelledSaleLog has no FK constraints
        await tx.cancelledSaleLog.deleteMany()

        // Deleting Sale cascades to: SaleItem, Payment, Receivable
        await tx.sale.deleteMany()

        // Products can now be safely deleted (StockMovements and CostEntries are gone)
        await tx.product.deleteMany()

        // Clients can now be deleted (Sales are gone)
        await tx.client.deleteMany()

        // Brands and Categories (Products are gone)
        await tx.brand.deleteMany()
        await tx.category.deleteMany()

        // Settings singleton
        await tx.settings.deleteMany()

        // --- INSERT (FK dependency order) ---

        if (settings.length > 0) await tx.settings.createMany({ data: settings })
        if (brands.length > 0) await tx.brand.createMany({ data: brands })
        if (categories.length > 0) await tx.category.createMany({ data: categories })
        if (clients.length > 0) await tx.client.createMany({ data: clients })
        if (products.length > 0) await tx.product.createMany({ data: products })
        if (sales.length > 0) await tx.sale.createMany({ data: sales })
        if (saleItems.length > 0) await tx.saleItem.createMany({ data: saleItems })
        if (payments.length > 0) await tx.payment.createMany({ data: payments })
        if (receivables.length > 0) await tx.receivable.createMany({ data: receivables })
        if (stockMovements.length > 0) await tx.stockMovement.createMany({ data: stockMovements })
        if (cancelledSaleLogs.length > 0) await tx.cancelledSaleLog.createMany({ data: cancelledSaleLogs })
        if (productCostEntries.length > 0) await tx.productCostEntry.createMany({ data: productCostEntries })
      },
      {
        maxWait: 15000,  // 15s to acquire the transaction
        timeout: 120000, // 2 min for the full restore
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Banco de dados restaurado com sucesso.',
      restoredAt: new Date().toISOString(),
    })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
