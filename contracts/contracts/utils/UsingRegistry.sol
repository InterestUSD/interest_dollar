pragma solidity ^0.5.11;

/**
 * @title Celo Registry Helper
 * @notice The VaultAdmin contract makes configuration and admin calls on the vault.
 * @author Ashutosh Varma (@ashutoshvarma)
 */

import { IRegistry } from "../interfaces/IRegistry.sol";
import { ISortedOracles } from "../interfaces/ISortedOracles.sol";

contract UsingRegistry {
    bytes32 constant GOLD_TOKEN_REGISTRY_ID = keccak256(
        abi.encodePacked("GoldToken")
    );
    bytes32 constant STABLE_TOKEN_REGISTRY_ID = keccak256(
        abi.encodePacked("StableToken")
    );
    bytes32 constant STABLE_EUR_TOKEN_REGISTRY_ID = keccak256(
        abi.encodePacked("StableTokenEUR")
    );
    bytes32 constant SORTED_ORACLES_REGISTRY_ID = keccak256(
        abi.encodePacked("SortedOracles")
    );

    IRegistry public constant registry = IRegistry(
        0x000000000000000000000000000000000000ce10
    );

    function getGoldToken() internal view returns (address) {
        return registry.getAddressForOrDie(GOLD_TOKEN_REGISTRY_ID);
    }

    function getStableToken() internal view returns (address) {
        return registry.getAddressForOrDie(STABLE_TOKEN_REGISTRY_ID);
    }

    function getStableTokenEUR() internal view returns (address) {
        return registry.getAddressForOrDie(STABLE_EUR_TOKEN_REGISTRY_ID);
    }

    function getSortedOracles() internal view returns (ISortedOracles) {
        return
            ISortedOracles(
                registry.getAddressForOrDie(SORTED_ORACLES_REGISTRY_ID)
            );
    }
}
