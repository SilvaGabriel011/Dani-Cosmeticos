'use client'

import { useRef } from 'react'
import { Printer, CalendarDays, Handshake } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'

interface ReceiptItem {
  name: string
  quantity: number
  originalPrice: number
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
  subtotalOriginal: number
  subtotal: number
  promoSavings: number
  discountPercent: number
  discountAmount: number
  totalSavings: number
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

    const printWindow = window.open('', '_blank', 'width=400,height=700')
    if (!printWindow) return

    const styles = [
      '* { margin: 0; padding: 0; box-sizing: border-box; }',
      "body { font-family: 'Courier New', monospace; font-size: 12px; padding: 16px; max-width: 320px; margin: 0 auto; }",
      '.flex { display: flex; }',
      '.flex-col { flex-direction: column; }',
      '.flex-1 { flex: 1; }',
      '.items-center { align-items: center; }',
      '.items-end { align-items: flex-end; }',
      '.justify-between { justify-content: space-between; }',
      '.inline-block { display: inline-block; }',
      '.text-center { text-align: center; }',
      '.text-right { text-align: right; }',
      '.text-xs { font-size: 12px; line-height: 16px; }',
      '.text-sm { font-size: 14px; line-height: 20px; }',
      '.text-base { font-size: 16px; line-height: 24px; }',
      '.text-\\[10px\\] { font-size: 10px; }',
      '.text-\\[11px\\] { font-size: 11px; }',
      '.font-bold { font-weight: bold; }',
      '.font-medium { font-weight: 500; }',
      '.font-semibold { font-weight: 600; }',
      '.tracking-wide { letter-spacing: 0.025em; }',
      '.uppercase { text-transform: uppercase; }',
      '.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
      '.whitespace-nowrap { white-space: nowrap; }',
      '.shrink-0 { flex-shrink: 0; }',
      '.line-through { text-decoration: line-through; }',
      '.space-y-1 > * + * { margin-top: 4px; }',
      '.space-y-2 > * + * { margin-top: 8px; }',
      '.space-y-0\\.5 > * + * { margin-top: 2px; }',
      '.gap-1 { gap: 4px; }',
      '.p-4 { padding: 16px; }',
      '.px-2 { padding-left: 8px; padding-right: 8px; }',
      '.px-3 { padding-left: 12px; padding-right: 12px; }',
      '.py-1 { padding-top: 4px; padding-bottom: 4px; }',
      '.pr-2 { padding-right: 8px; }',
      '.mt-1 { margin-top: 4px; }',
      '.mt-2 { margin-top: 8px; }',
      '.mt-3 { margin-top: 12px; }',
      '.mb-1 { margin-bottom: 4px; }',
      '.mb-2 { margin-bottom: 8px; }',
      '.mb-3 { margin-bottom: 12px; }',
      '.ml-1 { margin-left: 4px; }',
      '.my-1 { margin-top: 4px; margin-bottom: 4px; }',
      '.my-2 { margin-top: 8px; margin-bottom: 8px; }',
      '.my-3 { margin-top: 12px; margin-bottom: 12px; }',
      '.rounded { border-radius: 4px; }',
      '.border { border-width: 1px; border-style: solid; }',
      '.border-t { border-top-width: 1px; border-top-style: solid; }',
      '.border-dashed { border-style: dashed; }',
      '.border-gray-300 { border-color: #d1d5db; }',
      '.border-gray-400 { border-color: #9ca3af; }',
      '.border-amber-200 { border-color: #fde68a; }',
      '.border-green-200 { border-color: #bbf7d0; }',
      '.text-gray-400 { color: #9ca3af; }',
      '.text-gray-500 { color: #6b7280; }',
      '.text-gray-600 { color: #4b5563; }',
      '.text-green-700 { color: #15803d; }',
      '.text-green-800 { color: #166534; }',
      '.text-purple-700 { color: #7e22ce; }',
      '.text-amber-600 { color: #d97706; }',
      '.text-amber-700 { color: #92400e; }',
      '.text-amber-800 { color: #92400e; }',
      '.bg-white { background: #fff; }',
      '.bg-green-50 { background: #f0fdf4; }',
      '.bg-green-100 { background: #dcfce7; }',
      '.bg-amber-50 { background: #fffbeb; }',
      '.bg-amber-100 { background: #fef3c7; }',
      '.bg-gray-50 { background: #f9fafb; }',
      '.text-black { color: #000; }',
      '.max-w-sm { max-width: 384px; }',
      '.mx-auto { margin-left: auto; margin-right: auto; }',
      '.h-3 { height: 12px; }',
      '.w-3 { width: 12px; }',
      '.print\\:hidden { display: none; }',
      '@media print { body { padding: 0; } }',
    ].join('\n')

    printWindow.document.write(
      '<!DOCTYPE html><html><head><title>Comprovante de Venda</title><style>' +
      styles +
      '</style></head><body>' +
      content.innerHTML +
      '</body></html>'
    )
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

          <div className="space-y-2">
            {data.items.map((item, idx) => {
              const hasPromo = item.originalPrice > item.unitPrice
              return (
                <div key={idx}>
                  <div className="flex justify-between text-xs">
                    <span className="flex-1 truncate pr-2 font-medium">
                      {item.name} x{item.quantity}
                    </span>
                    <span className="whitespace-nowrap font-bold">{formatCurrency(item.total)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                    {hasPromo ? (
                      <>
                        <span>
                          <span className="line-through">{formatCurrency(item.originalPrice)}</span>
                          <span className="text-green-700 font-semibold ml-1">{formatCurrency(item.unitPrice)}</span>
                          <span className="text-green-700 ml-1">un.</span>
                        </span>
                        <span className="text-green-700 font-medium">
                          -{formatCurrency((item.originalPrice - item.unitPrice) * item.quantity)}
                        </span>
                      </>
                    ) : (
                      <span>{formatCurrency(item.unitPrice)} un.</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Subtotal (preço cheio)</span>
              <span>{formatCurrency(data.subtotalOriginal)}</span>
            </div>

            {data.promoSavings > 0 && (
              <div className="flex justify-between text-xs text-purple-700 font-medium">
                <span>Promoção nos itens</span>
                <span>-{formatCurrency(data.promoSavings)}</span>
              </div>
            )}

            {data.discountPercent > 0 && (
              <div className="flex justify-between text-xs text-green-700 font-medium">
                <span>Desconto do cliente ({data.discountPercent.toFixed(0)}%)</span>
                <span>-{formatCurrency(data.discountAmount)}</span>
              </div>
            )}

            {data.totalSavings > 0 && (
              <div className="bg-green-50 border border-green-200 rounded px-2 py-1 my-1">
                <div className="flex justify-between text-xs text-green-700 font-bold">
                  <span>Economia total</span>
                  <span>-{formatCurrency(data.totalSavings)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between text-sm font-bold mt-1">
              <span>VALOR A PAGAR</span>
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
          Imprimir / PDF
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
