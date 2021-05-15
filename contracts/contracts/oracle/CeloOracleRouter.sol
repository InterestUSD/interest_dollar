pragma solidity ^0.5.11;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v2.5.0/contracts/math/SafeMath.sol";

interface ISortedOracles {
    function medianRate(address) external view returns (uint256, uint256);

    function medianTimestamp(address) external view returns (uint256);
}

interface IRegistry {
    function getAddressForOrDie(bytes32) external view returns (address);
}

contract UsingRegistry {
    bytes32 constant GOLD_TOKEN_REGISTRY_ID =
        keccak256(abi.encodePacked("GoldToken"));
    bytes32 constant STABLE_TOKEN_REGISTRY_ID =
        keccak256(abi.encodePacked("StableToken"));
    bytes32 constant STABLE_EUR_TOKEN_REGISTRY_ID =
        keccak256(abi.encodePacked("StableTokenEUR"));
    bytes32 constant SORTED_ORACLES_REGISTRY_ID =
        keccak256(abi.encodePacked("SortedOracles"));

    IRegistry public constant registry =
        IRegistry(0x000000000000000000000000000000000000ce10);

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

contract OracleRouterBase is UsingRegistry {
    using SafeMath for uint256;
    uint256 constant MIN_DRIFT = uint256(70000000);
    uint256 constant MAX_DRIFT = uint256(130000000);

    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal view returns (address);

    /**
     * @notice Returns the total price in 18 digit cUSD for a given asset.
     * @param asset address of the asset
     * @return uint256 cUSD price of 1 of the asset, in 18 decimal fixed
     */
    function price(address asset) external view returns (uint256) {
        // if cUSD
        address cUSD_addr = getStableToken();
        if (asset == cUSD_addr) {
            return 1 ether;
        } else if (asset == getStableTokenEUR()) {
            return
                _asset_price(asset).mul(1 ether).div(_asset_price(cUSD_addr));
        } else {
            require(false, "Asset not available");
        }
    }

    function _asset_price(address asset) internal view returns (uint256) {
        uint256 _price;
        uint256 _divisor;
        ISortedOracles _oracles = getSortedOracles();
        (_price, _divisor) = _oracles.medianRate(asset);
        require(_price > 0, "Reported price is 0");
        uint256 _reportTime = _oracles.medianTimestamp(asset);
        require(
            block.timestamp.sub(_reportTime) < 10 minutes,
            "Reported price is older than 10 minutes"
        );
        return _divisor.mul(1 ether).div(_price);
    }
}

contract OracleRouter is OracleRouterBase {
    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal view returns (address) {
        return address(0x000000000000000000000000000000000000ce10);
    }
}

contract OracleRouterDev is OracleRouterBase {
    mapping(address => address) public assetToFeed;

    function setFeed(address _asset, address _feed) external {
        assetToFeed[_asset] = _feed;
    }

    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal view returns (address) {
        return assetToFeed[asset];
    }
}
