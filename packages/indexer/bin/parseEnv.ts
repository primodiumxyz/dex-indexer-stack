import { z, ZodError, ZodIntersection, ZodTypeAny } from "zod";

// Schema for environment variables passed to the root `.env` file or `docker-compose.yml` file
const commonSchema = z.object({
  // Node environment
  // - "local" & "test" will use local Hasura and Timescale databases
  // - "production" will use production Hasura instance as specified below (which should point to the production Timescale instance)
  NODE_ENV: z.enum(["local", "test", "production"]).default("local"),
  // URL of the Hasura instance (this should not include the path, e.g. "/v1/graphql")
  HASURA_URL: z.string().default("http://localhost:8090"),
  // Admin secret to write to the Hasura instance
  HASURA_ADMIN_SECRET: z.string(),
  // URL of the Quicknode endpoint
  QUICKNODE_ENDPOINT: z.string(),
  // Token for the Quicknode endpoint
  QUICKNODE_TOKEN: z.string(),
  // URL of the Jupiter API endpoint, including the token
  JUPITER_URL: z.string(),
});

/**
 * Parse the environment variables and validate them against the provided schema. If no schema is provided, the common
 * schema is used.
 *
 * @param schema - The schema to validate the environment variables against.
 * @returns The parsed environment variables.
 */
export function parseEnv<TSchema extends ZodTypeAny | undefined = undefined>(
  schema?: TSchema,
): z.infer<TSchema extends ZodTypeAny ? ZodIntersection<typeof commonSchema, TSchema> : typeof commonSchema> {
  const envSchema = schema !== undefined ? z.intersection(commonSchema, schema) : commonSchema;
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof ZodError) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _errors, ...invalidEnvVars } = error.format();
      console.error(`\nMissing or invalid environment variables:\n\n  ${Object.keys(invalidEnvVars).join("\n  ")}\n`);
      process.exit(1);
    }
    throw error;
  }
}
