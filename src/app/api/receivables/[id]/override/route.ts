import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { AppError, ErrorCodes, handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { PAYMENT_TOLERANCE } from '@/lib/constants'
import { overrideReceivableSchema } from '@/schemas/receivable'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const validation = overrideReceivableSchema.safeParse(body)

    if (!validation.success) {
      throw new AppError(ErrorCodes.VALIDATION, 400, validation.error.flatten().fieldErrors as Record<string, unknown>)
    }

    const { amount, paidAmount, status, dueDate, reason } = validation.data

    const receivable = await prisma.receivable.findUnique({
      where: { id },
      include: { sale: true },
    })

    if (!receivable) {
      throw new AppError(ErrorCodes.RECEIVABLE_NOT_FOUND, 404)
    }

    // Log the override for audit
    console.log(
      `[OVERRIDE] Parcela ${id} (Venda ${receivable.saleId}, Parcela #${receivable.installment}): ` +
      `Motivo: "${reason}" | ` +
      `Antes: { amount: ${receivable.amount}, paidAmount: ${receivable.paidAmount}, status: ${receivable.status}, dueDate: ${receivable.dueDate.toISOString()} } | ` +
      `Depois: { amount: ${amount ?? 'sem mudança'}, paidAmount: ${paidAmount ?? 'sem mudança'}, status: ${status ?? 'sem mudança'}, dueDate: ${dueDate ?? 'sem mudança'} }`
    )

    const updated = await prisma.$transaction(async (tx) => {
      // Build update data - only include provided fields
      const updateData: Record<string, unknown> = {}
      if (amount !== undefined) updateData.amount = amount
      if (paidAmount !== undefined) updateData.paidAmount = paidAmount
      if (status !== undefined) updateData.status = status
      if (dueDate !== undefined) updateData.dueDate = new Date(dueDate)

      // Auto-set paidAt based on status
      if (status === 'PAID') {
        updateData.paidAt = new Date()
      } else if (status === 'PENDING' || status === 'CANCELLED') {
        updateData.paidAt = null
      }

      const updatedReceivable = await tx.receivable.update({
        where: { id },
        data: updateData,
        include: {
          sale: {
            include: { client: true },
          },
        },
      })

      // Recalculate sale paidAmount and status from receivables
      const allReceivables = await tx.receivable.findMany({
        where: { saleId: receivable.saleId, status: { not: 'CANCELLED' } },
      })

      const totalReceivablesPaid = allReceivables.reduce(
        (sum, r) => sum + Number(r.paidAmount),
        0
      )

      // Calculate effective paid amount from receivables
      const allPaid = allReceivables.length > 0 && allReceivables.every((r) => r.status === 'PAID')
      const saleTotal = Number(receivable.sale.total)
      const isFullyPaid = allPaid || totalReceivablesPaid >= saleTotal - PAYMENT_TOLERANCE

      // Sync Payment records so updateSalePaidAmount() won't override later
      const allPayments = await tx.payment.findMany({
        where: { saleId: receivable.saleId },
      })
      const totalFromPayments = allPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      )

      const effectivePaidAmount = allPaid ? saleTotal : Math.max(totalReceivablesPaid, totalFromPayments)

      // Create adjustment Payment if needed to keep Payment table in sync
      const paymentDifference = effectivePaidAmount - totalFromPayments
      if (Math.abs(paymentDifference) > PAYMENT_TOLERANCE) {
        // isAdjustment: requires `prisma generate` after migration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx.payment.create as any)({
          data: {
            saleId: receivable.saleId,
            method: 'PIX',
            amount: paymentDifference,
            feePercent: 0,
            feeAmount: 0,
            feeAbsorber: 'SELLER',
            installments: 1,
            isAdjustment: true,
            paidAt: new Date(),
          },
        })
        console.log(
          `[OVERRIDE] Criado Payment de ajuste: R$ ${paymentDifference.toFixed(2)} ` +
          `para Venda ${receivable.saleId}`
        )
      }

      await tx.sale.update({
        where: { id: receivable.saleId },
        data: {
          paidAmount: effectivePaidAmount,
          status: isFullyPaid ? 'COMPLETED' : 'PENDING',
        },
      })

      return updatedReceivable
    })

    // Invalidate ALL caches — override must reflect everywhere
    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)
    cache.invalidatePrefix(CACHE_KEYS.DEBTORS)

    return NextResponse.json({
      success: true,
      message: 'Parcela atualizada com sucesso (override)',
      data: updated,
    })
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}
