interface FrameMetrics {
  fps: number;
  frameTime: number;
  frames: number;
  droppedFrames: number;
}

interface BenchmarkResult {
  name: string;
  duration: number;
  metrics: FrameMetrics;
  timestamp: Date;
}

class PerformanceBenchmark {
  private frameCount = 0;
  private lastFrameTime = 0;
  private frameTimes: number[] = [];
  private animationFrameId: number | null = null;
  private isRunning = false;
  private results: BenchmarkResult[] = [];
  private startTime = 0;
  private currentBenchmarkName = '';

  start(name: string): void {
    if (this.isRunning) {
      this.stop();
    }
    
    this.currentBenchmarkName = name;
    this.frameCount = 0;
    this.frameTimes = [];
    this.lastFrameTime = performance.now();
    this.startTime = performance.now();
    this.isRunning = true;
    
    this.measureFrame();
  }

  private measureFrame = (): void => {
    if (!this.isRunning) return;
    
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    if (delta > 0 && delta < 1000) {
      this.frameTimes.push(delta);
      this.frameCount++;
    }
    
    this.animationFrameId = requestAnimationFrame(this.measureFrame);
  };

  stop(): BenchmarkResult | null {
    if (!this.isRunning) return null;
    
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    const duration = performance.now() - this.startTime;
    const metrics = this.calculateMetrics();
    
    const result: BenchmarkResult = {
      name: this.currentBenchmarkName,
      duration,
      metrics,
      timestamp: new Date(),
    };
    
    this.results.push(result);
    return result;
  }

  private calculateMetrics(): FrameMetrics {
    if (this.frameTimes.length === 0) {
      return { fps: 0, frameTime: 0, frames: 0, droppedFrames: 0 };
    }
    
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = 1000 / avgFrameTime;
    const droppedFrames = this.frameTimes.filter(t => t > 16.67).length;
    
    return {
      fps: Math.round(fps * 10) / 10,
      frameTime: Math.round(avgFrameTime * 100) / 100,
      frames: this.frameCount,
      droppedFrames,
    };
  }

  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  clearResults(): void {
    this.results = [];
  }

  printSummary(): void {
    if (this.results.length === 0) {
      console.log('[Benchmark] No results to display');
      return;
    }
    
    console.group('[Benchmark] Performance Summary');
    for (const result of this.results) {
      console.log(`${result.name}:`);
      console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);
      console.log(`  FPS: ${result.metrics.fps}`);
      console.log(`  Avg Frame Time: ${result.metrics.frameTime}ms`);
      console.log(`  Dropped Frames: ${result.metrics.droppedFrames}/${result.metrics.frames}`);
    }
    console.groupEnd();
  }
}

export const benchmark = new PerformanceBenchmark();

export function measureRenderTime<T>(name: string, fn: () => T): T {
  if (!import.meta.env.DEV) return fn();
  
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  if (duration > 16) {
    console.warn(`[perf] ${name} took ${duration.toFixed(2)}ms (exceeds frame budget)`);
  }
  
  return result;
}

export function createRenderCounter(componentName: string) {
  let renderCount = 0;
  let lastLogTime = 0;
  
  return {
    count(): void {
      renderCount++;
      const now = Date.now();
      if (now - lastLogTime > 5000 && import.meta.env.DEV) {
        console.log(`[render-count] ${componentName}: ${renderCount} renders in last 5s`);
        renderCount = 0;
        lastLogTime = now;
      }
    },
    reset(): void {
      renderCount = 0;
      lastLogTime = Date.now();
    },
  };
}

export type { BenchmarkResult, FrameMetrics };
