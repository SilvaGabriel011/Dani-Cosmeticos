"use client"

import { useState, useCallback } from "react"

interface UseFiltersOptions<T> {
  initialValues: T
  persistKey?: string
}

interface UseFiltersReturn<T> {
  filters: T
  setFilter: (name: keyof T, value: T[keyof T]) => void
  setFilters: (values: Partial<T>) => void
  resetFilters: () => void
  hasActiveFilters: boolean
}

export function useFilters<T extends Record<string, unknown>>({
  initialValues,
  persistKey,
}: UseFiltersOptions<T>): UseFiltersReturn<T> {
  const [filters, setFiltersState] = useState<T>(() => {
    if (persistKey && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(persistKey)
        if (saved) return { ...initialValues, ...JSON.parse(saved) }
      } catch {
        // Ignore parse errors
      }
    }
    return initialValues
  })

  const setFilter = useCallback(
    (name: keyof T, value: T[keyof T]) => {
      setFiltersState((prev) => {
        const next = { ...prev, [name]: value }
        if (persistKey) {
          try {
            localStorage.setItem(persistKey, JSON.stringify(next))
          } catch {
            // Ignore storage errors
          }
        }
        return next
      })
    },
    [persistKey]
  )

  const setFilters = useCallback(
    (values: Partial<T>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...values }
        if (persistKey) {
          try {
            localStorage.setItem(persistKey, JSON.stringify(next))
          } catch {
            // Ignore storage errors
          }
        }
        return next
      })
    },
    [persistKey]
  )

  const resetFilters = useCallback(() => {
    setFiltersState(initialValues)
    if (persistKey) {
      try {
        localStorage.removeItem(persistKey)
      } catch {
        // Ignore storage errors
      }
    }
  }, [initialValues, persistKey])

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => value !== initialValues[key as keyof T]
  )

  return { filters, setFilter, setFilters, resetFilters, hasActiveFilters }
}
