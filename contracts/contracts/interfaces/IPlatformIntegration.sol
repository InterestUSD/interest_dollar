pragma solidity 0.5.17;

/**
 * @title Platform interface to integrate with lending platform like Compound, AAVE etc.
 */
interface IPlatformIntegration {
    /**
     * @dev Deposit the given asset to Lending platform
     * @param _asset asset address
     * @param _amount Amount to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        returns (uint256 amountDeposited);

    /**
     * @dev Withdraw given asset from Lending platform
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external returns (uint256 amountWithdrawn);

    /**
     * @dev Returns the current balance of the given asset
     */
    function checkBalance(address _asset) external returns (uint256 balance);
}
