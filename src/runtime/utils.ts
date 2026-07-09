export function generateCurl(
  url: string,
  method: string,
  headers: Record<string, string> = {},
  data: any = null,
): string {
  let curl = `curl -X ${method.toUpperCase()} "${url}"`;

  // Append headers
  Object.entries(headers).forEach(([key, val]) => {
    const escapedVal = String(val).replace(/"/g, '\\"');
    curl += ` -H "${key}: ${escapedVal}"`;
  });

  // Append body data
  if (data !== undefined && data !== null) {
    let dataStr = "";
    if (typeof data === "object") {
      try {
        dataStr = JSON.stringify(data);
      } catch (e) {
        dataStr = String(data);
      }
    } else {
      dataStr = String(data);
    }
    // Escape single quotes in the payload
    const escapedData = dataStr.replace(/'/g, "'\\''");
    curl += ` -d '${escapedData}'`;
  }

  return curl;
}

export function formatJson(val: any): string {
  if (val === undefined || val === null) return "";
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val.trim());
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return val;
    }
  }
  try {
    return JSON.stringify(val, null, 2);
  } catch (e) {
    return String(val);
  }
}
