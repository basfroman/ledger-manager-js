import { Buffer } from 'buffer';

globalThis.Buffer = Buffer;

const [
  polkadotApi,
  hwLedger,
  util,
  merkle,
] = await Promise.all([
  import('@polkadot/api'),
  import('@polkadot/hw-ledger'),
  import('@polkadot/util'),
  import('@polkadot-api/merkleize-metadata'),
]);

export const { ApiPromise, WsProvider } = polkadotApi;
export const { LedgerGeneric } = hwLedger;
export const { u8aToHex } = util;
export const { merkleizeMetadata } = merkle;
