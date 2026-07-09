import { ethers } from "ethers";
import { execSync } from "child_process";
import { getChain, getGasPreset, resolveToken } from "./config.js";
import { getNonce, incrementNonce, saveDeployment, saveTx, confirmTx, getDb } from "./store.js";
import fs from "fs";
import path from "path";

let _providerCache: Record<string, ethers.providers.JsonRpcProvider> = {};
let _walletCache: Record<string, ethers.Wallet> = {};

function getProvider(chain: string): ethers.providers.JsonRpcProvider {
  if (!_providerCache[chain]) {
    const cfg = getChain(chain);
    _providerCache[chain] = new ethers.providers.JsonRpcProvider(cfg.rpc);
  }
  return _providerCache[chain];
}

/** Resolve private key: PRIVATE_KEY_<CHAIN> > PRIVATE_KEY > PRIVATE_KEY_POOL (auto-select by balance) */
let _poolCache: { addr: string; pk: string; balance: ethers.BigNumber }[] | null = null;

async function resolvePK(chain?: string): Promise<string> {
  // 1. Per-chain override
  if (chain) {
    const perChain = process.env[`PRIVATE_KEY_${chain.toUpperCase()}`];
    if (perChain) return perChain;
  }
  // 2. Single default
  const single = process.env.PRIVATE_KEY || process.env.DEPLOYER_PK;
  if (single) return single;
  // 3. Pool — auto-select richest
  const pool = process.env.PRIVATE_KEY_POOL;
  if (!pool) throw new Error("No private key configured (PRIVATE_KEY or PRIVATE_KEY_POOL)");
  const pks = pool.split(",").map(p => p.trim()).filter(Boolean);
  if (pks.length === 0) throw new Error("PRIVATE_KEY_POOL is empty");

  if (!_poolCache) {
    const provider = getProvider(chain || "sepolia");
    const entries = await Promise.all(
      pks.map(async (pk) => {
        const wallet = new ethers.Wallet(pk, provider);
        const balance = await provider.getBalance(wallet.address);
        return { addr: wallet.address, pk, balance };
      })
    );
    _poolCache = entries.sort((a, b) => (b.balance.gt(a.balance) ? 1 : -1));
  }

  const best = _poolCache[0];
  if (best.balance.isZero()) throw new Error("All keys in pool have zero balance");
  return best.pk;
}

async function getWallet(chain?: string): Promise<ethers.Wallet> {
  const key = chain || "default";
  if (!_walletCache[key]) {
    const pk = await resolvePK(chain);
    _walletCache[key] = new ethers.Wallet(pk);
  }
  return _walletCache[key].connect(getProvider(chain || "eth"));
}

// ─── evm_status ──────────────────────────────────────
export async function evm_status(args: { chain: string; address?: string }) {
  const cfg = getChain(args.chain);
  const provider = getProvider(args.chain);
  const [block, gasPrice, feeData] = await Promise.all([
    provider.getBlockNumber(),
    provider.getGasPrice(),
    provider.getFeeData(),
  ]);

  const result: any = {
    chain_id: cfg.id,
    chain_name: cfg.name,
    block_number: block,
    gas_price_gwei: ethers.utils.formatUnits(gasPrice, "gwei"),
    base_fee_gwei: feeData.lastBaseFeePerGas
      ? ethers.utils.formatUnits(feeData.lastBaseFeePerGas, "gwei")
      : null,
  };

  if (args.address) {
    const [bal, nonce] = await Promise.all([
      provider.getBalance(args.address),
      provider.getTransactionCount(args.address),
    ]);
    result.address = {
      address: args.address,
      balance: ethers.utils.formatEther(bal),
      nonce,
    };

    // Check registry
    const db = getDb();
    const contracts = db.prepare(
      "SELECT name, address, tx_hash, deployed_at FROM deployments WHERE chain = ? AND deployer = ? ORDER BY deployed_at DESC LIMIT 5"
    ).all(args.chain, args.address);
    if (contracts.length) result.contracts = contracts;
  }

  return result;
}

