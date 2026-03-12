'use client'

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Undo2,
  XCircle,
  Pencil,
} from 'lucide-react'
import { useState, useMemo, useCallback } from 'react'

import { SaleDiagnosticDialog } from '@/components/sales/sale-diagnostic-dialog'
import { SaleOverrideDialog } from '@/components/sales/sale-override-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { getIssueLabel } from '@/lib/issue-labels'
import { formatCurrency, formatDate } from '@/lib/utils'

interface HealthCheckIssue {
  type: 'error' | 'warning'
  code: string
  message: string
  acknowledged?: boolean
  acknowledgedAt?: string
}

interface HealthCheckResult {
  saleId: string
  saleIdShort: string
  clientName: string | null
  createdAt: string
  status: string
  total: number
  paidAmount: number
  issues: HealthCheckIssue[]
}

interface HealthCheckResponse {
  scannedSales: number
  salesWithIssues: number
  totalErrors: number
  totalWarnings: number
  health: 'healthy' | 'warning' | 'critical'
  results: HealthCheckResult[]
}

type IssueFilter = 'all' | 'errors' | 'warnings'
type StatusFilter = 'all' | 'COMPLETED' | 'PENDING'

export function AuditDashboard() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<HealthCheckResponse | null>(null)
  const [expandedSales, setExpandedSales] = useState<Record<string, boolean>>({})

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Dialogs
  const [diagnosticSaleId, setDiagnosticSaleId] = useState<string | null>(null)
  const [diagnosticOpen, setDiagnosticOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [overrideSaleData, setOverrideSaleData] = useState<any>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [loadingOverride, setLoadingOverride] = useState<string | null>(null)
  const [acknowledgingIssue, setAcknowledgingIssue] = useState<string | null>(null)

  const handleRunCheck = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/sales/health-check')
      if (!res.ok) throw new Error('Erro ao executar verificação')
      const result = (await res.json()) as HealthCheckResponse
      setData(result)
      setExpandedSales({})
    } catch (error) {
      console.error('Health check error:', error)
      toast({
        title: 'Erro na verificação',
        description: 'Não foi possível executar a verificação de saúde. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const toggleExpanded = (saleId: string) => {
    setExpandedSales((prev) => ({ ...prev, [saleId]: !prev[saleId] }))
  }

  const filteredResults = useMemo(() => {
    if (!data) return []
    return data.results.filter((sale) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchId = sale.saleIdShort.toLowerCase().includes(term)
        const matchClient = sale.clientName?.toLowerCase().includes(term)
        if (!matchId && !matchClient) return false
      }
      // Issue type filter
      if (issueFilter === 'errors' && !sale.issues.some((i) => i.type === 'error')) return false
      if (issueFilter === 'warnings' && !sale.issues.some((i) => i.type === 'warning')) return false
      // Status filter
      if (statusFilter !== 'all' && sale.status !== statusFilter) return false
      return true
    })
  }, [data, searchTerm, issueFilter, statusFilter])

  const handleOpenDiagnostic = (saleId: string) => {
    setDiagnosticSaleId(saleId)
    setDiagnosticOpen(true)
  }

  const handleOpenOverride = async (saleId: string) => {
    setLoadingOverride(saleId)
    try {
      const res = await fetch(`/api/sales/${saleId}`)
      if (!res.ok) throw new Error('Erro ao buscar venda')
      const saleData = await res.json()
      setOverrideSaleData(saleData)
      setOverrideOpen(true)
    } catch (error) {
      console.error('Error fetching sale for override:', error)
      toast({
        title: 'Erro ao carregar venda',
        description: 'Não foi possível carregar os dados da venda para edição.',
        variant: 'destructive',
      })
    } finally {
      setLoadingOverride(null)
    }
  }

  const handleAcknowledge = async (saleId: string, issueCode: string, isAcknowledged: boolean) => {
    const key = `${saleId}-${issueCode}`
    setAcknowledgingIssue(key)
    try {
      if (isAcknowledged) {
        // Remove acknowledge
        const res = await fetch(`/api/sales/${saleId}/acknowledge-issue?issueCode=${issueCode}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Erro ao remover reconhecimento')
      } else {
        // Add acknowledge
        const res = await fetch(`/api/sales/${saleId}/acknowledge-issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueCode }),
        })
        if (!res.ok) throw new Error('Erro ao reconhecer erro')
      }
      // Re-run health check to refresh data
      await handleRunCheck()
    } catch (error) {
      console.error('Error acknowledging issue:', error)
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setAcknowledgingIssue(null)
    }
  }

  // Auto-refresh: re-run health check after Super Edição dialog closes
  const handleOverrideOpenChange = (open: boolean) => {
    setOverrideOpen(open)
    if (!open && data) {
      // Dialog was closed — re-scan to reflect any changes
      handleRunCheck()
    }
  }

  return (
    <div className="space-y-6">
      {/* Scan Button */}
      <Button
        onClick={handleRunCheck}
        disabled={isLoading}
        size="lg"
        className="gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Escaneando vendas...
          </>
        ) : (
          <>
            <Search className="h-5 w-5" />
            {data ? 'Escanear Novamente' : 'Executar Verificação'}
          </>
        )}
      </Button>

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Vendas Escaneadas
                    </p>
                    <p className="text-2xl font-bold">{data.scannedSales}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Com Problemas
                    </p>
                    <p className="text-2xl font-bold">{data.salesWithIssues}</p>
                  </div>
                  <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Total de Erros
                    </p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {data.totalErrors}
                    </p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Total de Avisos
                    </p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {data.totalWarnings}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Health Status Banner */}
          <div className="rounded-lg border p-4 flex items-center gap-4">
            {data.health === 'healthy' && (
              <>
                <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-600 dark:text-green-400">
                    Sistema Saudável
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Nenhuma inconsistência detectada em {data.scannedSales} vendas
                  </p>
                </div>
              </>
            )}
            {data.health === 'warning' && (
              <>
                <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-600 dark:text-amber-400">
                    Avisos Detectados
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.totalWarnings} aviso(s) encontrado(s) em {data.salesWithIssues} venda(s)
                  </p>
                </div>
              </>
            )}
            {data.health === 'critical' && (
              <>
                <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-600 dark:text-red-400">
                    Erros Críticos
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.totalErrors} erro(s) e {data.totalWarnings} aviso(s) em {data.salesWithIssues} venda(s)
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Filters */}
          {data.results.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID ou cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={issueFilter}
                onValueChange={(v) => setIssueFilter(v as IssueFilter)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tipo de problema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os problemas</SelectItem>
                  <SelectItem value="errors">Somente erros</SelectItem>
                  <SelectItem value="warnings">Somente avisos</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status da venda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="PENDING">Pendente (Fiado)</SelectItem>
                  <SelectItem value="COMPLETED">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Results List */}
          {filteredResults.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  Vendas com Problemas
                  {filteredResults.length !== data.results.length && (
                    <span className="text-muted-foreground font-normal ml-2">
                      ({filteredResults.length} de {data.results.length})
                    </span>
                  )}
                </h3>
              </div>

              <div className="space-y-2">
                {filteredResults.map((sale) => {
                  const errorCount = sale.issues.filter((i) => i.type === 'error').length
                  const warningCount = sale.issues.filter((i) => i.type === 'warning').length

                  return (
                    <Card
                      key={sale.saleId}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      {/* Card Header */}
                      <div
                        onClick={() => toggleExpanded(sale.saleId)}
                        className="p-4 flex items-center gap-3 cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold">
                              #{sale.saleIdShort}
                            </span>
                            {sale.clientName && (
                              <span className="text-sm text-muted-foreground">
                                {sale.clientName}
                              </span>
                            )}
                            <span className="text-sm font-mono">
                              {formatCurrency(sale.total)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {sale.status === 'PENDING' ? 'Fiado' : sale.status === 'COMPLETED' ? 'Concluída' : sale.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                            <span>{formatDate(sale.createdAt)}</span>
                            <span>Pago: {formatCurrency(sale.paidAmount)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {errorCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {errorCount} erro{errorCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          {warningCount > 0 && (
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              {warningCount} aviso{warningCount !== 1 ? 's' : ''}
                            </Badge>
                          )}

                          {/* Action Buttons - always visible */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenDiagnostic(sale.saleId)
                            }}
                          >
                            <Search className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Raio-X</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 h-7 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-950/30"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenOverride(sale.saleId)
                            }}
                            disabled={loadingOverride === sale.saleId}
                          >
                            {loadingOverride === sale.saleId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Pencil className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">Editar</span>
                          </Button>

                          {expandedSales[sale.saleId] ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {expandedSales[sale.saleId] && (
                        <CardContent className="px-4 pb-4 pt-0 space-y-4">
                          {/* Issues */}
                          <div className="space-y-2 border-t pt-4">
                            {sale.issues.map((issue, idx) => {
                              const issueKey = `${sale.saleId}-${issue.code}`
                              return (
                                <div
                                  key={idx}
                                  className={`rounded p-3 flex gap-3 transition-opacity ${
                                    issue.acknowledged
                                      ? 'border border-muted bg-muted/30 opacity-60'
                                      : issue.type === 'error'
                                        ? 'border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                                        : 'border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                                  }`}
                                >
                                  <div className="flex-shrink-0 mt-0.5">
                                    {issue.acknowledged ? (
                                      <CheckSquare className="h-4 w-4 text-muted-foreground" />
                                    ) : issue.type === 'error' ? (
                                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    ) : (
                                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className={`text-sm font-medium ${issue.acknowledged ? 'line-through text-muted-foreground' : ''}`}>
                                        {getIssueLabel(issue.code)}
                                      </p>
                                      {issue.acknowledged && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                          Reconhecido
                                        </Badge>
                                      )}
                                    </div>
                                    <p
                                      className={`text-xs ${
                                        issue.acknowledged
                                          ? 'text-muted-foreground'
                                          : issue.type === 'error'
                                            ? 'text-red-700 dark:text-red-300'
                                            : 'text-amber-700 dark:text-amber-300'
                                      }`}
                                    >
                                      {issue.message}
                                    </p>
                                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                      {issue.code}
                                    </p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={`shrink-0 h-7 text-xs gap-1 ${
                                      issue.acknowledged
                                        ? 'text-muted-foreground border-muted'
                                        : 'text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30'
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleAcknowledge(sale.saleId, issue.code, !!issue.acknowledged)
                                    }}
                                    disabled={acknowledgingIssue === issueKey}
                                  >
                                    {acknowledgingIssue === issueKey ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : issue.acknowledged ? (
                                      <>
                                        <Undo2 className="h-3 w-3" />
                                        Desfazer
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="h-3 w-3" />
                                        Reconhecer
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )
                            })}
                          </div>

                        </CardContent>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          ) : data.results.length === 0 ? (
            <Card className="border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
              <CardContent className="pt-6 flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-700 dark:text-green-300">
                    Tudo OK!
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Nenhuma inconsistência detectada em nenhuma venda
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground text-sm">
                Nenhuma venda corresponde aos filtros selecionados
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Dialogs */}
      {diagnosticSaleId && (
        <SaleDiagnosticDialog
          saleId={diagnosticSaleId}
          open={diagnosticOpen}
          onOpenChange={setDiagnosticOpen}
        />
      )}

      {overrideSaleData && (
        <SaleOverrideDialog
          sale={overrideSaleData}
          open={overrideOpen}
          onOpenChange={handleOverrideOpenChange}
        />
      )}
    </div>
  )
}
