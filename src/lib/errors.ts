/**
 * Mapeamento centralizado de erros da aplicação
 *
 * Códigos numéricos por área:
 *   1xxx - Produto
 *   2xxx - Cliente
 *   3xxx - Venda
 *   4xxx - Categoria
 *   5xxx - Configuração
 *   6xxx - Parcela (Receivable)
 *   7xxx - Pagamento
 *   9xxx - Sistema / Banco de Dados
 */

// Códigos de erro da aplicação
export const ErrorCodes = {
  // Erros genéricos / sistema (9xxx)
  UNKNOWN: 'UNKNOWN',
  NETWORK: 'NETWORK',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  SERVER_ERROR: 'SERVER_ERROR',

  // Erros de Produto (1xxx)
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_CODE_EXISTS: 'PRODUCT_CODE_EXISTS',
  PRODUCT_HAS_SALES: 'PRODUCT_HAS_SALES',
  PRODUCT_INVALID_PRICE: 'PRODUCT_INVALID_PRICE',
  PRODUCT_INSUFFICIENT_STOCK: 'PRODUCT_INSUFFICIENT_STOCK',
  PRODUCT_INACTIVE: 'PRODUCT_INACTIVE',
  PRODUCT_ZERO_PRICE: 'PRODUCT_ZERO_PRICE',

  // Erros de Cliente (2xxx)
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  CLIENT_HAS_SALES: 'CLIENT_HAS_SALES',
  CLIENT_INVALID_DISCOUNT: 'CLIENT_INVALID_DISCOUNT',
  CLIENT_DUPLICATE_PHONE: 'CLIENT_DUPLICATE_PHONE',
  CLIENT_REQUIRED: 'CLIENT_REQUIRED',

  // Erros de Venda (3xxx)
  SALE_NOT_FOUND: 'SALE_NOT_FOUND',
  SALE_ALREADY_CANCELLED: 'SALE_ALREADY_CANCELLED',
  SALE_NO_ITEMS: 'SALE_NO_ITEMS',
  SALE_NO_PAYMENTS: 'SALE_NO_PAYMENTS',
  SALE_PAYMENT_MISMATCH: 'SALE_PAYMENT_MISMATCH',
  SALE_INVALID_QUANTITY: 'SALE_INVALID_QUANTITY',
  SALE_CANCELLED: 'SALE_CANCELLED',
  SALE_COMPLETED: 'SALE_COMPLETED',
  SALE_CLIENT_REQUIRED: 'SALE_CLIENT_REQUIRED',
  SALE_INVALID_PRODUCT: 'SALE_INVALID_PRODUCT',
  SALE_OVERPAYMENT: 'SALE_OVERPAYMENT',

  // Erros de Categoria (4xxx)
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  CATEGORY_NAME_EXISTS: 'CATEGORY_NAME_EXISTS',
  CATEGORY_HAS_PRODUCTS: 'CATEGORY_HAS_PRODUCTS',
  CATEGORY_EMPTY_NAME: 'CATEGORY_EMPTY_NAME',

  // Erros de Configuração (5xxx)
  SETTINGS_NOT_FOUND: 'SETTINGS_NOT_FOUND',
  SETTINGS_INVALID_FEE: 'SETTINGS_INVALID_FEE',
  SETTINGS_SAVE_FAILED: 'SETTINGS_SAVE_FAILED',

  // Erros de Parcela / Receivable (6xxx)
  RECEIVABLE_NOT_FOUND: 'RECEIVABLE_NOT_FOUND',
  RECEIVABLE_ALREADY_PAID: 'RECEIVABLE_ALREADY_PAID',
  RECEIVABLE_CANCELLED: 'RECEIVABLE_CANCELLED',
  RECEIVABLE_NO_PENDING: 'RECEIVABLE_NO_PENDING',
  RECEIVABLE_INVALID_DATE: 'RECEIVABLE_INVALID_DATE',
  RECEIVABLE_SALE_CANCELLED: 'RECEIVABLE_SALE_CANCELLED',

  // Erros de Pagamento (7xxx)
  PAYMENT_EXCEEDS_BALANCE: 'PAYMENT_EXCEEDS_BALANCE',
  PAYMENT_SALE_FULLY_PAID: 'PAYMENT_SALE_FULLY_PAID',
  PAYMENT_INVALID_AMOUNT: 'PAYMENT_INVALID_AMOUNT',
  PAYMENT_ZERO_AMOUNT: 'PAYMENT_ZERO_AMOUNT',
  PAYMENT_OVERPAYMENT_UNCONFIRMED: 'PAYMENT_OVERPAYMENT_UNCONFIRMED',
  PAYMENT_METHOD_INVALID: 'PAYMENT_METHOD_INVALID',

  // Erros de Banco de Dados (9xxx)
  DB_CONNECTION: 'DB_CONNECTION',
  DB_CONSTRAINT: 'DB_CONSTRAINT',
  DB_TIMEOUT: 'DB_TIMEOUT',

  // Erros de Sistema extras (9xxx)
  RATE_LIMIT: 'RATE_LIMIT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONFLICT: 'CONFLICT',
  JSON_PARSE_ERROR: 'JSON_PARSE_ERROR',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// Mapeamento de código string → código numérico
export const NumericErrorCodes: Record<ErrorCode, number> = {
  // Produto (1xxx)
  [ErrorCodes.PRODUCT_NOT_FOUND]: 1001,
  [ErrorCodes.PRODUCT_CODE_EXISTS]: 1002,
  [ErrorCodes.PRODUCT_HAS_SALES]: 1003,
  [ErrorCodes.PRODUCT_INVALID_PRICE]: 1004,
  [ErrorCodes.PRODUCT_INSUFFICIENT_STOCK]: 1005,
  [ErrorCodes.PRODUCT_INACTIVE]: 1006,
  [ErrorCodes.PRODUCT_ZERO_PRICE]: 1007,

  // Cliente (2xxx)
  [ErrorCodes.CLIENT_NOT_FOUND]: 2001,
  [ErrorCodes.CLIENT_HAS_SALES]: 2002,
  [ErrorCodes.CLIENT_INVALID_DISCOUNT]: 2003,
  [ErrorCodes.CLIENT_DUPLICATE_PHONE]: 2004,
  [ErrorCodes.CLIENT_REQUIRED]: 2005,

  // Venda (3xxx)
  [ErrorCodes.SALE_NOT_FOUND]: 3001,
  [ErrorCodes.SALE_ALREADY_CANCELLED]: 3002,
  [ErrorCodes.SALE_NO_ITEMS]: 3003,
  [ErrorCodes.SALE_NO_PAYMENTS]: 3004,
  [ErrorCodes.SALE_PAYMENT_MISMATCH]: 3005,
  [ErrorCodes.SALE_INVALID_QUANTITY]: 3006,
  [ErrorCodes.SALE_CANCELLED]: 3007,
  [ErrorCodes.SALE_COMPLETED]: 3008,
  [ErrorCodes.SALE_CLIENT_REQUIRED]: 3009,
  [ErrorCodes.SALE_INVALID_PRODUCT]: 3010,
  [ErrorCodes.SALE_OVERPAYMENT]: 3011,

  // Categoria (4xxx)
  [ErrorCodes.CATEGORY_NOT_FOUND]: 4001,
  [ErrorCodes.CATEGORY_NAME_EXISTS]: 4002,
  [ErrorCodes.CATEGORY_HAS_PRODUCTS]: 4003,
  [ErrorCodes.CATEGORY_EMPTY_NAME]: 4004,

  // Configuração (5xxx)
  [ErrorCodes.SETTINGS_NOT_FOUND]: 5001,
  [ErrorCodes.SETTINGS_INVALID_FEE]: 5002,
  [ErrorCodes.SETTINGS_SAVE_FAILED]: 5003,

  // Parcela / Receivable (6xxx)
  [ErrorCodes.RECEIVABLE_NOT_FOUND]: 6001,
  [ErrorCodes.RECEIVABLE_ALREADY_PAID]: 6002,
  [ErrorCodes.RECEIVABLE_CANCELLED]: 6003,
  [ErrorCodes.RECEIVABLE_NO_PENDING]: 6004,
  [ErrorCodes.RECEIVABLE_INVALID_DATE]: 6005,
  [ErrorCodes.RECEIVABLE_SALE_CANCELLED]: 6006,

  // Pagamento (7xxx)
  [ErrorCodes.PAYMENT_EXCEEDS_BALANCE]: 7001,
  [ErrorCodes.PAYMENT_SALE_FULLY_PAID]: 7002,
  [ErrorCodes.PAYMENT_INVALID_AMOUNT]: 7003,
  [ErrorCodes.PAYMENT_ZERO_AMOUNT]: 7004,
  [ErrorCodes.PAYMENT_OVERPAYMENT_UNCONFIRMED]: 7005,
  [ErrorCodes.PAYMENT_METHOD_INVALID]: 7006,

  // Sistema / DB (9xxx)
  [ErrorCodes.UNKNOWN]: 9000,
  [ErrorCodes.NETWORK]: 9001,
  [ErrorCodes.VALIDATION]: 9002,
  [ErrorCodes.SERVER_ERROR]: 9003,
  [ErrorCodes.DB_CONNECTION]: 9004,
  [ErrorCodes.DB_CONSTRAINT]: 9005,
  [ErrorCodes.DB_TIMEOUT]: 9006,
  [ErrorCodes.UNAUTHORIZED]: 9007,
  [ErrorCodes.FORBIDDEN]: 9008,
  [ErrorCodes.NOT_FOUND]: 9009,
  [ErrorCodes.RATE_LIMIT]: 9010,
  [ErrorCodes.PAYLOAD_TOO_LARGE]: 9011,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 9012,
  [ErrorCodes.CONFLICT]: 9013,
  [ErrorCodes.JSON_PARSE_ERROR]: 9014,
}

// Mensagens de erro em português
export const ErrorMessages: Record<ErrorCode, string> = {
  // Genéricos
  [ErrorCodes.UNKNOWN]: 'Ocorreu um erro inesperado. Tente novamente.',
  [ErrorCodes.NETWORK]: 'Erro de conexão. Verifique sua internet.',
  [ErrorCodes.UNAUTHORIZED]: 'Você não está autorizado a realizar esta ação.',
  [ErrorCodes.FORBIDDEN]: 'Acesso negado.',
  [ErrorCodes.NOT_FOUND]: 'Recurso não encontrado.',
  [ErrorCodes.VALIDATION]: 'Dados inválidos. Verifique os campos.',
  [ErrorCodes.SERVER_ERROR]: 'Erro interno do servidor. Tente novamente mais tarde.',

  // Produto
  [ErrorCodes.PRODUCT_NOT_FOUND]: 'Produto não encontrado.',
  [ErrorCodes.PRODUCT_CODE_EXISTS]: 'Já existe um produto com este código.',
  [ErrorCodes.PRODUCT_HAS_SALES]: 'Não é possível excluir produto com vendas.',
  [ErrorCodes.PRODUCT_INVALID_PRICE]: 'Preço do produto inválido.',
  [ErrorCodes.PRODUCT_INSUFFICIENT_STOCK]: 'Estoque insuficiente para este produto.',
  [ErrorCodes.PRODUCT_INACTIVE]: 'Produto inativo ou removido.',
  [ErrorCodes.PRODUCT_ZERO_PRICE]: 'Preço do produto não pode ser zero.',

  // Cliente
  [ErrorCodes.CLIENT_NOT_FOUND]: 'Cliente não encontrado.',
  [ErrorCodes.CLIENT_HAS_SALES]: 'Não é possível excluir cliente com vendas.',
  [ErrorCodes.CLIENT_INVALID_DISCOUNT]: 'Desconto deve estar entre 0% e 100%.',
  [ErrorCodes.CLIENT_DUPLICATE_PHONE]: 'Já existe um cliente com este telefone.',
  [ErrorCodes.CLIENT_REQUIRED]: 'Cliente é obrigatório para esta operação.',

  // Venda
  [ErrorCodes.SALE_NOT_FOUND]: 'Venda não encontrada.',
  [ErrorCodes.SALE_ALREADY_CANCELLED]: 'Esta venda já foi cancelada.',
  [ErrorCodes.SALE_NO_ITEMS]: 'Adicione ao menos um item à venda.',
  [ErrorCodes.SALE_NO_PAYMENTS]: 'Adicione ao menos uma forma de pagamento.',
  [ErrorCodes.SALE_PAYMENT_MISMATCH]: 'O valor dos pagamentos não confere com o total.',
  [ErrorCodes.SALE_INVALID_QUANTITY]: 'Quantidade inválida.',
  [ErrorCodes.SALE_CANCELLED]: 'Não é possível realizar esta ação em uma venda cancelada.',
  [ErrorCodes.SALE_COMPLETED]: 'Esta venda já está totalmente paga.',
  [ErrorCodes.SALE_CLIENT_REQUIRED]: 'Vendas fiado precisam de um cliente vinculado.',
  [ErrorCodes.SALE_INVALID_PRODUCT]: 'Produto inválido ou inativo na venda.',
  [ErrorCodes.SALE_OVERPAYMENT]: 'O valor do pagamento excede o saldo devedor. Confirme para continuar.',

  // Categoria
  [ErrorCodes.CATEGORY_NOT_FOUND]: 'Categoria não encontrada.',
  [ErrorCodes.CATEGORY_NAME_EXISTS]: 'Já existe uma categoria com este nome.',
  [ErrorCodes.CATEGORY_HAS_PRODUCTS]: 'Não é possível excluir categoria com produtos.',
  [ErrorCodes.CATEGORY_EMPTY_NAME]: 'Nome da categoria não pode ser vazio.',

  // Configuração
  [ErrorCodes.SETTINGS_NOT_FOUND]: 'Configurações não encontradas.',
  [ErrorCodes.SETTINGS_INVALID_FEE]: 'Taxa deve estar entre 0% e 100%.',
  [ErrorCodes.SETTINGS_SAVE_FAILED]: 'Falha ao salvar configurações.',

  // Parcela / Receivable
  [ErrorCodes.RECEIVABLE_NOT_FOUND]: 'Parcela não encontrada.',
  [ErrorCodes.RECEIVABLE_ALREADY_PAID]: 'Esta parcela já foi paga.',
  [ErrorCodes.RECEIVABLE_CANCELLED]: 'Não é possível operar em parcela cancelada.',
  [ErrorCodes.RECEIVABLE_NO_PENDING]: 'Nenhuma parcela pendente encontrada para esta venda.',
  [ErrorCodes.RECEIVABLE_INVALID_DATE]: 'Data de vencimento inválida.',
  [ErrorCodes.RECEIVABLE_SALE_CANCELLED]: 'Não é possível alterar parcela de venda cancelada.',

  // Pagamento
  [ErrorCodes.PAYMENT_EXCEEDS_BALANCE]: 'Valor excede o saldo devedor.',
  [ErrorCodes.PAYMENT_SALE_FULLY_PAID]: 'Esta venda já foi paga completamente.',
  [ErrorCodes.PAYMENT_INVALID_AMOUNT]: 'Valor de pagamento inválido.',
  [ErrorCodes.PAYMENT_ZERO_AMOUNT]: 'Valor do pagamento deve ser maior que zero.',
  [ErrorCodes.PAYMENT_OVERPAYMENT_UNCONFIRMED]: 'Pagamento excede o saldo devedor. Confirme para prosseguir.',
  [ErrorCodes.PAYMENT_METHOD_INVALID]: 'Método de pagamento inválido.',

  // Banco de Dados
  [ErrorCodes.DB_CONNECTION]: 'Erro ao conectar ao banco de dados.',
  [ErrorCodes.DB_CONSTRAINT]: 'Violação de restrição do banco de dados.',
  [ErrorCodes.DB_TIMEOUT]: 'Tempo limite de conexão excedido.',

  // Sistema extras
  [ErrorCodes.RATE_LIMIT]: 'Muitas requisições. Aguarde um momento.',
  [ErrorCodes.PAYLOAD_TOO_LARGE]: 'Dados enviados excedem o tamanho permitido.',
  [ErrorCodes.SERVICE_UNAVAILABLE]: 'Serviço temporariamente indisponível.',
  [ErrorCodes.CONFLICT]: 'Conflito de estado. Atualize a página e tente novamente.',
  [ErrorCodes.JSON_PARSE_ERROR]: 'Erro ao processar dados da requisição.',
}

// Classe de erro personalizada
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly numericCode: number
  public readonly statusCode: number
  public readonly details?: Record<string, unknown>

  constructor(code: ErrorCode, statusCode: number = 400, details?: Record<string, unknown>) {
    super(ErrorMessages[code])
    this.code = code
    this.numericCode = NumericErrorCodes[code]
    this.statusCode = statusCode
    this.details = details
    this.name = 'AppError'
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        numericCode: this.numericCode,
        message: this.message,
        details: this.details,
      },
    }
  }
}

