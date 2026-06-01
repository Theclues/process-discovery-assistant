import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlowchartPanelProps {
  mermaidDiagram: string | null;
  nodeCount: number;
}

// ---------------------------------------------------------------------------
// Inline keyframes (injected once via <style>)
// ---------------------------------------------------------------------------

const SPIN_KEYFRAMES = `
@keyframes fp-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes fp-fade-in {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes fp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes fp-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mermaid module shape after dynamic import */
type MermaidModule = {
  initialize: (c: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

/** Check whether the document is in dark mode */
function isDarkMode(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/** Sanitise SVG string so it can be safely injected via dangerouslySetInnerHTML */
function sanitiseSvg(raw: string): string {
  return raw.replace(/<script[\s\S]*?<\/script>/gi, "");
}

// ---------------------------------------------------------------------------
// Inline SVG icons (used throughout the component)
// ---------------------------------------------------------------------------

/** Flowchart / network illustration used in the empty state */
function FlowchartNetworkIcon() {
  return (
    <svg
      width="160"
      height="160"
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: "fp-float 4s ease-in-out infinite" }}
    >
      <defs>
        <radialGradient id="fp-glow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <filter id="fp-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="var(--accent)" floodOpacity="0.25" />
        </filter>
      </defs>
      <circle cx="80" cy="75" r="70" fill="url(#fp-glow)" />

      {/* Connector lines */}
      <line x1="42" y1="38" x2="68" y2="60" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
      <line x1="92" y1="60" x2="118" y2="38" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
      <line x1="80" y1="88" x2="80" y2="120" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
      <line x1="56" y1="74" x2="36" y2="74" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />

      {/* Arrowheads */}
      <polygon points="64,58 70,66 66,54" fill="var(--accent)" opacity="0.6" />
      <polygon points="96,58 94,54 90,66" fill="var(--accent)" opacity="0.6" />
      <polygon points="76,116 80,108 84,116" fill="var(--accent)" opacity="0.6" />
      <polygon points="40,70 32,74 40,78" fill="var(--accent)" opacity="0.6" />

      {/* Nodes */}
      <rect x="35" y="28" width="26" height="26" rx="6" fill="var(--accent)" opacity="0.9" filter="url(#fp-shadow)" />
      <rect x="105" y="28" width="26" height="26" rx="8" fill="var(--bg-card)" stroke="var(--accent)" strokeWidth="2" filter="url(#fp-shadow)" />
      <circle cx="80" cy="74" r="16" fill="var(--bg-card)" stroke="var(--accent)" strokeWidth="2.5" filter="url(#fp-shadow)" />
      <rect x="25" y="63" width="22" height="22" rx="7" fill="var(--bg-card)" stroke="var(--accent)" strokeWidth="2" filter="url(#fp-shadow)" />
      <rect x="28" y="66" width="16" height="16" rx="4" fill="none" stroke="var(--accent)" strokeWidth="1.2" opacity="0.5" />
      <rect x="70" y="110" width="20" height="20" rx="4" fill="var(--accent)" opacity="0.6" transform="rotate(45 80 120)" filter="url(#fp-shadow)" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <polyline points="23 20 23 14 17 14" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ErrorCircleIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Shared style factory for toolbar buttons
// ---------------------------------------------------------------------------

function toolbarButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    padding: 0,
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: disabled ? "transparent" : "var(--bg)",
    color: disabled ? "var(--fg-tertiary)" : "var(--fg-secondary)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
    outline: "none",
  };
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ nodeCount }: { nodeCount: number }) {
  const remaining = Math.max(0, 3 - nodeCount);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 360,
        padding: "48px 24px",
        animation: "fp-fade-in 0.5s ease-out",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <FlowchartNetworkIcon />
      </div>

      <h2
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          color: "var(--fg)",
          letterSpacing: "-0.01em",
          lineHeight: 1.4,
          textAlign: "center",
        }}
      >
        构建您的流程图
      </h2>

      <p
        style={{
          margin: "8px 0 0",
          fontSize: 14,
          color: "var(--fg-secondary)",
          lineHeight: 1.6,
          textAlign: "center",
          maxWidth: 360,
        }}
      >
        添加至少 3 个流程节点，系统将自动为您生成专业的流程图
      </p>

      <div
        style={{
          marginTop: 24,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 18px",
          borderRadius: "var(--radius)",
          background: "var(--bg-muted)",
          border: "1px solid var(--border)",
          fontSize: 13,
          color: "var(--fg-secondary)",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: nodeCount >= 3 ? "var(--accent)" : "var(--fg-tertiary)",
            flexShrink: 0,
          }}
        />
        <span>
          已添加 <strong style={{ color: "var(--fg)", fontWeight: 600 }}>{nodeCount}</strong>{" "}
          个节点
          {remaining > 0 && (
            <>
              ，还需{" "}
              <strong style={{ color: "var(--fg)", fontWeight: 600 }}>{remaining}</strong> 个
            </>
          )}
          {remaining === 0 && (
            <span style={{ color: "var(--accent)" }}> — 即将生成</span>
          )}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 360,
        gap: 20,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "3px solid var(--bg-muted)",
          borderTopColor: "var(--accent)",
          animation: "fp-spin 0.8s linear infinite",
        }}
      />
      <span
        style={{
          fontSize: 14,
          color: "var(--fg-secondary)",
          animation: "fp-pulse 1.8s ease-in-out infinite",
        }}
      >
        渲染中...
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ error, rawCode }: { error: string; rawCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available – silently ignore
    }
  }, [rawCode]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 24px 24px",
        height: "100%",
        overflow: "auto",
        animation: "fp-fade-in 0.4s ease-out",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <ErrorCircleIcon />
      </div>

      <h3
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: "var(--fg)",
          textAlign: "center",
        }}
      >
        渲染失败
      </h3>

      <p
        style={{
          margin: "8px 0 0",
          fontSize: 13,
          color: "var(--fg-secondary)",
          textAlign: "center",
          maxWidth: 420,
          lineHeight: 1.6,
        }}
      >
        {error}
      </p>

      {/* Raw code block */}
      <div
        style={{
          marginTop: 24,
          width: "100%",
          maxWidth: 540,
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "var(--bg-muted)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-card)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--fg-tertiary)", fontWeight: 500 }}>
            Mermaid 源代码
          </span>
          <button
            onClick={handleCopy}
            style={{
              padding: "3px 10px",
              fontSize: 11,
              color: copied ? "var(--accent)" : "var(--fg-secondary)",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-muted)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            {copied ? "已复制" : "复制"}
          </button>
        </div>

        <pre
          style={{
            margin: 0,
            padding: "16px 14px",
            fontSize: 12,
            fontFamily:
              "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace",
            color: "var(--fg-secondary)",
            lineHeight: 1.7,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {rawCode}
        </pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FlowchartPanel({ mermaidDiagram, nodeCount }: FlowchartPanelProps) {
  // -- state ----------------------------------------------------------------
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const styleInjectedRef = useRef(false);

  // -- inject keyframe styles once ------------------------------------------
  useEffect(() => {
    if (styleInjectedRef.current) return;
    const el = document.createElement("style");
    el.textContent = SPIN_KEYFRAMES;
    document.head.appendChild(el);
    styleInjectedRef.current = true;
    return () => {
      el.remove();
      styleInjectedRef.current = false;
    };
  }, []);

  // -- dark-mode flag -------------------------------------------------------
  const dark = typeof document !== "undefined" && isDarkMode();

  // -- render Mermaid diagram -----------------------------------------------
  useEffect(() => {
    // Guard: need both a diagram string and at least 3 nodes
    if (!mermaidDiagram || nodeCount < 3) {
      setSvgContent(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function renderDiagram(code: string) {
      setLoading(true);
      setError(null);
      setSvgContent(null);

      try {
        // Dynamic import – tree-shake friendly
        const mod = await import("mermaid");
        const mermaid = (
          mod as { default?: MermaidModule }
        ).default as MermaidModule | undefined;

        if (!mermaid) {
          throw new Error(
            "Mermaid 库加载失败，请检查网络连接后刷新页面重试",
          );
        }

        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "default",
          securityLevel: "loose",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
        } as Record<string, unknown>);

        const { svg } = await mermaid.render("mermaid-diag", code);

        if (cancelled) return;

        setSvgContent(sanitiseSvg(svg));
        setZoom(1);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "渲染流程图时发生未知错误，请检查 Mermaid 语法";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    renderDiagram(mermaidDiagram);

    return () => {
      cancelled = true;
    };
  }, [mermaidDiagram, nodeCount, dark]);

  // -- zoom handlers --------------------------------------------------------
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 3)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 0.25)), []);
  const handleZoomReset = useCallback(() => setZoom(1), []);

  // -- export handler -------------------------------------------------------
  const handleExport = useCallback(() => {
    if (!svgContent) return;
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svgContent}`], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `flowchart-${Date.now()}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [svgContent]);

  // -- toolbar state --------------------------------------------------------
  const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom]);

  // =========================================================================
  // Branch on state
  // =========================================================================

  // --- Empty state ---
  if (nodeCount < 3) {
    return <EmptyState nodeCount={nodeCount} />;
  }

  // --- Loading state ---
  if (loading) {
    return <LoadingState />;
  }

  // --- Error state ---
  if (error) {
    return <ErrorState error={error} rawCode={mermaidDiagram ?? ""} />;
  }

  // --- Rendered state ---
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        animation: "fp-fade-in 0.35s ease-out",
      }}
    >
      {/* ================================================================= */}
      {/* TOOLBAR                                                           */}
      {/* ================================================================= */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-card)",
          flexShrink: 0,
        }}
      >
        {/* Left group: zoom controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.25}
            title="缩小"
            style={toolbarButtonStyle(zoom <= 0.25)}
            onMouseEnter={(e) => {
              if (zoom > 0.25) {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-muted)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow-sm)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
            }}
          >
            <ZoomOutIcon />
          </button>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 46,
              padding: "3px 4px",
              fontSize: 12,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color: "var(--fg-secondary)",
              userSelect: "none",
            }}
          >
            {zoomPercent}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            title="放大"
            style={toolbarButtonStyle(zoom >= 3)}
            onMouseEnter={(e) => {
              if (zoom < 3) {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-muted)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow-sm)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
            }}
          >
            <ZoomInIcon />
          </button>

          <div
            style={{
              width: 1,
              height: 20,
              background: "var(--border)",
              margin: "0 6px",
            }}
          />

          <button
            onClick={handleZoomReset}
            disabled={zoom === 1}
            title="重置缩放"
            style={toolbarButtonStyle(zoom === 1)}
            onMouseEnter={(e) => {
              if (zoom !== 1) {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-muted)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow-sm)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
            }}
          >
            <ResetIcon />
          </button>
        </div>

        {/* Right group: export */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={handleExport}
            disabled={!svgContent}
            title="导出 SVG"
            style={{
              ...toolbarButtonStyle(!svgContent),
              width: "auto",
              gap: 5,
              padding: "4px 12px",
            }}
            onMouseEnter={(e) => {
              if (svgContent) {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-muted)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow-sm)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
            }}
          >
            <ExportIcon />
            <span style={{ fontSize: 12, fontWeight: 500 }}>导出</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SVG VIEWPORT                                                      */}
      {/* ================================================================= */}
      <div
        ref={svgWrapperRef}
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "var(--bg-muted)",
          backgroundImage:
            "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
            transition: "transform 0.15s ease-out",
            display: "inline-block",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow)",
            background: "var(--bg)",
            maxWidth: "100%",
          }}
          dangerouslySetInnerHTML={{ __html: svgContent ?? "" }}
        />
      </div>

      {/* ================================================================= */}
      {/* FOOTER                                                            */}
      {/* ================================================================= */}
      <div
        style={{
          padding: "5px 14px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-card)",
          fontSize: 11,
          color: "var(--fg-tertiary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        <span>
          共{" "}
          <strong style={{ color: "var(--fg-secondary)", fontWeight: 600 }}>
            {nodeCount}
          </strong>{" "}
          个节点
        </span>
        <span>缩放 {zoomPercent}%</span>
      </div>
    </div>
  );
}
