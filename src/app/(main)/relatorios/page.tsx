"use client"

import { useMemo } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartContainer } from "@/components/ui/chart-container"
import { BarChart } from "@/components/charts/bar-chart"
import { FilterBar } from "@/components/ui/filter-bar"
import { useFilters } from "@/hooks/use-filters"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useReportSummary,
  useReportByProduct,
  useTopClientes,
  useCollection,
} from "@/hooks/use-reports"
import { formatCurrency, formatPercent, formatDate, getDateRange } from "@/lib/utils"
import { Wallet, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
  { value: "month", label: "Mês" },
]

export default function RelatoriosPage() {
  const { filters: filterState, setFilter } = useFilters({
    initialValues: { period: "month" },
  })

  const dateFilters = getDateRange(filterState.period)

  const { data: summary, isLoading: loadingSummary } = useReportSummary(dateFilters)
  const { data: productReport, isLoading: loadingProducts } = useReportByProduct({
    ...dateFilters,
    limit: 10,
  })
  const { data: topClientes, isLoading: loadingClientes } = useTopClientes({
    ...dateFilters,
    limit: 10,
  })
  const { data: collection, isLoading: loadingCollection } = useCollection({
    period: filterState.period as "today" | "week" | "month",
  })

  const topProductsData = useMemo(
    () =>
      productReport?.products.map((p) => ({
        name: p.productName.length > 15 ? p.productName.slice(0, 15) + "..." : p.productName,
        value: p.totalRevenue,
      })) || [],
    [productReport]
  )

  const topClientesData = useMemo(
    () =>
      topClientes?.map((c) => ({
        name: c.nome.length > 15 ? c.nome.slice(0, 15) + "..." : c.nome,
        value: c.totalCompras,
      })) || [],
    [topClientes]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description="Análise de vendas e desempenho"
      >
        <FilterBar
          filters={[
            { type: "toggle", name: "period", toggleOptions: periodOptions },
          ]}
          values={filterState}
          onChange={(name, value) => setFilter(name as keyof typeof filterState, value)}
        />
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loadingSummary ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Vendido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary?.totalRevenue || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary?.totalSales || 0} vendas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Lucro Bruto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary?.totalProfit || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Margem: {formatPercent(summary?.profitMargin || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Lucro Líquido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary?.netProfit || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Taxas: -{formatCurrency(summary?.totalFees || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ticket Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary?.averageTicket || 0)}
                </div>
                <p className="text-xs text-muted-foreground">por venda</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Arrecadação Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Arrecadação (Fluxo de Caixa Real)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Dinheiro que efetivamente entrou no período, incluindo pagamentos de vendas fiado
          </p>
        </CardHeader>
        <CardContent>
          {loadingCollection ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Total Arrecadado</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(collection?.totalCollection || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {collection?.paymentCount || 0} pagamentos
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Líquido (- taxas)</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(collection?.netCollection || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Taxas: -{formatCurrency(collection?.totalFees || 0)}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Média por Pagamento</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(collection?.averagePayment || 0)}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">vs Período Anterior</p>
                  <div className="flex items-center gap-2">
                    {collection?.comparison.trend === "up" ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : collection?.comparison.trend === "down" ? (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    ) : (
                      <Minus className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={cn(
                      "text-2xl font-bold",
                      collection?.comparison.trend === "up" && "text-green-600",
                      collection?.comparison.trend === "down" && "text-red-600"
                    )}>
                      {collection?.comparison.change ? (
                        `${collection.comparison.change > 0 ? "+" : ""}${collection.comparison.change.toFixed(1)}%`
                      ) : "0%"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Anterior: {formatCurrency(collection?.comparison.previousCollection || 0)}
                  </p>
                </div>
              </div>

              {/* Breakdown by payment method */}
              {collection?.byMethod && collection.byMethod.length > 0 && (
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium mb-3">Por Forma de Pagamento</p>
                  <div className="grid gap-2 md:grid-cols-4">
                    {collection.byMethod.map((method) => (
                      <div key={method.method} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <Badge variant="outline" className="mb-1">
                            {method.method === "CASH" ? "Dinheiro" :
                             method.method === "PIX" ? "PIX" :
                             method.method === "DEBIT" ? "Débito" :
                             method.method === "CREDIT" ? "Crédito" : method.method}
                          </Badge>
                          <p className="text-xs text-muted-foreground">{method.count} pagamentos</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(method.total)}</p>
                          <p className="text-xs text-muted-foreground">{method.percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartContainer title="Top Produtos (Receita)">
          {loadingProducts ? (
            <Skeleton className="h-[250px]" />
          ) : (
            <BarChart data={topProductsData} horizontal height={250} />
          )}
        </ChartContainer>

        <ChartContainer title="Top Clientes">
          {loadingClientes ? (
            <Skeleton className="h-[250px]" />
          ) : (
            <BarChart data={topClientesData} horizontal height={250} />
          )}
        </ChartContainer>
      </div>

      {/* Detail Tables */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Produtos (Detalhes)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProducts ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : !productReport?.products?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma venda no período.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productReport.products.map((p, i) => (
                    <TableRow key={p.productId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-6 h-6 p-0 justify-center">
                            {i + 1}
                          </Badge>
                          <span className="truncate max-w-[150px]">{p.productName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{p.quantitySold}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(p.totalRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Clientes (Detalhes)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingClientes ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : !topClientes?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma venda no período.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Compras</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClientes.map((c, i) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-6 h-6 p-0 justify-center">
                            {i + 1}
                          </Badge>
                          <span className="truncate max-w-[150px]">{c.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{c.quantidadeVendas}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(c.totalCompras)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
