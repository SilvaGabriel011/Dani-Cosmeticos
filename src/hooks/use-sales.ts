"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Sale, PaginatedResult } from "@/types"
import { CreateSaleInput } from "@/schemas/sale"

interface SaleFilters {
  page?: number
  limit?: number
  status?: "COMPLETED" | "CANCELLED" | ""
  clientId?: string
  startDate?: string
  endDate?: string
  categoryId?: string
  productId?: string
  paymentMethod?: string
}

async function fetchSales(filters: SaleFilters): Promise<PaginatedResult<Sale>> {
  const params = new URLSearchParams()
  if (filters.page) params.set("page", filters.page.toString())
  if (filters.limit) params.set("limit", filters.limit.toString())
  if (filters.status) params.set("status", filters.status)
  if (filters.clientId) params.set("clientId", filters.clientId)
  if (filters.startDate) params.set("startDate", filters.startDate)
  if (filters.endDate) params.set("endDate", filters.endDate)
  if (filters.categoryId) params.set("categoryId", filters.categoryId)
  if (filters.productId) params.set("productId", filters.productId)
  if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod)

  const res = await fetch(`/api/sales?${params}`)
  if (!res.ok) throw new Error("Erro ao buscar vendas")
  return res.json()
}

async function fetchSale(id: string): Promise<Sale> {
  const res = await fetch(`/api/sales/${id}`)
  if (!res.ok) throw new Error("Erro ao buscar venda")
  return res.json()
}

async function createSale(data: CreateSaleInput): Promise<Sale> {
  const res = await fetch("/api/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Erro ao criar venda")
  }
  return res.json()
}

async function cancelSale(id: string): Promise<Sale> {
  const res = await fetch(`/api/sales/${id}/cancel`, { method: "POST" })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Erro ao cancelar venda")
  }
  return res.json()
}

export function useSales(filters: SaleFilters = {}) {
  return useQuery({
    queryKey: ["sales", filters],
    queryFn: () => fetchSales(filters),
  })
}

export function useSale(id: string) {
  return useQuery({
    queryKey: ["sale", id],
    queryFn: () => fetchSale(id),
    enabled: !!id,
  })
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useCancelSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelSale,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.setQueryData(["sale", data.id], data)
    },
  })
}
