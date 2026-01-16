import { prisma } from "@/lib/prisma"
import { ReceivableStatus } from "@prisma/client"

interface ListFilters {
  clientId?: string
  saleId?: string
  status?: ReceivableStatus
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
        ...(status && { status }),
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

  async registerPayment(id: string, amount: number, paidAt?: Date) {
    const receivable = await prisma.receivable.findUnique({ where: { id } })
    if (!receivable) throw new Error("Parcela não encontrada")

    const newPaidAmount = Number(receivable.paidAmount) + amount
    const expectedAmount = Number(receivable.amount)

    let newStatus: ReceivableStatus = "PENDING"
    if (newPaidAmount >= expectedAmount) {
      newStatus = "PAID"
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL"
    }

    const updated = await prisma.receivable.update({
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

    await this.updateSalePaidAmount(receivable.saleId)

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
