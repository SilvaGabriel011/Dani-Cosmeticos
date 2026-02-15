import { formatCurrency, formatDateTime } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS } from '@/lib/constants'
import { type Sale } from '@/types'

export function printSaleReceipt(sale: Sale) {
  const items = sale.items as unknown as Array<{
    id: string
    quantity: number
    unitPrice: number | string
    originalPrice: number | string | null
    total: number | string
    product: { name: string; code?: string | null }
  }>

  const itemsHtml = items
    .map((item) => {
      const unitPrice = Number(item.unitPrice)
      const originalPrice = item.originalPrice ? Number(item.originalPrice) : null
      const hasDiscount = originalPrice && originalPrice > unitPrice
      return `
        <tr>
          <td style="padding:6px 0;border-bottom:1px dashed #ddd;">
            ${item.product.name}
            ${item.product.code ? `<br><span style="color:#888;font-size:11px;">Cód: ${item.product.code}</span>` : ''}
          </td>
          <td style="padding:6px 0;border-bottom:1px dashed #ddd;text-align:center;">${item.quantity}</td>
          <td style="padding:6px 0;border-bottom:1px dashed #ddd;text-align:right;">
            ${formatCurrency(unitPrice)}
            ${hasDiscount ? `<br><span style="color:#888;font-size:11px;text-decoration:line-through;">${formatCurrency(originalPrice)}</span>` : ''}
          </td>
          <td style="padding:6px 0;border-bottom:1px dashed #ddd;text-align:right;font-weight:600;">
            ${formatCurrency(Number(item.total))}
          </td>
        </tr>`
    })
    .join('')

  const paymentsHtml =
    sale.payments.length > 0
      ? sale.payments
          .map(
            (p) =>
              `<div style="display:flex;justify-content:space-between;padding:2px 0;">
                <span>${PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}</span>
                <span>${formatCurrency(Number(p.amount))}</span>
              </div>`
          )
          .join('')
      : '<div style="color:#888;">Fiado</div>'

  const statusLabel = SALE_STATUS_LABELS[sale.status as keyof typeof SALE_STATUS_LABELS] || sale.status
  const discount = Number(sale.discountAmount || 0)

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante de Venda</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 24px;
      max-width: 380px;
      margin: 0 auto;
      color: #222;
      font-size: 13px;
    }
    .header {
      text-align: center;
      padding-bottom: 16px;
      border-bottom: 2px solid #222;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .header p {
      font-size: 12px;
      color: #555;
      margin-top: 4px;
    }
    .info {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px dashed #ccc;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    .info-row .label { color: #666; }
    .info-row .value { font-weight: 600; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th {
      padding: 6px 0;
      border-bottom: 2px solid #222;
      text-align: left;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
    th:nth-child(2) { text-align: center; }
    .totals {
      border-top: 2px solid #222;
      padding-top: 10px;
      margin-bottom: 12px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
    }
    .total-row.grand {
      font-size: 16px;
      font-weight: 700;
      padding-top: 6px;
      border-top: 1px dashed #ccc;
      margin-top: 4px;
    }
    .payments {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px dashed #ccc;
    }
    .payments-title {
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 4px;
    }
    .footer {
      text-align: center;
      color: #888;
      font-size: 11px;
      padding-top: 8px;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 10mm; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Comprovante de Venda</h1>
    <p>${formatDateTime(new Date(sale.createdAt))}</p>
  </div>

  <div class="info">
    ${sale.client ? `<div class="info-row"><span class="label">Cliente:</span><span class="value">${sale.client.name}</span></div>` : ''}
    <div class="info-row"><span class="label">Status:</span><span class="value">${statusLabel}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Produto</th>
        <th>Qtd</th>
        <th>Unit.</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    ${discount > 0 ? `
      <div class="total-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(Number(sale.total) + discount)}</span>
      </div>
      <div class="total-row" style="color:#c00;">
        <span>Desconto:</span>
        <span>-${formatCurrency(discount)}</span>
      </div>
    ` : ''}
    <div class="total-row grand">
      <span>Total:</span>
      <span>${formatCurrency(Number(sale.total))}</span>
    </div>
  </div>

  <div class="payments">
    <div class="payments-title">Pagamento</div>
    ${paymentsHtml}
  </div>

  <div class="footer">
    <p>Obrigado pela preferência!</p>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`

  const printWindow = window.open('', '_blank', 'width=420,height=600')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
  }
}
