import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type ClientImportRow, type ProductImportRow } from '@/schemas/import'

interface ClientImportResult {
  created: number
  errors: Array<{ row: number; message: string }>
}

interface ProductImportResult {
  created: number
  errors: Array<{ row: number; message: string }>
  brandsCreated: string[]
  categoriesCreated: string[]
}

async function importClients(clients: ClientImportRow[]): Promise<ClientImportResult> {
  const response = await fetch('/api/import/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clients }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Erro ao importar clientes')
  }

  return response.json()
}

async function importProducts(
  products: ProductImportRow[],
  defaultProfitMargin?: number
): Promise<ProductImportResult> {
  const response = await fetch('/api/import/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products, defaultProfitMargin }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Erro ao importar produtos')
  }

  return response.json()
}

export function useImportClients() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: importClients,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['debtors'] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
    },
  })
}

export function useImportProducts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      products,
      defaultProfitMargin,
    }: {
      products: ProductImportRow[]
      defaultProfitMargin?: number
    }) => importProducts(products, defaultProfitMargin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}
