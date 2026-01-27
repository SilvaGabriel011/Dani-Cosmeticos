import { Decimal } from '@prisma/client/runtime/library'
import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { clientImportSchema, type ClientImportRow } from '@/schemas/import'

export const dynamic = 'force-dynamic'

interface ImportResult {
  created: number
  errors: Array<{ row: number; message: string }>
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
    const result: ImportResult = { created: 0, errors: [] }
    const importDate = new Date()

    for (let i = 0; i < clients.length; i++) {
      const row = clients[i]
      const rowNumber = i + 1

      try {
        await importClient(row, importDate)
        result.created++
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Erro desconhecido',
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

async function importClient(row: ClientImportRow, importDate: Date) {
  const { nome, debitoAberto, pago, valorParcelas, numeroParcelas, pagamentoDia } = row

  const totalEmAberto = debitoAberto - pago
  const numInstallments = numeroParcelas && numeroParcelas > 0 ? numeroParcelas : 1
  const paymentDay = pagamentoDia || 10

  await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: nome,
        importedAt: importDate,
      },
    })

    if (totalEmAberto <= 0) {
      return client
    }

    const sale = await tx.sale.create({
      data: {
        clientId: client.id,
        subtotal: new Decimal(debitoAberto),
        discountPercent: new Decimal(0),
        discountAmount: new Decimal(0),
        totalFees: new Decimal(0),
        total: new Decimal(debitoAberto),
        netTotal: new Decimal(debitoAberto),
        paidAmount: new Decimal(pago),
        status: 'PENDING',
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

    const installmentAmount = valorParcelas || totalEmAberto / numInstallments
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

    return client
  })
}
