"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/layout/page-header"
import { ClientList } from "@/components/clients/client-list"
import { ClientForm } from "@/components/clients/client-form"

export default function ClientesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [search, setSearch] = useState("")

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
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ClientList search={search} />
        </CardContent>
      </Card>

      <ClientForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  )
}
