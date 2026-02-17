'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { type CreateProductInput, type UpdateProductInput } from '@/schemas/product'
import { type Product, type PaginatedResult } from '@/types'

interface ProductFilters {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
  brandId?: string
  priceStatus?: 'no-price'
  stockStatus?: 'zeroed'
}

async function fetchProducts(filters: ProductFilters): Promise<PaginatedResult<Product>> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', filters.page.toString())
  if (filters.limit) params.set('limit', filters.limit.toString())
  if (filters.search) params.set('search', filters.search)
  if (filters.categoryId) params.set('categoryId', filters.categoryId)
  if (filters.brandId) params.set('brandId', filters.brandId)
  if (filters.priceStatus) params.set('priceStatus', filters.priceStatus)
  if (filters.stockStatus) params.set('stockStatus', filters.stockStatus)

  const res = await fetch(`/api/products?${params}`)
  if (!res.ok) throw new Error('Erro ao buscar produtos')
  return res.json()
}

async function fetchProduct(id: string): Promise<Product> {
  const res = await fetch(`/api/products/${id}`)
  if (!res.ok) throw new Error('Erro ao buscar produto')
  return res.json()
}

async function createProduct(data: CreateProductInput): Promise<Product> {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao criar produto')
  }
  return res.json()
}

async function updateProduct({
  id,
  data,
}: {
  id: string
  data: UpdateProductInput
}): Promise<Product> {
  const res = await fetch(`/api/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao atualizar produto')
  }
  return res.json()
}

async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Erro ao excluir produto')
}

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => fetchProducts(filters),
    staleTime: 30 * 1000, // 30s
  })
}

export function useProductsOnDemand(search: string, enabled = true) {
  return useQuery({
    queryKey: ['products', 'on-demand', search],
    queryFn: () => fetchProducts({ search, limit: 50 }),
    staleTime: 15 * 1000, // 15s
    enabled: enabled && search.length >= 2,
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      // Invalida apenas produtos - dashboard será atualizado no próximo ciclo
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProduct,
    onSuccess: (data) => {
      queryClient.setQueryData(['product', data.id], data)
      queryClient.invalidateQueries({ queryKey: ['products'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['backorders'] })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['backorders'] })
    },
  })
}

interface ProductStats {
  lowStockCount: number
  totalProducts: number
}

async function fetchProductStats(): Promise<ProductStats> {
  const res = await fetch('/api/products/stats')
  if (!res.ok) throw new Error('Erro ao buscar estatísticas de produtos')
  return res.json()
}

export function useProductStats() {
  return useQuery({
    queryKey: ['products', 'stats'],
    queryFn: fetchProductStats,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
