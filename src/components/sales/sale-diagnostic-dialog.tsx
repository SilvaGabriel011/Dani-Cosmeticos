'use client'

import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Loader2,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Undo2,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { getIssueLabel } from '@/lib/issue-labels'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS } from '@/lib/constants'
import { SaleOverrideDialog } from './sale-override-dialog'

// Types
interface DiagnosticData {
  sale: {
    id: string
    status: string
    clientName: string | null
    createdAt: string
    total: number
    paidAmount: number
    subtotal: number
    discountPercent: number
    discountAmount: number
    totalFees: number
    netTotal: number
    receivables: Array<{
      id: string
      installment: number
      amount: number
      paidAmount: number
      status: string
      dueDate: string | Date
    }>
    client?: { id: string; name: string } | null
  }
  summary: {
    saleTotal: number
    salePaidAmount: number
    saleSubtotal: number
    saleDiscountPercent: number
    saleDiscountAmount: number
    saleTotalFees: number
    saleNetTotal: number
    saleStatus: string
    paymentsTotal: number
    paymentsCount: number
    receivablesTotalAmount: number
    receivablesTotalPaid: number
    receivablesRemaining: number
    activeReceivablesCount: number
    cancelledReceivablesCount: number
    itemsTotal: number
    itemsCount: number
  }
  payments: Array<{
    id: string
    method: string
    amount: number
    feePercent: number
    feeAmount: number
    feeAbsorber: string
    installments: number
    isAdjustment?: boolean
    paidAt: string
  }>
  receivables: Array<{
    id: string
    installment: number
    amount: number
    paidAmount: number
    remaining: number
    status: string
    dueDate: string
    paidAt: string | null
    createdAt: string
  }>
  items: Array<{
    id: string
    productName: string
    productCode: string | null
    quantity: number
    unitPrice: number
    total: number
  }>
  issues: Array<{
    type: 'error' | 'warning'
    code: string
    message: string
    details?: Record<string, unknown>
    acknowledged?: boolean
    acknowledgedAt?: string
  }>
  health: 'healthy' | 'warning' | 'critical'
  errorCount: number
  warningCount: number
}

