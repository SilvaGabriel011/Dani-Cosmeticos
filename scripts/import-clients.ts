import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

function parseMoneyValue(value: string): number {
  if (!value || value.trim() === '') return 0
  const cleaned = value
    .replace(/R\$\s*/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function parsePaymentDay(value: string): number | undefined {
  if (!value || value.trim() === '') return undefined
  const match = value.match(/(\d+)/)
  if (match) {
    const day = parseInt(match[1], 10)
    if (day >= 1 && day <= 31) return day
  }
  return undefined
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',' || char === ';' || char === '\t') {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  fields.push(current.trim())
  return fields
}

interface ClientRow {
  nome: string
  telefone?: string
  valorTotalCompra: number
  pago: number
  debitoAberto: number
  valorParcelas?: number
  numeroParcelas?: number
  pagamentoDia?: number
}

interface GroupedClient {
  nome: string
  telefone?: string
  rows: ClientRow[]
}

function parseCSV(text: string): ClientRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  const rows: ClientRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])

    if (values.length < 4 || !values[0]) continue

    const nome = values[0]
    const telefone = values[1] || undefined
    const valorTotalCompra = parseMoneyValue(values[2])
    const pago = parseMoneyValue(values[3])
    const debitoAberto = valorTotalCompra - pago
    const valorParcelas = values[5] ? parseMoneyValue(values[5]) : undefined
    const numeroParcelas = values[6] ? parseInt(values[6], 10) || undefined : undefined
    const pagamentoDia = values[7] ? parsePaymentDay(values[7]) : undefined

    rows.push({
      nome,
      telefone,
      valorTotalCompra,
      pago,
      debitoAberto,
      valorParcelas,
      numeroParcelas,
      pagamentoDia,
    })
  }

  return rows
}

function groupClientRows(rows: ClientRow[]): GroupedClient[] {
  const map = new Map<string, GroupedClient>()

  for (const row of rows) {
    const key = `${row.nome.trim().toLowerCase()}||${(row.telefone || '').trim()}`
    const existing = map.get(key)
    if (existing) {
      existing.rows.push(row)
    } else {
      map.set(key, { nome: row.nome, telefone: row.telefone, rows: [row] })
    }
  }

  return Array.from(map.values())
}

async function main() {
  const csvPath = path.resolve(__dirname, '..', 'Dani Cosméticos - CLIENTES (3).csv')
  const text = fs.readFileSync(csvPath, 'utf-8')

  const rows = parseCSV(text)
  console.log(`📄 ${rows.length} linhas parseadas do CSV`)

  const grouped = groupClientRows(rows)
  console.log(`👥 ${grouped.length} clientes únicos (agrupados por nome+telefone)`)

  const importDate = new Date()
  let clientsCreated = 0
  let salesCreated = 0
  const errors: string[] = []

  for (const group of grouped) {
    try {
      let groupSales = 0

      await prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
          data: {
            name: group.nome,
            phone: group.telefone || null,
            importedAt: importDate,
          },
        })

        for (const row of group.rows) {
          const totalEmAberto = row.debitoAberto
          const numInstallments = row.numeroParcelas && row.numeroParcelas > 0 ? row.numeroParcelas : 1
          const paymentDay = row.pagamentoDia || 10

          if (totalEmAberto <= 0 && row.pago <= 0) {
            continue
          }

          const saleStatus = totalEmAberto <= 0 ? 'COMPLETED' : 'PENDING'

          const sale = await tx.sale.create({
            data: {
              clientId: client.id,
              subtotal: new Decimal(row.valorTotalCompra),
              discountPercent: new Decimal(0),
              discountAmount: new Decimal(0),
              totalFees: new Decimal(0),
              total: new Decimal(row.valorTotalCompra),
              netTotal: new Decimal(row.valorTotalCompra),
              paidAmount: new Decimal(row.pago),
              status: saleStatus,
              notes: `Importado via CSV em ${importDate.toLocaleDateString('pt-BR')}`,
              paymentDay: paymentDay,
              installmentPlan: numInstallments,
              fixedInstallmentAmount: row.valorParcelas ? new Decimal(row.valorParcelas) : null,
            },
          })

          if (row.pago > 0) {
            await tx.payment.create({
              data: {
                saleId: sale.id,
                method: 'CASH',
                amount: new Decimal(row.pago),
                feePercent: new Decimal(0),
                feeAmount: new Decimal(0),
                feeAbsorber: 'SELLER',
                installments: 1,
                paidAt: importDate,
              },
            })
          }

          if (totalEmAberto > 0) {
            const installmentAmount = row.valorParcelas || totalEmAberto / numInstallments
            const now = new Date()

            const receivables = Array.from({ length: numInstallments }, (_, i) => {
              let targetMonth = now.getMonth() + i
              let targetYear = now.getFullYear()

              if (i === 0 && now.getDate() >= paymentDay) {
                targetMonth += 1
              }

              while (targetMonth > 11) {
                targetMonth -= 12
                targetYear += 1
              }

              const dueDate = new Date(targetYear, targetMonth, paymentDay)
              if (dueDate.getDate() !== paymentDay) {
                dueDate.setDate(0)
              }

              return {
                saleId: sale.id,
                installment: i + 1,
                amount: new Decimal(installmentAmount),
                dueDate,
              }
            })

            await tx.receivable.createMany({ data: receivables })

            if (row.pago > 0) {
              let remainingPaid = row.pago
              const createdReceivables = await tx.receivable.findMany({
                where: { saleId: sale.id },
                orderBy: { installment: 'asc' },
              })

              for (const receivable of createdReceivables) {
                if (remainingPaid <= 0.01) break

                const amount = Number(receivable.amount)
                const paymentForThis = Math.min(remainingPaid, amount)

                let newStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING'
                if (paymentForThis >= amount - 0.01) {
                  newStatus = 'PAID'
                } else if (paymentForThis > 0) {
                  newStatus = 'PARTIAL'
                }

                await tx.receivable.update({
                  where: { id: receivable.id },
                  data: {
                    paidAmount: new Decimal(paymentForThis),
                    status: newStatus,
                    paidAt: newStatus === 'PAID' ? importDate : null,
                  },
                })

                remainingPaid -= paymentForThis
              }
            }
          }

          groupSales++
        }
      })

      clientsCreated++
      salesCreated += groupSales
    } catch (error) {
      const msg = `❌ Erro ao importar "${group.nome}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      errors.push(msg)
      console.error(msg)
    }
  }

  console.log(`\n✅ Importação concluída!`)
  console.log(`   👥 ${clientsCreated} clientes criados`)
  console.log(`   🧾 ${salesCreated} vendas/contas fiado criadas`)

  if (errors.length > 0) {
    console.log(`   ❌ ${errors.length} erros:`)
    errors.forEach((e) => console.log(`      ${e}`))
  }
}

main()
  .catch((e) => {
    console.error('Erro fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
