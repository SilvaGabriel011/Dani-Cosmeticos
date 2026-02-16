import { type PaymentMethod } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const clientId = searchParams.get('clientId') || undefined
    const method = searchParams.get('method') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))

    const where: Record<string, unknown> = {}

    if (clientId) {
      where.sale = { clientId }
    }

    if (method) {
      where.method = method as PaymentMethod
    }

    if (startDate || endDate) {
      where.paidAt = {
        ...(startDate && { gte: new Date(startDate + 'T00:00:00.000Z') }),
        ...(endDate && { lte: new Date(endDate + 'T23:59:59.999Z') }),
      }
    }

    const [payments, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        include: {
          sale: {
            include: {
              client: {
                select: { id: true, name: true, phone: true },
              },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ])

    return NextResponse.json({
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
