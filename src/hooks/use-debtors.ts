'use client'

import { useQuery } from '@tanstack/react-query'

interface DebtorFilters {
  search?: string
  sortBy?: 'totalDebt' | 'overdueAmount' | 'oldestDueDate' | 'name'
}

interface DebtorProduct {
  id: string
  name: string
  code: string | null
}

interface DebtorSaleItem {
  id: string
  quantity: number
  unitPrice: string | number
  total: string | number
  product: DebtorProduct
}

interface DebtorReceivable {
  id: string
  installment: number
  amount: string | number
  paidAmount: string | number
  dueDate: string
  status: 'PENDING' | 'PARTIAL' | 'PAID'
}

interface DebtorSale {
  id: string
  createdAt: string
  total: string | number
  fixedInstallmentAmount?: string | number | null
  items: DebtorSaleItem[]
  receivables: DebtorReceivable[]
}

interface DebtorClient {
  id: string
  name: string
  phone: string
  address: string
  discount: string | number
}

export interface Debtor {
  client: DebtorClient
  sales: DebtorSale[]
  totalDebt: number
  overdueAmount: number
  salesCount: number
  oldestDueDate: string | null
  isOverdue: boolean
}

async function fetchDebtors(filters: DebtorFilters): Promise<Debtor[]> {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.sortBy) params.set('sortBy', filters.sortBy)

  const res = await fetch(`/api/clients/debtors?${params}`)
  if (!res.ok) throw new Error('Erro ao buscar devedores')
  return res.json()
}

export function useDebtors(filters: DebtorFilters = {}) {
  return useQuery({
    queryKey: ['debtors', filters],
    queryFn: () => fetchDebtors(filters),
    staleTime: 3 * 60 * 1000, // 3 minutos - dados de devedores não mudam frequentemente
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Mantém dados anteriores durante busca
  })
}
