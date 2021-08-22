pragma solidity 0.5.11;

/**
 * @title OUSD Aave Strategy
 * @notice Investment strategy for investing stablecoins via Aave
 * @author Origin Protocol Inc
 */
import "./IAave.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import { IUniswapV2ERC20 } from "../interfaces/uniswap/IUniswapV2ERC20.sol";
import { IStakingRewards } from "../interfaces/IStakingRewards.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IVault } from "../interfaces/IVault.sol";
import { UsingRegistry } from "../utils/UsingRegistry.sol";

contract AaveStrategy is InitializableAbstractStrategy, UsingRegistry {
    uint16 public referralCode;
    address public uniswapAddr;
    address public ubeStakingAddress;
    address public rewardPoolAddress;
    address public secondaryRewardTokenAddress;
    // Note: this is a mapping of native asset to native asset (like cUSD-cEUR), not ATokens
    mapping(address => address) private rewardLiquidityPair;

    /**
     * @dev Set the UniswapV2 Router Address.
     */
    function setUniswapAddress(address _router) external onlyGovernor {
        uniswapAddr = _router;
    }

    /**
     * @dev Set the secondary reward token address in case staking contract
     * reward dual reward token
     */
    function setSecondaryRewardTokenAddress(address _token)
        external
        onlyGovernor
    {
        secondaryRewardTokenAddress = _token;
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

        rewardLiquidityPair[_token1] = _token2;
        rewardLiquidityPair[_token2] = _token1;

        rewardPoolAddress = lpPair;
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Aave/Moola strategies don't fit
     * well within that abstraction.
     * @param _platformAddress Address of the Aave/Moola lending pool
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddress Address of MOO
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                cUSD, cEUR.
     * @param _pTokens Platform Token corresponding addresses
     * @param _ubeStakingAddress Address of Ubeswap LP Tokens Staking contract
     * @param _liquidityToken1Address Address of native asset for first AToken for reward LP Pool, i.e cUSD
     * @param _liquidityToken2Address Address of native asset for second AToken for reward LP Pool, i.e cEUR
     * @param _secondaryRewardTokenAddress Address of secondary reward token if any, else set this to 0x0
     */
    function initialize(
        address _platformAddress, // Aave/Moola address
        address _vaultAddress,
        address _rewardTokenAddress, // MOO
        address[] calldata _assets,
        address[] calldata _pTokens,
        address _ubeStakingAddress,
        address _liquidityToken1Address, // cUSD
        address _liquidityToken2Address, // cEUR
        address _secondaryRewardTokenAddress // UBE
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddress,
            _assets,
            _pTokens
        );

        // set uniswap addr
        uniswapAddr = IVault(vaultAddress).uniswapAddr();

        // set referal code
        referralCode = 0;

        ubeStakingAddress = _ubeStakingAddress;
        secondaryRewardTokenAddress = _secondaryRewardTokenAddress;

        // Set the Pool address for AToken pair
        rewardPoolAddress = IUniswapV2Router(uniswapAddr).pairFor(
            address(_getATokenFor(_liquidityToken1Address)),
            address(_getATokenFor(_liquidityToken2Address))
        );

        // safe approve LP Tokens for staking contract
        IUniswapV2ERC20(rewardPoolAddress).approve(ubeStakingAddress, 0);
        IUniswapV2ERC20(rewardPoolAddress).approve(
            ubeStakingAddress,
            uint256(-1)
        );

        // safe approve LP Tokens for ubeswap router
        IUniswapV2ERC20(rewardPoolAddress).approve(uniswapAddr, 0);
        IUniswapV2ERC20(rewardPoolAddress).approve(uniswapAddr, uint256(-1));

        // safe approve ATokens for providing uniswap liquidity
        for (uint256 i = 0; i < _pTokens.length; i++) {
            IERC20(_pTokens[i]).approve(uniswapAddr, uint256(-1));
        }

        rewardLiquidityPair[_liquidityToken1Address] = _liquidityToken2Address;
        rewardLiquidityPair[_liquidityToken2Address] = _liquidityToken1Address;
    }

    function _provideLiquidity(address _asset) internal {
        address _assetPair = rewardLiquidityPair[_asset];
        IVault vault = IVault(vaultAddress);
        IOracle oracle = IOracle(vault.priceProvider());
        // calculate asset pair quote
        uint256 _price1 = oracle.price(_asset);
        uint256 _price2 = oracle.price(_assetPair);
        uint256 price = _price1.mul(1 ether).div(_price2);
        uint256 priceInv = _price2.mul(1 ether).div(_price1);

        IAaveAToken aToken1 = _getATokenFor(_asset);
        IAaveAToken aToken2 = _getATokenFor(_assetPair);

        // if no tokens to provide liquidity, simply return
        if (
            aToken1.balanceOf(address(this)) == uint256(0) ||
            aToken2.balanceOf(address(this)) == uint256(0)
        ) return;

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
            uint256(0),
            uint256(0),
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
        uint256 liquidity = lpToken.balanceOf(address(this));

        if (liquidity != uint256(0)) {
            router.removeLiquidity(
                address(aToken1),
                address(aToken2),
                liquidity,
                uint256(0),
                uint256(0),
                address(this),
                now.add(1800)
            );
        }
    }

    /**
     * Calculate the amount of token pair for given amount of LP Tokens
     * @param _asset Address of Pair Token0
     * @param liquidity Amount of LP Tokens
     */
    function _checkLPBalance(address _asset, uint256 liquidity)
        internal
        view
        returns (uint256 amount)
    {
        require(
            rewardLiquidityPair[_asset] != address(0),
            "AaveStrategy: Assets not part of LP Pair"
        );

        require(
            liquidity != uint256(0),
            "AaveStrategy::_checkLPBalance: liquidity should be greater than 0"
        );

        address aTokenAddr = assetToPToken[_asset];
        uint256 balance = IERC20(aTokenAddr).balanceOf(rewardPoolAddress);
        uint256 _totalSupply = IUniswapV2ERC20(rewardPoolAddress).totalSupply();

        // Just to be sure, incase totalSupply is zero
        if (_totalSupply != uint256(0)) {
            amount = liquidity.mul(balance) / _totalSupply;
        }
    }

    function _stakeLPTokens() internal {
        uint256 lpAmount = IUniswapV2ERC20(rewardPoolAddress).balanceOf(
            address(this)
        );
        if (lpAmount != uint256(0)) {
            IStakingRewards(ubeStakingAddress).stake(lpAmount);
        }
    }

    function _unstakeLPTokens() internal {
        IStakingRewards staking = IStakingRewards(ubeStakingAddress);
        uint256 balance = staking.balanceOf(address(this));
        if (balance != uint256(0)) {
            staking.withdraw(balance);
        }
    }

    /**
     * @dev Collect accumulated reward token and send to Vault.
     * If there is a secondary reward token, swap it for primary reward token also
     */
    function collectRewardToken() external onlyVault nonReentrant {
        // Claim rewards from staking contract
        IStakingRewards staking = IStakingRewards(ubeStakingAddress);
        staking.getReward();

        if (
            secondaryRewardTokenAddress != address(0) &&
            IERC20(secondaryRewardTokenAddress).balanceOf(address(this)) !=
            uint256(0)
        ) {
            IERC20 secondaryToken = IERC20(secondaryRewardTokenAddress);
            // Give Uniswap full amount allowance
            secondaryToken.safeApprove(uniswapAddr, 0);
            secondaryToken.safeApprove(uniswapAddr, uint256(-1));

            // Uniswap redemption path
            address[] memory path = new address[](3);
            path[0] = secondaryRewardTokenAddress;
            path[1] = IVault(vaultAddress).celoGoldAddr(); // CELO
            path[2] = rewardTokenAddress;

            IUniswapV2Router(uniswapAddr).swapExactTokensForTokens(
                secondaryToken.balanceOf(address(this)),
                uint256(0),
                path,
                address(this),
                now.add(1800)
            );
        }

        // Transfer primary rewardToken to Vault
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
            _stakeLPTokens();
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
            _unstakeLPTokens();
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
                _unstakeLPTokens();
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

        if (ubeStakingAddress != address(0)) {
            // If some LP Tokens are left, not staked
            uint256 lpBalance = IStakingRewards(ubeStakingAddress).balanceOf(
                address(this)
            );
            // LP Tokens staked in staking contract
            lpBalance.add(
                IUniswapV2ERC20(rewardPoolAddress).balanceOf(address(this))
            );

            if (lpBalance != uint256(0)) {
                uint256 amountLP = _checkLPBalance(_asset, lpBalance);
                // NOTE: for some unkonwn reasons, add() is not working here
                // balance.add(amountLP);
                balance += amountLP;
            }
        }
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
