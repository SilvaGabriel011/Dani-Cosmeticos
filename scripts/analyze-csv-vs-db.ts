import { prisma } from "../src/lib/prisma"
import * as fs from "fs"
import * as path from "path"

function parseMoneyValue(value: string): number {
  if (!value || value.trim() === "") return 0
  const cleaned = value
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
  return parseFloat(cleaned) || 0
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

async function analyze() {
  console.log("\n📊 ANÁLISE: CSV vs BANCO DE DADOS\n")
  console.log("=".repeat(60))

  // 1. Ler e somar valores do CSV
  const csvPath = path.join(__dirname, "..", "Dani Cosméticos - CLIENTES (1).csv")
  const content = fs.readFileSync(csvPath, "utf-8")
  const lines = content.split("\n").filter(line => line.trim())
  const dataLines = lines.slice(1)

  let csvDebitoAberto = 0
  let csvPago = 0
  let csvValorTotal = 0
  let csvLinhas = 0

  for (const line of dataLines) {
    if (!line.trim()) continue
    const columns = parseCSVLine(line)
    
    const debitoAberto = parseMoneyValue(columns[1])
    const pago = parseMoneyValue(columns[2])
    const valorTotal = parseMoneyValue(columns[3])

    csvDebitoAberto += debitoAberto
    csvPago += pago
    csvValorTotal += valorTotal
    csvLinhas++
  }

  console.log("\n📄 TOTAIS DO CSV:")
  console.log(`   Linhas: ${csvLinhas}`)
  console.log(`   Débito em Aberto: R$ ${csvDebitoAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)
  console.log(`   Já Pago: R$ ${csvPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)
  console.log(`   Valor Total: R$ ${csvValorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)

  // 2. Buscar totais do banco
  const dbSales = await prisma.sale.findMany({
    where: {
      notes: { contains: "Importado via CSV" }
    },
    select: {
      total: true,
      paidAmount: true,
    }
  })

  let dbTotal = 0
  let dbPago = 0
  let dbEmAberto = 0

  for (const sale of dbSales) {
    dbTotal += Number(sale.total)
    dbPago += Number(sale.paidAmount)
    dbEmAberto += Number(sale.total) - Number(sale.paidAmount)
  }

  console.log("\n💾 TOTAIS NO BANCO (vendas importadas):")
  console.log(`   Vendas: ${dbSales.length}`)
  console.log(`   Total das vendas: R$ ${dbTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)
  console.log(`   Pago (paidAmount): R$ ${dbPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)
  console.log(`   Em Aberto: R$ ${dbEmAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)

  // 3. Buscar totais dos receivables
  const receivables = await prisma.receivable.findMany({
    where: {
      sale: {
        notes: { contains: "Importado via CSV" }
      }
    },
    select: {
      amount: true,
      paidAmount: true,
      status: true,
    }
  })

  let recTotal = 0
  let recPago = 0

  for (const r of receivables) {
    recTotal += Number(r.amount)
    recPago += Number(r.paidAmount)
  }

  console.log("\n📋 TOTAIS DOS RECEIVABLES:")
  console.log(`   Parcelas: ${receivables.length}`)
  console.log(`   Total (amount): R$ ${recTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)
  console.log(`   Pago (paidAmount): R$ ${recPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)

  // 4. Comparação
  console.log("\n" + "=".repeat(60))
  console.log("🔍 COMPARAÇÃO:")
  console.log(`   CSV Débito Aberto vs DB Em Aberto: ${csvDebitoAberto.toFixed(2)} vs ${dbEmAberto.toFixed(2)}`)
  console.log(`   CSV Pago vs DB Pago: ${csvPago.toFixed(2)} vs ${dbPago.toFixed(2)}`)
  console.log(`   CSV Total vs DB Total: ${csvValorTotal.toFixed(2)} vs ${dbTotal.toFixed(2)}`)

  // Verificar discrepâncias
  const diffAberto = Math.abs(csvDebitoAberto - dbEmAberto)
  const diffPago = Math.abs(csvPago - dbPago)
  
  if (diffAberto > 1 || diffPago > 1) {
    console.log("\n⚠️  DISCREPÂNCIAS ENCONTRADAS!")
    console.log(`   Diferença Em Aberto: R$ ${diffAberto.toFixed(2)}`)
    console.log(`   Diferença Pago: R$ ${diffPago.toFixed(2)}`)
  } else {
    console.log("\n✅ Valores batem!")
  }

  await prisma.$disconnect()
}

analyze().catch(console.error)
