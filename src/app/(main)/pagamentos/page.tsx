'use client'

import { Banknote, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, Copy, Pencil, Printer, Trash2 } from 'lucide-react'
import { useState, useMemo, useCallback, useEffect } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FilterBar, type FilterConfig } from '@/components/ui/filter-bar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useClients } from '@/hooks/use-clients'
import { useFilters } from '@/hooks/use-filters'
import { usePayments, useDeletePayment, useEditPayment, type PaymentData } from '@/hooks/use-payments'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { useToast } from '@/components/ui/use-toast'
import { printPaymentInstallments } from '@/lib/print-sale'
import { formatCurrency, formatDate, getDateRange } from '@/lib/utils'

const periodOptions = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: '7 dias' },
  { value: 'month', label: 'Mes' },
  { value: 'all', label: 'Todas' },
]

const paymentMethodOptions = [
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'CREDIT', label: 'Cartao Credito' },
  { value: 'DEBIT', label: 'Cartao Debito' },
]

function buildPaymentText(payment: { sale: { total: string | number; installmentPlan: number; createdAt: string; client: { name: string; phone: string | null } | null; items: Array<{ quantity: number; unitPrice: string | number; total: string | number; product: { name: string } }>; receivables: Array<{ installment: number; amount: string | number; paidAmount: string | number; status: string; dueDate: string }> } }): string {
  const { sale } = payment
  const lines: string[] = []
  lines.push('DANI COSMÉTICOS')
  lines.push('Controle de Parcelas')
  lines.push(`Cliente: ${sale.client?.name || 'Não informado'}`)
  lines.push(`Data da venda: ${formatDate(new Date(sale.createdAt))}`)
  lines.push(`Total da venda: ${formatCurrency(Number(sale.total))}`)
  if (sale.installmentPlan > 1) lines.push(`Plano: ${sale.installmentPlan}x`)
  lines.push('')
  lines.push('Itens:')
  for (const item of sale.items) {
    lines.push(`  ${item.product.name} x${item.quantity} — ${formatCurrency(Number(item.total))}`)
  }
  lines.push('')
  const sorted = [...sale.receivables].sort((a, b) => a.installment - b.installment)
  lines.push(`Parcelas (${sorted.length}x):`)
  for (const r of sorted) {
    const isPaid = r.status === 'PAID'
    const isOverdue = !isPaid && new Date(r.dueDate) < new Date()
    const remaining = Number(r.amount) - Number(r.paidAmount)
    const statusText = isPaid ? 'Pago' : isOverdue ? 'ATRASADO' : 'Pendente'
    lines.push(`  ${r.installment}ª - ${formatDate(new Date(r.dueDate))} — ${formatCurrency(Number(r.amount))} | Pago: ${formatCurrency(Number(r.paidAmount))} | Resta: ${formatCurrency(remaining)} | ${statusText}`)
  }
  const totalPaid = sorted.reduce((sum, r) => sum + Number(r.paidAmount), 0)
  const totalRemaining = sorted.reduce((sum, r) => sum + Number(r.amount), 0) - totalPaid
  lines.push('')
  lines.push(`Total Pago: ${formatCurrency(totalPaid)}`)
  lines.push(`Restante: ${formatCurrency(totalRemaining)}`)
  return lines.join('\n')
}

