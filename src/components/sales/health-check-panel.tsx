'use client'

import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { SaleDiagnosticDialog } from './sale-diagnostic-dialog'

interface HealthCheckIssue {
  type: 'error' | 'warning'
  code: string
  message: string
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

interface SaleCardState {
  [key: string]: boolean
}

export function HealthCheckPanel() {
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<HealthCheckResponse | null>(null)
  const [expandedSales, setExpandedSales] = useState<SaleCardState>({})
  const [diagnosticSaleId, setDiagnosticSaleId] = useState<string | null>(null)
  const [diagnosticOpen, setDiagnosticOpen] = useState(false)

  const handleRunCheck = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/sales/health-check', {
        method: 'GET',
      })
      if (!res.ok) {
        throw new Error('Erro ao executar verificação de saúde')
      }
      const result = (await res.json()) as HealthCheckResponse
      setData(result)
      setExpandedSales({})
    } catch (error) {
      console.error('Health check error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSaleExpanded = (saleId: string) => {
    setExpandedSales((prev) => ({
      ...prev,
      [saleId]: !prev[saleId],
    }))
  }

  const handleOpenDiagnostic = (saleId: string) => {
    setDiagnosticSaleId(saleId)
    setDiagnosticOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Button to run check */}
      <Button
        onClick={handleRunCheck}
        disabled={isLoading}
        size="lg"
        className="gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Escaneando...
          </>
        ) : (
          <>
            <Search className="h-5 w-5" />
            Executar Verificação
          </>
        )}
      </Button>

      {/* Results Summary */}
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

          {/* Health Status */}
          <div className="rounded-lg border p-4 flex items-center gap-4">
            {data.health === 'healthy' && (
              <>
                <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-600 dark:text-green-400">
                    Sistema Saudável
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Nenhuma inconsistência detectada
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
                    Existem inconsistências para revisar
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
                    Problemas graves encontrados que requerem atenção
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Sales with Issues List */}
          {data.results.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Vendas com Problemas</h3>
              <div className="space-y-2">
                {data.results.map((sale) => (
                  <Card
                    key={sale.saleId}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    {/* Card Header - Always Visible */}
                    <div
                      onClick={() => toggleSaleExpanded(sale.saleId)}
                      className="p-4 flex items-center gap-3"
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
                            {sale.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDate(sale.createdAt)}
                        </div>
                      </div>

                      {/* Issue Count Badge */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          variant={
                            sale.issues.some((i) => i.type === 'error')
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {sale.issues.length} problema
                          {sale.issues.length !== 1 ? 's' : ''}
                        </Badge>
                        {expandedSales[sale.saleId] ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedSales[sale.saleId] && (
                      <>
                        <CardContent className="px-4 pb-4 pt-0 space-y-4">
                          {/* Issues List */}
                          <div className="space-y-2 border-t pt-4">
                            {sale.issues.map((issue, idx) => (
                              <div
                                key={idx}
                                className={`rounded p-3 flex gap-3 ${
                                  issue.type === 'error'
                                    ? 'border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                                    : 'border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                                }`}
                              >
                                <div className="flex-shrink-0 mt-0.5">
                                  {issue.type === 'error' ? (
                                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-mono font-semibold text-muted-foreground">
                                    {issue.code}
                                  </p>
                                  <p
                                    className={`text-sm ${
                                      issue.type === 'error'
                                        ? 'text-red-800 dark:text-red-200'
                                        : 'text-amber-800 dark:text-amber-200'
                                    }`}
                                  >
                                    {issue.message}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 border-t pt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenDiagnostic(sale.saleId)}
                            >
                              Raio-X
                            </Button>
                          </div>
                        </CardContent>
                      </>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ) : (
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
          )}
        </>
      )}

      {/* Diagnostic Dialog */}
      {diagnosticSaleId && (
        <SaleDiagnosticDialog
          saleId={diagnosticSaleId}
          open={diagnosticOpen}
          onOpenChange={setDiagnosticOpen}
        />
      )}
    </div>
  )
}
