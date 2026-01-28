import { prisma } from "../src/lib/prisma"

async function check() {
  const receivables = await prisma.receivable.findMany({
    take: 15,
    orderBy: { dueDate: 'asc' },
    include: { sale: { include: { client: true } } }
  })
  
  console.log("\n📅 Primeiras 15 parcelas por data de vencimento:\n")
  
  for (const r of receivables) {
    console.log(`${r.sale.client?.name?.padEnd(25)} | Parcela ${r.installment} | Vence: ${r.dueDate.toLocaleDateString('pt-BR')} | R$ ${Number(r.amount).toFixed(2)} | ${r.status}`)
  }
  
  const today = new Date()
  const overdue = await prisma.receivable.count({
    where: {
      dueDate: { lt: today },
      status: { in: ['PENDING', 'PARTIAL'] }
    }
  })
  
  console.log(`\n⚠️  Parcelas vencidas (antes de ${today.toLocaleDateString('pt-BR')}): ${overdue}`)
  
  await prisma.$disconnect()
}

check().catch(console.error)
