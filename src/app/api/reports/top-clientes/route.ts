import { startOfDay, endOfDay, parseISO } from 'date-fns'
import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface TopClientResult {
  id: string
  nome: string
  totalCompras: number
  totalPago: number
  totalEmAberto: number
  quantidadeVendas: bigint
  ticketMedio: number
  ultimaCompra: Date | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '10')

    const startDate = startDateParam
      ? startOfDay(parseISO(startDateParam))
      : startOfDay(new Date(new Date().setMonth(new Date().getMonth() - 12)))
    const endDate = endDateParam ? endOfDay(parseISO(endDateParam)) : endOfDay(new Date())

    const topClientes = await prisma.$queryRaw<TopClientResult[]>`
      SELECT 
        c.id,
        c.name as nome,
        COALESCE(SUM(s.total), 0) as "totalCompras",
        COALESCE(SUM(s."paidAmount"), 0) as "totalPago",
        COALESCE(SUM(s.total - s."paidAmount"), 0) as "totalEmAberto",
        COUNT(DISTINCT s.id) as "quantidadeVendas",
        CASE 
          WHEN COUNT(DISTINCT s.id) > 0 
          THEN COALESCE(SUM(s.total), 0) / COUNT(DISTINCT s.id)
          ELSE 0 
        END as "ticketMedio",
        MAX(s."createdAt") as "ultimaCompra"
      FROM "Client" c
      LEFT JOIN "Sale" s ON c.id = s."clientId"
        AND s."createdAt" >= ${startDate}
        AND s."createdAt" <= ${endDate}
        AND s.status != 'CANCELLED'
      GROUP BY c.id, c.name
      HAVING COALESCE(SUM(s.total), 0) > 0
      ORDER BY "totalCompras" DESC
      LIMIT ${limit}
    `

    const formatted = topClientes.map((c) => ({
      id: c.id,
      nome: c.nome,
      totalCompras: Number(c.totalCompras),
      totalPago: Number(c.totalPago),
      totalEmAberto: Number(c.totalEmAberto),
      quantidadeVendas: Number(c.quantidadeVendas),
      ticketMedio: Number(c.ticketMedio),
      ultimaCompra: c.ultimaCompra?.toISOString() || null,
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Erro ao buscar top clientes:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
