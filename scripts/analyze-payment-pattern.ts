import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function analyzePaymentPattern() {
  try {
    console.log('\n🔍 Analisando padrão de erros nos payments...\n')
    
    // Buscar todas as vendas fiado
    const sales = await prisma.sale.findMany({
      where: {
        receivables: { some: {} },
      },
      include: {
        client: true,
        payments: true,
        receivables: {
          where: { status: { not: 'CANCELLED' } },
        },
      },
    })
    
    console.log(`📊 Total de vendas fiado: ${sales.length}\n`)
    
    let issuesFound = 0
    const issues = []
    
    for (const sale of sales) {
      const saleTotal = Number(sale.total)
      const totalPayments = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)
      const totalReceivables = sale.receivables.reduce((sum, r) => sum + Number(r.amount), 0)
      const paidAmount = Number(sale.paidAmount)
      
      // VERIFICAÇÃO 1: sale.paidAmount != soma dos payments
      if (Math.abs(paidAmount - totalPayments) > 0.01) {
        issuesFound++
        issues.push({
          type: 'PAID_AMOUNT_MISMATCH',
          client: sale.client?.name,
          saleId: sale.id,
          paidAmount,
          totalPayments,
          diff: Math.abs(paidAmount - totalPayments),
        })
      }
      
      // VERIFICAÇÃO 2: Payments > Total da venda
      if (totalPayments > saleTotal + 0.01) {
        issuesFound++
        issues.push({
          type: 'OVERPAYMENT',
          client: sale.client?.name,
          saleId: sale.id,
          saleTotal,
          totalPayments,
          excess: totalPayments - saleTotal,
        })
      }
      
      // VERIFICAÇÃO 3: Multiple payments no mesmo dia com valores suspeitos
      const paymentsByDate = new Map<string, number[]>()
      sale.payments.forEach(p => {
        const date = p.paidAt.toISOString().split('T')[0]
        if (!paymentsByDate.has(date)) {
          paymentsByDate.set(date, [])
        }
        paymentsByDate.get(date)!.push(Number(p.amount))
      })
      
      for (const [date, amounts] of Array.from(paymentsByDate.entries())) {
        if (amounts.length > 1) {
          // Múltiplos payments no mesmo dia - pode ser suspeito
          const total = amounts.reduce((sum: number, a: number) => sum + a, 0)
          if (total > saleTotal * 0.8) {
            issuesFound++
            issues.push({
              type: 'MULTIPLE_PAYMENTS_SAME_DAY',
              client: sale.client?.name,
              saleId: sale.id,
              date,
              payments: amounts,
              total,
            })
          }
        }
      }
    }
    
    console.log('═'.repeat(80))
    console.log('📋 RESULTADOS DA ANÁLISE')
    console.log('═'.repeat(80))
    console.log(`Total de problemas encontrados: ${issuesFound}\n`)
    
    if (issuesFound === 0) {
      console.log('✅ Nenhum problema encontrado após a correção!\n')
      return
    }
    
    // Agrupar por tipo
    const paidAmountMismatch = issues.filter(i => i.type === 'PAID_AMOUNT_MISMATCH')
    const overpayments = issues.filter(i => i.type === 'OVERPAYMENT')
    const multiplePayments = issues.filter(i => i.type === 'MULTIPLE_PAYMENTS_SAME_DAY')
    
    if (paidAmountMismatch.length > 0) {
      console.log(`\n⚠️  INCONSISTÊNCIA: sale.paidAmount != soma payments (${paidAmountMismatch.length} casos)`)
      console.log('━'.repeat(80))
      paidAmountMismatch.slice(0, 5).forEach((issue: any) => {
        console.log(`  • ${issue.client}: paidAmount=${issue.paidAmount.toFixed(2)} vs payments=${issue.totalPayments.toFixed(2)} (diff: ${issue.diff.toFixed(2)})`)
      })
      if (paidAmountMismatch.length > 5) {
        console.log(`  ... e mais ${paidAmountMismatch.length - 5} casos`)
      }
    }
    
    if (overpayments.length > 0) {
      console.log(`\n🚨 CRÍTICO: Payments > Total venda (${overpayments.length} casos)`)
      console.log('━'.repeat(80))
      overpayments.forEach((issue: any) => {
        console.log(`  • ${issue.client}: Total=${issue.saleTotal.toFixed(2)}, Payments=${issue.totalPayments.toFixed(2)} (excesso: ${issue.excess.toFixed(2)})`)
      })
    }
    
    if (multiplePayments.length > 0) {
      console.log(`\n⚠️  SUSPEITO: Múltiplos payments no mesmo dia (${multiplePayments.length} casos)`)
      console.log('━'.repeat(80))
      multiplePayments.slice(0, 5).forEach((issue: any) => {
        console.log(`  • ${issue.client} em ${issue.date}: ${issue.payments.length} payments = R$ ${issue.total.toFixed(2)}`)
      })
      if (multiplePayments.length > 5) {
        console.log(`  ... e mais ${multiplePayments.length - 5} casos`)
      }
    }
    
    console.log('\n' + '═'.repeat(80))
    console.log('\n💡 CONCLUSÃO:')
    
    if (overpayments.length > 0 || multiplePayments.length > 0) {
      console.log('  • Há outros casos que podem ter o mesmo problema do Wallison')
      console.log('  • Provável causa: erro manual ao registrar payments')
      console.log('  • Recomendação: adicionar validação no frontend/backend')
    }
    
    if (paidAmountMismatch.length > 0) {
      console.log('  • Há inconsistências entre paidAmount e soma dos payments')
      console.log('  • Executar script de correção em massa se necessário')
    }
    
    console.log('\n📝 RECOMENDAÇÕES DE CÓDIGO:')
    console.log('  1. Adicionar validação: payment não pode exceder saldo devedor')
    console.log('  2. Mostrar warning ao registrar payment maior que a parcela')
    console.log('  3. Impedir múltiplos payments no mesmo dia sem confirmação')
    console.log('  4. Adicionar hook para recalcular paidAmount automaticamente\n')
    
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

analyzePaymentPattern()
