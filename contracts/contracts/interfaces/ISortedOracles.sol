pragma solidity 0.5.11;

interface ISortedOracles {
    function medianRate(address) external view returns (uint256, uint256);

    function medianTimestamp(address) external view returns (uint256);
}
