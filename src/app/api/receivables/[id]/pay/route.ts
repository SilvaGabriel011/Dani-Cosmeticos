import { NextRequest, NextResponse } from "next/server"
import { receivableService } from "@/services/receivable.service"
import { payReceivableSchema } from "@/schemas/receivable"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { amount, paidAt } = payReceivableSchema.parse(body)

    const data = await receivableService.registerPayment(
      params.id,
      amount,
      paidAt ? new Date(paidAt) : undefined
    )

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error registering payment:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao registrar pagamento" },
      { status: 400 }
    )
  }
}
