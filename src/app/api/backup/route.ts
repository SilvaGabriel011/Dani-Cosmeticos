import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [
      settings,
      brands,
      categories,
      clients,
      products,
      sales,
      saleItems,
      payments,
      receivables,
      stockMovements,
      cancelledSaleLogs,
      productCostEntries,
    ] = await Promise.all([
      prisma.settings.findMany(),
      prisma.brand.findMany(),
      prisma.category.findMany(),
      prisma.client.findMany(),
      prisma.product.findMany(),
      prisma.sale.findMany(),
      prisma.saleItem.findMany(),
      prisma.payment.findMany(),
      prisma.receivable.findMany(),
      prisma.stockMovement.findMany(),
      prisma.cancelledSaleLog.findMany(),
      prisma.productCostEntry.findMany(),
    ])

    const backup = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      settings,
      brands,
      categories,
      clients,
      products,
      sales,
      saleItems,
      payments,
      receivables,
      stockMovements,
      cancelledSaleLogs,
      productCostEntries,
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup-${timestamp}.json`

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
