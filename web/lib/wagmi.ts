"use client";
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { celo } from 'wagmi/chains'

export const config = createConfig({
  chains: [celo],
  transports: {
    [celo.id]: http(),
  },
  connectors: [injected()],
})
