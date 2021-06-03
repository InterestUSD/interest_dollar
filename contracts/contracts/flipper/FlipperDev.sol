pragma solidity 0.5.11;

import "../governance/Governable.sol";
import "../token/OUSD.sol";
import "../interfaces/Tether.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

// Contract to exchange ceur, cusd from and to ousd.
//   - 1 to 1. No slippage
//   - Optimized for low gas usage
//   - No guarantee of availability

contract FlipperDev is Governable {
    using SafeERC20 for IERC20;

    uint256 constant MAXIMUM_PER_TRADE = (25000 * 1e18);

    // Settable coin addresses allow easy testing and use of mock currencies.
    IERC20 cusd = IERC20(0);
    IERC20 ceur = IERC20(0);
    OUSD ousd = OUSD(0);

    // ---------------------
    // Dev constructor
    // ---------------------
    constructor(
        address cusd_,
        address ceur_,
        address ousd_
    ) public {
        cusd = IERC20(cusd_);
        ceur = IERC20(ceur_);
        ousd = OUSD(ousd_);
        require(address(ousd) != address(0));
        require(address(ceur) != address(0));
        require(address(cusd) != address(0));
    }

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

    /// @notice Purchase OUSD with cEUR
    /// @param amount Amount of OUSD to purchase, in 18 fixed decimals.
    function buyOusdWithCeur(uint256 amount) external {
        require(amount <= MAXIMUM_PER_TRADE, "Amount too large");
        // Potential rounding error is an intentional tradeoff
        require(ceur.transferFrom(msg.sender, address(this), amount / 1e12));
        require(ousd.transfer(msg.sender, amount));
    }

    /// @notice Sell OUSD for cEUR
    /// @param amount Amount of OUSD to sell, in 18 fixed decimals.
    function sellOusdForCeur(uint256 amount) external {
        require(amount <= MAXIMUM_PER_TRADE, "Amount too large");
        require(ceur.transfer(msg.sender, amount / 1e12));
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
        IERC20(ceur).safeTransfer(_governor(), ceur.balanceOf(address(this)));
    }
}
