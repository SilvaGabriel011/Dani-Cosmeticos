import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { PAYMENT_TOLERANCE } from '@/lib/constants'
import { AppError, ErrorCodes, handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { overrideSaleSchema } from '@/schemas/sale'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const validation = overrideSaleSchema.safeParse(body)

    if (!validation.success) {
      throw new AppError(ErrorCodes.VALIDATION, 400, validation.error.flatten().fieldErrors as Record<string, unknown>)
    }

    const { status, paidAmount, notes, discountPercent, reason, receivables, deleteReceivableIds } = validation.data

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        receivables: { orderBy: { installment: 'asc' } },
        payments: true,
        items: true,
        client: true,
      },
    })

    if (!sale) {
      throw new AppError(ErrorCodes.SALE_NOT_FOUND, 404)
    }

    // Log the override for audit
    console.log(
      `[OVERRIDE] Venda ${id}: Motivo: "${reason}" | ` +
      `Status: ${sale.status} → ${status ?? 'sem mudança'} | ` +
      `PaidAmount: ${sale.paidAmount} → ${paidAmount ?? 'sem mudança'} | ` +
      `Receivables alteradas: ${receivables?.length ?? 0} | ` +
      `Receivables deletadas: ${deleteReceivableIds?.length ?? 0}`
    )

    const updated = await prisma.$transaction(async (tx) => {
      // 0. Save previous state for history/revert
      const previousState = {
        status: sale.status,
        paidAmount: Number(sale.paidAmount),
        notes: sale.notes,
        discountPercent: Number(sale.discountPercent),
        discountAmount: Number(sale.discountAmount),
        total: Number(sale.total),
        netTotal: Number(sale.netTotal),
        receivables: sale.receivables.map((r) => ({
          id: r.id,
          installment: r.installment,
          amount: Number(r.amount),
          paidAmount: Number(r.paidAmount),
          status: r.status,
          dueDate: r.dueDate.toISOString(),
        })),
      }

      const changes = {
        status: status !== undefined ? { from: sale.status, to: status } : undefined,
        paidAmount: paidAmount !== undefined ? { from: Number(sale.paidAmount), to: paidAmount } : undefined,
        notes: notes !== undefined ? { from: sale.notes, to: notes } : undefined,
        discountPercent: discountPercent !== undefined ? { from: Number(sale.discountPercent), to: discountPercent } : undefined,
        receivablesModified: receivables?.length ?? 0,
        receivablesDeleted: deleteReceivableIds?.length ?? 0,
      }

      await tx.saleOverrideLog.create({
        data: {
          saleId: id,
          reason,
          changes,
          previousState,
        },
      })

      // 1. Delete specified receivables
      if (deleteReceivableIds && deleteReceivableIds.length > 0) {
        await tx.receivable.deleteMany({
          where: {
            id: { in: deleteReceivableIds },
            saleId: id,
          },
        })
      }

      // 2. Update or create receivables
      if (receivables && receivables.length > 0) {
        for (const rec of receivables) {
          if (rec.id) {
            // Update existing
            await tx.receivable.update({
              where: { id: rec.id },
              data: {
                installment: rec.installment,
                amount: rec.amount,
                paidAmount: rec.paidAmount,
                status: rec.status,
                dueDate: new Date(rec.dueDate),
                paidAt: rec.status === 'PAID' ? new Date() : null,
              },
            })
          } else {
            // Create new
            await tx.receivable.create({
              data: {
                saleId: id,
                installment: rec.installment,
                amount: rec.amount,
                paidAmount: rec.paidAmount,
                status: rec.status,
                dueDate: new Date(rec.dueDate),
                paidAt: rec.status === 'PAID' ? new Date() : null,
              },
            })
          }
        }
      }

      // 3. Build sale update data
      const saleUpdateData: Record<string, unknown> = {}
      if (notes !== undefined) saleUpdateData.notes = notes

      // Recalculate discount if changed
      if (discountPercent !== undefined) {
        const subtotal = Number(sale.subtotal)
        const newDiscountAmount = subtotal * (discountPercent / 100)
        const newTotal = subtotal - newDiscountAmount
        const totalFees = Number(sale.totalFees)
        const newNetTotal = newTotal - totalFees

        saleUpdateData.discountPercent = discountPercent
        saleUpdateData.discountAmount = newDiscountAmount
        saleUpdateData.total = newTotal
        saleUpdateData.netTotal = newNetTotal
      }

      // Override paidAmount if explicitly provided
      // Also create an adjustment Payment so that updateSalePaidAmount()
      // (which sums Payment records) won't overwrite this value in the future
      if (paidAmount !== undefined) {
        saleUpdateData.paidAmount = paidAmount

        // Calculate what the Payment table currently sums to
        const existingPayments = await tx.payment.findMany({
          where: { saleId: id },
        })
        const currentPaymentSum = existingPayments.reduce(
          (sum, p) => sum + Number(p.amount),
          0
        )

        const difference = paidAmount - currentPaymentSum
        // Only create adjustment if there's actually a mismatch
        if (Math.abs(difference) > PAYMENT_TOLERANCE) {
          // isAdjustment: requires `prisma generate` after migration
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (tx.payment.create as any)({
            data: {
              saleId: id,
              method: 'PIX',
              amount: difference,
              feePercent: 0,
              feeAmount: 0,
              feeAbsorber: 'SELLER',
              installments: 1,
              isAdjustment: true,
              paidAt: new Date(),
            },
          })
          console.log(
            `[OVERRIDE] Criado Payment de ajuste: R$ ${difference.toFixed(2)} ` +
            `(Payment total era R$ ${currentPaymentSum.toFixed(2)}, ` +
            `override paidAmount = R$ ${paidAmount.toFixed(2)})`
          )
        }
      }

      // Override status if explicitly provided
      if (status !== undefined) {
        saleUpdateData.status = status
      } else {
        // Auto-determine status from receivables
        const currentReceivables = await tx.receivable.findMany({
          where: { saleId: id, status: { not: 'CANCELLED' } },
        })

        const saleTotal = discountPercent !== undefined
          ? Number(sale.subtotal) - (Number(sale.subtotal) * (discountPercent / 100))
          : Number(sale.total)

        const effectivePaidAmount = paidAmount !== undefined
          ? paidAmount
          : Number(sale.paidAmount)

        const allPaid = currentReceivables.length > 0
          ? currentReceivables.every((r) => r.status === 'PAID')
          : effectivePaidAmount >= saleTotal - PAYMENT_TOLERANCE

        if (allPaid || effectivePaidAmount >= saleTotal - PAYMENT_TOLERANCE) {
          saleUpdateData.status = 'COMPLETED'
        } else {
          saleUpdateData.status = 'PENDING'
        }
      }

      // 4. Apply sale update
      const updatedSale = await tx.sale.update({
        where: { id },
        data: saleUpdateData,
        include: {
          client: true,
          items: {
            include: { product: true },
          },
          payments: true,
          receivables: {
            orderBy: { installment: 'asc' },
          },
        },
      })

      return updatedSale
    })

    // Invalidate ALL caches — Super Edição must reflect everywhere
    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)
    cache.invalidatePrefix(CACHE_KEYS.DEBTORS)

    return NextResponse.json({
      success: true,
      message: 'Venda atualizada com sucesso (override)',
      data: updated,
    })
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}
