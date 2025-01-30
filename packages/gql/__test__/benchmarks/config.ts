// Amount of trades to generate during seeding
// 900,000 trades within 30 minutes ~= 500 trades per second, which is (now) higher than the peak amount of swaps on Solana during high traffic times
export const DEFAULT_TRADES_AMOUNT = 900_000;

// Start date for the seeding
export const DEFAULT_START_DATE = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago, so we don't lose trades between each benchmark for the 30min top tokens

// Number of iterations to run for each query
export const ITERATIONS = 100;