export default function PagamentosPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [copiedPaymentId, setCopiedPaymentId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PaymentData | null>(null)
  const [editTarget, setEditTarget] = useState<PaymentData | null>(null)
  const [editAmount, setEditAmount] = useState(0)
  const [editMethod, setEditMethod] = useState<string>('PIX')
  const [editPaidAt, setEditPaidAt] = useState('')
  const { toast } = useToast()
  const deletePayment = useDeletePayment()
  const editPayment = useEditPayment()

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const { filters, setFilter, resetFilters } = useFilters({
    initialValues: {
      period: 'month',
      clientId: '',
      method: '',
    },
  })

  const dateRange = getDateRange(filters.period)

  const { data: clientsData } = useClients({ limit: 200 })
  const clientOptions = useMemo(
    () => clientsData?.data?.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })) || [],
    [clientsData]
  )

  const { data, isLoading, error } = usePayments({
    clientId: filters.clientId || undefined,
    method: filters.method || undefined,
    startDate: dateRange.startDate || undefined,
    endDate: dateRange.endDate || undefined,
    page: currentPage,
    limit: 20,
  })

  const payments = useMemo(() => data?.data || [], [data])
  const pagination = data?.pagination
  const totalPages = pagination?.totalPages || 1

  useEffect(() => {
    setCurrentPage(1)
  }, [filters.period, filters.clientId, filters.method])

  const filterConfigs: FilterConfig[] = [
    { type: 'toggle', name: 'period', toggleOptions: periodOptions },
    { type: 'select', name: 'clientId', label: 'Cliente', options: clientOptions },
    { type: 'select', name: 'method', label: 'Pagamento', options: paymentMethodOptions },
  ]

  const handleFilterChange = useCallback(
    (name: string, value: string) => {
      setFilter(name as keyof typeof filters, value)
    },
    [setFilter]
  )

  const totalReceived = useMemo(() => {
    return payments.reduce((sum: number, p: { amount: string | number }) => sum + Number(p.amount), 0)
  }, [payments])

  const filtersBar = (
    <FilterBar
      filters={filterConfigs}
      values={filters}
      onChange={handleFilterChange}
      onReset={resetFilters}
    />
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pagamentos" description="Historico de pagamentos recebidos" />
        <Card>
          <CardContent className="p-6">
            {filtersBar}
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Pagamentos" description="Historico de pagamentos recebidos" />
        <Card>
          <CardContent className="p-6">
            {filtersBar}
            <div className="text-center py-8 text-destructive">Erro ao carregar pagamentos</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pagamentos" description="Historico de pagamentos recebidos" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/40">
                <Banknote className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total recebido no periodo</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(totalReceived)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/40">
                <Banknote className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagamentos registrados</p>
                <p className="text-xl font-bold">{pagination?.total ?? payments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          {filtersBar}

          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Banknote className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum pagamento encontrado
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Ajuste os filtros para ver pagamentos em outro periodo
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="text-center">Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => {
                    const feeAmount = Number(payment.feeAmount)
                    const hasFee = feeAmount > 0
                    const isExpanded = expandedIds.has(payment.id)
                    const sale = payment.sale
                    const items = sale?.items
                    const receivables = sale?.receivables
                    return (
                      <>
                      <TableRow key={payment.id} className="transition-colors duration-150 hover:bg-muted/50 cursor-pointer" onClick={() => toggleExpanded(payment.id)}>
                        <TableCell>{formatDate(new Date(payment.paidAt))}</TableCell>
                        <TableCell>
                          {payment.sale?.client?.name || (
                            <span className="text-muted-foreground">Nao informado</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {PAYMENT_METHOD_LABELS[payment.method as keyof typeof PAYMENT_METHOD_LABELS] || payment.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(Number(payment.amount))}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasFee ? (
                            <span className="text-amber-600 dark:text-amber-400 text-sm">
                              {formatCurrency(feeAmount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Badge
                              variant={payment.sale?.status === 'COMPLETED' ? 'default' : 'secondary'}
                            >
                              {payment.sale?.status === 'COMPLETED' ? 'Concluida' : 'Fiado'}
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${payment.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={6} className="p-0">
                            <div className="px-6 py-4 space-y-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    try {
                                      await navigator.clipboard.writeText(buildPaymentText(payment))
                                      setCopiedPaymentId(payment.id)
                                      toast({ title: 'Copiado!', description: 'Dados das parcelas copiados.' })
                                      setTimeout(() => setCopiedPaymentId(null), 2000)
                                    } catch {
                                      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' })
                                    }
                                  }}
                                  title="Copiar parcelas"
                                >
                                  {copiedPaymentId === payment.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                  {copiedPaymentId === payment.id ? 'Copiado!' : 'Copiar'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={(e) => { e.stopPropagation(); printPaymentInstallments(payment); }}
                                  title="Imprimir parcelas"
                                >
                                  <Printer className="h-4 w-4" />
                                  Imprimir
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditTarget(payment)
                                    setEditAmount(Number(payment.amount))
                                    setEditMethod(payment.method)
                                    setEditPaidAt(new Date(payment.paidAt).toISOString().split('T')[0])
                                  }}
                                  title="Editar pagamento"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-destructive hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(payment); }}
                                  title="Excluir pagamento"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Total da venda: </span>
                                  <span className="font-medium">{formatCurrency(Number(sale?.total ?? 0))}</span>
                                </div>
                                                                {(sale?.installmentPlan ?? 0) > 1 && (
                                                                  <div>
                                                                    <span className="text-muted-foreground">Parcelas: </span>
                                                                    <span className="font-medium">{sale?.installmentPlan}x</span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-muted-foreground">Data da venda: </span>
                                  <span className="font-medium">{sale?.createdAt ? formatDate(new Date(sale.createdAt)) : '-'}</span>
                                </div>
                              </div>

                              {items && items.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Itens da venda</p>
                                  <div className="space-y-1">
                                    {items.map((item) => (
                                      <div key={item.id} className="flex items-center justify-between text-sm py-0.5">
                                        <span className="font-medium truncate">{item.product.name}</span>
                                        <span className="text-muted-foreground shrink-0 ml-4">
                                          {item.quantity}x {formatCurrency(Number(item.unitPrice))} = {formatCurrency(Number(item.total))}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {receivables && receivables.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Parcelas</p>
                                  <div className="space-y-1">
                                    {receivables.map((r) => {
                                      const remaining = Number(r.amount) - Number(r.paidAmount)
                                      return (
                                        <div key={r.id} className="flex items-center justify-between text-sm py-0.5">
                                          <div className="flex items-center gap-2">
                                            <span>{r.installment}a parcela</span>
                                            <Badge variant={r.status === 'PAID' ? 'default' : r.status === 'PARTIAL' ? 'secondary' : 'outline'} className="text-xs">
                                              {r.status === 'PAID' ? 'Paga' : r.status === 'PARTIAL' ? 'Parcial' : 'Pendente'}
                                            </Badge>
                                          </div>
                                          <div className="flex items-center gap-3 text-muted-foreground">
                                            <span>Venc: {formatDate(new Date(r.dueDate))}</span>
                                            <span className="font-medium text-foreground">
                                              {formatCurrency(Number(r.paidAmount))} / {formatCurrency(Number(r.amount))}
                                            </span>
                                            {remaining > 0.01 && (
                                              <span className="text-amber-600 dark:text-amber-400">
                                                Falta {formatCurrency(remaining)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4 mt-4">
                  <span className="text-sm text-muted-foreground">
                    {pagination?.total} pagamento{(pagination?.total ?? 0) !== 1 ? 's' : ''} &middot; Pagina {currentPage} de {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
