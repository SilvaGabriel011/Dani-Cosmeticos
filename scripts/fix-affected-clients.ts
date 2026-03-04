import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fix() {
  // === FIX EDER GOUVEIA ===
  // Parcela 3 teve dueDate movida de 08/04 para 08/03 (bug no registerPaymentWithDistribution)
  // Precisamos restaurar para 08/04/2026
  const ederSaleId = 'f4cc8581-511b-4888-8e12-8d99304f4586'

  const ederReceivables = await prisma.receivable.findMany({
    where: { saleId: ederSaleId },
    orderBy: { installment: 'asc' },
  })

  console.log('=== EDER GOUVEIA - ANTES ===')
  for (const r of ederReceivables) {
    console.log(`  Parcela ${r.installment}: dueDate=${r.dueDate.toISOString().split('T')[0]} status=${r.status}`)
  }

  // Parcela 3 (installment 3) should be 2026-04-08, not 2026-03-08
  const parcela3 = ederReceivables.find(r => r.installment === 3)
  if (parcela3) {
    const correctDate = new Date(2026, 3, 8) // April 8, 2026 (month is 0-indexed)
    const currentDate = parcela3.dueDate.toISOString().split('T')[0]

    if (currentDate === '2026-03-08') {
      await prisma.receivable.update({
        where: { id: parcela3.id },
        data: { dueDate: correctDate },
      })
      console.log(`\n  ✅ Parcela 3 corrigida: ${currentDate} → 2026-04-08`)
    } else {
      console.log(`\n  ℹ️ Parcela 3 dueDate já está em ${currentDate}, não precisa corrigir`)
    }
  }

  // Also fix the swapped paidAt on receivables by running recalculate
  // Parcela 1 shows paidAt=Mar 9 but was actually paid Feb 22
  // Parcela 2 shows paidAt=Feb 22 but was actually paid Mar 9
  // The recalculate redistributes by installment order, so we need to set correct paidAt
  const ederPayments = await prisma.payment.findMany({
    where: { saleId: ederSaleId },
    orderBy: { paidAt: 'asc' },
  })

  console.log('\n  Payments (in order):')
  for (const p of ederPayments) {
    console.log(`    ${p.paidAt.toISOString().split('T')[0]} - R$ ${Number(p.amount).toFixed(2)}`)
  }

  // Fix receivable paidAt: parcela 1 was paid by the first payment (Feb 22)
  const parcela1 = ederReceivables.find(r => r.installment === 1)
  const parcela2 = ederReceivables.find(r => r.installment === 2)

  if (parcela1 && parcela2 && ederPayments.length >= 2) {
    // First payment (oldest) should have paid parcela 1
    // Second payment should have paid parcela 2
    const firstPaymentDate = ederPayments[0].paidAt
    const secondPaymentDate = ederPayments[1].paidAt

    if (parcela1.status === 'PAID' && parcela1.paidAt?.getTime() !== firstPaymentDate.getTime()) {
      await prisma.receivable.update({
        where: { id: parcela1.id },
        data: { paidAt: firstPaymentDate },
      })
      console.log(`  ✅ Parcela 1 paidAt corrigido para ${firstPaymentDate.toISOString().split('T')[0]}`)
    }

    if (parcela2.status === 'PAID' && parcela2.paidAt?.getTime() !== secondPaymentDate.getTime()) {
      await prisma.receivable.update({
        where: { id: parcela2.id },
        data: { paidAt: secondPaymentDate },
      })
      console.log(`  ✅ Parcela 2 paidAt corrigido para ${secondPaymentDate.toISOString().split('T')[0]}`)
    }
  }

  // Verify after fix
  const ederAfter = await prisma.receivable.findMany({
    where: { saleId: ederSaleId },
    orderBy: { installment: 'asc' },
  })
  console.log('\n=== EDER GOUVEIA - DEPOIS ===')
  for (const r of ederAfter) {
    console.log(`  Parcela ${r.installment}: dueDate=${r.dueDate.toISOString().split('T')[0]} status=${r.status} paidAt=${r.paidAt?.toISOString().split('T')[0] || 'N/A'}`)
  }

  // === CHECK JESSICA ARAUJO ===
  // Jessica's data looks consistent - two payments applied sequentially
  // Parcela 2 (vence 20/03) marked PAID is expected since 2 payments cover 2 installments
  // No dueDate corruption detected for her receivables
  const jessicaSaleId = '2f7fcf9c-2a81-4985-9e60-56f03fdbef90'

  const jessicaReceivables = await prisma.receivable.findMany({
    where: { saleId: jessicaSaleId },
    orderBy: { installment: 'asc' },
  })

  console.log('\n=== JESSICA ARAUJO ===')
  for (const r of jessicaReceivables) {
    console.log(`  Parcela ${r.installment}: dueDate=${r.dueDate.toISOString().split('T')[0]} status=${r.status} paidAt=${r.paidAt?.toISOString().split('T')[0] || 'N/A'}`)
  }

  // Verify Jessica's due dates are correct (paymentDay=20, 6 installments from Feb 7)
  // Expected: 20/02, 20/03, 20/04, 20/05, 20/06, 20/07
  const jessicaExpectedDates = ['2026-02-20', '2026-03-20', '2026-04-20', '2026-05-20', '2026-06-20', '2026-07-20']
  let jessicaNeedsFix = false
  for (let i = 0; i < jessicaReceivables.length; i++) {
    const actual = jessicaReceivables[i].dueDate.toISOString().split('T')[0]
    const expected = jessicaExpectedDates[i]
    if (actual !== expected) {
      console.log(`  ⚠️ Parcela ${i + 1}: dueDate ${actual} deveria ser ${expected}`)
      jessicaNeedsFix = true
    }
  }
  if (!jessicaNeedsFix) {
    console.log('  ✅ Todas as dueDates da Jessica estão corretas')
  }

  // Fix Jessica paidAt if swapped (same issue as Eder)
  const jessicaPayments = await prisma.payment.findMany({
    where: { saleId: jessicaSaleId },
    orderBy: { paidAt: 'asc' },
  })

  if (jessicaPayments.length >= 2) {
    const jParcela1 = jessicaReceivables.find(r => r.installment === 1)
    const jParcela2 = jessicaReceivables.find(r => r.installment === 2)
    const firstPmt = jessicaPayments[0].paidAt
    const secondPmt = jessicaPayments[1].paidAt

    if (jParcela1?.status === 'PAID' && jParcela1.paidAt?.getTime() !== firstPmt.getTime()) {
      await prisma.receivable.update({
        where: { id: jParcela1.id },
        data: { paidAt: firstPmt },
      })
      console.log(`  ✅ Parcela 1 paidAt corrigido para ${firstPmt.toISOString().split('T')[0]}`)
    }

    if (jParcela2?.status === 'PAID' && jParcela2.paidAt?.getTime() !== secondPmt.getTime()) {
      await prisma.receivable.update({
        where: { id: jParcela2.id },
        data: { paidAt: secondPmt },
      })
      console.log(`  ✅ Parcela 2 paidAt corrigido para ${secondPmt.toISOString().split('T')[0]}`)
    }
  }

  await prisma.$disconnect()
  console.log('\n✅ Correções aplicadas com sucesso!')
}

fix().catch(console.error)
