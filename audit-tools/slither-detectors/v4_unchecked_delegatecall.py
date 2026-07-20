"""
Slither Custom Detector: v4-unchecked-delegatecall
SCSVS: V2.10 — delegatecall 安全
检测无保护的 delegatecall — 代理合约的核心攻击面。
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.slithir.operations import LowLevelCall
from slither.core.cfg.node import NodeType


class UncheckedDelegatecall(AbstractDetector):
    ARGUMENT = "v4-unchecked-delegatecall"
    HELP = "delegatecall without access control or target validation"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.HIGH

    WIKI = "https://github.com/crytic/slither/wiki/Detector-Documentation#unchecked-delegatecall"
    WIKI_TITLE = "Unchecked Delegatecall"
    WIKI_DESCRIPTION = "Detects delegatecall operations that lack access control or target whitelisting."
    WIKI_EXPLOIT_SCENARIO = """
```solidity
function execute(address target, bytes calldata data) external returns (bytes memory) {
    (bool ok, bytes memory result) = target.delegatecall(data); // anyone can call
    require(ok);
    return result;
}
```
An attacker can delegatecall arbitrary contracts, potentially selfdestruct-ing the proxy.
"""
    WIKI_RECOMMENDATION = (
        "Add access control (onlyOwner/onlyRole) on delegatecall paths. "
        "Use a whitelist for allowed target addresses. "
        "Prefer `call` over `delegatecall` when storage modification is not needed."
    )

    ACCESS_MODIFIERS = ["onlyOwner", "onlyRole", "onlyGovernance", "onlyAdmin", "ownerOnly"]

    def _has_access_control(self, function) -> bool:
        for modifier in function.modifiers:
            if any(ac in modifier.name for ac in self.ACCESS_MODIFIERS):
                return True
        return False

    def _has_target_validation(self, function) -> bool:
        """Check if function validates the delegatecall target (e.g. whitelist, require)."""
        if function.is_constructor or function.is_fallback:
            return False
        for node in function.nodes:
            if node.type == NodeType.EXPRESSION:
                expr = str(node.expression).lower()
                if any(kw in expr for kw in ["allowedtarget", "whitelisted", "isvalidtarget",
                                              "require(", "target == ", "mapping"]):
                    return True
        return False

    def _detect(self):
        results = []
        for contract in self.compilation_unit.contracts_derived:
            for function in contract.functions:
                # Skip constructors
                if function.is_constructor:
                    continue

                for node in function.nodes:
                    for ir in node.irs:
                        if not isinstance(ir, LowLevelCall):
                            continue
                        if ir.call_type != "delegatecall":
                            continue

                        if self._has_access_control(function):
                            continue
                        if self._has_target_validation(function):
                            continue

                        results.append(self.generate_result([
                            f"delegatecall in function {function.full_name} of {contract.name} ",
                            f"has no access control or target validation.\n",
                            f"This allows arbitrary code execution in the {contract.name} context.\n",
                        ]))

        return results
