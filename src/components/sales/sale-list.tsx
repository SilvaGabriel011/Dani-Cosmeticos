'use client'

import { XCircle, Banknote, ShoppingBag, AlertTriangle, MessageCircle } from 'lucide-react'
import { useMemo, useState, useCallback, memo } from 'react'

import { ReceivePaymentDialog } from '@/components/sales/receive-payment-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useToast } from '@/components/ui/use-toast'
import { useCategories } from '@/hooks/use-categories'
import { useFilters } from '@/hooks/use-filters'
import { useProducts } from '@/hooks/use-products'
import { useSales, useCancelSale } from '@/hooks/use-sales'
import { SALE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { formatCurrency, formatDate, getDateRange, formatWhatsAppUrl } from '@/lib/utils'
import { type Sale } from '@/types'

const periodOptions = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: '7 dias' },
  { value: 'month', label: 'Mês' },
  { value: 'all', label: 'Todas' },
]

const statusOptions = [
  { value: 'COMPLETED', label: 'Concluída' },
  { value: 'PENDING', label: 'Fiado' },
]

const paymentOptions = [
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'CREDIT', label: 'Cartão Crédito' },
  { value: 'DEBIT', label: 'Cartão Débito' },
]

export type SaleTab = 'todas' | 'fiado' | 'concluidas'

interface SaleListProps {
  tab?: SaleTab
}

export const SaleList = memo(function SaleList({ tab = 'todas' }: SaleListProps) {
  const { toast } = useToast()
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null)
  const [cancelSaleId, setCancelSaleId] = useState<string | null>(null)

  const { filters, setFilter, resetFilters } = useFilters({
    initialValues: {
      period: 'month',
      status: '',
      categoryId: '',
      productId: '',
      paymentMethod: '',
    },
  })

  const dateRange = getDateRange(filters.period)

  const { data: categoriesData } = useCategories()
  const { data: productsData } = useProducts({ limit: 20 })

  const categoryOptions = useMemo(
    () => categoriesData?.map((c) => ({ value: c.id, label: c.name })) || [],
    [categoriesData]
  )

  const productOptions = useMemo(
    () => productsData?.data.map((p) => ({ value: p.id, label: p.name })) || [],
    [productsData]
  )

  const filterConfigs: FilterConfig[] = [
    { type: 'toggle', name: 'period', toggleOptions: periodOptions },
    ...(tab === 'todas' ? [{ type: 'select' as const, name: 'status', label: 'Status', options: statusOptions }] : []),
    { type: 'select', name: 'categoryId', label: 'Categoria', options: categoryOptions },
    { type: 'select', name: 'productId', label: 'Produto', options: productOptions },
    { type: 'select', name: 'paymentMethod', label: 'Pagamento', options: paymentOptions },
  ]

  const tabStatus = tab === 'fiado' ? 'PENDING' : tab === 'concluidas' ? 'COMPLETED' : undefined

  const { data, isLoading, error } = useSales({
    status: (tabStatus || filters.status) as 'COMPLETED' | 'PENDING' | '' | undefined,
    categoryId: filters.categoryId || undefined,
    productId: filters.productId || undefined,
    paymentMethod: filters.paymentMethod || undefined,
    startDate: dateRange.startDate || undefined,
    endDate: dateRange.endDate || undefined,
  })

  const cancelSale = useCancelSale()

  const handleCancelConfirm = async () => {
    if (!cancelSaleId) return
    try {
      await cancelSale.mutateAsync(cancelSaleId)
      toast({ title: 'Venda cancelada com sucesso!' })
    } catch (error: any) {
      toast({
        title: 'Erro ao cancelar',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setCancelSaleId(null)
    }
  }

  const handleFilterChange = useCallback(
    (name: string, value: string) => {
      setFilter(name as keyof typeof filters, value)
    },
    [setFilter]
  )

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
      <div className="space-y-4">
        {filtersBar}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        {filtersBar}
        <div className="text-center py-8 text-destructive">Erro ao carregar vendas</div>
      </div>
    )
  }

  if (!data?.data.length) {
    return (
      <div className="space-y-4">
        {filtersBar}
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="p-4 rounded-full bg-muted/50 mb-4">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Nenhuma venda encontrada
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Ajuste os filtros ou registre uma nova venda
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filtersBar}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Itens</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((sale) => (
            <TableRow key={sale.id} className="transition-colors duration-150 hover:bg-muted/50">
              <TableCell>{formatDate(new Date(sale.createdAt))}</TableCell>
              <TableCell>
                {sale.client?.name || <span className="text-muted-foreground">Não informado</span>}
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {sale.status === 'PENDING' && sale.payments.length === 0 ? (
                    <Badge variant="outline" className="text-sm">
                      Fiado{sale.installmentPlan > 1 ? ` · ${sale.installmentPlan}x` : ''}
                    </Badge>
                  ) : (
                    sale.payments.map((p, i) => (
                      <Badge key={i} variant="outline" className="text-sm">
                        {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}
                      </Badge>
                    ))
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(Number(sale.total))}
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant={
                    sale.status === 'COMPLETED'
                      ? 'default'
                      : sale.status === 'PENDING'
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {SALE_STATUS_LABELS[sale.status as keyof typeof SALE_STATUS_LABELS]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {sale.client?.phone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      title="Abrir WhatsApp"
                      className="h-10 w-10 transition-all duration-150 hover:bg-green-50 hover:text-green-700"
                      aria-label="Abrir WhatsApp"
                    >
                      <a
                        href={formatWhatsAppUrl(sale.client.phone) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-6 w-6 text-green-600" />
                      </a>
                    </Button>
                  )}
                  {sale.status === 'PENDING' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPaymentSale(sale)}
                      title="Receber pagamento"
                      className="h-10 w-10 transition-all duration-150 hover:bg-green-50 hover:text-green-700"
                      aria-label="Receber pagamento"
                    >
                      <Banknote className="h-6 w-6 text-green-600" />
                    </Button>
                  )}
                  {(sale.status === 'COMPLETED' || sale.status === 'PENDING') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCancelSaleId(sale.id)}
                      disabled={cancelSale.isPending}
                      title="Cancelar venda"
                      className="h-10 w-10 transition-all duration-150 hover:bg-red-50 hover:text-red-700"
                      aria-label="Cancelar venda"
                    >
                      <XCircle className="h-6 w-6 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ReceivePaymentDialog
        open={!!paymentSale}
        onOpenChange={(open) => !open && setPaymentSale(null)}
        sale={paymentSale}
      />

      <Dialog open={!!cancelSaleId} onOpenChange={(open) => !open && setCancelSaleId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle>Cancelar venda</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              Cancelar esta venda? O estoque será restaurado e a venda será removida permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelSaleId(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={cancelSale.isPending}
            >
              {cancelSale.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})
