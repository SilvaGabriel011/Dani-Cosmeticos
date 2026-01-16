"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Pencil, ShoppingCart, Phone, MapPin, Percent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/page-header"
import { ClientForm } from "@/components/clients/client-form"
import { ClientReceivables } from "@/components/clients/client-receivables"
import { SaleForm } from "@/components/sales/sale-form"
import { useClient } from "@/hooks/use-clients"
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils"

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const { data: client, isLoading } = useClient(clientId)
  const [editOpen, setEditOpen] = useState(false)
  const [saleOpen, setSaleOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cliente não encontrado" />
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description="Detalhes e histórico do cliente"
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button onClick={() => setSaleOpen(true)}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Nova Venda
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="receivables">Contas a Receber</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{client.phone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Endereço</p>
                    <p className="font-medium">{client.address}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Percent className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Desconto Padrão</p>
                    {Number(client.discount) > 0 ? (
                      <Badge variant="secondary">
                        {formatPercent(Number(client.discount))}
                      </Badge>
                    ) : (
                      <p className="font-medium text-muted-foreground">Sem desconto</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-5 w-5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente desde</p>
                    <p className="font-medium">
                      {formatDate(new Date(client.createdAt))}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receivables">
          <ClientReceivables clientId={clientId} />
        </TabsContent>
      </Tabs>

      <ClientForm
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
      />

      <SaleForm
        open={saleOpen}
        onOpenChange={setSaleOpen}
        defaultClientId={clientId}
      />
    </div>
  )
}
