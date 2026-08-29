import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CONTRACTS, CHAIN_ID, ZERO32, signalHash } from "./encode.js";
import { Interface } from "ethers";

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


server.tool(
  "z1n_build_signal_tx",
  "Build an unsigned submitSignal transaction. Computes signalHash locally. Verify to/data before signing.",
  {
    tokenId: z.number().int().min(0),
    contentRef: z.string(),
    symbolIndex: z.number().int().min(0).max(20),
    intent: z.number().int().min(0).max(3),
    replyTo: z.string().optional()
  },
  async (a) => {
    const clientTimestamp = Math.floor(Date.now() / 1000);
    const hash = signalHash({ ...a, clientTimestamp });
    const iface = new Interface([
      "function submitSignal(uint256,bytes32,string,uint8,uint8,bytes32,uint64)"
    ]);
    const data = iface.encodeFunctionData("submitSignal", [
      a.tokenId, hash, a.contentRef, a.symbolIndex, a.intent,
      a.replyTo || ZERO32, clientTimestamp
    ]);
    const live = await get("/live");
    return text({
      chainId: CHAIN_ID,
      to: CONTRACTS.signal,
      data,
      value: "0",
      action: "submitSignal",
      contract: "Z1NSignal",
      decodedArgs: { ...a, signalHash: hash, clientTimestamp },
      contentRefBytes: Buffer.byteLength(a.contentRef, "utf8"),
      sourceEpoch: live.currentEpoch,
      warnings: [
        "contentRef is permanent and public on-chain",
        "limit 2 signals per Key per epoch",
        "caller must own tokenId"
      ]
    });
  }
);

server.tool(
  "z1n_build_attest_tx",
  "Build an unsigned attestSignal transaction. Two-argument form: names the Key you attest with.",
  {
    signalHash: z.string(),
    tokenId: z.number().int().min(0)
  },
  async ({ signalHash: h, tokenId }) => {
    const iface = new Interface(["function attestSignal(bytes32,uint256)"]);
    const data = iface.encodeFunctionData("attestSignal", [h, tokenId]);
    const [live, sig] = await Promise.all([get("/live"), get("/signal/" + h)]);
    const windowEpoch = sig.epoch + 1;
    const inWindow = live.currentEpoch === windowEpoch;
    return text({
      chainId: CHAIN_ID,
      to: CONTRACTS.signal,
      data,
      value: "0",
      action: "attestSignal",
      contract: "Z1NSignal",
      decodedArgs: { signalHash: h, tokenId },
      signal: { keyId: sig.keyId, epoch: sig.epoch, intent: sig.intent, attestCount: sig.attestCount },
      currentEpoch: live.currentEpoch,
      validOnlyInEpoch: windowEpoch,
      inWindow,
      warnings: [
        inWindow ? "in window" : "OUT OF WINDOW - this will revert",
        "no self-attestation, and none between Keys in the same wallet",
        "max 21 Key attestations per signal",
        "limit 2 attestations per Key per epoch"
      ]
    });
  }
);

await server.connect(new StdioServerTransport());
