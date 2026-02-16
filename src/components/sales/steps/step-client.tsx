'use client'

import { Search, Loader2, AlertTriangle, UserPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'


import { formatCurrency } from '@/lib/utils'
import { useSaleFormContext } from '../sale-form-context'

export function StepClient() {
  const ctx = useSaleFormContext()

  return (
    <div className="space-y-4">
      <Card key={`client-${ctx.shakeKey}`} className={`transition-all duration-300 ${ctx.validationErrors.client ? 'border-2 border-red-400 shadow-sm shadow-red-100 dark:shadow-red-900/30 animate-shake' : ctx.selectedClient ? 'border-2 border-green-400 shadow-sm shadow-green-100 dark:shadow-green-900/30' : ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Cliente e Desconto</span>
            {ctx.clients.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {ctx.clients.length} clientes
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ctx.validationErrors.client && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {ctx.validationErrors.client}
            </div>
          )}
          <div className="space-y-2">
            <Label>Cliente {ctx.isFiado && <span className="text-destructive">*</span>}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={ctx.clientInputRef}
                placeholder={
                  ctx.clients.length > 0 ? 'Buscar cliente...' : 'Nenhum cliente cadastrado'
                }
                value={ctx.clientSearch}
                onChange={(e) => {
                  ctx.setClientSearch(e.target.value)
                  ctx.setClientId('')
                  ctx.setIsClientDropdownOpen(true)
                }}
                onFocus={() => ctx.setIsClientDropdownOpen(true)}
                onBlur={() => {
                  setTimeout(() => ctx.setIsClientDropdownOpen(false), 150)
                }}
                onKeyDown={ctx.handleClientKeyDown}
                className="pl-9 h-11 text-base"
              />
              {ctx.isClientDropdownOpen && !ctx.clientId && (
                <div ref={ctx.clientDropdownRef} className="absolute z-50 w-full mt-1 max-h-48 md:max-h-72 overflow-y-auto border rounded-md bg-popover text-popover-foreground shadow-lg">
                  {ctx.clientCompletions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b bg-muted/30">
                      {ctx.clientCompletions.map((word) => (
                        <button
                          key={word}
                          type="button"
                          className="text-sm bg-background hover:bg-muted text-muted-foreground rounded-full px-3 py-1 border transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            ctx.setClientSearch(ctx.applyCompletion(ctx.clientSearch, word))
                          }}
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  )}
                  {!ctx.clientSearch.trim() && ctx.recentClients.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/50">
                        Recentes
                      </div>
                      {ctx.recentClients.map((client) => (
                        <button
                          key={`recent-${client.id}`}
                          type="button"
                          className="w-full px-3 py-3 text-left text-sm min-h-[44px] hover:bg-primary/10 focus:outline-none active:bg-primary/20"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            ctx.setClientId(client.id)
                            ctx.setClientSearch(client.name)
                            ctx.setIsClientDropdownOpen(false)
                            ctx.addRecentClient(client.id)
                          }}
                        >
                          {client.name}
                        </button>
                      ))}
                      <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/50">
                        Todos
                      </div>
                    </>
                  )}
                  {ctx.filteredClients.length === 0 ? (
                    <div className="px-3 py-2">
                      <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
                      <button
                        type="button"
                        className="w-full mt-1 px-3 py-2.5 text-left text-sm min-h-[44px] hover:bg-blue-50 dark:hover:bg-blue-950/30 focus:outline-none active:bg-blue-100 dark:active:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-medium flex items-center gap-2 rounded-md"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          ctx.setShowQuickClient(true)
                          ctx.setQuickClientName(ctx.clientSearch.trim())
                          ctx.setIsClientDropdownOpen(false)
                        }}
                      >
                        <UserPlus className="h-4 w-4" />
                        Cadastrar &ldquo;{ctx.clientSearch.trim()}&rdquo;
                      </button>
                    </div>
                  ) : (
                    ctx.filteredClients.slice(0, 20).map((client, index) => (
                      <button
                        key={client.id}
                        type="button"
                        className={`w-full px-3 py-3 text-left text-sm min-h-[44px] focus:outline-none active:bg-primary/20 ${
                          index === ctx.highlightedClientIndex
                            ? 'bg-primary/10'
                            : 'hover:bg-primary/10'
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          ctx.setClientId(client.id)
                          ctx.setClientSearch(client.name)
                          ctx.setIsClientDropdownOpen(false)
                          ctx.addRecentClient(client.id)
                        }}
                      >
                        {client.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {ctx.showQuickClient ? (
            <div className="border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  Novo Cliente
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    ctx.setShowQuickClient(false)
                    ctx.setQuickClientName('')
                    ctx.setQuickClientPhone('')
                    ctx.setQuickClientAddress('')
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                placeholder="Nome do cliente *"
                value={ctx.quickClientName}
                onChange={(e) => ctx.setQuickClientName(e.target.value)}
                autoFocus
              />
              <Input
                placeholder="Telefone (opcional)"
                value={ctx.quickClientPhone}
                onChange={(e) => ctx.setQuickClientPhone(e.target.value)}
              />
              <Input
                placeholder="Endereco (opcional)"
                value={ctx.quickClientAddress}
                onChange={(e) => ctx.setQuickClientAddress(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
                onClick={ctx.handleQuickClient}
                disabled={ctx.createClientPending}
              >
                {ctx.createClientPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cadastrando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Cadastrar e Selecionar
                  </span>
                )}
              </Button>
            </div>
          ) : (
            !ctx.clientId && (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-800 dark:hover:text-blue-300"
                onClick={() => {
                  ctx.setShowQuickClient(true)
                  if (ctx.clientSearch.trim()) {
                    ctx.setQuickClientName(ctx.clientSearch.trim())
                  }
                }}
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Novo Cliente
              </Button>
            )
          )}

          {ctx.clientId && ctx.pendingSales.length > 0 && (
            <div className="space-y-3 p-3 border rounded-md border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Este cliente tem {ctx.pendingSales.length} conta(s) em aberto
              </p>
              <RadioGroup
                value={ctx.saleMode}
                onValueChange={(v) => {
                  ctx.setSaleMode(v as 'new' | 'existing')
                  if (v === 'new') {
                    ctx.setSelectedPendingSaleId('')
                  }
                }}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new" id="sale-mode-new" />
                  <Label htmlFor="sale-mode-new" className="cursor-pointer text-sm">
                    Criar nova conta/fatura
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="sale-mode-existing" />
                  <Label htmlFor="sale-mode-existing" className="cursor-pointer text-sm">
                    Adicionar na conta existente
                  </Label>
                </div>
              </RadioGroup>

              {ctx.saleMode === 'existing' && (
                <div className="space-y-2">
                  <Label className="text-sm">Selecione a conta</Label>
                  <Select
                    value={ctx.selectedPendingSaleId}
                    onValueChange={ctx.setSelectedPendingSaleId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {ctx.pendingSales.map((sale) => (
                        <SelectItem key={sale.id} value={sale.id}>
                          {formatCurrency(sale.total)} - {sale.installmentPlan}x de{' '}
                          {formatCurrency(
                            sale.fixedInstallmentAmount || sale.total / sale.installmentPlan
                          )}{' '}
                          - {sale.pendingReceivablesCount} parcelas restantes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Desconto (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={ctx.discountPercent}
              onChange={(e) => {
                ctx.setDiscountPercent(Number(e.target.value))
                ctx.setHasManualDiscount(true)
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
