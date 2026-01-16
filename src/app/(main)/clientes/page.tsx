"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import { ClientList } from "@/components/clients/client-list"
import { ClientForm } from "@/components/clients/client-form"
import { SaleForm } from "@/components/sales/sale-form"
import { Client } from "@/types"

export default function ClientesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [saleClientId, setSaleClientId] = useState<string | null>(null)

  const handleNewSale = (client: Client) => {
    setSaleClientId(client.id)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gerencie seus clientes e histórico de compras"
      >
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Cliente
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-6">
          <ClientList onNewSale={handleNewSale} />
        </CardContent>
      </Card>

      <ClientForm open={isFormOpen} onOpenChange={setIsFormOpen} />
      
      <SaleForm
        open={!!saleClientId}
        onOpenChange={(open) => !open && setSaleClientId(null)}
        defaultClientId={saleClientId}
      />
    </div>
  )
}
