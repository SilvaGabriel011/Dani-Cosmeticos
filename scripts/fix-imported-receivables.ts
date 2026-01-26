import { Decimal } from "@prisma/client/runtime/library"

import { prisma } from "../src/lib/prisma"

async function fixImportedReceivables() {
  console.log("\n🔍 Verificando vendas importadas...\n")

  // Buscar vendas importadas que têm paidAmount > 0 mas receivables com paidAmount = 0
  const sales = await prisma.sale.findMany({
    where: {
      notes: { contains: "Importado via CSV" },
      paidAmount: { gt: 0 },
    },
    include: {
      client: true,
      receivables: {
        orderBy: { installment: "asc" },
      },
    },
  })

  console.log(`📊 Encontradas ${sales.length} vendas importadas com pagamentos\n`)

  let fixed = 0
  
  for (const sale of sales) {
    const salePaidAmount = Number(sale.paidAmount)
    const receivablesPaidTotal = sale.receivables.reduce((sum, r) => sum + Number(r.paidAmount), 0)
    
    // Se a venda tem paidAmount mas os receivables não refletem isso
    if (salePaidAmount > 0 && receivablesPaidTotal === 0) {
      console.log(`\n🔧 Corrigindo: ${sale.client?.name}`)
      console.log(`   Sale.paidAmount: R$ ${salePaidAmount.toFixed(2)}`)
      console.log(`   Receivables.paidAmount total: R$ ${receivablesPaidTotal.toFixed(2)}`)
      
      // Distribuir o valor pago entre os receivables (do mais antigo para o mais recente)
      let remainingPaid = salePaidAmount
      
      for (const receivable of sale.receivables) {
        if (remainingPaid <= 0) break
        
        const receivableAmount = Number(receivable.amount)
        const toPay = Math.min(remainingPaid, receivableAmount)
        
        const newStatus = toPay >= receivableAmount ? "PAID" : (toPay > 0 ? "PARTIAL" : "PENDING")
        
        await prisma.receivable.update({
          where: { id: receivable.id },
          data: {
            paidAmount: new Decimal(toPay),
            status: newStatus,
            paidAt: newStatus === "PAID" ? sale.createdAt : null,
          },
        })
        
        console.log(`   - Parcela ${receivable.installment}: R$ ${toPay.toFixed(2)} (${newStatus})`)
        
        remainingPaid -= toPay
      }
      
      fixed++
    }
  }

  console.log("\n" + "=".repeat(50))
  console.log(`\n✅ Corrigidas ${fixed} vendas`)

  await prisma.$disconnect()
}

fixImportedReceivables().catch(console.error)