// Função helper para criar erros
export function createError(
  code: ErrorCode,
  statusCode?: number,
  details?: Record<string, unknown>
): AppError {
  return new AppError(code, statusCode, details)
}

// Função para obter mensagem de erro a partir do código
export function getErrorMessage(code: ErrorCode): string {
  return ErrorMessages[code] || ErrorMessages[ErrorCodes.UNKNOWN]
}

// Função para mapear erros HTTP para códigos internos
export function httpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCodes.VALIDATION
    case 401:
      return ErrorCodes.UNAUTHORIZED
    case 403:
      return ErrorCodes.FORBIDDEN
    case 404:
      return ErrorCodes.NOT_FOUND
    case 408:
      return ErrorCodes.DB_TIMEOUT
    case 409:
      return ErrorCodes.CONFLICT
    case 413:
      return ErrorCodes.PAYLOAD_TOO_LARGE
    case 429:
      return ErrorCodes.RATE_LIMIT
    case 500:
      return ErrorCodes.SERVER_ERROR
    case 503:
      return ErrorCodes.SERVICE_UNAVAILABLE
    default:
      return ErrorCodes.UNKNOWN
  }
}

// Função para mapear erros do Prisma para códigos internos
export function prismaErrorToAppError(error: unknown): AppError {
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: { target?: string[]; cause?: string; modelName?: string } }

    switch (prismaError.code) {
      case 'P2002': // Unique constraint
        const field = prismaError.meta?.target?.[0]
        if (field === 'code') return createError(ErrorCodes.PRODUCT_CODE_EXISTS, 409)
        if (field === 'name') return createError(ErrorCodes.CATEGORY_NAME_EXISTS, 409)
        if (field === 'phone') return createError(ErrorCodes.CLIENT_DUPLICATE_PHONE, 409)
        return createError(ErrorCodes.DB_CONSTRAINT, 409)

      case 'P2025': // Record not found
        return createError(ErrorCodes.NOT_FOUND, 404)

      case 'P2003': // Foreign key constraint
        return createError(ErrorCodes.DB_CONSTRAINT, 400)

      case 'P2014': // Relation violation
        return createError(ErrorCodes.DB_CONSTRAINT, 400)

      case 'P2021': // Table does not exist
        return createError(ErrorCodes.SERVER_ERROR, 500)

      case 'P2024': // Timed out fetching connection from pool
        return createError(ErrorCodes.DB_TIMEOUT, 503)

      case 'P1001': // Can't reach database
        return createError(ErrorCodes.DB_CONNECTION, 503)

      case 'P1008': // Timeout
        return createError(ErrorCodes.DB_TIMEOUT, 503)

      case 'P1017': // Server closed the connection
        return createError(ErrorCodes.DB_CONNECTION, 503)

      default:
        return createError(ErrorCodes.SERVER_ERROR, 500)
    }
  }

  return createError(ErrorCodes.UNKNOWN, 500)
}

