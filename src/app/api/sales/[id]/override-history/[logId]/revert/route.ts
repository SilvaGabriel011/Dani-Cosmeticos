import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { AppError, ErrorCodes, handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface PreviousState {
  status: string
  paidAmount: number
  notes: string | null
  discountPercent: number
  discountAmount: number
  total: number
  netTotal: number
  receivables: Array<{
    id: string
    installment: number
    amount: number
    paidAmount: number
    status: string
    dueDate: string
  }>
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; logId: string } }
) {
  try {
    const { id: saleId, logId } = params

    // Find the log entry
    const log = await prisma.saleOverrideLog.findUnique({
      where: { id: logId },
    })

    if (!log || log.saleId !== saleId) {
      throw new AppError(ErrorCodes.NOT_FOUND, 404, { message: 'Log de override não encontrado' })
    }

    const previousState = log.previousState as PreviousState

    // Find the current sale
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { receivables: true },
    })

    if (!sale) {
      throw new AppError(ErrorCodes.SALE_NOT_FOUND, 404)
    }

    // Revert to previous state
    const reverted = await prisma.$transaction(async (tx) => {
      // Save current state before reverting (so user can undo the revert)
      const currentState = {
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

      await tx.saleOverrideLog.create({
        data: {
          saleId,
          reason: `Revert para estado anterior (log ${logId.slice(0, 8)})`,
          changes: { revertedFrom: logId },
          previousState: currentState,
        },
      })

      // Delete current receivables
      await tx.receivable.deleteMany({
        where: { saleId },
      })

      // Recreate receivables from previous state
      for (const rec of previousState.receivables) {
        await tx.receivable.create({
          data: {
            saleId,
            installment: rec.installment,
            amount: rec.amount,
            paidAmount: rec.paidAmount,
            status: rec.status as 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED',
            dueDate: new Date(rec.dueDate),
            paidAt: rec.status === 'PAID' ? new Date() : null,
          },
        })
      }

      // Update sale to previous state
      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: previousState.status as 'COMPLETED' | 'PENDING' | 'CANCELLED',
          paidAmount: previousState.paidAmount,
          notes: previousState.notes,
          discountPercent: previousState.discountPercent,
          discountAmount: previousState.discountAmount,
          total: previousState.total,
          netTotal: previousState.netTotal,
        },
        include: {
          client: true,
          items: { include: { product: true } },
          payments: true,
          receivables: { orderBy: { installment: 'asc' } },
        },
      })

      return updatedSale
    })

    // Invalidate caches
    cache.invalidate(CACHE_KEYS.DASHBOARD)
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)
    cache.invalidatePrefix(CACHE_KEYS.DEBTORS)

    return NextResponse.json({
      success: true,
      message: 'Venda revertida com sucesso',
      data: reverted,
    })
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}
