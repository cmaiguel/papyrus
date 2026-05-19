/**
 * Structured logger for Papyrus API routes.
 * Emits JSON lines to stdout — compatible with Vercel log drains.
 *
 * Usage:
 *   const log = createLogger("upload");
 *   log.info("file received", { fileName, fileSizeBytes });
 *   log.error("extraction failed", { err: err.message });
 */

type Level = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: Level;
  service: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function emit(level: Level, service: string, message: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    service,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };

  const line = JSON.stringify(entry);

  if (level === "error") console.error(line);
  else if (level === "warn")  console.warn(line);
  else                        console.log(line);
}

export function createLogger(service: string) {
  return {
    info:  (msg: string, data?: Record<string, unknown>) => emit("info",  service, msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => emit("warn",  service, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => emit("error", service, msg, data),
    debug: (msg: string, data?: Record<string, unknown>) => emit("debug", service, msg, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
