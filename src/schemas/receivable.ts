import { z } from 'zod'

export const createReceivableSchema = z.object({
  saleId: z.string().uuid(),
  installment: z.number().int().min(1),
  amount: z.number().positive(),
  dueDate: z.string().datetime(),
})

export const payReceivableSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'PIX', 'DEBIT', 'CREDIT']).default('CASH'),
  paidAt: z.string().datetime().optional(),
  feePercent: z.number().min(0).default(0),
  feeAbsorber: z.enum(['SELLER', 'CLIENT']).default('SELLER'),
  installments: z.number().int().min(1).default(1),
})

export const listReceivablesSchema = z.object({
  clientId: z.string().uuid().optional(),
  saleId: z.string().uuid().optional(),
  status: z
    .union([
      z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']),
      z
        .string()
        .transform((val) => val.split(',') as ('PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED')[]),
    ])
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export const overrideReceivableSchema = z.object({
  amount: z.number().positive().optional(),
  paidAmount: z.number().min(0).optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  dueDate: z.string().datetime().optional(),
  reason: z.string().min(1, 'Motivo é obrigatório'),
})

export type CreateReceivableInput = z.infer<typeof createReceivableSchema>
export type PayReceivableInput = z.infer<typeof payReceivableSchema>
export type ListReceivablesInput = z.infer<typeof listReceivablesSchema>
export type OverrideReceivableInput = z.infer<typeof overrideReceivableSchema>
