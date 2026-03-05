import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function diagnose() {
  const clientNames = ['Eder', 'Jessica']

  for (const searchName of clientNames) {
    console.log('\n' + '='.repeat(80))
    console.log(`BUSCANDO CLIENTE: ${searchName}`)
    console.log('='.repeat(80))

    const clients = await prisma.client.findMany({
      where: { name: { contains: searchName, mode: 'insensitive' } },
    })

    if (clients.length === 0) {
      console.log('  Nenhum cliente encontrado')
      continue
    }

    for (const client of clients) {
      console.log(`\nCliente: ${client.name} (ID: ${client.id})`)
      console.log(`  Criado em: ${client.createdAt}`)
      console.log(`  Importado: ${client.importedAt || 'N/A'}`)

      const sales = await prisma.sale.findMany({
        where: { clientId: client.id },
        include: {
          payments: { orderBy: { paidAt: 'asc' } },
          receivables: { orderBy: { installment: 'asc' } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      })

      console.log(`\n  Total de vendas: ${sales.length}`)

      for (const sale of sales) {
        console.log(`\n  --- VENDA ${sale.id} ---`)
        console.log(`    Status: ${sale.status}`)
        console.log(`    Criada em: ${sale.createdAt}`)
        console.log(`    Total: R$ ${Number(sale.total).toFixed(2)}`)
        console.log(`    Pago (sale.paidAmount): R$ ${Number(sale.paidAmount).toFixed(2)}`)
        console.log(`    DueDate: ${sale.dueDate || 'N/A'}`)
        console.log(`    InstallmentPlan: ${sale.installmentPlan}`)
        console.log(`    PaymentDay: ${sale.paymentDay || 'N/A'}`)
        console.log(`    Notas: ${sale.notes || 'N/A'}`)

        console.log(`\n    Items (${sale.items.length}):`)
        for (const item of sale.items) {
          console.log(`      - ${item.product.name} x${item.quantity} = R$ ${Number(item.total).toFixed(2)}`)
        }

        console.log(`\n    Payments (${sale.payments.length}):`)
        for (const p of sale.payments) {
          console.log(`      [${p.id}] ${p.method} R$ ${Number(p.amount).toFixed(2)} em ${p.paidAt} (parcelas: ${p.installments})`)
        }

        // Check for duplicate payments
        const paymentsByAmount = new Map<string, typeof sale.payments>()
        for (const p of sale.payments) {
          const key = `${Number(p.amount).toFixed(2)}-${p.method}`
          if (!paymentsByAmount.has(key)) paymentsByAmount.set(key, [])
          paymentsByAmount.get(key)!.push(p)
        }
        for (const [key, payments] of Array.from(paymentsByAmount.entries())) {
          if (payments.length > 1) {
            console.log(`\n    ⚠️  POSSÍVEL DUPLICATA: ${payments.length}x pagamento ${key}`)
            for (const p of payments) {
              console.log(`        ID: ${p.id} | paidAt: ${p.paidAt}`)
            }
          }
        }

        console.log(`\n    Receivables (${sale.receivables.length}):`)
        for (const r of sale.receivables) {
          const isOverdue = r.dueDate < new Date() && r.status !== 'PAID' && r.status !== 'CANCELLED'
          const isFuture = r.dueDate > new Date()
          console.log(`      [Parcela ${r.installment}] R$ ${Number(r.amount).toFixed(2)} | Pago: R$ ${Number(r.paidAmount).toFixed(2)} | Vence: ${r.dueDate.toISOString().split('T')[0]} | Status: ${r.status} | PaidAt: ${r.paidAt || 'N/A'}${isOverdue ? ' ⚠️ ATRASADO' : ''}${isFuture && r.status === 'PAID' ? ' ⚠️ PAGO COM DATA FUTURA!' : ''}`)
        }

        // Check for receivable anomalies
        const paidFuture = sale.receivables.filter(
          r => r.status === 'PAID' && r.dueDate > new Date()
        )
        if (paidFuture.length > 0) {
          console.log(`\n    ⚠️  ${paidFuture.length} receivable(s) marcados como PAGOS com data futura!`)
        }

        // Sum check
        const totalPayments = sale.payments.reduce((s, p) => s + Number(p.amount), 0)
        const totalReceivablesPaid = sale.receivables
          .filter(r => r.status !== 'CANCELLED')
          .reduce((s, r) => s + Number(r.paidAmount), 0)
        const totalReceivablesAmount = sale.receivables
          .filter(r => r.status !== 'CANCELLED')
          .reduce((s, r) => s + Number(r.amount), 0)

        console.log(`\n    RESUMO:`)
        console.log(`      Soma Payments: R$ ${totalPayments.toFixed(2)}`)
        console.log(`      Soma Receivables paidAmount: R$ ${totalReceivablesPaid.toFixed(2)}`)
        console.log(`      Soma Receivables amount: R$ ${totalReceivablesAmount.toFixed(2)}`)
        console.log(`      sale.paidAmount: R$ ${Number(sale.paidAmount).toFixed(2)}`)

        if (Math.abs(totalPayments - Number(sale.paidAmount)) > 0.02) {
          console.log(`      ⚠️  INCONSISTÊNCIA: sale.paidAmount difere da soma dos payments!`)
        }
      }
    }
  }

  await prisma.$disconnect()
}

diagnose().catch(console.error)
