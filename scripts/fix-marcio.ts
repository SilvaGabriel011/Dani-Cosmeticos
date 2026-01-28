import { prisma } from "../src/lib/prisma"
import { Decimal } from "@prisma/client/runtime/library"

async function fix() {
  const exists = await prisma.client.findFirst({ where: { name: 'Marcio' } })
  if (exists) {
    console.log('Marcio já existe')
    await prisma.$disconnect()
    return
  }
  
  const now = new Date()
  const client = await prisma.client.create({
    data: { name: 'Marcio', importedAt: now }
  })
  
  const sale = await prisma.sale.create({
    data: {
      clientId: client.id,
      subtotal: new Decimal(655),
      total: new Decimal(655),
      netTotal: new Decimal(655),
      paidAmount: new Decimal(325),
      status: 'PENDING',
      paymentDay: 10,
      installmentPlan: 5,
      notes: 'Importado via script'
    }
  })
  
  const receivables = []
  for (let i = 0; i < 5; i++) {
    let m = now.getMonth() + 1 + i
    let y = now.getFullYear()
    while (m > 11) { m -= 12; y++ }
    receivables.push({
      saleId: sale.id,
      installment: i + 1,
      amount: new Decimal(66),
      dueDate: new Date(y, m, 10)
    })
  }
  
  await prisma.receivable.createMany({ data: receivables })
  console.log('✅ Marcio importado!')
  await prisma.$disconnect()
}

fix().catch(console.error)
