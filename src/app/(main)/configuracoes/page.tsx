'use client'

import { useEffect, useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useSettings, useUpdateSettings } from '@/hooks/use-settings'
import { FEE_ABSORBER_LABELS } from '@/lib/constants'

export default function ConfiguracoesPage() {
  const { toast } = useToast()
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()

  const [debitFee, setDebitFee] = useState(1.5)
  const [creditFee, setCreditFee] = useState(3.0)
  const [installmentFee, setInstallmentFee] = useState(4.0)
  const [feeAbsorber, setFeeAbsorber] = useState<'SELLER' | 'CLIENT'>('SELLER')
  const [lowStockAlert, setLowStockAlert] = useState(true)

  useEffect(() => {
    if (settings) {
      setDebitFee(Number(settings.debitFeePercent))
      setCreditFee(Number(settings.creditFeePercent))
      setInstallmentFee(Number(settings.creditInstallmentFee))
      setFeeAbsorber(settings.defaultFeeAbsorber as 'SELLER' | 'CLIENT')
      setLowStockAlert(settings.lowStockAlertEnabled)
    }
  }, [settings])

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        debitFeePercent: debitFee,
        creditFeePercent: creditFee,
        creditInstallmentFee: installmentFee,
        defaultFeeAbsorber: feeAbsorber,
        lowStockAlertEnabled: lowStockAlert,
      })
      toast({ title: 'Configurações salvas com sucesso!' })
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Configurações" description="Configure taxas e preferências" />
        <Skeleton className="h-64 max-w-2xl" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Configurações" description="Configure taxas e preferências" />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Taxas de Cartão</CardTitle>
          <CardDescription>Configure as taxas cobradas pelas operadoras de cartão</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="debit">Taxa Débito (%)</Label>
            <Input
              id="debit"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={debitFee}
              onChange={(e) => setDebitFee(Number(e.target.value))}
              className="max-w-xs"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="credit">Taxa Crédito à Vista (%)</Label>
            <Input
              id="credit"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={creditFee}
              onChange={(e) => setCreditFee(Number(e.target.value))}
              className="max-w-xs"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="installment">Taxa Crédito Parcelado (%)</Label>
            <Input
              id="installment"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={installmentFee}
              onChange={(e) => setInstallmentFee(Number(e.target.value))}
              className="max-w-xs"
            />
          </div>
          <div className="grid gap-2">
            <Label>Quem paga a taxa por padrão?</Label>
            <Select
              value={feeAbsorber}
              onValueChange={(v) => setFeeAbsorber(v as 'SELLER' | 'CLIENT')}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FEE_ABSORBER_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="mt-4" onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
