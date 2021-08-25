pragma solidity 0.5.11;

import "../governance/Governable.sol";
import "../token/OUSD.sol";
import "../interfaces/Tether.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

// Contract to exchange cusd from and to ousd.
//   - 1 to 1. No slippage
//   - Optimized for low gas usage
//   - No guarantee of availability

contract Flipper is Governable {
    using SafeERC20 for IERC20;

    uint256 constant MAXIMUM_PER_TRADE = (25000 * 1e18);

    // Saves approx 4K gas per swap by using hardcoded addresses.
    IERC20 cusd = IERC20(0x765DE816845861e75A25fCA122bb6898B8B1282a);
    OUSD constant ousd = OUSD(0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86);

    // -----------
    // Constructor
    // -----------
    constructor() public {}

    // -----------------
    // Trading functions
    // -----------------

    /// @notice Purchase OUSD with cUSD
    /// @param amount Amount of OUSD to purchase, in 18 fixed decimals.
    function buyOusdWithCusd(uint256 amount) external {
        require(amount <= MAXIMUM_PER_TRADE, "Amount too large");
        require(cusd.transferFrom(msg.sender, address(this), amount));
        require(ousd.transfer(msg.sender, amount));
    }

    /// @notice Sell OUSD for cUSD
    /// @param amount Amount of OUSD to sell, in 18 fixed decimals.
    function sellOusdForCusd(uint256 amount) external {
        require(amount <= MAXIMUM_PER_TRADE, "Amount too large");
        require(cusd.transfer(msg.sender, amount));
        require(ousd.transferFrom(msg.sender, address(this), amount));
    }

    // --------------------
    // Governance functions
    // --------------------

    /// @dev Opting into yield reduces the gas cost per transfer by about 4K, since
    /// ousd needs to do less accounting and one less storage write.
    function rebaseOptIn() external onlyGovernor nonReentrant {
        ousd.rebaseOptIn();
    }

    /// @notice Owner function to withdraw a specific amount of a token
    function withdraw(address token, uint256 amount)
        external
        onlyGovernor
        nonReentrant
    {
        IERC20(token).safeTransfer(_governor(), amount);
    }

    /// @notice Owner function to withdraw all tradable tokens
    /// @dev Equivalent to "pausing" the contract.
    function withdrawAll() external onlyGovernor nonReentrant {
        IERC20(cusd).safeTransfer(_governor(), cusd.balanceOf(address(this)));
        IERC20(ousd).safeTransfer(_governor(), ousd.balanceOf(address(this)));
    }
}
