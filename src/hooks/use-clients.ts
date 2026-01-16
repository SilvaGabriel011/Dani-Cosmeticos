"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Client, PaginatedResult } from "@/types"
import { CreateClientInput, UpdateClientInput } from "@/schemas/client"

interface ClientFilters {
  page?: number
  limit?: number
  search?: string
}

async function fetchClients(filters: ClientFilters): Promise<PaginatedResult<Client>> {
  const params = new URLSearchParams()
  if (filters.page) params.set("page", filters.page.toString())
  if (filters.limit) params.set("limit", filters.limit.toString())
  if (filters.search) params.set("search", filters.search)

  const res = await fetch(`/api/clients?${params}`)
  if (!res.ok) throw new Error("Erro ao buscar clientes")
  return res.json()
}

async function fetchClient(id: string): Promise<Client> {
  const res = await fetch(`/api/clients/${id}`)
  if (!res.ok) throw new Error("Erro ao buscar cliente")
  return res.json()
}

async function createClient(data: CreateClientInput): Promise<Client> {
  const res = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Erro ao criar cliente")
  }
  return res.json()
}

async function updateClient({ id, data }: { id: string; data: UpdateClientInput }): Promise<Client> {
  const res = await fetch(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Erro ao atualizar cliente")
  }
  return res.json()
}

async function deleteClient(id: string): Promise<void> {
  const res = await fetch(`/api/clients/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Erro ao excluir cliente")
}

export function useClients(filters: ClientFilters = {}) {
  return useQuery({
    queryKey: ["clients", filters],
    queryFn: () => fetchClients(filters),
  })
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ["client", id],
    queryFn: () => fetchClient(id),
    enabled: !!id,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateClient,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      queryClient.setQueryData(["client", data.id], data)
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}
