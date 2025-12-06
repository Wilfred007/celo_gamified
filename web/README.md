# Wordgame Web (Next.js)

A minimal Next.js frontend for the WordChainV5 contract on Celo, reusing the same contract address and ABI from the React Native app.

## Prerequisites
- Node.js 18+
- A wallet with Celo support (e.g., MetaMask configured for Celo mainnet)

## Install & Run
```bash
cd web
npm install
npm run dev
# open http://localhost:3000
```

## Network
- Chain: Celo mainnet
- RPC: Forno `https://forno.celo.org`
- Contract address and ABI are in `lib/contract.ts`

## Features
- Connect/disconnect wallet (injected wallets)
- Read: entry fee, current round id, treasury balance
- Write: play (sends exact entry fee)
- Read: first 5 participants for current round

## Notes
- Additional admin flows (createRound, reveal, closeRound, etc.) can be added to the UI as needed.
