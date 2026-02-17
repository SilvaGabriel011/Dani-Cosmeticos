'use client'

import { useQuery } from '@tanstack/react-query'

export interface ClientPayment {
  id: string
  saleId: string
  method: 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT'
  amount: string | number
  paidAt: string
  sale: {
    id: string
    createdAt: string
    total: string | number
  }
}

export function useClientPaymentHistory(clientId: string, enabled = false) {
  return useQuery<ClientPayment[]>({
    queryKey: ['client-payments', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/payments`)
      if (!res.ok) throw new Error('Erro ao buscar histórico de pagamentos')
      return res.json()
    },
    enabled: !!clientId && enabled,
    staleTime: 2 * 60 * 1000,
  })
}

interface PaymentFilters {
  clientId?: string
  method?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

interface PaymentData {
  id: string
  saleId: string
  method: string
  amount: string | number
  feePercent: string | number
  feeAmount: string | number
  feeAbsorber: string
  installments: number
  paidAt: string
  sale: {
    id: string
    total: string | number
    status: string
    installmentPlan: number
    createdAt: string
    client: {
      id: string
      name: string
      phone: string | null
    } | null
    items: Array<{
      id: string
      quantity: number
      unitPrice: string | number
      total: string | number
      product: { id: string; name: string }
    }>
    receivables: Array<{
      id: string
      installment: number
      amount: string | number
      paidAmount: string | number
      status: string
      dueDate: string
    }>
  }
}

interface PaymentsResponse {
  data: PaymentData[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function usePayments(filters: PaymentFilters = {}) {
  const params = new URLSearchParams()
  if (filters.clientId) params.set('clientId', filters.clientId)
  if (filters.method) params.set('method', filters.method)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))

  return useQuery<PaymentsResponse>({
    queryKey: ['payments', filters],
    queryFn: async () => {
      const res = await fetch(`/api/payments?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar pagamentos')
      return res.json()
    },
    staleTime: 30 * 1000, // 30s
  })
}

export type { PaymentData, PaymentsResponse, PaymentFilters }
