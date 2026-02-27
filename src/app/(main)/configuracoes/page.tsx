'use client'

import { useEffect, useRef, useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import { useDownloadBackup, useRestoreBackup } from '@/hooks/use-backup'
import { useSettings, useUpdateSettings } from '@/hooks/use-settings'
import { FEE_ABSORBER_LABELS } from '@/lib/constants'

export default function ConfiguracoesPage() {
  const { toast } = useToast()
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const downloadBackup = useDownloadBackup()
  const restoreBackup = useRestoreBackup()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false)

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
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  const handleDownloadBackup = async () => {
    try {
      await downloadBackup.mutateAsync()
      toast({ title: 'Backup baixado com sucesso!' })
    } catch (error: unknown) {
      toast({
        title: 'Erro ao gerar backup',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoreFile(file)
    setConfirmRestoreOpen(true)
    // Reset input so the same file can be selected again if needed
    e.target.value = ''
  }

  const handleConfirmRestore = async () => {
    if (!restoreFile) return
    setConfirmRestoreOpen(false)
    try {
      await restoreBackup.mutateAsync(restoreFile)
      toast({ title: 'Banco de dados restaurado com sucesso!' })
      setRestoreFile(null)
    } catch (error: unknown) {
      toast({
        title: 'Erro ao restaurar backup',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
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

      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>Backup e Restauração</CardTitle>
          <CardDescription>
            Faça backup manual dos dados ou restaure a partir de um arquivo de backup anterior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Backup manual</p>
            <p className="text-sm text-muted-foreground">
              Baixa um arquivo JSON com todos os dados do banco (clientes, vendas, estoque, etc.)
            </p>
            <Button
              variant="outline"
              className="mt-2"
              onClick={handleDownloadBackup}
              disabled={downloadBackup.isPending}
            >
              {downloadBackup.isPending ? 'Gerando backup...' : 'Baixar Backup Agora'}
            </Button>
          </div>

          <div className="border-t pt-4 space-y-1">
            <p className="text-sm font-medium">Backup automático</p>
            <p className="text-sm text-muted-foreground">
              Um snapshot do banco é criado automaticamente todo dia às 3h (UTC) no Neon. Para
              ativar, adicione <code className="bg-muted px-1 rounded text-xs">NEON_API_KEY</code> e{' '}
              <code className="bg-muted px-1 rounded text-xs">NEON_PROJECT_ID</code> nas variáveis
              de ambiente do projeto na Vercel.
            </p>
          </div>

          <div className="border-t pt-4 space-y-1">
            <p className="text-sm font-medium text-destructive">Restaurar backup</p>
            <p className="text-sm text-muted-foreground">
              Substitui <strong>todos</strong> os dados atuais pelos dados do arquivo de backup.
              Esta ação não pode ser desfeita.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelected}
            />
            <Button
              variant="destructive"
              className="mt-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={restoreBackup.isPending}
            >
              {restoreBackup.isPending ? 'Restaurando...' : 'Selecionar Arquivo de Backup'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmRestoreOpen}
        onOpenChange={setConfirmRestoreOpen}
        title="Restaurar backup"
        description={`Isso substituirá TODOS os dados do banco pelo arquivo "${restoreFile?.name ?? ''}". Esta ação não pode ser desfeita. Deseja continuar?`}
        confirmLabel="Sim, restaurar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={handleConfirmRestore}
      />
    </div>
  )
}
