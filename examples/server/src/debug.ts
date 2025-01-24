import createDebug from "debug";

export const debug = createDebug("@primodiumxyz:solana-dex-indexer:server");
export const error = createDebug("@primodiumxyz:solana-dex-indexer:server");

// Pipe debug output to stdout instead of stderr
debug.log = console.debug.bind(console);

// Pipe error output to stderr
error.log = console.error.bind(console);
