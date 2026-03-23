/**
 * Structured logger for server-side code.
 * Outputs JSON to console (captured by Vercel log drains).
 * M4: Replaces silent error swallowing across server actions.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  action?: string
  userId?: string
  dealId?: string
  businessId?: string
  duration?: number
  [key: string]: unknown
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  }

  switch (level) {
    case 'error':
      console.error(JSON.stringify(entry))
      break
    case 'warn':
      console.warn(JSON.stringify(entry))
      break
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(JSON.stringify(entry))
      }
      break
    default:
      console.log(JSON.stringify(entry))
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
}

/**
 * Wrap a server action with automatic timing and error logging.
 * Usage: export const myAction = withAction('myAction', async (args) => { ... })
 */
export function withAction<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
) {
  return async (...args: TArgs): Promise<TResult> => {
    const start = performance.now()
    try {
      const result = await fn(...args)
      const duration = Math.round(performance.now() - start)
      if (duration > 1000) {
        logger.warn(`Slow action: ${name}`, { action: name, duration })
      }
      return result
    } catch (error) {
      const duration = Math.round(performance.now() - start)
      logger.error(`Action failed: ${name}`, {
        action: name,
        duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }
}
