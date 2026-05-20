import { Component, ReactNode } from "react";

export class MarkdownErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div className="text-red-500 border p-2">Markdown Render Error: {this.state.error?.message}</div>;
    return this.props.children;
  }
}
