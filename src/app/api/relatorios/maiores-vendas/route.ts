import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const maioresVendas = await prisma.$queryRaw`
      SELECT 
        s.id,
        s.id as "idVenda",
        c.name as "nomeCliente",
        COUNT(DISTINCT si."productId") as produtos,
        s.total,
        s."createdAt" as data
      FROM "Sale" s
      JOIN "Client" c ON s."clientId" = c.id
      JOIN "SaleItem" si ON s.id = si."saleId"
      WHERE s."createdAt" >= CURRENT_DATE - INTERVAL '30 days'
      AND s.status = 'COMPLETED'
      GROUP BY s.id, c.name, s.total, s."createdAt"
      ORDER BY s.total DESC
      LIMIT 20
    `

    return NextResponse.json(maioresVendas)
  } catch (error) {
    console.error('Erro ao buscar maiores vendas:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
