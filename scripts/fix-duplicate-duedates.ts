import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function buildDueDateFromMonth(baseDate: Date, monthOffset: number, dayOfMonth: number) {
  const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(dayOfMonth, lastDay))
}

async function fixDuplicates() {
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
  })

  let totalFixed = 0
  const fixLog: string[] = []

  for (const sale of sales) {
    const { receivables, paymentDay } = sale
    const clientName = sale.client?.name || 'Sem cliente'
    if (receivables.length < 2 || !paymentDay) continue

    // Check for duplicate dueDates or non-monotonic dates
    const dates = receivables.map(r => r.dueDate.toISOString().split('T')[0])
    const uniqueDates = new Set(dates)
    const isMonotonic = receivables.every((r, i) =>
      i === 0 || r.dueDate > receivables[i - 1].dueDate
    )

    if (uniqueDates.size === dates.length && isMonotonic) continue

    // This sale has issues. Recalculate sequential due dates.
    // Strategy: Use the sale's createdAt and paymentDay to compute correct dates,
    // but handle cases where receivable count != installmentPlan
    const referenceDate = sale.createdAt
    const day = paymentDay
    const monthOffset = referenceDate.getDate() >= day ? 1 : 0

    fixLog.push(`\n${clientName} (venda ${sale.id.slice(0, 8)}...):`)
    let saleFixed = 0

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
        await prisma.receivable.update({
          where: { id: r.id },
          data: { dueDate: expectedDate },
        })
        fixLog.push(`  Parcela ${r.installment}: ${actualStr} -> ${expectedStr}`)
        saleFixed++
        totalFixed++
      }
    }

    if (saleFixed === 0) {
      fixLog.pop() // Remove header if nothing changed
    }
  }

  console.log('='.repeat(60))
  console.log('FIX DUPLICATE DUEDATES - RESULTADO')
  console.log('='.repeat(60))

  for (const line of fixLog) {
    console.log(line)
  }

  console.log(`\nTotal corrigidos: ${totalFixed}`)

  await prisma.$disconnect()
}

fixDuplicates().catch(console.error)
