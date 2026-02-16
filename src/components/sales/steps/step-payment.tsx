'use client'

import { Plus, Trash2, Wallet, Handshake, AlertTriangle, CalendarDays } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { useSaleFormContext } from '../sale-form-context'

export function StepPayment() {
  const ctx = useSaleFormContext()

  const isExistingMode = ctx.saleMode === 'existing' && ctx.selectedPendingSaleId

  return (
    <div className="space-y-4">
      <Card key={`payment-${ctx.shakeKey}`} className={`transition-all duration-300 ${ctx.validationErrors.payment ? 'border-2 border-red-400 shadow-sm shadow-red-100 dark:shadow-red-900/30 animate-shake' : ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Forma de Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ctx.validationErrors.payment && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {ctx.validationErrors.payment}
            </div>
          )}

          <div className={`p-4 rounded-xl text-center border ${ctx.isFiadoMode ? 'bg-gradient-to-br from-amber-100 dark:from-amber-950/40 to-amber-50 dark:to-amber-950/20 border-amber-300 dark:border-amber-700' : 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20'}`}>
            <p className="text-sm text-muted-foreground font-medium">Total da compra</p>
            <p className={`text-3xl font-bold mt-1 ${ctx.isFiadoMode ? 'text-amber-700 dark:text-amber-400' : 'text-primary'}`}>{formatCurrency(ctx.total)}</p>
          </div>

          {!isExistingMode && (
            <div className="grid gap-3">
              <Button
                variant={!ctx.isFiadoMode ? 'default' : 'outline'}
                className={`h-auto py-4 px-5 justify-start transition-all duration-200 ${!ctx.isFiadoMode ? 'ring-2 ring-primary ring-offset-2' : 'hover:bg-primary/5'}`}
                onClick={() => {
                  ctx.setIsFiadoMode(false)
                  if (ctx.payments.length === 0) {
                    ctx.addPayment()
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-full ${!ctx.isFiadoMode ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-base">Pagar Agora</div>
                    <div className="text-sm opacity-70 font-normal">Dinheiro, PIX ou cartao</div>
                  </div>
                </div>
              </Button>

              <Button
                variant={ctx.isFiadoMode ? 'default' : 'outline'}
                className={`h-auto py-4 px-5 justify-start transition-all duration-200 ${ctx.isFiadoMode ? 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-background text-white' : 'hover:bg-amber-50 dark:hover:bg-amber-950/30'}`}
                onClick={() => {
                  ctx.setIsFiadoMode(true)
                  ctx.setPayments([])
                }}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-full ${ctx.isFiadoMode ? 'bg-white/20' : 'bg-muted'}`}>
                    <Handshake className="h-6 w-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-base">Fiado</div>
                    <div className="text-sm opacity-70 font-normal">Pagar depois em parcelas</div>
                  </div>
                </div>
              </Button>
            </div>
          )}

          {!isExistingMode && !ctx.isFiadoMode ? (
            <div className="bg-green-50/80 dark:bg-green-950/20 p-4 rounded-xl space-y-3 border border-green-200 dark:border-green-800">
              <p className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Forma de pagamento:
              </p>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={ctx.addPayment}>
                  <Plus className="h-5 w-5 mr-1" />
                  Adicionar Pagamento
                </Button>
              </div>
              {ctx.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhum pagamento adicionado
                </p>
              ) : (
                ctx.payments.map((payment, index) => (
                  <div key={index} className="space-y-2 p-3 border rounded-md bg-background">
                    <div className="flex gap-2">
                      <Select
                        value={payment.method}
                        onValueChange={(v) =>
                          ctx.updatePayment(index, { method: v as 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT' })
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payment.amount}
                        onChange={(e) =>
                          ctx.updatePayment(index, { amount: Number(e.target.value) })
                        }
                        className="w-28"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => ctx.removePayment(index)}
                      >
                        <Trash2 className="h-5 w-5 text-destructive" />
                      </Button>
                    </div>
                    {payment.method === 'CREDIT' && (
                      <Select
                        value={payment.installments.toString()}
                        onValueChange={(v) =>
                          ctx.updatePayment(index, { installments: Number(v) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                            <SelectItem key={n} value={n.toString()}>
                              {n}x {n === 1 ? 'a vista' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {payment.feePercent > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Taxa: {payment.feePercent}%
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : !isExistingMode ? (
            <div className="bg-amber-50/80 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
              <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-2">
                <Handshake className="h-5 w-5" />
                Fiado selecionado
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                <strong>{formatCurrency(ctx.total)}</strong> sera registrado como fiado.
              </p>
            </div>
          ) : null}

          {isExistingMode && (() => {
            const selectedSale = ctx.pendingSales.find((s) => s.id === ctx.selectedPendingSaleId)
            const currentInstallment = selectedSale?.fixedInstallmentAmount || (selectedSale ? selectedSale.total / selectedSale.installmentPlan : 0)
            const pendingCount = selectedSale?.pendingReceivablesCount || 0
            const receivables = selectedSale?.pendingReceivables || []
            const newRemaining = (selectedSale?.remaining || 0) + ctx.total
            const isAppendMode = ctx.existingMode === 'increase_installments'

            const untouchedTotal = (!isAppendMode && ctx.startFromInstallment)
              ? receivables.filter((r) => r.installment < ctx.startFromInstallment!).reduce((sum, r) => sum + r.amount, 0)
              : 0
            const amountToCover = isAppendMode ? ctx.total : (newRemaining - untouchedTotal)

            const defaultAppendCount = currentInstallment > 0 ? Math.max(1, Math.ceil(ctx.total / currentInstallment)) : 1
            const previewCount = isAppendMode
              ? (ctx.targetInstallmentCount || (ctx.targetInstallmentAmount && ctx.targetInstallmentAmount > 0 ? Math.max(1, Math.ceil(ctx.total / ctx.targetInstallmentAmount)) : defaultAppendCount))
              : (ctx.targetInstallmentCount || (ctx.targetInstallmentAmount && ctx.targetInstallmentAmount > 0 ? Math.max(1, Math.ceil(amountToCover / ctx.targetInstallmentAmount)) : pendingCount))
            const previewAmount = isAppendMode
              ? (ctx.targetInstallmentAmount || (ctx.targetInstallmentCount && ctx.targetInstallmentCount > 0 ? ctx.total / ctx.targetInstallmentCount : (previewCount > 0 ? ctx.total / previewCount : 0)))
              : (ctx.targetInstallmentAmount || (ctx.targetInstallmentCount && ctx.targetInstallmentCount > 0 ? amountToCover / ctx.targetInstallmentCount : (previewCount > 0 ? amountToCover / previewCount : 0)))

            const affectedStartInstallment = isAppendMode
              ? (receivables.length > 0 ? receivables[receivables.length - 1].installment + 1 : 1)
              : (ctx.startFromInstallment || (receivables.length > 0 ? receivables[0].installment : 1))

            return (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Configurar parcelas</Label>

                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Saldo restante atual</span>
                    <span className="font-medium">{formatCurrency(selectedSale?.remaining || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-muted-foreground">Novos itens</span>
                    <span className="font-medium">+ {formatCurrency(ctx.total)}</span>
                  </div>
                  <Separator className="my-1.5" />
                  <div className="flex justify-between text-sm font-semibold text-amber-800 dark:text-amber-300">
                    <span>Total a pagar</span>
                    <span>{formatCurrency(newRemaining)}</span>
                  </div>
                </div>

                <RadioGroup
                  value={isAppendMode ? 'append' : 'recalculate'}
                  onValueChange={(v) => {
                    ctx.setExistingMode(v === 'append' ? 'increase_installments' : 'recalculate')
                    ctx.setTargetInstallmentAmount(null)
                    ctx.setTargetInstallmentCount(null)
                    ctx.setLastEditedField(null)
                    ctx.setStartFromInstallment(null)
                  }}
                  className="space-y-1.5"
                >
                  <div className={`flex items-start space-x-2 p-2 rounded-md border transition-colors ${!isAppendMode ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700'}`}>
                    <RadioGroupItem value="recalculate" id="mode-recalculate" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="mode-recalculate" className="cursor-pointer text-xs font-medium">
                        Recalcular parcelas
                      </Label>
                      <p className="text-[10px] text-muted-foreground">Redistribui o total em novas parcelas</p>
                    </div>
                  </div>
                  <div className={`flex items-start space-x-2 p-2 rounded-md border transition-colors ${isAppendMode ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700'}`}>
                    <RadioGroupItem value="append" id="mode-append" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="mode-append" className="cursor-pointer text-xs font-medium">
                        Adicionar ao final
                      </Label>
                      <p className="text-[10px] text-muted-foreground">Mantem parcelas atuais, cria novas no fim</p>
                    </div>
                  </div>
                </RadioGroup>

                {!isAppendMode && receivables.length > 1 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">A partir de qual parcela? (opcional)</Label>
                    <Select
                      value={ctx.startFromInstallment?.toString() || 'all'}
                      onValueChange={(v) => ctx.setStartFromInstallment(v === 'all' ? null : Number(v))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todas as parcelas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as parcelas</SelectItem>
                        {receivables.map((r) => {
                          const dueDate = new Date(r.dueDate)
                          const monthName = dueDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                          return (
                            <SelectItem key={r.installment} value={r.installment.toString()}>
                              A partir da {r.installment}a - {monthName}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{isAppendMode ? 'Valor da nova parcela' : 'Valor por parcela'}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={previewAmount > 0 ? previewAmount.toFixed(2) : '0,00'}
                      value={ctx.targetInstallmentAmount ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null
                        ctx.setTargetInstallmentAmount(val && val > 0 ? val : null)
                        ctx.setLastEditedField('value')
                        if (val && val > 0) {
                          const newCount = Math.max(1, Math.ceil(amountToCover / val))
                          ctx.setTargetInstallmentCount(newCount)
                        }
                      }}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{isAppendMode ? 'Novas parcelas' : 'N. de parcelas'}</Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      placeholder={String(previewCount || pendingCount)}
                      value={ctx.targetInstallmentCount ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null
                        ctx.setTargetInstallmentCount(val && val > 0 ? Math.round(val) : null)
                        ctx.setLastEditedField('count')
                        if (val && val > 0) {
                          const newAmount = Math.max(0.01, amountToCover / Math.round(val))
                          ctx.setTargetInstallmentAmount(Number(newAmount.toFixed(2)))
                        }
                      }}
                      className="h-9"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-1">
                  Altere o valor ou o numero de parcelas. O outro campo sera recalculado automaticamente.
                </p>

                {previewCount > 0 && previewAmount > 0 && (
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2.5">
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1.5">
                      {isAppendMode ? 'Preview: parcelas atuais + ' : 'Preview: '}{previewCount}x de {formatCurrency(previewAmount)}
                    </p>
                    <div className="space-y-0.5">
                      {isAppendMode && receivables.map((r) => {
                        const dueDate = new Date(r.dueDate)
                        const monthName = dueDate.toLocaleDateString('pt-BR', { month: 'short' })
                        return (
                          <div key={r.installment} className="flex justify-between text-xs text-muted-foreground">
                            <span>{r.installment}a ({monthName})</span>
                            <span>{formatCurrency(r.amount)} (inalterada)</span>
                          </div>
                        )
                      })}
                      {!isAppendMode && ctx.startFromInstallment && receivables.filter((r) => r.installment < ctx.startFromInstallment!).map((r) => {
                        const dueDate = new Date(r.dueDate)
                        const monthName = dueDate.toLocaleDateString('pt-BR', { month: 'short' })
                        return (
                          <div key={r.installment} className="flex justify-between text-xs text-muted-foreground">
                            <span>{r.installment}a ({monthName})</span>
                            <span>{formatCurrency(r.amount)} (inalterada)</span>
                          </div>
                        )
                      })}
                      {Array.from({ length: previewCount }, (_, i) => {
                        const isLast = i === previewCount - 1
                        const amt = isLast
                          ? Math.max(0.01, amountToCover - previewAmount * (previewCount - 1))
                          : previewAmount
                        const instNum = affectedStartInstallment + i
                        return (
                          <div key={i} className="flex justify-between text-xs text-blue-700 dark:text-blue-400 font-semibold">
                            <span>{instNum}a parcela {isAppendMode ? '(nova)' : ''}</span>
                            <span>{formatCurrency(amt)}</span>
                          </div>
                        )
                      })}
                    </div>
                    {(() => {
                      const lastInstAmt = Math.max(0.01, amountToCover - previewAmount * (previewCount - 1))
                      const previewTotal = previewAmount * (previewCount - 1) + lastInstAmt + untouchedTotal
                      const fullTotal = isAppendMode ? previewTotal + (selectedSale?.remaining || 0) : previewTotal
                      const diff = Math.abs(fullTotal - newRemaining)
                      if (diff > 0.02) {
                        return (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                            Total das parcelas: {formatCurrency(fullTotal)} (diferenca de {formatCurrency(diff)})
                          </p>
                        )
                      }
                      return null
                    })()}
                  </div>
                )}
              </div>
            )
          })()}

          {!isExistingMode && ctx.isFiado && (
            <div className="bg-amber-50/80 dark:bg-amber-950/20 p-4 rounded-xl space-y-3 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="installment-toggle"
                  checked={ctx.isInstallment}
                  onChange={(e) => {
                    ctx.setIsInstallment(e.target.checked)
                    if (e.target.checked) {
                      ctx.setIsFiadoMode(true)
                      ctx.setPayments([])
                      if (!ctx.installmentPlan) {
                        ctx.setInstallmentPlan(3)
                        if (ctx.total > 0) {
                          ctx.setFixedInstallmentAmount(Number((ctx.total / 3).toFixed(2)))
                        }
                      }
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                />
                <Label htmlFor="installment-toggle" className="cursor-pointer text-sm font-semibold">
                  Dividir em parcelas
                </Label>
              </div>

              {ctx.isInstallment && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Parcelas</Label>
                      <Input
                        type="number"
                        min="1"
                        max="48"
                        value={ctx.installmentPlan}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '') {
                            ctx.setInstallmentPlan('')
                            ctx.setFixedInstallmentAmount(null)
                            return
                          }
                          const value = Math.min(48, Number(raw) || 0)
                          ctx.setInstallmentPlan(value)
                          if (value > 0 && ctx.total > 0) {
                            ctx.setFixedInstallmentAmount(Number((ctx.total / value).toFixed(2)))
                          }
                        }}
                        onBlur={() => {
                          if (!ctx.installmentPlan || ctx.installmentPlan < 1) ctx.setInstallmentPlan(1)
                        }}
                        className="h-9"
                        placeholder="3"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Dia do vencimento</Label>
                      <Select
                        value={String(ctx.paymentDay)}
                        onValueChange={(v) => ctx.setPaymentDay(Number(v))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                            <SelectItem key={day} value={String(day)}>
                              Dia {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Inicio</Label>
                      <Select
                        value={ctx.startMonth && ctx.startYear ? `${ctx.startMonth}-${ctx.startYear}` : 'auto'}
                        onValueChange={(v) => {
                          if (v === 'auto') {
                            ctx.setStartMonth(null)
                            ctx.setStartYear(null)
                          } else {
                            const [m, y] = v.split('-').map(Number)
                            ctx.setStartMonth(m)
                            ctx.setStartYear(y)
                          }
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Auto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automatico</SelectItem>
                          {Array.from({ length: 12 }, (_, i) => {
                            const d = new Date()
                            d.setMonth(d.getMonth() + i)
                            const m = d.getMonth() + 1
                            const y = d.getFullYear()
                            const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                            return (
                              <SelectItem key={`${m}-${y}`} value={`${m}-${y}`}>
                                {label.charAt(0).toUpperCase() + label.slice(1)}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Valor fixo</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={ctx.total > 0 && Number(ctx.installmentPlan) > 0 ? String((ctx.total / Number(ctx.installmentPlan)).toFixed(2)) : '0'}
                        value={ctx.fixedInstallmentAmount || ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null
                          ctx.setFixedInstallmentAmount(val)
                          if (val && val > 0 && ctx.total > 0) {
                            ctx.setInstallmentPlan(Math.ceil(ctx.total / val))
                          }
                        }}
                        className="h-9"
                      />
                    </div>
                  </div>
                  {ctx.total > 0 && Number(ctx.installmentPlan) > 0 && (
                    <div className="text-center">
                      <span className="text-base text-amber-700 dark:text-amber-400 font-semibold">
                        {ctx.installmentPlan}x de {formatCurrency(ctx.fixedInstallmentAmount || ctx.total / Number(ctx.installmentPlan))}
                      </span>
                    </div>
                  )}
                  {Number(ctx.installmentPlan) > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-sm text-amber-700">
                      <span className="font-medium flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Vencimentos:
                      </span>
                      {(() => {
                        const now = new Date()
                        const skipCurrent = !(ctx.startMonth && ctx.startYear) && now.getDate() >= ctx.paymentDay
                        return Array.from({ length: Math.min(Number(ctx.installmentPlan), 6) }, (_, i) => {
                          let date: Date
                          if (ctx.startMonth && ctx.startYear) {
                            date = new Date(ctx.startYear, ctx.startMonth - 1 + i, ctx.paymentDay)
                          } else {
                            date = new Date(now.getFullYear(), now.getMonth() + i + (skipCurrent ? 1 : 0), ctx.paymentDay)
                          }
                          const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
                          if (ctx.paymentDay > lastDay) {
                            date.setDate(lastDay)
                          }
                          return (
                            <span key={i} className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded text-xs font-medium">
                              {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )
                        })
                      })()}
                      {Number(ctx.installmentPlan) > 6 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">+{Number(ctx.installmentPlan) - 6} mais</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
