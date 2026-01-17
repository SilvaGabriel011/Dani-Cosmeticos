import { NextRequest, NextResponse } from "next/server"
import { receivableService } from "@/services/receivable.service"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const paySaleSchema = z.object({
  saleId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["CASH", "PIX", "DEBIT", "CREDIT"]).default("CASH"),
  paidAt: z.string().datetime().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { saleId, amount, paymentMethod, paidAt } = paySaleSchema.parse(body)

    const data = await receivableService.registerPaymentWithDistribution(
      saleId,
      amount,
      paymentMethod,
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
