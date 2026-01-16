"use client"

import { useMemo } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartContainer } from "@/components/ui/chart-container"
import { PieChart } from "@/components/charts/pie-chart"
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
  useReportByPayment,
} from "@/hooks/use-reports"
import { formatCurrency, formatPercent, getDateRange } from "@/lib/utils"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants"

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
  const { data: paymentReport, isLoading: loadingPayments } = useReportByPayment(dateFilters)

  const topProductsData = useMemo(
    () =>
      productReport?.products.map((p) => ({
        name: p.productName.length > 15 ? p.productName.slice(0, 15) + "..." : p.productName,
        value: p.totalRevenue,
      })) || [],
    [productReport]
  )

  const paymentMethodsData = useMemo(
    () =>
      paymentReport?.methods.map((m) => ({
        name: PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] || m.method,
        value: m.totalAmount,
      })) || [],
    [paymentReport]
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

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartContainer title="Top Produtos (Receita)">
          {loadingProducts ? (
            <Skeleton className="h-[250px]" />
          ) : (
            <BarChart data={topProductsData} horizontal height={250} />
          )}
        </ChartContainer>

        <ChartContainer title="Formas de Pagamento">
          {loadingPayments ? (
            <Skeleton className="h-[250px]" />
          ) : (
            <PieChart data={paymentMethodsData} donut height={250} />
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
            <CardTitle>Formas de Pagamento (Detalhes)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPayments ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : !paymentReport?.methods?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma venda no período.
              </p>
            ) : (
              <div className="space-y-4">
                {paymentReport.methods.map((m) => (
                  <div key={m.method} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] || m.method}
                      </span>
                      <span>{formatCurrency(m.totalAmount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${m.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {m.percentage.toFixed(1)}%
                      </span>
                    </div>
                    {m.totalFees > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Taxas: -{formatCurrency(m.totalFees)} ({m.count} transações)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
