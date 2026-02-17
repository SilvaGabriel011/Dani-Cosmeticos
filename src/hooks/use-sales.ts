'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  type CreateSaleInput,
  type AddPaymentInput,
  type AddItemsToSaleInput,
  type RescheduleSaleInput,
} from '@/schemas/sale'
import { type Sale, type PaginatedResult } from '@/types'

interface PendingReceivableDetail {
  id: string
  installment: number
  amount: number
  paidAmount: number
  dueDate: string
  status: string
}

interface PendingSale {
  id: string
  total: number
  remaining: number
  paidAmount: number
  installmentPlan: number
  fixedInstallmentAmount: number | null
  paymentDay: number | null
  createdAt: string
  itemsCount: number
  pendingReceivablesCount: number
  nextDueDate: string | null
  pendingReceivables: PendingReceivableDetail[]
}

interface SaleFilters {
  page?: number
  limit?: number
  status?: 'COMPLETED' | 'PENDING' | ''
  clientId?: string
  startDate?: string
  endDate?: string
  categoryId?: string
  productId?: string
  paymentMethod?: string
  search?: string
}

async function fetchSales(filters: SaleFilters): Promise<PaginatedResult<Sale>> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', filters.page.toString())
  if (filters.limit) params.set('limit', filters.limit.toString())
  if (filters.status) params.set('status', filters.status)
  if (filters.clientId) params.set('clientId', filters.clientId)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.categoryId) params.set('categoryId', filters.categoryId)
  if (filters.productId) params.set('productId', filters.productId)
  if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod)
  if (filters.search) params.set('search', filters.search)

  const res = await fetch(`/api/sales?${params}`)
  if (!res.ok) throw new Error('Erro ao buscar vendas')
  return res.json()
}

async function fetchSale(id: string): Promise<Sale> {
  const res = await fetch(`/api/sales/${id}`)
  if (!res.ok) throw new Error('Erro ao buscar venda')
  return res.json()
}

async function createSale(data: CreateSaleInput): Promise<Sale> {
  const res = await fetch('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao criar venda')
  }
  return res.json()
}

async function cancelSale(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/sales/${id}/cancel`, { method: 'POST' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao cancelar venda')
  }
  return res.json()
}

async function addPayment({
  saleId,
  data,
}: {
  saleId: string
  data: AddPaymentInput
}): Promise<Sale> {
  const res = await fetch(`/api/sales/${saleId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao adicionar pagamento')
  }
  return res.json()
}

export function useSales(filters: SaleFilters = {}) {
  return useQuery({
    queryKey: ['sales', filters],
    queryFn: () => fetchSales(filters),
    staleTime: 30 * 1000, // 30s
  })
}

export function useSale(id: string) {
  return useQuery({
    queryKey: ['sale', id],
    queryFn: () => fetchSale(id),
    enabled: !!id,
    staleTime: 30 * 1000, // 30s
  })
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSale,
    onSuccess: (newSale) => {
      // Update otimista
      queryClient.setQueryData(['sale', newSale.id], newSale)
      // Invalida vendas, produtos (estoque mudou), dashboard e receivables
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['salesWithReceivables'] })
      queryClient.invalidateQueries({ queryKey: ['client-pending-sales'] })
    },
  })
}

export function useCancelSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelSale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['salesWithReceivables'] })
      queryClient.invalidateQueries({ queryKey: ['client-pending-sales'] })
    },
  })
}

export function useAddPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addPayment,
    onSuccess: (data) => {
      // Update otimista
      queryClient.setQueryData(['sale', data.id], data)
      queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })
}

// Fetch pending sales for a client (for multiple purchases feature)
async function fetchClientPendingSales(clientId: string): Promise<{ pendingSales: PendingSale[] }> {
  const res = await fetch(`/api/clients/${clientId}/pending-sales`)
  if (!res.ok) throw new Error('Erro ao buscar vendas pendentes')
  return res.json()
}

export function useClientPendingSales(clientId: string | null) {
  return useQuery({
    queryKey: ['client-pending-sales', clientId],
    queryFn: () => fetchClientPendingSales(clientId!),
    enabled: !!clientId,
    staleTime: 30 * 1000, // 30s
  })
}

// Add items to an existing sale
export interface AddItemsResult {
  sale: Sale
  addedItemsTotal: number
}

async function addItemsToSale({
  saleId,
  data,
}: {
  saleId: string
  data: AddItemsToSaleInput
}): Promise<AddItemsResult> {
  const res = await fetch(`/api/sales/${saleId}/add-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao adicionar itens à venda')
  }
  const result = await res.json()
  return { sale: result.sale, addedItemsTotal: Number(result.addedItemsTotal || 0) }
}

export function useAddItemsToSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addItemsToSale,
    onSuccess: (data) => {
      queryClient.setQueryData(['sale', data.sale.id], data.sale)
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['client-pending-sales'] })
    },
  })
}

// Reschedule sale receivables
async function rescheduleSale({
  saleId,
  data,
}: {
  saleId: string
  data: RescheduleSaleInput
}): Promise<Sale> {
  const res = await fetch(`/api/sales/${saleId}/reschedule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao reagendar parcelas')
  }
  const result = await res.json()
  return result.sale
}

export function useRescheduleSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rescheduleSale,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.setQueryData(['sale', data.id], data)
    },
  })
}

// Update a single receivable's due date
async function updateReceivable({
  id,
  dueDate,
}: {
  id: string
  dueDate: string
}): Promise<unknown> {
  const res = await fetch(`/api/receivables/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dueDate }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || 'Erro ao atualizar parcela')
  }
  return res.json()
}

export function useUpdateReceivable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateReceivable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
    },
  })
}
