'use client'

import { Plus, Package } from 'lucide-react'
import { useState } from 'react'

import { FiadoTable } from '@/components/dashboard/fiado-table'
import { StockOverviewTable } from '@/components/dashboard/stock-overview-table'
import { PageHeader } from '@/components/layout/page-header'
import { ProductForm } from '@/components/products/product-form'
import { SaleForm } from '@/components/sales/sale-form'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const [saleFormOpen, setSaleFormOpen] = useState(false)
  const [productFormOpen, setProductFormOpen] = useState(false)

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

      <StockOverviewTable />

      <FiadoTable />

      <SaleForm open={saleFormOpen} onOpenChange={setSaleFormOpen} />
      <ProductForm open={productFormOpen} onOpenChange={setProductFormOpen} />
    </div>
  )
}
