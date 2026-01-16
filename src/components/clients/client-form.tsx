"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { useCreateClient, useUpdateClient } from "@/hooks/use-clients"
import { createClientSchema, CreateClientInput } from "@/schemas/client"
import { Client } from "@/types"

interface ClientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client | null
}

export function ClientForm({ open, onOpenChange, client }: ClientFormProps) {
  const { toast } = useToast()
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const isEditing = !!client

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: client
      ? {
          name: client.name,
          phone: client.phone,
          address: client.address,
          discount: Number(client.discount),
        }
      : {
          name: "",
          phone: "",
          address: "",
          discount: 0,
        },
  })

  const onSubmit = async (data: CreateClientInput) => {
    try {
      if (isEditing && client) {
        await updateClient.mutateAsync({ id: client.id, data })
        toast({ title: "Cliente atualizado com sucesso!" })
      } else {
        await createClient.mutateAsync(data)
        toast({ title: "Cliente criado com sucesso!" })
      }
      reset()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              placeholder="Nome completo"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              placeholder="(00) 00000-0000"
              {...register("phone")}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço *</Label>
            <Input
              id="address"
              placeholder="Rua, número, bairro"
              {...register("address")}
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount">Desconto Padrão (%)</Label>
            <Input
              id="discount"
              type="number"
              min="0"
              max="100"
              step="0.1"
              {...register("discount", { valueAsNumber: true })}
            />
            {errors.discount && (
              <p className="text-sm text-destructive">{errors.discount.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : isEditing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
