"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Settings } from "@/types"
import { UpdateSettingsInput } from "@/schemas/settings"

async function fetchSettings(): Promise<Settings> {
  const res = await fetch("/api/settings")
  if (!res.ok) throw new Error("Erro ao buscar configurações")
  return res.json()
}

async function updateSettings(data: UpdateSettingsInput): Promise<Settings> {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "Erro ao atualizar configurações")
  }
  return res.json()
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data)
    },
  })
}
