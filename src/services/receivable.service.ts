import { Prisma, type FeeAbsorber, type ReceivableStatus } from '@prisma/client'

import { PAYMENT_TOLERANCE } from '@/lib/constants'
import { prisma } from '@/lib/prisma'

interface ListFilters {
  clientId?: string
  saleId?: string
  status?: ReceivableStatus | ReceivableStatus[]
  startDate?: Date
  endDate?: Date
  limit?: number
}

interface PaymentAuditOptions {
  feePercent?: number
  feeAbsorber?: FeeAbsorber
  installments?: number
}

/**
 * Validates that the sum of receivable amounts matches the expected total.
 * Logs a warning if divergence exceeds PAYMENT_TOLERANCE.
 */
export function assertReceivablesMatchTotal(
  receivableAmounts: number[],
  expectedTotal: number,
  context: string
) {
  const sum = receivableAmounts.reduce((acc, a) => acc + a, 0)
  const diff = Math.abs(sum - expectedTotal)
  if (diff > PAYMENT_TOLERANCE) {
    console.warn(
      `[assertReceivablesMatchTotal] Divergência em ${context}: ` +
      `soma parcelas = R$ ${sum.toFixed(2)}, esperado = R$ ${expectedTotal.toFixed(2)}, ` +
      `diff = R$ ${diff.toFixed(2)}`
    )
  }
}

export function buildDueDateFromMonth(baseDate: Date, monthOffset: number, dayOfMonth: number) {
  const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(dayOfMonth, lastDay))
}

