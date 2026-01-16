"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Category } from "@/types"

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories")
  if (!res.ok) throw new Error("Erro ao buscar categorias")
  return res.json()
}

async function createCategory(name: string): Promise<Category> {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Erro ao criar categoria")
  }
  return res.json()
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
    },
  })
}