// Função para processar erro em API routes
export function handleApiError(error: unknown): {
  message: string
  code: ErrorCode
  numericCode: number
  status: number
} {
  // Import dinâmico para evitar circular dependency
  import('./logger').then(({ logError }) => {
    logError('API Error', error)
  })

  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      numericCode: error.numericCode,
      status: error.statusCode,
    }
  }

  // Preservar mensagem de Error comum (erros de validação do service layer)
  if (error instanceof Error) {
    const code = ErrorCodes.VALIDATION
    return {
      message: error.message,
      code,
      numericCode: NumericErrorCodes[code],
      status: 400,
    }
  }

  const appError = prismaErrorToAppError(error)
  return {
    message: appError.message,
    code: appError.code,
    numericCode: appError.numericCode,
    status: appError.statusCode,
  }
}

// Cria um Error com cause contendo código numérico (para uso nos hooks de mutação)
export function throwApiError(
  errorBody: { error?: { message?: string; code?: string; numericCode?: number }; message?: string },
  fallback: string
): never {
  const message = errorBody.error?.message || errorBody.message || fallback
  const err = new Error(message)
  err.cause = { code: errorBody.error?.code, numericCode: errorBody.error?.numericCode }
  throw err
}

// Extrai numericCode do cause de um Error (para uso nos catch blocks dos componentes)
export function getErrorNumericCode(error: unknown): number | undefined {
  if (error instanceof Error && error.cause && typeof error.cause === 'object') {
    return (error.cause as { numericCode?: number }).numericCode
  }
  return undefined
}

// Hook helper para tratamento de erros no frontend
export function parseApiError(error: unknown): string {
  if (error instanceof Error) {
    // Tentar parsear como resposta JSON da API
    try {
      const parsed = JSON.parse(error.message)
      if (parsed.error?.message) return parsed.error.message
      if (parsed.message) return parsed.message
    } catch {
      // Não é JSON, usar mensagem direta
      return error.message
    }
  }

  if (typeof error === 'string') {
    return error
  }

  return ErrorMessages[ErrorCodes.UNKNOWN]
}
