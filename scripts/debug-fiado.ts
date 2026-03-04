import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugFiado() {
  try {
    // Primeiro, listar todos os clientes para encontrar o nome correto
    const allClients = await prisma.client.findMany({
      orderBy: { name: 'asc' },
    })
    
    console.log(`\n📋 Clientes cadastrados (${allClients.length}):`)
    allClients.forEach((c, i) => console.log(`  ${i + 1}. ${c.name} (ID: ${c.id})`))

    // Buscar vendas do Wallison Henrique
    const client = await prisma.client.findFirst({
      where: {
        name: {
          contains: 'Wallison',
          mode: 'insensitive',
        },
      },
    })

    if (!client) {
      console.log('\n❌ Cliente Wallisson não encontrado')
      console.log('💡 Tente buscar manualmente na lista acima')
      return
    }

    console.log(`\n✅ Cliente encontrado: ${client.name} (ID: ${client.id})`)

    // Buscar vendas fiado desse cliente (vendas com receivables)
    const sales = await prisma.sale.findMany({
      where: {
        clientId: client.id,
        receivables: {
          some: {},
        },
      },
      include: {
        receivables: {
          orderBy: { installment: 'asc' },
        },
        payments: {
          orderBy: { paidAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log(`\n📊 Vendas fiado encontradas: ${sales.length}`)

    for (const sale of sales) {
      const saleRemaining = Number(sale.total) - Number(sale.paidAmount)
      console.log(`\n${'='.repeat(80)}`)
      console.log(`Venda ID: ${sale.id}`)
      console.log(`Data: ${sale.createdAt.toLocaleDateString('pt-BR')}`)
      console.log(`Status: ${sale.status}`)
      console.log(`Total: R$ ${Number(sale.total).toFixed(2)}`)
      console.log(`Pago (paidAmount): R$ ${Number(sale.paidAmount).toFixed(2)}`)
      console.log(`Restante calculado: R$ ${saleRemaining.toFixed(2)}`)
      console.log(`Total Fees: R$ ${Number(sale.totalFees || 0).toFixed(2)}`)
      console.log(`Net Total: R$ ${Number(sale.netTotal || sale.total).toFixed(2)}`)

      console.log(`\n📦 Parcelas (Receivables): ${sale.receivables.length}`)
      for (const r of sale.receivables) {
        const rRemaining = Number(r.amount) - Number(r.paidAmount)
        console.log(
          `  ${r.installment}/${sale.receivables.length} - ` +
            `Valor: R$ ${Number(r.amount).toFixed(2)} | ` +
            `Pago: R$ ${Number(r.paidAmount).toFixed(2)} | ` +
            `Restante: R$ ${rRemaining.toFixed(2)} | ` +
            `Status: ${r.status} | ` +
            `Venc: ${r.dueDate.toLocaleDateString('pt-BR')}`
        )
      }

      const totalReceivablesRemaining = sale.receivables.reduce(
        (sum, r) => sum + (Number(r.amount) - Number(r.paidAmount)),
        0
      )
      console.log(`\n💰 Soma dos restantes das parcelas: R$ ${totalReceivablesRemaining.toFixed(2)}`)

      console.log(`\n💳 Pagamentos registrados: ${sale.payments.length}`)
      for (const p of sale.payments) {
        console.log(
          `  ${p.paidAt.toLocaleDateString('pt-BR')} - ` +
            `R$ ${Number(p.amount).toFixed(2)} (${p.method}) ` +
            `Fee: ${Number(p.feePercent || 0)}% = R$ ${Number(p.feeAmount || 0).toFixed(2)} (${p.feeAbsorber || 'N/A'})`
        )
      }

      const totalPayments = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)
      console.log(`\n💵 Soma total de pagamentos: R$ ${totalPayments.toFixed(2)}`)

      // Comparações
      console.log(`\n🔍 Diagnóstico:`)
      if (Math.abs(Number(sale.paidAmount) - totalPayments) > 0.01) {
        console.log(
          `  ⚠️  INCONSISTÊNCIA: sale.paidAmount (${Number(sale.paidAmount).toFixed(2)}) != soma pagamentos (${totalPayments.toFixed(2)})`
        )
      } else {
        console.log(`  ✅ sale.paidAmount está correto`)
      }

      if (Math.abs(saleRemaining - totalReceivablesRemaining) > 0.01) {
        console.log(
          `  ⚠️  INCONSISTÊNCIA: restante venda (${saleRemaining.toFixed(2)}) != restante parcelas (${totalReceivablesRemaining.toFixed(2)})`
        )
      } else {
        console.log(`  ✅ Restante da venda = restante das parcelas`)
      }
    }
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugFiado()
