'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { SaleForm } from '@/components/sales/sale-form'
import { SaleList } from '@/components/sales/sale-list'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function VendasPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader title="Vendas" description="Histórico de vendas">
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Venda
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-6">
          <SaleList />
        </CardContent>
      </Card>

      <SaleForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  )
}
