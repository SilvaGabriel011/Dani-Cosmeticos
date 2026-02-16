import { type ClassValue, clsx } from 'clsx'
import { format, subDays, startOfMonth } from 'date-fns'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num)
}

export function formatPercent(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return `${num.toFixed(1)}%`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function calculateSalePrice(costPrice: number, profitMargin: number): number {
  return costPrice * (1 + profitMargin / 100)
}

export function calculateProfitMargin(costPrice: number, salePrice: number): number {
  if (costPrice <= 0) return 0
  return (salePrice / costPrice - 1) * 100
}

export function calculateProfit(costPrice: number, salePrice: number): number {
  return salePrice - costPrice
}

export function calculateFeeAmount(amount: number, feePercent: number): number {
  return amount * (feePercent / 100)
}

export function getDateRange(period: string): { startDate: string; endDate: string } {
  const today = new Date()

  switch (period) {
    case 'today':
      return {
        startDate: format(today, 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }
    case 'week':
      return {
        startDate: format(subDays(today, 7), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }
    case 'month':
      return {
        startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }
    default:
      return { startDate: '', endDate: '' }
  }
}

export function formatWhatsAppUrl(phone: string): string | null {
  let digits = phone.replace(/\D/g, '')

  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2)
  }

  if (digits.length === 10) {
    digits = digits.slice(0, 2) + '9' + digits.slice(2)
  }

  if (digits.length !== 11) return null

  return `https://wa.me/55${digits}`
}

export function buildSaleWhatsAppMessage(sale: {
  createdAt: string | Date
  client?: { name: string; phone?: string | null } | null
  items: Array<{
    quantity: number
    unitPrice: number | string | object
    originalPrice?: number | string | object | null
    total: number | string | object
    product: { name: string }
  }>
  total: number | string | object
  discountAmount?: number | string | object | null
  discountPercent?: number | string | object | null
  paidAmount?: number | string | object | null
  payments: Array<{ method: string; amount: number | string | object }>
  status: string
  installmentPlan?: number | null
  paymentDay?: number | null
}): string {
  const lines: string[] = []
  lines.push('*DANI COSMÉTICOS*')
  lines.push('_Comprovante de Venda_')
  lines.push(`Data: ${formatDateTime(sale.createdAt)}`)
  if (sale.client?.name) lines.push(`Cliente: ${sale.client.name}`)
  lines.push('')

  lines.push('*Itens:*')
  for (const item of sale.items) {
    const unitPrice = Number(item.unitPrice)
    const originalPrice = item.originalPrice ? Number(item.originalPrice) : null
    const hasPromo = originalPrice != null && originalPrice > unitPrice
    let line = `• ${item.product.name} x${item.quantity} — ${formatCurrency(Number(item.total))}`
    if (hasPromo) {
      line += ` _(de ${formatCurrency(originalPrice)} por ${formatCurrency(unitPrice)} un.)_`
    }
    lines.push(line)
  }
  lines.push('')

  const discount = Number(sale.discountAmount || 0)
  if (discount > 0) {
    const pct = Number(sale.discountPercent || 0)
    lines.push(`Desconto${pct > 0 ? ` (${pct.toFixed(0)}%)` : ''}: -${formatCurrency(discount)}`)
  }

  lines.push(`*TOTAL: ${formatCurrency(Number(sale.total))}*`)
  lines.push('')

  const isFiado = sale.status === 'PENDING'
  if (!isFiado && sale.payments.length > 0) {
    lines.push('*Pagamento:*')
    for (const p of sale.payments) {
      const label =
        p.method === 'CASH' ? 'Dinheiro' :
        p.method === 'PIX' ? 'PIX' :
        p.method === 'DEBIT' ? 'Débito' :
        p.method === 'CREDIT' ? 'Crédito' : p.method
      lines.push(`• ${label}: ${formatCurrency(Number(p.amount))}`)
    }
    lines.push('\u2705 *PAGO*')
  }

  if (isFiado) {
    const paid = Number(sale.paidAmount || 0)
    if (paid > 0) {
      lines.push(`Entrada: ${formatCurrency(paid)}`)
    }
    const remaining = Number(sale.total) - paid
    lines.push(`*Saldo a pagar: ${formatCurrency(remaining)}*`)
    if (sale.installmentPlan && sale.installmentPlan > 1) {
      lines.push(`Parcelamento: ${sale.installmentPlan}x`)
    }
    if (sale.paymentDay) {
      lines.push(`Dia de pagamento: todo dia ${sale.paymentDay}`)
    }
  }

  lines.push('')
  lines.push('_Obrigada pela preferência!_')

  return lines.join('\n')
}

export function buildSaleWhatsAppUrl(sale: Parameters<typeof buildSaleWhatsAppMessage>[0]): string | null {
  if (!sale.client?.phone) return null
  const baseUrl = formatWhatsAppUrl(sale.client.phone)
  if (!baseUrl) return null
  const message = buildSaleWhatsAppMessage(sale)
  return `${baseUrl}?text=${encodeURIComponent(message)}`
}

export type StockStatus = 'baixo' | 'medio' | 'bom'

export interface StockStatusInfo {
  status: StockStatus
  label: string
  color: 'destructive' | 'warning' | 'info'
}

export function getStockStatus(stock: number, minStock: number): StockStatusInfo {
  if (stock <= minStock) {
    return {
      status: 'baixo',
      label: 'Baixo',
      color: 'destructive',
    }
  }

  if (stock <= minStock * 2) {
    return {
      status: 'medio',
      label: 'Médio',
      color: 'warning',
    }
  }

  return {
    status: 'bom',
    label: 'Bom',
    color: 'info',
  }
}
