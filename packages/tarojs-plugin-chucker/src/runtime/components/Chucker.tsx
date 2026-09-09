import React, { useState, useEffect, useMemo } from "react";
import Taro from "@tarojs/taro";
import { View, Text, ScrollView, Input } from "@tarojs/components";
import { chuckerStore, ChuckerLog, generateCurl, formatJson } from "miniapp-chucker";
import { useVirtualList } from "../hooks/useVirtual";
import { CloseIcon } from "./icons";

export const Chucker: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [logs, setLogs] = useState<ChuckerLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "network" | "native">("all");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"overview" | "request" | "response">(
    "overview",
  );

  // Subscribe to chuckerStore updates
  useEffect(() => {
    const unsubscribe = chuckerStore.subscribe((updatedLogs) => {
      setLogs([...updatedLogs]);
    });
    return unsubscribe;
  }, []);

  const isNetworkLog = (log: ChuckerLog) => {
    if (!log) return false;
    if (log.type === "native") return false;
    return (
      log.type === "network" ||
      log.type === "http" ||
      log.type === "upload" ||
      log.type === "download" ||
      !log.type
    );
  };

  // Filter logs based on search query and tab selection
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Filter by type
      if (filterType === "network" && !isNetworkLog(log)) return false;
      if (filterType === "native" && log.type !== "native") return false;

      // 2. Filter by search query (URL or native plugin name)
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        (log.url && String(log.url).toLowerCase().includes(query)) ||
        (log.requestHeaders && JSON.stringify(log.requestHeaders).toLowerCase().includes(query)) ||
        (log.requestData && JSON.stringify(log.requestData).toLowerCase().includes(query))
      );
    });
  }, [logs, searchQuery, filterType]);

  // Virtualize the logs list to support huge list data
  const { vlChunks, vlStyles } = useVirtualList({
    items: filteredLogs,
    itemHeight: 52,
    chunkSize: 10,
    disabled: !isOpen,
  });

  const selectedLog = useMemo(() => {
    return logs.find((l) => l.id === selectedLogId) || null;
  }, [logs, selectedLogId]);

  // Statistics
  const errorCount = useMemo(() => {
    return logs.filter((log) => {
      if (log.status === "fail" || log.status === "error") return true;
      if (typeof log.status === "number" && log.status >= 400) return true;
      return false;
    }).length;
  }, [logs]);

  const handleClear = () => {
    Taro.showModal({
      title: "Clear Logs",
      content: "Delete all logged requests?",
      success: (res) => {
        if (res.confirm) {
          chuckerStore.clear();
          setSelectedLogId(null);
        }
      },
    });
  };

  const handleClose = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
    } else {
      setIsOpen(false);
    }
  };

  const handleCopyCurl = (log: ChuckerLog) => {
    const curl = generateCurl(log.url, log.method, log.requestHeaders || {}, log.requestData);
    Taro.setClipboardData({
      data: curl,
      success: () => {
        Taro.showToast({
          title: "cURL Copied!",
          icon: "success",
          duration: 1500,
        });
      },
    });
  };

  const handleCopyText = (text: string, title = "Copied!") => {
    Taro.setClipboardData({
      data: text,
      success: () => {
        Taro.showToast({
          title,
          icon: "success",
          duration: 1500,
        });
      },
    });
  };

  const getStatusInfo = (status: string | number | undefined) => {
    if (status === undefined || status === "pending") {
      return { label: "…", color: "#f59e0b" };
    }
    if (status === "fail" || status === "error" || (typeof status === "number" && status >= 400)) {
      return { label: String(status), color: "#ef4444" };
    }
    return { label: String(status), color: "#10b981" };
  };

  const getMethodTagStyle = (method: string) => {
    const m = (method || "").toUpperCase();
    let color = "#a1a1aa";
    let bg = "#27272a";

    switch (m) {
      case "GET":
        color = "#3b82f6";
        bg = "rgba(59, 130, 246, 0.12)";
        break;
      case "POST":
        color = "#10b981";
        bg = "rgba(16, 185, 129, 0.12)";
        break;
      case "PUT":
        color = "#f59e0b";
        bg = "rgba(245, 158, 11, 0.12)";
        break;
      case "DELETE":
        color = "#ef4444";
        bg = "rgba(239, 68, 68, 0.12)";
        break;
      case "NATIVE":
        color = "#06b6d4";
        bg = "rgba(6, 182, 212, 0.12)";
        break;
      case "UPLOAD":
      case "DOWNLOAD":
        color = "#8b5cf6";
        bg = "rgba(139, 92, 246, 0.12)";
        break;
    }

    return {
      fontSize: "9.5px",
      fontWeight: "bold" as const,
      fontFamily: '"SF Mono", Menlo, monospace',
      padding: "1.5px 4px",
      borderRadius: "3px",
      letterSpacing: "0.3px",
      color,
      backgroundColor: bg,
      textAlign: "center" as const,
      display: "inline-block" as const,
    };
  };

  const getMethodColor = (method: string) => {
    switch ((method || "").toUpperCase()) {
      case "GET": return "#3b82f6";
      case "POST": return "#10b981";
      case "PUT": return "#f59e0b";
      case "DELETE": return "#ef4444";
      case "NATIVE": return "#06b6d4";
      case "UPLOAD":
      case "DOWNLOAD": return "#8b5cf6";
      default: return "#f4f4f5";
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // ─── Floating button when closed ───
  if (!isOpen) {
    return (
      <View
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom) + 100px)",
          right: "16px",
          zIndex: 99999,
          width: "46px",
          height: "46px",
          borderRadius: "23px",
          backgroundColor: "#18181b",
          border: "1px solid #3f3f46",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: "18px", fontWeight: "bold", color: "#3b82f6", lineHeight: "1" }}>C</Text>
        {logs.length > 0 && (
          <View
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              backgroundColor: errorCount > 0 ? "#ef4444" : "#10b981",
              color: "#ffffff",
              fontSize: "9px",
              fontWeight: "bold",
              borderRadius: "8px",
              padding: "1px 5px",
              minWidth: "14px",
              textAlign: "center",
            }}
          >
            {logs.length}
          </View>
        )}
      </View>
    );
  }

  // ─── Main Inspector Overlay ───
  return (
    <View
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#121214",
        color: "#f4f4f5",
        zIndex: 100000,
        display: "flex",
        flexDirection: "column",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: "14px",
        overflow: "hidden",
      }}
    >
      {/* ══════════════════ DETAIL VIEW OVERLAY ══════════════════ */}
      {selectedLog && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#121214",
            zIndex: 100001,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Detail Bar */}
          <View
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              backgroundColor: "#18181b",
              borderBottom: "1px solid #27272a",
              gap: "8px",
            }}
          >
            <View
              onClick={() => setSelectedLogId(null)}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                padding: "4px 8px",
                borderRadius: "5px",
                backgroundColor: "#222226",
                flexShrink: 0,
                gap: "2px",
              }}
            >
              <Text style={{ fontSize: "15px", lineHeight: "1", color: "#f4f4f5" }}>‹</Text>
              <Text style={{ fontSize: "12px", fontWeight: 500, color: "#f4f4f5" }}>Back</Text>
            </View>
            <View style={{ flex: 1, overflow: "hidden" }}>
              <Text
                style={{
                  fontSize: "12px",
                  fontFamily: '"SF Mono", Menlo, monospace',
                  color: "#a1a1aa",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "block",
                }}
              >
                {selectedLog.method} {typeof selectedLog.url === "object" ? JSON.stringify(selectedLog.url) : selectedLog.url}
              </Text>
            </View>
            <View style={{ flexShrink: 0 }}>
              {isNetworkLog(selectedLog) && (
                <View
                  onClick={() => handleCopyCurl(selectedLog)}
                  style={{
                    padding: "4px 9px",
                    borderRadius: "5px",
                    backgroundColor: "#3b82f6",
                  }}
                >
                  <Text style={{ fontSize: "11px", fontWeight: 600, color: "#ffffff" }}>cURL</Text>
                </View>
              )}
            </View>
          </View>

          {/* Detail Tabs */}
          <View
            style={{
              display: "flex",
              flexDirection: "row",
              backgroundColor: "#18181b",
              borderBottom: "1px solid #27272a",
            }}
          >
            {(["overview", "request", "response"] as const).map((tab) => {
              const isActive = activeDetailTab === tab;
              return (
                <View
                  key={tab}
                  onClick={() => setActiveDetailTab(tab)}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "10px 0",
                    fontSize: "11px",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#3b82f6" : "#71717a",
                    letterSpacing: "0.5px",
                    borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                  }}
                >
                  {tab.toUpperCase()}
                </View>
              );
            })}
          </View>

          {/* Detail Scroll Content */}
          <ScrollView scrollY style={{ flex: 1, minHeight: 0 }}>
            <View style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* ── 1. Overview Tab ── */}
              {activeDetailTab === "overview" && (
                <>
                  {/* Summary Strip */}
                  <View
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-around",
                      padding: "12px 8px",
                      backgroundColor: "#1c1c20",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                    }}
                  >
                    <View style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                      <Text style={{ fontSize: "9.5px", fontWeight: 600, color: "#71717a", letterSpacing: "0.5px" }}>STATUS</Text>
                      <Text
                        style={{
                          fontSize: "16px",
                          fontWeight: "bold",
                          fontFamily: '"SF Mono", Menlo, monospace',
                          color: getStatusInfo(selectedLog.status).color,
                        }}
                      >
                        {selectedLog.status !== undefined ? String(selectedLog.status).toUpperCase() : "PENDING"}
                      </Text>
                    </View>
                    {selectedLog.duration !== undefined && (
                      <View style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                        <Text style={{ fontSize: "9.5px", fontWeight: 600, color: "#71717a", letterSpacing: "0.5px" }}>LATENCY</Text>
                        <Text style={{ fontSize: "16px", fontWeight: "bold", fontFamily: '"SF Mono", Menlo, monospace', color: "#f4f4f5" }}>
                          {selectedLog.duration}ms
                        </Text>
                      </View>
                    )}
                    <View style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                      <Text style={{ fontSize: "9.5px", fontWeight: 600, color: "#71717a", letterSpacing: "0.5px" }}>METHOD</Text>
                      <Text
                        style={{
                          fontSize: "16px",
                          fontWeight: "bold",
                          fontFamily: '"SF Mono", Menlo, monospace',
                          color: getMethodColor(selectedLog.method),
                        }}
                      >
                        {selectedLog.method}
                      </Text>
                    </View>
                  </View>

                  {/* Info Card */}
                  <View
                    style={{
                      backgroundColor: "#1c1c20",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <View
                      onClick={() => handleCopyText(typeof selectedLog.url === "object" ? JSON.stringify(selectedLog.url) : selectedLog.url, "URL Copied!")}
                      style={{
                        padding: "11px 12px",
                        borderBottom: "1px solid #27272a",
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                      }}
                    >
                      <Text style={{ fontSize: "10.5px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        URL / Path
                      </Text>
                      <Text
                        style={{
                          fontSize: "12px",
                          fontFamily: '"SF Mono", Menlo, monospace',
                          color: "#3b82f6",
                          wordBreak: "break-all",
                          lineHeight: "1.5",
                        }}
                      >
                        {typeof selectedLog.url === "object" ? JSON.stringify(selectedLog.url) : selectedLog.url}
                      </Text>
                      <Text style={{ fontSize: "9.5px", color: "#71717a" }}>Tap to copy</Text>
                    </View>

                    <View
                      style={{
                        padding: "11px 12px",
                        borderBottom: "1px solid #27272a",
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                      }}
                    >
                      <Text style={{ fontSize: "10.5px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Type
                      </Text>
                      <Text style={{ fontSize: "13px", color: "#f4f4f5" }}>
                        {selectedLog.type === "native" ? "Native Plugin Call" : "HTTP Network Request"}
                      </Text>
                    </View>

                    <View
                      style={{
                        padding: "11px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                      }}
                    >
                      <Text style={{ fontSize: "10.5px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Time Initiated
                      </Text>
                      <Text style={{ fontSize: "13px", color: "#f4f4f5" }}>
                        {new Date(selectedLog.startTime).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {/* ── 2. Request Tab ── */}
              {activeDetailTab === "request" && (
                <>
                  {selectedLog.requestHeaders && Object.keys(selectedLog.requestHeaders).length > 0 && (
                    <View
                      style={{
                        backgroundColor: "#1c1c20",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "9px 12px",
                          backgroundColor: "#18181b",
                          borderBottom: "1px solid #27272a",
                        }}
                      >
                        <Text style={{ fontSize: "11px", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Headers
                        </Text>
                        <View
                          onClick={() => handleCopyText(formatJson(selectedLog.requestHeaders))}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            backgroundColor: "#222226",
                            border: "1px solid #27272a",
                          }}
                        >
                          <Text style={{ fontSize: "10px", color: "#a1a1aa", fontWeight: 500 }}>Copy</Text>
                        </View>
                      </View>
                      <View style={{ padding: "12px", backgroundColor: "#101012" }}>
                        <Text
                          style={{
                            fontSize: "11px",
                            fontFamily: '"SF Mono", Menlo, monospace',
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            lineHeight: "1.65",
                            color: "#93c5fd",
                          }}
                        >
                          {formatJson(selectedLog.requestHeaders)}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View
                    style={{
                      backgroundColor: "#1c1c20",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 12px",
                        backgroundColor: "#18181b",
                        borderBottom: "1px solid #27272a",
                      }}
                    >
                      <Text style={{ fontSize: "11px", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Payload Body
                      </Text>
                      {selectedLog.requestData && (
                        <View
                          onClick={() => handleCopyText(formatJson(selectedLog.requestData))}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            backgroundColor: "#222226",
                            border: "1px solid #27272a",
                          }}
                        >
                          <Text style={{ fontSize: "10px", color: "#a1a1aa", fontWeight: 500 }}>Copy</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ padding: "12px", backgroundColor: "#101012" }}>
                      {selectedLog.requestData ? (
                        <Text
                          style={{
                            fontSize: "11px",
                            fontFamily: '"SF Mono", Menlo, monospace',
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            lineHeight: "1.65",
                            color: "#86efac",
                          }}
                        >
                          {formatJson(selectedLog.requestData)}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: "12px", color: "#71717a", fontStyle: "italic" }}>
                          No payload body
                        </Text>
                      )}
                    </View>
                  </View>
                </>
              )}

              {/* ── 3. Response Tab ── */}
              {activeDetailTab === "response" && (
                <>
                  {selectedLog.error && (
                    <View
                      style={{
                        padding: "10px 12px",
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "7px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <Text style={{ fontSize: "11px", fontWeight: "bold", color: "#ef4444" }}>
                        Error Encountered
                      </Text>
                      <Text
                        style={{
                          fontSize: "11.5px",
                          fontFamily: '"SF Mono", Menlo, monospace',
                          color: "#ef4444",
                          wordBreak: "break-all",
                          lineHeight: "1.5",
                        }}
                      >
                        {selectedLog.error}
                      </Text>
                    </View>
                  )}

                  {selectedLog.responseHeaders && Object.keys(selectedLog.responseHeaders).length > 0 && (
                    <View
                      style={{
                        backgroundColor: "#1c1c20",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "9px 12px",
                          backgroundColor: "#18181b",
                          borderBottom: "1px solid #27272a",
                        }}
                      >
                        <Text style={{ fontSize: "11px", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Headers
                        </Text>
                        <View
                          onClick={() => handleCopyText(formatJson(selectedLog.responseHeaders))}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            backgroundColor: "#222226",
                            border: "1px solid #27272a",
                          }}
                        >
                          <Text style={{ fontSize: "10px", color: "#a1a1aa", fontWeight: 500 }}>Copy</Text>
                        </View>
                      </View>
                      <View style={{ padding: "12px", backgroundColor: "#101012" }}>
                        <Text
                          style={{
                            fontSize: "11px",
                            fontFamily: '"SF Mono", Menlo, monospace',
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            lineHeight: "1.65",
                            color: "#93c5fd",
                          }}
                        >
                          {formatJson(selectedLog.responseHeaders)}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View
                    style={{
                      backgroundColor: "#1c1c20",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 12px",
                        backgroundColor: "#18181b",
                        borderBottom: "1px solid #27272a",
                      }}
                    >
                      <Text style={{ fontSize: "11px", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Response Body
                      </Text>
                      {selectedLog.responseData && (
                        <View
                          onClick={() => handleCopyText(formatJson(selectedLog.responseData))}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            backgroundColor: "#222226",
                            border: "1px solid #27272a",
                          }}
                        >
                          <Text style={{ fontSize: "10px", color: "#a1a1aa", fontWeight: 500 }}>Copy</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ padding: "12px", backgroundColor: "#101012" }}>
                      {selectedLog.responseData ? (
                        <Text
                          style={{
                            fontSize: "11px",
                            fontFamily: '"SF Mono", Menlo, monospace',
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            lineHeight: "1.65",
                            color: "#86efac",
                          }}
                        >
                          {formatJson(selectedLog.responseData)}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: "12px", color: "#71717a", fontStyle: "italic" }}>
                          Empty response body
                        </Text>
                      )}
                    </View>
                  </View>
                </>
              )}
              <View style={{ height: "40px" }} />
            </View>
          </ScrollView>
        </View>
      )}

      {/* ══════════════════ MAIN LOGS LIST VIEW ══════════════════ */}
      {/* List Header */}
      <View
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          backgroundColor: "#18181b",
          borderBottom: "1px solid #27272a",
        }}
      >
        <View style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}>
          <Text style={{ fontSize: "16px", fontWeight: "bold", color: "#f4f4f5", letterSpacing: "-0.3px" }}>
            Chucker
          </Text>
          <View style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "4px" }}>
            <Text
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#a1a1aa",
                backgroundColor: "#27272a",
                padding: "2px 6px",
                borderRadius: "10px",
              }}
            >
              {logs.length}
            </Text>
            {errorCount > 0 && (
              <Text
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#ef4444",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  padding: "2px 6px",
                  borderRadius: "10px",
                }}
              >
                {errorCount} err
              </Text>
            )}
          </View>
        </View>
        <View style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}>
          <View
            onClick={handleClear}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid #27272a",
            }}
          >
            <Text style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: 500 }}>Clear</Text>
          </View>
          <View onClick={handleClose} style={{ padding: "4px 6px" }}>
            <CloseIcon size={18} color="#a1a1aa" />
          </View>
        </View>
      </View>

      {/* Toolbar: Segmented Filter Tabs + Search Box */}
      <View
        style={{
          padding: "8px 12px",
          backgroundColor: "#18181b",
          borderBottom: "1px solid #27272a",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {/* Segmented control */}
        <View
          style={{
            display: "flex",
            flexDirection: "row",
            backgroundColor: "#121214",
            borderRadius: "7px",
            padding: "2px",
            border: "1px solid #27272a",
          }}
        >
          {(["all", "network", "native"] as const).map((type) => {
            const isActive = filterType === type;
            return (
              <View
                key={type}
                onClick={() => setFilterType(type)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "6px 0",
                  fontSize: "12px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#f4f4f5" : "#71717a",
                  backgroundColor: isActive ? "#222226" : "transparent",
                  borderRadius: "5px",
                }}
              >
                {type === "all" ? "All" : type === "network" ? "Network" : "Native"}
              </View>
            );
          })}
        </View>

        {/* Search Box */}
        <View
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#121214",
            border: "1px solid #27272a",
            borderRadius: "7px",
            padding: "0 9px",
            gap: "6px",
            height: "34px",
          }}
        >
          <Text style={{ fontSize: "12px", opacity: 0.6 }}>🔍</Text>
          <Input
            value={searchQuery}
            onInput={(e) => setSearchQuery(e.detail.value)}
            placeholder="Filter URL, payload…"
            placeholderStyle="color: #71717a"
            style={{
              flex: 1,
              fontSize: "12px",
              color: "#f4f4f5",
              backgroundColor: "transparent",
              border: "none",
              height: "100%",
              padding: 0,
            }}
          />
          {searchQuery && (
            <View onClick={() => setSearchQuery("")} style={{ padding: "2px 5px" }}>
              <Text style={{ fontSize: "14px", color: "#71717a" }}>×</Text>
            </View>
          )}
        </View>
      </View>

      {/* Logs List Container */}
      <View style={{ flex: 1, overflowY: "auto" }}>
        {filteredLogs.length === 0 ? (
          <View style={{ padding: "70px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <Text style={{ fontSize: "15px", fontWeight: 600, color: "#a1a1aa" }}>No transactions</Text>
            <Text style={{ fontSize: "12px", color: "#71717a" }}>Network requests and native calls appear here</Text>
          </View>
        ) : (
          vlChunks.map((chunk, ci) => (
            <View key={ci} id={`vl-chunk-${ci}`} className="vl-chunk" style={vlStyles[ci]}>
              {chunk.map((log) => {
                const statusInfo = getStatusInfo(log.status);
                return (
                  <View
                    key={log.id}
                    onClick={() => {
                      setSelectedLogId(log.id);
                      setActiveDetailTab("overview");
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      padding: "10px 12px",
                      borderBottom: "1px solid #202024",
                      backgroundColor: "#121214",
                      borderLeft:
                        statusInfo.color === "#ef4444"
                          ? "3px solid #ef4444"
                          : statusInfo.color === "#f59e0b"
                            ? "3px solid #f59e0b"
                            : "3px solid transparent",
                      gap: "8px",
                    }}
                  >
                    {/* Badges column */}
                    <View
                      style={{
                        flexShrink: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        width: "50px",
                        gap: "2px",
                      }}
                    >
                      <Text style={getMethodTagStyle(log.method)}>{log.method}</Text>
                      <Text
                        style={{
                          fontSize: "10px",
                          fontWeight: "bold",
                          fontFamily: '"SF Mono", Menlo, monospace',
                          color: statusInfo.color,
                        }}
                      >
                        {statusInfo.label}
                      </Text>
                    </View>

                    {/* URL & Meta */}
                    <View style={{ flex: 1, overflow: "hidden" }}>
                      <Text
                        style={{
                          fontSize: "12.5px",
                          color: "#f4f4f5",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "block",
                        }}
                      >
                        {typeof log.url === "object" ? JSON.stringify(log.url) : log.url}
                      </Text>
                      <View style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                        <Text style={{ fontSize: "10px", color: "#71717a" }}>{formatTime(log.startTime)}</Text>
                        {log.duration !== undefined && (
                          <>
                            <Text style={{ fontSize: "10px", color: "#71717a" }}>·</Text>
                            <Text style={{ fontSize: "10px", color: "#71717a" }}>{log.duration}ms</Text>
                          </>
                        )}
                      </View>
                    </View>

                    {/* Chevron */}
                    <Text style={{ fontSize: "16px", color: "#71717a", flexShrink: 0 }}>›</Text>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </View>
    </View>
  );
};
