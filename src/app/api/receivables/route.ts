import { NextRequest, NextResponse } from "next/server"
import { receivableService } from "@/services/receivable.service"
import { listReceivablesSchema } from "@/schemas/receivable"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const filters = listReceivablesSchema.parse({
      clientId: searchParams.get("clientId") || undefined,
      saleId: searchParams.get("saleId") || undefined,
      status: searchParams.get("status") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      limit: searchParams.get("limit") || 50,
    })

    const pending = searchParams.get("pending") === "true"

    let data
    if (pending) {
      data = await receivableService.listPending({
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        limit: filters.limit,
      })
    } else {
      data = await receivableService.list({
        ...filters,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error fetching receivables:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar contas a receber" },
      { status: 400 }
    )
  }
}
