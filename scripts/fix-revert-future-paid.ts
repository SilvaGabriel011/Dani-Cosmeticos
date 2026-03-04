import { PrismaClient } from '@prisma/client'

const PAYMENT_TOLERANCE = 0.02
const prisma = new PrismaClient()

async function fixRevertFuturePaid() {
  const now = new Date()

  // Find all non-COMPLETED sales that have receivables marked PAID with future dueDates
  const sales = await prisma.sale.findMany({
    where: {
      status: { not: 'CANCELLED' },
      receivables: {
        some: {
          status: 'PAID',
          dueDate: { gt: now },
        },
      },
    },
    include: {
      client: { select: { name: true } },
      payments: { orderBy: { paidAt: 'asc' } },
      receivables: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { installment: 'asc' },
      },
    },
  })

  console.log(`Found ${sales.length} sales with future PAID receivables\n`)

  let totalReverted = 0
  let totalRedistributed = 0

  for (const sale of sales) {
    const clientName = sale.client?.name || 'Sem cliente'
    const totalPaid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const isFullyPaid = totalPaid >= Number(sale.total) - PAYMENT_TOLERANCE

    // Skip fully paid sales — they should stay COMPLETED
    if (isFullyPaid) {
      console.log(`  [SKIP] ${clientName}: quitado (R$ ${totalPaid.toFixed(2)} / R$ ${Number(sale.total).toFixed(2)})`)
      continue
    }

    console.log(`\n${clientName} (venda ${sale.id.slice(0, 8)}...):`)
    console.log(`  Total: R$ ${Number(sale.total).toFixed(2)}, Pago: R$ ${totalPaid.toFixed(2)}`)

    // Reset ALL receivables first, then redistribute only to due ones
    for (const r of sale.receivables) {
      await prisma.receivable.update({
        where: { id: r.id },
        data: { paidAmount: 0, status: 'PENDING', paidAt: null },
      })
    }

    // Redistribute payments only to receivables with dueDate <= now
    let remaining = totalPaid
    for (const receivable of sale.receivables) {
      const isDue = receivable.dueDate <= now
      if (!isDue) continue

      const receivableAmount = Number(receivable.amount)
      const allocate = Math.min(remaining, receivableAmount)

      let newStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING'
      if (allocate >= receivableAmount - PAYMENT_TOLERANCE) {
        newStatus = 'PAID'
      } else if (allocate > PAYMENT_TOLERANCE) {
        newStatus = 'PARTIAL'
      }

      await prisma.receivable.update({
        where: { id: receivable.id },
        data: {
          paidAmount: Math.max(0, allocate),
          status: newStatus,
          paidAt: newStatus === 'PAID' ? new Date() : null,
        },
      })

      remaining -= allocate
      if (newStatus !== 'PENDING') totalRedistributed++
    }

    // Count reverted (future receivables that were PAID, now PENDING)
    const futureReverted = sale.receivables.filter(r => r.status === 'PAID' && r.dueDate > now)
    totalReverted += futureReverted.length

    for (const r of futureReverted) {
      console.log(`  Parcela ${r.installment} (vence ${r.dueDate.toISOString().split('T')[0]}): PAID -> PENDING`)
    }

    // Ensure sale status is PENDING (not COMPLETED)
    if (sale.status === 'COMPLETED') {
      await prisma.sale.update({
        where: { id: sale.id },
        data: { status: 'PENDING' },
      })
      console.log(`  Sale status: COMPLETED -> PENDING`)
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Receivables revertidas (PAID futuras -> PENDING): ${totalReverted}`)
  console.log(`Receivables redistribuídas (vencidas): ${totalRedistributed}`)
  console.log('='.repeat(60))

  await prisma.$disconnect()
}

fixRevertFuturePaid().catch(console.error)
