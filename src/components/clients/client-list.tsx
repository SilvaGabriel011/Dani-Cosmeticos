'use client'

import { MessageCircle, Pencil, Receipt, Trash2, ShoppingCart, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useState, useMemo, useCallback, useEffect, memo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterBar, type FilterConfig } from '@/components/ui/filter-bar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { useClients, useDeleteClient } from '@/hooks/use-clients'
import { useFilters } from '@/hooks/use-filters'
import { formatPercent, formatWhatsAppUrl } from '@/lib/utils'
import { type Client } from '@/types'

import { ClientForm } from './client-form'
import { ClientPurchasesModal } from './client-purchases-modal'
import { ClientReceivablesPopover } from './client-receivables-popover'


const discountOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'with', label: 'Com Desconto' },
  { value: 'without', label: 'Sem Desconto' },
]

export type ClientTab = 'todos' | 'devedores' | 'sem-telefone'

interface ClientListProps {
  onNewSale?: (client: Client) => void
  tab?: ClientTab
}

const ITEMS_PER_PAGE = 20

export const ClientList = memo(function ClientList({ onNewSale, tab = 'todos' }: ClientListProps) {
  const { toast } = useToast()
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [purchasesClient, setPurchasesClient] = useState<Client | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const { filters, setFilter, resetFilters } = useFilters({
    initialValues: {
      search: '',
      discountFilter: 'all',
    },
  })

  const filterConfigs: FilterConfig[] = [
    { type: 'search', name: 'search', placeholder: 'Buscar cliente...' },
    { type: 'select', name: 'discountFilter', label: 'Desconto', options: discountOptions },
  ]

  const { data, isLoading, error } = useClients({
    limit: 0,
    search: filters.search || undefined,
    ...(tab === 'devedores' && { hasDebt: true }),
    ...(tab === 'sem-telefone' && { missingPhone: true }),
  })

  const filteredClients = useMemo(() => {
    if (!data?.data) return []
    let clients = data.data

    if (filters.discountFilter === 'with') {
      clients = clients.filter((c) => Number(c.discount) > 0)
    } else if (filters.discountFilter === 'without') {
      clients = clients.filter((c) => Number(c.discount) === 0)
    }

    return clients
  }, [data, filters.discountFilter])

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / ITEMS_PER_PAGE))
  const paginatedClients = useMemo(
    () => filteredClients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredClients, currentPage]
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [filters.search, filters.discountFilter, tab])

  const deleteClient = useDeleteClient()

  const handleDelete = async () => {
    if (!deletingClient) return
    try {
      await deleteClient.mutateAsync(deletingClient.id)
      toast({ title: 'Cliente excluído com sucesso!' })
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setDeletingClient(null)
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
        <div className="text-center py-8 text-destructive">Erro ao carregar clientes</div>
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
          {paginatedClients.map((client) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-1.5">
                  {client.name}
                  <ClientReceivablesPopover clientId={client.id} clientName={client.name} />
                </div>
              </TableCell>
              <TableCell>{client.phone}</TableCell>
              <TableCell className="max-w-[200px] truncate">{client.address}</TableCell>
              <TableCell className="text-center">
                {Number(client.discount) > 0 ? (
                  <Badge variant="secondary">{formatPercent(Number(client.discount))}</Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {client.phone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      title="Abrir WhatsApp"
                      className="h-10 w-10 transition-all duration-150 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-700"
                    >
                      <a
                        href={formatWhatsAppUrl(client.phone!) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-6 w-6 text-green-600" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPurchasesClient(client)}
                    title="Ver compras"
                    className="h-10 w-10 transition-all duration-150 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700"
                  >
                    <Receipt className="h-6 w-6 text-blue-600" />
                  </Button>
                  {onNewSale && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onNewSale(client)}
                      title="Nova venda"
                      className="h-10 w-10 transition-all duration-150 hover:bg-primary/10"
                    >
                      <ShoppingCart className="h-6 w-6 text-primary" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-10 w-10 transition-all duration-150" onClick={() => setEditingClient(client)}>
                    <Pencil className="h-6 w-6" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10 transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700" onClick={() => setDeletingClient(client)}>
                    <Trash2 className="h-6 w-6 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">
            {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''} &middot; Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ClientForm
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
        client={editingClient}
      />

      <ConfirmDialog
        open={!!deletingClient}
        onOpenChange={(open) => !open && setDeletingClient(null)}
        title="Excluir cliente"
        description={`Tem certeza que deseja excluir "${deletingClient?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />

      <ClientPurchasesModal
        open={!!purchasesClient}
        onOpenChange={(open) => !open && setPurchasesClient(null)}
        clientId={purchasesClient?.id || null}
        clientName={purchasesClient?.name || ''}
      />
    </div>
  )
})
