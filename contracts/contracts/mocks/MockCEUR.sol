pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockCEUR is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "cEUR";
    string public constant name = "Celo Euro";
}
