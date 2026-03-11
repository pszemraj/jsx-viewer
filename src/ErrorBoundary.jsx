import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
  }

  componentDidUpdate(prevProps) {
    // Reset error state when children change (new component loaded)
    if (prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, errorInfo: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: "32px",
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            background: "#1a1a1a",
            color: "#f5f5f5",
            minHeight: "100vh",
          }}
        >
          <div
            style={{
              maxWidth: "720px",
              margin: "0 auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#ef4444",
                }}
              />
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 500 }}>
                Render Error
              </h2>
            </div>
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
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
