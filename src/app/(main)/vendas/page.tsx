'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { SaleForm } from '@/components/sales/sale-form'
import { SaleList, type SaleTab } from '@/components/sales/sale-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSales } from '@/hooks/use-sales'

export default function VendasPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SaleTab>('todas')

  const { data: fiadoData } = useSales({ status: 'PENDING', limit: 1 })
  const fiadoCount = fiadoData?.pagination?.total ?? 0

  return (
    <div className="space-y-6">
      <PageHeader title="Vendas" description="Histórico de vendas">
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-5 w-5" />
          Nova Venda
        </Button>
      </PageHeader>

      <TooltipProvider>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SaleTab)}>
          <TabsList>
            <Tooltip>
              <TooltipTrigger asChild>
                <div><TabsTrigger value="todas">Todas</TabsTrigger></div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Exibe todas as vendas realizadas, independente do status de pagamento</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                <TabsTrigger value="fiado" className="gap-1.5">
                  Fiado
                  {fiadoCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700 text-xs px-1.5 py-0">
                      {fiadoCount}
                    </Badge>
                  )}
                </TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Vendas a prazo com pagamento pendente ou parcial</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                <TabsTrigger value="concluidas">
                  Concluídas
                </TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Vendas com pagamento totalmente finalizado</p>
              </TooltipContent>
            </Tooltip>
          </TabsList>

        <TabsContent value="todas">
          <Card>
            <CardContent className="p-6">
              <SaleList tab="todas" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fiado">
          <Card>
            <CardContent className="p-6">
              <SaleList tab="fiado" />
            </CardContent>
          </Card>
        </TabsContent>

          <TabsContent value="concluidas">
            <Card>
              <CardContent className="p-6">
                <SaleList tab="concluidas" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </TooltipProvider>

      <SaleForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  )
}
