# EVM Toolkit — Contra AI 实战经验

## Contra AI 主网 4 链部署摘要

- **链**: BSC(56) · ETH(1) · Base(8453) · Solana
- **合约**: ContraNFT `0x7a57260f29D1225F6DAE9ad088Da1a5dEc366177` (所有 EVM 链同地址)
- **Treasury**: `0xF754269868bC7aFab9970E44181bDeB01Ccc1083`
- **RPC**: Infura(BSC) · Alchemy(ETH/Base)
- **总供应**: 500 (BSC 270, ETH 120, Base 50, Solana 60)
- **Mint 价格**: 10,000 USDC

## 踩坑详解

### 1. BSC 公共 RPC 全部限流
- ❌ `https://bsc-dataseed.binance.org/` → `eth_getLogs` 429
- ❌ `https://bsc.blockrazor.xyz/` → 同上
- ❌ `https://1rpc.io/bsc` → 同上
- ✅ `https://bsc-mainnet.infura.io/v3/KEY` → 唯一可用

### 2. Multi-chain nonce 同步
```
部署前:
  ETH  nonce: 15
  BSC  nonce: 16  ← 多了1
  Base nonce: 15
→ BSC 先发空 tx 到 nonce 16 (self-transfer 0 BNB)
→ 确认后从 nonce 16 部署 → 3 链同地址
```

### 3. estimateGas 绕过
合约 `mint()` 在 allowance 不足时 `estimateGas` 会 revert。
解法: 手动构造 calldata (`iface.encodeFunctionData("mint", [...])`)
+ 直接 `sendTransaction({ to: contract, data: calldata, gasLimit: 300000 })` 绕过 estimateGas。

### 4. OZ v5.6 EIP-712 domain separator
`_buildDomainSeparator()` in OZ v5.6.1 uses `_domainSeparatorV4()` which is standard 4-field hash:
```
keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(bytes(name)),
    keccak256(bytes(version)),
    block.chainid,
    address(this)
))
```
No `salt` field, no `extensions`. Frontend domain object must omit them.

### 5. NFT Transfer 批量操作
```javascript
// 从 deployer 转 NFT 到目标地址
for (const id of tokenIds) {
  const tx = await nft["safeTransferFrom(address,address,uint256)"](
    deployer.address, targetAddr, id, { gasLimit: 100000 }
  );
  await tx.wait();
  console.log(`NFT #${id} transferred: ${tx.hash}`);
}
// 分链分批次 (BSC 73 + ETH 23 + Base 26 = 122 个 NFT)
```

### 6. 合约地址验证
```bash
# 部署后确认所有链部署成功
for chain in bsc eth base; do
  code=$(cast code $ADDR --rpc-url ${chain^^}_RPC | wc -c)
  echo "$chain: $code bytes"
done
```

## .env 模板 (Contra AI 实际使用)

```bash
BSC_RPC="https://bsc-mainnet.infura.io/v3/KEY"
ETH_RPC="https://eth-mainnet.g.alchemy.com/v2/KEY"
BASE_RPC="https://base-mainnet.g.alchemy.com/v2/KEY"
PRIVATE_KEY="0x..."
ETHERSCAN_API_KEY="..."
BSCSCAN_API_KEY="..."
```
