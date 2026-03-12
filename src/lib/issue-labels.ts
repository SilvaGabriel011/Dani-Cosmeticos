/**
 * Mapeamento de códigos de erro técnicos para labels amigáveis
 * Usado na seção de auditoria para traduzir os códigos do health-check
 */

export interface IssueLabel {
  label: string
  description: string
}

export const ISSUE_LABELS: Record<string, IssueLabel> = {
  // ===== Health Check (Auditoria) =====
  PAYMENT_SUM_MISMATCH: {
    label: 'Divergência de Pagamentos',
    description: 'Soma dos pagamentos não bate com valor pago da venda',
  },
  COMPLETED_UNPAID: {
    label: 'Venda Concluída Incorretamente',
    description: 'Venda marcada como concluída mas há parcelas não pagas',
  },
  PENDING_ALL_PAID: {
    label: 'Status Pendente Incorreto',
    description: 'Venda pendente mas todas as parcelas já foram pagas',
  },
  PAID_UNDERPAID: {
    label: 'Parcela Subpaga',
    description: 'Parcela marcada como paga mas valor pago é menor que o devido',
  },
  FULLY_PAID_WRONG_STATUS: {
    label: 'Status de Parcela Incorreto',
    description: 'Parcela totalmente paga mas não está marcada como PAGA',
  },
  DUPLICATE_INSTALLMENTS: {
    label: 'Parcelas Duplicadas',
    description: 'Existem parcelas com o mesmo número',
  },
  PENDING_HAS_PAYMENT: {
    label: 'Parcela Parcialmente Paga',
    description: 'Parcela pendente com pagamento parcial (deveria ser PARCIAL)',
  },
  OVERPAYMENT: {
    label: 'Pagamento Excedente',
    description: 'Valor pago é maior que o total da venda',
  },
  PENDING_NO_RECEIVABLES: {
    label: 'Fiado sem Parcelas',
    description: 'Venda fiado sem parcelas criadas',
  },

  // ===== Diagnostic (Raio-X) =====
  RECEIVABLE_PAID_MISMATCH: {
    label: 'Divergência nas Parcelas',
    description: 'Soma paga nas parcelas difere do valor pago da venda',
  },
  RECEIVABLE_PAID_UNDERPAID: {
    label: 'Parcela Subpaga',
    description: 'Parcela marcada como paga mas valor é menor que o devido',
  },
  RECEIVABLE_PENDING_HAS_PAYMENT: {
    label: 'Parcela com Pagamento Parcial',
    description: 'Parcela pendente com pagamento (deveria ser PARCIAL)',
  },
  RECEIVABLE_FULLY_PAID_WRONG_STATUS: {
    label: 'Status de Parcela Incorreto',
    description: 'Parcela paga mas status não é PAGA',
  },
  RECEIVABLE_TOTAL_VS_REMAINING: {
    label: 'Total de Parcelas Divergente',
    description: 'Total das parcelas não corresponde ao saldo devedor',
  },
  STATUS_COMPLETED_UNPAID_RECEIVABLES: {
    label: 'Venda Concluída com Parcelas Pendentes',
    description: 'Venda marcada como concluída mas há parcelas não pagas',
  },
  STATUS_PENDING_ALL_PAID: {
    label: 'Venda Pendente com Tudo Pago',
    description: 'Venda pendente mas todas as parcelas estão pagas',
  },
  ITEMS_SUBTOTAL_MISMATCH: {
    label: 'Divergência no Subtotal',
    description: 'Soma dos itens difere do subtotal da venda',
  },
  DISCOUNT_MISMATCH: {
    label: 'Divergência no Desconto',
    description: 'Desconto calculado difere do desconto salvo',
  },
}

/**
 * Retorna o label amigável para um código de erro
 * Se não encontrar, retorna o próprio código
 */
export function getIssueLabel(code: string): string {
  return ISSUE_LABELS[code]?.label || code
}

/**
 * Retorna a descrição do erro
 */
export function getIssueDescription(code: string): string {
  return ISSUE_LABELS[code]?.description || ''
}
