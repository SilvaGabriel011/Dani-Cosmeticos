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

function buildDueDateFromMonth(baseDate: Date, monthOffset: number, dayOfMonth: number) {
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
    paidAt?: Date
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
      await tx.payment.create({
        data: {
          saleId: receivable.saleId,
          method: paymentMethod,
          amount: amount,
          feePercent: 0,
          feeAmount: 0,
          feeAbsorber: 'SELLER',
          installments: 1,
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

      await tx.sale.update({
        where: { id: receivable.saleId },
        data: {
          paidAmount: totalPaidFromPayments,
          // Update status to COMPLETED if all receivables are paid
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

      const created = await prisma.receivable.create({
        data: {
          saleId,
          installment: 1,
          amount: saleRemaining,
          paidAmount: 0,
          dueDate: sale.dueDate || new Date(),
          status: 'PENDING',
        },
      })
      receivables.push(created)
    }

    // Calculate total remaining for the sale
    const totalRemaining = receivables.reduce(
      (sum, r) => sum + (Number(r.amount) - Number(r.paidAmount)),
      0
    )

    if (amount > totalRemaining + PAYMENT_TOLERANCE) {
      throw new Error(`Valor excede o saldo devedor total. Maximo: R$ ${totalRemaining.toFixed(2)}`)
    }

    let remainingPayment = amount

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReceivables = []
      const feePercent = paymentAudit?.feePercent || 0
      const feeAbsorber = paymentAudit?.feeAbsorber || 'SELLER'
      const installments = paymentAudit?.installments || 1
      const feeAmount = amount * (feePercent / 100)

      for (const receivable of receivables) {
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

      // Update sale paidAmount using sum of all Payment records (includes initial payments)
      const allPayments = await tx.payment.findMany({
        where: { saleId },
      })
      const totalPaidFromPayments = allPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      )

      // Check if all receivables are paid
      const allReceivables = await tx.receivable.findMany({
        where: { saleId, status: { not: 'CANCELLED' } },
      })
      const allReceivablesPaid = allReceivables.every((r) => r.status === 'PAID')

      // Update dueDate of remaining pending receivables to push client to end of queue
      // Only update if there are still pending receivables (not fully paid)
      if (!allReceivablesPaid) {
        const pendingReceivables = allReceivables.filter(
          (r) => r.status === 'PENDING' || r.status === 'PARTIAL'
        )

        if (pendingReceivables.length > 0) {
          // Get the sale to check for paymentDay configuration
          const sale = (await tx.sale.findUnique({ where: { id: saleId } })) as {
            paymentDay?: number | null
          } | null

          // Calculate new due date: 30 days from now, or use paymentDay if configured
          const now = new Date()
          let newDueDate = buildDueDateFromMonth(now, 1, now.getDate())

          // If sale has a specific payment day configured, use it
          if (sale?.paymentDay) {
            newDueDate = buildDueDateFromMonth(now, 1, sale.paymentDay)
          }

          // Update the next pending receivable's due date
          const nextPending = pendingReceivables.sort((a, b) => a.installment - b.installment)[0]
          await tx.receivable.update({
            where: { id: nextPending.id },
            data: { dueDate: newDueDate },
          })
        }
      }

      // Recalculate totalFees and netTotal absolutely (safer than increment/decrement)
      const currentSale = await tx.sale.findUnique({ where: { id: saleId } })
      let newTotalFees = Number(currentSale!.totalFees)
      if (feeAbsorber === 'SELLER') {
        newTotalFees += feeAmount
      }
      const newNetTotal = Number(currentSale!.total) - newTotalFees

      await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: totalPaidFromPayments,
          totalFees: newTotalFees,
          netTotal: newNetTotal,
          ...(allReceivablesPaid && { status: 'COMPLETED' }),
        },
      })

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

    const receivables = Array.from({ length: installmentPlan }, (_, i) => {
      const installmentDueDate = new Date(dueDate)
      installmentDueDate.setMonth(installmentDueDate.getMonth() + i)

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
