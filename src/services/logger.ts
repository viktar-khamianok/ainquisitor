export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(private readonly level: LogLevel) {}

  debug(message: string, meta?: unknown) {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: unknown) {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: unknown) {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: unknown) {
    this.log("error", message, meta);
  }

  private log(level: LogLevel, message: string, meta?: unknown) {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.level]) {
      return;
    }

    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${level.toUpperCase()}]`;

    if (meta === undefined) {
      console.log(`${prefix} ${message}`);
      return;
    }

    console.log(`${prefix} ${message}`, meta);
  }
}
