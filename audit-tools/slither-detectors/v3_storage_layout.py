"""
Slither Custom Detector: v3-storage-layout
SCSVS: V1.3 — 存储布局完整性
检测可升级合约中的存储槽冲突 — 新增状态变量插入在已有变量之前。
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.core.declarations import Contract


class StorageLayoutCollision(AbstractDetector):
    ARGUMENT = "v3-storage-layout"
    HELP = "Potential storage slot collision in upgradeable contracts"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.MEDIUM

    WIKI = "https://github.com/crytic/slither/wiki/Detector-Documentation#storage-layout-collision"
    WIKI_TITLE = "Storage Layout Collision"
    WIKI_DESCRIPTION = "Detects potential storage slot conflicts between implementation and proxy contracts."
    WIKI_EXPLOIT_SCENARIO = """
When an implementation contract inherits from multiple parents or inserts new state variables,
the storage layout may collide with the proxy's storage slots.
"""
    WIKI_RECOMMENDATION = (
        "Use StorageGap pattern. Never insert new variables before existing ones. "
        "Append new variables to the end. Use EIP-1967 for standard proxy slots."
    )

    GAP_KEYWORDS = ["__gap", "storage_gap", "_gap", "gap"]

    def _is_upgradeable(self, contract: Contract) -> bool:
        inherited_names = [c.name for c in contract.inheritance]
        keywords = ["Upgradeable", "UUPS", "Transparent", "Proxy"]
        return any(k in name for name in inherited_names for k in keywords)

    def _has_storage_gap(self, contract: Contract) -> bool:
        for var in contract.state_variables:
            if any(gap in var.name for gap in self.GAP_KEYWORDS):
                return True
        return False

    def _detect(self):
        results = []
        for contract in self.compilation_unit.contracts_derived:
            if not self._is_upgradeable(contract):
                continue

            # Check for storage gaps
            if not self._has_storage_gap(contract):
                results.append(self.generate_result([
                    f"Upgradeable contract {contract.name} has no storage gap pattern.\n",
                    "Without __gap, adding new state variables may corrupt storage layout.\n",
                    "Add: uint256[50] private __gap;\n"
                ]))

            # Check inheritance order for diamond-like patterns
            n_direct_parents = len(contract.inheritance)
            if n_direct_parents > 1:
                # Multiple inheritance — check for diamond
                parent_vars = {}
                for parent in contract.inheritance:
                    for var in parent.state_variables:
                        slot = var.slot if hasattr(var, 'slot') else None
                        parent_vars.setdefault(var.name, []).append(parent.name)

                for var_name, parents in parent_vars.items():
                    if len(parents) > 1:
                        results.append(self.generate_result([
                            f"State variable '{var_name}' declared in multiple parents ",
                            f"({', '.join(parents)}) of {contract.name}.\n",
                            "This may cause storage slot collision in upgradeable contracts.\n"
                        ]))

        return results
