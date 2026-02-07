'use client'

import { useQuery } from '@tanstack/react-query'

interface DashboardData {
  sales: {
    today: { total: number; count: number }
    week: { total: number; count: number }
    month: { total: number; count: number }
  }
  products: {
    total: number
    stockValue: number
  }
  clients: {
    total: number
  }
  lowStockProducts: any[]
  recentSales: any[]
  pendingBackorders: {
    count: number
    items: any[]
  }
}

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch('/api/dashboard')
  if (!res.ok) throw new Error('Erro ao buscar dashboard')
  return res.json()
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 2 * 60 * 1000, // 2 minutos - dados do dashboard mudam com menos frequência
    refetchInterval: 5 * 60 * 1000, // Refetch a cada 5 minutos (não 30s)
    refetchOnWindowFocus: false, // Evita refetch ao trocar de aba
  })
}
