import { type NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const logs = await prisma.saleOverrideLog.findMany({
      where: { saleId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(logs)
  } catch (error) {
    const { message, code, numericCode, status } = handleApiError(error)
    return NextResponse.json({ error: { code, numericCode, message } }, { status })
  }
}