interface SaleDiagnosticDialogProps {
  saleId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SaleDiagnosticDialog({
  saleId,
  open,
  onOpenChange,
}: SaleDiagnosticDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
  const [acknowledgingCode, setAcknowledgingCode] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sale-diagnostic', saleId],
    queryFn: async () => {
      const res = await fetch(`/api/sales/${saleId}/diagnostic`)
      if (!res.ok) throw new Error('Erro ao carregar diagnóstico')
      return res.json() as Promise<DiagnosticData>
    },
    enabled: open && !!saleId,
    staleTime: 0,
  })

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ issueCode, remove }: { issueCode: string; remove?: boolean }) => {
      if (remove) {
        const res = await fetch(`/api/sales/${saleId}/acknowledge-issue?issueCode=${issueCode}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Erro ao remover reconhecimento')
        return res.json()
      }
      const res = await fetch(`/api/sales/${saleId}/acknowledge-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueCode }),
      })
      if (!res.ok) throw new Error('Erro ao reconhecer erro')
      return res.json()
    },
    onSuccess: () => {
      refetch()
      queryClient.invalidateQueries({ queryKey: ['sale-diagnostic', saleId] })
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setAcknowledgingCode(null)
    },
  })

  const handleAcknowledge = (issueCode: string, isAcknowledged: boolean) => {
    setAcknowledgingCode(issueCode)
    acknowledgeMutation.mutate({ issueCode, remove: isAcknowledged })
  }

  if (!open) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Raio-X da Venda #{saleId.slice(0, 8)}
            </DialogTitle>
            <DialogDescription>
              {data?.sale.clientName || 'Sem cliente'} •{' '}
              {data ? formatDate(data.sale.createdAt) : 'Carregando...'}
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-40" />
              <Skeleton className="h-60" />
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200">
              <div className="font-medium flex items-center gap-2">
                <ShieldX className="h-4 w-4" />
                Erro ao carregar diagnóstico
              </div>
              <p className="mt-1 text-xs">
                {error instanceof Error ? error.message : 'Erro desconhecido'}
              </p>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* Health Indicator */}
              <div className="flex items-center gap-4 rounded-lg border p-4">
                {data.health === 'healthy' && (
                  <>
                    <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        Tudo OK
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Nenhum problema detectado
                      </p>
                    </div>
                  </>
                )}

                {data.health === 'warning' && (
                  <>
                    <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-600 dark:text-amber-400">
                        {data.warningCount} aviso{data.warningCount !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Existem inconsistências para revisar
                      </p>
                    </div>
                  </>
                )}

                {data.health === 'critical' && (
                  <>
                    <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        {data.errorCount} erro{data.errorCount !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Problemas críticos encontrados
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Summary Comparison */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Resumo Financeiro</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Venda Column */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground">
                      VENDA
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span className="font-mono">
                          {formatCurrency(data.summary.saleSubtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Desconto:</span>
                        <span className="font-mono text-red-600 dark:text-red-400">
                          -{formatCurrency(data.summary.saleDiscountAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Taxas:</span>
                        <span className="font-mono text-red-600 dark:text-red-400">
                          -{formatCurrency(data.summary.saleTotalFees)}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                        <span>Total:</span>
                        <span className="font-mono">
                          {formatCurrency(data.summary.saleTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Pago:</span>
                        <span
                          className={`font-mono font-semibold ${
                            Math.abs(data.summary.salePaidAmount - data.summary.paymentsTotal) <
                            0.01
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {formatCurrency(data.summary.salePaidAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Status:</span>
                        <Badge variant="outline">
                          {SALE_STATUS_LABELS[data.summary.saleStatus as keyof typeof SALE_STATUS_LABELS] || data.summary.saleStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Calculado Column */}
                  <div className="rounded-lg border p-4 space-y-3 bg-blue-50/30 dark:bg-blue-950/20">
                    <h4 className="text-xs font-semibold text-muted-foreground">
                      CALCULADO
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Itens:</span>
                        <span className="font-mono">
                          {formatCurrency(data.summary.itemsTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Desconto:</span>
                        <span className="font-mono text-red-600 dark:text-red-400">
                          -{formatCurrency(data.summary.saleDiscountAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Taxas:</span>
                        <span className="font-mono text-red-600 dark:text-red-400">
                          -{formatCurrency(data.summary.saleTotalFees)}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                        <span>Total esperado:</span>
                        <span
                          className={`font-mono ${
                            Math.abs(data.summary.saleTotal - data.summary.itemsTotal) <
                            0.01
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {formatCurrency(data.summary.itemsTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Pagamentos:</span>
                        <span
                          className={`font-mono font-semibold ${
                            Math.abs(data.summary.salePaidAmount - data.summary.paymentsTotal) <
                            0.01
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {formatCurrency(data.summary.paymentsTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Parcelas pagas:</span>
                        <span
                          className={`font-mono font-semibold ${
                            Math.abs(
                              data.summary.receivablesTotalPaid - data.summary.paymentsTotal
                            ) < 0.01
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {formatCurrency(data.summary.receivablesTotalPaid)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payments Table */}
              {data.payments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Pagamentos</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-4 py-2 font-semibold">Data</th>
                          <th className="text-left px-4 py-2 font-semibold">Método</th>
                          <th className="text-right px-4 py-2 font-semibold">Valor</th>
                          <th className="text-right px-4 py-2 font-semibold">Taxa</th>
                          <th className="text-right px-4 py-2 font-semibold">Absorbido por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.payments.map((payment) => (
                          <tr key={payment.id} className={`border-b last:border-0 ${payment.isAdjustment ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                            <td className="px-4 py-2">
                              {formatDate(payment.paidAt)}
                            </td>
                            <td className="px-4 py-2">
                              {payment.isAdjustment ? (
                                <span className="text-amber-700 dark:text-amber-300 font-medium text-xs">AJUSTE</span>
                              ) : (
                                <>
                                  {PAYMENT_METHOD_LABELS[payment.method as keyof typeof PAYMENT_METHOD_LABELS] || payment.method}
                                  {payment.installments > 1 && (
                                    <span className="text-xs text-muted-foreground">
                                      {' '}
                                      ({payment.installments}x)
                                    </span>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                              {payment.feePercent > 0 ? (
                                <>
                                  {payment.feePercent.toFixed(1)}% (
                                  {formatCurrency(payment.feeAmount)})
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-2 text-right text-xs">
                              {payment.feeAbsorber === 'SELLER' ? (
                                <Badge variant="outline" className="text-xs">
                                  Vendedor
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Cliente
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Receivables Table */}
              {data.receivables.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Parcelas</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-center px-4 py-2 font-semibold">#</th>
                          <th className="text-right px-4 py-2 font-semibold">Valor</th>
                          <th className="text-right px-4 py-2 font-semibold">Pago</th>
                          <th className="text-right px-4 py-2 font-semibold">Restante</th>
                          <th className="text-left px-4 py-2 font-semibold">Status</th>
                          <th className="text-left px-4 py-2 font-semibold">Vencimento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.receivables.map((rec) => (
                          <tr
                            key={rec.id}
                            className={`border-b last:border-0 ${
                              rec.status === 'CANCELLED'
                                ? 'bg-muted/30 line-through'
                                : ''
                            }`}
                          >
                            <td className="text-center px-4 py-2 font-semibold">
                              {rec.installment}
                            </td>
                            <td className="text-right px-4 py-2 font-mono">
                              {formatCurrency(rec.amount)}
                            </td>
                            <td
                              className={`text-right px-4 py-2 font-mono ${
                                rec.paidAmount > 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : ''
                              }`}
                            >
                              {formatCurrency(rec.paidAmount)}
                            </td>
                            <td
                              className={`text-right px-4 py-2 font-mono ${
                                rec.remaining > 0
                                  ? 'text-red-600 dark:text-red-400 font-semibold'
                                  : 'text-green-600 dark:text-green-400'
                              }`}
                            >
                              {formatCurrency(rec.remaining)}
                            </td>
                            <td className="px-4 py-2">
                              <Badge
                                variant={
                                  rec.status === 'PAID'
                                    ? 'default'
                                    : rec.status === 'OVERDUE'
                                    ? 'destructive'
                                    : rec.status === 'CANCELLED'
                                    ? 'secondary'
                                    : 'outline'
                                }
                              >
                                {rec.status === 'PENDING'
                                  ? 'Pendente'
                                  : rec.status === 'PARTIAL'
                                  ? 'Parcial'
                                  : rec.status === 'PAID'
                                  ? 'Paga'
                                  : rec.status === 'OVERDUE'
                                  ? 'Atrasada'
                                  : 'Cancelada'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2">
                              {formatDate(rec.dueDate)}
                              {rec.paidAt && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (pago em {formatDate(rec.paidAt)})
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Items Table */}
              {data.items.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Itens da Venda</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-4 py-2 font-semibold">Produto</th>
                          <th className="text-right px-4 py-2 font-semibold">Qtd</th>
                          <th className="text-right px-4 py-2 font-semibold">Preço Unit.</th>
                          <th className="text-right px-4 py-2 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((item) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="px-4 py-2">
                              <div className="font-medium">{item.productName}</div>
                              {item.productCode && (
                                <div className="text-xs text-muted-foreground">
                                  {item.productCode}
                                </div>
                              )}
                            </td>
                            <td className="text-right px-4 py-2 font-mono">
                              {item.quantity}
                            </td>
                            <td className="text-right px-4 py-2 font-mono">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="text-right px-4 py-2 font-mono font-semibold">
                              {formatCurrency(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Issues */}
              {data.issues.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Problemas Detectados</h3>
                  <div className="space-y-2">
                    {data.issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg border p-3 flex gap-3 transition-opacity ${
                          issue.acknowledged
                            ? 'border-muted bg-muted/30 opacity-60'
                            : issue.type === 'error'
                              ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                              : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {issue.acknowledged ? (
                            <CheckSquare className="h-4 w-4 text-muted-foreground" />
                          ) : issue.type === 'error' ? (
                            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-medium ${issue.acknowledged ? 'line-through text-muted-foreground' : ''}`}>
                              {getIssueLabel(issue.code)}
                            </p>
                            {issue.acknowledged && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Reconhecido
                              </Badge>
                            )}
                          </div>
                          <p
                            className={`text-xs ${
                              issue.acknowledged
                                ? 'text-muted-foreground'
                                : issue.type === 'error'
                                  ? 'text-red-700 dark:text-red-300'
                                  : 'text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {issue.message}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                            {issue.code}
                          </p>
                          {issue.details && Object.keys(issue.details).length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                              {Object.entries(issue.details).map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-semibold">{key}:</span>{' '}
                                  {typeof value === 'number'
                                    ? formatCurrency(value)
                                    : String(value)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`shrink-0 h-7 text-xs gap-1 ${
                            issue.acknowledged
                              ? 'text-muted-foreground border-muted'
                              : 'text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30'
                          }`}
                          onClick={() => handleAcknowledge(issue.code, !!issue.acknowledged)}
                          disabled={acknowledgingCode === issue.code}
                        >
                          {acknowledgingCode === issue.code ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : issue.acknowledged ? (
                            <>
                              <Undo2 className="h-3 w-3" />
                              Desfazer
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              Reconhecer
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Issues */}
              {data.issues.length === 0 && (
                <div className="rounded-lg border border-green-300 bg-green-50 p-4 flex gap-3 dark:border-green-800 dark:bg-green-950/30">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-700 dark:text-green-300">
                      Nenhum problema encontrado
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      A venda passou em todas as validações de integridade
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer with Super Edição Button */}
          {data && data.issues.length > 0 && (
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button
                onClick={() => setOverrideDialogOpen(true)}
                className="gap-2 ml-auto"
              >
                <Pencil className="h-4 w-4" />
                Abrir Super Edição
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Super Edição Dialog */}
      {data && (
        <SaleOverrideDialog
          sale={data.sale}
          open={overrideDialogOpen}
          onOpenChange={setOverrideDialogOpen}
        />
      )}
    </>
  )
}
