import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const topClientes = await prisma.$queryRaw`
      SELECT 
        c.id,
        c.name as nome,
        COALESCE(SUM(s.total), 0) as "totalCompras",
        COUNT(DISTINCT s.id) as "quantidadeVendas",
        CASE 
          WHEN COUNT(DISTINCT s.id) > 0 
          THEN COALESCE(SUM(s.total), 0) / COUNT(DISTINCT s.id)
          ELSE 0 
        END as "ticketMedio",
        MAX(s."createdAt") as "ultimaCompra"
      FROM "Client" c
      LEFT JOIN "Sale" s ON c.id = s."clientId"
      WHERE s."createdAt" >= CURRENT_DATE - INTERVAL '12 months'
      AND s.status = 'COMPLETED'
      GROUP BY c.id, c.name
      HAVING "totalCompras" > 0
      ORDER BY "totalCompras" DESC
      LIMIT 10
    `

    return NextResponse.json(topClientes)
  } catch (error) {
    console.error("Erro ao buscar top clientes:", error)
    return NextResponse.json(
      { error: "Erro ao buscar dados" },
      { status: 500 }
    )
  }
}
