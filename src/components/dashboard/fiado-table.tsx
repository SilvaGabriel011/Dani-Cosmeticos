'use client'

import { type Receivable, type Sale, type Client } from '@prisma/client'
import { CreditCard, MessageCircle, Receipt, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSalesWithPendingReceivables } from '@/hooks/use-receivables'
import { formatCurrency, formatDate, formatWhatsAppUrl } from '@/lib/utils'

import { ReceivablePaymentModal } from './receivable-payment-modal'

type SaleWithReceivables = Sale & {
  client: Client | null
  receivables: Receivable[]
}

type ReceivableWithSale = Receivable & {
  sale: Sale & { client: Client | null }
}

interface SaleReceivableSummary {
  saleId: string
  clientName: string
  clientPhone: string | null
  totalInstallments: number
  paidInstallments: number
  totalAmount: number
  paidAmount: number
  installmentAmount: number | null
  nextDueDate: Date | null
  nextReceivable: ReceivableWithSale | null
  isOverdue: boolean
}

type FilterStatus = 'all' | 'overdue' | 'upcoming'

export function FiadoTable() {
  const { data: salesData, isLoading } = useSalesWithPendingReceivables(500)

  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableWithSale | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Process sales data to create summaries with correct installment counts
  const saleSummaries = useMemo(() => {
    if (!salesData) return []

    const sales = salesData as SaleWithReceivables[]
    const now = new Date()

    return sales
      .map((sale) => {
        const receivables = sale.receivables
        const totalInstallments = receivables.length
        const paidInstallments = receivables.filter((r) => r.status === 'PAID').length
        // Use sale.total for total amount (includes already paid + remaining)
        const totalAmount = Number(sale.total)
        // Use sale.paidAmount for what's been paid (more accurate than summing receivables)
        const paidAmount = Number(sale.paidAmount)

        // Find next unpaid receivable (earliest due date among pending/partial)
        const pendingReceivables = receivables
          .filter((r) => r.status === 'PENDING' || r.status === 'PARTIAL')
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

        const nextReceivable = pendingReceivables[0] || null
        const nextDueDate = nextReceivable ? new Date(nextReceivable.dueDate) : null
        const isOverdue = nextDueDate ? nextDueDate < now : false

        // Create a receivable with sale reference for the modal
        const nextReceivableWithSale: ReceivableWithSale | null = nextReceivable
          ? { ...nextReceivable, sale: { ...sale, client: sale.client } }
          : null

        const installmentAmount = sale.fixedInstallmentAmount
          ? Number(sale.fixedInstallmentAmount)
          : nextReceivable
            ? Number(nextReceivable.amount)
            : null

        return {
          saleId: sale.id,
          clientName: sale.client?.name || 'Cliente nao informado',
          clientPhone: sale.client?.phone || null,
          totalInstallments,
          paidInstallments,
          totalAmount,
          paidAmount,
          installmentAmount,
          nextDueDate,
          nextReceivable: nextReceivableWithSale,
          isOverdue,
        }
      })
      .sort((a, b) => {
        // Sort by next due date (overdue first, then by date)
        if (a.isOverdue && !b.isOverdue) return -1
        if (!a.isOverdue && b.isOverdue) return 1
        if (!a.nextDueDate) return 1
        if (!b.nextDueDate) return -1
        return a.nextDueDate.getTime() - b.nextDueDate.getTime()
      })
  }, [salesData])

  // Filter summaries based on search and status
  const filteredSummaries = useMemo(() => {
    return saleSummaries.filter((summary) => {
      // Search filter
      const matchesSearch =
        search === '' || summary.clientName.toLowerCase().includes(search.toLowerCase())

      // Status filter
      let matchesStatus = true
      if (statusFilter === 'overdue') {
        matchesStatus = summary.isOverdue
      } else if (statusFilter === 'upcoming') {
        matchesStatus = !summary.isOverdue
      }

      return matchesSearch && matchesStatus
    })
  }, [saleSummaries, search, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filteredSummaries.length / itemsPerPage)
  const paginatedSummaries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredSummaries.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredSummaries, currentPage, itemsPerPage])

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (value: FilterStatus) => {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  const handleAddPayment = (summary: SaleReceivableSummary) => {
    if (summary.nextReceivable) {
      setSelectedReceivable(summary.nextReceivable)
      setPaymentModalOpen(true)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-amber-500" />
            Vendas Fiado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px]" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-amber-500" />
            Vendas Fiado
            <Badge variant="secondary" className="ml-2">
              {filteredSummaries.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => handleStatusFilterChange(v as FilterStatus)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
                <SelectItem value="upcoming">Em dia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Parcelas</TableHead>
                  <TableHead className="text-right">Valor Pago</TableHead>
                  <TableHead className="text-right">Valor da Parcela</TableHead>
                  <TableHead className="text-right">Valor Restante</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Valor Total</TableHead>
                  <TableHead className="hidden md:table-cell">Progresso</TableHead>
                  <TableHead>Prox. Pagamento</TableHead>
                  <TableHead className="text-center">Acao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {saleSummaries.length === 0
                        ? 'Nenhuma venda fiado pendente.'
                        : 'Nenhum resultado encontrado para os filtros selecionados.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSummaries.map((summary) => (
                    <TableRow
                      key={summary.saleId}
                      className={summary.isOverdue ? 'bg-red-50/60 dark:bg-red-950/20' : ''}
                    >
                      <TableCell className="font-medium">{summary.clientName}</TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono">
                          {summary.paidInstallments}/{summary.totalInstallments}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(summary.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-amber-700">
                        {summary.installmentAmount
                          ? formatCurrency(summary.installmentAmount)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {formatCurrency(summary.totalAmount - summary.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium hidden md:table-cell">
                        {formatCurrency(summary.totalAmount)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="w-20">
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all"
                              style={{
                                width: `${Math.min((summary.paidAmount / summary.totalAmount) * 100, 100)}%`,
                              }}
                            />
                            {/* Marcadores de 25%, 50%, 75% */}
                            <div className="absolute inset-0 flex">
                              <div className="w-1/4 border-r border-gray-400/50" />
                              <div className="w-1/4 border-r border-gray-400/50" />
                              <div className="w-1/4 border-r border-gray-400/50" />
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {Math.round((summary.paidAmount / summary.totalAmount) * 100)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {summary.nextDueDate ? (
                          <div className="flex items-center gap-2">
                            <span className={summary.isOverdue ? 'text-destructive' : ''}>
                              {formatDate(summary.nextDueDate)}
                            </span>
                            {summary.isOverdue && (
                              <Badge variant="destructive" className="text-sm">
                                Vencido
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleAddPayment(summary)}
                            disabled={!summary.nextReceivable}
                            className="h-9 w-9"
                            title="Adicionar Pagamento"
                          >
                            <Receipt className="h-5 w-5" />
                          </Button>
                          {summary.clientPhone && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 p-0 text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                              asChild
                            >
                              <a
                                href={formatWhatsAppUrl(summary.clientPhone) || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir WhatsApp"
                              >
                                <MessageCircle className="h-5 w-5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(currentPage * itemsPerPage, filteredSummaries.length)} de{' '}
                {filteredSummaries.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="text-sm font-medium px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ReceivablePaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        receivable={selectedReceivable}
      />
    </>
  )
}
