// Stands in for the `server-only` package when a Node test imports a module
// that carries the guard. The real package throws outside Next's bundler by
// design -- that throw is what keeps HERMES_API_SECRET and TOOL_LAYER_SECRET
// out of the browser, so it stays exactly as it is and the test steps around
// it rather than the other way round.
module.exports = {};
