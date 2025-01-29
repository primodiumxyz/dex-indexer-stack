import { GqlClient } from "@gql/index";

/** Service class handling token trading, swaps, and user operations */
export class Service {
  private readonly REFRESH_TOKEN_ROLLING_STATS_30MIN_INTERVAL_SECONDS = 2;

  /**
   * Creates a new instance of Service
   *
   * @param gqlClient - GraphQL client for database operations
   */
  private constructor(private readonly gqlClient: GqlClient["db"]) {}

  /**
   * Factory method to create a fully initialized TubService
   *
   * @param gqlClient - GraphQL client for database operations
   * @returns A fully initialized {@link Service}
   */
  static async create(gqlClient: GqlClient["db"]): Promise<Service> {
    const service = new Service(gqlClient);
    return await service.initialize();
  }

  /**
   * Returns the status of the service
   *
   * @returns The status of the service
   */
  getStatus(): { status: number } {
    return { status: 200 };
  }

  /**
   * Initializes the service
   *
   * @returns The initialized {@link Service}
   */
  private async initialize(): Promise<Service> {
    // Start periodic tasks
    this.startPeriodicTasks();
    return this;
  }

  /**
   * Refreshes the token rolling stats 30min
   *
   * Note: Throws an error if the operation fails
   */
  private async refreshTokenRollingStats30Min(): Promise<void> {
    const result = await this.gqlClient.RefreshTokenRollingStats30MinMutation();
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.api_refresh_token_rolling_stats_30min?.success)
      throw new Error("Failed to refresh token rolling stats 30min");
  }

  /** Starts periodic tasks */
  private async startPeriodicTasks(): Promise<void> {
    setInterval(async () => {
      try {
        await this.refreshTokenRollingStats30Min();
        console.log("Refreshed token rolling stats 30min");
      } catch (error) {
        console.error("Failed to refresh token rolling stats 30min", error);
      }
    }, this.REFRESH_TOKEN_ROLLING_STATS_30MIN_INTERVAL_SECONDS * 1000);
  }
}
