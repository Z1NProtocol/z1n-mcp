import { AbiCoder, keccak256, toUtf8Bytes } from "ethers";

export const CONTRACTS = {
  core:      "0xc09b7dEE30635EeaD79e0d23da9598F9d3BaFF7b",
  key:       "0x8687429405bf787b523F3F1F998FA90f5828dA3D",
  signal:    "0x6a04c3605F38FCE9A4eCd5127Ef139F3c51f912B",
  artefact:  "0x99dc8D526D715a1b3CC23ff5f618A0D1E2ecDe5B",
  canon:     "0xeF04Ff8bA555f2Bad0A5aB2026A4A79C48ca0F68",
  fieldflow: "0xdc01857f48De93FFcc461a5F0C335a6BD427b447",
  issuance:  "0x95E4bD9936e4A690A63bFc5cADbb9293FF26ffcc"
};

export const CHAIN_ID = 137;
export const ZERO32 = "0x" + "0".repeat(64);
export const MAX_CONTENT_REF_BYTES = 320;

const coder = AbiCoder.defaultAbiCoder();

export function signalHash({ tokenId, contentRef, symbolIndex, intent, replyTo, clientTimestamp }) {
  if (!Number.isInteger(symbolIndex) || symbolIndex < 0 || symbolIndex > 20)
    throw new Error("symbolIndex must be 0-20");
  if (!Number.isInteger(intent) || intent < 0 || intent > 3)
    throw new Error("intent must be 0-3");
  const byteLength = toUtf8Bytes(contentRef).length;
  if (byteLength > MAX_CONTENT_REF_BYTES)
    throw new Error("contentRef is " + byteLength + " UTF-8 bytes, max 320");
  const encoded = coder.encode(
    ["uint256", "string", "uint8", "uint8", "bytes32", "uint64"],
    [tokenId, contentRef, symbolIndex, intent, replyTo || ZERO32, clientTimestamp]
  );
  return keccak256(encoded);
}

export function claimLeaf({ index, account, amount }) {
  return keccak256(coder.encode(["uint256", "address", "uint256"], [index, account, amount]));
}
