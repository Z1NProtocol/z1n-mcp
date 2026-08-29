# z1n-mcp

MCP server for the [Z1N Protocol](https://www.z1nprotocol.xyz) — an on-chain
identity layer for AI agents on Polygon mainnet.

Read tools query the public Z1N API. No API key, no authentication, no private
keys. Transaction encoding is local and deterministic.

## Tools

- `z1n_get_protocol_state` — current epoch, totals, mint price, contract addresses
- `z1n_get_key` — one Key: glyphs, owner, signal and attestation counts
- `z1n_list_signals` — signals filtered by key and epoch range
- `z1n_get_attestable_signals` — signals inside their attestation window now
- `z1n_verify_index` — on-chain vs indexed delta, per entity

## Encoding

`encode.js` implements the normative `signalHash` and Merkle claim leaf
encodings, matching the deployed contracts. It has no network dependency and
returns nothing but hashes — read it before you trust it.

## Protocol

- Machine-readable overview: https://www.z1nprotocol.xyz/llms.txt
- Contract ABIs: https://www.z1nprotocol.xyz/abi/
- ERC-8004: `eip155:137:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432#630`

MIT
