import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7)

    const dados = await prisma.$queryRaw`
      WITH vendas_diarias AS (
        SELECT 
          DATE(s."createdAt") as data,
          EXTRACT(DOW FROM s."createdAt") + 1 as "diaSemanaNum",
          SUM(s.total) as total,
          COUNT(DISTINCT s.id) as vendas,
          AVG(s.total) as "ticketMedio"
        FROM "Sale" s
        WHERE TO_CHAR(s."createdAt", 'YYYY-MM') = ${mes}
        AND s.status = 'COMPLETED'
        GROUP BY DATE(s."createdAt"), EXTRACT(DOW FROM s."createdAt")
      ),
      vendas_com_variacao AS (
        SELECT 
          data,
          "diaSemanaNum",
          total,
          vendas,
          "ticketMedio",
          LAG(total) OVER (ORDER BY data) as "diaAnterior",
          CASE 
            WHEN LAG(total) OVER (ORDER BY data) IS NULL THEN 0
            ELSE ((total - LAG(total) OVER (ORDER BY data)) / 
                  LAG(total) OVER (ORDER BY data)) * 100
          END as variacao
        FROM vendas_diarias
      )
      SELECT 
        vd.data,
        CASE vd."diaSemanaNum"
          WHEN 1 THEN 'Domingo'
          WHEN 2 THEN 'Segunda'
          WHEN 3 THEN 'Terça'
          WHEN 4 THEN 'Quarta'
          WHEN 5 THEN 'Quinta'
          WHEN 6 THEN 'Sexta'
          WHEN 7 THEN 'Sábado'
        END as "diaSemana",
        COALESCE(vd.total, 0) as total,
        COALESCE(vd.vendas, 0) as vendas,
        COALESCE(vd."ticketMedio", 0) as "ticketMedio",
        COALESCE(vd.variacao, 0) as variacao,
        '14:00' as "horaPico"
      FROM vendas_com_variacao vd
      ORDER BY vd.data
    `

    // Converter valores para número
    const dadosFormatados = (dados as any[]).map((item) => ({
      data: item.data,
      diaSemana: item.diaSemana,
      total: Number(item.total),
      vendas: Number(item.vendas),
      ticketMedio: Number(item.ticketMedio),
      variacao: Number(item.variacao),
      horaPico: item.horaPico,
    }))

    return NextResponse.json(dadosFormatados)
  } catch (error) {
    console.error('Erro ao buscar vendas por dia:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
