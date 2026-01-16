"use client"

import { useState, useMemo, useCallback, memo } from "react"
import { Pencil, Trash2, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { FilterBar, FilterConfig } from "@/components/ui/filter-bar"
import { useClients, useDeleteClient } from "@/hooks/use-clients"
import { useFilters } from "@/hooks/use-filters"
import { ClientForm } from "./client-form"
import { Client } from "@/types"
import { formatPercent } from "@/lib/utils"

const discountOptions = [
  { value: "all", label: "Todos" },
  { value: "with", label: "Com Desconto" },
  { value: "without", label: "Sem Desconto" },
]

interface ClientListProps {
  onNewSale?: (client: Client) => void
}

export const ClientList = memo(function ClientList({ onNewSale }: ClientListProps) {
  const { toast } = useToast()
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const { filters, setFilter, resetFilters } = useFilters({
    initialValues: {
      search: "",
      discountFilter: "all",
    },
  })

  const filterConfigs: FilterConfig[] = [
    { type: "search", name: "search", placeholder: "Buscar cliente..." },
    { type: "select", name: "discountFilter", label: "Desconto", options: discountOptions },
  ]

  const { data, isLoading, error } = useClients({
    search: filters.search || undefined,
  })

  const filteredClients = useMemo(() => {
    if (!data?.data) return []
    let clients = data.data

    if (filters.discountFilter === "with") {
      clients = clients.filter((c) => Number(c.discount) > 0)
    } else if (filters.discountFilter === "without") {
      clients = clients.filter((c) => Number(c.discount) === 0)
    }

    return clients
  }, [data, filters.discountFilter])

  const deleteClient = useDeleteClient()

  const handleDelete = async (client: Client) => {
    if (!confirm(`Excluir "${client.name}"?`)) return
    try {
      await deleteClient.mutateAsync(client.id)
      toast({ title: "Cliente excluído com sucesso!" })
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleFilterChange = useCallback(
    (name: string, value: string) => {
      setFilter(name as keyof typeof filters, value)
    },
    [setFilter]
  )

  const filtersBar = (
    <FilterBar
      filters={filterConfigs}
      values={filters}
      onChange={handleFilterChange}
      onReset={resetFilters}
    />
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {filtersBar}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        {filtersBar}
        <div className="text-center py-8 text-destructive">
          Erro ao carregar clientes
        </div>
      </div>
    )
  }

  if (!filteredClients.length) {
    return (
      <div className="space-y-4">
        {filtersBar}
        <div className="text-center py-8 text-muted-foreground">
          Nenhum cliente encontrado para os filtros selecionados
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filtersBar}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Endereço</TableHead>
            <TableHead className="text-center">Desconto</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredClients.map((client) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium">{client.name}</TableCell>
              <TableCell>{client.phone}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {client.address}
              </TableCell>
              <TableCell className="text-center">
                {Number(client.discount) > 0 ? (
                  <Badge variant="secondary">
                    {formatPercent(Number(client.discount))}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {onNewSale && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onNewSale(client)}
                      title="Nova venda"
                    >
                      <ShoppingCart className="h-4 w-4 text-primary" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingClient(client)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(client)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ClientForm
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
        client={editingClient}
      />
    </div>
  )
})