// ─── evm_call ──────────────────────────────────────
export async function evm_call(args: {
  chain: string;
  address: string;
  abi?: any[];
  method: string;
  args?: any[];
}) {
  const contract = new ethers.Contract(args.address, args.abi || ["function " + args.method], getProvider(args.chain));
  const parts = parseMethod(args.method);
  const result = await contract[parts.name](...(args.args || []));
  return { result };
}

// ─── evm_send ──────────────────────────────────────
export async function evm_send(args: {
  chain: string;
  address: string;
  abi?: any[];
  method: string;
  args?: any[];
  value?: string;
  gas_limit?: number;
  max_fee_per_gas?: string;
  max_priority_fee_per_gas?: string;
}) {
  const wallet = await getWallet(args.chain);
  const gasPreset = getGasPreset(args.chain);
  const cfg = getChain(args.chain);

  // Build tx
  const iface = new ethers.utils.Interface(args.abi || []);
  const data = iface.encodeFunctionData(args.method, args.args || []);
  const nonce = await wallet.getTransactionCount();

  const tx = await wallet.sendTransaction({
    to: args.address,
    data,
    value: args.value ? ethers.utils.parseEther(args.value) : undefined,
    gasLimit: args.gas_limit || 300000,
    maxFeePerGas: args.max_fee_per_gas
      ? ethers.utils.parseUnits(args.max_fee_per_gas, "gwei")
      : ethers.utils.parseUnits(String(gasPreset.maxFee), "gwei"),
    maxPriorityFeePerGas: args.max_priority_fee_per_gas
      ? ethers.utils.parseUnits(args.max_priority_fee_per_gas, "gwei")
      : ethers.utils.parseUnits(String(gasPreset.priorityFee), "gwei"),
    nonce,
  });

  saveTx({
    chain: args.chain, tx_hash: tx.hash, nonce, deployer: wallet.address,
    contract: args.address, method: args.method, status: "pending",
    created_at: new Date().toISOString(),
  });

  return {
    tx_hash: tx.hash,
    chain_id: cfg.id,
    explorer_url: `${cfg.explorer}/tx/${tx.hash}`,
    nonce,
  };
}

