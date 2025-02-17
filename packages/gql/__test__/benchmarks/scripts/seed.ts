import { createClientNoCache } from "../../lib/common";
import { insertMockTradeHistory } from "../../lib/mock";
import { DEFAULT_START_DATE, DEFAULT_TRADES_AMOUNT } from "../config";

/**
 * Seed the database with mock data according the benchmark config.
 *
 * @see {@link DEFAULT_TRADES_AMOUNT}
 * @see {@link DEFAULT_START_DATE}
 */
const seed = async () => {
  const client = await createClientNoCache();

  await insertMockTradeHistory(client, {
    count: DEFAULT_TRADES_AMOUNT,
    from: DEFAULT_START_DATE,
    onProgress: (inserted, total) => {
      console.log(`Inserting mock data: ${((inserted / total) * 100).toFixed(2)}%`);
    },
  });
};

seed()
  .then(() => {
    console.log("Mock data inserted");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Error inserting mock data", e);
    process.exit(1);
  });
