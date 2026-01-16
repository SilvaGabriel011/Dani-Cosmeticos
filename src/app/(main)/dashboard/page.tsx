"use client"

import { useMemo } from "react"
import { format, subDays, startOfMonth } from "date-fns"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartContainer } from "@/components/ui/chart-container"
import { PieChart } from "@/components/charts/pie-chart"
import { BarChart } from "@/components/charts/bar-chart"
import { FilterBar } from "@/components/ui/filter-bar"
import { useFilters } from "@/hooks/use-filters"
import { DollarSign, Package, Users, TrendingUp, AlertTriangle } from "lucide-react"
import { useDashboard } from "@/hooks/use-dashboard"
import { useReportByProduct, useReportByPayment } from "@/hooks/use-reports"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants"

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
  { value: "month", label: "Mês" },
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
    default:
      return {
        startDate: format(startOfMonth(today), "yyyy-MM-dd"),
        endDate: format(today, "yyyy-MM-dd"),
      }
  }
}

export default function DashboardPage() {
  const { filters, setFilter } = useFilters({
    initialValues: { period: "month" },
  })

  const dateRange = getDateRange(filters.period)

  const { data, isLoading } = useDashboard()
  const { data: productReport } = useReportByProduct({ ...dateRange, limit: 5 })
  const { data: paymentReport } = useReportByPayment(dateRange)

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

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Visão geral do seu negócio" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Visão geral do seu negócio">
        <FilterBar
          filters={[
            { type: "toggle", name: "period", toggleOptions: periodOptions },
          ]}
          values={filters}
          onChange={(name, value) => setFilter(name as keyof typeof filters, value)}
        />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(Number(data?.sales.today.total || 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.sales.today.count || 0} vendas realizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(Number(data?.sales.month.total || 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.sales.month.count || 0} vendas no mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.products.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(Number(data?.products.stockValue || 0))} em estoque
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.clients.total || 0}</div>
            <p className="text-xs text-muted-foreground">clientes cadastrados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartContainer title="Top 5 Produtos">
          <BarChart data={topProductsData} horizontal height={250} />
        </ChartContainer>

        <ChartContainer title="Formas de Pagamento">
          <PieChart data={paymentMethodsData} donut height={250} />
        </ChartContainer>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimas Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.recentSales?.length ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma venda realizada ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentSales.map((sale: any) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {sale.client?.name || "Cliente não informado"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(new Date(sale.createdAt))}
                      </p>
                    </div>
                    <span className="font-medium">
                      {formatCurrency(Number(sale.total))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.lowStockProducts?.length ? (
              <p className="text-sm text-muted-foreground">
                Nenhum produto com estoque baixo.
              </p>
            ) : (
              <div className="space-y-3">
                {data.lowStockProducts.map((product: any) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{product.name}</span>
                    <Badge variant="destructive">{product.stock} un.</Badge>
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
