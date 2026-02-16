'use client'

import { Plus, Minus, Trash2, Loader2, Handshake, ShoppingCart, Package, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn, formatCurrency } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { useSaleFormContext } from '../sale-form-context'

export function StepReview() {
  const ctx = useSaleFormContext()

  return (
    <div className="space-y-4">
      <Card key={`prices-${ctx.shakeKey}`} className={`border-2 bg-gradient-to-br from-primary/5 to-transparent transition-all duration-300 ${ctx.validationErrors.prices ? 'border-red-400 shadow-sm shadow-red-100 dark:shadow-red-900/30 animate-shake' : ctx.items.length > 0 ? 'border-green-400 shadow-sm shadow-green-100 dark:shadow-green-900/30' : 'border-primary/20'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Resumo da Venda
            </span>
            {ctx.hasCustomTotal && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => ctx.restoreOriginalPrices()}
                className="h-7 px-2 text-xs hover:bg-primary/10 rounded-md"
                title="Restaurar precos originais"
              >
                ↩ Restaurar precos
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {ctx.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Carrinho vazio</p>
              <p className="text-xs opacity-70">Adicione produtos na etapa 1</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {ctx.items.map((item) => (
                <div
                  key={item.product.id}
                  className={`p-2 border rounded-lg animate-in fade-in duration-200 ${
                    item.unitPrice !== item.originalPrice
                      ? item.unitPrice < item.originalPrice
                        ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20'
                        : 'border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/20'
                      : 'bg-gray-50/50 dark:bg-gray-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-medium text-sm leading-tight truncate flex-1">{item.product.name}</span>
                    {(item.product.stock <= 0 || item.quantity > item.product.stock) && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded-full shrink-0">
                        <Package className="h-2 w-2" />
                        Enc.
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                      onClick={() => ctx.removeItem(item.product.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 disabled:opacity-40"
                        onClick={() => ctx.updateQuantity(item.product.id, -1)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center font-bold text-sm tabular-nums">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-600 disabled:opacity-40"
                        onClick={() => ctx.updateQuantity(item.product.id, 1)}
                        disabled={item.product.stock > 0 && item.quantity >= item.product.stock}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <span className="text-sm font-bold text-primary shrink-0 min-w-[70px] text-right">
                      {formatCurrency(item.totalPrice)}
                    </span>
                  </div>
                  <div className={`mt-2 p-2.5 rounded-lg border-2 border-dashed transition-all ${
                    item.unitPrice !== item.originalPrice
                      ? item.unitPrice < item.originalPrice
                        ? 'border-green-400 dark:border-green-600 bg-green-50/60 dark:bg-green-950/30'
                        : 'border-orange-400 dark:border-orange-600 bg-orange-50/60 dark:bg-orange-950/30'
                      : 'border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/20 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-50/60 dark:hover:bg-red-950/30'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <label className={`text-xs font-semibold flex items-center gap-1 ${
                        item.unitPrice !== item.originalPrice
                          ? item.unitPrice < item.originalPrice ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        <Pencil className="h-3 w-3" />
                        Preco unitario
                      </label>
                      {item.unitPrice !== item.originalPrice && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.unitPrice < item.originalPrice
                            ? 'bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                            : 'bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300'
                        }`}>
                          {item.unitPrice < item.originalPrice
                            ? `-${((1 - item.unitPrice / item.originalPrice) * 100).toFixed(0)}%`
                            : `+${((item.unitPrice / item.originalPrice - 1) * 100).toFixed(0)}%`}
                        </span>
                      )}
                    </div>
                    <div className="relative mt-1.5 group/price">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium ${
                        item.unitPrice !== item.originalPrice
                          ? item.unitPrice < item.originalPrice ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                          : 'text-red-400 dark:text-red-500'
                      }`}>R$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={cn(
                          'h-10 pl-9 pr-3 text-right text-base font-bold rounded-md transition-all cursor-pointer border-2',
                          item.unitPrice !== item.originalPrice
                            ? item.unitPrice < item.originalPrice
                              ? 'border-green-300 dark:border-green-700 bg-background focus:border-green-500 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800'
                              : 'border-orange-300 dark:border-orange-700 bg-background focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800'
                            : 'border-red-200 dark:border-red-800 bg-background hover:border-red-300 dark:hover:border-red-700 focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800'
                        )}
                        value={item.unitPrice}
                        onChange={(e) => ctx.updateItemPrice(item.product.id, Number(e.target.value))}
                        title="Altere o preco para aplicar promocao"
                      />
                    </div>
                    {item.unitPrice !== item.originalPrice && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Preco original: {formatCurrency(item.originalPrice)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {ctx.promoAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-purple-600 dark:text-purple-400 font-medium">Promocao:</span>
              <span className="text-purple-600 dark:text-purple-400 font-semibold">-{formatCurrency(ctx.promoAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal:</span>
            <span className="font-medium">{formatCurrency(ctx.subtotal)}</span>
          </div>
          {ctx.effectiveDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600 dark:text-green-400 font-medium">Desconto ({ctx.effectiveDiscount}%):</span>
              <span className="text-green-600 dark:text-green-400 font-semibold">-{formatCurrency(ctx.discountAmount)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Total:</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={ctx.total}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (value >= 0) {
                    ctx.updateTotalAndRedistribute(value)
                  }
                }}
                className="w-36 text-right text-xl font-bold text-primary border-2 border-primary/30 focus:border-primary rounded-lg"
                step="0.01"
                min="0"
                aria-label="Total da venda"
              />
            </div>
          </div>
          {(ctx.isFiadoMode || ctx.remaining > 0.01) && (
            <div className="flex justify-between text-sm bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
              <span className="text-amber-700 dark:text-amber-400 font-medium">Restante (Fiado):</span>
              <span className="text-amber-700 dark:text-amber-400 font-bold">{formatCurrency(ctx.isFiadoMode ? ctx.total : ctx.remaining)}</span>
            </div>
          )}
          {ctx.remaining < -0.01 && (
            <div className="flex justify-between text-sm bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-200 dark:border-red-800">
              <span className="text-red-600 dark:text-red-400 font-medium">Excedente:</span>
              <span className="text-red-600 dark:text-red-400 font-bold">{formatCurrency(Math.abs(ctx.remaining))}</span>
            </div>
          )}

          {ctx.selectedClient && (
            <div className="flex justify-between text-sm text-muted-foreground p-2 rounded-lg bg-muted/50">
              <span>Cliente:</span>
              <span className="font-medium">{ctx.selectedClient.name}</span>
            </div>
          )}

          {!ctx.isFiadoMode && ctx.payments.length > 0 && (
            <div className="space-y-1">
              {ctx.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-sm text-muted-foreground">
                  <span>{PAYMENT_METHOD_LABELS[p.method]}:</span>
                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {ctx.isFiadoMode && ctx.isInstallment && Number(ctx.installmentPlan) > 0 && (
            <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <span className="text-base text-amber-700 dark:text-amber-400 font-semibold">
                {ctx.installmentPlan}x de {formatCurrency(ctx.fixedInstallmentAmount || ctx.total / Number(ctx.installmentPlan))}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={ctx.handleSubmit}
        disabled={
          ctx.createSalePending ||
          ctx.addItemsToSalePending ||
          ctx.items.length === 0 ||
          (ctx.saleMode === 'existing' && !ctx.selectedPendingSaleId)
        }
        className={`w-full h-14 text-lg transition-all duration-200 disabled:opacity-50 ${
          ctx.isFiado
            ? 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white'
            : ''
        }`}
      >
        {ctx.createSalePending || ctx.addItemsToSalePending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Finalizando...
          </span>
        ) : ctx.saleMode === 'existing' ? (
          'Adicionar na Conta'
        ) : ctx.isFiado ? (
          <span className="flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Registrar Fiado
          </span>
        ) : (
          'Finalizar Venda'
        )}
      </Button>
    </div>
  )
}
