import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ============ CELO TESTNET (ALFAJORES) CONFIGURATION ============
interface DeployConfig {
  admin: string;
  entryFee: string;
  treasuryFeePercent: number;
  defaultRoundDuration: number;
  verify: boolean;
}

// Update these addresses with your own!
const config: DeployConfig = {
  // Main admin - has full control (use your wallet address)
  admin: "", // Leave empty to use deployer

  // Game settings
  entryFee: "0.1", // 0.1 CELO for testnet
  treasuryFeePercent: 5, // 5% fee
  defaultRoundDuration: 300, // 5 minutes for testing

  // Verify on Celo Explorer
  verify: true,
};

// ============ DEPLOYMENT SCRIPT ============
async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Deploying WordChainV5 to Celo Alfajores Testnet`);
  console.log(`${"=".repeat(60)}\n`);

  // Verify we're on the right network
  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (chainId !== 44787n) {
    console.log(`⚠️  Warning: Expected Celo Alfajores (chainId 44787), got ${chainId}`);
    console.log(`   Continuing anyway...\n`);
  }

  // Get deployer
  const [deployer] = await ethers.getSigners();
  const deployerBalance = await ethers.provider.getBalance(deployer.address);

  console.log(`📍 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(deployerBalance)} CELO\n`);

  if (deployerBalance < ethers.parseEther("0.5")) {
    console.log(`⚠️  Warning: Low balance. Get testnet CELO from:`);
    console.log(`   https://faucet.celo.org/alfajores\n`);
  }

  // Use deployer if admin not specified
  const admin = config.admin || deployer.address;

  console.log("📋 Deployment Configuration:");
  console.log(`   Admin:           ${admin}`);
  console.log(`   Entry Fee:       ${config.entryFee} CELO`);
  console.log(`   Treasury Fee:    ${config.treasuryFeePercent}%`);
  console.log(`   Round Duration:  ${config.defaultRoundDuration}s\n`);

  // Deploy contract
  console.log("⏳ Deploying contract...");
  const WordChain = await ethers.getContractFactory("WordChainV5");
  const contract = await WordChain.deploy(admin);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`✅ Contract deployed to: ${contractAddress}\n`);

  // Configure contract
  console.log("⚙️  Configuring contract...");

  // Set entry fee
  const fee = ethers.parseEther(config.entryFee);
  let tx = await contract.setFee(fee);
  await tx.wait();
  console.log(`   ✓ Entry fee set to ${config.entryFee} CELO`);

  // Set treasury fee
  tx = await contract.setTreasuryFee(config.treasuryFeePercent);
  await tx.wait();
  console.log(`   ✓ Treasury fee set to ${config.treasuryFeePercent}%`);

  // Set round duration
  tx = await contract.setDuration(config.defaultRoundDuration);
  await tx.wait();
  console.log(`   ✓ Default round duration set to ${config.defaultRoundDuration}s\n`);

  // Verify on Celo Explorer
  if (config.verify) {
    console.log("🔍 Verifying contract on Celo Explorer...");
    console.log("   Waiting 30 seconds for indexing...\n");

    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: [admin],
      });
      console.log("✅ Contract verified!\n");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ Contract already verified\n");
      } else {
        console.log(`⚠️  Verification failed: ${error.message}`);
        console.log("   You can verify manually at https://alfajores.celoscan.io\n");
      }
    }
  }

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deployment = {
    network: "celoAlfajores",
    chainId: 44787,
    contractAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    roles: { admin },
    config: {
      entryFee: config.entryFee,
      treasuryFeePercent: config.treasuryFeePercent,
      defaultRoundDuration: config.defaultRoundDuration,
    },
  };

  const filename = path.join(deploymentsDir, "celo-alfajores.json");
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
  console.log(`📁 Deployment info saved to: ${filename}\n`);

  // Print summary
  console.log(`${"=".repeat(60)}`);
  console.log("🎉 DEPLOYMENT COMPLETE");
  console.log(`${"=".repeat(60)}`);
  console.log(`\n📍 Contract Address: ${contractAddress}`);
  console.log(`🌐 Network: Celo Alfajores Testnet`);
  console.log(`🔗 Explorer: https://alfajores.celoscan.io/address/${contractAddress}`);
  console.log(`\n${"=".repeat(60)}\n`);

  // Print next steps
  console.log("📝 NEXT STEPS:\n");
  console.log("1. Get testnet CELO: https://faucet.celo.org/alfajores");
  console.log("\n2. Start a round using the helper below:");
  console.log(`
   npx hardhat run scripts/start-round.ts --network celo-alfajores
  `);
  console.log("\n3. Test joining a round in your frontend/console\n");

  return contractAddress;
}

// ============ HELPER: Generate answer hash ============
export function generateAnswerHash(
  roundId: number,
  word: string,
  correctAnswer: string,
  correctOption: number
): string {
  return ethers.solidityPackedKeccak256(
    ["uint256", "string", "string", "uint8"],
    [roundId, word, correctAnswer, correctOption]
  );
}

// ============ RUN ============
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });