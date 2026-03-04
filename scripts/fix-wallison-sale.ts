import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixWallisonSale() {
  const saleId = '4f633b91-ba0c-4833-839b-cfb4b028df1c'

  try {
    console.log('\n🔧 Corrigindo venda do Wallison Henrique...\n')

    // 1. Recalcular paidAmount baseado nos Payment records
    const payments = await prisma.payment.findMany({
      where: { saleId },
    })

    const totalPaidFromPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    console.log(`💳 Total pago (Payment records): R$ ${totalPaidFromPayments.toFixed(2)}`)

    // 2. Recalcular totalFees
    const totalFees = payments.reduce((sum, p) => {
      if (p.feeAbsorber === 'SELLER') return sum + Number(p.feeAmount)
      return sum
    }, 0)
    console.log(`💸 Total de taxas: R$ ${totalFees.toFixed(2)}`)

    // 3. Buscar a venda
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { receivables: true },
    })

    if (!sale) {
      console.log('❌ Venda não encontrada')
      return
    }

    console.log(`📊 Total da venda: R$ ${Number(sale.total).toFixed(2)}`)
    console.log(`📊 Pago atual (INCORRETO): R$ ${Number(sale.paidAmount).toFixed(2)}`)
    console.log(`📊 Pago correto: R$ ${totalPaidFromPayments.toFixed(2)}`)

    const netTotal = Number(sale.total) - totalFees
    const newRemaining = Number(sale.total) - totalPaidFromPayments

    console.log(`\n🔄 Atualizando sale.paidAmount...`)

    // 4. Atualizar a venda
    await prisma.sale.update({
      where: { id: saleId },
      data: {
        paidAmount: totalPaidFromPayments,
        totalFees,
        netTotal,
      },
    })

    console.log(`✅ sale.paidAmount atualizado para R$ ${totalPaidFromPayments.toFixed(2)}`)
    console.log(`✅ Novo saldo devedor: R$ ${newRemaining.toFixed(2)}`)

    // 5. Verificar parcelas
    console.log(`\n📦 Verificando parcelas...`)
    const receivables = sale.receivables
    const totalReceivables = receivables.reduce((sum, r) => sum + Number(r.amount), 0)
    const totalPaidReceivables = receivables.reduce((sum, r) => sum + Number(r.paidAmount), 0)

    console.log(`  Total nas parcelas: R$ ${totalReceivables.toFixed(2)}`)
    console.log(`  Pago nas parcelas: R$ ${totalPaidReceivables.toFixed(2)}`)

    if (Math.abs(totalReceivables - Number(sale.total)) > 0.01) {
      console.log(`  ⚠️ AVISO: Soma das parcelas (${totalReceivables.toFixed(2)}) != Total venda (${Number(sale.total).toFixed(2)})`)
      console.log(`  💡 Isso pode indicar parcelas duplicadas ou com valores errados`)
    }

    // 6. Verificação final
    console.log(`\n✅ Correção concluída!`)
    console.log(`\n🎯 Resumo final:`)
    console.log(`  • Total da venda: R$ ${Number(sale.total).toFixed(2)}`)
    console.log(`  • Total pago: R$ ${totalPaidFromPayments.toFixed(2)}`)
    console.log(`  • Saldo devedor: R$ ${newRemaining.toFixed(2)}`)
    console.log(`\n💡 Agora o pagamento de R$ ${newRemaining.toFixed(2)} deve funcionar!`)
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixWallisonSale()
