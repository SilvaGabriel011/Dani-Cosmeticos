'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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

async function deletePayment(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao excluir pagamento')
  }
  return res.json()
}

async function editPayment({ id, data }: { id: string; data: { amount?: number; method?: string; paidAt?: string } }) {
  const res = await fetch(`/api/payments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao editar pagamento')
  }
  return res.json()
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deletePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['client-payments'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['salesWithReceivables'] })
      queryClient.invalidateQueries({ queryKey: ['client-pending-sales'] })
    },
  })
}

export function useEditPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: editPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['client-payments'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['salesWithReceivables'] })
      queryClient.invalidateQueries({ queryKey: ['client-pending-sales'] })
    },
  })
}

export type { PaymentData, PaymentsResponse, PaymentFilters }
