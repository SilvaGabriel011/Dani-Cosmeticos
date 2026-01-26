'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { type Brand } from '@/types'

async function fetchBrands(): Promise<Brand[]> {
  const res = await fetch('/api/brands')
  if (!res.ok) throw new Error('Erro ao buscar marcas')
  return res.json()
}

async function createBrand(name: string): Promise<Brand> {
  const res = await fetch('/api/brands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao criar marca')
  }
  return res.json()
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
    staleTime: 5 * 60 * 1000, // 5 minutos - marcas raramente mudam
    gcTime: 10 * 60 * 1000, // 10 minutos no cache
  })
}

export function useCreateBrand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
    },
  })
}
