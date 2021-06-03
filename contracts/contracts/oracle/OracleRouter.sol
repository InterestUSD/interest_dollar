pragma solidity ^0.5.11;

import "@openzeppelin/contracts/math/SafeMath.sol";
import { UsingRegistry } from "../utils/UsingRegistry.sol";
import { ISortedOracles } from "../interfaces/ISortedOracles.sol";

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

    function _asset_price(address asset) internal view returns (uint256);
}

contract OracleRouter is OracleRouterBase {
    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal view returns (address) {
        return address(0x000000000000000000000000000000000000ce10);
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

contract OracleRouterDev {
    mapping(address => address) public assetToFeed;

    mapping(address => uint256) public assetToPrice;

    function setFeed(address _asset, address _feed) external {
        assetToFeed[_asset] = _feed;
    }

    function setPrice(address _asset, uint256 _price) external {
        assetToPrice[_asset] = _price;
    }

    /**
     * @dev The price feed contract to use for a particular asset.
     * @param asset address of the asset
     */
    function feed(address asset) internal view returns (address) {
        return assetToFeed[asset];
    }

    function price(address asset) internal view returns (uint256) {
        return assetToPrice[asset];
    }
}
