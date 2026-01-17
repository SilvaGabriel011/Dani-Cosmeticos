import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, subDays, startOfMonth } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num)
}

export function formatPercent(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  return `${num.toFixed(1)}%`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function calculateSalePrice(costPrice: number, profitMargin: number): number {
  return costPrice * (1 + profitMargin / 100)
}

export function calculateProfitMargin(costPrice: number, salePrice: number): number {
  if (costPrice <= 0) return 0
  return ((salePrice / costPrice) - 1) * 100
}

export function calculateProfit(costPrice: number, salePrice: number): number {
  return salePrice - costPrice
}

export function calculateFeeAmount(amount: number, feePercent: number): number {
  return amount * (feePercent / 100)
}

export function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  
  switch (period) {
    case "today":
      return {
        startDate: format(todayUTC, "yyyy-MM-dd"),
        endDate: format(todayUTC, "yyyy-MM-dd"),
      }
    case "week":
      return {
        startDate: format(subDays(todayUTC, 7), "yyyy-MM-dd"),
        endDate: format(todayUTC, "yyyy-MM-dd"),
      }
    case "month":
      return {
        startDate: format(startOfMonth(todayUTC), "yyyy-MM-dd"),
        endDate: format(todayUTC, "yyyy-MM-dd"),
      }
    default:
      return { startDate: "", endDate: "" }
  }
}

export type StockStatus = "baixo" | "medio" | "bom"

export interface StockStatusInfo {
  status: StockStatus
  label: string
  color: "destructive" | "warning" | "info"
}

export function getStockStatus(stock: number, minStock: number): StockStatusInfo {
  if (stock <= minStock) {
    return {
      status: "baixo",
      label: "Baixo",
      color: "destructive",
    }
  }
  
  if (stock <= minStock * 2) {
    return {
      status: "medio",
      label: "Médio",
      color: "warning",
    }
  }
  
  return {
    status: "bom",
    label: "Bom",
    color: "info",
  }
}
