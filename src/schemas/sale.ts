import { z } from 'zod'

export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive('Quantidade deve ser positiva'),
  unitPrice: z.number().positive('Preço deve ser positivo').optional(),
})

export const paymentSchema = z.object({
  method: z.enum(['CASH', 'PIX', 'DEBIT', 'CREDIT']),
  amount: z.number().positive('Valor deve ser positivo'),
  feePercent: z.number().min(0).default(0),
  feeAbsorber: z.enum(['SELLER', 'CLIENT']).default('SELLER'),
  installments: z.number().int().min(1).max(12).default(1),
})

export const createSaleSchema = z.object({
  clientId: z.string().uuid().optional().nullable(),
  items: z.array(saleItemSchema).min(1, 'Pelo menos um item é obrigatório'),
  payments: z.array(paymentSchema).default([]),
  discountPercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  paymentDay: z.number().int().min(1).max(31).optional().nullable(), // Day of month (1-31)
  installmentPlan: z.number().int().min(1).max(12).default(1),
  fixedInstallmentAmount: z.number().positive().optional().nullable(), // Fixed amount for each payment
})

export const addPaymentSchema = z.object({
  method: z.enum(['CASH', 'PIX', 'DEBIT', 'CREDIT']),
  amount: z.number().positive('Valor deve ser positivo'),
  feePercent: z.number().min(0).default(0),
  feeAbsorber: z.enum(['SELLER', 'CLIENT']).default('SELLER'),
  installments: z.number().int().min(1).max(12).default(1),
})

// Schema for adding items to an existing sale (multiple purchases feature)
export const addItemsToSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'Pelo menos um item é obrigatório'),
})

// Schema for rescheduling sale receivables
export const rescheduleSaleSchema = z
  .object({
    newPaymentDay: z.number().int().min(1).max(31).optional(),
    newStartDate: z.string().datetime().optional(),
  })
  .refine((data) => data.newPaymentDay !== undefined || data.newStartDate !== undefined, {
    message: 'Informe newPaymentDay ou newStartDate',
  })

// Schema for updating a single receivable
export const updateReceivableSchema = z.object({
  dueDate: z.string().datetime(),
})

export type SaleItemInput = z.infer<typeof saleItemSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
export type CreateSaleInput = z.infer<typeof createSaleSchema>
export type AddPaymentInput = z.infer<typeof addPaymentSchema>
export type AddItemsToSaleInput = z.infer<typeof addItemsToSaleSchema>
export type RescheduleSaleInput = z.infer<typeof rescheduleSaleSchema>
export type UpdateReceivableInput = z.infer<typeof updateReceivableSchema>
