import { QueryClient, QueryFunction } from "@tanstack/react-query";

class ApiError extends Error {
  status: number;
  serverMessage: string | null;
  
  constructor(status: number, message: string, serverMessage: string | null) {
    super(message);
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let serverMessage: string | null = null;
    
    // Try to parse JSON error message
    try {
      const json = JSON.parse(text);
      if (json.error) {
        serverMessage = json.error;
      }
    } catch {
      // Not JSON, use raw text
    }
    
    // Use serverMessage if available, otherwise use descriptive message without status code
    const displayMessage = serverMessage || text || "요청을 처리할 수 없습니다";
    const error = new ApiError(res.status, displayMessage, serverMessage);
    throw error;
  }
}

export { ApiError };

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Helper for invalidating all queries that start with a given path prefix
export function invalidateQueriesStartingWith(pathPrefix: string) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === "string" && key.startsWith(pathPrefix);
    },
    refetchType: 'all',
  });
}
