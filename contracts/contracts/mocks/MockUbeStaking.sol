pragma solidity 0.5.11;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import { IStakingRewards } from "../interfaces/IStakingRewards.sol";
import { Helpers } from "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";

contract MockUbeStaking is IStakingRewards {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardsToken0;
    IERC20 public rewardsToken1;
    IERC20 public stakingToken;
    uint256 public rewardPerToken = 1;

    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _rewardsToken0,
        address _rewardsToken1,
        address _stakingToken
    ) public {
        rewardsToken0 = IERC20(_rewardsToken0);
        rewardsToken1 = IERC20(_rewardsToken1);
        stakingToken = IERC20(_stakingToken);
    }

    /* ========== VIEWS ========== */

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    // XXX: removed notPaused
    function stake(uint256 amount) external {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        rewards[msg.sender] = rewards[msg.sender] + amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public {
        require(amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        stakingToken.safeTransfer(msg.sender, amount);
    }

    function getReward() public {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken0.safeTransfer(msg.sender, reward);
            rewardsToken1.safeTransfer(msg.sender, reward);
        }
    }
}
