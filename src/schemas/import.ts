import { z } from "zod"

export const clientImportRowSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  debitoAberto: z.number().min(0, "Débito deve ser positivo"),
  pago: z.number().min(0, "Valor pago deve ser positivo"),
  totalEmAberto: z.number().optional(),
  valorParcelas: z.number().optional(),
  numeroParcelas: z.number().int().min(0).optional(),
  pagamentoDia: z.number().int().min(1).max(31).optional(),
})

export const clientImportSchema = z.object({
  clients: z.array(clientImportRowSchema).min(1, "Pelo menos um cliente é necessário"),
})

export const productImportRowSchema = z.object({
  marca: z.string().min(1, "Marca é obrigatória"),
  linha: z.string().optional(),
  fragrancia: z.string().optional(),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  tipoEmbalagem: z.string().optional(),
  quantidade: z.number().int().min(0, "Quantidade deve ser positiva"),
  valor: z.number().min(0, "Valor deve ser positivo"),
})

export const productImportSchema = z.object({
  products: z.array(productImportRowSchema).min(1, "Pelo menos um produto é necessário"),
  defaultProfitMargin: z.number().min(0).max(100).optional(),
})

export type ClientImportRow = z.infer<typeof clientImportRowSchema>
export type ClientImportInput = z.infer<typeof clientImportSchema>
export type ProductImportRow = z.infer<typeof productImportRowSchema>
export type ProductImportInput = z.infer<typeof productImportSchema>
