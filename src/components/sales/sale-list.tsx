"use client"

import { useMemo } from "react"
import { XCircle } from "lucide-react"
import { format, subDays, startOfMonth } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { FilterBar, FilterConfig } from "@/components/ui/filter-bar"
import { useSales, useCancelSale } from "@/hooks/use-sales"
import { useCategories } from "@/hooks/use-categories"
import { useProducts } from "@/hooks/use-products"
import { useFilters } from "@/hooks/use-filters"
import { formatCurrency, formatDate } from "@/lib/utils"
import { SALE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants"

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
  { value: "month", label: "Mês" },
  { value: "all", label: "Todas" },
]

const statusOptions = [
  { value: "COMPLETED", label: "Concluída" },
  { value: "CANCELLED", label: "Cancelada" },
]

const paymentOptions = [
  { value: "MONEY", label: "Dinheiro" },
  { value: "PIX", label: "PIX" },
  { value: "CREDIT_CARD", label: "Cartão Crédito" },
  { value: "DEBIT_CARD", label: "Cartão Débito" },
]

function getDateRange(period: string) {
  const today = new Date()
  switch (period) {
    case "today":
      return {
        startDate: format(today, "yyyy-MM-dd"),
        endDate: format(today, "yyyy-MM-dd"),
      }
    case "week":
      return {
        startDate: format(subDays(today, 7), "yyyy-MM-dd"),
        endDate: format(today, "yyyy-MM-dd"),
      }
    case "month":
      return {
        startDate: format(startOfMonth(today), "yyyy-MM-dd"),
        endDate: format(today, "yyyy-MM-dd"),
      }
    default:
      return { startDate: "", endDate: "" }
  }
}

export function SaleList() {
  const { toast } = useToast()

  const { filters, setFilter, resetFilters } = useFilters({
    initialValues: {
      period: "month",
      status: "",
      categoryId: "",
      productId: "",
      paymentMethod: "",
    },
  })

  const dateRange = getDateRange(filters.period)

  const { data: categoriesData } = useCategories()
  const { data: productsData } = useProducts({ limit: 100 })

  const categoryOptions = useMemo(
    () =>
      categoriesData?.map((c) => ({ value: c.id, label: c.name })) || [],
    [categoriesData]
  )

  const productOptions = useMemo(
    () =>
      productsData?.data.map((p) => ({ value: p.id, label: p.name })) || [],
    [productsData]
  )

  const filterConfigs: FilterConfig[] = [
    { type: "toggle", name: "period", toggleOptions: periodOptions },
    { type: "select", name: "status", label: "Status", options: statusOptions },
    { type: "select", name: "categoryId", label: "Categoria", options: categoryOptions },
    { type: "select", name: "productId", label: "Produto", options: productOptions },
    { type: "select", name: "paymentMethod", label: "Pagamento", options: paymentOptions },
  ]

  const { data, isLoading, error } = useSales({
    status: filters.status as "COMPLETED" | "CANCELLED" | "" | undefined,
    categoryId: filters.categoryId || undefined,
    productId: filters.productId || undefined,
    paymentMethod: filters.paymentMethod || undefined,
    startDate: dateRange.startDate || undefined,
    endDate: dateRange.endDate || undefined,
  })

  const cancelSale = useCancelSale()

  const handleCancel = async (saleId: string) => {
    if (!confirm("Cancelar esta venda? O estoque será restaurado.")) return
    try {
      await cancelSale.mutateAsync(saleId)
      toast({ title: "Venda cancelada com sucesso!" })
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const filtersBar = (
    <FilterBar
      filters={filterConfigs}
      values={filters}
      onChange={(name, value) => setFilter(name as keyof typeof filters, value)}
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
        <div className="text-center py-8 text-destructive">
          Erro ao carregar vendas
        </div>
      </div>
    )
  }

  if (!data?.data.length) {
    return (
      <div className="space-y-4">
        {filtersBar}
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma venda encontrada para os filtros selecionados
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
          <TableRow key={sale.id}>
            <TableCell>{formatDate(new Date(sale.createdAt))}</TableCell>
            <TableCell>
              {sale.client?.name || (
                <span className="text-muted-foreground">Não informado</span>
              )}
            </TableCell>
            <TableCell>
              <span className="text-sm">
                {sale.items.length} {sale.items.length === 1 ? "item" : "itens"}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {sale.payments.map((p, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(Number(sale.total))}
            </TableCell>
            <TableCell className="text-center">
              <Badge
                variant={sale.status === "COMPLETED" ? "default" : "destructive"}
              >
                {SALE_STATUS_LABELS[sale.status as keyof typeof SALE_STATUS_LABELS]}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {sale.status === "COMPLETED" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCancel(sale.id)}
                  disabled={cancelSale.isPending}
                >
                  <XCircle className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
    </div>
  )
}
