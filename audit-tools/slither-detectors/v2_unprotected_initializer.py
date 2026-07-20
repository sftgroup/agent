"""
Slither Custom Detector: v2-unprotected-initializer
SCSVS: V1.13 — 初始化安全
检测未受保护的 initialize() 函数，可能导致代理合约的存储槽被覆盖。
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.core.declarations import Function


class UnprotectedInitializer(AbstractDetector):
    ARGUMENT = "v2-unprotected-initializer"
    HELP = "initialize() function missing initializer modifier protection"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.HIGH

    WIKI = "https://github.com/crytic/slither/wiki/Detector-Documentation#unprotected-initializer"
    WIKI_TITLE = "Unprotected Initializer"
    WIKI_DESCRIPTION = "Detects initialize() functions without initializer modifier on upgradeable contracts."
    WIKI_EXPLOIT_SCENARIO = """
```solidity
contract UpgradeableToken is Initializable {
    function initialize(address owner) public {  // <-- no initializer modifier
        __Ownable_init(owner);
    }
}
```
An attacker can call initialize() after deployment to reset ownership.
"""
    WIKI_RECOMMENDATION = "Add the `initializer` modifier to initialize() or use a boolean lock."

    def _is_initializable(self, contract) -> bool:
        """Check if contract inherits from Initializable or OpenZeppelin upgradeable."""
        inherited = [c.name for c in contract.inheritance]
        keywords = ["Initializable", "Upgradeable", "UUPSUpgradeable", "TransparentUpgradeableProxy"]
        for keyword in keywords:
            if any(keyword in name for name in inherited):
                return True
        return False

    def _detect(self):
        results = []
        for contract in self.compilation_unit.contracts_derived:
            if not self._is_initializable(contract):
                continue

            for function in contract.functions:
                # Target: functions named initialize or __X_init
                if not (function.name == "initialize" or
                        (function.name.startswith("__") and function.name.endswith("_init"))):
                    continue

                # Check for initializer modifier
                has_initializer = any(
                    "initializer" in m.name.lower() or "reinitializer" in m.name.lower()
                    for m in function.modifiers
                )
                if not has_initializer:
                    # Also check for manual boolean lock
                    has_bool_lock = any(
                        v.name == "initialized" or v.name == "_initialized"
                        for v in contract.state_variables
                    )
                    if not has_bool_lock:
                        results.append(self.generate_result([
                            f"Function {function.name}() in upgradeable contract ",
                            contract.name,
                            " is missing the 'initializer' modifier.\n",
                            "This may allow re-initialization and storage slot corruption.\n",
                        ]))

        return results
