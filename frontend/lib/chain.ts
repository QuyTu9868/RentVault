import { hardhat, sepolia } from "viem/chains";

/**
 * The one chain this build of the app talks to. Local development runs on the Hardhat
 * node; NEXT_PUBLIC_CHAIN_ID picks a public network for a deployed demo.
 *
 * Kept in one place because half a dozen screens will need to compare against it, and a
 * chain id copied around by hand is a chain id that eventually disagrees with itself.
 *
 * Sepolia is the deployed chain and the one a demo runs on. Monad Testnet was added here
 * for a hackathon entry and has been taken out again: nothing is deployed there, so a
 * wallet offered that chain lands on an app with no escrow and no token, which looks like
 * the app is broken rather than like a chain with nothing on it. The Hardhat network for
 * it is still in contracts/hardhat.config.js, so putting it back is one import.
 */
export const supportedChains = [hardhat, sepolia] as const;

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
 * Falls through to undefined when neither is set, which hands viem Sepolia's own default:
 * a shared public-good endpoint that answers 429 within minutes of the rentals page
 * polling. Good enough for a first run, not good enough to demo on.
 */
export function rpcUrl(): string | undefined {
  if (targetChain.id === hardhat.id) return localRpcUrl;
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
