import { initTRPC } from "@trpc/server";
import { Service } from "./Service";

export type AppContext = {
  service: Service;
};

/**
 * Creates and configures the main tRPC router with all API endpoints.
 * @returns A configured tRPC router with all procedures
 */
export function createAppRouter() {
  const t = initTRPC.context<AppContext>().create();
  return t.router({
    /**
     * Health check endpoint that returns server status
     * @returns Object containing status code 200 if server is healthy
     */
    getStatus: t.procedure.query(({ ctx }) => {
      return ctx.service.getStatus();
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
