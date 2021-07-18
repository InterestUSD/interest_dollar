pragma solidity 0.5.11;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import { IUniswapV2Pair } from "../interfaces/uniswap/IUniswapV2Pair.sol";
import { Helpers } from "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IMintableERC20 } from "./MintableERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

contract MockUniswapRouter is IUniswapV2Router {
    using StableMath for uint256;
    using SafeMath for uint256;

    address public pairToken;
    address public tok0;
    address public tok1;

    function sortTokens(address tokenA, address tokenB)
        internal
        pure
        returns (address token0, address token1)
    {
        require(tokenA != tokenB, "UniswapV2Library: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        require(token0 != address(0), "UniswapV2Library: ZERO_ADDRESS");
    }

    function initialize(
        address _tok0,
        address _tok1,
        address _pairToken
    ) public {
        (tok0, tok1) = sortTokens(_tok0, _tok1);
        pairToken = _pairToken;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        address _tok0 = path[0];
        address _tok1 = path[path.length - 1];
        uint256 amount = amountIn.scaleBy(
            int8(Helpers.getDecimals(_tok1) - Helpers.getDecimals(_tok0))
        );

        IERC20(_tok0).transferFrom(msg.sender, address(this), amountIn);
        IMintableERC20(_tok1).mint(amount);
        IERC20(_tok1).transfer(to, amount);

        amounts[0] = amount;
        amounts[1] = amount;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        (address _tok0, address _tok1) = sortTokens(tokenA, tokenB);
        require(_tok0 != tok0, "MockUniswapV2Router: Different tokens");
        require(_tok1 != tok1, "MockUniswapV2Router: Different tokens");

        (amountA, amountB) = tokenA == tok0
            ? (amountADesired, amountBDesired)
            : (amountBDesired, amountADesired);

        IERC20(tok0).transferFrom(msg.sender, address(this), amountA);
        IERC20(tok1).transferFrom(msg.sender, address(this), amountB);

        liquidity = amountA.add(amountB);
        IMintableERC20(pairToken).mint(liquidity);
        IERC20(pairToken).transfer(to, liquidity);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB) {
        (address _tok0, address _tok1) = sortTokens(tokenA, tokenB);
        require(_tok0 != tok0, "MockUniswapV2Router: Different tokens");
        require(_tok1 != tok1, "MockUniswapV2Router: Different tokens");

        uint256 _totalSupply = IERC20(pairToken).totalSupply();
        uint256 balance0 = IERC20(tok0).balanceOf(address(this));
        uint256 balance1 = IERC20(tok1).balanceOf(address(this));

        IERC20(pairToken).transferFrom(msg.sender, address(this), liquidity);
        ERC20Burnable(pairToken).burn(liquidity);

        amountA = liquidity.mul(balance0) / _totalSupply;
        amountB = liquidity.mul(balance1) / _totalSupply;

        IERC20(tok0).transfer(to, amountA);
        IERC20(tok1).transfer(to, amountB);
    }

    function factory() external pure returns (address) {
        return address(0);
    }

    function pairFor(address tokenA, address tokenB)
        external
        view
        returns (address)
    {
        return pairToken;
    }
}
