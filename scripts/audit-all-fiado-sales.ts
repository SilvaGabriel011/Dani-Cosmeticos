import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOLERANCE = 0.01

async function auditAllFiadoSales() {
  try {
    console.log('\n🔍 Auditando TODAS as vendas fiado...\n')

    // Buscar todas as vendas com receivables (fiado)
    const sales = await prisma.sale.findMany({
      where: {
        receivables: {
          some: {},
        },
      },
      include: {
        client: true,
        receivables: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { installment: 'asc' },
        },
        payments: {
          orderBy: { paidAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log(`📊 Total de vendas fiado: ${sales.length}\n`)

    const inconsistentSales = []

    for (const sale of sales) {
      const saleTotal = Number(sale.total)
      const salePaid = Number(sale.paidAmount)
      const saleRemaining = saleTotal - salePaid

      // Calcular totais dos receivables
      const totalReceivables = sale.receivables.reduce((sum, r) => sum + Number(r.amount), 0)
      const paidReceivables = sale.receivables.reduce((sum, r) => sum + Number(r.paidAmount), 0)
      const remainingReceivables = totalReceivables - paidReceivables

      // Calcular totais dos payments
      const totalPayments = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)

      // Detectar inconsistências
      const issues = []

      // Issue 1: sale.paidAmount != soma dos payments
      if (Math.abs(salePaid - totalPayments) > TOLERANCE) {
        issues.push(
          `sale.paidAmount (${salePaid.toFixed(2)}) != soma payments (${totalPayments.toFixed(2)})`
        )
      }

      // Issue 2: soma receivables != sale.total
      if (Math.abs(totalReceivables - saleTotal) > TOLERANCE) {
        issues.push(
          `soma receivables (${totalReceivables.toFixed(2)}) != sale.total (${saleTotal.toFixed(2)})`
        )
      }

      // Issue 3: restante da venda != restante das receivables
      if (Math.abs(saleRemaining - remainingReceivables) > TOLERANCE) {
        issues.push(
          `restante venda (${saleRemaining.toFixed(2)}) != restante receivables (${remainingReceivables.toFixed(2)})`
        )
      }

      // Issue 4: pago nas receivables != soma dos payments
      if (Math.abs(paidReceivables - totalPayments) > TOLERANCE) {
        issues.push(
          `pago receivables (${paidReceivables.toFixed(2)}) != soma payments (${totalPayments.toFixed(2)})`
        )
      }

      if (issues.length > 0) {
        inconsistentSales.push({
          sale,
          issues,
          totals: {
            saleTotal,
            salePaid,
            saleRemaining,
            totalReceivables,
            paidReceivables,
            remainingReceivables,
            totalPayments,
          },
        })
      }
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`📋 RESUMO DA AUDITORIA`)
    console.log(`${'='.repeat(80)}`)
    console.log(`Total de vendas fiado: ${sales.length}`)
    console.log(`Vendas COM inconsistências: ${inconsistentSales.length}`)
    console.log(`Vendas SEM inconsistências: ${sales.length - inconsistentSales.length}`)

    if (inconsistentSales.length === 0) {
      console.log('\n✅ Nenhuma inconsistência encontrada!')
      return
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`⚠️  VENDAS COM PROBLEMAS`)
    console.log(`${'='.repeat(80)}`)

    for (const { sale, issues, totals } of inconsistentSales) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`Cliente: ${sale.client?.name || 'SEM CLIENTE'}`)
      console.log(`Venda ID: ${sale.id}`)
      console.log(`Data: ${sale.createdAt.toLocaleDateString('pt-BR')}`)
      console.log(`Status: ${sale.status}`)
      console.log(`\n📊 Valores:`)
      console.log(`  • Total da venda: R$ ${totals.saleTotal.toFixed(2)}`)
      console.log(`  • Pago (sale.paidAmount): R$ ${totals.salePaid.toFixed(2)}`)
      console.log(`  • Restante venda: R$ ${totals.saleRemaining.toFixed(2)}`)
      console.log(`  • Soma receivables: R$ ${totals.totalReceivables.toFixed(2)}`)
      console.log(`  • Pago receivables: R$ ${totals.paidReceivables.toFixed(2)}`)
      console.log(`  • Restante receivables: R$ ${totals.remainingReceivables.toFixed(2)}`)
      console.log(`  • Soma payments: R$ ${totals.totalPayments.toFixed(2)}`)
      console.log(`\n❌ Problemas encontrados:`)
      issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`))
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n💡 Próximos passos:`)
    console.log(`  1. Analisar os problemas acima`)
    console.log(`  2. Identificar a causa raiz (bug no código ou migração de dados?)`)
    console.log(`  3. Criar script de correção sistemática`)
    console.log(`  4. Executar correção em todas as vendas afetadas`)
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

auditAllFiadoSales()
