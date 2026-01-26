import { z } from 'zod'

export const updateSettingsSchema = z.object({
  debitFeePercent: z.number().min(0).max(100),
  creditFeePercent: z.number().min(0).max(100),
  creditInstallmentFee: z.number().min(0).max(100),
  defaultFeeAbsorber: z.enum(['SELLER', 'CLIENT']),
  lowStockAlertEnabled: z.boolean(),
})

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
