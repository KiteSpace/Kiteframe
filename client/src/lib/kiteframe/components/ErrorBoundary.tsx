import React, { Component, ErrorInfo, ReactNode } from 'react';
import { getGlobalTelemetry, TelemetryEventType } from '../utils/telemetry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: any[];
  isolate?: boolean;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, componentName } = this.props;
    const { errorCount } = this.state;
    const telemetry = getGlobalTelemetry();

    // Log error details
    console.error(`[ErrorBoundary${componentName ? ` - ${componentName}` : ''}] Component error:`, {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      errorCount: errorCount + 1
    });
    
    // Track error in telemetry
    telemetry.track(TelemetryEventType.ERROR, {
      category: 'error-boundary',
      action: 'component-error',
      label: componentName || 'unknown',
      error: error,
      metadata: {
        componentName,
        errorCount: errorCount + 1,
        errorMessage: error.message,
        errorStack: error.stack,
        componentStack: errorInfo.componentStack,
        isIsolated: this.props.isolate
      }
    });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Update state with error details
    this.setState({
      errorInfo,
      errorCount: errorCount + 1
    });

    // Auto-recovery after 5 seconds for non-critical errors
    if (this.props.isolate && errorCount < 3) {
      this.scheduleReset(5000);
      
      // Track auto-recovery attempt
      telemetry.track(TelemetryEventType.USER_ACTION, {
        category: 'error-boundary',
        action: 'auto-recovery-scheduled',
        label: componentName || 'unknown',
        value: 5000,
        metadata: {
          componentName,
          errorCount: errorCount + 1,
          recoveryDelay: 5000
        }
      });
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when specified props change
    if (hasError && resetOnPropsChange) {
      const hasPropsChanged = resetOnPropsChange.some((prop, index) => 
        prop !== prevProps.resetOnPropsChange?.[index]
      );

      if (hasPropsChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  scheduleReset = (delay: number) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  };

  resetErrorBoundary = () => {
    const telemetry = getGlobalTelemetry();
    const { componentName } = this.props;
    const { error, errorCount } = this.state;
    
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    // Track recovery
    telemetry.track(TelemetryEventType.USER_ACTION, {
      category: 'error-boundary',
      action: 'recovered',
      label: componentName || 'unknown',
      metadata: {
        componentName,
        previousError: error?.message,
        errorCount,
        recoveryMethod: this.resetTimeoutId ? 'auto' : 'manual'
      }
    });

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    const { hasError, error, errorCount } = this.state;
    const { children, fallback, isolate, componentName } = this.props;

    if (hasError) {
      // Custom fallback UI
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 border-2 border-red-200 rounded-lg m-4">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            {isolate ? `Component Error${componentName ? ` in ${componentName}` : ''}` : 'Application Error'}
          </h2>
          <p className="text-sm text-red-700 mb-4 text-center max-w-md">
            {error?.message || 'An unexpected error occurred'}
          </p>
          {errorCount >= 3 && (
            <p className="text-xs text-red-600 mb-4">
              Multiple errors detected. Please refresh the page.
            </p>
          )}
          <div className="flex space-x-2">
            <button
              onClick={this.resetErrorBoundary}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              data-testid="error-boundary-retry"
            >
              Try Again
            </button>
            {!isolate && (
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                data-testid="error-boundary-reload"
              >
                Reload Page
              </button>
            )}
          </div>
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4 text-xs text-gray-600 max-w-2xl">
              <summary className="cursor-pointer hover:text-gray-800">
                Developer Details
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded text-left overflow-auto">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => {
    const telemetry = getGlobalTelemetry();
    
    // Track HOC usage on mount
    React.useEffect(() => {
      telemetry.track(TelemetryEventType.USER_ACTION, {
        category: 'error-boundary',
        action: 'hoc-wrapped',
        metadata: {
          componentName: errorBoundaryProps?.componentName || Component.displayName || Component.name
        }
      });
    }, []);
    
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Hook for error recovery
export function useErrorHandler() {
  const telemetry = getGlobalTelemetry();
  
  return (error: Error) => {
    console.error('Error caught by useErrorHandler:', error);
    
    // Track error in telemetry
    telemetry.track(TelemetryEventType.ERROR, {
      category: 'error-handler',
      action: 'hook-error',
      error: error,
      metadata: {
        errorMessage: error.message,
        errorStack: error.stack
      }
    });
    
    // Could integrate with error reporting service here
    throw error; // Re-throw to be caught by nearest ErrorBoundary
  };
}