import { type NextRequest, NextResponse } from 'next/server'

import { listReceivablesSchema } from '@/schemas/receivable'
import { receivableService } from '@/services/receivable.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // New parameter to get sales with all their receivables (for fiado table)
    const groupBySale = searchParams.get('groupBySale') === 'true'

    if (groupBySale) {
      const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100
      const data = await receivableService.listSalesWithPendingReceivables(limit)
      return NextResponse.json(data)
    }

    const rawStatus = searchParams.get('status') || undefined

    const filters = listReceivablesSchema.parse({
      clientId: searchParams.get('clientId') || undefined,
      saleId: searchParams.get('saleId') || undefined,
      status: rawStatus,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: searchParams.get('limit') || 50,
    })

    const pending = searchParams.get('pending') === 'true'

    let data
    if (pending) {
      data = await receivableService.listPending({
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        limit: filters.limit,
      })
    } else {
      // Handle status as array or single value
      const statusFilter = filters.status
      data = await receivableService.list({
        clientId: filters.clientId,
        saleId: filters.saleId,
        status: statusFilter as any,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        limit: filters.limit,
      })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching receivables:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar contas a receber' },
      { status: 400 }
    )
  }
}
