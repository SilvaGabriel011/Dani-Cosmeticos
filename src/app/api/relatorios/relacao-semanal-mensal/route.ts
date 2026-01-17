import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ano = searchParams.get("ano") || new Date().getFullYear().toString()

    const dados = await prisma.$queryRaw`
      WITH semanas AS (
        SELECT 
          YEAR(v.data) as ano,
          MONTH(v.data) as mes,
          WEEK(v.data, 1) as semana,
          SUM(v.total) as totalVendas,
          COUNT(DISTINCT v.id) as quantidadeVendas,
          AVG(v.total) as mediaDiaria
        FROM Venda v
        WHERE YEAR(v.data) = ${ano}
        GROUP BY YEAR(v.data), MONTH(v.data), WEEK(v.data, 1)
        ORDER BY ano, mes, semana
      ),
      semanas_com_variacao AS (
        SELECT 
          ano,
          mes,
          semana,
          totalVendas,
          mediaDiaria,
          LAG(totalVendas) OVER (ORDER BY ano, mes, semana) as semanaAnterior,
          CASE 
            WHEN LAG(totalVendas) OVER (ORDER BY ano, mes, semana) IS NULL THEN 0
            ELSE ((totalVendas - LAG(totalVendas) OVER (ORDER BY ano, mes, semana)) / 
                  LAG(totalVendas) OVER (ORDER BY ano, mes, semana)) * 100
          END as variacao
        FROM semanas
      )
      SELECT 
        CASE mes 
          WHEN 1 THEN 'Janeiro'
          WHEN 2 THEN 'Fevereiro'
          WHEN 3 THEN 'Março'
          WHEN 4 THEN 'Abril'
          WHEN 5 THEN 'Maio'
          WHEN 6 THEN 'Junho'
          WHEN 7 THEN 'Julho'
          WHEN 8 THEN 'Agosto'
          WHEN 9 THEN 'Setembro'
          WHEN 10 THEN 'Outubro'
          WHEN 11 THEN 'Novembro'
          WHEN 12 THEN 'Dezembro'
        END as mes,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'semana', semana,
            'totalVendas', totalVendas,
            'mediaDiaria', mediaDiaria,
            'variacao', COALESCE(variacao, 0)
          )
        ) as semanas,
        SUM(totalVendas) as total
      FROM semanas_com_variacao
      GROUP BY ano, mes
      ORDER BY mes
    `

    // Formatar os dados para o formato esperado
    const dadosFormatados = (dados as any[]).map(item => ({
      mes: item.mes,
      semanas: item.semanas,
      total: item.total
    }))

    return NextResponse.json(dadosFormatados)
  } catch (error) {
    console.error("Erro ao buscar dados semanais:", error)
    return NextResponse.json(
      { error: "Erro ao buscar dados" },
      { status: 500 }
    )
  }
}
