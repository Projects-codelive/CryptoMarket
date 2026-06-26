import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full text-[#848e9c] text-sm">
          {this.props.fallback || 'Chart failed to load'}
        </div>
      );
    }
    return this.props.children;
  }
}
