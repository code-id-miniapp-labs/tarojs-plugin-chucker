import { chuckerStore } from "../src/runtime/store";

describe("ChuckerStore Unit Tests", () => {
  beforeEach(() => {
    chuckerStore.clear();
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
});
