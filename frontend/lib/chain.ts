import { hardhat, monadTestnet, sepolia } from "viem/chains";

/**
 * The one chain this build of the app talks to. Local development runs on the Hardhat
 * node; NEXT_PUBLIC_CHAIN_ID picks a public network for a deployed demo.
 *
 * Kept in one place because half a dozen screens will need to compare against it, and a
 * chain id copied around by hand is a chain id that eventually disagrees with itself.
 *
 * Monad Testnet is 10143 and is where this project is going. Sepolia stays in the list
 * because that deployment is still up and still works, and dropping it from here would
 * break the older demo for no gain. Monad runs EVM bytecode, so nothing above this line
 * had to change to reach it beyond naming it.
 */
export const supportedChains = [hardhat, sepolia, monadTestnet] as const;

const configuredId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? hardhat.id);

export const targetChain =
  supportedChains.find((chain) => chain.id === configuredId) ?? hardhat;

export const localRpcUrl = "http://127.0.0.1:8545";

/**
 * Which node to talk to, for whichever chain this build is pointed at.
 *
 * Returning undefined means "whatever viem thinks the default is", and on Sepolia that
 * default is a shared public-good endpoint with strict rate limits. The rentals page polls
 * a contract, so it reached those limits within minutes and every read came back 429.
 *
 * Two variables for one value. The server reads the bare name, which stays on the server.
 * The browser can only see the NEXT_PUBLIC_ one, which is compiled into the bundle and is
 * therefore public: acceptable for a testnet key whose only cost is quota, and worth
 * restricting by domain in the provider's dashboard before showing anybody the link.
 *
 * Both names are written out in full rather than built from the chain, because Next.js
 * replaces process.env.NEXT_PUBLIC_* by matching the literal text at build time. A key
 * assembled at runtime is not replaced, and reads as undefined in the browser with no
 * error to say why.
 *
 * Falls through to undefined when nothing is set, which hands viem the chain's own default
 * endpoint. On Monad that default is a real public node and is fine to start on. On Sepolia
 * it is a shared public-good endpoint that answers 429 within minutes of the rentals page
 * polling, so that one wants a key of its own.
 */
export function rpcUrl(): string | undefined {
  if (targetChain.id === hardhat.id) return localRpcUrl;
  if (targetChain.id === monadTestnet.id) {
    return (
      process.env.MONAD_RPC_URL ||
      process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
      undefined
    );
  }
  return (
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    undefined
  );
}

/**
 * Where to go and read a transaction for yourself.
 *
 * The log says which of three ways a deposit was split, and saying so is not the same as
 * showing it. A verdict is a claim about money; the explorer holds the token transfers that
 * either happened or did not, under the agent's address, on a chain this project does not
 * control. That is the difference between a record and a receipt.
 *
 * Undefined on the local chain, which has no explorer, so callers render the hash as plain
 * text there rather than a link to nowhere. viem carries the explorer for each chain it
 * knows, so this reads it from there instead of hardcoding a hostname that would go stale.
 */
export function explorerTxUrl(hash: string): string | undefined {
  const base = targetChain.blockExplorers?.default.url;
  return base ? `${base}/tx/${hash}` : undefined;
}

/**
 * The same, for a contract rather than a transaction.
 *
 * Read from viem's chain record for the same reason as above. The presentation page used to
 * write sepolia.etherscan.io into the href by hand, which was correct exactly as long as
 * Sepolia was the only network this ever ran on, and became two dead links the moment it
 * was not.
 */
export function explorerAddressUrl(address: string): string | undefined {
  const base = targetChain.blockExplorers?.default.url;
  return base ? `${base}/address/${address}` : undefined;
}
