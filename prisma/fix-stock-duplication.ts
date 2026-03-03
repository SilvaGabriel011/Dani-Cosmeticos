/**
 * Script de correção: Estoque duplicado nos produtos com preço de custo
 *
 * Problema: Produtos com costPrice > 0 estavam com stock duplicado.
 * Correção: Divide stock por 2 e zera o costPrice para os produtos afetados.
 *
 * SEGURANÇA:
 * - Dry-run por padrão (sem --confirm, apenas mostra o que seria feito)
 * - Salva backup em backup-before-fix.json antes de qualquer alteração
 * - Nunca opera sem WHERE explícito com IDs
 * - Nunca altera salePrice (preço de venda)
 * - Aborta automaticamente se nenhum produto for encontrado
 *
 * USO:
 *   npx tsx prisma/fix-stock-duplication.ts            (dry-run, sem alterações)
 *   npx tsx prisma/fix-stock-duplication.ts --confirm  (executa a correção)
 */

import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import * as readline from "readline"

const prisma = new PrismaClient()
const isDryRun = !process.argv.includes("--confirm")

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toUpperCase() === "SIM")
    })
  })
}

async function main() {
  console.log("=".repeat(60))
  console.log("SCRIPT DE CORREÇÃO: Estoque duplicado (fix-stock-duplication)")
  console.log("=".repeat(60))

  if (isDryRun) {
    console.log("\n[MODO DRY-RUN] Nenhuma alteração será feita.\n")
  }

  // PASSO 1: Buscar produtos afetados (costPrice > 0 e não deletados)
  const affected = await prisma.product.findMany({
    where: {
      costPrice: { gt: 0 },
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      stock: true,
      costPrice: true,
      salePrice: true,
      profitMargin: true,
    },
    orderBy: { name: "asc" },
  })

  // PASSO 2: Abortar se lista vazia
  if (affected.length === 0) {
    console.log(
      "Nenhum produto com costPrice > 0 encontrado. Nada a fazer.\n"
    )
    await prisma.$disconnect()
    process.exit(0)
  }

  // PASSO 3: Mostrar o que será alterado
  console.log(`Produtos afetados: ${affected.length}\n`)
  console.log(
    "PRODUTO".padEnd(40),
    "STOCK ATUAL → NOVO",
    "| CUSTO ATUAL → NOVO",
    "| VENDA (sem alteração)"
  )
  console.log("-".repeat(100))

  for (const p of affected) {
    const newStock = Math.floor(Number(p.stock) / 2)
    console.log(
      p.name.substring(0, 39).padEnd(40),
      `${p.stock} → ${newStock}`.padEnd(20),
      `| R$${Number(p.costPrice).toFixed(2)} → R$0,00`.padEnd(22),
      `| R$${Number(p.salePrice).toFixed(2)} (inalterado)`
    )
  }

  console.log("-".repeat(100))

  // PASSO 4: Dry-run → parar aqui
  if (isDryRun) {
    console.log("\n[DRY-RUN] Nenhuma alteração foi feita.")
    console.log(
      "Para executar a correção: npx tsx prisma/fix-stock-duplication.ts --confirm\n"
    )
    await prisma.$disconnect()
    process.exit(0)
  }

  // PASSO 5: Confirmação dupla (digitar "SIM")
  console.log()
  const confirmed = await askConfirmation(
    'Deseja prosseguir com a correção? Digite "SIM" para confirmar: '
  )

  if (!confirmed) {
    console.log("\nOperação cancelada. Nenhuma alteração foi feita.\n")
    await prisma.$disconnect()
    process.exit(0)
  }

  // PASSO 6: Salvar backup antes de qualquer alteração
  const backupPath = path.join(__dirname, "backup-before-fix.json")
  const backupData = {
    timestamp: new Date().toISOString(),
    description: "Backup antes da correção de estoque duplicado",
    products: affected.map((p) => ({
      id: p.id,
      name: p.name,
      stock: Number(p.stock),
      costPrice: Number(p.costPrice),
      salePrice: Number(p.salePrice),
      profitMargin: Number(p.profitMargin),
    })),
  }
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2))
  console.log(`\nBackup salvo em: ${backupPath}`)

  // PASSO 7: Transação atômica com IDs explícitos
  const affectedIds = affected.map((p) => p.id)

  console.log("\nExecutando correção...")

  try {
    await prisma.$transaction(async (tx) => {
      // Deletar entradas de custo histórico somente dos produtos afetados
      const deletedEntries = await tx.productCostEntry.deleteMany({
        where: { productId: { in: affectedIds } }, // SEMPRE com WHERE explícito
      })

      // Atualizar cada produto individualmente (por ID — mais seguro)
      let updatedCount = 0
      for (const p of affected) {
        const newStock = Math.floor(Number(p.stock) / 2)
        await tx.product.update({
          where: { id: p.id },
          data: {
            stock: newStock,
            costPrice: 0, // preço de CUSTO zerado
            // salePrice: NÃO ALTERADO — preço de venda permanece intacto
          },
        })
        updatedCount++
      }

      console.log(`  ✓ ${updatedCount} produtos atualizados`)
      console.log(
        `  ✓ ${deletedEntries.count} entradas de custo histórico removidas`
      )
    })

    console.log("\n✅ Correção concluída com sucesso!")
    console.log(`   Backup disponível em: ${backupPath}`)
    console.log(
      "   Para rollback manual, utilize os valores originais do arquivo de backup.\n"
    )
  } catch (error) {
    console.error("\n❌ ERRO durante a transação. Nenhuma alteração foi salva.")
    console.error(error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error("\n❌ Erro inesperado:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
