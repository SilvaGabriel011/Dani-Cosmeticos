import { PrismaClient, SaleStatus } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()
const TOLERANCE = 0.01

// ⚠️  CONFIRMAÇÃO OBRIGATÓRIA
// Altere para true SOMENTE após revisar o dry-run
const CONFIRMED = true

async function fixFiadoInconsistencies() {
  if (!CONFIRMED) {
    console.error('\n❌ ERRO: Confirmação necessária!')
    console.error('   1. Execute primeiro: npx tsx scripts/fix-fiado-inconsistencies-dry-run.ts')
    console.error('   2. Revise o relatório gerado')
    console.error('   3. Altere CONFIRMED = true neste arquivo')
    console.error('   4. Execute novamente\n')
    process.exit(1)
  }

  try {
    console.log('\n🔧 Iniciando correção de dados inconsistentes...\n')

    // Validação 1: Verificar se existe backup recente
    const backupDir = path.join(process.cwd(), 'backups')
    if (!fs.existsSync(backupDir)) {
      throw new Error('Diretório de backup não encontrado. Execute backup-database.ts primeiro!')
    }

    const backupFiles = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('backup-fiado-fix-'))
      .sort()
      .reverse()

    if (backupFiles.length === 0) {
      throw new Error('Nenhum backup encontrado. Execute backup-database.ts primeiro!')
    }

    const latestBackup = backupFiles[0]
    const backupPath = path.join(backupDir, latestBackup)
    const backupStats = fs.statSync(backupPath)
    const backupAge = Date.now() - backupStats.mtimeMs

    // Backup deve ter menos de 1 hora
    if (backupAge > 60 * 60 * 1000) {
      throw new Error('Backup muito antigo. Crie um novo backup antes de continuar!')
    }

    console.log(`✅ Backup encontrado: ${latestBackup}`)
    console.log(`   Criado há ${Math.round(backupAge / 1000 / 60)} minutos\n`)

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
    })

    const salesToFix: Array<{
      id: string
      clientName: string
      newData: {
        paidAmount: number
        totalFees: number
        netTotal: number
        status: SaleStatus
      }
    }> = []

    for (const sale of sales) {
      const saleTotal = Number(sale.total)
      const currentPaidAmount = Number(sale.paidAmount)

      // Calcular valores corretos
      const totalPayments = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)

      // Validação 2: Pagamentos não podem exceder total da venda
      if (totalPayments > saleTotal + TOLERANCE) {
        console.error(`\n⚠️  AVISO: Venda ${sale.id} (${sale.client?.name})`)
        console.error(`   Pagamentos (${totalPayments.toFixed(2)}) > Total (${saleTotal.toFixed(2)})`)
        console.error(`   Esta venda pode ter dados corrompidos. Pulando...`)
        continue
      }

      const correctTotalFees = sale.payments.reduce((sum, p) => {
        if (p.feeAbsorber === 'SELLER') return sum + Number(p.feeAmount)
        return sum
      }, 0)
      const correctNetTotal = saleTotal - correctTotalFees
      const correctStatus = totalPayments >= saleTotal - TOLERANCE ? 'COMPLETED' : 'PENDING'

      // Verificar se precisa correção
      if (
        Math.abs(currentPaidAmount - totalPayments) > TOLERANCE ||
        Math.abs(Number(sale.totalFees || 0) - correctTotalFees) > TOLERANCE ||
        Math.abs(Number(sale.netTotal || sale.total) - correctNetTotal) > TOLERANCE ||
        sale.status !== correctStatus
      ) {
        salesToFix.push({
          id: sale.id,
          clientName: sale.client?.name || 'SEM CLIENTE',
          newData: {
            paidAmount: totalPayments,
            totalFees: correctTotalFees,
            netTotal: correctNetTotal,
            status: correctStatus,
          },
        })
      }
    }

    console.log(`📊 Vendas analisadas: ${sales.length}`)
    console.log(`🔧 Vendas para corrigir: ${salesToFix.length}\n`)

    // Validação 3: Limite de segurança
    if (salesToFix.length > 200) {
      throw new Error(
        `Muitas vendas para corrigir (${salesToFix.length}). Validar manualmente antes de prosseguir.`
      )
    }

    if (salesToFix.length === 0) {
      console.log('✅ Nenhuma inconsistência encontrada!')
      console.log('   Não há necessidade de correção.\n')
      return
    }

    console.log('⏳ Executando correção em transação...\n')

    // Executar correção em transação
    await prisma.$transaction(
      async (tx) => {
        for (const sale of salesToFix) {
          await tx.sale.update({
            where: { id: sale.id },
            data: {
              paidAmount: sale.newData.paidAmount,
              totalFees: sale.newData.totalFees,
              netTotal: sale.newData.netTotal,
              status: sale.newData.status,
            },
          })

          console.log(`✓ ${sale.clientName} (${sale.id})`)
        }
      },
      {
        timeout: 60000, // 60s timeout
        isolationLevel: 'Serializable',
      }
    )

    console.log(`\n✅ Correção concluída com sucesso!`)
    console.log(`📊 ${salesToFix.length} vendas atualizadas\n`)

    // Gerar log
    const logDir = path.join(process.cwd(), 'reports')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')
    const logPath = path.join(logDir, `fix-log-${timestamp}.txt`)

    let log = ''
    log += '═'.repeat(80) + '\n'
    log += 'LOG DE CORREÇÃO DE DADOS INCONSISTENTES\n'
    log += '═'.repeat(80) + '\n\n'
    log += `Data: ${new Date().toLocaleString('pt-BR')}\n`
    log += `Backup usado: ${latestBackup}\n`
    log += `Total de vendas corrigidas: ${salesToFix.length}\n\n`
    log += 'Vendas corrigidas:\n\n'

    salesToFix.forEach((sale, i) => {
      log += `${i + 1}. ${sale.clientName} (${sale.id})\n`
      log += `   paidAmount: ${sale.newData.paidAmount.toFixed(2)}\n`
      log += `   totalFees: ${sale.newData.totalFees.toFixed(2)}\n`
      log += `   netTotal: ${sale.newData.netTotal.toFixed(2)}\n`
      log += `   status: ${sale.newData.status}\n\n`
    })

    fs.writeFileSync(logPath, log, 'utf-8')
    console.log(`📝 Log salvo em: ${logPath}\n`)

    console.log('💡 Próximos passos:')
    console.log('   1. Validar: npx tsx scripts/audit-all-fiado-sales.ts')
    console.log('   2. Testar pagamento do Wallison Henrique')
    console.log('   3. Testar deleção de pagamento\n')
  } catch (error) {
    console.error('\n❌ Erro durante correção:', error)
    console.error('\n⚠️  A transação foi revertida - nenhum dado foi alterado')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

fixFiadoInconsistencies()
