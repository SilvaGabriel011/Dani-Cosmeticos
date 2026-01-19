import { prisma } from "../src/lib/prisma"

async function checkData() {
  // Buscar vendas importadas com seus pagamentos
  const sales = await prisma.sale.findMany({
    where: {
      notes: { contains: "Importado via CSV" }
    },
    include: {
      client: true,
      payments: true,
    },
    take: 20,
  })

  console.log("\n📊 Verificando dados importados:\n")
  
  for (const sale of sales) {
    const totalPayments = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    console.log(`Cliente: ${sale.client?.name}`)
    console.log(`  - Total da venda: R$ ${Number(sale.total).toFixed(2)}`)
    console.log(`  - PaidAmount na venda: R$ ${Number(sale.paidAmount).toFixed(2)}`)
    console.log(`  - Soma dos Payments: R$ ${totalPayments.toFixed(2)}`)
    console.log(`  - Nº de payments: ${sale.payments.length}`)
    console.log("")
  }

  // Resumo
  const totalSales = await prisma.sale.count({
    where: { notes: { contains: "Importado via CSV" } }
  })
  
  const salesWithPayments = await prisma.sale.count({
    where: {
      notes: { contains: "Importado via CSV" },
      payments: { some: {} }
    }
  })

  console.log("=" .repeat(50))
  console.log(`Total de vendas importadas: ${totalSales}`)
  console.log(`Vendas com payments registrados: ${salesWithPayments}`)

  await prisma.$disconnect()
}

checkData().catch(console.error)