// ─── evm_deploy ──────────────────────────────────────
export async function evm_deploy(args: {
  chain: string;
  project_dir: string;
  contract_name: string;
  constructor_args?: any[];
  gas_limit?: number;
  verify?: boolean;
  tags?: string[];
}) {
  const wallet = await getWallet(args.chain);
  const cfg = getChain(args.chain);
  const gasPreset = getGasPreset(args.chain);

  // Compile
  const compileResult = compileContract(args.project_dir, args.contract_name);
  if (!compileResult.success) throw new Error(`Compile failed: ${compileResult.errors?.join("; ")}`);

  // Deploy
  const factory = new ethers.ContractFactory(
    compileResult.abi!,
    compileResult.bytecode!,
    wallet
  );

  const nonce = await wallet.getTransactionCount();
  const contract = await factory.deploy(...(args.constructor_args || []), {
    gasLimit: args.gas_limit || 3000000,
    maxFeePerGas: ethers.utils.parseUnits(String(gasPreset.maxFee), "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits(String(gasPreset.priorityFee), "gwei"),
    nonce,
  });
  await contract.deployTransaction.wait();

  const addr = contract.address;

  // Save to registry
  saveDeployment({
    chain: args.chain, name: args.contract_name, address: addr,
    tx_hash: contract.deployTransaction.hash, deployer: wallet.address,
    constructor_args: JSON.stringify(args.constructor_args || []),
    bytecode_hash: compileResult.bytecode_hash,
    compiler_version: compileResult.compiler_version,
    deployed_at: new Date().toISOString(),
    verified: 0,
    tags: args.tags || [],
  });

  // Verify if requested
  let verified = false;
  if (args.verify !== false) {
    try {
      await verifyContract(args.chain, addr, args.contract_name, args.constructor_args || [], args.project_dir);
      verified = true;
      getDb().prepare("UPDATE deployments SET verified = 1 WHERE address = ?").run(addr);
    } catch (e: any) {
      console.warn(`Verify failed (non-fatal): ${e.message}`);
    }
  }

  saveTx({
    chain: args.chain, tx_hash: contract.deployTransaction.hash, nonce,
    deployer: wallet.address, contract: addr, method: "deploy", status: "pending",
    created_at: new Date().toISOString(),
  });

  return {
    address: addr,
    tx_hash: contract.deployTransaction.hash,
    deployer: wallet.address,
    chain_id: cfg.id,
    explorer_url: `${cfg.explorer}/address/${addr}`,
    verified,
    gas_used: (await contract.deployTransaction.wait()).gasUsed.toString(),
  };
}

// ─── evm_verify ──────────────────────────────────────
export async function evm_verify(args: {
  chain: string;
  address: string;
  contract_name: string;
  constructor_args: any[];
  project_dir: string;
}) {
  const cfg = getChain(args.chain);
  await verifyContract(args.chain, args.address, args.contract_name, args.constructor_args, args.project_dir);
  getDb().prepare("UPDATE deployments SET verified = 1 WHERE address = ?").run(args.address);

  return {
    success: true,
    explorer_url: `${cfg.explorer}/address/${args.address}#code`,
  };
}

// ─── evm_logs ──────────────────────────────────────
export async function evm_logs(args: {
  chain: string;
  address: string;
  topic0: string;
  topic1?: string;
  from_block: number;
  to_block?: number | string;
}) {
  const provider = getProvider(args.chain);
  const addresses = args.address.split(",").map(a => a.trim());

  const filter: any = { address: addresses, topics: [args.topic0] };
  if (args.topic1) filter.topics.push(args.topic1);

  const logs = await provider.getLogs({
    ...filter,
    fromBlock: args.from_block,
    toBlock: args.to_block === "latest" ? "latest" : (args.to_block || "latest"),
  });

  return {
    logs: logs.map(l => ({
      address: l.address,
      topics: l.topics,
      data: l.data,
      block_number: l.blockNumber,
      tx_hash: l.transactionHash,
    })),
    total: logs.length,
  };
}

// ─── evm_token ──────────────────────────────────────
export async function evm_token(args: {
  action: "balance" | "transfer" | "approve" | "allowance";
  chain: string;
  token: string;
  owner?: string;
  spender?: string;
  recipient?: string;
  amount?: string;
}) {
  const tokenAddr = resolveToken(args.chain, args.token);
  const wallet = await getWallet(args.chain);
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address,uint256) returns (bool)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)",
  ];
  const token = new ethers.Contract(tokenAddr, erc20Abi, wallet);
  const decimals = await token.decimals();

  switch (args.action) {
    case "balance": {
      const addr = args.owner || wallet.address;
      const bal = await token.balanceOf(addr);
      const symbol = await token.symbol();
      return { token: symbol, address: addr, balance: ethers.utils.formatUnits(bal, decimals), raw: bal.toString() };
    }
    case "allowance": {
      if (!args.owner || !args.spender) throw new Error("owner and spender required");
      const allowance = await token.allowance(args.owner, args.spender);
      return { owner: args.owner, spender: args.spender, allowance: ethers.utils.formatUnits(allowance, decimals), raw: allowance.toString() };
    }
    case "approve": {
      if (!args.spender || !args.amount) throw new Error("spender and amount required");
      const amountWei = ethers.utils.parseUnits(args.amount, decimals);
      const tx = await token.approve(args.spender, amountWei);
      await tx.wait();
      const cfg = getChain(args.chain);
      return { tx_hash: tx.hash, explorer_url: `${cfg.explorer}/tx/${tx.hash}`, spender: args.spender, amount: args.amount };
    }
    case "transfer": {
      if (!args.recipient || !args.amount) throw new Error("recipient and amount required");
      const amountWei = ethers.utils.parseUnits(args.amount, decimals);
      const tx = await token.transfer(args.recipient, amountWei);
      await tx.wait();
      const cfg = getChain(args.chain);
      return { tx_hash: tx.hash, explorer_url: `${cfg.explorer}/tx/${tx.hash}`, recipient: args.recipient, amount: args.amount };
    }
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

// ─── evm_gas_preset ──────────────────────────────────
export async function evm_gas_preset(args: { chain: string; priority?: "slow" | "normal" | "fast" }) {
  const preset = getGasPreset(args.chain, args.priority || "normal");
  return {
    chain: args.chain,
    ...preset,
    unit: "gwei",
  };
}

// ─── Helpers ──────────────────────────────────────────

function parseMethod(method: string): { name: string; args: string } {
  const match = method.match(/^(\w+)\((.*)\)$/);
  if (match) return { name: match[1], args: match[2] };
  return { name: method, args: "" };
}

function compileContract(projectDir: string, contractName: string): any {
  // Try forge first, then hardhat
  let output: string;
  try {
    // forge build
    const cwd = path.resolve(projectDir);
    execSync("forge build", { cwd, stdio: "pipe", timeout: 120000 });

    // Read forge artifacts
    const artifactPath = path.join(cwd, "out", `${contractName}.sol`, `${contractName}.json`);
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      return {
        success: true,
        abi: artifact.abi,
        bytecode: artifact.bytecode.object,
        bytecode_hash: ethers.utils.keccak256(artifact.bytecode.object),
        compiler_version: artifact.metadata?.compiler?.version || "unknown",
      };
    }
    throw new Error("Forge artifact not found");
  } catch (e: any) {
    // Fallback to hardhat-style artifact lookup
    const hhPath = path.join(projectDir, "artifacts", "contracts", `${contractName}.sol`, `${contractName}.json`);
    if (fs.existsSync(hhPath)) {
      const artifact = JSON.parse(fs.readFileSync(hhPath, "utf8"));
      return {
        success: true,
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        bytecode_hash: ethers.utils.keccak256(artifact.bytecode),
        compiler_version: artifact.metadata?.compiler?.version || "unknown",
      };
    }
    return { success: false, errors: [e.message] };
  }
}

