export const CONTRACT_ADDRESS = "0x5aEdAaECA91934ae02225589FE810606e6ecb80b" as const;

export const CONTRACT_ABI = [
  { "inputs": [], "name": "entryFee", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "defaultRoundDuration", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "currentRoundId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "treasuryBalance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType":"uint256","name":"id","type":"uint256"}], "name": "getTotalParticipants", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"index","type":"uint256"}], "name": "getParticipant", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType":"uint8","name":"opt","type":"uint8"}], "name": "play", "outputs": [{"internalType":"bool","name":"","type":"bool"}], "stateMutability": "payable", "type": "function" },
  { "inputs": [
      {"internalType":"string","name":"word","type":"string"},
      {"internalType":"string","name":"opt1","type":"string"},
      {"internalType":"string","name":"opt2","type":"string"},
      {"internalType":"string","name":"opt3","type":"string"},
      {"internalType":"bytes32","name":"answerHash","type":"bytes32"},
      {"internalType":"uint256","name":"duration","type":"uint256"},
      {"internalType":"uint256","name":"minParts","type":"uint256"}
    ], "name": "createRound", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [
      {"internalType":"uint256","name":"id","type":"uint256"},
      {"internalType":"string","name":"answer","type":"string"},
      {"internalType":"uint8","name":"optNum","type":"uint8"}
    ], "name": "reveal", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{"internalType":"uint256","name":"id","type":"uint256"}], "name": "closeRound", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{"internalType":"uint256","name":"id","type":"uint256"}], "name": "cancel", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{"internalType":"uint256","name":"fee","type":"uint256"}], "name": "setFee", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{"internalType":"uint8","name":"pct","type":"uint8"}], "name": "setTreasuryFee", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{"internalType":"uint256","name":"dur","type":"uint256"}], "name": "setDuration", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [
      {"internalType":"uint256","name":"amount","type":"uint256"},
      {"internalType":"address payable","name":"to","type":"address"}
    ], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
] as const;
