import { type NextRequest, NextResponse } from 'next/server'

import { PAYMENT_TOLERANCE } from '@/lib/constants'
import { handleApiError, AppError, ErrorCodes } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface DiagnosticIssue {
  type: 'error' | 'warning'
  code: string
  message: string
  details?: Record<string, unknown>
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        client: true,
        items: { include: { product: { select: { id: true, name: true, code: true } } } },
        payments: { orderBy: { paidAt: 'asc' } },
        receivables: { orderBy: { installment: 'asc' } },
      },
    })

    if (!sale) {
      throw new AppError(ErrorCodes.SALE_NOT_FOUND, 404)
    }

    // === CALCULATE ALL VALUES ===

    const saleTotal = Number(sale.total)
    const salePaidAmount = Number(sale.paidAmount)
    const saleSubtotal = Number(sale.subtotal)
    const saleDiscountPercent = Number(sale.discountPercent)
    const saleDiscountAmount = Number(sale.discountAmount)
    const saleTotalFees = Number(sale.totalFees)
    const saleNetTotal = Number(sale.netTotal)

    // Sum of all Payment records
    const paymentsTotal = sale.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    )

    // Receivables: all, active (non-cancelled), cancelled
    const activeReceivables = sale.receivables.filter((r) => r.status !== 'CANCELLED')
    const cancelledReceivables = sale.receivables.filter((r) => r.status === 'CANCELLED')

    // Sum of receivable amounts (what's owed)
    const receivablesTotalAmount = activeReceivables.reduce(
      (sum, r) => sum + Number(r.amount),
      0
    )

    // Sum of receivable paidAmounts (what's been paid per parcela)
    const receivablesTotalPaid = activeReceivables.reduce(
      (sum, r) => sum + Number(r.paidAmount),
      0
    )

    // Remaining balance per receivables
    const receivablesRemaining = receivablesTotalAmount - receivablesTotalPaid

    // Items total
    const itemsTotal = sale.items.reduce(
      (sum, item) => sum + Number(item.total),
      0
    )

    // Expected discount amount
    const expectedDiscountAmount = saleSubtotal * (saleDiscountPercent / 100)
    const expectedTotal = saleSubtotal - expectedDiscountAmount

    // === FIND ISSUES ===
    const issues: DiagnosticIssue[] = []

    // 1. Payment sum vs sale.paidAmount
    if (Math.abs(paymentsTotal - salePaidAmount) > PAYMENT_TOLERANCE) {
      issues.push({
        type: 'error',
        code: 'PAYMENT_SUM_MISMATCH',
        message: `Soma dos pagamentos (R$ ${paymentsTotal.toFixed(2)}) difere do valor pago da venda (R$ ${salePaidAmount.toFixed(2)})`,
        details: { paymentsTotal, salePaidAmount, difference: paymentsTotal - salePaidAmount },
      })
    }

    // 2. Receivable paid sum vs sale.paidAmount (for fiado sales)
    if (activeReceivables.length > 0 && sale.status !== 'CANCELLED') {
      // For fiado sales, the sum of receivable paidAmounts should roughly match
      // But this is tricky because initial payment may not map to receivables
      const initialPaymentBeforeReceivables = saleTotal - receivablesTotalAmount
      const expectedPaidFromReceivables = receivablesTotalPaid + Math.max(0, initialPaymentBeforeReceivables)

      if (Math.abs(expectedPaidFromReceivables - salePaidAmount) > PAYMENT_TOLERANCE * 10) {
        issues.push({
          type: 'warning',
          code: 'RECEIVABLE_PAID_MISMATCH',
          message: `Soma paga nas parcelas (R$ ${receivablesTotalPaid.toFixed(2)}) + entrada (R$ ${Math.max(0, initialPaymentBeforeReceivables).toFixed(2)}) = R$ ${expectedPaidFromReceivables.toFixed(2)} difere do paidAmount da venda (R$ ${salePaidAmount.toFixed(2)})`,
          details: { receivablesTotalPaid, initialPaymentBeforeReceivables, expectedPaidFromReceivables, salePaidAmount },
        })
      }
    }

    // 3. Status inconsistency
    if (sale.status === 'COMPLETED' && activeReceivables.some((r) => r.status !== 'PAID' && r.status !== 'CANCELLED')) {
      const unpaid = activeReceivables.filter((r) => r.status !== 'PAID')
      issues.push({
        type: 'error',
        code: 'STATUS_COMPLETED_UNPAID_RECEIVABLES',
        message: `Venda marcada como CONCLUÍDA, mas ${unpaid.length} parcela(s) não estão pagas`,
        details: { unpaidReceivables: unpaid.map((r) => ({ id: r.id, installment: r.installment, status: r.status, amount: Number(r.amount), paidAmount: Number(r.paidAmount) })) },
      })
    }

    if (sale.status === 'PENDING' && activeReceivables.length > 0 && activeReceivables.every((r) => r.status === 'PAID')) {
      issues.push({
        type: 'error',
        code: 'STATUS_PENDING_ALL_PAID',
        message: 'Venda marcada como PENDENTE, mas todas as parcelas estão pagas',
        details: {},
      })
    }

    // 4. paidAmount > total (overpayment)
    if (salePaidAmount > saleTotal + PAYMENT_TOLERANCE) {
      issues.push({
        type: 'warning',
        code: 'OVERPAYMENT',
        message: `Valor pago (R$ ${salePaidAmount.toFixed(2)}) excede o total da venda (R$ ${saleTotal.toFixed(2)})`,
        details: { salePaidAmount, saleTotal, excess: salePaidAmount - saleTotal },
      })
    }

    // 5. Receivable with PAID status but paidAmount < amount
    for (const r of activeReceivables) {
      const rAmount = Number(r.amount)
      const rPaid = Number(r.paidAmount)

      if (r.status === 'PAID' && rPaid < rAmount - PAYMENT_TOLERANCE) {
        issues.push({
          type: 'error',
          code: 'RECEIVABLE_PAID_UNDERPAID',
          message: `Parcela #${r.installment} marcada como PAGA, mas valor pago (R$ ${rPaid.toFixed(2)}) é menor que o valor (R$ ${rAmount.toFixed(2)})`,
          details: { receivableId: r.id, installment: r.installment, amount: rAmount, paidAmount: rPaid },
        })
      }

      if (r.status === 'PENDING' && rPaid > PAYMENT_TOLERANCE) {
        issues.push({
          type: 'warning',
          code: 'RECEIVABLE_PENDING_HAS_PAYMENT',
          message: `Parcela #${r.installment} está PENDENTE, mas tem R$ ${rPaid.toFixed(2)} de pagamento registrado (deveria ser PARCIAL)`,
          details: { receivableId: r.id, installment: r.installment, paidAmount: rPaid },
        })
      }

      if (rPaid >= rAmount - PAYMENT_TOLERANCE && r.status !== 'PAID' && r.status !== 'CANCELLED') {
        issues.push({
          type: 'error',
          code: 'RECEIVABLE_FULLY_PAID_WRONG_STATUS',
          message: `Parcela #${r.installment} está ${r.status} mas valor pago (R$ ${rPaid.toFixed(2)}) cobre o total (R$ ${rAmount.toFixed(2)})`,
          details: { receivableId: r.id, installment: r.installment, amount: rAmount, paidAmount: rPaid, status: r.status },
        })
      }
    }

    // 6. Duplicate installment numbers
    const installmentNumbers = activeReceivables.map((r) => r.installment)
    const duplicates = installmentNumbers.filter((n, i) => installmentNumbers.indexOf(n) !== i)
    if (duplicates.length > 0) {
      issues.push({
        type: 'error',
        code: 'DUPLICATE_INSTALLMENTS',
        message: `Parcelas duplicadas encontradas: #${Array.from(new Set(duplicates)).join(', #')}`,
        details: { duplicateInstallments: Array.from(new Set(duplicates)) },
      })
    }

    // 7. Items total vs subtotal
    if (Math.abs(itemsTotal - saleSubtotal) > PAYMENT_TOLERANCE) {
      issues.push({
        type: 'warning',
        code: 'ITEMS_SUBTOTAL_MISMATCH',
        message: `Soma dos itens (R$ ${itemsTotal.toFixed(2)}) difere do subtotal da venda (R$ ${saleSubtotal.toFixed(2)})`,
        details: { itemsTotal, saleSubtotal },
      })
    }

    // 8. Discount calculation
    if (Math.abs(expectedDiscountAmount - saleDiscountAmount) > PAYMENT_TOLERANCE) {
      issues.push({
        type: 'warning',
        code: 'DISCOUNT_MISMATCH',
        message: `Desconto calculado (R$ ${expectedDiscountAmount.toFixed(2)}) difere do desconto salvo (R$ ${saleDiscountAmount.toFixed(2)})`,
        details: { expectedDiscountAmount, saleDiscountAmount, discountPercent: saleDiscountPercent },
      })
    }

    // 9. Receivable amount vs remaining balance (for fiado)
    if (activeReceivables.length > 0) {
      const remainingAtCreation = saleTotal - (salePaidAmount - receivablesTotalPaid)
      if (Math.abs(receivablesTotalAmount - remainingAtCreation) > PAYMENT_TOLERANCE * 100) {
        // High tolerance because this can legitimately differ after overrides
        issues.push({
          type: 'warning',
          code: 'RECEIVABLE_TOTAL_VS_REMAINING',
          message: `Total das parcelas (R$ ${receivablesTotalAmount.toFixed(2)}) não corresponde ao saldo devedor esperado`,
          details: { receivablesTotalAmount, saleTotal, salePaidAmount },
        })
      }
    }

    // === BUILD RESPONSE ===
    const errorCount = issues.filter((i) => i.type === 'error').length
    const warningCount = issues.filter((i) => i.type === 'warning').length

    return NextResponse.json({
      sale: {
        id: sale.id,
        status: sale.status,
        clientName: sale.client?.name || null,
        createdAt: sale.createdAt,
      },
      summary: {
        saleTotal,
        salePaidAmount,
        saleSubtotal,
        saleDiscountPercent,
        saleDiscountAmount,
        saleTotalFees,
        saleNetTotal,
        saleStatus: sale.status,
        paymentsTotal,
        paymentsCount: sale.payments.length,
        receivablesTotalAmount,
        receivablesTotalPaid,
        receivablesRemaining,
        activeReceivablesCount: activeReceivables.length,
        cancelledReceivablesCount: cancelledReceivables.length,
        itemsTotal,
        itemsCount: sale.items.length,
      },
      // isAdjustment: available after `prisma generate` with new migration
      payments: sale.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: Number(p.amount),
        feePercent: Number(p.feePercent),
        feeAmount: Number(p.feeAmount),
        feeAbsorber: p.feeAbsorber,
        installments: p.installments,
        isAdjustment: (p as Record<string, unknown>).isAdjustment ?? false,
        paidAt: p.paidAt,
      })),
      receivables: sale.receivables.map((r) => ({
        id: r.id,
        installment: r.installment,
        amount: Number(r.amount),
        paidAmount: Number(r.paidAmount),
        remaining: Number(r.amount) - Number(r.paidAmount),
        status: r.status,
        dueDate: r.dueDate,
        paidAt: r.paidAt,
        createdAt: r.createdAt,
      })),
      items: sale.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        productCode: item.product.code,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      issues,
      health: errorCount === 0 && warningCount === 0
        ? 'healthy'
        : errorCount > 0
          ? 'critical'
          : 'warning',
      errorCount,
      warningCount,
    })
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}
