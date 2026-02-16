'use client'

import { Plus, Minus, Trash2, Search, Loader2, Package, AlertTriangle, Pencil, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatCurrency } from '@/lib/utils'
import { useSaleFormContext } from '../sale-form-context'

function ProductPanel() {
  const ctx = useSaleFormContext()

  return (
    <Card className={`h-full flex flex-col transition-all duration-300 ${ctx.validationErrors.products ? 'border-2 border-red-400 shadow-sm shadow-red-100 dark:shadow-red-900/30 animate-shake' : ''}`}>
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Produtos</span>
          <div className="flex items-center gap-2">
            {ctx.products.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {ctx.products.filter((p) => p.stock > 0).length} disponíveis
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={ctx.productSearch}
            onChange={(e) => ctx.setProductSearch(e.target.value)}
            onKeyDown={ctx.handleProductKeyDown}
            className="pl-9 h-11 text-base"
          />
        </div>

        {ctx.productCompletions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 shrink-0">
            {ctx.productCompletions.map((word) => (
              <button
                key={word}
                type="button"
                className="text-sm bg-muted hover:bg-muted/80 text-muted-foreground rounded-full px-3 py-1.5 min-h-[36px] transition-colors"
                onClick={() => ctx.setProductSearch(ctx.applyCompletion(ctx.productSearch, word))}
              >
                {word}
              </button>
            ))}
          </div>
        )}

        {ctx.validationErrors.products && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium shrink-0">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {ctx.validationErrors.products}
          </div>
        )}

        <div
          ref={ctx.productListRef}
          className="flex-1 min-h-0 overflow-y-auto border rounded-md"
          onScroll={ctx.handleProductListScroll}
        >
          {!ctx.productSearch.trim() && ctx.recentProducts.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/50 sticky top-0 z-10">
                Recentes
              </div>
              {ctx.recentProducts.map((product) => (
                <button
                  key={`recent-${product.id}`}
                  className="w-full px-3 py-3 text-left text-sm flex justify-between items-center min-h-[44px] hover:bg-primary/10 focus:outline-none active:bg-primary/20"
                  onClick={() => { ctx.addItem(product); ctx.addRecentProduct(product.id) }}
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="flex items-center gap-2">
                    {product.stock > 0 ? (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        product.stock <= product.minStock
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                          : product.stock <= product.minStock * 2
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                      }`}>
                        {product.stock} un.
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full">
                        <Package className="h-2.5 w-2.5" />
                        Enc.
                      </span>
                    )}
                    <span className="text-muted-foreground font-semibold">
                      {formatCurrency(Number(product.salePrice))}
                    </span>
                  </span>
                </button>
              ))}
              <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/50 sticky top-0 z-10">
                Todos
              </div>
            </>
          )}
          {ctx.filteredProducts.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum produto encontrado
            </p>
          ) : (
            <>
              {ctx.visibleProducts.map((product, index) => (
                <button
                  key={product.id}
                  className={`w-full px-3 py-3 text-left text-sm flex justify-between items-center min-h-[44px] transition-all duration-200 hover:pl-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset active:bg-primary/20 active:scale-[0.99] ${
                    index === ctx.highlightedProductIndex
                      ? 'bg-primary/10 pl-4'
                      : product.stock <= 0
                        ? 'bg-amber-50/60 hover:bg-amber-100/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/40'
                        : 'hover:bg-primary/10'
                  }`}
                  onClick={() => { ctx.addItem(product); ctx.addRecentProduct(product.id) }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium">{product.name}</span>
                    {product.stock <= 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full shrink-0">
                        <Package className="h-2.5 w-2.5" />
                        Encomenda
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {product.stock > 0 && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                        product.stock <= product.minStock
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                          : product.stock <= product.minStock * 2
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                      }`}>
                        {product.stock} un.
                      </span>
                    )}
                    <span className="text-muted-foreground font-semibold">
                      {formatCurrency(Number(product.salePrice))}
                    </span>
                  </span>
                </button>
              ))}
              {ctx.hasMoreProducts && (
                <div className="px-3 py-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Role para carregar mais ({ctx.filteredProducts.length - ctx.visibleProducts.length} restantes)
                </div>
              )}
            </>
          )}
        </div>

        <div className="shrink-0">
          {ctx.showQuickProduct ? (
            <div className="border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Package className="h-4 w-4" />
                  Item Avulso
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    ctx.setShowQuickProduct(false)
                    ctx.setQuickName('')
                    ctx.setQuickPrice('')
                    ctx.setQuickCost(0)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                placeholder="Nome do produto"
                value={ctx.quickName}
                onChange={(e) => ctx.setQuickName(e.target.value)}
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Preco de venda *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={ctx.quickPrice}
                    onChange={(e) => ctx.setQuickPrice(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Custo (opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={ctx.quickCost}
                    onChange={(e) => ctx.setQuickCost(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white"
                onClick={ctx.handleQuickProduct}
                disabled={ctx.createProductPending}
              >
                {ctx.createProductPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Criar e Adicionar
                  </span>
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-800 dark:hover:text-amber-300"
              onClick={() => {
                ctx.setShowQuickProduct(true)
                if (ctx.productSearch.trim() && ctx.filteredProducts.length === 0) {
                  ctx.setQuickName(ctx.productSearch.trim())
                }
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Item Avulso (sem cadastro)
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CartPanel() {
  const ctx = useSaleFormContext()

  if (ctx.items.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Carrinho
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Carrinho vazio</p>
            <p className="text-xs mt-1">Selecione produtos ao lado</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col border-2 border-green-400 shadow-sm shadow-green-100 dark:shadow-green-900/30">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Carrinho
          </span>
          <span className="bg-primary text-primary-foreground text-sm px-2 py-1 rounded-full">
            {ctx.items.reduce((sum, item) => sum + item.quantity, 0)} itens
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
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
        <div className="shrink-0 pt-2 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Subtotal:</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(ctx.total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function StepCart() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      <div className="min-h-0 h-full">
        <ProductPanel />
      </div>
      <div className="min-h-0 h-full">
        <CartPanel />
      </div>
    </div>
  )
}
