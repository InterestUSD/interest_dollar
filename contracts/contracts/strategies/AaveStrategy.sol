pragma solidity 0.5.11;

/**
 * @title OUSD Aave Strategy
 * @notice Investment strategy for investing stablecoins via Aave
 * @author Origin Protocol Inc
 */
import "./IAave.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import { IUniswapV2Factory } from "../interfaces/uniswap/IUniswapV2Factory.sol";
import { IUniswapV2ERC20 } from "../interfaces/uniswap/IUniswapV2ERC20.sol";
import { IStakingRewards } from "../interfaces/IStakingRewards.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IVault } from "../interfaces/IVault.sol";

contract AaveStrategy is InitializableAbstractStrategy {
    uint16 constant referralCode = 92;
    address uniswapAddr = IVault(vaultAddress).uniswapAddr();
    address ubeStakingAddress = address(0);
    address rewardPoolAddress;
    address secondaryRewardTokenAddress = address(0);
    // Note: this is a mapping of native asset to native asset (like cUSD-cEUR), not ATokens
    mapping(address => address) rewardLiquidityPair;

    /**
     * @dev Set UniswapV2 Router address.
     */
    function setUniswapAddress(address _uni) external onlyGovernor {
        uniswapRouterV2 = _uni;
    }

    /**
     * @dev Set the staking contract address.
     */
    function setStakingAddress(address _staking) external onlyGovernor {
        ubeStakingAddress = _staking;
    }

    /**
     * @dev Set the reward Uniswap Pool address
     * Stable tokens for which corresponding ATokens pair exists
     */
    function setRewardPoolAddress(address _token1, address _token2)
        external
        onlyGovernor
    {
        // Get the Pool address for pair
        address lpPair = IUniswapV2Router(uniswapAddr).pairFor(
            address(_getATokenFor(_token1)),
            address(_getATokenFor(_token2))
        );

        // safe approve LP Tokens for staking contract
        IUniswapV2ERC20(lpPair).approve(ubeStakingAddress, 0);
        IUniswapV2ERC20(lpPair).approve(ubeStakingAddress, uint256(-1));

        rewardsLpPair[_token1] = _token2;
        rewardsLpPair[_token2] = _token1;
        lpTokens[_token1] = lpToken;
        lpTokens[_token2] = lpToken;
    }

    function _provideLiquidity(address _asset) internal {
        address _assetPair = rewardsLpPair[_asset];
        IVault vault = IVault(vaultAddress);
        IOracle oracle = IOracle(vault.priceProvider());
        // calculate asset pair quote
        uint256 _price1 = oracle.price(_asset);
        uint256 _price2 = oracle.price(_assetPair);
        uint256 price = _price1.mul(1 ether).div(_price2);
        uint256 priceInv = _price2.mul(1 ether).div(_price1);

        IAaveAToken aToken1 = _getATokenFor(_asset);
        IAaveAToken aToken2 = _getATokenFor(_assetPair);

        uint256 aToken1Desired = aToken1.balanceOf(address(this));
        uint256 aToken2Desired = aToken1
        .balanceOf(address(this))
        .mul(price)
        .div(1 ether);
        if (aToken2.balanceOf(address(this)) < aToken2Desired) {
            aToken2Desired = aToken2.balanceOf(address(this));
            aToken1Desired = aToken2.balanceOf(address(this)).mul(priceInv).div(
                1 ether
            );
        }

        IUniswapV2Router router = IUniswapV2Router(uniswapAddr);
        // add liquidity to ATokens Pool
        router.addLiquidity(
            address(aToken1),
            address(aToken2),
            aToken1Desired,
            aToken2Desired,
            0,
            0,
            address(this),
            now.add(1800)
        );
    }

    function _removeLiquidity(address _asset) internal {
        address _assetPair = rewardLiquidityPair[_asset];
        IUniswapV2ERC20 lpToken = IUniswapV2ERC20(rewardPoolAddress);
        IAaveAToken aToken1 = _getATokenFor(_asset);
        IAaveAToken aToken2 = _getATokenFor(_assetPair);

        IUniswapV2Router router = IUniswapV2Router(uniswapAddr);
        router.removeLiquidity(
            address(aToken1),
            address(aToken2),
            lpToken.balanceOf(address(this)),
            0,
            0,
            address(this),
            now.add(1800)
        );
    }

    function _stakeLPTokens(address _asset) internal {
        IStakingRewards(ubeStakingAddress).stake(
            IUniswapV2ERC20(rewardPoolAddress).balanceOf(address(this))
        );
    }

    function _unstakeLPTokens(address _asset) internal {
        IStakingRewards staking = IStakingRewards(ubeStakingAddress);
        uint256 balance = staking.balanceOf(address(this));
        staking.withdraw(balance);
    }

    /**
     * @dev Collect accumulated COMP and send to Vault.
     */
    function collectRewardToken() external onlyVault nonReentrant {
        // Claim MOO from Staking contract
        IStakingRewards staking = IStakingRewards(stakingAddress);
        staking.getReward();
        // Transfer MOO to Vault
        IERC20 rewardToken = IERC20(rewardTokenAddress);
        uint256 balance = rewardToken.balanceOf(address(this));
        emit RewardTokenCollected(vaultAddress, balance);
        rewardToken.safeTransfer(vaultAddress, balance);
    }

    /**
     * @dev Deposit asset into Aave
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     * @return amountDeposited Amount of asset that was deposited
     */
    function deposit(address _asset, uint256 _amount)
        external
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /**
     * @dev Deposit asset into Aave
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     * @return amountDeposited Amount of asset that was deposited
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");
        IAaveAToken aToken = _getATokenFor(_asset);
        emit Deposit(_asset, address(aToken), _amount);
        _getLendingPool().deposit(_asset, _amount, referralCode);

        if (ubeStakingAddress != address(0)) {
            _provideLiquidity(_asset);
            _stakeLPTokens(_asset);
        }
    }

    /**
     * @dev Deposit the entire balance of any supported asset into Aave
     */
    function depositAll() external onlyVault nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            uint256 balance = IERC20(assetsMapped[i]).balanceOf(address(this));
            if (balance > 0) {
                _deposit(assetsMapped[i], balance);
            }
        }
    }

    /**
     * @dev Withdraw asset from Aave
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     * @return amountWithdrawn Amount of asset that was withdrawn
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        IAaveAToken aToken = _getATokenFor(_asset);

        if (
            ubeStakingAddress != address(0) &&
            aToken.balanceOf(address(this)) <= _amount
        ) {
            _unstakeLPTokens(_asset);
            _removeLiquidity(_asset);
        }

        emit Withdrawal(_asset, address(aToken), _amount);
        aToken.redeem(_amount);
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external onlyVaultOrGovernor nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            if (ubeStakingAddress != address(0)) {
                _unstakeLPTokens(assetsMapped[i]);
                _removeLiquidity(assetsMapped[i]);
            }
            // Redeem entire balance of aToken
            IAaveAToken aToken = _getATokenFor(assetsMapped[i]);
            uint256 balance = aToken.balanceOf(address(this));
            if (balance > 0) {
                aToken.redeem(balance);
                // Transfer entire balance to Vault
                IERC20 asset = IERC20(assetsMapped[i]);
                asset.safeTransfer(
                    vaultAddress,
                    asset.balanceOf(address(this))
                );
            }
        }
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance)
    {
        // Balance is always with token aToken decimals
        IAaveAToken aToken = _getATokenFor(_asset);
        balance = aToken.balanceOf(address(this));
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) external view returns (bool) {
        return assetToPToken[_asset] != address(0);
    }

    /**
     * @dev Approve the spending of all assets by their corresponding aToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external onlyGovernor nonReentrant {
        uint256 assetCount = assetsMapped.length;
        address lendingPoolVault = _getLendingPoolCore();
        // approve the pool to spend the bAsset
        for (uint256 i = 0; i < assetCount; i++) {
            address asset = assetsMapped[i];
            // Safe approval
            IERC20(asset).safeApprove(lendingPoolVault, 0);
            IERC20(asset).safeApprove(lendingPoolVault, uint256(-1));
        }
    }

    /**
     * @dev Internal method to respond to the addition of new asset / aTokens
     *      We need to approve the aToken and give it permission to spend the asset
     * @param _asset Address of the asset to approve
     * @param _aToken This aToken has the approval approval
     */
    function _abstractSetPToken(address _asset, address _aToken) internal {
        address lendingPoolVault = _getLendingPoolCore();
        IERC20(_asset).safeApprove(lendingPoolVault, 0);
        IERC20(_asset).safeApprove(lendingPoolVault, uint256(-1));
    }

    /**
     * @dev Get the aToken wrapped in the ICERC20 interface for this asset.
     *      Fails if the pToken doesn't exist in our mappings.
     * @param _asset Address of the asset
     * @return Corresponding aToken to this asset
     */
    function _getATokenFor(address _asset) internal view returns (IAaveAToken) {
        address aToken = assetToPToken[_asset];
        require(aToken != address(0), "aToken does not exist");
        return IAaveAToken(aToken);
    }

    /**
     * @dev Get the current address of the Aave lending pool, which is the gateway to
     *      depositing.
     * @return Current lending pool implementation
     */
    function _getLendingPool() internal view returns (IAaveLendingPool) {
        address lendingPool = ILendingPoolAddressesProvider(platformAddress)
        .getLendingPool();
        require(lendingPool != address(0), "Lending pool does not exist");
        return IAaveLendingPool(lendingPool);
    }

    /**
     * @dev Get the current address of the Aave lending pool core, which stores all the
     *      reserve tokens in its vault.
     * @return Current lending pool core address
     */
    function _getLendingPoolCore() internal view returns (address payable) {
        address payable lendingPoolCore = ILendingPoolAddressesProvider(
            platformAddress
        ).getLendingPoolCore();
        require(
            lendingPoolCore != address(uint160(address(0))),
            "Lending pool core does not exist"
        );
        return lendingPoolCore;
    }
}
