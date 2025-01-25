import { useMemo } from "react";
import { Provider as UrqlProvider } from "urql";

import { createClient as createGqlClient } from "@gql/index";
import { Tracker } from "@/components/tracker";

import "@/App.css";

const dev = import.meta.env.VITE_USER_NODE_ENV !== "production";
const gqlClientUrl = dev
  ? "http://localhost:8090/v1/graphql"
  : `${import.meta.env.VITE_HASURA_URL! as string}/v1/graphql`;

function App() {
  const client = useMemo(() => createGqlClient<"web">({ url: gqlClientUrl }).instance, []);

  return (
    <UrqlProvider value={client}>
      <Tracker />
    </UrqlProvider>
  );
}

export default App;
