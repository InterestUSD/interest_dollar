pragma solidity 0.5.11;

interface IOracle {
    /**
     * @dev returns the asset price in cUSD, 8 decimal digits.
     */
    function price(address asset) external view returns (uint256);
}
