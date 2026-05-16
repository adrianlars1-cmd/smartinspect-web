import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-400" />
            </div>
            <h1 className="text-lg font-bold text-white text-center mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-400 text-center mb-4">
              {this.state.error?.message || 'An unexpected error occurred while rendering the dashboard.'}
            </p>
            <details className="bg-surface border border-border rounded-lg p-3 text-xs text-gray-500 mb-4">
              <summary className="cursor-pointer font-semibold text-gray-300 mb-2">Error details</summary>
              <pre className="overflow-auto max-h-[200px] bg-bg p-2 rounded mt-2 whitespace-pre-wrap break-words">
                {this.state.error?.stack || 'No stack trace available'}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
