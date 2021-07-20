pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockUBE is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "UBE";
    string public constant name = "Ubeswap Governance Token";
}