export const receivableService = {
  async list(filters: ListFilters = {}) {
    const { clientId, saleId, status, startDate, endDate, limit = 50 } = filters

    // Exclude CANCELLED by default when no status filter is provided
    const statusFilter = status
      ? Array.isArray(status)
        ? { status: { in: status } }
        : { status }
      : { status: { not: 'CANCELLED' as const } }

    return prisma.receivable.findMany({
      where: {
        ...(saleId && { saleId }),
        ...(clientId && { sale: { clientId } }),
        ...statusFilter,
        ...(startDate &&
          endDate && {
            dueDate: {
              gte: startDate,
              lte: endDate,
            },
          }),
      },
      include: {
        sale: {
          include: {
            client: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    })
  },

  async listByClient(clientId: string, filters?: { startDate?: Date; endDate?: Date }) {
    return prisma.receivable.findMany({
      where: {
        sale: { clientId },
        status: { not: 'CANCELLED' },
        ...(filters?.startDate &&
          filters?.endDate && {
            dueDate: {
              gte: filters.startDate,
              lte: filters.endDate,
            },
          }),
      },
      include: {
        sale: {
          include: { client: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    })
  },

  async listPending(filters?: { startDate?: Date; endDate?: Date; limit?: number }) {
    return prisma.receivable.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIAL'] },
        ...(filters?.startDate &&
          filters?.endDate && {
            dueDate: {
              gte: filters.startDate,
              lte: filters.endDate,
            },
          }),
      },
      include: {
        sale: {
          include: { client: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: filters?.limit || 50,
    })
  },

  async listOverdue(limit?: number) {
    const now = new Date()
    return prisma.receivable.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIAL'] },
        dueDate: { lt: now },
      },
      include: {
        sale: {
          include: { client: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: limit || 50,
    })
  },

  async getById(id: string) {
    return prisma.receivable.findUnique({
      where: { id },
      include: {
        sale: {
          include: { client: true },
        },
      },
    })
  },

  async registerPayment(
    id: string,
    amount: number,
    paymentMethod: 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT' = 'CASH',
    paidAt?: Date,
    paymentAudit?: PaymentAuditOptions
  ) {
    const receivable = await prisma.receivable.findUnique({
      where: { id },
      include: { sale: true },
    })
    if (!receivable) throw new Error('Parcela não encontrada')
    if (receivable.status === 'CANCELLED') throw new Error('Não é possível registrar pagamento em parcela cancelada')
    if (receivable.status === 'PAID') throw new Error('Parcela já foi paga')

    const newPaidAmount = Number(receivable.paidAmount) + amount
    const expectedAmount = Number(receivable.amount)

    // Validate payment doesn't exceed remaining balance
    const remainingOnReceivable = expectedAmount - Number(receivable.paidAmount)
    if (amount > remainingOnReceivable + PAYMENT_TOLERANCE) {
      throw new Error(`Valor excede o saldo da parcela. Máximo: R$ ${remainingOnReceivable.toFixed(2)}`)
    }

    let newStatus: ReceivableStatus = 'PENDING'
    if (newPaidAmount >= expectedAmount - PAYMENT_TOLERANCE) {
      newStatus = 'PAID'
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIAL'
    }

    // Use transaction to ensure atomicity
    const updated = await prisma.$transaction(async (tx) => {
      // Update receivable
      const updatedReceivable = await tx.receivable.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          paidAt: newStatus === 'PAID' ? paidAt || new Date() : null,
          status: newStatus,
        },
        include: {
          sale: {
            include: { client: true },
          },
        },
      })

      // Create Payment record for audit trail
      const feePercent = paymentAudit?.feePercent || 0
      const feeAbsorber = paymentAudit?.feeAbsorber || 'SELLER'
      const paymentInstallments = paymentAudit?.installments || 1
      const feeAmount = amount * (feePercent / 100)

      await tx.payment.create({
        data: {
          saleId: receivable.saleId,
          method: paymentMethod,
          amount: amount,
          feePercent,
          feeAmount,
          feeAbsorber,
          installments: paymentInstallments,
        },
      })

      // Update sale paidAmount using sum of all Payment records (includes initial payments)
      const allPayments = await tx.payment.findMany({
        where: { saleId: receivable.saleId },
      })
      const totalPaidFromPayments = allPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      )

      // Check if all receivables are paid
      const allReceivables = await tx.receivable.findMany({
        where: { saleId: receivable.saleId, status: { not: 'CANCELLED' } },
      })
      const allReceivablesPaid = allReceivables.every((r) =>
        r.id === id ? newStatus === 'PAID' : r.status === 'PAID'
      )

      // Recalculate totalFees absolutely from all payments (safer than incremental)
      const newTotalFees = allPayments.reduce((sum, p) => {
        if (p.feeAbsorber === 'SELLER') return sum + Number(p.feeAmount)
        return sum
      }, 0)
      const newNetTotal = Number(receivable.sale.total) - newTotalFees

      await tx.sale.update({
        where: { id: receivable.saleId },
        data: {
          paidAmount: totalPaidFromPayments,
          totalFees: newTotalFees,
          netTotal: newNetTotal,
          ...(allReceivablesPaid && { status: 'COMPLETED' }),
        },
      })

      return updatedReceivable
    })

    return updated
  },

  async registerPaymentWithDistribution(
    saleId: string,
    amount: number,
    paymentMethod: 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT' = 'CASH',
    paidAt?: Date,
    paymentAudit?: PaymentAuditOptions
  ) {
    // Get all pending/partial receivables for this sale, ordered by installment
    const receivables = await prisma.receivable.findMany({
      where: {
        saleId,
        status: { in: ['PENDING', 'PARTIAL'] },
      },
      orderBy: { installment: 'asc' },
    })

    if (receivables.length === 0) {
      // Auto-create a receivable for sales with remaining balance but no pending receivables
      const sale = await prisma.sale.findUnique({ where: { id: saleId } })
      if (!sale) throw new Error('Venda não encontrada')

      const saleRemaining = Number(sale.total) - Number(sale.paidAmount)
      if (saleRemaining <= PAYMENT_TOLERANCE) {
        throw new Error('Nenhuma parcela pendente encontrada para esta venda')
      }

      // Find the highest existing installment number to avoid duplicates
      const lastExisting = await prisma.receivable.findFirst({
        where: { saleId },
        orderBy: { installment: 'desc' },
        select: { installment: true },
      })
      const nextInstallment = (lastExisting?.installment ?? 0) + 1

      const now = new Date()
      const salePaymentDay = (sale as { paymentDay?: number | null })?.paymentDay
      const fallbackDueDate = salePaymentDay
        ? buildDueDateFromMonth(now, 1, salePaymentDay)
        : buildDueDateFromMonth(now, 1, now.getDate())

      const created = await prisma.receivable.create({
        data: {
          saleId,
          installment: nextInstallment,
          amount: saleRemaining,
          paidAmount: 0,
          dueDate: sale.dueDate || fallbackDueDate,
          status: 'PENDING',
        },
      })
      receivables.push(created)
    }

    // Calculate total remaining for the sale based on total - payments
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        payments: true,
      },
    })
    if (!sale) throw new Error('Venda não encontrada')

    const totalPayments = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalRemaining = Number(sale.total) - totalPayments

    if (totalRemaining < -PAYMENT_TOLERANCE) {
      throw new Error('Esta venda já foi paga completamente')
    }

    if (amount > totalRemaining + PAYMENT_TOLERANCE) {
      throw new Error(`Valor excede o saldo devedor total. Maximo: R$ ${totalRemaining.toFixed(2)}`)
    }

    // Check if this payment fully pays off the sale (quitação)
    const willFullyPay = (totalPayments + amount) >= Number(sale.total) - PAYMENT_TOLERANCE

    // Only distribute to receivables whose dueDate <= now (already due/overdue)
    // Exception: if fully paying off, distribute to ALL receivables
    const now = new Date()
    const eligibleReceivables = willFullyPay
      ? receivables
      : receivables.filter((r) => r.dueDate <= now)

    let remainingPayment = amount

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReceivables = []
      const feePercent = paymentAudit?.feePercent || 0
      const feeAbsorber = paymentAudit?.feeAbsorber || 'SELLER'
      const installments = paymentAudit?.installments || 1
      const feeAmount = amount * (feePercent / 100)

      // Distribute only to eligible (due) receivables
      for (const receivable of eligibleReceivables) {
        if (remainingPayment <= PAYMENT_TOLERANCE) break

        const receivableRemaining = Number(receivable.amount) - Number(receivable.paidAmount)
        const paymentForThis = Math.min(remainingPayment, receivableRemaining)

        const newPaidAmount = Number(receivable.paidAmount) + paymentForThis
        let newStatus: ReceivableStatus = 'PENDING'
        if (newPaidAmount >= Number(receivable.amount) - PAYMENT_TOLERANCE) {
          newStatus = 'PAID'
        } else if (newPaidAmount > 0) {
          newStatus = 'PARTIAL'
        }

        const updatedReceivable = await tx.receivable.update({
          where: { id: receivable.id },
          data: {
            paidAmount: newPaidAmount,
            status: newStatus,
            paidAt: newStatus === 'PAID' ? paidAt || new Date() : null,
          },
        })

        updatedReceivables.push(updatedReceivable)
        remainingPayment -= paymentForThis
      }

      // Create Payment record for audit trail
      await tx.payment.create({
        data: {
          saleId,
          method: paymentMethod,
          amount: amount,
          feePercent,
          feeAmount,
          feeAbsorber,
          installments,
          paidAt: paidAt || new Date(),
        },
      })

      // Update sale paidAmount using sum of all Payment records
      const allPayments = await tx.payment.findMany({
        where: { saleId },
      })
      const totalPaidFromPayments = allPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      )

      // Recalculate totalFees absolutely from all payments
      const currentSale = await tx.sale.findUnique({ where: { id: saleId } })
      const newTotalFees = allPayments.reduce((sum, p) => {
        if (p.feeAbsorber === 'SELLER') return sum + Number(p.feeAmount)
        return sum
      }, 0)
      const newNetTotal = Number(currentSale!.total) - newTotalFees

      // Sale is COMPLETED only if fully paid (quitação)
      const isFullyPaid = totalPaidFromPayments >= Number(currentSale!.total) - PAYMENT_TOLERANCE

      await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: totalPaidFromPayments,
          totalFees: newTotalFees,
          netTotal: newNetTotal,
          ...(isFullyPaid && { status: 'COMPLETED' }),
        },
      })

      // If fully paid, mark ALL remaining receivables as PAID
      if (isFullyPaid) {
        await tx.receivable.updateMany({
          where: { saleId, status: { in: ['PENDING', 'PARTIAL'] } },
          data: { status: 'PAID', paidAt: paidAt || new Date() },
        })
      }

      return updatedReceivables
    })

    return updated
  },

  async updateSalePaidAmount(saleId: string) {
    // Use sum of all Payment records (includes initial payments at sale creation)
    const allPayments = await prisma.payment.findMany({
      where: { saleId },
    })
    const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)

    await prisma.sale.update({
      where: { id: saleId },
      data: { paidAmount: totalPaid },
    })
  },

  async createForSale(saleId: string, total: number, installmentPlan: number, dueDate: Date) {
    const installmentAmount = Math.floor((total / installmentPlan) * 100) / 100
    const dayOfMonth = dueDate.getDate()

    const receivables = Array.from({ length: installmentPlan }, (_, i) => {
      const installmentDueDate = buildDueDateFromMonth(dueDate, i, dayOfMonth)

      // Last installment absorbs rounding remainder
      const isLast = i === installmentPlan - 1
      const thisAmount = isLast
        ? Math.max(0.01, total - installmentAmount * (installmentPlan - 1))
        : installmentAmount

      return {
        saleId,
        installment: i + 1,
        amount: Number(thisAmount.toFixed(2)),
        dueDate: installmentDueDate,
      }
    })

    assertReceivablesMatchTotal(
      receivables.map((r) => r.amount),
      total,
      `createForSale(saleId=${saleId})`
    )

    return prisma.receivable.createMany({ data: receivables })
  },

  async getSummaryByClient(clientId: string) {
    const receivables = await prisma.receivable.findMany({
      where: {
        sale: { clientId },
        status: { in: ['PENDING', 'PARTIAL'] },
      },
    })

    const totalDue = receivables.reduce(
      (sum, r) => sum + Number(r.amount) - Number(r.paidAmount),
      0
    )

    const overdueCount = receivables.filter((r) => new Date(r.dueDate) < new Date()).length

    return {
      totalDue,
      pendingCount: receivables.length,
      overdueCount,
    }
  },

  async getDashboardSummary(startDate?: Date, endDate?: Date) {
    // Use SQL aggregation for better performance - single query for all totals
    // Apply date filter to totals so cards match the filtered list
    const dateFilter = startDate && endDate
      ? Prisma.sql`AND r."dueDate" >= ${startDate} AND r."dueDate" <= ${endDate}`
      : Prisma.empty

    const summaryResult = await prisma.$queryRaw<
      {
        totalDue: string | null
        totalOverdue: string | null
        pendingCount: string
        overdueCount: string
      }[]
    >`
      SELECT 
        COALESCE(SUM(r."amount" - r."paidAmount"), 0)::text as "totalDue",
        COALESCE(SUM(CASE WHEN r."dueDate" < NOW() THEN r."amount" - r."paidAmount" ELSE 0 END), 0)::text as "totalOverdue",
        COUNT(*)::text as "pendingCount",
        COUNT(CASE WHEN r."dueDate" < NOW() THEN 1 END)::text as "overdueCount"
      FROM "Receivable" r
      WHERE r."status" IN ('PENDING', 'PARTIAL')
      ${dateFilter}
    `

    // Fetch only top 10 receivables for display (lightweight query with select)
    const receivables = await prisma.receivable.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIAL'] },
        ...(startDate &&
          endDate && {
            dueDate: { gte: startDate, lte: endDate },
          }),
      },
      select: {
        id: true,
        installment: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        status: true,
        sale: {
          select: {
            id: true,
            total: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    })

    const summary = summaryResult[0] || {
      totalDue: '0',
      totalOverdue: '0',
      pendingCount: '0',
      overdueCount: '0',
    }

    return {
      totalDue: Number(summary.totalDue || 0),
      totalOverdue: Number(summary.totalOverdue || 0),
      pendingCount: Number(summary.pendingCount || 0),
      overdueCount: Number(summary.overdueCount || 0),
      receivables,
    }
  },

  async recalculateAfterPaymentChange(saleId: string, tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
    const db = tx || prisma

    // Sum all remaining payments for this sale
    const allPayments = await db.payment.findMany({ where: { saleId } })
    const totalPaidFromPayments = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)

    // Recalculate totalFees from all payments where feeAbsorber === SELLER
    const totalFees = allPayments.reduce((sum, p) => {
      if (p.feeAbsorber === 'SELLER') return sum + Number(p.feeAmount)
      return sum
    }, 0)

    // Get all non-cancelled receivables ordered by installment
    const receivables = await db.receivable.findMany({
      where: { saleId, status: { not: 'CANCELLED' } },
      orderBy: { installment: 'asc' },
    })

    // Determine if fully paid (quitação)
    const sale = await db.sale.findUnique({ where: { id: saleId } })
    if (!sale) return

    const isFullyPaid = totalPaidFromPayments >= Number(sale.total) - PAYMENT_TOLERANCE
    const now = new Date()

    // Redistribute totalPaidFromPayments across receivables sequentially
    // Only allocate to receivables with dueDate <= now, UNLESS fully paid (quitação)
    let remaining = totalPaidFromPayments
    for (const receivable of receivables) {
      const receivableAmount = Number(receivable.amount)
      const isDue = receivable.dueDate <= now

      // Only allocate to due receivables, or all if fully paid
      const allocate = (isDue || isFullyPaid)
        ? Math.min(remaining, receivableAmount)
        : 0

      let newStatus: ReceivableStatus = 'PENDING'
      if (allocate >= receivableAmount - PAYMENT_TOLERANCE) {
        newStatus = 'PAID'
      } else if (allocate > PAYMENT_TOLERANCE) {
        newStatus = 'PARTIAL'
      }

      await db.receivable.update({
        where: { id: receivable.id },
        data: {
          paidAmount: Math.max(0, allocate),
          status: newStatus,
          paidAt: newStatus === 'PAID' ? (receivable.paidAt || new Date()) : null,
        },
      })

      if (isDue || isFullyPaid) {
        remaining -= allocate
      }
    }

    const newNetTotal = Number(sale.total) - totalFees

    // Sale is COMPLETED only if fully paid
    // If not fully paid → PENDING (customer appears in dashboard)
    let newStatus: 'COMPLETED' | 'PENDING'
    if (isFullyPaid) {
      newStatus = 'COMPLETED'
    } else {
      newStatus = 'PENDING'
    }

    await db.sale.update({
      where: { id: saleId },
      data: {
        paidAmount: totalPaidFromPayments,
        totalFees,
        netTotal: newNetTotal,
        status: newStatus,
      },
    })
  },

  async listSalesWithPendingReceivables(limit?: number) {
    const where = {
      status: 'PENDING' as const,
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client: true,
          receivables: {
            where: { status: { not: 'CANCELLED' } },
            orderBy: { installment: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit || 100,
      }),
      prisma.sale.count({ where }),
    ])

    return { data: sales, total }
  },
}
