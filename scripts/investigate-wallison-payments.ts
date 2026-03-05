import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigateWallisonPayments() {
  try {
    const saleId = '4f633b91-ba0c-4833-839b-cfb4b028df1c'
    
    console.log('\n🔍 Investigando pagamentos do Wallison Henrique...\n')
    
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        client: true,
        receivables: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { installment: 'asc' },
        },
        payments: {
          orderBy: { paidAt: 'asc' },
        },
        items: true,
      },
    })
    
    if (!sale) {
      console.log('❌ Venda não encontrada')
      return
    }
    
    console.log('📊 VENDA:')
    console.log(`  ID: ${sale.id}`)
    console.log(`  Cliente: ${sale.client?.name}`)
    console.log(`  Data: ${sale.createdAt.toLocaleDateString('pt-BR')}`)
    console.log(`  Total: R$ ${Number(sale.total).toFixed(2)}`)
    console.log(`  Pago (sale.paidAmount): R$ ${Number(sale.paidAmount).toFixed(2)}`)
    console.log(`  Saldo devedor: R$ ${(Number(sale.total) - Number(sale.paidAmount)).toFixed(2)}`)
    
    console.log('\n📦 PARCELAS (Receivables):')
    sale.receivables.forEach((r) => {
      const remaining = Number(r.amount) - Number(r.paidAmount)
      console.log(`  ${r.installment}/${sale.receivables.length} - R$ ${Number(r.amount).toFixed(2)} | Pago: R$ ${Number(r.paidAmount).toFixed(2)} | Resta: R$ ${remaining.toFixed(2)} | ${r.status}`)
    })
    
    const totalReceivables = sale.receivables.reduce((sum, r) => sum + Number(r.amount), 0)
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  Total parcelas: R$ ${totalReceivables.toFixed(2)}`)
    
    console.log('\n💳 PAGAMENTOS (Payments):')
    sale.payments.forEach((p, i) => {
      console.log(`  ${i + 1}. ID: ${p.id}`)
      console.log(`     Data: ${p.paidAt.toLocaleDateString('pt-BR')}`)
      console.log(`     Valor: R$ ${Number(p.amount).toFixed(2)}`)
      console.log(`     Método: ${p.method}`)
      console.log(`     Fee: ${Number(p.feePercent)}% = R$ ${Number(p.feeAmount).toFixed(2)} (${p.feeAbsorber})`)
      console.log('')
    })
    
    const totalPayments = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  Total pago (payments): R$ ${totalPayments.toFixed(2)}`)
    
    console.log('\n🔍 ANÁLISE:')
    console.log(`  • Venda total: R$ ${Number(sale.total).toFixed(2)}`)
    console.log(`  • Parcelas somam: R$ ${totalReceivables.toFixed(2)}`)
    console.log(`  • Diferença (entrada teórica): R$ ${(Number(sale.total) - totalReceivables).toFixed(2)}`)
    console.log(`  • Payments somam: R$ ${totalPayments.toFixed(2)}`)
    console.log(`  • sale.paidAmount: R$ ${Number(sale.paidAmount).toFixed(2)}`)
    console.log(`  • Saldo devedor (sale.total - paidAmount): R$ ${(Number(sale.total) - Number(sale.paidAmount)).toFixed(2)}`)
    console.log(`  • Saldo devedor (sale.total - payments): R$ ${(Number(sale.total) - totalPayments).toFixed(2)}`)
    
    console.log('\n💡 POSSÍVEIS PROBLEMAS:')
    if (Math.abs(totalPayments - Number(sale.paidAmount)) > 0.01) {
      console.log(`  ⚠️  Payments (${totalPayments.toFixed(2)}) != paidAmount (${Number(sale.paidAmount).toFixed(2)})`)
      console.log(`  ➜ Diferença: R$ ${Math.abs(totalPayments - Number(sale.paidAmount)).toFixed(2)}`)
    }
    
    if (Math.abs(totalReceivables - Number(sale.total)) > 0.01) {
      console.log(`  ⚠️  Parcelas (${totalReceivables.toFixed(2)}) != Total venda (${Number(sale.total).toFixed(2)})`)
      console.log(`  ➜ Isso é NORMAL se houver entrada que não virou parcela`)
    }
    
    // Verificar se algum payment tem valor suspeito
    const suspiciousPayments = sale.payments.filter(p => Number(p.amount) > Number(sale.total) * 0.8)
    if (suspiciousPayments.length > 0) {
      console.log(`  ⚠️  Pagamento(s) com valor muito alto (>80% do total):`)
      suspiciousPayments.forEach(p => {
        console.log(`      • R$ ${Number(p.amount).toFixed(2)} em ${p.paidAt.toLocaleDateString('pt-BR')}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

investigateWallisonPayments()
