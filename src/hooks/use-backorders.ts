'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface BackorderItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  total: number
  addedAt: string
  product: {
    id: string
    name: string
    code: string | null
    stock: number
    salePrice: number
    brand: { name: string } | null
    category: { name: string } | null
  }
  sale: {
    id: string
    createdAt: string
    client: { id: string; name: string } | null
  }
}

export interface BackordersByProduct {
  productId: string
  productName: string
  productCode: string | null
  brandName: string | null
  categoryName: string | null
  currentStock: number
  totalPending: number
  items: BackorderItem[]
}

export interface BackordersData {
  totalPendingItems: number
  totalPendingQuantity: number
  byProduct: BackordersByProduct[]
}

async function fetchBackorders(): Promise<BackordersData> {
  const res = await fetch('/api/backorders')
  if (!res.ok) throw new Error('Erro ao buscar encomendas')
  return res.json()
}

async function fulfillBackorder(id: string): Promise<unknown> {
  const res = await fetch(`/api/backorders/${id}/fulfill`, { method: 'POST' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao cumprir encomenda')
  }
  return res.json()
}

export function useBackorders() {
  return useQuery({
    queryKey: ['backorders'],
    queryFn: fetchBackorders,
    staleTime: 30 * 1000, // 30s
  })
}

export function useFulfillBackorder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fulfillBackorder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backorders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
