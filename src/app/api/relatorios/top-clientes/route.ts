import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const topClientes = await prisma.$queryRaw`
      SELECT 
        c.id,
        c.nome,
        COALESCE(SUM(v.total), 0) as totalCompras,
        COUNT(DISTINCT v.id) as quantidadeVendas,
        CASE 
          WHEN COUNT(DISTINCT v.id) > 0 
          THEN COALESCE(SUM(v.total), 0) / COUNT(DISTINCT v.id)
          ELSE 0 
        END as ticketMedio,
        MAX(v.data) as ultimaCompra
      FROM Cliente c
      LEFT JOIN Venda v ON c.id = v.idCliente
      WHERE v.data >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
      GROUP BY c.id, c.nome
      HAVING totalCompras > 0
      ORDER BY totalCompras DESC
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
