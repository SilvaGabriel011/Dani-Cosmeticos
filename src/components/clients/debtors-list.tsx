'use client'

import { Search, Users } from 'lucide-react'
import { useState } from 'react'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { useDebtors } from '@/hooks/use-debtors'
import { formatCurrency } from '@/lib/utils'

import { DebtorCard } from './debtor-card'

type SortOption = 'totalDebt' | 'overdueAmount' | 'oldestDueDate' | 'name'

export function DebtorsList() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('totalDebt')
  const debouncedSearch = useDebounce(search, 300)

  const { data: debtors, isLoading } = useDebtors({
    search: debouncedSearch,
    sortBy,
  })

  // Mostrar skeleton apenas no carregamento inicial (sem dados)
  const showSkeleton = isLoading && !debtors

  const totalDebt = debtors?.reduce((sum, d) => sum + d.totalDebt, 0) || 0
  const totalOverdue = debtors?.reduce((sum, d) => sum + d.overdueAmount, 0) || 0

  if (showSkeleton) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-5 w-5" />
            <span className="text-sm">Total de Devedores</span>
          </div>
          <p className="text-2xl font-bold mt-1">{debtors?.length || 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total a Receber</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 border-destructive/50">
          <p className="text-sm text-destructive">Total Vencido</p>
          <p className="text-2xl font-bold text-destructive mt-1">{formatCurrency(totalOverdue)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="totalDebt">Maior divida</SelectItem>
            <SelectItem value="overdueAmount">Maior valor vencido</SelectItem>
            <SelectItem value="oldestDueDate">Vencimento mais antigo</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {debtors && debtors.length > 0 ? (
        <div className="space-y-4">
          {debtors.map((debtor) => (
            <DebtorCard key={debtor.client.id} debtor={debtor} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-14 w-14 mx-auto mb-4 opacity-50" />
          <p>Nenhum cliente devedor encontrado.</p>
        </div>
      )}
    </div>
  )
}
