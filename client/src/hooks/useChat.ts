import { useState, useCallback, useRef } from "react";
import type { ChatResponse, SessionResponse, ConcludeResponse, Report, Completeness } from "../types";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  state?: string;
  gapCount?: number;
}

interface ChatState {
  sessionId: string | null;
  messages: Message[];
  state: string;
  stateLabel: string;
  nodeCount: number;
  edgeCount: number;
  confidence: number;
  gapCount: number;
  mermaidDiagram: string | null;
  completeness: Completeness | null;
  isProcessing: boolean;
  isStreaming: boolean;
  error: string | null;
  report: Report | null;
}

export function useChat() {
  const [chatState, setChatState] = useState<ChatState>({
    sessionId: null,
    messages: [],
    state: "ONBOARDING",
    stateLabel: "初始化",
    nodeCount: 0,
    edgeCount: 0,
    confidence: 0,
    gapCount: 0,
    mermaidDiagram: null,
    completeness: null,
    isProcessing: false,
    isStreaming: false,
    error: null,
    report: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const initSession = useCallback(async (organizationId?: string, employeeId?: string, engagementId?: string) => {
    setChatState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const res = await fetch("/api/session/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(organizationId ? { organizationId, employeeId, engagementId } : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SessionResponse = await res.json();
      setChatState(prev => ({
        ...prev,
        sessionId: data.sessionId,
        state: data.state,
        stateLabel: data.stateLabel,
        messages: [{
          role: "assistant",
          content: data.message,
          timestamp: new Date().toISOString(),
          state: data.state,
        }],
        isProcessing: false,
      }));
    } catch (err: unknown) {
      setChatState(prev => ({
        ...prev,
        isProcessing: false,
        error: err instanceof Error ? err.message : "初始化失败",
      }));
    }
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    const sessionId = chatState.sessionId;
    if (!sessionId || chatState.isProcessing) return;

    const userMsg: Message = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      isProcessing: true,
      isStreaming: true,
      error: null,
    }));

    // Add a streaming placeholder
    const streamPlaceholder: Message = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, streamPlaceholder],
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let finalData: ChatResponse | null = null;
      let streamedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "token") {
                streamedText += parsed.token;
                setChatState(prev => {
                  const msgs = [...prev.messages];
                  const last = msgs[msgs.length - 1];
                  if (last && last.isStreaming) {
                    msgs[msgs.length - 1] = { ...last, content: streamedText };
                  }
                  return { ...prev, messages: msgs };
                });
              } else if (parsed.type === "final") {
                finalData = parsed;
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      }

      // Finalize
      if (finalData) {
        setChatState(prev => {
          const msgs = [...prev.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.isStreaming) {
            msgs[msgs.length - 1] = {
              ...last,
              content: finalData!.message,
              isStreaming: false,
              state: finalData!.state,
              gapCount: finalData!.gapCount,
            };
          }
          return {
            ...prev,
            messages: msgs,
            state: finalData!.state,
            stateLabel: finalData!.stateLabel,
            nodeCount: finalData!.nodeCount,
            edgeCount: finalData!.edgeCount,
            confidence: finalData!.confidence,
            gapCount: finalData!.gapCount,
            mermaidDiagram: finalData!.mermaidDiagram || prev.mermaidDiagram,
            completeness: finalData!.completeness ?? prev.completeness,
            isProcessing: false,
            isStreaming: false,
            error: null,
          };
        });
      } else {
        // Non-streaming fallback: request was fully streamed without final event
        // Try non-streaming
        const fallbackRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message }),
        });
        const fbData: ChatResponse = await fallbackRes.json();
        setChatState(prev => {
          const msgs = [...prev.messages];
          msgs[msgs.length - 1] = {
            role: "assistant",
            content: fbData.message,
            timestamp: new Date().toISOString(),
            state: fbData.state,
            gapCount: fbData.gapCount,
          };
          return {
            ...prev,
            messages: msgs,
            state: fbData.state,
            stateLabel: fbData.stateLabel,
            nodeCount: fbData.nodeCount,
            edgeCount: fbData.edgeCount,
            confidence: fbData.confidence,
            gapCount: fbData.gapCount,
            mermaidDiagram: fbData.mermaidDiagram || prev.mermaidDiagram,
            completeness: fbData.completeness ?? prev.completeness,
            isProcessing: false,
            isStreaming: false,
            error: null,
          };
        });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setChatState(prev => {
        const msgs = [...prev.messages];
        // Remove streaming placeholder
        if (msgs[msgs.length - 1]?.isStreaming) msgs.pop();
        return {
          ...prev,
          messages: msgs,
          isProcessing: false,
          isStreaming: false,
          error: err instanceof Error ? err.message : "发送失败，请重试",
        };
      });
    }
  }, [chatState.sessionId, chatState.isProcessing]);

  const concludeSession = useCallback(async () => {
    const sessionId = chatState.sessionId;
    if (!sessionId || chatState.isProcessing) return;

    setChatState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const res = await fetch("/api/conclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ConcludeResponse = await res.json();

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, {
          role: "assistant",
          content: data.message,
          timestamp: new Date().toISOString(),
          state: data.state,
        }],
        state: data.state,
        stateLabel: data.stateLabel,
        mermaidDiagram: data.mermaidDiagram,
        report: data.report,
        isProcessing: false,
      }));
    } catch (err: unknown) {
      setChatState(prev => ({
        ...prev,
        isProcessing: false,
        error: err instanceof Error ? err.message : "操作失败",
      }));
    }
  }, [chatState.sessionId, chatState.isProcessing]);

  const resetSession = useCallback(() => {
    abortRef.current?.abort();
    setChatState({
      sessionId: null,
      messages: [],
      state: "ONBOARDING",
      stateLabel: "初始化",
      nodeCount: 0,
      edgeCount: 0,
      confidence: 0,
      gapCount: 0,
      mermaidDiagram: null,
      completeness: null,
      isProcessing: false,
      isStreaming: false,
      error: null,
      report: null,
    });
  }, []);

  return {
    ...chatState,
    initSession,
    sendMessage,
    concludeSession,
    resetSession,
  };
}
