import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const maioresVendas = await prisma.$queryRaw`
      SELECT 
        v.id,
        v.idVenda,
        c.nome as nomeCliente,
        COUNT(DISTINCT iv.idProduto) as produtos,
        v.total,
        v.data,
        u.nome as vendedor
      FROM Venda v
      JOIN Cliente c ON v.idCliente = c.id
      JOIN ItemVenda iv ON v.id = iv.idVenda
      LEFT JOIN Usuario u ON v.idUsuario = u.id
      WHERE v.data >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY v.id, v.idVenda, c.nome, v.total, v.data, u.nome
      ORDER BY v.total DESC
      LIMIT 20
    `

    return NextResponse.json(maioresVendas)
  } catch (error) {
    console.error("Erro ao buscar maiores vendas:", error)
    return NextResponse.json(
      { error: "Erro ao buscar dados" },
      { status: 500 }
    )
  }
}
