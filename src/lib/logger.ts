/* eslint-disable no-console */
/**
 * Structured logging para a aplicação
 *
 * Logs são emitidos em formato JSON para facilitar:
 * - Parsing por ferramentas de monitoramento (Vercel, Datadog, etc.)
 * - Filtragem e busca por campos específicos
 * - Correlação de logs por requestId
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  service: string
  environment: string
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const SERVICE_NAME = 'cosmeticos-app'
const ENVIRONMENT = process.env.NODE_ENV || 'development'
const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
    ...context,
  }

  // Em desenvolvimento, formato mais legível
  if (ENVIRONMENT === 'development') {
    const { timestamp, level, message, ...rest } = entry
    const contextStr = Object.keys(rest).length > 2 ? ` ${JSON.stringify(rest)}` : ''
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`
  }

  // Em produção, JSON puro para parsing
  return JSON.stringify(entry)
}

function createLogFunction(level: LogLevel) {
  return (message: string, context?: LogContext) => {
    if (!shouldLog(level)) return

    const formatted = formatLog(level, message, context)

    switch (level) {
      case 'debug':
        console.debug(formatted)
        break
      case 'info':
        console.info(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        break
    }
  }
}

export const logger = {
  debug: createLogFunction('debug'),
  info: createLogFunction('info'),
  warn: createLogFunction('warn'),
  error: createLogFunction('error'),

  /**
   * Cria um logger com contexto fixo (útil para requests)
   */
  child: (baseContext: LogContext) => ({
    debug: (message: string, context?: LogContext) =>
      logger.debug(message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) =>
      logger.info(message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      logger.warn(message, { ...baseContext, ...context }),
    error: (message: string, context?: LogContext) =>
      logger.error(message, { ...baseContext, ...context }),
  }),
}

/**
 * Helper para logar erros com stack trace
 */
export function logError(message: string, error: unknown, context?: LogContext) {
  const errorContext: LogContext = {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }
  logger.error(message, errorContext)
}
