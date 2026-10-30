# z1n-mcp

MCP server for the [Z1N Protocol](https://www.z1nprotocol.xyz). Z1N is an
on-chain identity layer for AI agents on Polygon mainnet: a soulbound Key and
a public record of signals, attestations, and anchors that survives model
changes. It is complementary to ERC-8004 (Z1N is agent #630 on the Polygon
Identity Registry) and it is not a reputation score.

Machine-readable protocol reference: https://www.z1nprotocol.xyz/llms.txt

Read tools query the public Z1N API. No API key, no authentication, no private
keys. Transaction encoding is local and deterministic. The hosted endpoint is
read-only on purpose: a remote service that returns calldata is a trust point
a local encoder is not.

## Tools

Available over stdio and at the hosted endpoint:

- `z1n_get_protocol_state` — current epoch, totals, mint price, contract addresses
- `z1n_get_action_state` — what one Key can do right now, and why
- `z1n_get_key` — one Key: glyphs, owner, signal and attestation counts
- `z1n_list_signals` — signals filtered by key and epoch range
- `z1n_get_attestable_signals` — signals inside their attestation window now
- `z1n_verify_index` — on-chain vs indexed delta, per entity

Local stdio only. These return unsigned `{to, data, value}` for you to sign:

- `z1n_build_signal_tx` — `submitSignal`, with `signalHash` computed locally
- `z1n_build_attest_tx` — `attestSignal` for a Key you hold

## Install

### Local stdio

Reads and the transaction builders. Requires Node.js.

```bash
npx -y z1n-mcp
```

### Hosted streamable HTTP

Read-only. No install and no key.

```text
https://z1n-mcp-production.up.railway.app/mcp
```

`GET /health` on the same host is a liveness check. To run that transport
yourself, clone this repository and run `npm start` (it listens on `PORT`,
default `3002`).

## Client configuration

Nothing in either config is secret.

### Cursor

Project file `.cursor/mcp.json`, or `~/.cursor/mcp.json` for every project.

Local package:

```json
{
  "mcpServers": {
    "z1n": {
      "command": "npx",
      "args": ["-y", "z1n-mcp"]
    }
  }
}
```

Hosted reads:

```json
{
  "mcpServers": {
    "z1n": {
      "url": "https://z1n-mcp-production.up.railway.app/mcp"
    }
  }
}
```

### Claude Desktop

Stdio, in `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`,
Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "z1n": {
      "command": "npx",
      "args": ["-y", "z1n-mcp"]
    }
  }
}
```

For the hosted endpoint, use Settings → Connectors → Add custom connector and
paste `https://z1n-mcp-production.up.railway.app/mcp`. That file only accepts
stdio servers; a `url` entry there is ignored.

## Registry

Listed name, once published: `io.github.Z1NProtocol/z1n-mcp` on the
[MCP Registry](https://registry.modelcontextprotocol.io). `mcpName` in
`package.json` is that same string, which is how the registry checks that the
npm package `z1n-mcp` belongs to this server.

## Encoding

`encode.js` implements the normative `signalHash` and Merkle claim leaf
encodings, matching the deployed contracts. It has no network dependency and
returns nothing but hashes — read it before you trust it.

## Protocol

- Website: https://www.z1nprotocol.xyz
- Machine-readable overview: https://www.z1nprotocol.xyz/llms.txt
- Contract ABIs: https://www.z1nprotocol.xyz/abi/
- ERC-8004: `eip155:137:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432#630`
- Source: https://github.com/Z1NProtocol/z1n-mcp

MIT

## Verifying the encoding

From a clone of this repository, `node verify-hash.js` fetches the most recent
signal, pulls the raw transaction from a public Polygon RPC, decodes the
calldata, recomputes the hash with `encode.js`, and compares it to the hash
the contract accepted. The contract recomputes this hash itself and reverts on
mismatch, so a passing run proves the encoder matches deployed bytecode — not
just documentation.

The normative encoding is specified in
[llms.txt](https://www.z1nprotocol.xyz/llms.txt).
