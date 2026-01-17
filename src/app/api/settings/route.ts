import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { updateSettingsSchema } from "@/schemas/settings"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: "default" },
    })

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: "default",
          debitFeePercent: 1.5,
          creditFeePercent: 3.0,
          creditInstallmentFee: 4.0,
          defaultFeeAbsorber: "SELLER",
          lowStockAlertEnabled: true,
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao buscar configurações" } },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = updateSettingsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dados inválidos",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: validation.data,
      create: {
        id: "default",
        ...validation.data,
      },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Erro ao atualizar configurações" } },
      { status: 500 }
    )
  }
}
