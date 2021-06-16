pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockMOO is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "MOO";
    string public constant name = "Moola Governance Token";
}
