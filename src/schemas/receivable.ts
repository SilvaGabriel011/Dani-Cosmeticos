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
})

export const listReceivablesSchema = z.object({
  clientId: z.string().uuid().optional(),
  saleId: z.string().uuid().optional(),
  status: z
    .union([
      z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE']),
      z
        .string()
        .transform((val) => val.split(',') as ('PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE')[]),
    ])
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export type CreateReceivableInput = z.infer<typeof createReceivableSchema>
export type PayReceivableInput = z.infer<typeof payReceivableSchema>
export type ListReceivablesInput = z.infer<typeof listReceivablesSchema>
