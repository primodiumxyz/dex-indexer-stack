import createDebug from "debug";

export const debug = createDebug("@primodiumxyz:dex-indexer-stack:server");
export const error = createDebug("@primodiumxyz:dex-indexer-stack:server");

// Pipe debug output to stdout instead of stderr
debug.log = console.debug.bind(console);

// Pipe error output to stderr
error.log = console.error.bind(console);
