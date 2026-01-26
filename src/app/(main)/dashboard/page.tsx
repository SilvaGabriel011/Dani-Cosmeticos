'use client'

import { DollarSign, Users, TrendingUp, AlertTriangle, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { BarChart } from '@/components/charts/bar-chart'
import { PieChart as _PieChart } from '@/components/charts/pie-chart'
import { CollectionCard } from '@/components/dashboard/collection-card'
import { FiadoTable } from '@/components/dashboard/fiado-table'
import { ReceivablesCard } from '@/components/dashboard/receivables-card'
import { PageHeader } from '@/components/layout/page-header'
import { SaleForm } from '@/components/sales/sale-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer } from '@/components/ui/chart-container'
import { FilterBar } from '@/components/ui/filter-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboard } from '@/hooks/use-dashboard'
import { useFilters } from '@/hooks/use-filters'
import { useReportByProduct, useTopClientes } from '@/hooks/use-reports'
import { formatCurrency, formatDate, getDateRange } from '@/lib/utils'

const periodOptions = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: '7 dias' },
  { value: 'month', label: 'Mês' },
]

export default function DashboardPage() {
  const { filters, setFilter } = useFilters({
    initialValues: { period: 'month' },
  })

  const [saleFormOpen, setSaleFormOpen] = useState(false)

  const dateRange = getDateRange(filters.period)

  const { data, isLoading } = useDashboard()
  // Carregar reports apenas depois do dashboard para evitar sobrecarga
  const { data: productReport } = useReportByProduct({
    ...dateRange,
    limit: 5,
    enabled: !isLoading,
  })
  const { data: topClientes } = useTopClientes({
    ...dateRange,
    limit: 5,
    enabled: !isLoading,
  })

  const topProductsData = useMemo(
    () =>
      productReport?.products.map((p) => ({
        name: p.productName.length > 15 ? p.productName.slice(0, 15) + '...' : p.productName,
        value: p.totalRevenue,
      })) || [],
    [productReport]
  )

  const topClientesData = useMemo(
    () =>
      topClientes?.map((c) => ({
        name: c.nome.length > 15 ? c.nome.slice(0, 15) + '...' : c.nome,
        value: c.totalCompras,
      })) || [],
    [topClientes]
  )

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Início" description="Visão geral do seu negócio" />
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
      <PageHeader title="Início" description="Visão geral do seu negócio">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={() => setSaleFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Venda
          </Button>
          <FilterBar
            filters={[{ type: 'toggle', name: 'period', toggleOptions: periodOptions }]}
            values={filters}
            onChange={(name, value) => setFilter(name as keyof typeof filters, value)}
          />
        </div>
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

        <CollectionCard period={filters.period as 'today' | 'week' | 'month'} />

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

        <ChartContainer title="Top 5 Clientes">
          <BarChart data={topClientesData} horizontal height={250} />
        </ChartContainer>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Últimas Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.recentSales?.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda realizada ainda.</p>
            ) : (
              <div className="space-y-3">
                {data.recentSales.map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{sale.client?.name || 'Cliente não informado'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(new Date(sale.createdAt))}
                      </p>
                    </div>
                    <span className="font-medium">{formatCurrency(Number(sale.total))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <ReceivablesCard startDate={dateRange.startDate} endDate={dateRange.endDate} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.lowStockProducts?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum produto com estoque baixo.</p>
            ) : (
              <div className="space-y-3">
                {data.lowStockProducts.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{product.name}</span>
                    <Badge variant="destructive">{product.stock} un.</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FiadoTable />

      <SaleForm open={saleFormOpen} onOpenChange={setSaleFormOpen} />
    </div>
  )
}
