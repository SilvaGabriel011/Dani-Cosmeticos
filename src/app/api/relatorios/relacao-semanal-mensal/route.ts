import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ano = searchParams.get("ano") || new Date().getFullYear().toString()

    const dados = await prisma.$queryRaw`
      WITH semanas AS (
        SELECT 
          EXTRACT(YEAR FROM s."createdAt") as ano,
          EXTRACT(MONTH FROM s."createdAt") as mes,
          EXTRACT(WEEK FROM s."createdAt") as semana,
          SUM(s.total) as "totalVendas",
          COUNT(DISTINCT s.id) as "quantidadeVendas",
          AVG(s.total) as "mediaDiaria"
        FROM "Sale" s
        WHERE EXTRACT(YEAR FROM s."createdAt") = ${parseInt(ano)}
        AND s.status = 'COMPLETED'
        GROUP BY EXTRACT(YEAR FROM s."createdAt"), EXTRACT(MONTH FROM s."createdAt"), EXTRACT(WEEK FROM s."createdAt")
        ORDER BY ano, mes, semana
      ),
      semanas_com_variacao AS (
        SELECT 
          ano,
          mes,
          semana,
          "totalVendas",
          "mediaDiaria",
          LAG("totalVendas") OVER (ORDER BY ano, mes, semana) as "semanaAnterior",
          CASE 
            WHEN LAG("totalVendas") OVER (ORDER BY ano, mes, semana) IS NULL THEN 0
            ELSE (("totalVendas" - LAG("totalVendas") OVER (ORDER BY ano, mes, semana)) / 
                  LAG("totalVendas") OVER (ORDER BY ano, mes, semana)) * 100
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
        COALESCE(SUM("totalVendas"), 0) as total
      FROM semanas_com_variacao
      GROUP BY ano, mes
      ORDER BY mes
    `

    // Formatar os dados para o formato esperado
    const dadosFormatados = (dados as any[]).map(item => ({
      mes: item.mes,
      total: Number(item.total),
      semanas: [] // Simplificado por enquanto
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
