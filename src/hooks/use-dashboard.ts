"use client"

import { useQuery } from "@tanstack/react-query"

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
}

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/dashboard")
  if (!res.ok) throw new Error("Erro ao buscar dashboard")
  return res.json()
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}
