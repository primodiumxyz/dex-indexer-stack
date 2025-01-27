import { createClient } from "../../src/index";

export const toPgComposite = (obj: Record<string, unknown>): string => {
  const values = Object.values(obj).map((val) => {
    if (val === null || val === undefined) return null;

    if (typeof val === "string") {
      // Escape special characters and quotes
      const escaped = val
        // Replace backslashes first to avoid double-escaping
        .replace(/\\/g, "\\\\")
        // Escape quotes
        .replace(/"/g, '\\"')
        // Replace newlines
        .replace(/\n/g, "\\n")
        // Replace carriage returns
        .replace(/\r/g, "\\r")
        // Replace tabs
        .replace(/\t/g, "\\t");

      return `"${escaped}"`;
    }

    if (typeof val === "number") {
      return isNaN(val) ? null : val.toString();
    }

    if (typeof val === "boolean") {
      return val.toString();
    }

    // For any other value, convert to string and escape
    const stringVal = val.toString();
    return `"${stringVal.replace(/"/g, '\\"')}"`;
  });

  return `(${values.join(",")})`;
};

/* --------------------------------- CLIENTS -------------------------------- */
export const createClientCached = async (cacheTime?: string) => {
  return await createClient({
    url: "http://localhost:8090/v1/graphql",
    hasuraAdminSecret: "password",
    headers: {
      "x-cache-time": cacheTime ?? "1h",
    },
  });
};

export const createClientNoCache = async () => {
  return await createClient({
    url: "http://localhost:8080/v1/graphql",
    hasuraAdminSecret: "password",
  });
};

export const createClientCacheBypass = async () => {
  return await createClient({
    url: "http://localhost:8090/v1/graphql",
    hasuraAdminSecret: "password",
    headers: {
      "x-cache-bypass": "1",
    },
  });
};

export const clearCache = async () => {
  try {
    const response = await fetch("http://localhost:8090/flush", {
      method: "POST",
      headers: {
        "x-redis-secret": "password",
      },
    });
    if (!response.ok) throw new Error(response.statusText);
  } catch (error) {
    console.error("Failed to clear cache", error);
  }
};

export const refreshTokenRollingStats30Min = async () => {
  const gql = await createClientNoCache();
  const refreshRes = await gql.db.RefreshTokenRollingStats30MinMutation();
  if (refreshRes.error || !refreshRes.data?.api_refresh_token_rolling_stats_30min?.success) {
    throw new Error(`Failed to refresh token rolling stats: ${refreshRes.error?.message ?? "Unknown error"}`);
  }
};

// This will include waiting for continuous aggregate to refresh
//   & waiting for rolling stats to update
//   & waiting for subscription to update
export const waitForSubscriptionUpdate = async (
  verifyFn: () => boolean,
  options?: { timeoutMs?: number; checkIntervalMs?: number },
) => {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const checkIntervalMs = options?.checkIntervalMs ?? 100;

  refreshTokenRollingStats30Min();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Condition not met within ${timeoutMs}ms timeout`));
    }, timeoutMs);

    const checkCondition = () => {
      if (verifyFn()) {
        clearTimeout(timeoutId);
        resolve(true);
      } else {
        setTimeout(checkCondition, checkIntervalMs);
      }
    };

    checkCondition();
  });
};
