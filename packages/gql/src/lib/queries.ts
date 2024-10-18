import { graphql } from "./init";

export const GetAllAccountsQuery = graphql(`
  query GetAllAccounts {
    account {
      id
      username
      created_at
    }
  }
`);

export const GetAccountDataQuery = graphql(`
  query GetAccountData($accountId: uuid!) {
    account(where: { id: { _eq: $accountId } }) {
      username
      id
      created_at
    }
  }
`);

export const GetAllMockTokensQuery = graphql(`
  query GetAllTokens {
    token(where: { mint: { _is_null: true } }) {
      id
      name
      symbol
      updated_at
      supply
      uri
    }
  }
`);

export const GetTokenDataQuery = graphql(`
  query GetTokenData($tokenId: uuid!) {
    token(where: { id: { _eq: $tokenId } }) {
      id
      name
      symbol
      updated_at
      supply
      uri
    }
  }
`);

export const GetTokensByMintsQuery = graphql(`
  query GetTokensByMints($mints: [String!]!) {
    token(where: { mint: { _in: $mints } }) {
      id
      mint
    }
  }
`);


export const GetAccountTokenBalanceQuery = graphql(`
  query GetAccountTokenBalance($account: uuid!, $token: uuid!, $start: timestamptz = "now()") {
    balance: account_token_balance_ignore_interval(args: {account: $account, interval: "0", start: $start, token: $token}) {
      value: balance
    }
  }
`);

export const GetAccountTokenBalanceIgnoreIntervalQuery = graphql(`
  query GetAccountTokenBalanceIgnoreInterval($account: uuid!, $start: timestamptz = "now()", $interval: interval!, $token: uuid!) {
    balance: account_token_balance_ignore_interval(args: {account: $account, interval: $interval, start: $start, token: $token}) {
      value: balance
    }
  }
`);


export const GetAccountBalanceQuery = graphql(`
  query GetAccountBalanceIgnoreInterval($account: uuid!, $start: timestamptz = "now()") {
    balance: account_balance_ignore_interval(args: {account: $account, interval: "0", start: $start}) {
      value: balance
    }
  }
`);

export const GetAccountBalanceIgnoreIntervalQuery = graphql(`
  query GetAccountBalanceIgnoreInterval($account: uuid!, $start: timestamptz = "now()", $interval: interval!) {
    balance: account_balance_ignore_interval(args: {account: $account, interval: $interval, start: $start}) {
      value: balance
    }
  }
`);

export const GetLatestTokenPriceQuery = graphql(`
  query GetLatestTokenPrice($tokenId: uuid!) {
    token_price_history(where: { token: { _eq: $tokenId } }, order_by: { created_at: desc }, limit: 1) {
      created_at
      id
      price
      token
    }
  }
`);

export const GetAccountTransactionsQuery = graphql(`
  query GetAccountTransactions($accountId: uuid!) {
    token_transaction(
      order_by: { account_transaction_data: { created_at: desc } }
      where: { account_transaction_data: { account_data: { id: { _eq: $accountId } } } }
    ) {
      account_transaction
      amount
      id
      token
      token_data {
        id
        name
        supply
        symbol
        uri
      }
      account_transaction_data {
        created_at
      }
      token_price {
        price
        created_at
      }
    }
  }
`);

export const GetTokenPriceHistorySinceQuery = graphql(`
  query GetTokenPriceHistorySince($tokenId: uuid!, $since: timestamptz!) {
    token_price_history(
      where: { token: { _eq: $tokenId }, created_at: { _gte: $since } }
      order_by: { created_at: asc }
    ) {
      created_at
      id
      price
      token
    }
  }
`);
