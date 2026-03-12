import { NextResponse } from 'next/server'

import { PAYMENT_TOLERANCE } from '@/lib/constants'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface SaleIssue {
  type: 'error' | 'warning'
  code: string
  message: string
  acknowledged?: boolean
  acknowledgedAt?: string
}

interface SaleHealthResult {
  saleId: string
  saleIdShort: string
  clientName: string | null
  createdAt: Date
  status: string
  total: number
  paidAmount: number
  issues: SaleIssue[]
}

export async function GET() {
  try {
    // Fetch all non-cancelled sales with their payments and receivables
    const sales = await prisma.sale.findMany({
      where: { status: { not: 'CANCELLED' } },
      include: {
        client: { select: { name: true } },
        payments: true,
        receivables: true,
        acknowledgedIssues: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const results: SaleHealthResult[] = []

    for (const sale of sales) {
      const issues: SaleIssue[] = []
      const saleTotal = Number(sale.total)
      const salePaidAmount = Number(sale.paidAmount)

      // Map of acknowledged issues for this sale
      const acknowledgedMap = new Map(
        sale.acknowledgedIssues.map((a) => [a.issueCode, a.acknowledgedAt])
      )

      // Helper to add issue with acknowledged status
      const addIssue = (type: 'error' | 'warning', code: string, message: string) => {
        const ackDate = acknowledgedMap.get(code)
        issues.push({
          type,
          code,
          message,
          acknowledged: !!ackDate,
          acknowledgedAt: ackDate?.toISOString(),
        })
      }

      // Payment sum
      const paymentsTotal = sale.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      )

      // Active receivables
      const activeReceivables = sale.receivables.filter((r) => r.status !== 'CANCELLED')

      const _receivablesTotalPaid = activeReceivables.reduce(
        (sum, r) => sum + Number(r.paidAmount),
        0
      )

      // 1. Payment sum vs sale.paidAmount
      if (Math.abs(paymentsTotal - salePaidAmount) > PAYMENT_TOLERANCE) {
        addIssue('error', 'PAYMENT_SUM_MISMATCH', `Soma pagamentos (R$ ${paymentsTotal.toFixed(2)}) ≠ paidAmount (R$ ${salePaidAmount.toFixed(2)})`)
      }

      // 2. Status vs receivables
      if (sale.status === 'COMPLETED' && activeReceivables.some((r) => r.status !== 'PAID')) {
        const unpaidCount = activeReceivables.filter((r) => r.status !== 'PAID').length
        addIssue('error', 'COMPLETED_UNPAID', `Concluída com ${unpaidCount} parcela(s) não paga(s)`)
      }

      if (sale.status === 'PENDING' && activeReceivables.length > 0 && activeReceivables.every((r) => r.status === 'PAID')) {
        addIssue('error', 'PENDING_ALL_PAID', 'Pendente mas todas as parcelas estão pagas')
      }

      // 3. Receivable status inconsistencies
      for (const r of activeReceivables) {
        const rAmount = Number(r.amount)
        const rPaid = Number(r.paidAmount)

        if (r.status === 'PAID' && rPaid < rAmount - PAYMENT_TOLERANCE) {
          addIssue('error', 'PAID_UNDERPAID', `Parcela #${r.installment}: PAGA mas pago R$ ${rPaid.toFixed(2)} < R$ ${rAmount.toFixed(2)}`)
        }

        if (rPaid >= rAmount - PAYMENT_TOLERANCE && r.status !== 'PAID' && r.status !== 'CANCELLED') {
          addIssue('error', 'FULLY_PAID_WRONG_STATUS', `Parcela #${r.installment}: pago R$ ${rPaid.toFixed(2)} ≥ R$ ${rAmount.toFixed(2)} mas status = ${r.status}`)
        }

        if (r.status === 'PENDING' && rPaid > PAYMENT_TOLERANCE) {
          addIssue('warning', 'PENDING_HAS_PAYMENT', `Parcela #${r.installment}: PENDENTE com R$ ${rPaid.toFixed(2)} pago (deveria ser PARCIAL)`)
        }
      }

      // 4. Duplicate installment numbers
      const installments = activeReceivables.map((r) => r.installment)
      const dupes = installments.filter((n, i) => installments.indexOf(n) !== i)
      if (dupes.length > 0) {
        addIssue('error', 'DUPLICATE_INSTALLMENTS', `Parcelas duplicadas: #${Array.from(new Set(dupes)).join(', #')}`)
      }

      // 5. Overpayment
      if (salePaidAmount > saleTotal + PAYMENT_TOLERANCE) {
        addIssue('warning', 'OVERPAYMENT', `Pago R$ ${salePaidAmount.toFixed(2)} > total R$ ${saleTotal.toFixed(2)}`)
      }

      // 6. Fiado sale without receivables
      if (sale.status === 'PENDING' && activeReceivables.length === 0 && salePaidAmount < saleTotal - PAYMENT_TOLERANCE) {
        addIssue('warning', 'PENDING_NO_RECEIVABLES', 'Fiado sem parcelas criadas')
      }

      // Only include sales with issues
      if (issues.length > 0) {
        results.push({
          saleId: sale.id,
          saleIdShort: sale.id.slice(0, 8),
          clientName: sale.client?.name || null,
          createdAt: sale.createdAt,
          status: sale.status,
          total: saleTotal,
          paidAmount: salePaidAmount,
          issues,
        })
      }
    }

    // Sort by error count (most critical first)
    results.sort((a, b) => {
      const aErrors = a.issues.filter((i) => i.type === 'error').length
      const bErrors = b.issues.filter((i) => i.type === 'error').length
      return bErrors - aErrors
    })

    // Count only non-acknowledged issues
    const totalErrors = results.reduce(
      (sum, r) => sum + r.issues.filter((i) => i.type === 'error' && !i.acknowledged).length,
      0
    )
    const totalWarnings = results.reduce(
      (sum, r) => sum + r.issues.filter((i) => i.type === 'warning' && !i.acknowledged).length,
      0
    )

    return NextResponse.json({
      scannedSales: sales.length,
      salesWithIssues: results.length,
      totalErrors,
      totalWarnings,
      health: totalErrors === 0 && totalWarnings === 0
        ? 'healthy'
        : totalErrors > 0
          ? 'critical'
          : 'warning',
      results,
    })
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}
