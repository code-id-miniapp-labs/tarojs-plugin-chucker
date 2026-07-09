import React, { useState, useEffect, useMemo } from "react";
import Taro from "@tarojs/taro";
import { View, Text, ScrollView, Input, Button } from "@tarojs/components";
import { chuckerStore } from "../store";
import { ChuckerLog } from "../interceptor";
import { generateCurl, formatJson } from "../utils";
import { useVirtualList } from "../hooks/useVirtual";
import { CloseIcon, CopyIcon, BackIcon, TrashIcon, BugIcon } from "./icons";

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

  // Filter logs based on search query and tab selection
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Filter by type
      if (filterType === "network" && log.type !== "network") return false;
      if (filterType === "native" && log.type !== "native") return false;

      // 2. Filter by search query (URL or native plugin name)
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        log.url.toLowerCase().includes(query) ||
        (log.requestHeaders && JSON.stringify(log.requestHeaders).toLowerCase().includes(query)) ||
        (log.requestData && JSON.stringify(log.requestData).toLowerCase().includes(query))
      );
    });
  }, [logs, searchQuery, filterType]);

  // Virtualize the logs list to support huge list data
  const { vlChunks, vlStyles } = useVirtualList({
    items: filteredLogs,
    itemHeight: 20,
    chunkSize: 10,
    disabled: !isOpen,
  });

  const selectedLog = useMemo(() => {
    return logs.find((l) => l.id === selectedLogId) || null;
  }, [logs, selectedLogId]);

  // Statistics
  const errorCount = useMemo(() => {
    return logs.filter((log) => {
      if (log.status === "fail") return true;
      if (typeof log.status === "number" && log.status >= 400) return true;
      return false;
    }).length;
  }, [logs]);

  const handleClear = () => {
    Taro.showModal({
      title: "Clear Logs",
      content: "Are you sure you want to delete all logged requests?",
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
          title: "cURL Copied",
          icon: "success",
        });
      },
    });
  };

  const handleCopyText = (text: string) => {
    Taro.setClipboardData({
      data: text,
      success: () => {
        Taro.showToast({
          title: "Copied",
          icon: "success",
        });
      },
    });
  };

  const getStatusColor = (status: string | number | undefined) => {
    if (status === undefined || status === "pending") return "#ffd60a"; // yellow
    if (status === "fail" || (typeof status === "number" && status >= 400)) return "#ff453a"; // red
    return "#30d158"; // green
  };

  const getMethodStyle = (method: string) => {
    const base = {
      display: "inline-block",
      padding: "2px 6px",
      borderRadius: "4px",
      fontSize: "10px",
      fontWeight: "bold" as const,
      color: "#ffffff",
      marginRight: "8px",
      width: "50px",
      textAlign: "center" as const,
    };

    switch (method.toUpperCase()) {
      case "GET":
        return { ...base, backgroundColor: "#0a84ff" };
      case "POST":
        return { ...base, backgroundColor: "#bf5af2" };
      case "PUT":
        return { ...base, backgroundColor: "#5e5ce6" };
      case "DELETE":
        return { ...base, backgroundColor: "#ff453a" };
      case "NATIVE":
        return { ...base, backgroundColor: "#ff9f0a" };
      case "UPLOAD":
      case "DOWNLOAD":
        return { ...base, backgroundColor: "#30d158" };
      default:
        return { ...base, backgroundColor: "#64d2ff" };
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  if (!isOpen) {
    return (
      <View
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: "100px",
          right: "20px",
          left: "auto",
          zIndex: 99999,
          width: "50px",
          height: "50px",
          borderRadius: "25px",
          backgroundColor: "rgba(30, 30, 30, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(10px)",
        }}
      >
        <BugIcon size={22} color={errorCount > 0 ? "#ff453a" : "#30d158"} />
        {logs.length > 0 && (
          <View
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              backgroundColor: errorCount > 0 ? "#ff453a" : "#30d158",
              color: "#ffffff",
              fontSize: "9px",
              fontWeight: "bold",
              borderRadius: "8px",
              padding: "1px 5px",
              minWidth: "12px",
              textAlign: "center",
            }}
          >
            {logs.length}
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#121212",
        color: "#ffffff",
        zIndex: 100000,
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* 1. DETAIL VIEW OVERLAY */}
      {selectedLog && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#1c1c1e",
            zIndex: 100001,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Detail Header */}
          <View
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              padding: "12px",
              borderBottom: "1px solid #2d2d2d",
              backgroundColor: "#121212",
            }}
          >
            <View
              onClick={() => setSelectedLogId(null)}
              style={{ padding: "8px", marginRight: "8px" }}
            >
              <BackIcon size={20} />
            </View>
            <View style={{ flex: 1, overflow: "hidden" }}>
              <Text
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "block",
                }}
              >
                {selectedLog.url}
              </Text>
            </View>
            {selectedLog.type === "network" && (
              <Button
                onClick={() => handleCopyCurl(selectedLog)}
                style={{
                  fontSize: "11px",
                  backgroundColor: "#30d158",
                  color: "#ffffff",
                  padding: "4px 10px",
                  lineHeight: "1.5",
                  height: "auto",
                  border: "none",
                  borderRadius: "12px",
                  display: "flex",
                  justifyContent: "center",
                  marginLeft: "8px",
                  alignItems: "center",
                  gap: "4px",
                  width: "auto",
                }}
              >
                <CopyIcon size={12} color="#ffffff" /> cURL
              </Button>
            )}
          </View>

          {/* Detail Tabs */}
          <View
            style={{
              display: "flex",
              flexDirection: "row",
              borderBottom: "1px solid #2d2d2d",
              backgroundColor: "#121212",
            }}
          >
            {(["overview", "request", "response"] as const).map((tab) => (
              <View
                key={tab}
                onClick={() => setActiveDetailTab(tab)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "12px 0",
                  fontSize: "13px",
                  fontWeight: activeDetailTab === tab ? "bold" : "normal",
                  color: activeDetailTab === tab ? "#30d158" : "#8e8e93",
                  borderBottom: activeDetailTab === tab ? "2px solid #30d158" : "none",
                }}
              >
                {tab.toUpperCase()}
              </View>
            ))}
          </View>

          {/* Detail Content */}
          <ScrollView scrollY style={{ flex: 1, minHeight: 0 }}>
            <View style={{ padding: "12px" }}>
              {activeDetailTab === "overview" && (
                <View style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <View
                    style={{ backgroundColor: "#2c2c2e", padding: "12px", borderRadius: "8px" }}
                  >
                    <Text
                      style={{
                        color: "#8e8e93",
                        fontSize: "11px",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Type
                    </Text>
                    <Text style={{ fontSize: "14px", fontWeight: "bold" }}>
                      {selectedLog.type === "native"
                        ? "Native Plugin Invocation"
                        : "Network Request"}
                    </Text>
                  </View>

                  <View
                    style={{ backgroundColor: "#2c2c2e", padding: "12px", borderRadius: "8px" }}
                  >
                    <Text
                      style={{
                        color: "#8e8e93",
                        fontSize: "11px",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Method / API Name
                    </Text>
                    <Text style={{ fontSize: "14px", fontWeight: "bold", color: "#ffd60a" }}>
                      {selectedLog.method}
                    </Text>
                  </View>

                  <View
                    style={{ backgroundColor: "#2c2c2e", padding: "12px", borderRadius: "8px" }}
                  >
                    <Text
                      style={{
                        color: "#8e8e93",
                        fontSize: "11px",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      URL Path / Identifier
                    </Text>
                    <Text style={{ fontSize: "14px", wordBreak: "break-all" }}>
                      {selectedLog.url}
                    </Text>
                  </View>

                  <View
                    style={{ backgroundColor: "#2c2c2e", padding: "12px", borderRadius: "8px" }}
                  >
                    <Text
                      style={{
                        color: "#8e8e93",
                        fontSize: "11px",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Status
                    </Text>
                    <Text
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: getStatusColor(selectedLog.status),
                      }}
                    >
                      {String(selectedLog.status).toUpperCase()}
                    </Text>
                  </View>

                  {selectedLog.duration !== undefined && (
                    <View
                      style={{ backgroundColor: "#2c2c2e", padding: "12px", borderRadius: "8px" }}
                    >
                      <Text
                        style={{
                          color: "#8e8e93",
                          fontSize: "11px",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Latency
                      </Text>
                      <Text style={{ fontSize: "14px", fontWeight: "bold" }}>
                        {selectedLog.duration} ms
                      </Text>
                    </View>
                  )}

                  <View
                    style={{ backgroundColor: "#2c2c2e", padding: "12px", borderRadius: "8px" }}
                  >
                    <Text
                      style={{
                        color: "#8e8e93",
                        fontSize: "11px",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Time Initiated
                    </Text>
                    <Text style={{ fontSize: "14px" }}>
                      {new Date(selectedLog.startTime).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}

              {activeDetailTab === "request" && (
                <View style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {selectedLog.requestHeaders &&
                    Object.keys(selectedLog.requestHeaders).length > 0 && (
                      <View
                        style={{ backgroundColor: "#2c2c2e", padding: "12px", borderRadius: "8px" }}
                      >
                        <View
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "8px",
                          }}
                        >
                          <Text style={{ color: "#8e8e93", fontSize: "11px", fontWeight: "bold" }}>
                            Headers
                          </Text>
                          <Text
                            onClick={() => handleCopyText(formatJson(selectedLog.requestHeaders))}
                            style={{ color: "#30d158", fontSize: "11px" }}
                          >
                            Copy
                          </Text>
                        </View>
                        <View
                          style={{
                            fontSize: "12px",
                            fontFamily: "monospace",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            color: "#64d2ff",
                          }}
                        >
                          {formatJson(selectedLog.requestHeaders)}
                        </View>
                      </View>
                    )}

                  <View
                    style={{ backgroundColor: "#2c2c2e", padding: "12px", borderRadius: "8px" }}
                  >
                    <View
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <Text style={{ color: "#8e8e93", fontSize: "11px", fontWeight: "bold" }}>
                        Body Payload
                      </Text>
                      {selectedLog.requestData && (
                        <Text
                          onClick={() => handleCopyText(formatJson(selectedLog.requestData))}
                          style={{ color: "#30d158", fontSize: "11px" }}
                        >
                          Copy
                        </Text>
                      )}
                    </View>
                    <View
                      style={{
                        fontSize: "12px",
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        color: "#bf5af2",
                      }}
                    >
                      {selectedLog.requestData
                        ? formatJson(selectedLog.requestData)
                        : "No request payload"}
                    </View>
                  </View>
                </View>
              )}

              {activeDetailTab === "response" && (
                <View style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {selectedLog.error && (
                    <View
                      style={{
                        backgroundColor: "rgba(255, 69, 58, 0.15)",
                        padding: "12px",
                        borderRadius: "8px",
                      }}
                    >
                      <Text
                        style={{
                          color: "#ff453a",
                          fontSize: "11px",
                          fontWeight: "bold",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Error Message
                      </Text>
                      <Text
                        style={{
                          fontSize: "12px",
                          fontFamily: "monospace",
                          color: "#ff453a",
                          wordBreak: "break-all",
                        }}
                      >
                        {selectedLog.error}
                      </Text>
                    </View>
                  )}

                  {selectedLog.responseHeaders &&
                    Object.keys(selectedLog.responseHeaders).length > 0 && (
                      <View
                        style={{ backgroundColor: "#2c2c2e", padding: "12px", borderRadius: "8px" }}
                      >
                        <View
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "8px",
                          }}
                        >
                          <Text style={{ color: "#8e8e93", fontSize: "11px", fontWeight: "bold" }}>
                            Headers
                          </Text>
                          <Text
                            onClick={() => handleCopyText(formatJson(selectedLog.responseHeaders))}
                            style={{ color: "#30d158", fontSize: "11px" }}
                          >
                            Copy
                          </Text>
                        </View>
                        <View
                          style={{
                            fontSize: "12px",
                            fontFamily: "monospace",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            color: "#64d2ff",
                          }}
                        >
                          {formatJson(selectedLog.responseHeaders)}
                        </View>
                      </View>
                    )}

                  <View
                    style={{ backgroundColor: "#2c2c2e", padding: "12px", borderRadius: "8px" }}
                  >
                    <View
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <Text style={{ color: "#8e8e93", fontSize: "11px", fontWeight: "bold" }}>
                        Body Content
                      </Text>
                      {selectedLog.responseData && (
                        <Text
                          onClick={() => handleCopyText(formatJson(selectedLog.responseData))}
                          style={{ color: "#30d158", fontSize: "11px" }}
                        >
                          Copy
                        </Text>
                      )}
                    </View>
                    <View
                      style={{
                        fontSize: "12px",
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        color: "#30d158",
                      }}
                    >
                      {selectedLog.responseData
                        ? formatJson(selectedLog.responseData)
                        : "Empty response body"}
                    </View>
                  </View>
                </View>
              )}
              <View style={{ height: "40px" }} />
            </View>
          </ScrollView>
        </View>
      )}

      {/* 2. MAIN LOGS LIST VIEW */}
      {/* List Header */}
      <View
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "12px",
          borderBottom: "1px solid #2d2d2d",
          backgroundColor: "#1e1e1e",
        }}
      >
        <Text style={{ fontSize: "16px", fontWeight: "bold", marginRight: "12px" }}>Chucker</Text>
        <View
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#2c2c2e",
            borderRadius: "8px",
            padding: "4px 8px",
            marginRight: "8px",
          }}
        >
          <Input
            value={searchQuery}
            onInput={(e) => setSearchQuery(e.detail.value)}
            placeholder="Search endpoint..."
            placeholderStyle="color: #8e8e93"
            style={{
              fontSize: "12px",
              color: "#ffffff",
              backgroundColor: "transparent",
              border: "none",
              width: "100%",
              padding: 0,
            }}
          />
        </View>
        <View onClick={handleClear} style={{ padding: "8px", marginRight: "6px" }}>
          <TrashIcon size={18} />
        </View>
        <View onClick={handleClose} style={{ padding: "8px" }}>
          <CloseIcon size={18} />
        </View>
      </View>

      {/* List Tabs */}
      <View
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#1e1e1e",
          padding: "8px 12px",
          borderBottom: "1px solid #2d2d2d",
          justifyContent: "space-between",
        }}
      >
        <View style={{ display: "flex", flexDirection: "row", gap: "8px" }}>
          {(["all", "network", "native"] as const).map((type) => (
            <View
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                borderRadius: "12px",
                backgroundColor: filterType === type ? "#30d158" : "#2c2c2e",
                color: filterType === type ? "#ffffff" : "#aeaeb2",
              }}
            >
              {type.toUpperCase()}
            </View>
          ))}
        </View>
      </View>

      {/* Logs Scroll Container */}
      <View style={{ flex: 1, overflowY: "auto" }}>
        {filteredLogs.length === 0 ? (
          <View style={{ padding: "40px 0", textAlign: "center", color: "#8e8e93" }}>
            <Text style={{ fontSize: "13px" }}>No transactions recorded</Text>
          </View>
        ) : (
          vlChunks.map((chunk, ci) => (
            <View key={ci} id={`vl-chunk-${ci}`} className="vl-chunk" style={vlStyles[ci]}>
              {chunk.map((log) => (
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
                    padding: "12px",
                    borderBottom: "1px solid #1c1c1e",
                    backgroundColor:
                      log.status === "fail" ? "rgba(255, 69, 58, 0.05)" : "transparent",
                  }}
                >
                  {/* Method badge */}
                  <Text style={getMethodStyle(log.method)}>{log.method}</Text>

                  {/* Status Code badge */}
                  <Text
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: getStatusColor(log.status),
                      width: "45px",
                      textAlign: "center",
                      marginRight: "8px",
                    }}
                  >
                    {String(log.status || "pending")}
                  </Text>

                  {/* URL endpoint / plugin Name */}
                  <View style={{ flex: 1, overflow: "hidden", marginRight: "8px" }}>
                    <Text
                      style={{
                        fontSize: "13px",
                        color: log.status === "fail" ? "#ff453a" : "#ffffff",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "block",
                      }}
                    >
                      {log.url}
                    </Text>
                  </View>

                  {/* Duration and timestamp */}
                  <View
                    style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}
                  >
                    <Text style={{ fontSize: "10px", color: "#aeaeb2", marginBottom: "2px" }}>
                      {log.duration !== undefined ? `${log.duration}ms` : "..."}
                    </Text>
                    <Text style={{ fontSize: "9px", color: "#8e8e93" }}>
                      {formatTime(log.startTime)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </View>
  );
};
