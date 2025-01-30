# DEX Indexer stack

**A full-stack for indexing DEX trades and tokens on Solana with high performance and low latency.**

This monorepo is composed of two libraries available from npm, as well as examples and documentation. The libraries are:

- [`@primodiumxyz/dex-indexer`](https://www.npmjs.com/package/@primodiumxyz/dex-indexer): The indexer for Solana DEX trades and token metadata
- [`@primodiumxyz/dex-graphql`](https://www.npmjs.com/package/@primodiumxyz/dex-graphql): The GraphQL client and Hasura/Timescale databases management framework

See the dedicated README in each package for detailed documentation.

- [`DEX Indexer`](./packages/indexer/README.md)
- [`DEX GraphQL`](./packages/gql/README.md)
- [`Example dashboard`](./examples/dashboard/README.md)
- [`Example server`](./examples/server/README.md)

## Table of contents

- [Introduction](#introduction)
  - [Overview](#overview)
  - [Installation](#installation)
  - [Environment](#environment)
  - [Dependencies](#dependencies)
- [Development](#development)
  - [Running the stack](#running-the-stack)
  - [Testing and building](#testing-and-building)
- [Contributing](#contributing)
- [License](#license)

## Introduction

### Overview

The [`DEX Indexer`](./packages/indexer/README.md) and [`DEX GraphQL`](./packages/gql/README.md) packages compose the entire stack for indexing trades and tokens, managing the database in which the data is stored, and querying it through a type-safe GraphQL API.

The [`example dashboard`](./examples/dashboard/README.md) and [`example server`](./examples/server/README.md) expose the way it is intended to query and interact with the database.

The codebase is structured as a `pnpm` monorepo with the following structure:

```ml
examples - "Example integrations with the indexer stack"
├── dashboard - "A React explorer for top-ranked tokens by 30-min volume, with price and candlestick charts"
└── server - "A Fastify server that exposes endpoints and performs periodic tasks on the database"
packages - "Libraries that compose the indexer stack"
│── indexer - "The indexer for Solana DEX trades and token metadata"
└── gql - "The GraphQL client and Hasura/Timescale databases management framework"
resources - "Examples and resources for running and understanding the stack"
```

### Installation

This monorepo uses `pnpm` as its package manager. First, [install `node`, then `npm`](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), then install `pnpm`.

```bash
npm install -g pnpm
```

This repository is tested with `node` version `23.5.0` and `pnpm` version `9.15.2`.

Then, clone the repository and install the necessary npm packages with the following from the root folder:

```bash
git clone https://github.com/primodiumxyz/dex-indexer-stack.git
cd dex-indexer-stack
pnpm i
```

### Environment

To set the current environment variables for both local development and production, copy `/.env.example` to a new `/.env`.

```bash
cp .env.example .env
```

See [the example environment file](./.env.example) for information on each variable.

### Dependencies

This stack—or specifically the indexer—requires some external services to request and subscribe to onchain data.

- [Yellowstone GRPC](https://github.com/rpcpool/yellowstone-grpc) for streaming transactions with low latency
- [Jupiter](https://station.jup.ag/docs/apis/price-api-v2) for fetching token prices (`/prices`)
- [DAS API](https://developers.metaplex.com/das-api) for fetching token metadata in the Metaplex standard (`/getAssets`)

All of these are available from QuickNode through add-ons, which is the recommended way to run the indexer.

Otherwise, Hasura and Timescale will be run locally during development, and can be either self-hosted or cloud-hosted with their respective offerings.

## Development

### Running the stack

First, install [Docker Desktop](https://www.docker.com/products/docker-desktop/), or any other preferred Docker alternative. [OrbStack](https://orbstack.dev/) is a good and efficient alternative for Mac users.

Running the following in the root directory of this monorepo will spin up both the indexer and databases/interfaces.

```bash
pnpm dev
```

To run the examples, run the following **as well**:

```bash
pnpm dev:examples
# or just one of the examples
pnpm dev:examples:dashboard
pnpm dev:examples:server
```

### Testing and building

To build both the indexer and GraphQL packages, run the following:

```bash
pnpm build
```

And to test all packages, run the following:

```bash
pnpm test
```

## Contributing

If you wish to contribute to the package, please open an issue first to make sure that this is within the scope of the repository, and that it is not already being worked on.

## License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) for details.
