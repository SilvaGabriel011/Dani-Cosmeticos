import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get("mes") || new Date().toISOString().slice(0, 7)

    const dados = await prisma.$queryRaw`
      WITH vendas_diarias AS (
        SELECT 
          DATE(v.data) as data,
          DAYOFWEEK(v.data) as diaSemanaNum,
          SUM(v.total) as total,
          COUNT(DISTINCT v.id) as vendas,
          AVG(v.total) as ticketMedio,
          CASE 
            WHEN COUNT(DISTINCT v.id) > 0 
            THEN SUM(v.total) / COUNT(DISTINCT v.id)
            ELSE 0 
          END as ticketMedio
        FROM Venda v
        WHERE DATE_FORMAT(v.data, '%Y-%m') = ${mes}
        GROUP BY DATE(v.data), DAYOFWEEK(v.data)
      ),
      vendas_com_variacao AS (
        SELECT 
          data,
          diaSemanaNum,
          total,
          vendas,
          ticketMedio,
          LAG(total) OVER (ORDER BY data) as diaAnterior,
          CASE 
            WHEN LAG(total) OVER (ORDER BY data) IS NULL THEN 0
            ELSE ((total - LAG(total) OVER (ORDER BY data)) / 
                  LAG(total) OVER (ORDER BY data)) * 100
          END as variacao
        FROM vendas_diarias
      ),
      horas_pico AS (
        SELECT 
          DATE(v.data) as data,
          HOUR(v.data) as hora,
          COUNT(*) as quantidade
        FROM Venda v
        WHERE DATE_FORMAT(v.data, '%Y-%m') = ${mes}
        GROUP BY DATE(v.data), HOUR(v.data)
        ORDER BY quantidade DESC
      )
      SELECT 
        vd.data,
        CASE vd.diaSemanaNum
          WHEN 1 THEN 'Domingo'
          WHEN 2 THEN 'Segunda'
          WHEN 3 THEN 'Terça'
          WHEN 4 THEN 'Quarta'
          WHEN 5 THEN 'Quinta'
          WHEN 6 THEN 'Sexta'
          WHEN 7 THEN 'Sábado'
        END as diaSemana,
        COALESCE(vd.total, 0) as total,
        COALESCE(vd.vendas, 0) as vendas,
        COALESCE(vd.ticketMedio, 0) as ticketMedio,
        COALESCE(vd.variacao, 0) as variacao,
        (
          SELECT CONCAT(hp.hora, ':00')
          FROM horas_pico hp
          WHERE hp.data = vd.data
          ORDER BY hp.quantidade DESC
          LIMIT 1
        ) as horaPico
      FROM vendas_com_variacao vd
      ORDER BY vd.data
    `

    return NextResponse.json(dados)
  } catch (error) {
    console.error("Erro ao buscar vendas por dia:", error)
    return NextResponse.json(
      { error: "Erro ao buscar dados" },
      { status: 500 }
    )
  }
}
