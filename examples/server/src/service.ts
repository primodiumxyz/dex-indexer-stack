import { GqlClient } from "@primodiumxyz/solana-dex-indexer-gql";

/**
 * Service class handling token trading, swaps, and user operations
 */
export class Service {
  private readonly REFRESH_TOKEN_ROLLING_STATS_30MIN_INTERVAL_SECONDS = 5;

  /**
   * Creates a new instance of Service
   * @param gqlClient - GraphQL client for database operations
   */
  private constructor(private readonly gqlClient: GqlClient["db"]) {}

  /**
   * Factory method to create a fully initialized TubService
   */
  static async create(gqlClient: GqlClient["db"]): Promise<Service> {
    const service = new Service(gqlClient);
    return await service.initialize();
  }

  // Status endpoint
  getStatus(): { status: number } {
    return { status: 200 };
  }

  private async initialize(): Promise<Service> {
    // Start periodic tasks
    this.startPeriodicTasks();
    return this;
  }

  private async refreshTokenRollingStats30Min(): Promise<void> {
    const result = await this.gqlClient.RefreshTokenRollingStats30MinMutation();
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.api_refresh_token_rolling_stats_30min?.success)
      throw new Error("Failed to refresh token rolling stats 30min");
  }

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
