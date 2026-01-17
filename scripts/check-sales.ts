import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const totalSales = await prisma.sale.count()
  const completedSales = await prisma.sale.count({ where: { status: "COMPLETED" } })
  const pendingSales = await prisma.sale.count({ where: { status: "PENDING" } })
  const totalReceivables = await prisma.receivable.count()
  const overdueReceivables = await prisma.receivable.count({ where: { status: "OVERDUE" } })
  const pendingReceivables = await prisma.receivable.count({ where: { status: "PENDING" } })
  const paidReceivables = await prisma.receivable.count({ where: { status: "PAID" } })
  
  console.log("=== Verificação de Vendas ===")
  console.log(`Total de vendas: ${totalSales}`)
  console.log(`Vendas COMPLETED: ${completedSales}`)
  console.log(`Vendas PENDING (fiado): ${pendingSales}`)
  
  console.log("\n=== Parcelas (Receivables) ===")
  console.log(`Total de parcelas: ${totalReceivables}`)
  console.log(`Parcelas pendentes: ${pendingReceivables}`)
  console.log(`Parcelas vencidas: ${overdueReceivables}`)
  console.log(`Parcelas pagas: ${paidReceivables}`)
  
  if (pendingSales > 0) {
    const fiadoSale = await prisma.sale.findFirst({
      where: { status: "PENDING" },
      include: { 
        client: true,
        receivables: true
      }
    })
    console.log(`\nExemplo de venda fiado:`)
    console.log(`  Cliente: ${fiadoSale?.client?.name}`)
    console.log(`  Total: R$ ${fiadoSale?.total}`)
    console.log(`  Parcelas: ${fiadoSale?.receivables.length}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
