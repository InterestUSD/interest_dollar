const hre = require("hardhat");
const { utils } = require("ethers");

const {
  getAssetAddresses,
  isMainnetOrAlfajoresOrFork,
  isMainnetOrFork,
  isAlfajores,
  cusdUnits,
} = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");

/**
 * Deploy AAVE Strategy which only supports cUSD.
 * Deploys a proxy, the actual strategy, initializes the proxy and initializes
 * the strategy.
 */
const deployAaveStrategy = async () => {
  const assetAddresses = await getAssetAddresses(hre.deployments);
  const { deployerAddr, governorAddr } = await getNamedAccounts();
  // Signers
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cVaultProxy = await ethers.getContract("VaultProxy");

  const dAaveStrategyProxy = await deployWithConfirmation(
    "AaveStrategyProxy",
    [],
    "InitializeGovernedUpgradeabilityProxy"
  );
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const dAaveStrategy = await deployWithConfirmation("AaveStrategy");
  const cAaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    dAaveStrategyProxy.address
  );
  await withConfirmation(
    cAaveStrategyProxy["initialize(address,address,bytes)"](
      dAaveStrategy.address,
      deployerAddr,
      []
    )
  );
  log("Initialized AaveStrategyProxy");

  await withConfirmation(
    cAaveStrategy
      .connect(sDeployer)
      [
        "initialize(address,address,address,address[],address[],address,address,address,address)"
      ](
        assetAddresses.AAVE_ADDRESS_PROVIDER,
        cVaultProxy.address,
        assetAddresses.MOO, // Setting MOO as primary reward token
        [assetAddresses.CUSD, assetAddresses.CEUR],
        [assetAddresses.mCUSD, assetAddresses.mCEUR],
        assetAddresses.UBEStaking, // Staking contract address
        assetAddresses.CUSD, // LP Reward Pair Token 1
        assetAddresses.CEUR, // LP Reward Pair Token 2
        assetAddresses.UBE // Setting UBE as secondary reward
      )
  );
  log("Initialized AaveStrategy");
  await withConfirmation(
    cAaveStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`AaveStrategy transferGovernance(${governorAddr}) called`);

  await withConfirmation(
    cAaveStrategy
      .connect(sGovernor) // Claim governance with governor
      .claimGovernance()
  );
  log("Claimed governance for AaveStrategy");

  return cAaveStrategy;
};

/**
 * Configure Vault by adding supported assets and Strategies.
 */
const configureVault = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr, strategistAddr } = await getNamedAccounts();
  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await ethers.getContractAt(
    "VaultInitializer",
    (await ethers.getContract("VaultProxy")).address
  );
  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (await ethers.getContract("VaultProxy")).address
  );
  const aaveStrategyAddr = (await ethers.getContract("AaveStrategyProxy"))
    .address;

  log("Configuring Vault");

  // Set Uniswap addr
  await withConfirmation(
    cVault.connect(sGovernor).setUniswapAddr(assetAddresses.uniswapRouter)
  );
  log(` - Set Uniswap address: ${assetAddresses.uniswapRouter}`);

  // Set Uniswap addr
  await withConfirmation(
    cVault.connect(sGovernor).setCeloGoldAddr(assetAddresses.CELO)
  );
  log(` - Set Celo Gold Token address: ${assetAddresses.CELO}`);

  // Set strategist addr
  await withConfirmation(
    cVault.connect(sGovernor).setStrategistAddr(strategistAddr)
  );
  log(` - Set Strategist address: ${strategistAddr}`);

  // Set Vault buffer
  await withConfirmation(
    cVault.connect(sGovernor).setVaultBuffer(utils.parseUnits("2", 16))
  );
  log(" - Set Vault buffer: 0.02%");

  // Set Redeem fee BPS
  await withConfirmation(cVault.connect(sGovernor).setRedeemFeeBps(50));
  log(" - Set Redeem free bps: 50");

  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.CUSD)
  );
  log(" - Added cUSD asset to Vault");

  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.CEUR)
  );
  log(" - Added cEUR asset to Vault");

  // approve aave strategy
  await withConfirmation(
    cVault.connect(sGovernor).approveStrategy(aaveStrategyAddr)
  );
  log(` - Approve AaveStrategy(${aaveStrategyAddr})`);

  // set default strategy for cUSD
  await withConfirmation(
    cVault
      .connect(sGovernor)
      .setAssetDefaultStrategy(assetAddresses.CUSD, aaveStrategyAddr)
  );
  log(` - Set AaveStrategy(${aaveStrategyAddr}) as default for cUSD deposits`);

  // set default strategy for cEUR
  await withConfirmation(
    cVault
      .connect(sGovernor)
      .setAssetDefaultStrategy(assetAddresses.CEUR, aaveStrategyAddr)
  );
  log(` - Set AaveStrategy(${aaveStrategyAddr}) as default for cEUR deposits`);

  // Unpause deposits
  await withConfirmation(cVault.connect(sGovernor).unpauseCapital());
  log(" - Unpaused deposits on Vault");

  // set trustee
  await withConfirmation(
    cVault
      .connect(sGovernor)
      .setTrusteeAddress("0x1F692dB804328376104bCc666c7d7C0bEE4869F9")
  );
  await withConfirmation(
    cVault.connect(sGovernor).setTrusteeFeeBps(1000) // 10%
  );

  // reduce thresholds for alfajores
  if (isAlfajores) {
    console.log(` -  Set setAutoAllocateThreshold("25")`);
    await withConfirmation(
      cVault.connect(sGovernor).setAutoAllocateThreshold(cusdUnits("25"))
    );
    console.log(` - Set setRebaseThreshold("1")`);
    await withConfirmation(
      cVault.connect(sGovernor).setRebaseThreshold(cusdUnits("1"))
    );
  }
};

