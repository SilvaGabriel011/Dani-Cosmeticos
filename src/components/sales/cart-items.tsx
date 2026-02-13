'use client'

import { Plus, Minus, Trash2, ShoppingCart } from 'lucide-react'
import { memo } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { type Product } from '@/types'

export interface CartItem {
  product: Product
  quantity: number
  originalPrice: number
  unitPrice: number
  totalPrice: number
}

interface CartItemRowProps {
  item: CartItem
  onUpdateQuantity: (productId: string, delta: number) => void
  onUpdatePrice: (productId: string, price: number) => void
  onRemove: (productId: string) => void
}

const CartItemRow = memo(function CartItemRow({
  item,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
}: CartItemRowProps) {
  return (
    <div className="p-3 border rounded-lg bg-gray-50/50 dark:bg-gray-900/50 space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm leading-tight">{item.product.name}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 active:scale-95 transition-all duration-150"
          onClick={() => onRemove(item.product.id)}
          aria-label={`Remover ${item.product.name} do carrinho`}
        >
          <Trash2 className="h-5 w-5 text-destructive" />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-background rounded-xl border-2 border-gray-100 dark:border-gray-800 p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onUpdateQuantity(item.product.id, -1)}
            disabled={item.quantity <= 1}
            aria-label="Diminuir quantidade"
          >
            <Minus className="h-5 w-5" />
          </Button>
          <span className="w-12 text-center font-bold text-xl tabular-nums">{item.quantity}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-lg hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-600 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onUpdateQuantity(item.product.id, 1)}
            disabled={item.quantity >= item.product.stock}
            aria-label="Aumentar quantidade"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Valor un.:</span>
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                className={`w-32 h-11 pl-9 pr-3 text-right text-base font-medium border-2 rounded-lg transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600 focus:ring-2 focus:ring-primary/20 ${
                  item.unitPrice !== item.originalPrice
                    ? item.unitPrice < item.originalPrice
                      ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20 focus:border-green-500'
                      : 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20 focus:border-orange-500'
                    : 'border-gray-200 dark:border-gray-700 bg-background focus:border-primary'
                }`}
                value={item.unitPrice}
                onChange={(e) => onUpdatePrice(item.product.id, Number(e.target.value))}
                aria-label={`Preço unitário de ${item.product.name}`}
              />
            </div>
          </div>
          {item.unitPrice !== item.originalPrice && (
            <span className={`text-sm font-medium ${item.unitPrice < item.originalPrice ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {item.unitPrice < item.originalPrice
                ? `-${((1 - item.unitPrice / item.originalPrice) * 100).toFixed(0)}% desc.`
                : `+${((item.unitPrice / item.originalPrice - 1) * 100).toFixed(0)}% acrés.`}
              <span className="text-muted-foreground ml-1">(era {formatCurrency(item.originalPrice)})</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-dashed">
        <span className="text-sm text-muted-foreground mr-2">Total:</span>
        <span className="text-lg font-bold text-primary">
          {formatCurrency(item.totalPrice)}
        </span>
      </div>
    </div>
  )
})

interface CartItemsProps {
  items: CartItem[]
  onUpdateQuantity: (productId: string, delta: number) => void
  onUpdatePrice: (productId: string, price: number) => void
  onRemove: (productId: string) => void
}

export function CartItems({ items, onUpdateQuantity, onUpdatePrice, onRemove }: CartItemsProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="p-4 rounded-full bg-muted/50 mb-4">
          <ShoppingCart className="h-10 w-10 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Carrinho vazio
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Busque e adicione produtos acima
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <CartItemRow
          key={item.product.id}
          item={item}
          onUpdateQuantity={onUpdateQuantity}
          onUpdatePrice={onUpdatePrice}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

export type { CartItem as CartItemType }
