type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

interface LoggerConfig {
  level: LogLevel;
  enabledCategories: Set<string>;
  samplingRates: Map<string, number>;
  samplingCounters: Map<string, number>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

const config: LoggerConfig = {
  level: import.meta.env.DEV ? 'warn' : 'none',
  enabledCategories: new Set(['error', 'warn']),
  samplingRates: new Map([
    ['drag', 0.01],
    ['hover', 0.001],
    ['render', 0.01],
    ['selection', 0.1],
  ]),
  samplingCounters: new Map(),
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

function shouldSample(category: string): boolean {
  const rate = config.samplingRates.get(category);
  if (rate === undefined) return true;
  
  const counter = (config.samplingCounters.get(category) || 0) + 1;
  config.samplingCounters.set(category, counter);
  
  return counter % Math.floor(1 / rate) === 0;
}

export const logger = {
  debug(category: string, message: string, ...args: unknown[]): void {
    if (shouldLog('debug') && shouldSample(category)) {
      console.log(`[${category}]`, message, ...args);
    }
  },

  info(category: string, message: string, ...args: unknown[]): void {
    if (shouldLog('info') && shouldSample(category)) {
      console.log(`[${category}]`, message, ...args);
    }
  },

  warn(category: string, message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.warn(`[${category}]`, message, ...args);
    }
  },

  error(category: string, message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error(`[${category}]`, message, ...args);
    }
  },

  setLevel(level: LogLevel): void {
    config.level = level;
  },

  enableCategory(category: string): void {
    config.enabledCategories.add(category);
  },

  disableCategory(category: string): void {
    config.enabledCategories.delete(category);
  },

  setSamplingRate(category: string, rate: number): void {
    config.samplingRates.set(category, Math.max(0, Math.min(1, rate)));
  },

  resetSamplingCounters(): void {
    config.samplingCounters.clear();
  },
};

export const perf = {
  marks: new Map<string, number>(),

  mark(name: string): void {
    if (!import.meta.env.DEV) return;
    this.marks.set(name, performance.now());
  },

  measure(name: string, startMark: string): number | null {
    if (!import.meta.env.DEV) return null;
    const start = this.marks.get(startMark);
    if (start === undefined) return null;
    const duration = performance.now() - start;
    this.marks.delete(startMark);
    return duration;
  },

  measureAndLog(name: string, startMark: string, thresholdMs = 16): void {
    if (!import.meta.env.DEV) return;
    const duration = this.measure(name, startMark);
    if (duration !== null && duration > thresholdMs) {
      console.warn(`[perf] ${name}: ${duration.toFixed(2)}ms (exceeded ${thresholdMs}ms threshold)`);
    }
  },
};

export type { LogLevel };
