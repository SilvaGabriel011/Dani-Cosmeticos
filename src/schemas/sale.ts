import { z } from "zod"

export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive("Quantidade deve ser positiva"),
})

export const paymentSchema = z.object({
  method: z.enum(["CASH", "PIX", "DEBIT", "CREDIT"]),
  amount: z.number().positive("Valor deve ser positivo"),
  feePercent: z.number().min(0).default(0),
  feeAbsorber: z.enum(["SELLER", "CLIENT"]).default("SELLER"),
  installments: z.number().int().min(1).max(12).default(1),
})

export const createSaleSchema = z.object({
  clientId: z.string().uuid().optional().nullable(),
  items: z.array(saleItemSchema).min(1, "Pelo menos um item é obrigatório"),
  payments: z.array(paymentSchema).default([]),
  discountPercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  installmentPlan: z.number().int().min(1).max(12).default(1),
})

export const addPaymentSchema = z.object({
  method: z.enum(["CASH", "PIX", "DEBIT", "CREDIT"]),
  amount: z.number().positive("Valor deve ser positivo"),
  feePercent: z.number().min(0).default(0),
  feeAbsorber: z.enum(["SELLER", "CLIENT"]).default("SELLER"),
  installments: z.number().int().min(1).max(12).default(1),
})

export type SaleItemInput = z.infer<typeof saleItemSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
export type CreateSaleInput = z.infer<typeof createSaleSchema>
export type AddPaymentInput = z.infer<typeof addPaymentSchema>
