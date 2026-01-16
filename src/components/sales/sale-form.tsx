"use client"

import { useState, useMemo } from "react"
import { Plus, Minus, Trash2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { useProducts } from "@/hooks/use-products"
import { useClients } from "@/hooks/use-clients"
import { useSettings } from "@/hooks/use-settings"
import { useCreateSale } from "@/hooks/use-sales"
import { Product } from "@/types"
import { formatCurrency } from "@/lib/utils"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants"

interface SaleItem {
  product: Product
  quantity: number
}

interface Payment {
  method: "CASH" | "PIX" | "DEBIT" | "CREDIT"
  amount: number
  feePercent: number
  feeAbsorber: "SELLER" | "CLIENT"
  installments: number
}

interface SaleFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SaleForm({ open, onOpenChange }: SaleFormProps) {
  const { toast } = useToast()
  const { data: productsData } = useProducts({ limit: 100 })
  const { data: clientsData } = useClients({ limit: 100 })
  const { data: settings } = useSettings()
  const createSale = useCreateSale()

  const [items, setItems] = useState<SaleItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [clientId, setClientId] = useState<string>("")
  const [discountPercent, setDiscountPercent] = useState(0)
  const [productSearch, setProductSearch] = useState("")

  const products = productsData?.data || []
  const clients = clientsData?.data || []

  const filteredProducts = products.filter(
    (p) =>
      p.stock > 0 &&
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.code?.toLowerCase().includes(productSearch.toLowerCase()))
  )

  const selectedClient = clients.find((c) => c.id === clientId)
  const effectiveDiscount = discountPercent || Number(selectedClient?.discount || 0)

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.product.salePrice) * item.quantity, 0),
    [items]
  )

  const discountAmount = subtotal * (effectiveDiscount / 100)
  const total = subtotal - discountAmount

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = total - totalPayments

  const addItem = (product: Product) => {
    const existing = items.find((i) => i.product.id === product.id)
    if (existing) {
      if (existing.quantity < product.stock) {
        setItems(
          items.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          )
        )
      }
    } else {
      setItems([...items, { product, quantity: 1 }])
    }
    setProductSearch("")
  }

  const updateQuantity = (productId: string, delta: number) => {
    setItems(
      items
        .map((item) => {
          if (item.product.id !== productId) return item
          const newQty = item.quantity + delta
          if (newQty <= 0) return null
          if (newQty > item.product.stock) return item
          return { ...item, quantity: newQty }
        })
        .filter(Boolean) as SaleItem[]
    )
  }

  const removeItem = (productId: string) => {
    setItems(items.filter((i) => i.product.id !== productId))
  }

  const addPayment = () => {
    setPayments([
      ...payments,
      {
        method: "PIX",
        amount: remaining > 0 ? remaining : 0,
        feePercent: 0,
        feeAbsorber: settings?.defaultFeeAbsorber || "SELLER",
        installments: 1,
      },
    ])
  }

  const updatePayment = (index: number, updates: Partial<Payment>) => {
    const newPayments = [...payments]
    const payment = { ...newPayments[index], ...updates }

    if (updates.method) {
      switch (updates.method) {
        case "DEBIT":
          payment.feePercent = Number(settings?.debitFeePercent || 1.5)
          break
        case "CREDIT":
          payment.feePercent =
            payment.installments > 1
              ? Number(settings?.creditInstallmentFee || 4)
              : Number(settings?.creditFeePercent || 3)
          break
        default:
          payment.feePercent = 0
      }
    }

    if (updates.installments && payment.method === "CREDIT") {
      payment.feePercent =
        updates.installments > 1
          ? Number(settings?.creditInstallmentFee || 4)
          : Number(settings?.creditFeePercent || 3)
    }

    newPayments[index] = payment
    setPayments(newPayments)
  }

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast({ title: "Adicione pelo menos um produto", variant: "destructive" })
      return
    }

    if (payments.length === 0) {
      toast({ title: "Adicione pelo menos um pagamento", variant: "destructive" })
      return
    }

    if (Math.abs(remaining) > 0.01) {
      toast({
        title: "O valor dos pagamentos não confere com o total",
        variant: "destructive",
      })
      return
    }

    try {
      await createSale.mutateAsync({
        clientId: clientId || null,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        payments: payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          feePercent: p.feePercent,
          feeAbsorber: p.feeAbsorber,
          installments: p.installments,
        })),
        discountPercent: effectiveDiscount,
      })

      toast({ title: "Venda realizada com sucesso!" })
      setItems([])
      setPayments([])
      setClientId("")
      setDiscountPercent(0)
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Erro ao realizar venda",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Venda</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Products Section */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Produtos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {productSearch && (
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    {filteredProducts.slice(0, 10).map((product) => (
                      <button
                        key={product.id}
                        className="w-full px-3 py-2 text-left hover:bg-muted flex justify-between items-center text-sm"
                        onClick={() => addItem(product)}
                      >
                        <span>{product.name}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(Number(product.salePrice))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <Separator />

                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum produto adicionado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex-1 truncate">{item.product.name}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.product.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.product.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="w-20 text-right">
                          {formatCurrency(Number(item.product.salePrice) * item.quantity)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeItem(item.product.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Section */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Cliente e Desconto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Cliente (opcional)</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Desconto (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Pagamentos</CardTitle>
                <Button variant="outline" size="sm" onClick={addPayment}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {payments.map((payment, index) => (
                  <div key={index} className="space-y-2 p-3 border rounded-md">
                    <div className="flex gap-2">
                      <Select
                        value={payment.method}
                        onValueChange={(v) =>
                          updatePayment(index, { method: v as Payment["method"] })
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
                          updatePayment(index, { amount: Number(e.target.value) })
                        }
                        className="w-28"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePayment(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {payment.method === "CREDIT" && (
                      <Select
                        value={payment.installments.toString()}
                        onValueChange={(v) =>
                          updatePayment(index, { installments: Number(v) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                            <SelectItem key={n} value={n.toString()}>
                              {n}x {n === 1 ? "à vista" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {payment.feePercent > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Taxa: {payment.feePercent}%
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {effectiveDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto ({effectiveDiscount}%):</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {remaining !== 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Restante:</span>
                    <span>{formatCurrency(remaining)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createSale.isPending || items.length === 0}
          >
            {createSale.isPending ? "Finalizando..." : "Finalizar Venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
