import { chuckerStore } from "../src/runtime/store";

describe("ChuckerStore Unit Tests", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    chuckerStore.clear();
    jest.advanceTimersByTime(100); // flush any pending clear notification
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should initialize and subscribe to updates", () => {
    // Initialize the store
    chuckerStore.init(5);

    // Mock listeners
    const listener = jest.fn();
    const unsubscribe = chuckerStore.subscribe(listener);

    // Verify initial call with empty logs
    expect(listener).toHaveBeenCalledWith([]);

    // Call handleRequestStart directly
    chuckerStore.handleRequestStart({
      id: "req_1",
      type: "network",
      method: "GET",
      url: "https://api.test.com/users",
      startTime: 1000,
    });

    // Flush the throttled notify
    jest.advanceTimersByTime(100);

    // Check if listener is notified with log
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith([
      {
        id: "req_1",
        type: "network",
        method: "GET",
        url: "https://api.test.com/users",
        startTime: 1000,
      },
    ]);

    unsubscribe();
  });

  it("should update requests upon completion", () => {
    chuckerStore.init(5);
    const listener = jest.fn();
    chuckerStore.subscribe(listener);

    // Start
    chuckerStore.handleRequestStart({
      id: "req_2",
      type: "network",
      method: "POST",
      url: "https://api.test.com/users",
      startTime: 2000,
    });

    // Complete
    chuckerStore.handleRequestComplete({
      id: "req_2",
      status: 201,
      responseData: { id: 1 },
      duration: 150,
    });

    const currentLogs = chuckerStore.getLogs();
    expect(currentLogs[0]).toEqual({
      id: "req_2",
      type: "network",
      method: "POST",
      url: "https://api.test.com/users",
      startTime: 2000,
      status: 201,
      responseData: { id: 1 },
      duration: 150,
    });
  });

  it("should trim logs to not exceed maxLogs limit", () => {
    chuckerStore.init(3); // set limit to 3

    for (let i = 1; i <= 5; i++) {
      chuckerStore.handleRequestStart({
        id: `req_${i}`,
        type: "network",
        method: "GET",
        url: `https://api.test.com/users/${i}`,
        startTime: 1000 * i,
      });
    }

    const currentLogs = chuckerStore.getLogs();
    expect(currentLogs.length).toBe(3);
    // The logs are in reverse-chronological order (newest first)
    expect(currentLogs[0].id).toBe("req_5");
    expect(currentLogs[1].id).toBe("req_4");
    expect(currentLogs[2].id).toBe("req_3");
  });

  it("should clear all logs when clear() is called", () => {
    chuckerStore.init(5);
    chuckerStore.handleRequestStart({
      id: "req_clear",
      type: "network",
      method: "GET",
      url: "https://api.test.com/clear",
      startTime: 1000,
    });

    expect(chuckerStore.getLogs().length).toBe(1);
    chuckerStore.clear();
    expect(chuckerStore.getLogs().length).toBe(0);
  });

  describe("Public API", () => {
    beforeEach(() => {
      chuckerStore.init(10);
    });

    it("log() should add a one-shot entry with auto-generated id and startTime", () => {
      const id = chuckerStore.log({
        type: "websocket",
        method: "MESSAGE",
        url: "wss://example.com/ws",
        requestData: { event: "ping" },
        status: "success",
        responseData: { event: "pong" },
      });

      expect(id).toMatch(/^usr_/);

      const logs = chuckerStore.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0]).toMatchObject({
        id,
        type: "websocket",
        method: "MESSAGE",
        url: "wss://example.com/ws",
        requestData: { event: "ping" },
        status: "success",
        responseData: { event: "pong" },
      });
      expect(logs[0].startTime).toBeGreaterThan(0);
    });

    it("log() should use user-provided id and startTime when given", () => {
      const id = chuckerStore.log({
        id: "custom_123",
        type: "graphql",
        method: "QUERY",
        url: "https://api.example.com/graphql",
        startTime: 5000,
      });

      expect(id).toBe("custom_123");

      const logs = chuckerStore.getLogs();
      expect(logs[0].id).toBe("custom_123");
      expect(logs[0].startTime).toBe(5000);
    });

    it("startTracking() + completeTracking() should track async operations with duration", () => {
      // Freeze time for predictable duration calculation
      jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));

      const id = chuckerStore.startTracking({
        type: "graphql",
        method: "MUTATION",
        url: "https://api.example.com/graphql",
        requestData: { query: "mutation { createUser }" },
      });

      expect(id).toMatch(/^usr_/);

      // Simulate 250ms passing
      jest.setSystemTime(new Date("2026-01-01T00:00:00.250Z"));

      chuckerStore.completeTracking(id, {
        status: 200,
        responseData: { data: { createUser: { id: 1 } } },
      });

      const logs = chuckerStore.getLogs();
      expect(logs[0]).toMatchObject({
        id,
        type: "graphql",
        method: "MUTATION",
        status: 200,
        responseData: { data: { createUser: { id: 1 } } },
        duration: 250,
      });
    });

    it("completeTracking() should use explicit duration when provided", () => {
      const id = chuckerStore.startTracking({
        type: "network",
        method: "GET",
        url: "https://api.example.com/data",
      });

      chuckerStore.completeTracking(id, {
        status: 200,
        responseData: { ok: true },
        duration: 42,
      });

      const logs = chuckerStore.getLogs();
      expect(logs[0].duration).toBe(42);
    });

    it("should support custom type values beyond network/native", () => {
      chuckerStore.log({
        type: "sse",
        method: "EVENT",
        url: "https://api.example.com/events",
        responseData: { event: "update", data: {} },
      });

      const logs = chuckerStore.getLogs();
      expect(logs[0].type).toBe("sse");
    });
  });
});
