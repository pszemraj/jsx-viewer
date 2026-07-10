import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { ViewerStatusPanel } from "./viewerShell";

type ErrorBoundaryProps = PropsWithChildren;

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <ViewerStatusPanel
          background="#1a1a1a"
          indicatorColor="#ef4444"
          minHeight="100vh"
          title="Render Error"
        >
          <pre
            style={{
              background: "#111",
              border: "1px solid #333",
              borderRadius: "8px",
              padding: "20px",
              overflow: "auto",
              fontSize: "13px",
              lineHeight: 1.6,
              color: "#ef4444",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {this.state.error.toString()}
          </pre>
          {this.state.errorInfo && (
            <details style={{ marginTop: "16px" }}>
              <summary
                style={{
                  cursor: "pointer",
                  color: "#888",
                  fontSize: "13px",
                }}
              >
                Component stack trace
              </summary>
              <pre
                style={{
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  padding: "20px",
                  overflow: "auto",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  color: "#888",
                  marginTop: "8px",
                }}
              >
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </ViewerStatusPanel>
      );
    }

    return this.props.children;
  }
}
