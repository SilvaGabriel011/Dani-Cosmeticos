'use client'

import { Package } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useSale } from '@/hooks/use-sales'
import { formatCurrency } from '@/lib/utils'

interface SaleItemsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  saleId: string | null
}

export function SaleItemsModal({ open, onOpenChange, saleId }: SaleItemsModalProps) {
  const { data: sale, isLoading } = useSale(saleId || '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Itens da Venda
          </DialogTitle>
          {sale?.client && (
            <DialogDescription>Cliente: {sale.client.name}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : sale?.items && sale.items.length > 0 ? (
            <>
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {sale.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.product.name}</p>
                      {item.product.code && (
                        <p className="text-xs text-muted-foreground">Cód: {item.product.code}</p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.quantity}x {formatCurrency(Number(item.unitPrice))}
                      </p>
                      {item.isBackorder && (
                        <Badge variant="secondary" className="mt-1 text-xs bg-amber-100 text-amber-800">
                          Encomenda
                        </Badge>
                      )}
                    </div>
                    <div className="text-right font-medium">
                      {formatCurrency(Number(item.total))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t flex items-center justify-between">
                <span className="font-semibold">Total:</span>
                <span className="text-lg font-bold">{formatCurrency(Number(sale.total))}</span>
              </div>
            </>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              Nenhum item encontrado nesta venda.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
