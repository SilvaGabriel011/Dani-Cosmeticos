import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const TOLERANCE = 0.01

async function detectWrongPayments() {
  try {
    console.log('\n🔍 Detectando pagamentos registrados na venda errada...\n')

    // Buscar todas as vendas com receivables
    const sales = await prisma.sale.findMany({
      where: {
        receivables: {
          some: {},
        },
      },
      include: {
        client: true,
        payments: true,
        receivables: {
          where: { status: { not: 'CANCELLED' } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log(`📊 Total de vendas fiado: ${sales.length}\n`)

    const suspiciousSales = []

    for (const sale of sales) {
      const saleTotal = Number(sale.total)
      const totalPayments = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)
      const totalReceivables = sale.receivables.reduce((sum, r) => sum + Number(r.amount), 0)
      
      // DETECTAR CASO 1: Pagamentos excedem o total da venda
      if (totalPayments > saleTotal + TOLERANCE) {
        const excess = totalPayments - saleTotal
        
        suspiciousSales.push({
          sale,
          issue: 'PAYMENTS_EXCEED_TOTAL',
          excess,
          totalPayments,
          saleTotal,
          description: `Pagamentos (${totalPayments.toFixed(2)}) > Total venda (${saleTotal.toFixed(2)}) | Excesso: R$ ${excess.toFixed(2)}`,
        })
      }
      // DETECTAR CASO 2: Pagamentos muito acima das receivables (pode ser OK, mas suspeito se for muito)
      else if (totalReceivables > 0 && totalPayments > totalReceivables * 1.5) {
        suspiciousSales.push({
          sale,
          issue: 'PAYMENTS_MUCH_HIGHER_THAN_RECEIVABLES',
          excess: totalPayments - totalReceivables,
          totalPayments,
          totalReceivables,
          description: `Pagamentos (${totalPayments.toFixed(2)}) >> Parcelas (${totalReceivables.toFixed(2)}) | Cliente pode ter pago muito acima da parcela`,
        })
      }
    }

    console.log('═'.repeat(80))
    console.log(`📋 RESULTADOS DA DETECÇÃO`)
    console.log('═'.repeat(80))
    console.log(`Vendas suspeitas encontradas: ${suspiciousSales.length}\n`)

    if (suspiciousSales.length === 0) {
      console.log('✅ Nenhuma venda suspeita encontrada!')
      return
    }

    // Agrupar por tipo de problema
    const exceedTotal = suspiciousSales.filter(s => s.issue === 'PAYMENTS_EXCEED_TOTAL')
    const muchHigher = suspiciousSales.filter(s => s.issue === 'PAYMENTS_MUCH_HIGHER_THAN_RECEIVABLES')

    if (exceedTotal.length > 0) {
      console.log(`\n🚨 CRÍTICO: Pagamentos EXCEDEM total da venda (${exceedTotal.length} casos)`)
      console.log('━'.repeat(80))
      
      for (let i = 0; i < exceedTotal.length; i++) {
        const s = exceedTotal[i]
        console.log(`\n${i + 1}. ${s.sale.client?.name || 'Sem cliente'}`)
        console.log(`   Venda ID: ${s.sale.id}`)
        console.log(`   Data: ${s.sale.createdAt.toLocaleDateString('pt-BR')}`)
        console.log(`   Total venda: R$ ${s.saleTotal?.toFixed(2) || '0.00'}`)
        console.log(`   Total pago: R$ ${s.totalPayments?.toFixed(2) || '0.00'}`)
        console.log(`   ⚠️  Excesso: R$ ${s.excess?.toFixed(2) || '0.00'}`)
        console.log(`   Pagamentos (${s.sale.payments.length}):`)
        
        s.sale.payments.forEach((p, j) => {
          console.log(`     ${j + 1}. ${p.paidAt.toLocaleDateString('pt-BR')} - R$ ${Number(p.amount).toFixed(2)} (${p.method}) [ID: ${p.id.substring(0, 8)}...]`)
        })
      }
    }

    if (muchHigher.length > 0) {
      console.log(`\n\n⚠️  SUSPEITO: Pagamentos muito acima das parcelas (${muchHigher.length} casos)`)
      console.log('━'.repeat(80))
      console.log('(Pode ser normal se cliente pagou muito acima da parcela mensal)\n')
      
      for (let i = 0; i < Math.min(muchHigher.length, 10); i++) {
        const s = muchHigher[i]
        console.log(`${i + 1}. ${s.sale.client?.name || 'Sem cliente'} - Pago: R$ ${s.totalPayments?.toFixed(2) || '0.00'} | Parcelas: R$ ${s.totalReceivables?.toFixed(2) || '0.00'}`)
      }
      
      if (muchHigher.length > 10) {
        console.log(`   ... e mais ${muchHigher.length - 10} casos`)
      }
    }

    console.log('\n' + '═'.repeat(80))
    console.log('\n💡 PRÓXIMOS PASSOS:')
    console.log(`  • Revisar manualmente os ${exceedTotal.length} casos CRÍTICOS`)
    console.log('  • Para cada payment suspeito, verificar se foi registrado na venda correta')
    console.log('  • Deletar payments incorretos via: DELETE /api/payments/{id}')
    console.log('  • Após deletar, o sistema recalcula automaticamente\n')

    // Salvar relatório
    const reportPath = `reports/suspicious-payments-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.txt`
    const fs = require('fs')
    const path = require('path')
    
    let report = '═'.repeat(80) + '\n'
    report += 'RELATÓRIO: Pagamentos Suspeitos em Vendas Fiado\n'
    report += '═'.repeat(80) + '\n\n'
    report += `Data: ${new Date().toLocaleString('pt-BR')}\n`
    report += `Total de vendas fiado analisadas: ${sales.length}\n`
    report += `Vendas com problemas: ${suspiciousSales.length}\n\n`
    
    if (exceedTotal.length > 0) {
      report += '🚨 CASOS CRÍTICOS (Pagamentos > Total Venda):\n\n'
      
      exceedTotal.forEach((s, i) => {
        report += `${i + 1}. ${s.sale.client?.name || 'Sem cliente'}\n`
        report += `   ID: ${s.sale.id}\n`
        report += `   Data: ${s.sale.createdAt.toLocaleDateString('pt-BR')}\n`
        report += `   Total: R$ ${s.saleTotal?.toFixed(2) || '0.00'} | Pago: R$ ${s.totalPayments?.toFixed(2) || '0.00'} | Excesso: R$ ${s.excess?.toFixed(2) || '0.00'}\n`
        report += `   Payments:\n`
        s.sale.payments.forEach((p, j) => {
          report += `     ${j + 1}. ${p.paidAt.toLocaleDateString('pt-BR')} - R$ ${Number(p.amount).toFixed(2)} (${p.method})\n`
          report += `        ID: ${p.id}\n`
        })
        report += '\n'
      })
    }
    
    const reportDir = path.join(process.cwd(), 'reports')
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }
    fs.writeFileSync(path.join(process.cwd(), reportPath), report, 'utf-8')
    
    console.log(`📄 Relatório completo salvo em: ${reportPath}\n`)

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

detectWrongPayments()
