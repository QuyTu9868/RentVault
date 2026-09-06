import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { hardhat, monadTestnet, sepolia } from "viem/chains";
import { localRpcUrl } from "./chain";

/**
 * Privy's createConfig, not wagmi's. It takes no connectors on purpose: Privy owns the
 * wallet list, both the embedded wallet it makes for email users and whichever browser
 * wallet someone picks. That is also why RainbowKit is gone. One way in beats two.
 */
export const wagmiConfig = createConfig({
  chains: [hardhat, sepolia, monadTestnet],
  transports: {
    [hardhat.id]: http(localRpcUrl),
    // Named rather than left to viem's default, which is a shared public-good endpoint
    // with rate limits the rentals page reaches while polling. Only the NEXT_PUBLIC_ copy
    // exists here: this file runs in the browser, where the other one is not readable.
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
    // Undefined here is fine and is the expected case: viem falls back to Monad's own
    // public endpoint, which is a real node rather than Sepolia's shared one. The variable
    // is read anyway so a rate-limited demo can be moved without a code change.
    [monadTestnet.id]: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL),
  },
  ssr: true,
});
