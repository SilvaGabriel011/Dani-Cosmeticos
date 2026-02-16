import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface ReceivableFilters {
  clientId?: string
  saleId?: string
  status?: string
  startDate?: string
  endDate?: string
  limit?: number
}

export function useReceivables(filters: ReceivableFilters = {}) {
  const params = new URLSearchParams()
  if (filters.clientId) params.set('clientId', filters.clientId)
  if (filters.saleId) params.set('saleId', filters.saleId)
  if (filters.status) params.set('status', filters.status)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.limit) params.set('limit', String(filters.limit))

  return useQuery({
    queryKey: ['receivables', filters],
    queryFn: async () => {
      const res = await fetch(`/api/receivables?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar contas a receber')
      return res.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: false,
  })
}

export function useReceivablesByClient(
  clientId: string,
  filters?: { startDate?: string; endDate?: string }
) {
  const params = new URLSearchParams()
  params.set('clientId', clientId)
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)

  return useQuery({
    queryKey: ['receivables', 'client', clientId, filters],
    queryFn: async () => {
      const res = await fetch(`/api/receivables?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar contas do cliente')
      return res.json()
    },
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}

export function useReceivablesDue(filters?: { startDate?: string; endDate?: string }) {
  const params = new URLSearchParams()
  params.set('pending', 'true')
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)

  return useQuery({
    queryKey: ['receivables', 'due', filters],
    queryFn: async () => {
      const res = await fetch(`/api/receivables?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar contas a receber')
      return res.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: false,
  })
}

export function useReceivablesDashboard(filters?: { startDate?: string; endDate?: string }) {
  const params = new URLSearchParams()
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)

  return useQuery({
    queryKey: ['receivables', 'dashboard', filters],
    queryFn: async () => {
      const res = await fetch(`/api/receivables/summary?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar resumo')
      return res.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: false,
  })
}

export function usePayReceivable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      amount,
      paymentMethod,
      paidAt,
    }: {
      id: string
      amount: number
      paymentMethod?: 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT'
      paidAt?: string
    }) => {
      const res = await fetch(`/api/receivables/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, paymentMethod, paidAt }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao registrar pagamento')
      }
      return res.json()
    },
    onSuccess: () => {
      // Invalida apenas receivables e sales - outros serão atualizados no ciclo
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['salesWithReceivables'] })
    },
  })
}

export function usePaySaleReceivables() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      saleId,
      amount,
      paymentMethod,
      paidAt,
      feePercent,
      feeAbsorber,
      installments,
    }: {
      saleId: string
      amount: number
      paymentMethod?: 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT'
      paidAt?: string
      feePercent?: number
      feeAbsorber?: 'SELLER' | 'CLIENT'
      installments?: number
    }) => {
      const res = await fetch(`/api/receivables/pay-sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId, amount, paymentMethod, paidAt, feePercent, feeAbsorber, installments }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao registrar pagamento')
      }
      return res.json()
    },
    onSuccess: () => {
      // Invalida apenas o necessário
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['salesWithReceivables'] })
    },
  })
}

interface SalesWithReceivablesResult {
  data: unknown[]
  total: number
}

export function useSalesWithPendingReceivables(limit?: number) {
  const params = new URLSearchParams()
  params.set('groupBySale', 'true')
  if (limit) params.set('limit', String(limit))

  return useQuery<SalesWithReceivablesResult>({
    queryKey: ['salesWithReceivables', limit],
    queryFn: async () => {
      const res = await fetch(`/api/receivables?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar vendas fiado')
      return res.json()
    },
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: true,
  })
}
