import { useState } from "react";

import { TokenChart } from "@/components/token-chart";
import { TokensTable } from "@/components/tokens-table";
import { Token } from "@/lib/types";

/**
 * Component to display the tracker, which is the entire content of the dashboard
 *
 * @returns The tracker component
 */
export const Tracker = () => {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);

  if (selectedToken) return <TokenChart token={selectedToken} onBack={() => setSelectedToken(null)} />;
  return (
    <div className="flex flex-col items-start w-full max-h-fit gap-4 p-4">
      <h3 className="text-lg font-semibold">Pumping tokens</h3>
      <TokensTable onRowClick={(row) => setSelectedToken(row.original as Token)} />
    </div>
  );
};
