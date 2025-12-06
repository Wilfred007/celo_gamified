import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// Environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || "";
const CELOSCAN_API_KEY = process.env.CELOSCAN_API_KEY || "";

// RPC URLs
const MAINNET_RPC = process.env.MAINNET_RPC || "https://eth.llamarpc.com";
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || "https://rpc.sepolia.org";
const POLYGONS_Rpc = process.env.POLYGONS_Rpc || "https://polygon-rpc.com";
const BASE_Rpc = process.env.BASE_Rpc || "https://mainnet.base.org";
const ARBITRUM_Rpc = process.env.ARBITRUM_Rpc || "https://arb1.arbitrum.io/rpc";

// Celo RPC URLs
const CELO_MAINNET_Rpc = process.env.CELO_MAINNET_Rpc || "https://forno.celo.org";
const CELO_SEPOLIA = process.env.CELO_SEPOLIA || "https://celo-sepolia.g.alchemy.com/v2/oVDxwLfWAUKfNuFYnuOMzKYGS-2j4udx";
const CELO_ALFAJORES_Rpc = process.env.CELO_ALFAJORES_Rpc || "https://alfajores-forno.celo-testnet.org";
console.log("PRIVATE_KEY:", process.env.PRIVATE_KEY);


const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  networks: {
    // Local
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },

    // Testnets
 

    celoSepolia: {
      url: CELO_SEPOLIA,
      accounts: [PRIVATE_KEY],
      chainId: 11142220,
    },
    // Celo Testnet (Alfajores)
    "celo-alfajores": {
      url: CELO_ALFAJORES_Rpc,
      accounts: [PRIVATE_KEY],
      chainId: 44787,
    },

    // Mainnets
  
    polygon: {
      url: POLYGONS_Rpc,
      accounts: [PRIVATE_KEY],
      chainId: 137,
    },
    base: {
      url: BASE_Rpc,
      accounts: [PRIVATE_KEY],
      chainId: 8453,
    },
    arbitrum: {
      url: ARBITRUM_Rpc,
      accounts: [PRIVATE_KEY],
      chainId: 42161,
    },
    // Celo Mainnet
    celo: {
      url: CELO_MAINNET_Rpc,
      accounts: [PRIVATE_KEY],
      chainId: 42220,
    },
  },

  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      base: BASESCAN_API_KEY,
      arbitrumOne: ARBISCAN_API_KEY,
      celo: CELOSCAN_API_KEY,
      "celo-alfajores": CELOSCAN_API_KEY,
    },
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io",
        },
      },
      {
        network: "celo-alfajores",
        chainId: 44787,
        urls: {
          apiURL: "https://api-alfajores.celoscan.io/api",
          browserURL: "https://alfajores.celoscan.io",
        },
      },
    ],
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  mocha: {
    timeout: 60000, // 60 seconds for slow networks
  },
};

export default config;