import { createClient, GqlClient } from "../../src/index";

/* ---------------------------------- UTILS --------------------------------- */
/**
 * Converts a JavaScript object to a PostgreSQL composite type string.
 *
 * This is used to format the token metadata as a PostgreSQL composite type when inserting trade history.
 *
 * @param obj - The object to convert
 * @returns A string in PostgreSQL composite type format: (val1,val2,...)
 */
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
/**
 * Creates a client that points to the cache server.
 *
 * @param cacheTime (optional) - A cache time header to set on the request to override the default (1h here will help
 *   for benchmarking to make sure it stays).
 * @returns The {@link GqlClient} instance
 */
export const createClientCached = async (cacheTime?: string): Promise<GqlClient> => {
  return await createClient({
    url: "http://localhost:8090/v1/graphql",
    hasuraAdminSecret: "password",
    headers: {
      "x-cache-time": cacheTime ?? "1h",
    },
  });
};

/**
 * Creates a client that points directly to the Hasura engine.
 *
 * @returns The {@link GqlClient} instance
 */
export const createClientNoCache = async (): Promise<GqlClient> => {
  return await createClient({
    url: "http://localhost:8080/v1/graphql",
    hasuraAdminSecret: "password",
  });
};

/**
 * Creates a client that points to the cache server with a cache bypass header.
 *
 * @returns The {@link GqlClient} instance
 */
export const createClientCacheBypass = async (): Promise<GqlClient> => {
  return await createClient({
    url: "http://localhost:8090/v1/graphql",
    hasuraAdminSecret: "password",
    headers: {
      "x-cache-bypass": "1",
    },
  });
};

/** Clears the entire cache on the cache server. */
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

/** Refreshes the 30min- token stats. */
export const refreshTokenRollingStats30Min = async (): Promise<void> => {
  const gql = await createClientNoCache();
  const refreshRes = await gql.db.RefreshTokenRollingStats30MinMutation();
  if (refreshRes.error || !refreshRes.data?.api_refresh_token_rolling_stats_30min?.success) {
    throw new Error(`Failed to refresh token rolling stats: ${refreshRes.error?.message ?? "Unknown error"}`);
  }
};

/**
 * Waits for a subscription to update.
 *
 * Note: This will update the token rolling stats and check if the provided condition is met every few seconds.
 *
 * @param verifyFn - A function that returns true if the subscription has updated
 * @param options (optional) - Options for the wait
 * @returns True if the subscription updated
 */
export const waitForSubscriptionUpdate = async (
  verifyFn: () => boolean,
  options?: { timeoutMs?: number; checkIntervalMs?: number },
) => {
  const timeoutMs = options?.timeoutMs ?? 20000;
  const checkIntervalMs = options?.checkIntervalMs ?? 100;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Condition not met within ${timeoutMs}ms timeout`));
    }, timeoutMs);

    const checkCondition = () => {
      if (verifyFn()) {
        clearTimeout(timeoutId);
        resolve(true);
      } else {
        setTimeout(async () => {
          await refreshTokenRollingStats30Min();
          checkCondition();
        }, checkIntervalMs);
      }
    };

    checkCondition();
  });
};