async function verifyContract(chain: string, address: string, contractName: string, constructorArgs: any[], projectDir: string) {
  const cfg = getChain(chain);
  const apiUrl = cfg.explorerApi;
  const apiKey = cfg.explorerApiKey;

  // Encode constructor args
  const encoded = ethers.utils.defaultAbiCoder.encode(
    constructorArgs.map(() => "address"), // simplified
    constructorArgs
  );

  // Flatten source
  let flatSrc = "";
  try {
    flatSrc = execSync(`cd ${projectDir} && forge flatten src/${contractName}.sol 2>/dev/null`, {
      encoding: "utf8", timeout: 30000,
    });
  } catch {
    // If flatten fails, try hardhat
    try {
      flatSrc = execSync(`cd ${projectDir} && npx hardhat flatten src/${contractName}.sol 2>/dev/null`, {
        encoding: "utf8", timeout: 30000,
      });
    } catch {
      throw new Error("Cannot flatten source for verification");
    }
  }

  const body = new URLSearchParams({
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: flatSrc,
    codeformat: "solidity-single-file",
    contractname: contractName,
    compilerversion: "v0.8.28+commit.7893614a",
    optimizationUsed: "1",
    runs: "200",
    constructorArguements: encoded.slice(2),
    evmversion: "cancun",
  });

  const resp = await fetch(apiUrl, { method: "POST", body });
  const json = await resp.json();
  if (json.status !== "1" && json.message !== "OK") {
    throw new Error(`Verify failed: ${json.result || json.message}`);
  }
}
