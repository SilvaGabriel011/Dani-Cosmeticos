import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { AppError, ErrorCodes, handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { updateReceivableSchema } from '@/schemas/sale'
import { receivableService } from '@/services/receivable.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const data = await receivableService.getById(id)

    if (!data) {
      throw new AppError(ErrorCodes.RECEIVABLE_NOT_FOUND, 404)
    }

    return NextResponse.json(data)
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const validation = updateReceivableSchema.safeParse(body)

    if (!validation.success) {
      throw new AppError(ErrorCodes.VALIDATION, 400, validation.error.flatten().fieldErrors as Record<string, unknown>)
    }

    const { dueDate } = validation.data

    // Find the receivable
    const receivable = await prisma.receivable.findUnique({
      where: { id },
      include: {
        sale: true,
      },
    })

    if (!receivable) {
      throw new AppError(ErrorCodes.RECEIVABLE_NOT_FOUND, 404)
    }

    if (receivable.status === 'CANCELLED') {
      throw new AppError(ErrorCodes.RECEIVABLE_CANCELLED, 400)
    }

    if (receivable.status === 'PAID') {
      throw new AppError(ErrorCodes.RECEIVABLE_ALREADY_PAID, 400)
    }

    if (receivable.sale.status === 'CANCELLED') {
      throw new AppError(ErrorCodes.RECEIVABLE_SALE_CANCELLED, 400)
    }

    const newDueDate = new Date(dueDate)

    // Validate date is not in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (newDueDate < today) {
      throw new AppError(ErrorCodes.RECEIVABLE_INVALID_DATE, 400)
    }

    // Update the receivable
    const updatedReceivable = await prisma.receivable.update({
      where: { id },
      data: { dueDate: newDueDate },
      include: {
        sale: {
          include: {
            client: true,
          },
        },
      },
    })

    // Invalidate cache after modifying receivable
    cache.invalidatePrefix(CACHE_KEYS.RECEIVABLES_SUMMARY)

    return NextResponse.json(updatedReceivable)
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}
