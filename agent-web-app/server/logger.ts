/**
 * Structured JSON logging, copied from backend/logger.ts (CLAUDE.md §5.5:
 * copied, never imported). One JSON object per line.
 */

export interface LogContext {
  [key: string]: unknown;
}

type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, context: LogContext): void {
  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logInfo(message: string, context: LogContext = {}): void {
  write("info", message, context);
}

export function logWarn(message: string, context: LogContext = {}): void {
  write("warn", message, context);
}

export function logError(message: string, context: LogContext = {}): void {
  write("error", message, context);
}
