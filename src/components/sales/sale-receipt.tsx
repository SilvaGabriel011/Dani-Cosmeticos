'use client'

import { useRef } from 'react'
import { Printer, CalendarDays, Handshake } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'

interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
}

interface ReceiptPayment {
  method: 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT'
  amount: number
}

interface ReceiptInstallment {
  number: number
  amount: number
  dueDate: Date
}

export interface SaleReceiptData {
  type: 'paid' | 'new_fiado' | 'existing_fiado'
  date: Date
  clientName?: string
  items: ReceiptItem[]
  subtotal: number
  discountPercent: number
  discountAmount: number
  total: number
  payments: ReceiptPayment[]
  paidAmount: number
  remaining: number
  installmentPlan?: number
  paymentDay?: number
  installments: ReceiptInstallment[]
  previousTotal?: number
  addedItemsTotal?: number
  existingMode?: 'increase_installments' | 'increase_value'
}

interface SaleReceiptProps {
  data: SaleReceiptData
  onClose: () => void
  onNewSale: () => void
}

function formatDateBR(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatDateTimeBR(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function SaleReceipt({ data, onClose, onNewSale }: SaleReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    const content = receiptRef.current
    if (!content) return

    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprovante de Venda</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; padding: 16px; max-width: 320px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 12px; }
          .header h1 { font-size: 16px; font-weight: bold; }
          .header p { font-size: 11px; color: #666; }
          .divider { border-top: 1px dashed #999; margin: 8px 0; }
          .item-row { display: flex; justify-content: space-between; padding: 2px 0; }
          .item-name { flex: 1; }
          .item-price { text-align: right; white-space: nowrap; }
          .total-row { display: flex; justify-content: space-between; font-weight: bold; padding: 2px 0; }
          .section-title { font-weight: bold; font-size: 11px; text-transform: uppercase; margin: 8px 0 4px; color: #333; }
          .installment-row { display: flex; justify-content: space-between; padding: 1px 0; font-size: 11px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; text-align: center; margin: 8px auto; }
          .badge-paid { background: #dcfce7; color: #166534; }
          .badge-fiado { background: #fef3c7; color: #92400e; }
          .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #999; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const isPaid = data.type === 'paid'
  const isFiado = data.type === 'new_fiado' || data.type === 'existing_fiado'
  const isExisting = data.type === 'existing_fiado'

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div ref={receiptRef} className="bg-white text-black p-4 max-w-sm mx-auto" style={{ fontFamily: "'Courier New', monospace" }}>
          <div className="text-center mb-3">
            <p className="text-base font-bold tracking-wide">DANI COSMÉTICOS</p>
            <p className="text-xs text-gray-500 mt-1">COMPROVANTE DE VENDA</p>
            <p className="text-xs text-gray-400 mt-1">{formatDateTimeBR(data.date)}</p>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {data.clientName && (
            <div className="mb-2">
              <span className="text-xs text-gray-500">Cliente:</span>
              <span className="text-sm font-bold ml-1">{data.clientName}</span>
            </div>
          )}

          {isExisting && (
            <div className="mb-2 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              <div className="flex items-center gap-1">
                <Handshake className="h-3 w-3 text-amber-600 shrink-0 print:hidden" />
                <span className="text-xs font-bold text-amber-700">
                  {data.existingMode === 'increase_installments'
                    ? 'Adicionado à conta fiado (novas parcelas)'
                    : 'Adicionado à conta fiado (valor atualizado)'}
                </span>
              </div>
            </div>
          )}

          <p className="text-[10px] font-bold uppercase text-gray-500 mt-2 mb-1">Itens</p>

          <div className="space-y-1">
            {data.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="flex-1 truncate pr-2">
                  {item.name} x{item.quantity}
                </span>
                <span className="whitespace-nowrap font-medium">{formatCurrency(item.total)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Subtotal</span>
              <span>{formatCurrency(data.subtotal)}</span>
            </div>
            {data.discountPercent > 0 && (
              <div className="flex justify-between text-xs text-green-700">
                <span>Desconto ({data.discountPercent.toFixed(0)}%)</span>
                <span>-{formatCurrency(data.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold">
              <span>TOTAL</span>
              <span>{formatCurrency(data.total)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {isPaid && data.payments.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Pagamento</p>
              <div className="space-y-1">
                {data.payments.map((p, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span>{PAYMENT_METHOD_LABELS[p.method]}</span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="text-center mt-3">
                <span className="inline-block bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded">
                  PAGO
                </span>
              </div>
            </>
          )}

          {isFiado && (
            <>
              <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Condições de Pagamento</p>

              {data.paidAmount > 0 && (
                <div className="flex justify-between text-xs mb-1">
                  <span>Entrada paga</span>
                  <span className="text-green-700">{formatCurrency(data.paidAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Saldo a pagar</span>
                <span className="text-amber-700">{formatCurrency(data.remaining)}</span>
              </div>

              {isExisting && data.previousTotal != null && (
                <div className="bg-gray-50 rounded px-2 py-1 my-2 space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Total anterior da conta</span>
                    <span>{formatCurrency(data.previousTotal)}</span>
                  </div>
                  {data.addedItemsTotal != null && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Itens adicionados</span>
                      <span>+{formatCurrency(data.addedItemsTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold">
                    <span>Novo total da conta</span>
                    <span>{formatCurrency(data.total)}</span>
                  </div>
                </div>
              )}

              {data.installments.length > 0 && (
                <>
                  <div className="border-t border-dashed border-gray-300 my-2" />
                  <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">
                    Parcelas ({data.installments.length}x)
                  </p>
                  <div className="space-y-0.5">
                    {data.installments.map((inst) => (
                      <div key={inst.number} className="flex justify-between text-xs">
                        <span className="text-gray-600">
                          {inst.number}ª - {formatDateBR(inst.dueDate)}
                        </span>
                        <span className="font-medium">{formatCurrency(inst.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {data.paymentDay && (
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                  <CalendarDays className="h-3 w-3 shrink-0 print:hidden" />
                  <span>Dia de pagamento: todo dia {data.paymentDay}</span>
                </div>
              )}

              <div className="text-center mt-3">
                <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded">
                  FIADO
                </span>
              </div>
            </>
          )}

          <div className="border-t border-dashed border-gray-400 my-3" />
          <p className="text-center text-[10px] text-gray-400">
            Obrigada pela preferência!
          </p>
        </div>
      </div>

      <div className="border-t bg-white p-3 flex gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="flex-1 gap-1"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewSale}
          className="flex-1"
        >
          Nova Venda
        </Button>
        <Button
          size="sm"
          onClick={onClose}
          className="flex-1"
        >
          Fechar
        </Button>
      </div>
    </div>
  )
}
