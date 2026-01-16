import { z } from "zod"

export const createClientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().min(1, "Telefone é obrigatório"),
  address: z.string().min(1, "Endereço é obrigatório"),
  discount: z.number().min(0).max(100).default(0),
})

export const updateClientSchema = createClientSchema.partial()

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
