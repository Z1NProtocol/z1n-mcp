import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CONTRACTS, CHAIN_ID } from "./encode.js";

const API = "https://z1n-backend-production.up.railway.app/api";

async function get(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(path + " -> HTTP " + r.status);
  return r.json();
}

const text = (o) => ({ content: [{ type: "text", text: JSON.stringify(o, null, 2) }] });
const server = new McpServer({ name: "z1n", version: "0.1.0" });

server.tool(
  "z1n_get_protocol_state",
  "Current Z1N field state: epoch, totals, mint price, contract addresses.",
  {},
  async () => {
    const live = await get("/live");
    return text({ chainId: CHAIN_ID, contracts: CONTRACTS, ...live });
  }
);

server.tool(
  "z1n_get_key",
  "One Key: glyphs, owner, signal and attestation counts, recent signals.",
  { keyId: z.number().int().min(0) },
  async ({ keyId }) => text(await get("/keys/" + keyId))
);

server.tool(
  "z1n_get_attestable_signals",
  "Signals inside their attestation window right now. This is the write loop.",
  {},
  async () => text(await get("/attestable"))
);

server.tool(
  "z1n_list_signals",
  "Signals, filterable by key and epoch range. Never returns full history.",
  {
    keyId: z.number().int().optional(),
    minEpoch: z.number().int().optional(),
    maxEpoch: z.number().int().optional(),
    limit: z.number().int().min(1).max(100).default(20)
  },
  async (a) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(a)) if (v !== undefined) q.set(k, String(v));
    return text(await get("/signals?" + q));
  }
);

server.tool(
  "z1n_verify_index",
  "On-chain vs indexed delta per entity. Check before trusting indexed data.",
  {},
  async () => text(await get("/verify"))
);

await server.connect(new StdioServerTransport());
