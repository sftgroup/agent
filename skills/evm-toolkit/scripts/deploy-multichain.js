#!/usr/bin/env node
// deploy-multichain.js — Hardhat 多链确定性部署脚本
// 用法: npx hardhat run scripts/deploy-multichain.js --network <chain>
// 自动从 contracts-config.json 读取配置，写入 DEPLOY_RECORDS.md

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// 从 contracts-config.json 读取（单源真相）
const CONFIG_PATH = path.join(__dirname, "..", "..", "contracts-config.json");
let config = {};
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
} catch {
  console.warn("⚠️ contracts-config.json not found, using defaults");
}

const DEPLOY_RECORDS = path.join(__dirname, "..", "..", "DEPLOY_RECORDS.md");
const GAS_LIMIT = 3000000;
const TX_TIMEOUT = 120000; // 2 min

// === 可配置区 ===
// 修改这里的合约名和参数即可
const CONTRACTS_TO_DEPLOY = [
  {
    name: "MyContract",
    args: (deployer, chain) => [
      // 构造参数 — 修改这里
      // arg1, arg2, ...
    ],
  },
];

// === 工具函数 ===
async function deployContract(contractName, args, label) {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\n[${label}] Deploying ${contractName}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Nonce: ${await deployer.getTransactionCount()}`);

  const Factory = await hre.ethers.getContractFactory(contractName);
  const contract = await Factory.deploy(...args, { gasLimit: GAS_LIMIT });
  console.log(`  Tx: ${contract.deployTransaction.hash}`);
  console.log(`  Waiting...`);

  await contract.deployTransaction.wait();
  // Hardhat v5+ 添加这个
  if (contract.waitForDeployment) await contract.waitForDeployment();
  const addr = contract.target || contract.address;

  console.log(`  ✅ ${contractName}: ${addr}`);
  return { address: addr, tx: contract.deployTransaction.hash };
}

function appendRecord(network, results) {
  const now = new Date().toISOString();
  let md = `\n## Deploy — ${network} (${now})\n\n`;
  results.forEach(r => {
    md += `| ${r.name} | \`${r.address}\` | \`${r.tx}\` |\n`;
  });
  fs.appendFileSync(DEPLOY_RECORDS, md);
  console.log(`📝 Records written to DEPLOY_RECORDS.md`);
}

// === 主函数 ===
async function main() {
  const chain = hre.network.name;
  const chainId = hre.network.config.chainId;
  console.log(`\n🚀 Deploying on ${chain} (chainId=${chainId})`);

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH`);

  if (balance < hre.ethers.parseEther("0.01")) {
    throw new Error(`❌ Balance too low: ${hre.ethers.formatEther(balance)} ETH`);
  }

  const results = [];
  for (const c of CONTRACTS_TO_DEPLOY) {
    const args = c.args(deployer, chain);
    const r = await deployContract(c.name, args, chain);
    results.push({ name: c.name, ...r });
  }

  // 写部署记录
  appendRecord(chain, results);

  console.log(`\n✅ ${chain} deploy complete — ${results.length} contracts`);
  results.forEach(r => console.log(`   ${r.name}: ${r.address}`));
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Deploy failed:", err.message);
    process.exit(1);
  });
