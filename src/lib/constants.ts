export const PAYMENT_METHOD_LABELS = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
} as const

export const FEE_ABSORBER_LABELS = {
  SELLER: 'Vendedor',
  CLIENT: 'Cliente',
} as const

export const SALE_STATUS_LABELS = {
  COMPLETED: 'Concluída',
  PENDING: 'Fiado',
  CANCELLED: 'Cancelada',
} as const

export const DEFAULT_PAGE_SIZE = 20

// Tolerância para comparação de valores monetários (arredondamento de centavos)
export const PAYMENT_TOLERANCE = 0.01

// Dia padrão de pagamento para vendas fiado quando não especificado
export const DEFAULT_PAYMENT_DAY = 10
