import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

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
  if (filters.clientId) params.set("clientId", filters.clientId)
  if (filters.saleId) params.set("saleId", filters.saleId)
  if (filters.status) params.set("status", filters.status)
  if (filters.startDate) params.set("startDate", filters.startDate)
  if (filters.endDate) params.set("endDate", filters.endDate)
  if (filters.limit) params.set("limit", String(filters.limit))

  return useQuery({
    queryKey: ["receivables", filters],
    queryFn: async () => {
      const res = await fetch(`/api/receivables?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar contas a receber")
      return res.json()
    },
  })
}

export function useReceivablesByClient(clientId: string, filters?: { startDate?: string; endDate?: string }) {
  const params = new URLSearchParams()
  params.set("clientId", clientId)
  if (filters?.startDate) params.set("startDate", filters.startDate)
  if (filters?.endDate) params.set("endDate", filters.endDate)

  return useQuery({
    queryKey: ["receivables", "client", clientId, filters],
    queryFn: async () => {
      const res = await fetch(`/api/receivables?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar contas do cliente")
      return res.json()
    },
    enabled: !!clientId,
  })
}

export function useReceivablesDue(filters?: { startDate?: string; endDate?: string }) {
  const params = new URLSearchParams()
  params.set("pending", "true")
  if (filters?.startDate) params.set("startDate", filters.startDate)
  if (filters?.endDate) params.set("endDate", filters.endDate)

  return useQuery({
    queryKey: ["receivables", "due", filters],
    queryFn: async () => {
      const res = await fetch(`/api/receivables?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar contas a receber")
      return res.json()
    },
  })
}

export function useReceivablesDashboard(filters?: { startDate?: string; endDate?: string }) {
  const params = new URLSearchParams()
  if (filters?.startDate) params.set("startDate", filters.startDate)
  if (filters?.endDate) params.set("endDate", filters.endDate)

  return useQuery({
    queryKey: ["receivables", "dashboard", filters],
    queryFn: async () => {
      const res = await fetch(`/api/receivables/summary?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar resumo")
      return res.json()
    },
  })
}

export function usePayReceivable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, amount, paidAt }: { id: string; amount: number; paidAt?: string }) => {
      const res = await fetch(`/api/receivables/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, paidAt }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Erro ao registrar pagamento")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivables"] })
      queryClient.invalidateQueries({ queryKey: ["sales"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
