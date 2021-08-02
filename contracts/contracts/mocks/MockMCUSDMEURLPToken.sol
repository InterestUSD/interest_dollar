pragma solidity 0.5.11;

import "./MockMintableUniswapPair.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockMCUSDMEURLPToken is MockMintableUniswapPair {
    uint256 public constant decimals = 18;
    string public constant symbol = "UNI-MCUSD-MCEUR";
    string public constant name = "Uni LP Token mcUSD-mcEUR";

    constructor(
        address _token0,
        address _token1,
        address _router
    ) public MockMintableUniswapPair(_token0, _token1, 0, 0) {
        IERC20(_token0).approve(_router, uint256(-1));
        IERC20(_token1).approve(_router, uint256(-1));
    }
}
