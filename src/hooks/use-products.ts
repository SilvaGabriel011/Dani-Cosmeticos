"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Product, PaginatedResult } from "@/types"
import { CreateProductInput, UpdateProductInput } from "@/schemas/product"

interface ProductFilters {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
  brandId?: string
}

async function fetchProducts(filters: ProductFilters): Promise<PaginatedResult<Product>> {
  const params = new URLSearchParams()
  if (filters.page) params.set("page", filters.page.toString())
  if (filters.limit) params.set("limit", filters.limit.toString())
  if (filters.search) params.set("search", filters.search)
  if (filters.categoryId) params.set("categoryId", filters.categoryId)
  if (filters.brandId) params.set("brandId", filters.brandId)

  const res = await fetch(`/api/products?${params}`)
  if (!res.ok) throw new Error("Erro ao buscar produtos")
  return res.json()
}

async function fetchProduct(id: string): Promise<Product> {
  const res = await fetch(`/api/products/${id}`)
  if (!res.ok) throw new Error("Erro ao buscar produto")
  return res.json()
}

async function createProduct(data: CreateProductInput): Promise<Product> {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Erro ao criar produto")
  }
  return res.json()
}

async function updateProduct({ id, data }: { id: string; data: UpdateProductInput }): Promise<Product> {
  const res = await fetch(`/api/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Erro ao atualizar produto")
  }
  return res.json()
}

async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Erro ao excluir produto")
}

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: () => fetchProducts(filters),
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(id),
    enabled: !!id,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProduct,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.setQueryData(["product", data.id], data)
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}
