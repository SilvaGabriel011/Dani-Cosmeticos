import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Buscando vendas canceladas existentes...')

  const cancelledSales = await prisma.sale.findMany({
    where: { status: 'CANCELLED' },
    include: {
      client: true,
      items: { include: { product: true } },
      payments: true,
    },
  })

  console.log(`📋 Encontradas ${cancelledSales.length} vendas canceladas`)

  if (cancelledSales.length === 0) {
    console.log('✅ Nenhuma venda cancelada para limpar')
    return
  }

  for (const sale of cancelledSales) {
    const itemsSummary = sale.items
      .map((i) => `${i.product.name} x${i.quantity}`)
      .join(', ')
    const paymentMethods =
      Array.from(new Set(sale.payments.map((p) => p.method))).join(', ') || null

    await prisma.$transaction(async (tx) => {
      // Create audit log
      await tx.cancelledSaleLog.create({
        data: {
          originalSaleId: sale.id,
          clientName: sale.client?.name || null,
          total: sale.total,
          itemCount: sale.items.reduce((sum, i) => sum + i.quantity, 0),
          itemsSummary,
          paymentMethods,
          saleCreatedAt: sale.createdAt,
          notes: sale.notes,
        },
      })

      // Delete stock movements (no cascade)
      await tx.stockMovement.deleteMany({
        where: { saleId: sale.id },
      })

      // Delete sale (cascades to SaleItem, Payment, Receivable)
      await tx.sale.delete({
        where: { id: sale.id },
      })
    })

    console.log(`  🗑️  Removida: ${sale.id} | ${sale.client?.name || 'Sem cliente'} | R$ ${sale.total}`)
  }

  console.log(`\n✅ ${cancelledSales.length} vendas canceladas migradas para log e removidas`)
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
