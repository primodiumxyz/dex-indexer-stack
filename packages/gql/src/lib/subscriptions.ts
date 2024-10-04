import { graphql } from "./init";

export const GetLatestMockTokensSubscription = graphql(`
  subscription GetLatestMockTokens($limit: Int = 10) {
    token(where: { mint: { _is_null: true } }, order_by: { updated_at: desc }, limit: $limit) {
      id
      symbol
      supply
      updated_at
    }
  }
`);

export const GetTokenPriceHistorySinceSubscription = graphql(`
  subscription GetTokenPriceHistorySince($tokenId: uuid!, $since: timestamptz!) {
    token_price_history(
      where: { token: { _eq: $tokenId }, created_at: { _gte: $since } }
      limit: 100
      order_by: { created_at: desc }
    ) {
      created_at
      id
      price
      token
    }
  }
`);

export const GetAllOnchainTokensPriceHistorySinceSubscription = graphql(`
  subscription GetAllOnchainTokensPriceHistorySince($since: timestamptz!) {
    token_price_history(
      where: { token_relationship: { mint: { _is_null: false } }, created_at: { _gte: $since } }
      order_by: { created_at: desc }
    ) {
      created_at
      id
      price
      token_relationship {
        mint
      }
    }
  }
`);
