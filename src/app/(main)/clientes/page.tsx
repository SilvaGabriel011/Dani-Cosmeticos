"use client"

import { useState } from "react"
import { Plus, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import { ClientList } from "@/components/clients/client-list"
import { ClientForm } from "@/components/clients/client-form"
import { SaleForm } from "@/components/sales/sale-form"
import { ClientCSVImport } from "@/components/import/client-csv-import"
import { Client } from "@/types"

export default function ClientesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Cliente
          </Button>
        </div>
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

      <ClientCSVImport open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  )
}
