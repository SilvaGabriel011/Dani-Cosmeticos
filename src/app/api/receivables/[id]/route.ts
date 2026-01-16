import { NextRequest, NextResponse } from "next/server"
import { receivableService } from "@/services/receivable.service"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await receivableService.getById(params.id)
    
    if (!data) {
      return NextResponse.json(
        { error: "Parcela não encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error fetching receivable:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar parcela" },
      { status: 400 }
    )
  }
}
