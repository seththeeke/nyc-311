/**
 * Structured JSON logging, one JSON object per line, shared across
 * controller/service/dao. Copied from `backend/logger.ts`, never imported
 * (CLAUDE.md §5.4) — the customer shares no code with BoroughSim.
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
