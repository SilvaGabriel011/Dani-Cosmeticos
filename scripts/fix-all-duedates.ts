import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixAll() {
  // Get all non-cancelled sales with receivables and known paymentDay + installmentPlan
  const sales = await prisma.sale.findMany({
    where: {
      status: { not: 'CANCELLED' },
      receivables: { some: {} },
    },
    include: {
      client: { select: { name: true } },
      receivables: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { installment: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  let totalFixed = 0
  let totalSkipped = 0
  const fixLog: string[] = []

  for (const sale of sales) {
    const { paymentDay, installmentPlan, receivables, createdAt } = sale
    const clientName = sale.client?.name || 'Sem cliente'

    if (!paymentDay || installmentPlan < 1 || receivables.length !== installmentPlan) {
      continue
    }

    const referenceDate = createdAt
    const day = paymentDay

    // Recalculate expected due dates using the same logic as sale creation
    const monthOffset = referenceDate.getDate() >= day ? 1 : 0

    let hasChanges = false
    const updates: Array<{ id: string; installment: number; currentDate: string; expectedDate: string }> = []

    for (let i = 0; i < receivables.length; i++) {
      const r = receivables[i]

      let targetMonth = referenceDate.getMonth() + i + monthOffset
      let targetYear = referenceDate.getFullYear()

      while (targetMonth > 11) {
        targetMonth -= 12
        targetYear += 1
      }

      const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
      const expectedDate = new Date(targetYear, targetMonth, Math.min(day, lastDayOfMonth))
      const expectedStr = expectedDate.toISOString().split('T')[0]
      const actualStr = r.dueDate.toISOString().split('T')[0]

      if (actualStr !== expectedStr) {
        hasChanges = true
        updates.push({
          id: r.id,
          installment: r.installment,
          currentDate: actualStr,
          expectedDate: expectedStr,
        })
      }
    }

    if (hasChanges) {
      fixLog.push(`\n${clientName} (venda ${sale.id.slice(0, 8)}...):`)
      for (const u of updates) {
        await prisma.receivable.update({
          where: { id: u.id },
          data: { dueDate: new Date(u.expectedDate) },
        })
        fixLog.push(`  Parcela ${u.installment}: ${u.currentDate} -> ${u.expectedDate}`)
        totalFixed++
      }
    } else {
      totalSkipped++
    }
  }

  // Print results
  console.log('='.repeat(60))
  console.log('CORREÇÃO DE DUEDATES - RESULTADO')
  console.log('='.repeat(60))

  for (const line of fixLog) {
    console.log(line)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Receivables corrigidos: ${totalFixed}`)
  console.log(`Vendas sem alteração: ${totalSkipped}`)
  console.log('='.repeat(60))

  await prisma.$disconnect()
}

fixAll().catch(console.error)
