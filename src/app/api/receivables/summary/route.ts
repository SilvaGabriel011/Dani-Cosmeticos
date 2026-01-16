import { NextRequest, NextResponse } from "next/server"
import { receivableService } from "@/services/receivable.service"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const data = await receivableService.getDashboardSummary(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    )

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error fetching receivables summary:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar resumo" },
      { status: 400 }
    )
  }
}
