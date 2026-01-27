'use client'

import { AlertTriangle, CheckCircle, Loader2, Play, Search } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface PreviewItem {
  saleId: string
  clientName: string
  saleTotal: number
  salePaidAmount: number
  receivablesTotal: number
  receivablesPaidTotal: number
  receivablesCount: number
  needsFix: boolean
  difference: number
}

interface FixResult {
  success: boolean
  message: string
  results?: {
    totalSales: number
    fixed: number
    skipped: number
    errors: Array<{ saleId: string; clientName: string; error: string }>
    details: Array<{
      saleId: string
      clientName: string
      salePaidAmount: number
      receivablesPaidBefore: number
      receivablesPaidAfter: number
    }>
  }
}

export default function ManutencaoPage() {
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const [preview, setPreview] = useState<PreviewItem[] | null>(null)
  const [fixResult, setFixResult] = useState<FixResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePreview = async () => {
    setIsLoadingPreview(true)
    setError(null)
    setFixResult(null)

    try {
      const res = await fetch('/api/admin/fix-receivables')
      const data = await res.json()

      if (data.success) {
        setPreview(data.preview)
      } else {
        setError(data.error?.message || 'Erro ao verificar')
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleFix = async () => {
    if (!confirm('Tem certeza que deseja corrigir as parcelas? Esta ação não pode ser desfeita.')) {
      return
    }

    setIsFixing(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/fix-receivables', { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        setFixResult(data)
        setPreview(null)
      } else {
        setError(data.error?.message || 'Erro ao corrigir')
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setIsFixing(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção do Sistema"
        description="Ferramentas de correção e manutenção de dados"
      />

      <Card>
        <CardHeader>
          <CardTitle>Corrigir Parcelas de Clientes Importados</CardTitle>
          <CardDescription>
            Corrige vendas importadas onde o valor pago não foi distribuído corretamente nas
            parcelas. Isso afeta o cálculo do total devido na seção de devedores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={handlePreview} disabled={isLoadingPreview || isFixing}>
              {isLoadingPreview ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Verificar Problemas
            </Button>

            {preview && preview.length > 0 && (
              <Button onClick={handleFix} disabled={isFixing} variant="destructive">
                {isFixing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Executar Correção ({preview.length})
              </Button>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {preview !== null && preview.length === 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Tudo certo!</AlertTitle>
              <AlertDescription>Não há parcelas que precisam de correção.</AlertDescription>
            </Alert>
          )}

          {preview && preview.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Vendas que precisam de correção:</h4>
              <div className="max-h-[400px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Cliente</th>
                      <th className="text-right p-2">Total Venda</th>
                      <th className="text-right p-2">Pago (Sale)</th>
                      <th className="text-right p-2">Pago (Parcelas)</th>
                      <th className="text-right p-2">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((item) => (
                      <tr key={item.saleId} className="border-t">
                        <td className="p-2">{item.clientName}</td>
                        <td className="text-right p-2">{formatCurrency(item.saleTotal)}</td>
                        <td className="text-right p-2">{formatCurrency(item.salePaidAmount)}</td>
                        <td className="text-right p-2">
                          {formatCurrency(item.receivablesPaidTotal)}
                        </td>
                        <td className="text-right p-2 text-destructive font-medium">
                          {formatCurrency(item.difference)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {fixResult && fixResult.success && (
            <Alert className="border-green-500">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Correção concluída!</AlertTitle>
              <AlertDescription>
                <p>{fixResult.message}</p>
                {fixResult.results && (
                  <ul className="mt-2 list-disc pl-4">
                    <li>Vendas corrigidas: {fixResult.results.fixed}</li>
                    <li>Já estavam corretas: {fixResult.results.skipped}</li>
                    {fixResult.results.errors.length > 0 && (
                      <li className="text-destructive">Erros: {fixResult.results.errors.length}</li>
                    )}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
