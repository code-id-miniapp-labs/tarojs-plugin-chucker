import { generateCurl, formatJson } from "../src/runtime/utils";

describe("Chucker Utils Unit Tests", () => {
  describe("generateCurl", () => {
    it("should generate basic GET curl command", () => {
      const curl = generateCurl("https://api.example.com/users", "GET");
      expect(curl).toBe('curl -X GET "https://api.example.com/users"');
    });

    it("should append headers to curl command", () => {
      const curl = generateCurl("https://api.example.com/users", "GET", {
        Authorization: "Bearer token123",
        "Content-Type": "application/json",
      });
      expect(curl).toContain('-H "Authorization: Bearer token123"');
      expect(curl).toContain('-H "Content-Type: application/json"');
    });

    it("should append string body to POST curl command", () => {
      const curl = generateCurl(
        "https://api.example.com/users",
        "POST",
        { "Content-Type": "application/json" },
        { name: "John Doe", age: 30 },
      );
      expect(curl).toContain('-d \'{"name":"John Doe","age":30}\'');
    });

    it("should handle raw string body payload", () => {
      const curl = generateCurl("https://api.example.com/raw", "POST", {}, "raw-string-payload");
      expect(curl).toContain("-d 'raw-string-payload'");
    });

    it("should escape single quotes inside payload for shell safety", () => {
      const curl = generateCurl(
        "https://api.example.com/escape",
        "POST",
        {},
        { message: "don't fail" },
      );
      expect(curl).toContain("-d '{\"message\":\"don'\\''t fail\"}'");
    });
  });

  describe("formatJson", () => {
    it("should return empty string for null or undefined", () => {
      expect(formatJson(null)).toBe("");
      expect(formatJson(undefined)).toBe("");
    });

    it("should pretty print objects", () => {
      const formatted = formatJson({ a: 1, b: [2, 3] });
      expect(formatted).toBe(JSON.stringify({ a: 1, b: [2, 3] }, null, 2));
    });

    it("should parse and format valid JSON strings", () => {
      const formatted = formatJson('{"x": 10}');
      expect(formatted).toBe(JSON.stringify({ x: 10 }, null, 2));
    });

    it("should return raw string if it is not a valid JSON string", () => {
      const formatted = formatJson("just a regular string");
      expect(formatted).toBe("just a regular string");
    });
  });
});
