import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ano = searchParams.get("ano") || new Date().getFullYear().toString()

    // Dados simulados de metas mensais (em um sistema real, isso viria de uma tabela de metas)
    const metasMensais = {
      1: 50000,  // Janeiro
      2: 45000,  // Fevereiro
      3: 55000,  // Março
      4: 50000,  // Abril
      5: 52000,  // Maio
      6: 58000,  // Junho
      7: 60000,  // Julho
      8: 62000,  // Agosto
      9: 59000,  // Setembro
      10: 61000, // Outubro
      11: 65000, // Novembro
      12: 70000, // Dezembro
    }

    const dados = await prisma.$queryRaw`
      WITH vendas_mensais AS (
        SELECT 
          MONTH(v.data) as mes,
          SUM(v.total) as total,
          COUNT(DISTINCT v.id) as vendas,
          AVG(v.total) as ticketMedio
        FROM Venda v
        WHERE YEAR(v.data) = ${ano}
        GROUP BY MONTH(v.data)
      ),
      vendas_com_variacao AS (
        SELECT 
          mes,
          total,
          vendas,
          ticketMedio,
          LAG(total) OVER (ORDER BY mes) as mesAnterior,
          CASE 
            WHEN LAG(total) OVER (ORDER BY mes) IS NULL THEN 0
            ELSE ((total - LAG(total) OVER (ORDER BY mes)) / 
                  LAG(total) OVER (ORDER BY mes)) * 100
          END as variacao
        FROM vendas_mensais
      )
      SELECT 
        mes,
        total,
        vendas,
        ticketMedio,
        COALESCE(variacao, 0) as variacao
      FROM vendas_com_variacao
      ORDER BY mes
    `

    // Adicionar informações de metas e atingimento
    const dadosComMetas = (dados as any[]).map(item => {
      const meta = metasMensais[item.mes as keyof typeof metasMensais] || 50000
      return {
        mes: [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ][item.mes - 1],
        total: item.total,
        vendas: item.vendas,
        ticketMedio: item.ticketMedio,
        meta: meta,
        atingimentoMeta: item.total / meta,
        variacao: item.variacao
      }
    })

    return NextResponse.json(dadosComMetas)
  } catch (error) {
    console.error("Erro ao buscar desempenho mensal:", error)
    return NextResponse.json(
      { error: "Erro ao buscar dados" },
      { status: 500 }
    )
  }
}
