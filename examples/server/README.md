# Examples: server

A TypeScript-based tRPC server, providing API endpoints that can be protected and scheduled tasks for making database mutations.

It uses Fastify as the underlying web server and integrates with the [`DEX GraphQL`](./../../packages/gql/README.md) backend for data management.

Essentially—and this is the purpose of this example—it refreshes rolling 30-min stats for tokens in the database every few seconds, which is a task that needs to be handled when using the stack.

## Installation

1. Install dependencies:

   ```sh
   pnpm i
   ```

2. Configure the environment variables in the root `.env` file (or don't, and use the defaults):

| Variable              | Description                          | Default                 |
| --------------------- | ------------------------------------ | ----------------------- |
| `NODE_ENV`            | Environment (local, dev, test, prod) | `local`                 |
| `HASURA_URL`          | URL of the Hasura endpoint           | `http://localhost:8090` |
| `HASURA_ADMIN_SECRET` | Admin secret for Hasura GraphQL      | `password`              |
| `SERVER_HOST`         | Host that the server listens on      | `0.0.0.0`               |
| `SERVER_PORT`         | Port that the server listens on      | `8888`                  |

## Usage

To run the server:

```sh
pnpm start
```

The server will start performing scheduled tasks every few seconds after initialization.

### Create a client

```ts
const server = createServerClient({
  httpUrl: "http://localhost:8888/trpc",
  wsUrl: "ws://localhost:8888/trpc",
});

const status = await server.getStatus.query();
console.log(status);
// -> { status: 200 }
```

## Contributing

If you wish to contribute to the package, or add an example, please open an issue first to make sure that this is within the scope of the repository.

## License

This project is licensed under the MIT License - see [LICENSE](../../LICENSE) for details.
