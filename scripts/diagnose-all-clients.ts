import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function buildDueDateFromMonth(baseDate: Date, monthOffset: number, dayOfMonth: number) {
  const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(dayOfMonth, lastDay))
}

async function diagnoseAll() {
  // Get all sales with receivables
  const sales = await prisma.sale.findMany({
    where: {
      status: { not: 'CANCELLED' },
      receivables: { some: {} },
    },
    include: {
      client: { select: { name: true } },
      receivables: { orderBy: { installment: 'asc' } },
      payments: { orderBy: { paidAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Total de vendas com receivables: ${sales.length}\n`)

  const issues: Array<{
    clientName: string
    saleId: string
    type: string
    detail: string
    receivableId: string
    currentDueDate: string
    expectedDueDate?: string
  }> = []

  for (const sale of sales) {
    const clientName = sale.client?.name || 'Sem cliente'
    const paymentDay = sale.paymentDay
    const installmentPlan = sale.installmentPlan
    const nonCancelled = sale.receivables.filter(r => r.status !== 'CANCELLED')

    if (nonCancelled.length === 0) continue

    // Check 1: Duplicate due dates (two different parcelas with same dueDate)
    const dueDateMap = new Map<string, typeof nonCancelled>()
    for (const r of nonCancelled) {
      const key = r.dueDate.toISOString().split('T')[0]
      if (!dueDateMap.has(key)) dueDateMap.set(key, [])
      dueDateMap.get(key)!.push(r)
    }

    for (const [date, receivables] of Array.from(dueDateMap.entries())) {
      if (receivables.length > 1) {
        // Check if they have different installment numbers (which means a date was corrupted)
        const installments = receivables.map(r => r.installment)
        const hasDistinctInstallments = new Set(installments).size > 1
        if (hasDistinctInstallments) {
          for (const r of receivables) {
            issues.push({
              clientName,
              saleId: sale.id,
              type: 'DUPLICATE_DUEDATE',
              detail: `Parcela ${r.installment} compartilha dueDate ${date} com outra parcela`,
              receivableId: r.id,
              currentDueDate: date,
            })
          }
        }
      }
    }

    // Check 2: Due dates out of expected order (non-monotonic for sequential installments)
    for (let i = 1; i < nonCancelled.length; i++) {
      const prev = nonCancelled[i - 1]
      const curr = nonCancelled[i]
      if (curr.installment > prev.installment && curr.dueDate <= prev.dueDate) {
        issues.push({
          clientName,
          saleId: sale.id,
          type: 'NON_MONOTONIC_DATES',
          detail: `Parcela ${curr.installment} (${curr.dueDate.toISOString().split('T')[0]}) não é posterior à parcela ${prev.installment} (${prev.dueDate.toISOString().split('T')[0]})`,
          receivableId: curr.id,
          currentDueDate: curr.dueDate.toISOString().split('T')[0],
        })
      }
    }

    // Check 3: If we know the paymentDay and installment plan, verify expected dates
    if (paymentDay && installmentPlan > 1 && nonCancelled.length === installmentPlan) {
      // Reconstruct expected due dates from the sale creation date
      const referenceDate = sale.createdAt
      const day = paymentDay

      for (let i = 0; i < nonCancelled.length; i++) {
        const r = nonCancelled[i]

        // The sale creation logic: if referenceDate.getDate() >= day, start from next month
        const monthOffset = referenceDate.getDate() >= day ? 1 : 0
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
          issues.push({
            clientName,
            saleId: sale.id,
            type: 'WRONG_DUEDATE',
            detail: `Parcela ${r.installment}: dueDate ${actualStr} deveria ser ${expectedStr}`,
            receivableId: r.id,
            currentDueDate: actualStr,
            expectedDueDate: expectedStr,
          })
        }
      }
    }

    // Check 4: Receivables marked as PAID for future dates
    const now = new Date()
    for (const r of nonCancelled) {
      if (r.status === 'PAID' && r.dueDate > now) {
        // This isn't necessarily wrong (early payment), but flag it
        issues.push({
          clientName,
          saleId: sale.id,
          type: 'PAID_FUTURE',
          detail: `Parcela ${r.installment} marcada PAID mas vence em ${r.dueDate.toISOString().split('T')[0]} (futuro)`,
          receivableId: r.id,
          currentDueDate: r.dueDate.toISOString().split('T')[0],
        })
      }
    }
  }

  // Print results grouped by type
  const criticalTypes = ['DUPLICATE_DUEDATE', 'NON_MONOTONIC_DATES', 'WRONG_DUEDATE']
  const criticalIssues = issues.filter(i => criticalTypes.includes(i.type))
  const paidFuture = issues.filter(i => i.type === 'PAID_FUTURE')

  console.log('=' .repeat(80))
  console.log('PROBLEMAS CRÍTICOS (datas corrompidas)')
  console.log('=' .repeat(80))

  if (criticalIssues.length === 0) {
    console.log('  Nenhum problema crítico encontrado!')
  } else {
    // Group by client + sale
    const grouped = new Map<string, typeof criticalIssues>()
    for (const issue of criticalIssues) {
      const key = `${issue.clientName} (${issue.saleId})`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(issue)
    }

    for (const [key, issues] of Array.from(grouped.entries())) {
      console.log(`\n  ${key}:`)
      for (const issue of issues) {
        console.log(`    [${issue.type}] ${issue.detail}`)
        if (issue.expectedDueDate) {
          console.log(`      → Corrigir para: ${issue.expectedDueDate} (receivableId: ${issue.receivableId})`)
        }
      }
    }
  }

  console.log('\n' + '=' .repeat(80))
  console.log('PARCELAS PAGAS COM DATA FUTURA (pode ser pagamento antecipado legítimo)')
  console.log('=' .repeat(80))

  if (paidFuture.length === 0) {
    console.log('  Nenhuma encontrada')
  } else {
    const grouped = new Map<string, typeof paidFuture>()
    for (const issue of paidFuture) {
      const key = `${issue.clientName} (${issue.saleId.slice(0, 8)}...)`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(issue)
    }

    for (const [key, issues] of Array.from(grouped.entries())) {
      console.log(`\n  ${key}:`)
      for (const issue of issues) {
        console.log(`    ${issue.detail}`)
      }
    }
  }

  // Generate fix SQL/commands for critical issues with WRONG_DUEDATE
  const fixable = criticalIssues.filter(i => i.type === 'WRONG_DUEDATE' && i.expectedDueDate)
  if (fixable.length > 0) {
    console.log('\n' + '=' .repeat(80))
    console.log('CORREÇÕES NECESSÁRIAS')
    console.log('=' .repeat(80))
    for (const fix of fixable) {
      console.log(`  UPDATE "Receivable" SET "dueDate" = '${fix.expectedDueDate}' WHERE id = '${fix.receivableId}';`)
      console.log(`    -- ${fix.clientName}: ${fix.detail}`)
    }
  }

  console.log(`\n\nRESUMO: ${criticalIssues.length} problemas críticos, ${paidFuture.length} parcelas pagas com data futura`)

  await prisma.$disconnect()
}

diagnoseAll().catch(console.error)
