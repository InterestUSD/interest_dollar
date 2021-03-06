pragma solidity 0.5.11;

interface IStakingRewards {
    // Views
    function balanceOf(address account) external view returns (uint256);

    // Mutative

    function stake(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function getReward() external;
}
