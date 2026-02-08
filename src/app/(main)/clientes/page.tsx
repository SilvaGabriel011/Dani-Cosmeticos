'use client'

import { Plus, Upload } from 'lucide-react'
import { useState } from 'react'

import { ClientForm } from '@/components/clients/client-form'
import { ClientList, type ClientTab } from '@/components/clients/client-list'
import { ClientCSVImport } from '@/components/import/client-csv-import'
import { PageHeader } from '@/components/layout/page-header'
import { SaleForm } from '@/components/sales/sale-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useClients } from '@/hooks/use-clients'
import { type Client } from '@/types'

export default function ClientesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [saleClientId, setSaleClientId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ClientTab>('todos')

  const { data: debtorsData } = useClients({ limit: 1, hasDebt: true })
  const { data: missingPhoneData } = useClients({ limit: 1, missingPhone: true })

  const devedoresCount = debtorsData?.pagination?.total ?? 0
  const semTelefoneCount = missingPhoneData?.pagination?.total ?? 0

  const handleNewSale = (client: Client) => {
    setSaleClientId(client.id)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" description="Gerencie seus clientes e histórico de compras">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-5 w-5" />
            Importar CSV
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-5 w-5" />
            Adicionar Cliente
          </Button>
        </div>
      </PageHeader>

      <TooltipProvider>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ClientTab)}>
          <TabsList>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="todos">Todos</TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Exibe todos os clientes cadastrados no sistema</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="devedores" className="gap-1.5">
                  Devedores
                  {devedoresCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700 text-xs px-1.5 py-0">
                      {devedoresCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Clientes com débitos pendentes ou parcelas em aberto</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="sem-telefone" className="gap-1.5">
                  Sem Telefone
                  {semTelefoneCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0">
                      {semTelefoneCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Clientes sem número de telefone cadastrado</p>
              </TooltipContent>
            </Tooltip>
          </TabsList>

        <TabsContent value="todos">
          <Card>
            <CardContent className="p-6">
              <ClientList onNewSale={handleNewSale} tab="todos" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devedores">
          <Card>
            <CardContent className="p-6">
              <ClientList onNewSale={handleNewSale} tab="devedores" />
            </CardContent>
          </Card>
        </TabsContent>

          <TabsContent value="sem-telefone">
            <Card>
              <CardContent className="p-6">
                <ClientList onNewSale={handleNewSale} tab="sem-telefone" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </TooltipProvider>

      <ClientForm open={isFormOpen} onOpenChange={setIsFormOpen} />

      <SaleForm
        open={!!saleClientId}
        onOpenChange={(open) => !open && setSaleClientId(null)}
        defaultClientId={saleClientId}
      />

      <ClientCSVImport open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  )
}
