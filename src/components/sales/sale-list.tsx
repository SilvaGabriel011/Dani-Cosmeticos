'use client'

import { XCircle, Banknote, ShoppingBag, AlertTriangle, MessageCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Printer, Copy, Check } from 'lucide-react'
import { useMemo, useState, useCallback, useEffect, memo } from 'react'

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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { printSaleReceipt } from '@/lib/print-sale'
import { formatCurrency, formatDate, getDateRange, buildSaleWhatsAppUrl, buildSaleWhatsAppMessage } from '@/lib/utils'
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

const ITEMS_PER_PAGE = 20

export const SaleList = memo(function SaleList({ tab = 'todas' }: SaleListProps) {
  const { toast } = useToast()
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null)
  const [cancelSaleId, setCancelSaleId] = useState<string | null>(null)
  const [expandedSaleIds, setExpandedSaleIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [copiedSaleId, setCopiedSaleId] = useState<string | null>(null)

  const toggleExpanded = useCallback((saleId: string) => {
    setExpandedSaleIds((prev) => {
      const next = new Set(prev)
      if (next.has(saleId)) {
        next.delete(saleId)
      } else {
        next.add(saleId)
      }
      return next
    })
  }, [])

  const { filters, setFilter, resetFilters } = useFilters({
    initialValues: {
      search: '',
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
    { type: 'search', name: 'search', placeholder: 'Buscar por cliente...' },
    { type: 'toggle', name: 'period', toggleOptions: periodOptions },
    ...(tab === 'todas' ? [{ type: 'select' as const, name: 'status', label: 'Status', options: statusOptions }] : []),
    { type: 'select', name: 'categoryId', label: 'Categoria', options: categoryOptions },
    { type: 'select', name: 'productId', label: 'Produto', options: productOptions },
    { type: 'select', name: 'paymentMethod', label: 'Pagamento', options: paymentOptions },
  ]

  const tabStatus = tab === 'fiado' ? 'PENDING' : tab === 'concluidas' ? 'COMPLETED' : undefined

  const { data, isLoading, error } = useSales({
    search: filters.search || undefined,
    status: (tabStatus || filters.status) as 'COMPLETED' | 'PENDING' | '' | undefined,
    categoryId: filters.categoryId || undefined,
    productId: filters.productId || undefined,
    paymentMethod: filters.paymentMethod || undefined,
    startDate: dateRange.startDate || undefined,
    endDate: dateRange.endDate || undefined,
  })

  const sales = useMemo(() => data?.data || [], [data])
  const totalPages = Math.max(1, Math.ceil(sales.length / ITEMS_PER_PAGE))
  const paginatedSales = useMemo(
    () => sales.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [sales, currentPage]
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [filters.search, filters.period, filters.status, filters.categoryId, filters.productId, filters.paymentMethod, tab])

  const cancelSale = useCancelSale()

  const handleCopyMessage = useCallback(async (sale: Sale) => {
    const message = buildSaleWhatsAppMessage(sale)
    await navigator.clipboard.writeText(message)
    setCopiedSaleId(sale.id)
    setTimeout(() => setCopiedSaleId(null), 2000)
  }, [])

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
          {paginatedSales.map((sale) => {
            const isExpanded = expandedSaleIds.has(sale.id)
            const saleItems = sale.items as unknown as Array<{
              id: string
              quantity: number
              unitPrice: number | string
              originalPrice: number | string | null
              total: number | string
              addedAt: string
              product: { id: string; name: string }
            }>

            // Group items by addedAt date for multiple carts
            const itemGroups = saleItems.reduce<
              Array<{ label: string; date: string; items: typeof saleItems }>
            >((groups, item) => {
              const dateKey = new Date(item.addedAt).toISOString().slice(0, 16)
              let group = groups.find((g) => g.date === dateKey)
              if (!group) {
                group = { label: '', date: dateKey, items: [] }
                groups.push(group)
              }
              group.items.push(item)
              return groups
            }, [])

            // Only label groups if there are multiple carts
            const hasMultipleCarts = itemGroups.length > 1
            if (hasMultipleCarts) {
              itemGroups.forEach((g, i) => {
                g.label = `Compra ${i + 1}`
              })
            }

            return (
            <>
            <TableRow key={sale.id} className="transition-colors duration-150 hover:bg-muted/50">
              <TableCell>{formatDate(new Date(sale.createdAt))}</TableCell>
              <TableCell>
                {sale.client?.name || <span className="text-muted-foreground">Não informado</span>}
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => toggleExpanded(sale.id)}
                  className="inline-flex items-center gap-1 text-sm hover:text-primary transition-colors cursor-pointer"
                >
                  {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  {sale.status === 'PENDING' && sale.payments.length === 0 ? (
                    <Badge variant="outline" className="text-sm">
                      Fiado{sale.installmentPlan > 1 ? ` · ${sale.installmentPlan}x` : ''}
                    </Badge>
                  ) : sale.payments.length > 0 ? (
                    <>
                      <Badge variant="outline" className="text-sm">
                        {PAYMENT_METHOD_LABELS[sale.payments[0].method as keyof typeof PAYMENT_METHOD_LABELS]}
                      </Badge>
                      {sale.payments.length > 1 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                              +{sale.payments.length - 1}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2" align="start">
                            <div className="space-y-1">
                              {sale.payments.slice(1).map((p, i) => (
                                <div key={i} className="flex items-center justify-between gap-4 text-sm px-1">
                                  <span>{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}</span>
                                  <span className="text-muted-foreground">{formatCurrency(Number(p.amount))}</span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </>
                  ) : null}
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
                  {sale.client?.phone && buildSaleWhatsAppUrl(sale) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      title="Enviar comprovante via WhatsApp"
                      className="h-10 w-10 transition-all duration-150 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-700"
                      aria-label="Enviar comprovante via WhatsApp"
                    >
                      <a
                        href={buildSaleWhatsAppUrl(sale)!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-6 w-6 text-green-600" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleCopyMessage(sale)}
                    title="Copiar mensagem do comprovante"
                    className="h-10 w-10 transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-label="Copiar mensagem"
                  >
                    {copiedSaleId === sale.id ? (
                      <Check className="h-6 w-6 text-green-600" />
                    ) : (
                      <Copy className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void printSaleReceipt(sale)}
                    title="Imprimir comprovante"
                    className="h-10 w-10 transition-all duration-150 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700"
                    aria-label="Imprimir comprovante"
                  >
                    <Printer className="h-6 w-6 text-blue-600" />
                  </Button>
                  {sale.status === 'PENDING' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPaymentSale(sale)}
                      title="Receber pagamento"
                      className="h-10 w-10 transition-all duration-150 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-700"
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
                      className="h-10 w-10 transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700"
                      aria-label="Cancelar venda"
                    >
                      <XCircle className="h-6 w-6 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
            {isExpanded && (
              <TableRow key={`${sale.id}-items`} className="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={7} className="p-0">
                  <div className="px-6 py-3">
                    {itemGroups.map((group, gi) => (
                      <div key={gi} className={gi > 0 ? 'mt-3 pt-3 border-t border-border/50' : ''}>
                        {hasMultipleCarts && (
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            {group.label} — {formatDate(new Date(group.date))}
                          </p>
                        )}
                        <div className="space-y-1">
                          {group.items.map((item) => {
                            const unitPrice = Number(item.unitPrice)
                            const originalPrice = item.originalPrice ? Number(item.originalPrice) : null
                            const hasDiscount = originalPrice && originalPrice > unitPrice
                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-sm py-1"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium truncate">{item.product.name}</span>
                                  <span className="text-muted-foreground shrink-0">
                                    {item.quantity}x {formatCurrency(unitPrice)}
                                  </span>
                                  {hasDiscount && (
                                    <span className="text-xs text-muted-foreground/60 line-through shrink-0">
                                      {formatCurrency(originalPrice)}
                                    </span>
                                  )}
                                </div>
                                <span className="font-medium shrink-0 ml-4">
                                  {formatCurrency(Number(item.total))}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
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
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">
            {sales.length} venda{sales.length !== 1 ? 's' : ''} &middot; Página {currentPage} de {totalPages}
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

      <ReceivePaymentDialog
        open={!!paymentSale}
        onOpenChange={(open) => !open && setPaymentSale(null)}
        sale={paymentSale}
      />

      <Dialog open={!!cancelSaleId} onOpenChange={(open) => !open && setCancelSaleId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
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
