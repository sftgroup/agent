"""
Slither Custom Detector: v14-flashloan-callback
SCSVS: V14.10 — 闪电贷回调限制
检测 DeFi 合约中缺少闪电贷回调限制，可能导致价格操纵或多池套利攻击。
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.slithir.operations import LowLevelCall
from slither.core.cfg.node import NodeType


class FlashloanCallbackLimit(AbstractDetector):
    ARGUMENT = "v14-flashloan-callback"
    HELP = "Missing flashloan callback restrictions enabling price manipulation"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.MEDIUM

    WIKI = "https://github.com/crytic/slither/wiki/Detector-Documentation#flashloan-callback-restrictions"
    WIKI_TITLE = "Flashloan Callback Restrictions"
    WIKI_DESCRIPTION = (
        "Detects DeFi functions vulnerable to flashloan-based price manipulation "
        "due to missing callback restrictions."
    )
    WIKI_EXPLOIT_SCENARIO = """
1. Attacker takes a flashloan of 1M USDC
2. Swaps 1M USDC → TokenA, pumping the price in Pool A
3. Uses inflated TokenA as collateral in lending pool, borrows ETH
4. Repays flashloan, dumps TokenA, walks away with ETH
5. Lending pool left with bad debt

Fix: add callback lock, reentrancy guard, and TWAP-based price instead of spot.
"""
    WIKI_RECOMMENDATION = (
        "Use a callback lock pattern. Use TWAP instead of spot price. "
        "Add ReentrancyGuard on callback functions. "
        "Limit callback function to only be called by trusted lending pool."
    )

    FLASH_LOAN_KEYWORDS = [
        "flashloan", "flash_loan", "onFlashLoan", "executeOperation",
        "quickLoan", "flashBorrow", "flashSwap"
    ]

    REENTRANCY_GUARDS = [
        "nonReentrant", "reentrancyGuard", "lock"
    ]

    def _is_flashloan_function(self, function) -> bool:
        name = function.name.lower()
        return any(kw.lower() in name for kw in self.FLASH_LOAN_KEYWORDS)

    def _has_reentrancy_guard(self, function) -> bool:
        for modifier in function.modifiers:
            if any(guard.lower() in modifier.name.lower() for guard in self.REENTRANCY_GUARDS):
                return True
        return False

    def _has_callback_lock(self, contract) -> bool:
        """Check if contract has a callback/execution lock state variable."""
        lock_keywords = ["locked", "executing", "inCallback", "callbackLock"]
        for var in contract.state_variables:
            if isinstance(var.type, str):
                continue
            type_name = str(var.type).lower() if hasattr(var.type, '__str__') else ""
            if "bool" in type_name:
                if any(lk in var.name.lower() for lk in lock_keywords):
                    return True
        return False

    def _has_twap_oracle(self, contract) -> bool:
        """Check if contract uses TWAP or oracle for price."""
        oracle_keywords = ["twap", "oracle", "update", "consult", "safePrice", "getPrice"]
        for function in contract.functions:
            name = function.name.lower()
            if any(kw in name for kw in oracle_keywords):
                return True
        return False

    def _detect(self):
        results = []
        for contract in self.compilation_unit.contracts_derived:
            for function in contract.functions:
                if not self._is_flashloan_function(function):
                    continue

                # Check for reentrancy guard
                if not self._has_reentrancy_guard(function):
                    results.append(self.generate_result([
                        f"Flashloan function {function.full_name} in {contract.name} ",
                        f"is missing a reentrancy guard. ",
                        f"Add `nonReentrant` modifier to prevent reentrant calls during flashloan execution.\n"
                    ]))

                # Check for callback lock
                if not self._has_callback_lock(contract):
                    results.append(self.generate_result([
                        f"Flashloan contract {contract.name} is missing a callback execution lock. ",
                        f"Add a boolean lock to prevent nested callback execution.\n"
                    ]))

                # Check for price oracle
                if not self._has_twap_oracle(contract):
                    results.append(self.generate_result([
                        f"Flashloan contract {contract.name} does not use TWAP/oracle for pricing. ",
                        f"Spot prices are vulnerable to flashloan manipulation. Use TWAP.\n"
                    ]))

        return results
