/**
 * Mapeamento centralizado de erros da aplicação
 *
 * Este arquivo facilita:
 * - Padronização de mensagens de erro
 * - Internacionalização futura
 * - Correções e mudanças em um único lugar
 * - Logs e monitoramento
 */

// Códigos de erro da aplicação
export const ErrorCodes = {
  // Erros genéricos
  UNKNOWN: 'UNKNOWN',
  NETWORK: 'NETWORK',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  SERVER_ERROR: 'SERVER_ERROR',

  // Erros de Produto
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_CODE_EXISTS: 'PRODUCT_CODE_EXISTS',
  PRODUCT_HAS_SALES: 'PRODUCT_HAS_SALES',
  PRODUCT_INVALID_PRICE: 'PRODUCT_INVALID_PRICE',
  PRODUCT_INSUFFICIENT_STOCK: 'PRODUCT_INSUFFICIENT_STOCK',

  // Erros de Cliente
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  CLIENT_HAS_SALES: 'CLIENT_HAS_SALES',
  CLIENT_INVALID_DISCOUNT: 'CLIENT_INVALID_DISCOUNT',

  // Erros de Venda
  SALE_NOT_FOUND: 'SALE_NOT_FOUND',
  SALE_ALREADY_CANCELLED: 'SALE_ALREADY_CANCELLED',
  SALE_NO_ITEMS: 'SALE_NO_ITEMS',
  SALE_NO_PAYMENTS: 'SALE_NO_PAYMENTS',
  SALE_PAYMENT_MISMATCH: 'SALE_PAYMENT_MISMATCH',
  SALE_INVALID_QUANTITY: 'SALE_INVALID_QUANTITY',

  // Erros de Categoria
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  CATEGORY_NAME_EXISTS: 'CATEGORY_NAME_EXISTS',
  CATEGORY_HAS_PRODUCTS: 'CATEGORY_HAS_PRODUCTS',

  // Erros de Configuração
  SETTINGS_NOT_FOUND: 'SETTINGS_NOT_FOUND',
  SETTINGS_INVALID_FEE: 'SETTINGS_INVALID_FEE',

  // Erros de Banco de Dados
  DB_CONNECTION: 'DB_CONNECTION',
  DB_CONSTRAINT: 'DB_CONSTRAINT',
  DB_TIMEOUT: 'DB_TIMEOUT',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

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

  // Cliente
  [ErrorCodes.CLIENT_NOT_FOUND]: 'Cliente não encontrado.',
  [ErrorCodes.CLIENT_HAS_SALES]: 'Não é possível excluir cliente com vendas.',
  [ErrorCodes.CLIENT_INVALID_DISCOUNT]: 'Desconto deve estar entre 0% e 100%.',

  // Venda
  [ErrorCodes.SALE_NOT_FOUND]: 'Venda não encontrada.',
  [ErrorCodes.SALE_ALREADY_CANCELLED]: 'Esta venda já foi cancelada.',
  [ErrorCodes.SALE_NO_ITEMS]: 'Adicione ao menos um item à venda.',
  [ErrorCodes.SALE_NO_PAYMENTS]: 'Adicione ao menos uma forma de pagamento.',
  [ErrorCodes.SALE_PAYMENT_MISMATCH]: 'O valor dos pagamentos não confere com o total.',
  [ErrorCodes.SALE_INVALID_QUANTITY]: 'Quantidade inválida.',

  // Categoria
  [ErrorCodes.CATEGORY_NOT_FOUND]: 'Categoria não encontrada.',
  [ErrorCodes.CATEGORY_NAME_EXISTS]: 'Já existe uma categoria com este nome.',
  [ErrorCodes.CATEGORY_HAS_PRODUCTS]: 'Não é possível excluir categoria com produtos.',

  // Configuração
  [ErrorCodes.SETTINGS_NOT_FOUND]: 'Configurações não encontradas.',
  [ErrorCodes.SETTINGS_INVALID_FEE]: 'Taxa deve estar entre 0% e 100%.',

  // Banco de Dados
  [ErrorCodes.DB_CONNECTION]: 'Erro ao conectar ao banco de dados.',
  [ErrorCodes.DB_CONSTRAINT]: 'Violação de restrição do banco de dados.',
  [ErrorCodes.DB_TIMEOUT]: 'Tempo limite de conexão excedido.',
}

// Classe de erro personalizada
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details?: Record<string, unknown>

  constructor(code: ErrorCode, statusCode: number = 400, details?: Record<string, unknown>) {
    super(ErrorMessages[code])
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.name = 'AppError'
  }

  toJSON() {
    return {
      error: {
        code: this.code,
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
    case 500:
      return ErrorCodes.SERVER_ERROR
    default:
      return ErrorCodes.UNKNOWN
  }
}

// Função para mapear erros do Prisma para códigos internos
export function prismaErrorToAppError(error: unknown): AppError {
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: { target?: string[] } }

    switch (prismaError.code) {
      case 'P2002': // Unique constraint
        const field = prismaError.meta?.target?.[0]
        if (field === 'code') return createError(ErrorCodes.PRODUCT_CODE_EXISTS, 409)
        if (field === 'name') return createError(ErrorCodes.CATEGORY_NAME_EXISTS, 409)
        return createError(ErrorCodes.DB_CONSTRAINT, 409)

      case 'P2025': // Record not found
        return createError(ErrorCodes.NOT_FOUND, 404)

      case 'P2003': // Foreign key constraint
        return createError(ErrorCodes.DB_CONSTRAINT, 400)

      case 'P1001': // Can't reach database
        return createError(ErrorCodes.DB_CONNECTION, 503)

      case 'P1008': // Timeout
        return createError(ErrorCodes.DB_TIMEOUT, 503)

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
      status: error.statusCode,
    }
  }

  const appError = prismaErrorToAppError(error)
  return {
    message: appError.message,
    code: appError.code,
    status: appError.statusCode,
  }
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
