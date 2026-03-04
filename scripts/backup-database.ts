import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function backupDatabase() {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')
    const backupDir = path.join(process.cwd(), 'backups')
    const backupPath = path.join(backupDir, `backup-fiado-fix-${timestamp}.json`)

    console.log('\n🔄 Iniciando backup do banco de dados...\n')

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
        },
        payments: true,
        items: true,
      },
    })

    console.log(`📊 Vendas fiado encontradas: ${sales.length}`)

    const backupData = {
      timestamp: new Date().toISOString(),
      description: 'Backup antes da correção de dados inconsistentes em vendas fiado',
      totalSales: sales.length,
      sales: sales.map((sale) => ({
        id: sale.id,
        clientId: sale.clientId,
        clientName: sale.client?.name,
        total: Number(sale.total),
        paidAmount: Number(sale.paidAmount),
        totalFees: Number(sale.totalFees || 0),
        netTotal: Number(sale.netTotal || sale.total),
        status: sale.status,
        createdAt: sale.createdAt.toISOString(),
        receivables: sale.receivables.map((r) => ({
          id: r.id,
          installment: r.installment,
          amount: Number(r.amount),
          paidAmount: Number(r.paidAmount),
          status: r.status,
          dueDate: r.dueDate.toISOString(),
          paidAt: r.paidAt?.toISOString() || null,
        })),
        payments: sale.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          method: p.method,
          feePercent: Number(p.feePercent),
          feeAmount: Number(p.feeAmount),
          feeAbsorber: p.feeAbsorber,
          paidAt: p.paidAt.toISOString(),
        })),
      })),
    }

    // Criar diretório se não existir
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // Salvar backup
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8')

    // Validar integridade
    const fileSize = fs.statSync(backupPath).size
    if (fileSize === 0) {
      throw new Error('Backup criado com tamanho 0 - arquivo corrompido')
    }

    // Validar conteúdo
    const readBack = JSON.parse(fs.readFileSync(backupPath, 'utf-8'))
    if (readBack.sales.length !== sales.length) {
      throw new Error('Validação de backup falhou - número de vendas não confere')
    }

    console.log(`\n✅ Backup criado com sucesso!`)
    console.log(`📁 Arquivo: ${backupPath}`)
    console.log(`📏 Tamanho: ${(fileSize / 1024).toFixed(2)} KB`)
    console.log(`\n💾 ${sales.length} vendas salvas no backup`)
    console.log(`✅ Validação: OK - arquivo íntegro e legível`)
  } catch (error) {
    console.error('❌ Erro ao criar backup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

backupDatabase()
