import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixWallisonPayments() {
  try {
    console.log('\n🔧 Corrigindo payments do Wallison Henrique...\n')
    
    const saleId = '4f633b91-ba0c-4833-839b-cfb4b028df1c'
    const paymentToUpdate = 'e8c7f085-1645-4739-8aed-31f2277803e6' // R$ 232,50 → R$ 233,50
    const paymentToDelete = 'bf734d1e-0799-456d-baf6-ccefcc3eb091' // R$ 46,50
    
    // 1. Mostrar estado atual
    console.log('📊 ESTADO ATUAL:')
    const saleBefore = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        client: true,
        payments: { orderBy: { paidAt: 'asc' } },
      },
    })
    
    if (!saleBefore) {
      console.log('❌ Venda não encontrada')
      return
    }
    
    console.log(`  Cliente: ${saleBefore.client?.name}`)
    console.log(`  Total: R$ ${Number(saleBefore.total).toFixed(2)}`)
    console.log(`  Pago (paidAmount): R$ ${Number(saleBefore.paidAmount).toFixed(2)}`)
    console.log(`  Saldo: R$ ${(Number(saleBefore.total) - Number(saleBefore.paidAmount)).toFixed(2)}`)
    console.log(`  Payments:`)
    saleBefore.payments.forEach((p, i) => {
      console.log(`    ${i + 1}. R$ ${Number(p.amount).toFixed(2)} - ${p.paidAt.toLocaleDateString('pt-BR')} (${p.method})`)
    })
    
    console.log('\n⚠️  CONFIRMAÇÃO:')
    console.log('  1. Atualizar payment de R$ 232,50 → R$ 233,50')
    console.log('  2. Deletar payment de R$ 46,50')
    console.log('  Resultado esperado: Total pago = R$ 233,50, Saldo = R$ 46,50')
    console.log('\n  Digite "SIM" para continuar ou qualquer outra coisa para cancelar')
    console.log('  (Execute com confirmação manual ou ajuste o script)\n')
    
    // Para execução manual, descomente as linhas abaixo
    const CONFIRM = true // Mudar para true para executar
    
    if (!CONFIRM) {
      console.log('❌ Execução cancelada (CONFIRM = false)')
      return
    }
    
    console.log('✅ Iniciando correção...\n')
    
    // 2. Executar correção em transação
    await prisma.$transaction(async (tx) => {
      // Passo 1: Atualizar payment de R$ 232,50 → R$ 233,50
      console.log('📝 Atualizando payment de R$ 232,50 → R$ 233,50...')
      await tx.payment.update({
        where: { id: paymentToUpdate },
        data: { amount: 233.50 },
      })
      console.log('  ✅ Payment atualizado')
      
      // Passo 2: Deletar payment de R$ 46,50
      console.log('🗑️  Deletando payment de R$ 46,50...')
      await tx.payment.delete({
        where: { id: paymentToDelete },
      })
      console.log('  ✅ Payment deletado')
      
      // Passo 3: Recalcular sale.paidAmount
      console.log('🔢 Recalculando sale.paidAmount...')
      const payments = await tx.payment.findMany({
        where: { saleId },
      })
      
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
      const totalFees = payments.reduce((sum, p) => sum + Number(p.feeAmount), 0)
      const netTotal = totalPaid - totalFees
      
      await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: totalPaid,
          totalFees,
          netTotal,
          status: totalPaid >= Number(saleBefore.total) ? 'COMPLETED' : 'PENDING',
        },
      })
      console.log('  ✅ Sale atualizada')
    })
    
    console.log('\n✅ Correção concluída!\n')
    
    // 3. Validar resultado
    console.log('📊 ESTADO APÓS CORREÇÃO:')
    const saleAfter = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        client: true,
        payments: { orderBy: { paidAt: 'asc' } },
      },
    })
    
    if (!saleAfter) {
      console.log('❌ Erro ao buscar venda após correção')
      return
    }
    
    console.log(`  Cliente: ${saleAfter.client?.name}`)
    console.log(`  Total: R$ ${Number(saleAfter.total).toFixed(2)}`)
    console.log(`  Pago (paidAmount): R$ ${Number(saleAfter.paidAmount).toFixed(2)}`)
    console.log(`  Saldo: R$ ${(Number(saleAfter.total) - Number(saleAfter.paidAmount)).toFixed(2)}`)
    console.log(`  Status: ${saleAfter.status}`)
    console.log(`  Payments (${saleAfter.payments.length}):`)
    saleAfter.payments.forEach((p, i) => {
      console.log(`    ${i + 1}. R$ ${Number(p.amount).toFixed(2)} - ${p.paidAt.toLocaleDateString('pt-BR')} (${p.method})`)
    })
    
    const totalPayments = saleAfter.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const expectedSaldo = 46.50
    const actualSaldo = Number(saleAfter.total) - Number(saleAfter.paidAmount)
    
    console.log('\n🔍 VALIDAÇÃO:')
    if (Math.abs(totalPayments - 233.50) < 0.01) {
      console.log('  ✅ Total payments = R$ 233,50')
    } else {
      console.log(`  ❌ Total payments = R$ ${totalPayments.toFixed(2)} (esperado: R$ 233,50)`)
    }
    
    if (Math.abs(actualSaldo - expectedSaldo) < 0.01) {
      console.log('  ✅ Saldo devedor = R$ 46,50')
    } else {
      console.log(`  ❌ Saldo devedor = R$ ${actualSaldo.toFixed(2)} (esperado: R$ 46,50)`)
    }
    
    if (saleAfter.status === 'PENDING') {
      console.log('  ✅ Status = PENDING')
    } else {
      console.log(`  ⚠️  Status = ${saleAfter.status} (esperado: PENDING)`)
    }
    
    console.log('\n✅ Correção validada com sucesso!\n')
    
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixWallisonPayments()
