import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { WordChainV5 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("WordChainV5", function () {
  // Test constants
  const WORD = "ephemeral";
  const OPTIONS: [string, string, string, string] = [
    "lasting forever",
    "short-lived",
    "very large",
    "extremely small"
  ];
  const CORRECT_ANSWER = "short-lived";
  const CORRECT_OPTION = 2;
  const ENTRY_FEE = ethers.parseEther("0.01");
  const ROUND_DURATION = 300; // 5 minutes

  // Role constants
  let SUPER_ADMIN: string;
  let ROUND_MANAGER: string;
  let TREASURER: string;
  let PAUSER: string;

  // Generate answer hash for a round
  function generateHash(roundId: number, word: string, answer: string, option: number): string {
    return ethers.solidityPackedKeccak256(
      ["uint256", "string", "string", "uint8"],
      [roundId, word, answer, option]
    );
  }

  // Deploy fixture
  async function deployFixture() {
    const [deployer, superAdmin, roundManager, treasurer, pauser, player1, player2, player3, player4, player5] = 
      await ethers.getSigners();

    const WordChain = await ethers.getContractFactory("WordChainV5");
    const contract = await WordChain.deploy(
      superAdmin.address,
      [roundManager.address],
      [treasurer.address],
      [pauser.address]
    );

    // Get role hashes
    SUPER_ADMIN = await contract.SUPER_ADMIN();
    ROUND_MANAGER = await contract.ROUND_MANAGER();
    TREASURER = await contract.TREASURER();
    PAUSER = await contract.PAUSER();

    return { contract, deployer, superAdmin, roundManager, treasurer, pauser, player1, player2, player3, player4, player5 };
  }

  // Helper to start a standard round
  async function startStandardRound(
    contract: WordChainV5,
    roundManager: SignerWithAddress,
    roundId: number = 1
  ) {
    const hash = generateHash(roundId, WORD, CORRECT_ANSWER, CORRECT_OPTION);
    await contract.connect(roundManager).startRound(WORD, OPTIONS, hash, ROUND_DURATION, 0, true);
    return hash;
  }

  /* ========== DEPLOYMENT TESTS ========== */
  describe("Deployment", function () {
    it("Should set the correct super admin", async function () {
      const { contract, superAdmin } = await loadFixture(deployFixture);
      expect(await contract.hasRole(SUPER_ADMIN, superAdmin.address)).to.be.true;
    });

    it("Should assign round manager role", async function () {
      const { contract, roundManager } = await loadFixture(deployFixture);
      expect(await contract.hasRole(ROUND_MANAGER, roundManager.address)).to.be.true;
    });

    it("Should assign treasurer role", async function () {
      const { contract, treasurer } = await loadFixture(deployFixture);
      expect(await contract.hasRole(TREASURER, treasurer.address)).to.be.true;
    });

    it("Should assign pauser role", async function () {
      const { contract, pauser } = await loadFixture(deployFixture);
      expect(await contract.hasRole(PAUSER, pauser.address)).to.be.true;
    });

    it("Should start unpaused", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.paused()).to.be.false;
    });

    it("Should have correct default config", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.entryFee()).to.equal(ethers.parseEther("0.01"));
      expect(await contract.treasuryFeePercent()).to.equal(5);
      expect(await contract.defaultRoundDuration()).to.equal(24 * 60 * 60);
    });

    it("Should reject zero address super admin", async function () {
      const WordChain = await ethers.getContractFactory("WordChainV5");
      await expect(
        WordChain.deploy(ethers.ZeroAddress, [], [], [])
      ).to.be.revertedWithCustomError(WordChain, "InvalidInput");
    });
  });

  /* ========== ROLE MANAGEMENT TESTS ========== */
  describe("Role Management", function () {
    it("Should allow super admin to add round manager", async function () {
      const { contract, superAdmin, player1 } = await loadFixture(deployFixture);
      await contract.connect(superAdmin).addAdmin(ROUND_MANAGER, player1.address);
      expect(await contract.hasRole(ROUND_MANAGER, player1.address)).to.be.true;
    });

    it("Should allow super admin to remove round manager", async function () {
      const { contract, superAdmin, roundManager } = await loadFixture(deployFixture);
      await contract.connect(superAdmin).removeAdmin(ROUND_MANAGER, roundManager.address);
      expect(await contract.hasRole(ROUND_MANAGER, roundManager.address)).to.be.false;
    });

    it("Should reject non-super admin adding roles", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);
      await expect(
        contract.connect(roundManager).addAdmin(ROUND_MANAGER, player1.address)
      ).to.be.reverted;
    });

    it("Should allow super admin transfer", async function () {
      const { contract, superAdmin, player1 } = await loadFixture(deployFixture);
      await contract.connect(superAdmin).transferSuperAdmin(player1.address);
      expect(await contract.hasRole(SUPER_ADMIN, player1.address)).to.be.true;
      expect(await contract.hasRole(SUPER_ADMIN, superAdmin.address)).to.be.false;
    });

    it("Should reject transfer to zero address", async function () {
      const { contract, superAdmin } = await loadFixture(deployFixture);
      await expect(
        contract.connect(superAdmin).transferSuperAdmin(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(contract, "InvalidInput");
    });

    it("Should reject invalid role in addAdmin", async function () {
      const { contract, superAdmin, player1 } = await loadFixture(deployFixture);
      const invalidRole = ethers.keccak256(ethers.toUtf8Bytes("INVALID"));
      await expect(
        contract.connect(superAdmin).addAdmin(invalidRole, player1.address)
      ).to.be.revertedWithCustomError(contract, "InvalidInput");
    });
  });

  /* ========== ROUND MANAGEMENT TESTS ========== */
  describe("Round Management", function () {
    describe("Starting Rounds", function () {
      it("Should start a round successfully", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        const hash = generateHash(1, WORD, CORRECT_ANSWER, CORRECT_OPTION);

        await expect(contract.connect(roundManager).startRound(WORD, OPTIONS, hash, ROUND_DURATION, 0, true))
          .to.emit(contract, "RoundStarted")
          .withArgs(1, WORD, OPTIONS, await time.latest() + ROUND_DURATION + 1, 0, true, await time.latest() + 1);

        expect(await contract.currentRoundId()).to.equal(1);
      });

      it("Should reject empty word", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        const hash = generateHash(1, "", CORRECT_ANSWER, CORRECT_OPTION);

        await expect(
          contract.connect(roundManager).startRound("", OPTIONS, hash, ROUND_DURATION, 0, true)
        ).to.be.revertedWithCustomError(contract, "InvalidInput");
      });

      it("Should reject empty options", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        const badOptions: [string, string, string, string] = ["a", "", "c", "d"];
        const hash = generateHash(1, WORD, CORRECT_ANSWER, CORRECT_OPTION);

        await expect(
          contract.connect(roundManager).startRound(WORD, badOptions, hash, ROUND_DURATION, 0, true)
        ).to.be.revertedWithCustomError(contract, "InvalidInput");
      });

      it("Should reject zero hash", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        await expect(
          contract.connect(roundManager).startRound(WORD, OPTIONS, ethers.ZeroHash, ROUND_DURATION, 0, true)
        ).to.be.revertedWithCustomError(contract, "InvalidHash");
      });

      it("Should reject duration below minimum", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        const hash = generateHash(1, WORD, CORRECT_ANSWER, CORRECT_OPTION);

        await expect(
          contract.connect(roundManager).startRound(WORD, OPTIONS, hash, 30, 0, true) // 30 seconds < 1 minute
        ).to.be.revertedWithCustomError(contract, "InvalidInput");
      });

      it("Should reject duration above maximum", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        const hash = generateHash(1, WORD, CORRECT_ANSWER, CORRECT_OPTION);
        const tooLong = 31 * 24 * 60 * 60; // 31 days

        await expect(
          contract.connect(roundManager).startRound(WORD, OPTIONS, hash, tooLong, 0, true)
        ).to.be.revertedWithCustomError(contract, "InvalidInput");
      });

      it("Should use default duration when 0 is passed", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        const hash = generateHash(1, WORD, CORRECT_ANSWER, CORRECT_OPTION);

        await contract.connect(roundManager).startRound(WORD, OPTIONS, hash, 0, 0, true);
        const round = await contract.getRound(1);
        const expectedEnd = round.startAt + BigInt(24 * 60 * 60);
        expect(round.endAt).to.equal(expectedEnd);
      });

      it("Should reject non-round-manager starting round", async function () {
        const { contract, player1 } = await loadFixture(deployFixture);
        const hash = generateHash(1, WORD, CORRECT_ANSWER, CORRECT_OPTION);

        await expect(
          contract.connect(player1).startRound(WORD, OPTIONS, hash, ROUND_DURATION, 0, true)
        ).to.be.reverted;
      });

      it("Should reject starting new round when previous unresolved", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager, 1);

        const hash2 = generateHash(2, "test", "answer", 1);
        await expect(
          contract.connect(roundManager).startRound("test", OPTIONS, hash2, ROUND_DURATION, 0, true)
        ).to.be.revertedWithCustomError(contract, "PreviousRoundNotResolved");
      });
    });

    describe("Ending Rounds", function () {
      it("Should end round early", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await expect(contract.connect(roundManager).endRound(1))
          .to.emit(contract, "RoundEnded")
          .withArgs(1, 0);

        const round = await contract.getRound(1);
        expect(round.isEnded).to.be.true;
        expect(round.isActive).to.be.false;
      });

      it("Should reject ending inactive round", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);
        await contract.connect(roundManager).endRound(1);

        await expect(
          contract.connect(roundManager).endRound(1)
        ).to.be.revertedWithCustomError(contract, "RoundNotActive");
      });

      it("Should reject ending non-existent round", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        await expect(
          contract.connect(roundManager).endRound(999)
        ).to.be.revertedWithCustomError(contract, "InvalidRoundId");
      });
    });

    describe("Cancelling Rounds", function () {
      it("Should cancel round", async function () {
        const { contract, roundManager } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await expect(contract.connect(roundManager).cancelRound(1, "Test cancellation"))
          .to.emit(contract, "RoundCancelled")
          .withArgs(1, "Test cancellation");

        const round = await contract.getRound(1);
        expect(round.isCancelled).to.be.true;
      });

      it("Should reject cancelling already revealed round", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);
        await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });
        await contract.connect(roundManager).endRound(1);
        await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

        await expect(
          contract.connect(roundManager).cancelRound(1, "Too late")
        ).to.be.revertedWithCustomError(contract, "InvalidInput");
      });
    });
  });

  /* ========== PLAYER ACTIONS TESTS ========== */
  describe("Player Actions", function () {
    describe("Joining Rounds", function () {
      it("Should allow player to join round", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await expect(contract.connect(player1).joinRound(2, { value: ENTRY_FEE }))
          .to.emit(contract, "GuessSubmitted");

        const guess = await contract.getPlayerGuess(1, player1.address);
        expect(guess.option).to.equal(2);
        expect(guess.exists).to.be.true;
      });

      it("Should update round pool and participant count", async function () {
        const { contract, roundManager, player1, player2 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await contract.connect(player1).joinRound(1, { value: ENTRY_FEE });
        await contract.connect(player2).joinRound(2, { value: ENTRY_FEE });

        const round = await contract.getRound(1);
        expect(round.totalPool).to.equal(ENTRY_FEE * 2n);
        expect(round.participantCount).to.equal(2);
      });

      it("Should refund excess payment", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        const excess = ethers.parseEther("0.05");
        const balanceBefore = await ethers.provider.getBalance(player1.address);

        const tx = await contract.connect(player1).joinRound(2, { value: ENTRY_FEE + excess });
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;

        const balanceAfter = await ethers.provider.getBalance(player1.address);
        const spent = balanceBefore - balanceAfter;

        // Should only have spent entry fee + gas
        expect(spent).to.be.closeTo(ENTRY_FEE + gasCost, ethers.parseEther("0.001"));
      });

      it("Should reject insufficient payment", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await expect(
          contract.connect(player1).joinRound(2, { value: ENTRY_FEE / 2n })
        ).to.be.revertedWithCustomError(contract, "InsufficientFunds");
      });

      it("Should reject invalid option (0)", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await expect(
          contract.connect(player1).joinRound(0, { value: ENTRY_FEE })
        ).to.be.revertedWithCustomError(contract, "InvalidOption");
      });

      it("Should reject invalid option (5)", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await expect(
          contract.connect(player1).joinRound(5, { value: ENTRY_FEE })
        ).to.be.revertedWithCustomError(contract, "InvalidOption");
      });

      it("Should reject duplicate guess", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });

        await expect(
          contract.connect(player1).joinRound(3, { value: ENTRY_FEE })
        ).to.be.revertedWithCustomError(contract, "AlreadyGuessed");
      });

      it("Should reject joining expired round", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await time.increase(ROUND_DURATION + 1);

        await expect(
          contract.connect(player1).joinRound(2, { value: ENTRY_FEE })
        ).to.be.revertedWithCustomError(contract, "RoundExpired");
      });

      it("Should reject joining ended round", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);
        await contract.connect(roundManager).endRound(1);

        await expect(
          contract.connect(player1).joinRound(2, { value: ENTRY_FEE })
        ).to.be.revertedWithCustomError(contract, "RoundExpired");
      });

      it("Should reject joining when no active round", async function () {
        const { contract, player1 } = await loadFixture(deployFixture);

        await expect(
          contract.connect(player1).joinRound(2, { value: ENTRY_FEE })
        ).to.be.revertedWithCustomError(contract, "NoActiveRound");
      });

      it("Should update player stats on join", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });

        const stats = await contract.playerStats(player1.address);
        expect(stats.totalGames).to.equal(1);
        expect(stats.lastPlayedRound).to.equal(1);
      });
    });

    describe("Withdrawing Prizes", function () {
      it("Should allow winner to withdraw", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await contract.connect(player1).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
        await contract.connect(roundManager).endRound(1);
        await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

        const pending = await contract.pendingPrizes(player1.address);
        expect(pending).to.be.gt(0);

        const balanceBefore = await ethers.provider.getBalance(player1.address);
        const tx = await contract.connect(player1).withdrawPrizes();
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;
        const balanceAfter = await ethers.provider.getBalance(player1.address);

        expect(balanceAfter).to.equal(balanceBefore + pending - gasCost);
        expect(await contract.pendingPrizes(player1.address)).to.equal(0);
      });

      it("Should reject withdrawal with no pending prizes", async function () {
        const { contract, player1 } = await loadFixture(deployFixture);

        await expect(
          contract.connect(player1).withdrawPrizes()
        ).to.be.revertedWithCustomError(contract, "NoPendingWithdrawal");
      });
    });

    describe("Claiming Refunds", function () {
      it("Should allow refund from cancelled round", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });
        await contract.connect(roundManager).cancelRound(1, "Cancelled");

        const balanceBefore = await ethers.provider.getBalance(player1.address);
        const tx = await contract.connect(player1).claimRefund(1);
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;
        const balanceAfter = await ethers.provider.getBalance(player1.address);

        expect(balanceAfter).to.equal(balanceBefore + ENTRY_FEE - gasCost);
      });

      it("Should reject double refund claim", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });
        await contract.connect(roundManager).cancelRound(1, "Cancelled");
        await contract.connect(player1).claimRefund(1);

        await expect(
          contract.connect(player1).claimRefund(1)
        ).to.be.revertedWithCustomError(contract, "AlreadyGuessed");
      });

      it("Should reject refund from non-cancelled round", async function () {
        const { contract, roundManager, player1 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });

        await expect(
          contract.connect(player1).claimRefund(1)
        ).to.be.revertedWithCustomError(contract, "InvalidInput");
      });

      it("Should reject refund for non-participant", async function () {
        const { contract, roundManager, player1, player2 } = await loadFixture(deployFixture);
        await startStandardRound(contract, roundManager);

        await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });
        await contract.connect(roundManager).cancelRound(1, "Cancelled");

        await expect(
          contract.connect(player2).claimRefund(1)
        ).to.be.revertedWithCustomError(contract, "InvalidInput");
      });
    });
  });

  /* ========== REVEAL TESTS ========== */
  describe("Reveal Answer", function () {
    it("Should reveal correctly and distribute prizes", async function () {
      const { contract, roundManager, player1, player2, player3 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      // player1 and player2 guess correctly, player3 wrong
      await contract.connect(player1).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
      await contract.connect(player2).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
      await contract.connect(player3).joinRound(1, { value: ENTRY_FEE });

      await contract.connect(roundManager).endRound(1);

      await expect(contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION))
        .to.emit(contract, "RoundRevealed");

      const result = await contract.getRoundResult(1);
      expect(result.winnerCount).to.equal(2);
      expect(result.exists).to.be.true;

      // Check prizes credited
      const prize1 = await contract.pendingPrizes(player1.address);
      const prize2 = await contract.pendingPrizes(player2.address);
      const prize3 = await contract.pendingPrizes(player3.address);

      expect(prize1).to.be.gt(0);
      expect(prize2).to.equal(prize1);
      expect(prize3).to.equal(0);
    });

    it("Should give all to treasury when no winners", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(1, { value: ENTRY_FEE }); // Wrong answer

      await contract.connect(roundManager).endRound(1);
      await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

      const result = await contract.getRoundResult(1);
      expect(result.winnerCount).to.equal(0);
      expect(result.treasuryFee).to.equal(ENTRY_FEE);
    });

    it("Should reject reveal before round ends", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });

      await expect(
        contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION)
      ).to.be.revertedWithCustomError(contract, "RoundStillActive");
    });

    it("Should reject reveal with wrong answer", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });
      await contract.connect(roundManager).endRound(1);

      await expect(
        contract.connect(roundManager).revealAnswer(1, "wrong answer", CORRECT_OPTION)
      ).to.be.revertedWithCustomError(contract, "AnswerMismatch");
    });

    it("Should reject reveal with wrong option", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });
      await contract.connect(roundManager).endRound(1);

      await expect(
        contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, 3) // Wrong option
      ).to.be.revertedWithCustomError(contract, "AnswerMismatch");
    });

    it("Should reject reveal with invalid hash", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);
      
      // Start with wrong hash
      const wrongHash = generateHash(1, WORD, "wrong", CORRECT_OPTION);
      await contract.connect(roundManager).startRound(WORD, OPTIONS, wrongHash, ROUND_DURATION, 0, true);

      await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });
      await contract.connect(roundManager).endRound(1);

      await expect(
        contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION)
      ).to.be.revertedWithCustomError(contract, "InvalidHash");
    });

    it("Should reject double reveal", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
      await contract.connect(roundManager).endRound(1);
      await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

      await expect(
        contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION)
      ).to.be.revertedWithCustomError(contract, "AlreadyRevealed");
    });

    it("Should reject reveal with minimum participants not met", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);
      
      const hash = generateHash(1, WORD, CORRECT_ANSWER, CORRECT_OPTION);
      await contract.connect(roundManager).startRound(WORD, OPTIONS, hash, ROUND_DURATION, 5, true); // min 5

      await contract.connect(player1).joinRound(2, { value: ENTRY_FEE }); // Only 1 participant
      await contract.connect(roundManager).endRound(1);

      await expect(
        contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION)
      ).to.be.revertedWithCustomError(contract, "MinParticipantsNotMet");
    });

    it("Should allow reveal after time expires without manual end", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
      
      await time.increase(ROUND_DURATION + 1);

      // Should work without calling endRound first
      await expect(
        contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION)
      ).to.emit(contract, "RoundRevealed");
    });
  });

  /* ========== PLAYER STATS TESTS ========== */
  describe("Player Stats", function () {
    it("Should track win streak correctly", async function () {
      const { contract, roundManager, superAdmin, player1 } = await loadFixture(deployFixture);

      // Round 1 - Win
      await startStandardRound(contract, roundManager, 1);
      await contract.connect(player1).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
      await contract.connect(roundManager).endRound(1);
      await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

      let stats = await contract.playerStats(player1.address);
      expect(stats.winStreak).to.equal(1);
      expect(stats.correctGuesses).to.equal(1);

      // Round 2 - Win again
      const hash2 = generateHash(2, WORD, CORRECT_ANSWER, CORRECT_OPTION);
      await contract.connect(roundManager).startRound(WORD, OPTIONS, hash2, ROUND_DURATION, 0, true);
      await contract.connect(player1).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
      await contract.connect(roundManager).endRound(2);
      await contract.connect(roundManager).revealAnswer(2, CORRECT_ANSWER, CORRECT_OPTION);

      stats = await contract.playerStats(player1.address);
      expect(stats.winStreak).to.equal(2);
      expect(stats.correctGuesses).to.equal(2);
      expect(stats.bestStreak).to.equal(2);
    });

    it("Should reset streak on loss", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);

      // Round 1 - Win
      await startStandardRound(contract, roundManager, 1);
      await contract.connect(player1).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
      await contract.connect(roundManager).endRound(1);
      await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

      // Round 2 - Lose
      const hash2 = generateHash(2, WORD, CORRECT_ANSWER, CORRECT_OPTION);
      await contract.connect(roundManager).startRound(WORD, OPTIONS, hash2, ROUND_DURATION, 0, true);
      await contract.connect(player1).joinRound(1, { value: ENTRY_FEE }); // Wrong answer
      await contract.connect(roundManager).endRound(2);
      await contract.connect(roundManager).revealAnswer(2, CORRECT_ANSWER, CORRECT_OPTION);

      const stats = await contract.playerStats(player1.address);
      expect(stats.winStreak).to.equal(0);
      expect(stats.bestStreak).to.equal(1); // Best streak preserved
      expect(stats.correctGuesses).to.equal(1);
      expect(stats.totalGames).to.equal(2);
    });

    it("Should track total earnings", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
      await contract.connect(roundManager).endRound(1);
      await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

      const stats = await contract.playerStats(player1.address);
      const result = await contract.getRoundResult(1);

      expect(stats.totalEarned).to.equal(result.individualPrize);
    });
  });

  /* ========== CONFIG TESTS ========== */
  describe("Configuration", function () {
    it("Should update entry fee", async function () {
      const { contract, superAdmin } = await loadFixture(deployFixture);
      const newFee = ethers.parseEther("0.05");

      await expect(contract.connect(superAdmin).setEntryFee(newFee))
        .to.emit(contract, "EntryFeeUpdated")
        .withArgs(newFee);

      expect(await contract.entryFee()).to.equal(newFee);
    });

    it("Should reject entry fee below minimum", async function () {
      const { contract, superAdmin } = await loadFixture(deployFixture);

      await expect(
        contract.connect(superAdmin).setEntryFee(100) // Below MIN_ENTRY_FEE
      ).to.be.revertedWithCustomError(contract, "InvalidInput");
    });

    it("Should update treasury fee percent", async function () {
      const { contract, superAdmin } = await loadFixture(deployFixture);

      await expect(contract.connect(superAdmin).setTreasuryFeePercent(10))
        .to.emit(contract, "TreasuryFeeUpdated")
        .withArgs(10);

      expect(await contract.treasuryFeePercent()).to.equal(10);
    });

    it("Should reject treasury fee above maximum", async function () {
      const { contract, superAdmin } = await loadFixture(deployFixture);

      await expect(
        contract.connect(superAdmin).setTreasuryFeePercent(25) // Above MAX_TREASURY_FEE_PERCENT
      ).to.be.revertedWithCustomError(contract, "InvalidInput");
    });

    it("Should update default round duration", async function () {
      const { contract, superAdmin } = await loadFixture(deployFixture);
      const newDuration = 12 * 60 * 60; // 12 hours

      await expect(contract.connect(superAdmin).setDefaultRoundDuration(newDuration))
        .to.emit(contract, "DefaultRoundDurationUpdated")
        .withArgs(newDuration);

      expect(await contract.defaultRoundDuration()).to.equal(newDuration);
    });

    it("Should reject non-super-admin config changes", async function () {
      const { contract, roundManager } = await loadFixture(deployFixture);

      await expect(
        contract.connect(roundManager).setEntryFee(ethers.parseEther("0.05"))
      ).to.be.reverted;
    });
  });

  /* ========== PAUSE TESTS ========== */
  describe("Pause Functionality", function () {
    it("Should pause contract", async function () {
      const { contract, pauser } = await loadFixture(deployFixture);

      await expect(contract.connect(pauser).setPaused(true))
        .to.emit(contract, "ContractPausedEvent")
        .withArgs(true);

      expect(await contract.paused()).to.be.true;
    });

    it("Should unpause contract", async function () {
      const { contract, pauser } = await loadFixture(deployFixture);

      await contract.connect(pauser).setPaused(true);
      await contract.connect(pauser).setPaused(false);

      expect(await contract.paused()).to.be.false;
    });

    it("Should reject actions when paused", async function () {
      const { contract, roundManager, pauser, player1 } = await loadFixture(deployFixture);

      await startStandardRound(contract, roundManager);
      await contract.connect(pauser).setPaused(true);

      await expect(
        contract.connect(player1).joinRound(2, { value: ENTRY_FEE })
      ).to.be.revertedWithCustomError(contract, "ContractPaused");
    });

    it("Should reject starting round when paused", async function () {
      const { contract, roundManager, pauser } = await loadFixture(deployFixture);

      await contract.connect(pauser).setPaused(true);
      const hash = generateHash(1, WORD, CORRECT_ANSWER, CORRECT_OPTION);

      await expect(
        contract.connect(roundManager).startRound(WORD, OPTIONS, hash, ROUND_DURATION, 0, true)
      ).to.be.revertedWithCustomError(contract, "ContractPaused");
    });

    it("Should reject non-pauser pausing", async function () {
      const { contract, player1 } = await loadFixture(deployFixture);

      await expect(contract.connect(player1).setPaused(true)).to.be.reverted;
    });
  });

  /* ========== TREASURY TESTS ========== */
  describe("Treasury", function () {
    it("Should collect treasury fees", async function () {
      const { contract, roundManager, player1, player2 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
      await contract.connect(player2).joinRound(1, { value: ENTRY_FEE });

      await contract.connect(roundManager).endRound(1);
      await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

      const treasury = await contract.treasuryBalance();
      expect(treasury).to.be.gt(0);
    });

    it("Should allow treasurer to withdraw", async function () {
      const { contract, roundManager, treasurer, player1 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(1, { value: ENTRY_FEE }); // Wrong answer
      await contract.connect(roundManager).endRound(1);
      await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

      const treasuryBal = await contract.treasuryBalance();
      const balBefore = await ethers.provider.getBalance(treasurer.address);

      await contract.connect(treasurer).withdrawTreasury(treasuryBal, treasurer.address);

      const balAfter = await ethers.provider.getBalance(treasurer.address);
      expect(balAfter).to.be.gt(balBefore);
      expect(await contract.treasuryBalance()).to.equal(0);
    });

    it("Should reject withdrawal exceeding balance", async function () {
      const { contract, treasurer } = await loadFixture(deployFixture);

      await expect(
        contract.connect(treasurer).withdrawTreasury(ethers.parseEther("100"), treasurer.address)
      ).to.be.revertedWithCustomError(contract, "InsufficientFunds");
    });

    it("Should reject non-treasurer withdrawal", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(1, { value: ENTRY_FEE });
      await contract.connect(roundManager).endRound(1);
      await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

      await expect(
        contract.connect(player1).withdrawTreasury(ENTRY_FEE, player1.address)
      ).to.be.reverted;
    });

    it("Should accept direct ETH transfers to treasury", async function () {
      const { contract, player1 } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("1");
      await player1.sendTransaction({ to: await contract.getAddress(), value: amount });

      expect(await contract.treasuryBalance()).to.equal(amount);
    });
  });

  /* ========== VIEW FUNCTIONS TESTS ========== */
  describe("View Functions", function () {
    it("Should return current round", async function () {
      const { contract, roundManager } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      const round = await contract.getCurrentRound();
      expect(round.word).to.equal(WORD);
      expect(round.isActive).to.be.true;
    });

    it("Should return game config", async function () {
      const { contract } = await loadFixture(deployFixture);

      const config = await contract.getGameConfig();
      expect(config._entryFee).to.equal(ENTRY_FEE);
      expect(config._treasuryFeePercent).to.equal(5);
      expect(config._paused).to.be.false;
    });

    it("Should return round participants", async function () {
      const { contract, roundManager, player1, player2 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(1, { value: ENTRY_FEE });
      await contract.connect(player2).joinRound(2, { value: ENTRY_FEE });

      const participants = await contract.getRoundParticipants(1);
      expect(participants.length).to.equal(2);
      expect(participants).to.include(player1.address);
      expect(participants).to.include(player2.address);
    });

    it("Should check refund eligibility", async function () {
      const { contract, roundManager, player1, player2 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(2, { value: ENTRY_FEE });
      await contract.connect(roundManager).cancelRound(1, "Test");

      const [canClaim, amount] = await contract.canClaimRefund(1, player1.address);
      expect(canClaim).to.be.true;
      expect(amount).to.equal(ENTRY_FEE);

      const [canClaim2] = await contract.canClaimRefund(1, player2.address);
      expect(canClaim2).to.be.false;
    });

    it("Should check admin roles", async function () {
      const { contract, roundManager, player1 } = await loadFixture(deployFixture);

      expect(await contract.isAdmin(ROUND_MANAGER, roundManager.address)).to.be.true;
      expect(await contract.isAdmin(ROUND_MANAGER, player1.address)).to.be.false;
    });

    it("Should return role identifiers", async function () {
      const { contract } = await loadFixture(deployFixture);

      const roles = await contract.getRoles();
      expect(roles[0]).to.equal(SUPER_ADMIN);
      expect(roles[1]).to.equal(ROUND_MANAGER);
      expect(roles[2]).to.equal(TREASURER);
      expect(roles[3]).to.equal(PAUSER);
    });
  });

  /* ========== EDGE CASES ========== */
  describe("Edge Cases", function () {
    it("Should handle single winner taking full prize pool", async function () {
      const { contract, roundManager, player1, player2, player3 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await contract.connect(player1).joinRound(CORRECT_OPTION, { value: ENTRY_FEE }); // Winner
      await contract.connect(player2).joinRound(1, { value: ENTRY_FEE }); // Loser
      await contract.connect(player3).joinRound(3, { value: ENTRY_FEE }); // Loser

      await contract.connect(roundManager).endRound(1);
      await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

      const result = await contract.getRoundResult(1);
      expect(result.winnerCount).to.equal(1);

      const totalPool = ENTRY_FEE * 3n;
      const expectedTreasuryFee = totalPool * 5n / 100n;
      const expectedPrize = totalPool - expectedTreasuryFee;

      expect(result.individualPrize).to.equal(expectedPrize);
    });

    it("Should handle round with zero participants on reveal", async function () {
      const { contract, roundManager } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      await time.increase(ROUND_DURATION + 1);

      await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

      const result = await contract.getRoundResult(1);
      expect(result.winnerCount).to.equal(0);
      expect(result.treasuryFee).to.equal(0);
    });

    it("Should handle max participants limit", async function () {
      const { contract, roundManager } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      // This is a conceptual test - in practice you'd need 500+ signers
      const maxParticipants = await contract.MAX_PARTICIPANTS_PER_ROUND();
      expect(maxParticipants).to.equal(500);
    });

    it("Should distribute leftover wei to treasury", async function () {
      const { contract, roundManager, player1, player2, player3 } = await loadFixture(deployFixture);
      await startStandardRound(contract, roundManager);

      // 3 winners with pool that doesn't divide evenly
      await contract.connect(player1).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
      await contract.connect(player2).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });
      await contract.connect(player3).joinRound(CORRECT_OPTION, { value: ENTRY_FEE });

      await contract.connect(roundManager).endRound(1);
      await contract.connect(roundManager).revealAnswer(1, CORRECT_ANSWER, CORRECT_OPTION);

      const result = await contract.getRoundResult(1);
      const totalPool = ENTRY_FEE * 3n;
      
      // Verify all funds are accounted for
      const accountedFor = result.totalDistributed + result.treasuryFee;
      expect(accountedFor).to.equal(totalPool);
    });
  });
});