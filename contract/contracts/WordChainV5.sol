// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WordChain V5 - Minimal Implementation
/// @notice Learn-to-earn vocabulary game with role-based access

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract WordChainV5 is ReentrancyGuard, AccessControl {
    /* ========== ROLES ========== */
    bytes32 public constant SUPER_ADMIN = keccak256("SUPER_ADMIN");
    bytes32 public constant ROUND_MANAGER = keccak256("ROUND_MANAGER");
    bytes32 public constant TREASURER = keccak256("TREASURER");
    bytes32 public constant PAUSER = keccak256("PAUSER");

    /* ========== ERRORS ========== */
    error InsufficientFunds();
    error RoundNotActive();
    error AlreadyGuessed();
    error InvalidOption();
    error AlreadyRevealed();
    error InvalidHash();
    error NoActiveRound();
    error InvalidRoundId();
    error RoundExpired();
    error InvalidInput();
    error ContractPaused();
    error MaxParticipantsReached();
    error NoPendingWithdrawal();
    error PreviousRoundNotResolved();
    error AnswerMismatch();
    error WithdrawalFailed();
    error RoundStillActive();
    error MinParticipantsNotMet();

    /* ========== EVENTS ========== */
    event RoundStarted(uint256 indexed roundId, uint256 endAt);
    event GuessSubmitted(uint256 indexed roundId, address indexed player, uint8 option);
    event RoundRevealed(uint256 indexed roundId, uint8 correctOption, uint256 winnerCount);
    event RoundEnded(uint256 indexed roundId);
    event RoundCancelled(uint256 indexed roundId);
    event PrizeWithdrawn(address indexed player, uint256 amount);
    event RefundWithdrawn(address indexed player, uint256 indexed roundId, uint256 amount);
    event TreasuryWithdrawal(uint256 amount);

    /* ========== CONSTANTS ========== */
    uint256 public constant MIN_ENTRY_FEE = 0.0001 ether;
    uint8 public constant MAX_TREASURY_FEE_PERCENT = 20;
    uint256 public constant MIN_ROUND_DURATION = 1 minutes;
    uint256 public constant MAX_ROUND_DURATION = 30 days;
    uint16 public constant MAX_PARTICIPANTS_PER_ROUND = 500;

    /* ========== STATE ========== */
    bool public paused;
    uint256 public entryFee = 0.01 ether;
    uint8 public treasuryFeePercent = 5;
    uint256 public defaultRoundDuration = 24 hours;
    uint256 public currentRoundId;
    uint256 public nextRoundId = 1;
    uint256 public treasuryBalance;

    struct Round {
        bytes32 answerHash;
        uint8 correctOption;
        uint256 endAt;
        uint256 totalPool;
        uint256 participantCount;
        uint256 minParticipants;
        bool isActive;
        bool isRevealed;
        bool isCancelled;
    }

    struct Guess {
        uint8 option;
        uint256 amountPaid;
        bool exists;
    }

    // All strings stored separately to avoid stack depth issues
    mapping(uint256 => string) public roundWord;
    mapping(uint256 => string) public option1;
    mapping(uint256 => string) public option2;
    mapping(uint256 => string) public option3;
    mapping(uint256 => Round) public rounds;
    // Mappings instead of arrays to avoid loops
    mapping(uint256 => mapping(address => bool)) public hasParticipated;
    mapping(uint256 => mapping(uint256 => address)) public participantByIndex;
    mapping(uint256 => uint256) public participantCount;
    mapping(uint256 => mapping(address => Guess)) public guesses;
    mapping(address => uint256) public pendingPrizes;
    mapping(uint256 => mapping(address => bool)) public refundClaimed;

    /* ========== MODIFIERS ========== */
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier validRound(uint256 id) {
        if (id == 0 || rounds[id].endAt == 0) revert InvalidRoundId();
        _;
    }

    /* ========== CONSTRUCTOR ========== */
    constructor(address admin) {
        if (admin == address(0)) revert InvalidInput();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SUPER_ADMIN, admin);
        _grantRole(ROUND_MANAGER, admin);
        _grantRole(TREASURER, admin);
        _grantRole(PAUSER, admin);
    }

    /* ========== ADMIN ========== */
    function grantRoleToAddress(bytes32 role, address account) external onlyRole(SUPER_ADMIN) {
        grantRole(role, account);
    }

    function revokeRoleFromAddress(bytes32 role, address account) external onlyRole(SUPER_ADMIN) {
        revokeRole(role, account);
    }

    /* ========== ROUND MANAGEMENT ========== */
    function createRound(
        string calldata word,
        string calldata opt1,
        string calldata opt2,
        string calldata opt3,
        bytes32 answerHash,
        uint256 duration,
        uint256 minParts
    ) external onlyRole(ROUND_MANAGER) whenNotPaused returns (uint256) {
        if (bytes(word).length == 0) revert InvalidInput();
        if (answerHash == bytes32(0)) revert InvalidHash();

        uint256 dur = duration == 0 ? defaultRoundDuration : duration;
        if (dur < MIN_ROUND_DURATION || dur > MAX_ROUND_DURATION) revert InvalidInput();

        if (currentRoundId != 0) {
            Round storage prev = rounds[currentRoundId];
            if (prev.isActive && !prev.isRevealed && !prev.isCancelled) {
                revert PreviousRoundNotResolved();
            }
        }

        uint256 id = nextRoundId++;
        _initRound(id, answerHash, duration, minParts);
        
        // Store strings one at a time to avoid stack depth
        roundWord[id] = word;
        option1[id] = opt1;
        option2[id] = opt2;
        option3[id] = opt3;
        
        currentRoundId = id;
        emit RoundStarted(id, rounds[id].endAt);
        return id;
    }

    function _initRound(uint256 id, bytes32 hash, uint256 dur, uint256 minParts) private {
        uint256 d = dur == 0 ? defaultRoundDuration : dur;
        Round storage r = rounds[id];
        r.answerHash = hash;
        r.endAt = block.timestamp + d;
        r.minParticipants = minParts;
        r.isActive = true;
    }

    function closeRound(uint256 id) external onlyRole(ROUND_MANAGER) validRound(id) {
        Round storage r = rounds[id];
        if (!r.isActive) revert RoundNotActive();
        r.isActive = false;
        emit RoundEnded(id);
    }

    function reveal(uint256 id, string calldata answer, uint8 optNum) 
        external onlyRole(ROUND_MANAGER) whenNotPaused nonReentrant validRound(id) 
    {
        Round storage r = rounds[id];
        if (r.isRevealed) revert AlreadyRevealed();
        if (r.isCancelled) revert InvalidInput();
        if (r.isActive && block.timestamp < r.endAt) revert RoundStillActive();
        if (r.minParticipants > 0 && r.participantCount < r.minParticipants) {
            revert MinParticipantsNotMet();
        }
        if (optNum < 1 || optNum > 3) revert InvalidOption();

        // Verify
        string memory expected = getOption(id, optNum);
        if (keccak256(bytes(answer)) != keccak256(bytes(expected))) {
            revert AnswerMismatch();
        }

        bytes32 hash = keccak256(abi.encodePacked(id, roundWord[id], answer, optNum));
        if (hash != r.answerHash) revert InvalidHash();

        r.isActive = false;
        r.correctOption = optNum;
        r.isRevealed = true;

        distributePrizes(id, optNum);
    }

    function getOption(uint256 id, uint8 num) public view returns (string memory) {
        if (num == 1) return option1[id];
        if (num == 2) return option2[id];
        return option3[id];
    }

    function distributePrizes(uint256 id, uint8 correct) private {
        Round storage r = rounds[id];
        uint256 total = r.participantCount;
        
        // Count winners using mapping
        uint256 winners = 0;
        for (uint256 i = 0; i < total; i++) {
            address player = participantByIndex[id][i];
            if (guesses[id][player].option == correct) {
                winners++;
            }
        }

        uint256 fee = (r.totalPool * treasuryFeePercent) / 100;
        uint256 pool = r.totalPool - fee;
        uint256 prize = winners > 0 ? pool / winners : 0;

        if (winners == 0) {
            treasuryBalance += r.totalPool;
        } else {
            treasuryBalance += fee + (pool - prize * winners);
            
            // Distribute to winners
            for (uint256 i = 0; i < total; i++) {
                address player = participantByIndex[id][i];
                if (guesses[id][player].option == correct) {
                    pendingPrizes[player] += prize;
                }
            }
        }

        emit RoundRevealed(id, correct, winners);
    }

    function cancel(uint256 id) external onlyRole(ROUND_MANAGER) validRound(id) {
        Round storage r = rounds[id];
        if (r.isRevealed || r.isCancelled) revert InvalidInput();
        r.isActive = false;
        r.isCancelled = true;
        emit RoundCancelled(id);
    }

    /* ========== TREASURY ========== */
    function withdraw(uint256 amount, address payable to) 
        external onlyRole(TREASURER) nonReentrant 
    {
        if (amount == 0 || to == address(0)) revert InvalidInput();
        if (amount > treasuryBalance) revert InsufficientFunds();

        treasuryBalance -= amount;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) {
            treasuryBalance += amount;
            revert WithdrawalFailed();
        }
        emit TreasuryWithdrawal(amount);
    }

    /* ========== CONFIG ========== */
    function pause(bool p) external onlyRole(PAUSER) {
        paused = p;
    }

    function setFee(uint256 fee) external onlyRole(SUPER_ADMIN) {
        if (fee < MIN_ENTRY_FEE) revert InvalidInput();
        entryFee = fee;
    }

    function setTreasuryFee(uint8 pct) external onlyRole(SUPER_ADMIN) {
        if (pct > MAX_TREASURY_FEE_PERCENT) revert InvalidInput();
        treasuryFeePercent = pct;
    }

    function setDuration(uint256 dur) external onlyRole(SUPER_ADMIN) {
        if (dur < MIN_ROUND_DURATION || dur > MAX_ROUND_DURATION) revert InvalidInput();
        defaultRoundDuration = dur;
    }

    /* ========== PLAYER ========== */
    function play(uint8 opt) external payable whenNotPaused nonReentrant returns (bool) {
        uint256 id = currentRoundId;
        if (id == 0) revert NoActiveRound();

        Round storage r = rounds[id];
        if (!r.isActive) revert RoundNotActive();
        if (block.timestamp >= r.endAt) revert RoundExpired();
        if (opt < 1 || opt > 3) revert InvalidOption();
        if (msg.value < entryFee) revert InsufficientFunds();
        if (r.participantCount >= MAX_PARTICIPANTS_PER_ROUND) revert MaxParticipantsReached();
        if (guesses[id][msg.sender].exists) revert AlreadyGuessed();

        if (msg.value > entryFee) {
            uint256 excess = msg.value - entryFee;
            (bool ok, ) = payable(msg.sender).call{value: excess}("");
            if (!ok) pendingPrizes[msg.sender] += excess;
        }

        r.totalPool += entryFee;
        r.participantCount++;
        
        // Store using mapping instead of array
        uint256 index = participantCount[id];
        participantByIndex[id][index] = msg.sender;
        participantCount[id]++;
        hasParticipated[id][msg.sender] = true;
        
        guesses[id][msg.sender] = Guess(opt, entryFee, true);

        emit GuessSubmitted(id, msg.sender, opt);
        return true;
    }

    function claim() external nonReentrant {
        uint256 amount = pendingPrizes[msg.sender];
        if (amount == 0) revert NoPendingWithdrawal();

        pendingPrizes[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) {
            pendingPrizes[msg.sender] = amount;
            revert WithdrawalFailed();
        }
        emit PrizeWithdrawn(msg.sender, amount);
    }

    function refund(uint256 id) external nonReentrant validRound(id) {
        Round storage r = rounds[id];
        if (!r.isCancelled) revert InvalidInput();
        if (refundClaimed[id][msg.sender]) revert AlreadyGuessed();

        Guess storage g = guesses[id][msg.sender];
        if (!g.exists || g.amountPaid == 0) revert InvalidInput();

        refundClaimed[id][msg.sender] = true;
        (bool ok, ) = payable(msg.sender).call{value: g.amountPaid}("");
        if (!ok) {
            refundClaimed[id][msg.sender] = false;
            revert WithdrawalFailed();
        }
        emit RefundWithdrawn(msg.sender, id, g.amountPaid);
    }

    /* ========== VIEWS ========== */
    function getParticipant(uint256 id, uint256 index) external view validRound(id) returns (address) {
        return participantByIndex[id][index];
    }
    
    function getTotalParticipants(uint256 id) external view validRound(id) returns (uint256) {
        return participantCount[id];
    }

    receive() external payable {
        treasuryBalance += msg.value;
    }

    fallback() external payable {
        treasuryBalance += msg.value;
    }
}