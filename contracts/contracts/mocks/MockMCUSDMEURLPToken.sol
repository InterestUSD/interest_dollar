pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockMCUSDMEURLPToken is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "UNI-MCUSD-MCEUR";
    string public constant name = "Uni LP Token mcUSD-mcEUR";
}
