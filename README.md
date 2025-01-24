# Tub

The project is structured as a `pnpm` monorepo with the following packages:

```
- packages
    - contracts # Solana Rust programs implemented in anchor
    - core # TypeScript core logic and types for interacting with the Solana programs
    - gql # GraphQL API for the web client
- apps
    - ios # Swift iOS app implemented with SwiftUI
    - keeper # TypeScript service for updating the database with random token data
    - web # TypeScript client for web
    - server # Node.js server for fetching state with various clients
    - indexer # Node.js server for listening to DEX trades and writing new tokens prices to the database
    - dashboard # React app for browsing pumping tokens and playing with filters, as well as analytics
```

## Development

### Requirements

This monorepo uses `pnpm` as its package manager. First, [install `node`, then `npm`](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), then install `pnpm`.

```
npm install -g pnpm
```

This repository is tested with `node` version `18.18.0`, `npm` version `9.8.1`, and `pnpm` version `8.10.5`.

Then, install the necessary `npm` packages with the following from the root folder:

```
pnpm i
```

### Setting Environment Variables

To set the current environment variables for the development server instances, copy `/.env.example` and rename the new file as `/.env`.

The most important keys to get the iOS app up and running in the iOS simulator are the following, which are all available on the [AWS secrets manager](https://us-west-2.console.aws.amazon.com/secretsmanager/listsecrets?region=us-west-2). Ask Emerson for access to the secret keys and credentials.

```
HASURA_ADMIN_SECRET=
PRIVY_APP_SECRET=
PRIVY_APP_ID=
```

### Running the Tub Services

First, install [Docker Desktop](https://www.docker.com/products/docker-desktop/). This will install all Docker-related dependencies for running containers.

Running the following in the root directory of this monorepo will spin up the server and use the remote indexer instance.

```bash
pnpm dev # This will spin up the server and its associated Redis instance.
```

To run the `indexer` and the `gql` GraphQL/Postgres database stack in development, run the following instead:

```bash
pnpm dev:fullstack # This will spin up the server, its associated Redis instance, the indexer, and the GraphQL/Postgres database stacks.
```

To test the latest user-facing features, launch the Swift iOS app in Xcode by referring to `/apps/ios/README.md`.

### Running the Tub programs

Refer to the README in [`/packages/contracts`](/packages/contracts/README.md) for instructions on developing the Tub Solana programs.

## Testing `localhost` URLs on physical devices

The iOS simulator can be used to test `localhost` URLs on the same device where a local development server is running. However, there are certain user behaviors, such as swipes and the onscreen keyboard, that cannot be reliably tested on a simulator.

To test `localhost` URLs on physical devices, such as an external iPhone, use [`ngrok`](https://ngrok.com/) to tunnel the local development URLs to a public endpoint. The following are the two URLs that we will be tunneling:

- http://localhost:8888/: local server, located in `/apps/server`
- http://localhost:8080/: local GraphQL server, located in `/packages/gql`

First, run `pnpm dev`. After the dev environment is launched, go to the [ngrok dashboard](https://dashboard.ngrok.com/domains) and login with your Primodium account. Navigate to `Universal Domains` > `Domains`.

<img width="1840" alt="image" src="https://github.com/user-attachments/assets/15f5ed70-ce50-4dd8-bb78-f4925f63b04a">

On the ngrok dashboard, create two domains in the format `primodium-tub-{server or gql}-{your primodium username}.ngrok.app`.

<img width="1840" alt="image" src="https://github.com/user-attachments/assets/2ca53fd6-6bcc-47f6-8939-9cd5fb7fc677">

Then, add the two domains to `/.env`, as follows:

```bash
# ngrok server tRPC endpoint. # Replace with your domain below.
NGROK_SERVER_URL=primodium-tub-server-emerson.ngrok.app

# ngrok GraphQL endpoint.  # Replace with your domain below.
NGROK_GQL_URL=primodium-tub-gql-emerson.ngrok.app
```

After running `pnpm dev`, which starts the ngrok ingress for the above URLs, you should get a prompt like the following in an ngrok window:

```
ngrok                                                           (Ctrl+C to quit)

Policy Management Examples http://ngrok.com/apigwexamples

Session Status                online
Account                       emerson@primodium.com (Plan: Pay-as-you-go)
Version                       3.18.1
Region                        United States (California) (us-cal-1)
Latency                       22ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://primodium-tub-server-emerson.ngrok.app -> http://localhost:8080

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

### Adding ngrok URLs to Xcode

In Xcode, navigate to `Product > Scheme > Edit Scheme`. Select `Run` on the sidebar.

<img width="1840" alt="image" src="https://github.com/user-attachments/assets/b33431a2-88e1-4862-a716-4104d85d73e9">

Add the following environment variables, _replacing the URLs below with your own custom ngrok URLs_:

- `NGROK_SERVER_URL_HOST`: set to `https://primodium-tub-server-emerson.ngrok.app`
- `NGROK_GRAPHQL_URL_HOST`: set to `https://primodium-tub-gql-emerson.ngrok.app`

Build for a physical device to test the functionality of the frontend with the local backend instances!

## Manually Testing Server to iOS Transactions

First, ensure that the `.env` file in the root directory has the necessary environment variables shown in the `.env.example` file.

To manually test server to iOS transactions, run the following command in the root directory:

```bash
pnpm dev
```

Optionally navigate to option 1 (pnpm dev:server) to see the server logs.

Then, open the Tub iOS app via Xcode and build + run the app on a physical device or in the iOS simulator.

Check to see if you have an account connected through Privy. If not, proceed to connect or create an account. Additionally, ensure that the address stored in your Privy account has at least 1 USDC in it.

Tap on `Update Tx Data` to fetch the latest unsigned transaction from the server.

Tap on `Submit Transaction` to fetch your signature from Privy and relay the signature to the server, which will submit the transaction to the Solana network.

Refer to the server logs to see the transaction submitted to the Solana network! Note that for now, the transaction signing process may be a little slow, and therefore may fail due to a timeout `TransactionExpiredBlockheightExceededError` or `BlockhashNotFound`. If you reach this error, the transaction was otherwise valid, just was too slow to be included in a block. Optimizations are being performed such that the transaction signing process will be faster in the future.

### Live Testing Server with Mock iOS/Privy

To live test the server with a mock iOS/Privy signing process, navigate to `/apps/server` and run `pnpm test tub-service.test.ts`. Ensure that the `.env` file in the root directory has the necessary environment variables set in the `.env.example` file.
