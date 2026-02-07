'use client'

import { Plus, Package, CreditCard } from 'lucide-react'
import { useState, useMemo } from 'react'

import { FiadoTable } from '@/components/dashboard/fiado-table'
import { StockOverviewTable } from '@/components/dashboard/stock-overview-table'
import { PageHeader } from '@/components/layout/page-header'
import { ProductForm } from '@/components/products/product-form'
import { SaleForm } from '@/components/sales/sale-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBackorders } from '@/hooks/use-backorders'
import { useProducts } from '@/hooks/use-products'
import { useSalesWithPendingReceivables } from '@/hooks/use-receivables'

type DashboardTab = 'estoque' | 'fiado'

export default function DashboardPage() {
  const [saleFormOpen, setSaleFormOpen] = useState(false)
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('fiado')

  const { data: backordersData } = useBackorders()
  const { data: productsData } = useProducts({ limit: 500 })
  const { data: salesData } = useSalesWithPendingReceivables(500)

  const stockAlertCount = useMemo(() => {
    if (!productsData?.data) return 0
    const lowStock = productsData.data.filter((p) => p.stock <= p.minStock).length
    const pendingBackorders = backordersData?.totalPendingItems || 0
    return lowStock + pendingBackorders
  }, [productsData, backordersData])

  const fiadoCount = useMemo(() => {
    if (!salesData) return 0
    return (salesData as unknown[]).length
  }, [salesData])

  const overdueCount = useMemo(() => {
    if (!salesData) return 0
    const now = new Date()
    return (salesData as { receivables: { status: string; dueDate: string }[] }[]).filter(
      (sale) =>
        sale.receivables.some(
          (r) =>
            (r.status === 'PENDING' || r.status === 'PARTIAL') &&
            new Date(r.dueDate) < now
        )
    ).length
  }, [salesData])

  return (
    <div className="space-y-6">
      <PageHeader title="Início" description="Ações rápidas e visão do dia-a-dia">
        <div className="flex gap-3">
          <Button size="lg" onClick={() => setSaleFormOpen(true)}>
            <Plus className="h-5 w-5 mr-2" />
            Nova Venda
          </Button>
          <Button size="lg" variant="outline" onClick={() => setProductFormOpen(true)}>
            <Package className="h-5 w-5 mr-2" />
            Novo Item
          </Button>
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTab)}>
        <TabsList className="h-14 p-1">
          <TabsTrigger value="fiado" className="gap-2 text-base px-6 py-3 h-12">
            <CreditCard className="h-5 w-5" />
            Fiado
            {overdueCount > 0 ? (
              <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700 text-sm px-2 py-0.5">
                {overdueCount} venc.
              </Badge>
            ) : fiadoCount > 0 ? (
              <Badge variant="secondary" className="ml-1 text-sm px-2 py-0.5">
                {fiadoCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="estoque" className="gap-2 text-base px-6 py-3 h-12">
            <Package className="h-5 w-5" />
            Estoque
            {stockAlertCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700 text-sm px-2 py-0.5">
                {stockAlertCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fiado">
          <FiadoTable />
        </TabsContent>

        <TabsContent value="estoque">
          <StockOverviewTable />
        </TabsContent>
      </Tabs>

      <SaleForm open={saleFormOpen} onOpenChange={setSaleFormOpen} />
      <ProductForm open={productFormOpen} onOpenChange={setProductFormOpen} />
    </div>
  )
}
