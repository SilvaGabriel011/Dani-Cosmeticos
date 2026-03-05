import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function auditPayment() {
  try {
    const paymentId = 'e8c7f085-1645-4739-8aed-31f2277803e6'
    
    console.log('\n🔍 AUDITORIA DO PAGAMENTO R$ 232,50\n')
    console.log('═'.repeat(80))
    
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        sale: {
          include: {
            client: true,
            receivables: {
              where: { status: { not: 'CANCELLED' } },
            },
            payments: {
              orderBy: { paidAt: 'asc' },
            },
          },
        },
      },
    })
    
    if (!payment) {
      console.log('❌ Pagamento não encontrado')
      return
    }
    
    console.log('\n💳 DADOS DO PAGAMENTO:')
    console.log(`  ID: ${payment.id}`)
    console.log(`  Valor: R$ ${Number(payment.amount).toFixed(2)}`)
    console.log(`  Método: ${payment.method}`)
    console.log(`  Data: ${payment.paidAt.toLocaleString('pt-BR')}`)
    console.log(`  Taxa: ${Number(payment.feePercent)}% = R$ ${Number(payment.feeAmount).toFixed(2)} (${payment.feeAbsorber})`)
    console.log(`  Parcelas (crédito): ${payment.installments}x`)
    
    console.log('\n📊 VENDA ASSOCIADA:')
    console.log(`  ID: ${payment.sale.id}`)
    console.log(`  Cliente: ${payment.sale.client?.name || 'Sem cliente'}`)
    console.log(`  Data venda: ${payment.sale.createdAt.toLocaleDateString('pt-BR')}`)
    console.log(`  Total: R$ ${Number(payment.sale.total).toFixed(2)}`)
    console.log(`  Pago (paidAmount): R$ ${Number(payment.sale.paidAmount).toFixed(2)}`)
    console.log(`  Status: ${payment.sale.status}`)
    
    console.log('\n📦 PARCELAS DA VENDA:')
    const receivables = payment.sale.receivables
    receivables.forEach((r, i) => {
      const remaining = Number(r.amount) - Number(r.paidAmount)
      console.log(`  ${i + 1}. Parcela ${r.installment} - R$ ${Number(r.amount).toFixed(2)} | Pago: R$ ${Number(r.paidAmount).toFixed(2)} | Resta: R$ ${remaining.toFixed(2)} | ${r.status}`)
    })
    
    const totalReceivables = receivables.reduce((sum, r) => sum + Number(r.amount), 0)
    console.log(`  Total parcelas: R$ ${totalReceivables.toFixed(2)}`)
    
    console.log('\n💳 TODOS OS PAGAMENTOS DA VENDA:')
    payment.sale.payments.forEach((p, i) => {
      const isCurrent = p.id === paymentId
      console.log(`  ${i + 1}. ${p.paidAt.toLocaleDateString('pt-BR')} - R$ ${Number(p.amount).toFixed(2)} (${p.method}) ${isCurrent ? '← ESTE PAGAMENTO' : ''}`)
    })
    
    const totalPayments = payment.sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    console.log(`  Total: R$ ${totalPayments.toFixed(2)}`)
    
    console.log('\n🔍 ANÁLISE:')
    
    // 1. Pagamento é maior que o total da venda?
    if (Number(payment.amount) > Number(payment.sale.total)) {
      console.log(`  ⚠️  ALERTA: Pagamento (${Number(payment.amount).toFixed(2)}) > Total venda (${Number(payment.sale.total).toFixed(2)})`)
    }
    
    // 2. Pagamento é maior que o restante das parcelas?
    const remainingReceivables = receivables.reduce((sum, r) => sum + (Number(r.amount) - Number(r.paidAmount)), 0)
    if (Number(payment.amount) > remainingReceivables && remainingReceivables > 0) {
      console.log(`  ⚠️  Pagamento (${Number(payment.amount).toFixed(2)}) > Restante parcelas (${remainingReceivables.toFixed(2)})`)
      console.log(`      Isso é OK se cliente pagou mais que a parcela do mês`)
    }
    
    // 3. Total de payments excede total da venda?
    if (totalPayments > Number(payment.sale.total)) {
      console.log(`  ⚠️  ERRO: Total payments (${totalPayments.toFixed(2)}) > Total venda (${Number(payment.sale.total).toFixed(2)})`)
      console.log(`      Diferença: R$ ${(totalPayments - Number(payment.sale.total)).toFixed(2)}`)
      console.log(`      POSSÍVEL CAUSA: Pagamento registrado na venda errada`)
    }
    
    // 4. Buscar outras vendas no mesmo dia
    console.log('\n🔎 OUTRAS VENDAS NO MESMO DIA (07/02/2026):')
    const sameDaySales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: new Date('2026-02-07T00:00:00'),
          lt: new Date('2026-02-08T00:00:00'),
        },
        id: { not: payment.sale.id },
      },
      include: {
        client: true,
        receivables: {
          where: { status: { not: 'CANCELLED' } },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
    
    if (sameDaySales.length === 0) {
      console.log('  Nenhuma outra venda encontrada neste dia')
    } else {
      sameDaySales.forEach((s, i) => {
        const total = Number(s.total)
        const paidAmount = Number(s.paidAmount)
        const remaining = total - paidAmount
        const totalRec = s.receivables.reduce((sum, r) => sum + Number(r.amount), 0)
        
        console.log(`  ${i + 1}. ${s.client?.name || 'Sem cliente'} - Total: R$ ${total.toFixed(2)} | Pago: R$ ${paidAmount.toFixed(2)} | Resta: R$ ${remaining.toFixed(2)}`)
        
        // Verifica se o pagamento de 232.50 faria sentido nesta venda
        if (Math.abs(232.50 - remaining) < 1 || Math.abs(232.50 - totalRec) < 1) {
          console.log(`      ⚠️  POSSÍVEL MATCH: R$ 232,50 é próximo do restante/parcelas desta venda`)
        }
      })
    }
    
    console.log('\n' + '═'.repeat(80))
    console.log('\n💡 RECOMENDAÇÃO:')
    
    if (totalPayments > Number(payment.sale.total) + 0.01) {
      console.log('  • Este pagamento parece estar NA VENDA ERRADA')
      console.log('  • Revisar manualmente se deveria estar em outra venda')
      console.log(`  • Para deletar: DELETE /api/payments/${paymentId}`)
    } else {
      console.log('  • Pagamento parece correto para esta venda')
      console.log('  • Cliente pode ter pago acima da parcela mensal')
    }
    
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

auditPayment()