/**
 * Deploy the OracleRouter.
 */
const deployOracles = async () => {
  const oracleContract = isMainnetOrAlfajoresOrFork
    ? "OracleRouter"
    : "OracleRouterDev";
  await deployWithConfirmation("OracleRouter", [], oracleContract);

  if (!isMainnetOrAlfajoresOrFork) {
    // set the mock values for cUSD  and cEUR
    const assetAddresses = await getAssetAddresses(deployments);
    const oracleRouter = await ethers.getContract("OracleRouter");
    await withConfirmation(
      oracleRouter.setPrice(assetAddresses.CUSD, "1000000000000000000") // 1.0000
    );
    await withConfirmation(
      oracleRouter.setPrice(assetAddresses.CEUR, "1200100000000000000") // 1.2001
    );
  }
};

/**
 * Deploy the core contracts (Vault and OUSD).
 *
 */
const deployCore = async () => {
  const { governorAddr } = await hre.getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);
  log(`Using asset addresses: ${JSON.stringify(assetAddresses, null, 2)}`);

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Proxies
  await deployWithConfirmation("OUSDProxy");
  await deployWithConfirmation("VaultProxy");

  // Main contracts
  const dOUSD = await deployWithConfirmation("OUSD");
  const dVault = await deployWithConfirmation("Vault");
  const dVaultCore = await deployWithConfirmation("VaultCore");
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

  await deployWithConfirmation("Governor", [governorAddr, 60]);

  // Get contract instances
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);
  const cOracleRouter = await ethers.getContract("OracleRouter");
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

  await withConfirmation(
    cOUSDProxy["initialize(address,address,bytes)"](
      dOUSD.address,
      governorAddr,
      []
    )
  );
  log("Initialized OUSDProxy");

  // Need to call the initializer on the Vault then upgraded it to the actual
  // VaultCore implementation
  await withConfirmation(
    cVaultProxy["initialize(address,address,bytes)"](
      dVault.address,
      governorAddr,
      []
    )
  );
  log("Initialized VaultProxy");

  await withConfirmation(
    cVault
      .connect(sGovernor)
      .initialize(cOracleRouter.address, cOUSDProxy.address)
  );
  log("Initialized Vault");

  await withConfirmation(
    cVaultProxy.connect(sGovernor).upgradeTo(dVaultCore.address)
  );
  log("Upgraded VaultCore implementation");

  await withConfirmation(
    cVault.connect(sGovernor).setAdminImpl(dVaultAdmin.address)
  );
  log("Initialized VaultAdmin implementation");

  // Initialize OUSD
  await withConfirmation(
    cOUSD
      .connect(sGovernor)
      .initialize("Interest Dollar", "iUSD", cVaultProxy.address)
  );
  log("Initialized iUSD");
};

// Deploy the Flipper trading contract
const deployFlipper = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await hre.getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const ousd = await ethers.getContract("OUSDProxy");

  await deployWithConfirmation("FlipperDev", [
    assetAddresses.CUSD,
    ousd.address,
  ]);
  const flipper = await ethers.getContract("FlipperDev");
  await withConfirmation(flipper.transferGovernance(governorAddr));
  await withConfirmation(flipper.connect(sGovernor).claimGovernance());
};

const configureUniswapRouterBeforeStrategy = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  await ethers.getContractAt(
    "VaultInitializer",
    (await ethers.getContract("VaultProxy")).address
  );
  const cVault = await ethers.getContractAt(
    "VaultAdmin",
    (await ethers.getContract("VaultProxy")).address
  );
  await withConfirmation(
    cVault.connect(sGovernor).setUniswapAddr(assetAddresses.uniswapRouter)
  );

  // For testnets and local, initialize MockUniswapRouter
  if (!isMainnetOrFork) {
    const cMockUniswapRouter = await ethers.getContract("MockUniswapRouter");
    await withConfirmation(
      cMockUniswapRouter
        .connect(sGovernor)
        .initialize(
          assetAddresses.mCUSD,
          assetAddresses.mCEUR,
          (await deployments.get("MockMCUSDMEURLPToken")).address
        )
    );
    log("Initialized MockUniswapRouter");
  }
};

const main = async () => {
  console.log("Running 001_core deployment...");
  await deployOracles();
  await deployCore();

  // Need to set Uniswap address in vault before initializing the
  // AaveStrategy
  await configureUniswapRouterBeforeStrategy();

  await deployAaveStrategy();
  await configureVault();
  await deployFlipper();
  console.log("001_core deploy done.");
  return true;
};

main.id = "001_core";
main.dependencies = ["mocks"];

module.exports = main;
