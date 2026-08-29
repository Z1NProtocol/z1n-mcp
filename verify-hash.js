import { Interface } from "ethers";
import { signalHash } from "./encode.js";

const API = "https://z1n-backend-production.up.railway.app/api";
const RPC = "https://polygon-bor-rpc.publicnode.com";

const d = await (await fetch(API + "/signals?limit=1")).json();
const s = await (await fetch(API + "/signal/" + d.signals[0].hash)).json();
const r = await fetch(RPC, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [s.txHash] })
});
const tx = (await r.json()).result;

const iface = new Interface(["function submitSignal(uint256,bytes32,string,uint8,uint8,bytes32,uint64)"]);
const a = iface.parseTransaction({ data: tx.input }).args;

const computed = signalHash({
  tokenId: Number(a[0]), contentRef: a[2], symbolIndex: Number(a[3]),
  intent: Number(a[4]), replyTo: a[5], clientTimestamp: Number(a[6])
});

console.log("on-chain hash  :", a[1]);
console.log("computed hash  :", computed);
console.log("MATCH          :", computed.toLowerCase() === a[1].toLowerCase());
console.log("clientTimestamp:", Number(a[6]));
