import { Decimal } from '@prisma/client/runtime/library'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Migration endpoint to fix receivables for imported sales
 * This redistributes paidAmount from Sale to Receivables
 */
export async function POST() {
  try {
    // Find all PENDING sales that have paidAmount > 0 but receivables not properly updated
    const salesToFix = await prisma.sale.findMany({
      where: {
        status: 'PENDING',
        paidAmount: { gt: 0 },
      },
      include: {
        receivables: {
          orderBy: { installment: 'asc' },
        },
        client: true,
      },
    })

    const results = {
      totalSales: salesToFix.length,
      fixed: 0,
      skipped: 0,
      errors: [] as Array<{ saleId: string; clientName: string; error: string }>,
      details: [] as Array<{
        saleId: string
        clientName: string
        salePaidAmount: number
        receivablesPaidBefore: number
        receivablesPaidAfter: number
      }>,
    }

    for (const sale of salesToFix) {
      try {
        const salePaidAmount = Number(sale.paidAmount)
        const receivablesPaidTotal = sale.receivables.reduce(
          (sum, r) => sum + Number(r.paidAmount),
          0
        )

        // Skip if receivables already have the correct paidAmount
        if (Math.abs(receivablesPaidTotal - salePaidAmount) < 0.01) {
          results.skipped++
          continue
        }

        // Redistribute paidAmount across receivables
        let remainingPaid = salePaidAmount
        let newReceivablesPaidTotal = 0

        await prisma.$transaction(async (tx) => {
          for (const receivable of sale.receivables) {
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
                paidAt: newStatus === 'PAID' ? sale.createdAt : null,
              },
            })

            newReceivablesPaidTotal += paymentForThis
            remainingPaid -= paymentForThis
          }

          // Check if all receivables are now paid
          const updatedReceivables = await tx.receivable.findMany({
            where: { saleId: sale.id },
          })
          const allPaid = updatedReceivables.every((r) => r.status === 'PAID')

          if (allPaid) {
            await tx.sale.update({
              where: { id: sale.id },
              data: { status: 'COMPLETED' },
            })
          }
        })

        results.fixed++
        results.details.push({
          saleId: sale.id,
          clientName: sale.client?.name || 'Sem cliente',
          salePaidAmount,
          receivablesPaidBefore: receivablesPaidTotal,
          receivablesPaidAfter: newReceivablesPaidTotal,
        })
      } catch (error) {
        results.errors.push({
          saleId: sale.id,
          clientName: sale.client?.name || 'Sem cliente',
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migração concluída: ${results.fixed} vendas corrigidas, ${results.skipped} já estavam corretas`,
      results,
    })
  } catch (error) {
    console.error('Error fixing receivables:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro ao corrigir parcelas' },
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to preview what would be fixed (dry run)
 */
export async function GET() {
  try {
    const salesToFix = await prisma.sale.findMany({
      where: {
        status: 'PENDING',
        paidAmount: { gt: 0 },
      },
      include: {
        receivables: {
          orderBy: { installment: 'asc' },
        },
        client: true,
      },
    })

    const preview = salesToFix
      .map((sale) => {
        const salePaidAmount = Number(sale.paidAmount)
        const receivablesPaidTotal = sale.receivables.reduce(
          (sum, r) => sum + Number(r.paidAmount),
          0
        )
        const needsFix = Math.abs(receivablesPaidTotal - salePaidAmount) >= 0.01

        return {
          saleId: sale.id,
          clientName: sale.client?.name || 'Sem cliente',
          saleTotal: Number(sale.total),
          salePaidAmount,
          receivablesTotal: sale.receivables.reduce((sum, r) => sum + Number(r.amount), 0),
          receivablesPaidTotal,
          receivablesCount: sale.receivables.length,
          needsFix,
          difference: salePaidAmount - receivablesPaidTotal,
        }
      })
      .filter((s) => s.needsFix)

    return NextResponse.json({
      success: true,
      message: `${preview.length} vendas precisam de correção`,
      preview,
    })
  } catch (error) {
    console.error('Error previewing fix:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro ao verificar parcelas' },
      },
      { status: 500 }
    )
  }
}
