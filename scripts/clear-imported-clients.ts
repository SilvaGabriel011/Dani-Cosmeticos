import { prisma } from "../src/lib/prisma"

async function clearImportedClients() {
  console.log("\n🗑️  Limpando clientes importados...\n")
  
  // Get all imported clients (those with importedAt set)
  const importedClients = await prisma.client.findMany({
    where: {
      importedAt: { not: null }
    },
    select: { id: true, name: true }
  })
  
  console.log(`📋 ${importedClients.length} clientes importados encontrados\n`)
  
  if (importedClients.length === 0) {
    console.log("✅ Nenhum cliente importado para limpar")
    await prisma.$disconnect()
    return
  }
  
  const clientIds = importedClients.map(c => c.id)
  
  // Get all sales from these clients
  const sales = await prisma.sale.findMany({
    where: { clientId: { in: clientIds } },
    select: { id: true }
  })
  const saleIds = sales.map(s => s.id)
  
  console.log(`📊 ${saleIds.length} vendas associadas encontradas`)
  
  // Delete in order (respecting foreign keys)
  // Receivables, Payments, and StockMovements are deleted via CASCADE
  
  // Delete sales (this will cascade delete receivables, payments)
  const deletedSales = await prisma.sale.deleteMany({
    where: { clientId: { in: clientIds } }
  })
  console.log(`   ✅ ${deletedSales.count} vendas deletadas`)
  
  // Delete clients
  const deletedClients = await prisma.client.deleteMany({
    where: { id: { in: clientIds } }
  })
  console.log(`   ✅ ${deletedClients.count} clientes deletados`)
  
  console.log("\n" + "=".repeat(50))
  console.log("\n✅ Limpeza concluída!")
  console.log("   Produtos e categorias foram preservados.")
  console.log("\n   Agora você pode reimportar a planilha corrigida.\n")
  
  await prisma.$disconnect()
}

// Run
clearImportedClients().catch(console.error)
