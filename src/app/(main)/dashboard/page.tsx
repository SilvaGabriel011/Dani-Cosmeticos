'use client'

import { Plus, Package, CreditCard, Users, ShoppingCart } from 'lucide-react'
import { useState, useMemo } from 'react'

import { FiadoTable } from '@/components/dashboard/fiado-table'
import { StockOverviewTable } from '@/components/dashboard/stock-overview-table'
import { PageHeader } from '@/components/layout/page-header'
import { ClientForm } from '@/components/clients/client-form'
import { ProductForm } from '@/components/products/product-form'
import { SaleForm } from '@/components/sales/sale-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useBackorders } from '@/hooks/use-backorders'
import { useProductStats } from '@/hooks/use-products'
import { useSalesWithPendingReceivables } from '@/hooks/use-receivables'

type DashboardTab = 'estoque' | 'fiado'

export default function DashboardPage() {
  const [saleFormOpen, setSaleFormOpen] = useState(false)
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [clientFormOpen, setClientFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('fiado')

  const { data: backordersData } = useBackorders()
  const { data: productStats } = useProductStats()
  const { data: salesData } = useSalesWithPendingReceivables(500)

  const stockAlertCount = useMemo(() => {
    const lowStock = productStats?.lowStockCount || 0
    const pendingBackorders = backordersData?.totalPendingItems || 0
    return lowStock + pendingBackorders
  }, [productStats, backordersData])

  const fiadoCount = useMemo(() => {
    return salesData?.total || 0
  }, [salesData])

  const overdueCount = useMemo(() => {
    if (!salesData?.data) return 0
    const now = new Date()
    return (salesData.data as { receivables: { status: string; dueDate: string }[] }[]).filter(
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
        <div className="hidden md:flex gap-3">
          <Button size="lg" onClick={() => setSaleFormOpen(true)}>
            <Plus className="h-5 w-5 mr-2" />
            Nova Venda
          </Button>
          <Button size="lg" variant="outline" onClick={() => setProductFormOpen(true)}>
            <Package className="h-5 w-5 mr-2" />
            Novo Item
          </Button>
          <Button size="lg" variant="outline" onClick={() => setClientFormOpen(true)}>
            <Users className="h-5 w-5 mr-2" />
            Novo Cliente
          </Button>
        </div>
        <div className="flex md:hidden gap-2">
          <Button size="sm" variant="outline" onClick={() => setProductFormOpen(true)}>
            <Package className="h-4 w-4 mr-1" />
            Produto
          </Button>
          <Button size="sm" variant="outline" onClick={() => setClientFormOpen(true)}>
            <Users className="h-4 w-4 mr-1" />
            Cliente
          </Button>
        </div>
      </PageHeader>

      <TooltipProvider>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTab)}>
          <TabsList className="h-14 p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                <TabsTrigger value="fiado" className="gap-2 text-base px-6 py-3 h-12">
                  <CreditCard className="h-5 w-5" />
                  <span className="hidden sm:inline">Vendas a Prazo</span>
                  <span className="sm:hidden">Fiado</span>
                  {overdueCount > 0 ? (
                    <Badge variant="secondary" className="ml-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 text-sm px-2 py-0.5">
                      {overdueCount} <span className="hidden sm:inline">vencidas</span><span className="sm:hidden">venc.</span>
                    </Badge>
                  ) : fiadoCount > 0 ? (
                    <Badge variant="secondary" className="ml-1 text-sm px-2 py-0.5">
                      {fiadoCount}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Vendas a prazo com pagamentos pendentes. Destaca vendas com parcelas vencidas</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                <TabsTrigger value="estoque" className="gap-2 text-base px-6 py-3 h-12">
                  <Package className="h-5 w-5" />
                  Estoque
                  {stockAlertCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 text-sm px-2 py-0.5">
                      {stockAlertCount}
                    </Badge>
                  )}
                </TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Produtos com estoque baixo ou com pedidos pendentes aguardando reposição</p>
              </TooltipContent>
            </Tooltip>
          </TabsList>

        <TabsContent value="fiado">
          <FiadoTable />
        </TabsContent>

          <TabsContent value="estoque">
            <StockOverviewTable />
          </TabsContent>
        </Tabs>
      </TooltipProvider>

      {/* FAB - Mobile Nova Venda */}
      <button
        type="button"
        onClick={() => setSaleFormOpen(true)}
        className="md:hidden fixed right-4 bottom-20 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
        aria-label="Nova Venda"
      >
        <ShoppingCart className="h-6 w-6" />
      </button>

      <SaleForm open={saleFormOpen} onOpenChange={setSaleFormOpen} />
      <ProductForm open={productFormOpen} onOpenChange={setProductFormOpen} />
      <ClientForm open={clientFormOpen} onOpenChange={setClientFormOpen} />
    </div>
  )
}
