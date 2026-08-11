/**
 * Structured JSON logging, shared across controller/service/dao (per
 * CLAUDE.md §5.2's "Logging by layer" rule). Every log line is one JSON
 * object — this is also the substrate `1-data-ingestion.md` §8's
 * CDK-declared `MetricFilter`s extract custom metrics from, so the shape
 * needs to stay consistent and parseable, not just human-readable.
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
