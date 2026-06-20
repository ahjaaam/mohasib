type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function serializeError(error: unknown) {
  if (!(error instanceof Error)) return { message: String(error) };
  return {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  };
}

export function logEvent(level: LogLevel, event: string, context: LogContext = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "mohasib-web",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    ...context,
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export function reportError(event: string, error: unknown, context: LogContext = {}) {
  logEvent("error", event, { ...context, error: serializeError(error) });
}
