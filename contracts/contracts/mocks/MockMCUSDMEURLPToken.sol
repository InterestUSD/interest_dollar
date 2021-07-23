pragma solidity 0.5.11;

import "./MockMintableUniswapPair.sol";

contract MockMCUSDMEURLPToken is MockMintableUniswapPair {
    uint256 public constant decimals = 18;
    string public constant symbol = "UNI-MCUSD-MCEUR";
    string public constant name = "Uni LP Token mcUSD-mcEUR";

    constructor(
        address _token0,
        address _token1,
        uint112 _reserve0,
        uint112 _reserve1
    ) public MockMintableUniswapPair(_token0, _token1, _reserve0, _reserve1) {}
}
