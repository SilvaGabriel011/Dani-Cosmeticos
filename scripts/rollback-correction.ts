import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function rollbackCorrection() {
  try {
    console.log('\n🔄 Revertendo correção usando backup...\n')

    const backupPath = path.join(
      process.cwd(),
      'backups',
      'backup-fiado-fix-2026-03-04T23-39-04-216Z.json'
    )

    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup não encontrado!')
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'))
    
    console.log(`📦 Backup carregado: ${backupData.sales.length} vendas\n`)
    
    // Buscar venda do Wallison no backup
    const wallisonSale = backupData.sales.find((s: any) => s.clientName === 'Wallison Henrique')
    
    if (!wallisonSale) {
      throw new Error('Venda do Wallison não encontrada no backup')
    }
    
    console.log('Venda do Wallison no backup:')
    console.log(`  ID: ${wallisonSale.id}`)
    console.log(`  Total: R$ ${wallisonSale.total.toFixed(2)}`)
    console.log(`  paidAmount: R$ ${wallisonSale.paidAmount.toFixed(2)}`)
    console.log(`  Status: ${wallisonSale.status}`)
    console.log(`  Payments: ${wallisonSale.payments.length}`)
    
    wallisonSale.payments.forEach((p: any, i: number) => {
      console.log(`    ${i + 1}. ${p.paidAt.split('T')[0]} - R$ ${p.amount.toFixed(2)} (${p.method})`)
    })
    
    console.log('\n⚠️  Aguarde aprovação para restaurar valores do backup')
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

rollbackCorrection()
