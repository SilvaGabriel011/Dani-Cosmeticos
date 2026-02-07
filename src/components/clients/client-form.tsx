'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, User } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { useCreateClient, useUpdateClient } from '@/hooks/use-clients'
import { createClientSchema, type CreateClientInput } from '@/schemas/client'
import { type Client } from '@/types'

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
          name: '',
          phone: '',
          address: '',
          discount: 0,
        },
  })

  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        phone: client.phone,
        address: client.address,
        discount: Number(client.discount),
      })
    } else {
      reset({
        name: '',
        phone: '',
        address: '',
        discount: 0,
      })
    }
  }, [client, reset])

  const onSubmit = async (data: CreateClientInput) => {
    try {
      if (isEditing && client) {
        await updateClient.mutateAsync({ id: client.id, data })
        toast({ title: 'Cliente atualizado com sucesso!' })
      } else {
        await createClient.mutateAsync(data)
        toast({ title: 'Cliente criado com sucesso!' })
      }
      reset()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input 
              id="name" 
              placeholder="Nome completo" 
              {...register('name')} 
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
            {errors.name && (
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input 
              id="phone" 
              placeholder="(00) 00000-0000" 
              {...register('phone')} 
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
            {errors.phone && (
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input 
              id="address" 
              placeholder="Rua, número, bairro" 
              {...register('address')} 
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
            {errors.address && (
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.address.message}
              </p>
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
              {...register('discount', { valueAsNumber: true })}
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-sm text-muted-foreground">
              Este desconto será aplicado automaticamente nas vendas para este cliente
            </p>
            {errors.discount && (
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.discount.message}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="transition-all duration-200 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="min-w-[100px] transition-all duration-200"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Salvando...
                </span>
              ) : isEditing ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
