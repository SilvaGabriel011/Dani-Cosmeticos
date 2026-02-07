import { z } from 'zod'

export const createProductSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório'),
  categoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  costPrice: z.number().min(0, 'Custo não pode ser negativo'),
  profitMargin: z.number().min(0, 'Margem não pode ser negativa'),
  stock: z.number().int().min(0, 'Estoque não pode ser negativo'),
  minStock: z.number().int().min(0, 'Estoque mínimo não pode ser negativo'),
})

export const updateProductSchema = createProductSchema.partial()

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
