import { type Prisma } from '@prisma/client'

export type Product = Prisma.ProductGetPayload<{
  include: { category: true; brand: true }
}>

export type Client = Prisma.ClientGetPayload<{}>

export type Sale = Prisma.SaleGetPayload<{
  include: {
    client: true
    items: { include: { product: true } }
    payments: true
    receivables: true
  }
}>

export type SaleItem = Prisma.SaleItemGetPayload<{
  include: { product: true }
}>

export type Payment = Prisma.PaymentGetPayload<{}>

export type Category = Prisma.CategoryGetPayload<{}>

export type Brand = Prisma.BrandGetPayload<{}>

export type Settings = Prisma.SettingsGetPayload<{}>

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
}
