'use client'

import { useState, useCallback } from 'react'

const STORAGE_KEY_CLIENTS = 'recent-clients'
const STORAGE_KEY_PRODUCTS = 'recent-products'
const MAX_RECENT = 5

function getStored(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function setStored(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // Ignore storage errors
  }
}

function addToRecent(key: string, id: string, current: string[]): string[] {
  const filtered = current.filter((item) => item !== id)
  const updated = [id, ...filtered].slice(0, MAX_RECENT)
  setStored(key, updated)
  return updated
}

export function useRecentSelections() {
  const [recentClientIds, setRecentClientIds] = useState<string[]>(() =>
    getStored(STORAGE_KEY_CLIENTS)
  )
  const [recentProductIds, setRecentProductIds] = useState<string[]>(() =>
    getStored(STORAGE_KEY_PRODUCTS)
  )

  const addRecentClient = useCallback((id: string) => {
    setRecentClientIds((prev) => addToRecent(STORAGE_KEY_CLIENTS, id, prev))
  }, [])

  const addRecentProduct = useCallback((id: string) => {
    setRecentProductIds((prev) => addToRecent(STORAGE_KEY_PRODUCTS, id, prev))
  }, [])

  return {
    recentClientIds,
    recentProductIds,
    addRecentClient,
    addRecentProduct,
  }
}
