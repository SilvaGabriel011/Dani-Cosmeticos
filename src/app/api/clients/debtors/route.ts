import { Prisma } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_TTL } from '@/lib/cache'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface DebtorSummary {
  clientId: string
  clientName: string
  clientPhone: string | null
  clientAddress: string | null
  clientDiscount: string
  totalDebt: string
  overdueAmount: string
  salesCount: string
  oldestDueDate: Date | null
}

type ValidSortBy = 'totalDebt' | 'overdueAmount' | 'oldestDueDate' | 'name'

const ORDER_BY_MAP: Record<ValidSortBy, Prisma.Sql> = {
  totalDebt: Prisma.sql`ORDER BY total_debt_num DESC`,
  overdueAmount: Prisma.sql`ORDER BY overdue_amount_num DESC`,
  oldestDueDate: Prisma.sql`ORDER BY "oldestDueDate" ASC NULLS LAST`,
  name: Prisma.sql`ORDER BY "clientName" ASC`,
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'totalDebt'

    // Build cache key
    const cacheKey = `debtors:${search}:${sortBy}`
    const cached = cache.get(cacheKey)
    if (cached && !search) {
      return NextResponse.json(cached)
    }

    // Multi-word accent-insensitive search via unaccent()
    let searchClause = Prisma.empty
    if (search.trim()) {
      const words = search.trim().split(/\s+/).filter(Boolean)
      const wordConditions = words.map(
        (word) =>
          Prisma.sql`(
            unaccent(c."name") ILIKE unaccent(${'%' + word + '%'})
            OR unaccent(COALESCE(c."phone", '')) ILIKE unaccent(${'%' + word + '%'})
          )`
      )
      const combined = wordConditions.reduce((acc, condition) =>
        Prisma.sql`${acc} AND ${condition}`
      )
      searchClause = Prisma.sql`AND ${combined}`
    }

    // Validate sortBy to prevent injection
    const validSortBy = (Object.keys(ORDER_BY_MAP) as ValidSortBy[]).includes(sortBy as ValidSortBy)
      ? (sortBy as ValidSortBy)
      : 'totalDebt'
    const orderByClause = ORDER_BY_MAP[validSortBy]

    // Single optimized query with safe parameterized inputs
    const debtorsSummary = await prisma.$queryRaw<DebtorSummary[]>`
      SELECT
        c."id" as "clientId",
        c."name" as "clientName",
        c."phone" as "clientPhone",
        c."address" as "clientAddress",
        c."discount"::text as "clientDiscount",
        COALESCE((
          SELECT SUM(r."amount" - r."paidAmount")
          FROM "Receivable" r
          WHERE r."saleId" = ANY(ARRAY_AGG(s."id"))
            AND r."status" IN ('PENDING', 'PARTIAL')
        ), 0)::text as "totalDebt",
        COALESCE((
          SELECT SUM(r."amount" - r."paidAmount")
          FROM "Receivable" r
          WHERE r."saleId" = ANY(ARRAY_AGG(s."id"))
            AND r."status" IN ('PENDING', 'PARTIAL')
        ), 0) as total_debt_num,
        COALESCE((
          SELECT SUM(r."amount" - r."paidAmount")
          FROM "Receivable" r
          WHERE r."saleId" = ANY(ARRAY_AGG(s."id"))
            AND r."status" IN ('PENDING', 'PARTIAL')
            AND r."dueDate" < NOW()
        ), 0)::text as "overdueAmount",
        COALESCE((
          SELECT SUM(r."amount" - r."paidAmount")
          FROM "Receivable" r
          WHERE r."saleId" = ANY(ARRAY_AGG(s."id"))
            AND r."status" IN ('PENDING', 'PARTIAL')
            AND r."dueDate" < NOW()
        ), 0) as overdue_amount_num,
        COUNT(DISTINCT s."id")::text as "salesCount",
        (
          SELECT MIN(r."dueDate")
          FROM "Receivable" r
          WHERE r."saleId" = ANY(ARRAY_AGG(s."id"))
            AND r."status" IN ('PENDING', 'PARTIAL')
        ) as "oldestDueDate"
      FROM "Client" c
      INNER JOIN "Sale" s ON s."clientId" = c."id" AND s."status" = 'PENDING'
      WHERE c."deletedAt" IS NULL
      ${searchClause}
      GROUP BY c."id", c."name", c."phone", c."address", c."discount"
      HAVING SUM(s."total" - s."paidAmount") > 0
      ${orderByClause}
      LIMIT 500
    `

    // Get client IDs for detailed data fetch
    const clientIds = debtorsSummary.map((d) => d.clientId)

    // Fetch sales details only for clients in the summary (batch query)
    const salesDetails =
      clientIds.length > 0
        ? await prisma.sale.findMany({
            where: {
              clientId: { in: clientIds },
              status: 'PENDING',
            },
            select: {
              id: true,
              clientId: true,
              createdAt: true,
              total: true,
              fixedInstallmentAmount: true,
              items: {
                select: {
                  id: true,
                  quantity: true,
                  unitPrice: true,
                  total: true,
                  product: { select: { id: true, name: true, code: true } },
                },
              },
              receivables: {
                where: { status: { in: ['PENDING', 'PARTIAL'] } },
                select: {
                  id: true,
                  installment: true,
                  amount: true,
                  paidAmount: true,
                  dueDate: true,
                  status: true,
                },
                orderBy: { dueDate: 'asc' },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : []

    // Group sales by client
    const salesByClient = new Map<string, typeof salesDetails>()
    salesDetails.forEach((sale) => {
      const clientId = sale.clientId!
      if (!salesByClient.has(clientId)) {
        salesByClient.set(clientId, [])
      }
      salesByClient.get(clientId)!.push(sale)
    })

    // Build final result
    const result = debtorsSummary.map((debtor) => ({
      client: {
        id: debtor.clientId,
        name: debtor.clientName,
        phone: debtor.clientPhone,
        address: debtor.clientAddress,
        discount: debtor.clientDiscount,
      },
      sales: (salesByClient.get(debtor.clientId) || []).map((sale) => ({
        id: sale.id,
        createdAt: sale.createdAt,
        total: sale.total,
        fixedInstallmentAmount: sale.fixedInstallmentAmount,
        items: sale.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          product: item.product,
        })),
        receivables: sale.receivables,
      })),
      totalDebt: Number(debtor.totalDebt),
      overdueAmount: Number(debtor.overdueAmount),
      salesCount: Number(debtor.salesCount),
      oldestDueDate: debtor.oldestDueDate,
      isOverdue: Number(debtor.overdueAmount) > 0,
    }))

    // Cache the result (only for non-search queries)
    if (!search) {
      cache.set(cacheKey, result, CACHE_TTL.DASHBOARD)
    }

    return NextResponse.json(result)
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
