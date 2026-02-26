import { PrismaClient, Prisma } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function fixStock() {
  console.log('=== Fix Estoque Duplicado ===\n')

  // Step 1: Backup all products before changes
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, stock: true, costPrice: true },
    where: { deletedAt: null },
  })

  const backup = allProducts.map((p) => ({
    id: p.id,
    name: p.name,
    stock: p.stock,
    costPrice: Number(p.costPrice),
  }))

  const backupPath = path.join(__dirname, '..', 'backup-stock-before-fix.json')
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8')
  console.log(`Backup salvo em: ${backupPath}`)
  console.log(`Total de produtos: ${allProducts.length}\n`)

  // Step 2: Fix stock for products with costPrice > 0
  const productsToFix = allProducts.filter((p) => Number(p.costPrice) > 0)
  console.log(`Produtos com costPrice > 0 (estoque será dividido por 2): ${productsToFix.length}`)

  let fixedCount = 0
  for (const product of productsToFix) {
    const newStock = Math.floor(product.stock / 2)
    const diff = product.stock - newStock

    await prisma.product.update({
      where: { id: product.id },
      data: { stock: newStock },
    })

    // Register stock movement for audit
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: 'ADJUSTMENT',
        quantity: -diff,
        notes: 'Correção estoque duplicado (import duplo)',
        previousStock: product.stock,
        newStock: newStock,
      },
    })

    fixedCount++
    if (fixedCount % 50 === 0) {
      console.log(`  ...${fixedCount}/${productsToFix.length} corrigidos`)
    }
  }
  console.log(`${fixedCount} produtos tiveram estoque corrigido.\n`)

  // Step 3: Set costPrice = 0 for ALL products
  const result = await prisma.product.updateMany({
    data: { costPrice: new Prisma.Decimal(0) },
  })
  console.log(`costPrice zerado em ${result.count} produtos.\n`)

  console.log('=== Correção concluída! ===')
  console.log(`Backup para reverter: ${backupPath}`)
}

fixStock()
  .catch((e) => {
    console.error('Erro:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
