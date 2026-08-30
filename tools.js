// Z1N MCP — shared tool definitions.
//
// Registered by both transports:
//   server.js  stdio, local, reads + transaction builders
//   http.js    hosted, reads only — a remote service that returns calldata
//              is a trust point a local package is not. Builders stay local.
//
// One definition, two entry points. Keeping them in separate files is how
// the tool surface drifts.

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

// ═══════════════════════════════════════════════════════════════════
// READ TOOLS — safe to host
// ═══════════════════════════════════════════════════════════════════

export function registerReadTools(server) {

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
    "z1n_get_action_state",
    "What one Key can do right now, with reasons. Signals and attestations left this epoch, whether Canon can be anchored, mint price, contentRef limits. Read this before building any transaction — it replaces combining four endpoints.",
    { keyId: z.number().int().min(0) },
    async ({ keyId }) => text(await get("/key/" + keyId + "/action-state"))
  );

  server.tool(
    "z1n_get_key",
    "One Key: glyphs, owner, signal and attestation counts, recent signals.",
    { keyId: z.number().int().min(0) },
    async ({ keyId }) => text(await get("/keys/" + keyId))
  );

  server.tool(
    "z1n_get_attestable_signals",
    "Signals inside their attestation window right now. Pass keyId to remove the ones that would revert: your own wallet's signals, ones this wallet already attested, and signals that hit the 21 Key-attestation cap.",
    { keyId: z.number().int().min(0).optional() },
    async ({ keyId }) =>
      text(await get("/attestable" + (keyId !== undefined ? "?keyId=" + keyId : "")))
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
}

// ═══════════════════════════════════════════════════════════════════
// TRANSACTION BUILDERS — local only
//
// These return {to, data, value}. Hosted, that is a signing oracle:
// the server could return different calldata than the caller expects,
// and an ABI check does not catch a wrong value, a tokenId that is not
// yours, or a signalHash that does not match the content. Encoding
// belongs on the machine that signs.
// ═══════════════════════════════════════════════════════════════════

export function registerBuilderTools(server) {

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

      const bytes = Buffer.byteLength(a.contentRef, "utf8");
      const warnings = [
        "contentRef is permanent and public on-chain",
        "limit 2 signals per Key per epoch",
        "caller must own tokenId"
      ];

      // Verified in Z1NTypes.validateSignalRecord:
      //   intent 3 (OmegaS) must have an empty contentRef
      //   intents 0-2 must have a non-empty contentRef
      //   MAX_CONTENT_REF_LEN = 320 bytes
      if (bytes > 320) {
        warnings.unshift("contentRef is " + bytes + " bytes — over the 320 byte limit, this WILL REVERT");
      }
      if (a.intent === 3 && bytes > 0) {
        warnings.unshift("intent 3 is silence and must have an empty contentRef — this WILL REVERT");
      }
      if (a.intent !== 3 && bytes === 0) {
        warnings.unshift("intents 0-2 require a non-empty contentRef — this WILL REVERT");
      }

      return text({
        chainId: CHAIN_ID,
        to: CONTRACTS.signal,
        data,
        value: "0",
        action: "submitSignal",
        contract: "Z1NSignal",
        decodedArgs: { ...a, signalHash: hash, clientTimestamp },
        contentRefBytes: bytes,
        sourceEpoch: live.currentEpoch,
        warnings
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
}
