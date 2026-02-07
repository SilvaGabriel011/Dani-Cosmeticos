import { type NextRequest, NextResponse } from 'next/server'

import { cache, CACHE_KEYS } from '@/lib/cache'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { updateReceivableSchema } from '@/schemas/sale'
import { receivableService } from '@/services/receivable.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const data = await receivableService.getById(id)

    if (!data) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Parcela não encontrada' } },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const validation = updateReceivableSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos',
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Parcela não encontrada' } },
        { status: 404 }
      )
    }

    if (receivable.status === 'CANCELLED') {
      return NextResponse.json(
        { error: { code: 'RECEIVABLE_CANCELLED', message: 'Não é possível alterar parcela cancelada' } },
        { status: 400 }
      )
    }

    if (receivable.status === 'PAID') {
      return NextResponse.json(
        { error: { code: 'ALREADY_PAID', message: 'Não é possível alterar parcela já paga' } },
        { status: 400 }
      )
    }

    if (receivable.sale.status === 'CANCELLED') {
      return NextResponse.json(
        {
          error: {
            code: 'SALE_CANCELLED',
            message: 'Não é possível alterar parcela de venda cancelada',
          },
        },
        { status: 400 }
      )
    }

    const newDueDate = new Date(dueDate)

    // Validate date is not in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (newDueDate < today) {
      return NextResponse.json(
        { error: { code: 'INVALID_DATE', message: 'Data de vencimento não pode ser no passado' } },
        { status: 400 }
      )
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
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
