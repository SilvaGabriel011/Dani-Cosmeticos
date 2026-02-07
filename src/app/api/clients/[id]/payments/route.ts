import { type NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const client = await prisma.client.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    })

    if (!client) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Cliente não encontrado' } },
        { status: 404 }
      )
    }

    const payments = await prisma.payment.findMany({
      where: {
        sale: { clientId: id },
      },
      include: {
        sale: {
          select: {
            id: true,
            createdAt: true,
            total: true,
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    })

    return NextResponse.json(payments)
  } catch (error) {
    const { message, code, status } = handleApiError(error)
    return NextResponse.json({ error: { code, message } }, { status })
  }
}
