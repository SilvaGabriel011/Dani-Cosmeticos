import { z } from 'zod'

export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive('Quantidade deve ser positiva'),
  unitPrice: z.number().positive('Preço deve ser positivo').optional(),
  originalPrice: z.number().positive('Preço original deve ser positivo').optional(),
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
  installmentPlan: z.number().int().min(1).max(48).default(1),
  fixedInstallmentAmount: z.number().positive().optional().nullable(), // Fixed amount for each payment
  createdAt: z.string().datetime().optional(), // For imports: use original sale date for receivable calculations
  startMonth: z.number().int().min(1).max(12).optional().nullable(), // Month (1-12) for first installment
  startYear: z.number().int().min(2020).max(2100).optional().nullable(), // Year for first installment
})

export const addPaymentSchema = z.object({
  method: z.enum(['CASH', 'PIX', 'DEBIT', 'CREDIT']),
  amount: z.number().positive('Valor deve ser positivo'),
  feePercent: z.number().min(0).default(0),
  feeAbsorber: z.enum(['SELLER', 'CLIENT']).default('SELLER'),
  installments: z.number().int().min(1).max(12).default(1),
  confirmOverpayment: z.boolean().default(false),
})

// Schema for adding items to an existing sale (multiple purchases feature)
export const addItemsToSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'Pelo menos um item é obrigatório'),
  fixedInstallmentAmount: z.number().positive().optional().nullable(),
  mode: z.enum(['increase_installments', 'increase_value', 'increase_value_from_installment', 'recalculate']).default('recalculate'),
  startFromInstallment: z.number().int().min(1).optional().nullable(),
  targetInstallmentAmount: z.number().positive().optional().nullable(),
  targetInstallmentCount: z.number().int().min(1).optional().nullable(),
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

export const overrideSaleSchema = z.object({
  status: z.enum(['COMPLETED', 'PENDING']).optional(),
  paidAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  reason: z.string().min(1, 'Motivo é obrigatório'),
  receivables: z.array(z.object({
    id: z.string().uuid().optional(),
    installment: z.number().int().min(1),
    amount: z.number().positive(),
    paidAmount: z.number().min(0),
    status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']),
    dueDate: z.string().datetime(),
  })).optional(),
  deleteReceivableIds: z.array(z.string().uuid()).optional(),
})

export type SaleItemInput = z.infer<typeof saleItemSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
export type CreateSaleInput = z.infer<typeof createSaleSchema>
export type AddPaymentInput = z.infer<typeof addPaymentSchema>
export type AddItemsToSaleInput = z.input<typeof addItemsToSaleSchema>
export type RescheduleSaleInput = z.infer<typeof rescheduleSaleSchema>
export type UpdateReceivableInput = z.infer<typeof updateReceivableSchema>
export type OverrideSaleInput = z.infer<typeof overrideSaleSchema>
