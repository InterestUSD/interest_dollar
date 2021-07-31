pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockCELO is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "CELO";
    string public constant name = "Celo Gold";
}
