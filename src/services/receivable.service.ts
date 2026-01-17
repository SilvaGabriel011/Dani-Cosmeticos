import { prisma } from "@/lib/prisma"
import { ReceivableStatus } from "@prisma/client"

interface ListFilters {
  clientId?: string
  saleId?: string
  status?: ReceivableStatus | ReceivableStatus[]
  startDate?: Date
  endDate?: Date
  limit?: number
}

export const receivableService = {
  async list(filters: ListFilters = {}) {
    const { clientId, saleId, status, startDate, endDate, limit = 50 } = filters

    return prisma.receivable.findMany({
      where: {
        ...(saleId && { saleId }),
        ...(clientId && { sale: { clientId } }),
        ...(status && (Array.isArray(status) ? { status: { in: status } } : { status })),
        ...(startDate && endDate && {
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
      orderBy: { dueDate: "asc" },
      take: limit,
    })
  },

  async listByClient(clientId: string, filters?: { startDate?: Date; endDate?: Date }) {
    return prisma.receivable.findMany({
      where: {
        sale: { clientId },
        ...(filters?.startDate && filters?.endDate && {
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
      orderBy: { dueDate: "asc" },
    })
  },

  async listPending(filters?: { startDate?: Date; endDate?: Date; limit?: number }) {
    const now = new Date()
    return prisma.receivable.findMany({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        ...(filters?.startDate && filters?.endDate && {
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
      orderBy: { dueDate: "asc" },
      take: filters?.limit || 50,
    })
  },

  async listOverdue(limit?: number) {
    const now = new Date()
    return prisma.receivable.findMany({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: { lt: now },
      },
      include: {
        sale: {
          include: { client: true },
        },
      },
      orderBy: { dueDate: "asc" },
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
    paymentMethod: "CASH" | "PIX" | "DEBIT" | "CREDIT" = "CASH",
    paidAt?: Date
  ) {
    const receivable = await prisma.receivable.findUnique({ 
      where: { id },
      include: { sale: true }
    })
    if (!receivable) throw new Error("Parcela não encontrada")

    const newPaidAmount = Number(receivable.paidAmount) + amount
    const expectedAmount = Number(receivable.amount)

    let newStatus: ReceivableStatus = "PENDING"
    if (newPaidAmount >= expectedAmount) {
      newStatus = "PAID"
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL"
    }

    // Use transaction to ensure atomicity
    const updated = await prisma.$transaction(async (tx) => {
      // Update receivable
      const updatedReceivable = await tx.receivable.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          paidAt: newStatus === "PAID" ? (paidAt || new Date()) : null,
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
          feeAbsorber: "SELLER",
          installments: 1,
        },
      })

      // Update sale paidAmount
      const allReceivables = await tx.receivable.findMany({
        where: { saleId: receivable.saleId },
      })

      const totalPaidFromReceivables = allReceivables.reduce(
        (sum, r) => sum + Number(r.paidAmount),
        0
      )

      // Get existing payments that were made at sale creation time
      const existingPayments = await tx.payment.findMany({
        where: { saleId: receivable.saleId },
      })

      // Calculate total paid (initial payments + receivable payments)
      // Note: We need to be careful not to double count - the payment we just created
      // is for the receivable, so we use totalPaidFromReceivables as the source of truth
      const sale = await tx.sale.findUnique({ where: { id: receivable.saleId } })
      const saleTotal = Number(sale?.total || 0)

      // Check if sale is fully paid
      const isFullyPaid = totalPaidFromReceivables >= saleTotal - 0.01
      const allReceivablesPaid = allReceivables.every(r => 
        r.id === id ? newStatus === "PAID" : r.status === "PAID"
      )

      await tx.sale.update({
        where: { id: receivable.saleId },
        data: { 
          paidAmount: totalPaidFromReceivables,
          // Update status to COMPLETED if all receivables are paid
          ...(allReceivablesPaid && { status: "COMPLETED" }),
        },
      })

      return updatedReceivable
    })

    return updated
  },

  async registerPaymentWithDistribution(
    saleId: string,
    amount: number,
    paymentMethod: "CASH" | "PIX" | "DEBIT" | "CREDIT" = "CASH",
    paidAt?: Date
  ) {
    // Get all pending/partial receivables for this sale, ordered by installment
    const receivables = await prisma.receivable.findMany({
      where: {
        saleId,
        status: { in: ["PENDING", "PARTIAL"] },
      },
      orderBy: { installment: "asc" },
    })

    if (receivables.length === 0) {
      throw new Error("Nenhuma parcela pendente encontrada para esta venda")
    }

    // Calculate total remaining for the sale
    const totalRemaining = receivables.reduce(
      (sum, r) => sum + (Number(r.amount) - Number(r.paidAmount)),
      0
    )

    if (amount > totalRemaining + 0.01) {
      throw new Error(`Valor excede o saldo devedor total. Maximo: R$ ${totalRemaining.toFixed(2)}`)
    }

    let remainingPayment = amount

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReceivables = []

      for (const receivable of receivables) {
        if (remainingPayment <= 0.01) break

        const receivableRemaining = Number(receivable.amount) - Number(receivable.paidAmount)
        const paymentForThis = Math.min(remainingPayment, receivableRemaining)

        const newPaidAmount = Number(receivable.paidAmount) + paymentForThis
        let newStatus: ReceivableStatus = "PENDING"
        if (newPaidAmount >= Number(receivable.amount) - 0.01) {
          newStatus = "PAID"
        } else if (newPaidAmount > 0) {
          newStatus = "PARTIAL"
        }

        const updatedReceivable = await tx.receivable.update({
          where: { id: receivable.id },
          data: {
            paidAmount: newPaidAmount,
            status: newStatus,
            paidAt: newStatus === "PAID" ? (paidAt || new Date()) : null,
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
          feePercent: 0,
          feeAmount: 0,
          feeAbsorber: "SELLER",
          installments: 1,
          paidAt: paidAt || new Date(),
        },
      })

      // Update sale paidAmount
      const allReceivables = await tx.receivable.findMany({
        where: { saleId },
      })

      const totalPaidFromReceivables = allReceivables.reduce(
        (sum, r) => sum + Number(r.paidAmount),
        0
      )

      const allReceivablesPaid = allReceivables.every(r => r.status === "PAID")

      await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: totalPaidFromReceivables,
          ...(allReceivablesPaid && { status: "COMPLETED" }),
        },
      })

      return updatedReceivables
    })

    return updated
  },

  async updateSalePaidAmount(saleId: string) {
    const receivables = await prisma.receivable.findMany({
      where: { saleId },
    })

    const totalPaid = receivables.reduce(
      (sum, r) => sum + Number(r.paidAmount),
      0
    )

    await prisma.sale.update({
      where: { id: saleId },
      data: { paidAmount: totalPaid },
    })
  },

  async createForSale(
    saleId: string,
    total: number,
    installmentPlan: number,
    dueDate: Date
  ) {
    const installmentAmount = total / installmentPlan

    const receivables = Array.from({ length: installmentPlan }, (_, i) => {
      const installmentDueDate = new Date(dueDate)
      installmentDueDate.setMonth(installmentDueDate.getMonth() + i)

      return {
        saleId,
        installment: i + 1,
        amount: installmentAmount,
        dueDate: installmentDueDate,
      }
    })

    return prisma.receivable.createMany({ data: receivables })
  },

  async getSummaryByClient(clientId: string) {
    const receivables = await prisma.receivable.findMany({
      where: {
        sale: { clientId },
        status: { in: ["PENDING", "PARTIAL"] },
      },
    })

    const totalDue = receivables.reduce(
      (sum, r) => sum + Number(r.amount) - Number(r.paidAmount),
      0
    )

    const overdueCount = receivables.filter(
      (r) => new Date(r.dueDate) < new Date()
    ).length

    return {
      totalDue,
      pendingCount: receivables.length,
      overdueCount,
    }
  },

  async getDashboardSummary(startDate?: Date, endDate?: Date) {
    const now = new Date()
    
    const receivables = await prisma.receivable.findMany({
      where: {
        status: { in: ["PENDING", "PARTIAL"] },
        ...(startDate && endDate && {
          dueDate: {
            gte: startDate,
            lte: endDate,
          },
        }),
      },
      include: {
        sale: {
          include: { client: true },
        },
      },
      orderBy: { dueDate: "asc" },
    })

    const totalDue = receivables.reduce(
      (sum, r) => sum + Number(r.amount) - Number(r.paidAmount),
      0
    )

    const overdueReceivables = receivables.filter(
      (r) => new Date(r.dueDate) < now
    )

    const totalOverdue = overdueReceivables.reduce(
      (sum, r) => sum + Number(r.amount) - Number(r.paidAmount),
      0
    )

    return {
      totalDue,
      totalOverdue,
      pendingCount: receivables.length,
      overdueCount: overdueReceivables.length,
      receivables: receivables.slice(0, 10),
    }
  },
}
