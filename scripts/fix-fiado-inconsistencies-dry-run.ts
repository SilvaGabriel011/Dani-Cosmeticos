import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()
const TOLERANCE = 0.01

interface SaleToFix {
  id: string
  clientName: string
  current: {
    total: number
    paidAmount: number
    totalFees: number
    netTotal: number
    status: string
  }
  new: {
    paidAmount: number
    totalFees: number
    netTotal: number
    status: string
  }
  changes: string[]
}

async function dryRunFix() {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')
    const reportDir = path.join(process.cwd(), 'reports')
    const reportPath = path.join(reportDir, `dry-run-${timestamp}.txt`)

    console.log('\n🔍 Executando DRY-RUN - NENHUM DADO SERÁ ALTERADO\n')

    // Buscar todas as vendas com receivables
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
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log(`📊 Total de vendas fiado: ${sales.length}\n`)

    const salesToFix: SaleToFix[] = []

    for (const sale of sales) {
      const saleTotal = Number(sale.total)
      const currentPaidAmount = Number(sale.paidAmount)
      const currentTotalFees = Number(sale.totalFees || 0)
      const currentNetTotal = Number(sale.netTotal || sale.total)
      const currentStatus = sale.status

      // Calcular valores corretos
      const totalPayments = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)
      const correctTotalFees = sale.payments.reduce((sum, p) => {
        if (p.feeAbsorber === 'SELLER') return sum + Number(p.feeAmount)
        return sum
      }, 0)
      const correctNetTotal = saleTotal - correctTotalFees
      const correctStatus = totalPayments >= saleTotal - TOLERANCE ? 'COMPLETED' : 'PENDING'

      // Detectar se precisa correção
      const changes: string[] = []

      if (Math.abs(currentPaidAmount - totalPayments) > TOLERANCE) {
        changes.push(
          `paidAmount: ${currentPaidAmount.toFixed(2)} → ${totalPayments.toFixed(2)} (${totalPayments > currentPaidAmount ? '+' : ''}${(totalPayments - currentPaidAmount).toFixed(2)})`
        )
      }

      if (Math.abs(currentTotalFees - correctTotalFees) > TOLERANCE) {
        changes.push(
          `totalFees: ${currentTotalFees.toFixed(2)} → ${correctTotalFees.toFixed(2)} (${correctTotalFees > currentTotalFees ? '+' : ''}${(correctTotalFees - currentTotalFees).toFixed(2)})`
        )
      }

      if (Math.abs(currentNetTotal - correctNetTotal) > TOLERANCE) {
        changes.push(
          `netTotal: ${currentNetTotal.toFixed(2)} → ${correctNetTotal.toFixed(2)} (${correctNetTotal > currentNetTotal ? '+' : ''}${(correctNetTotal - currentNetTotal).toFixed(2)})`
        )
      }

      if (currentStatus !== correctStatus) {
        changes.push(`status: ${currentStatus} → ${correctStatus}`)
      }

      if (changes.length > 0) {
        salesToFix.push({
          id: sale.id,
          clientName: sale.client?.name || 'SEM CLIENTE',
          current: {
            total: saleTotal,
            paidAmount: currentPaidAmount,
            totalFees: currentTotalFees,
            netTotal: currentNetTotal,
            status: currentStatus,
          },
          new: {
            paidAmount: totalPayments,
            totalFees: correctTotalFees,
            netTotal: correctNetTotal,
            status: correctStatus,
          },
          changes,
        })
      }
    }

    // Gerar relatório
    let report = ''
    report += '═'.repeat(80) + '\n'
    report += 'DRY-RUN: CORREÇÃO DE DADOS INCONSISTENTES EM VENDAS FIADO\n'
    report += '═'.repeat(80) + '\n\n'
    report += `Data: ${new Date().toLocaleString('pt-BR')}\n`
    report += `Total de vendas fiado: ${sales.length}\n`
    report += `Vendas COM inconsistências: ${salesToFix.length}\n`
    report += `Vendas SEM inconsistências: ${sales.length - salesToFix.length}\n\n`

    if (salesToFix.length === 0) {
      report += '✅ NENHUMA INCONSISTÊNCIA ENCONTRADA!\n'
      report += 'Não há necessidade de executar a correção.\n\n'
    } else {
      report += '⚠️  VENDAS QUE SERÃO ALTERADAS:\n\n'

      for (let i = 0; i < salesToFix.length; i++) {
        const sale = salesToFix[i]
        report += '━'.repeat(80) + '\n'
        report += `${i + 1}. Cliente: ${sale.clientName}\n`
        report += `   Venda ID: ${sale.id}\n\n`
        report += `   ANTES:\n`
        report += `     • Total: R$ ${sale.current.total.toFixed(2)}\n`
        report += `     • Pago: R$ ${sale.current.paidAmount.toFixed(2)}\n`
        report += `     • Taxas: R$ ${sale.current.totalFees.toFixed(2)}\n`
        report += `     • Total Líquido: R$ ${sale.current.netTotal.toFixed(2)}\n`
        report += `     • Status: ${sale.current.status}\n\n`
        report += `   DEPOIS:\n`
        report += `     • Total: R$ ${sale.current.total.toFixed(2)} (sem mudança)\n`
        report += `     • Pago: R$ ${sale.new.paidAmount.toFixed(2)}\n`
        report += `     • Taxas: R$ ${sale.new.totalFees.toFixed(2)}\n`
        report += `     • Total Líquido: R$ ${sale.new.netTotal.toFixed(2)}\n`
        report += `     • Status: ${sale.new.status}\n\n`
        report += `   MUDANÇAS:\n`
        sale.changes.forEach((change: string) => {
          report += `     ✓ ${change}\n`
        })
        report += '\n'
      }

      report += '═'.repeat(80) + '\n\n'
      report += '⚠️  IMPORTANTE:\n'
      report += '• Este é um DRY-RUN - NENHUM DADO FOI ALTERADO\n'
      report += '• Para executar a correção real, use o script fix-fiado-inconsistencies.ts\n'
      report += '• Certifique-se de ter um backup antes de executar a correção real\n\n'
      report += `📊 RESUMO: ${salesToFix.length} vendas serão corrigidas\n`
    }

    // Salvar relatório
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }
    fs.writeFileSync(reportPath, report, 'utf-8')

    // Exibir no console
    console.log(report)

    console.log(`\n✅ Relatório salvo em: ${reportPath}`)
    console.log(`\n💡 Próximos passos:`)
    console.log(`   1. Revisar o relatório acima`)
    console.log(`   2. Se aprovar, executar: npx tsx scripts/fix-fiado-inconsistencies.ts`)
    console.log(`   3. Validar resultados com: npx tsx scripts/audit-all-fiado-sales.ts`)
  } catch (error) {
    console.error('❌ Erro:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

dryRunFix()
