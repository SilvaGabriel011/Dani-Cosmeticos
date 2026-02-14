import { Decimal } from '@prisma/client/runtime/library'
import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { clientImportSchema, type ClientImportRow } from '@/schemas/import'

export const dynamic = 'force-dynamic'

interface ImportResult {
  created: number
  salesCreated: number
  errors: Array<{ row: number; message: string }>
}

interface GroupedClient {
  nome: string
  telefone?: string
  rows: ClientImportRow[]
}

function groupClientRows(clients: ClientImportRow[]): GroupedClient[] {
  const map = new Map<string, GroupedClient>()

  for (const row of clients) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = clientImportSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos',
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { clients } = validation.data
    const result: ImportResult = { created: 0, salesCreated: 0, errors: [] }
    const importDate = new Date()
    const grouped = groupClientRows(clients)

    for (let i = 0; i < grouped.length; i++) {
      const group = grouped[i]

      try {
        const salesCount = await importGroupedClient(group, importDate)
        result.created++
        result.salesCreated += salesCount
      } catch (error) {
        result.errors.push({
          row: i + 1,
          message: `${group.nome}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        })
      }
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error importing clients:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erro ao importar clientes' } },
      { status: 500 }
    )
  }
}

async function importGroupedClient(group: GroupedClient, importDate: Date): Promise<number> {
  let salesCreated = 0

  await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: group.nome,
        phone: group.telefone || null,
        importedAt: importDate,
      },
    })

    for (const row of group.rows) {
      const created = await createSaleForRow(tx, client.id, row, importDate)
      if (created) salesCreated++
    }
  })

  return salesCreated
}

async function createSaleForRow(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  clientId: string,
  row: ClientImportRow,
  importDate: Date
): Promise<boolean> {
  const { valorTotal, debitoAberto, pago, valorParcelas, numeroParcelas, pagamentoDia } = row

  const valorTotalCompra = valorTotal || (debitoAberto + pago)
  const totalEmAberto = debitoAberto
  const numInstallments = numeroParcelas && numeroParcelas > 0 ? numeroParcelas : 1
  const paymentDay = pagamentoDia || 10

  if (totalEmAberto <= 0 && pago <= 0) {
    return false
  }

  const saleStatus = totalEmAberto <= 0 ? 'COMPLETED' : 'PENDING'

  const sale = await tx.sale.create({
    data: {
      clientId,
      subtotal: new Decimal(valorTotalCompra),
      discountPercent: new Decimal(0),
      discountAmount: new Decimal(0),
      totalFees: new Decimal(0),
      total: new Decimal(valorTotalCompra),
      netTotal: new Decimal(valorTotalCompra),
      paidAmount: new Decimal(pago),
      status: saleStatus,
      notes: `Importado via CSV em ${importDate.toLocaleDateString('pt-BR')}`,
      paymentDay: paymentDay,
      installmentPlan: numInstallments,
      fixedInstallmentAmount: valorParcelas ? new Decimal(valorParcelas) : null,
    },
  })

  if (pago > 0) {
    await tx.payment.create({
      data: {
        saleId: sale.id,
        method: 'CASH',
        amount: new Decimal(pago),
        feePercent: new Decimal(0),
        feeAmount: new Decimal(0),
        feeAbsorber: 'SELLER',
        installments: 1,
        paidAt: importDate,
      },
    })
  }

  if (totalEmAberto <= 0) {
    return true
  }

  const baseInstallmentAmount = valorParcelas || Math.floor((totalEmAberto / numInstallments) * 100) / 100
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

    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
    const dueDate = new Date(targetYear, targetMonth, Math.min(paymentDay, lastDayOfMonth))

    const isLast = i === numInstallments - 1
    const thisAmount = isLast
      ? Math.max(0.01, totalEmAberto - baseInstallmentAmount * (numInstallments - 1))
      : baseInstallmentAmount

    return {
      saleId: sale.id,
      installment: i + 1,
      amount: new Decimal(Number(thisAmount.toFixed(2))),
      dueDate,
    }
  })

  await tx.receivable.createMany({ data: receivables })

  // Distribute the paid amount across receivables
  if (pago > 0) {
    let remainingPaid = pago
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

  return true
}
