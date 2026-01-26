import * as fs from "fs"
import * as path from "path"

import { Decimal } from "@prisma/client/runtime/library"

import { prisma } from "../src/lib/prisma"

interface ClientRow {
  nome: string
  debitoAberto: number
  pago: number
  valorTotal: number
  valorParcelas: number | null
  numeroParcelas: number | null
  pagamentoDia: number
}

function parseMoneyValue(value: string): number {
  if (!value || value.trim() === "") return 0
  // Remove "R$", spaces, dots (thousand separator), and convert comma to dot
  const cleaned = value
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
  return parseFloat(cleaned) || 0
}

function extractPaymentDay(value: string): number {
  if (!value || value.trim() === "") return 1 // Default to day 1 as requested
  
  const cleaned = value.toLowerCase().trim()
  
  // Pattern: "todo dia X" or "tdo dia X"
  const todoDiaMatch = cleaned.match(/t[o]?do dia (\d+)/)
  if (todoDiaMatch) return parseInt(todoDiaMatch[1])
  
  // Pattern: "dia X" or "dia X de mês"
  const diaMatch = cleaned.match(/dia (\d+)/)
  if (diaMatch) return parseInt(diaMatch[1])
  
  // Pattern: "XX/XX" (date format)
  const dateMatch = cleaned.match(/^(\d{1,2})\//)
  if (dateMatch) return parseInt(dateMatch[1])
  
  // Pattern: "XX de mês"
  const deMatch = cleaned.match(/^(\d{1,2}) de/)
  if (deMatch) return parseInt(deMatch[1])
  
  // Just a number
  const numMatch = cleaned.match(/(\d+)/)
  if (numMatch) return parseInt(numMatch[1])
  
  return 1 // Default
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

async function importClients() {
  const csvPath = path.join(__dirname, "..", "Dani Cosméticos - CLIENTES (1).csv")
  const content = fs.readFileSync(csvPath, "utf-8")
  const lines = content.split("\n").filter(line => line.trim())
  
  // Skip header
  const dataLines = lines.slice(1)
  
  console.log(`\n📊 Processando ${dataLines.length} linhas do CSV...\n`)
  
  const importDate = new Date()
  let created = 0
  const errors: Array<{ row: number; nome: string; message: string }> = []
  
  // Group by client name to handle duplicates
  const clientMap = new Map<string, ClientRow[]>()
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]
    if (!line.trim()) continue
    
    const columns = parseCSVLine(line)
    
    const nome = columns[0]?.trim()
    if (!nome) continue
    
    const debitoAberto = parseMoneyValue(columns[1])
    const pago = parseMoneyValue(columns[2])
    const valorTotal = parseMoneyValue(columns[3])
    const valorParcelas = columns[4] ? parseMoneyValue(columns[4]) : null
    const numeroParcelas = columns[5] ? parseInt(columns[5]) : null
    const pagamentoDia = extractPaymentDay(columns[6] || "")
    
    const row: ClientRow = {
      nome,
      debitoAberto,
      pago,
      valorTotal,
      valorParcelas,
      numeroParcelas,
      pagamentoDia,
    }
    
    if (!clientMap.has(nome)) {
      clientMap.set(nome, [])
    }
    clientMap.get(nome)!.push(row)
  }
  
  console.log(`📋 ${clientMap.size} clientes únicos encontrados\n`)
  
  // Process each client
  const clientEntries = Array.from(clientMap.entries())
  for (const [clientName, purchases] of clientEntries) {
    try {
      await prisma.$transaction(async (tx) => {
        // Check if client already exists
        let client = await tx.client.findFirst({
          where: { name: clientName }
        })
        
        if (!client) {
          client = await tx.client.create({
            data: {
              name: clientName,
              importedAt: importDate,
            },
          })
          console.log(`✅ Cliente criado: ${clientName}`)
        } else {
          console.log(`📝 Cliente existente: ${clientName}`)
        }
        
        // Create a sale for each purchase
        for (const purchase of purchases) {
          const totalEmAberto = purchase.debitoAberto
          
          if (totalEmAberto <= 0) {
            console.log(`   ⏭️  Sem débito aberto, pulando...`)
            continue
          }
          
          const numInstallments = purchase.numeroParcelas && purchase.numeroParcelas > 0 
            ? purchase.numeroParcelas 
            : 1
          const paymentDay = purchase.pagamentoDia
          
          const sale = await tx.sale.create({
            data: {
              clientId: client.id,
              subtotal: new Decimal(purchase.valorTotal || purchase.debitoAberto + purchase.pago),
              discountPercent: new Decimal(0),
              discountAmount: new Decimal(0),
              totalFees: new Decimal(0),
              total: new Decimal(purchase.debitoAberto + purchase.pago),
              netTotal: new Decimal(purchase.debitoAberto + purchase.pago),
              paidAmount: new Decimal(purchase.pago),
              status: "PENDING",
              notes: `Importado via CSV em ${importDate.toLocaleDateString("pt-BR")}`,
              paymentDay: paymentDay,
              installmentPlan: numInstallments,
              fixedInstallmentAmount: purchase.valorParcelas ? new Decimal(purchase.valorParcelas) : null,
            },
          })
          
          // Create payment record if already paid something
          if (purchase.pago > 0) {
            await tx.payment.create({
              data: {
                saleId: sale.id,
                method: "CASH",
                amount: new Decimal(purchase.pago),
                feePercent: new Decimal(0),
                feeAmount: new Decimal(0),
                feeAbsorber: "SELLER",
                installments: 1,
                paidAt: importDate,
              },
            })
          }
          
          // Create receivables (installments)
          const installmentAmount = purchase.valorParcelas || totalEmAberto / numInstallments
          const now = new Date()
          
          const receivables = Array.from({ length: numInstallments }, (_, i) => {
            let targetMonth = now.getMonth() + i
            let targetYear = now.getFullYear()
            
            // If first installment and the day has passed, start next month
            if (i === 0 && now.getDate() >= paymentDay) {
              targetMonth += 1
            }
            
            while (targetMonth > 11) {
              targetMonth -= 12
              targetYear += 1
            }
            
            const dueDate = new Date(targetYear, targetMonth, paymentDay)
            if (dueDate.getDate() !== paymentDay) {
              dueDate.setDate(0) // Last day of previous month
            }
            
            return {
              saleId: sale.id,
              installment: i + 1,
              amount: new Decimal(installmentAmount),
              dueDate,
            }
          })
          
          await tx.receivable.createMany({ data: receivables })
          
          console.log(`   💰 Venda criada: ${formatCurrency(totalEmAberto)} em ${numInstallments}x (dia ${paymentDay})`)
        }
        
        created++
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido"
      errors.push({ row: 0, nome: clientName, message })
      console.log(`❌ Erro ao importar ${clientName}: ${message}`)
    }
  }
  
  console.log("\n" + "=".repeat(50))
  console.log(`\n✅ Importação concluída!`)
  console.log(`   Clientes processados: ${created}`)
  console.log(`   Erros: ${errors.length}`)
  
  if (errors.length > 0) {
    console.log("\n❌ Erros encontrados:")
    errors.forEach(e => console.log(`   - ${e.nome}: ${e.message}`))
  }
  
  await prisma.$disconnect()
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

// Run
importClients().catch(console.error)
