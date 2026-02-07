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
