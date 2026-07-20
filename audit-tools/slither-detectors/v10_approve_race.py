"""
Slither Custom Detector: v10-approve-race
SCSVS: V10.1 — ERC20 approve 竞态条件
检测 approve() 的经典竞争条件 — 先 reset 为 0 再 set 新额度之间的窗口。
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.slithir.operations import LowLevelCall, InternalCall
from slither.core.declarations import Function


class ApproveRace(AbstractDetector):
    ARGUMENT = "v10-approve-race"
    HELP = "ERC20 approve() race condition vulnerability"
    IMPACT = DetectorClassification.MEDIUM
    CONFIDENCE = DetectorClassification.MEDIUM

    WIKI = "https://github.com/crytic/slither/wiki/Detector-Documentation#approve-race-condition"
    WIKI_TITLE = "Approve Race Condition"
    WIKI_DESCRIPTION = "Detects patterns where approve() is called twice, creating a race condition."
    WIKI_EXPLOIT_SCENARIO = """
1. Alice approves Bob for 100 USDC
2. Alice wants to change to 200 USDC, calls approve(Bob, 0) then approve(Bob, 200)
3. Bob front-runs the second tx, uses the 100 allowance before it's set to 0
4. Bob now has 100 + 200 = 300 allowance

Fix: use increaseAllowance/decreaseAllowance or OpenZeppelin's safeApprove.
"""
    WIKI_RECOMMENDATION = "Use OpenZeppelin's `safeIncreaseAllowance` and `safeDecreaseAllowance`."

    def _calls_approve(self, function: Function) -> bool:
        """Check if function calls approve(address,uint256)."""
        for node in function.nodes:
            for ir in node.irs:
                if isinstance(ir, (LowLevelCall, InternalCall)):
                    called = ir.function_name if hasattr(ir, 'function_name') else ""
                    if "approve" in called.lower() and "increase" not in called.lower() and "decrease" not in called.lower():
                        return True
        return False

    def _calls_increase_decrease_allowance(self, function: Function) -> bool:
        for node in function.nodes:
            for ir in node.irs:
                if isinstance(ir, (LowLevelCall, InternalCall)):
                    called = ir.function_name if hasattr(ir, 'function_name') else ""
                    if "increaseallowance" in called.lower() or "decreaseallowance" in called.lower():
                        return True
        return False

    def _detect(self):
        results = []
        for contract in self.compilation_unit.contracts_derived:
            # Only check ERC20-like contracts
            if not contract.is_erc20:
                continue

            has_safe_approve = False

            for function in contract.functions:
                if "safeapprove" in function.name.lower():
                    has_safe_approve = True

            # Flag contracts that use raw approve without safe wrapper
            for function in contract.functions:
                if function.is_constructor:
                    continue
                if "safe" in function.name.lower():
                    continue

                if self._calls_approve(function) and not self._calls_increase_decrease_allowance(function):
                    if not has_safe_approve:
                        results.append(self.generate_result([
                            f"Function {function.full_name} in ERC20 {contract.name} ",
                            f"uses approve() which is vulnerable to race conditions.\n",
                            f"Use safeIncreaseAllowance/safeDecreaseAllowance instead of approve().\n"
                        ]))

        return results
