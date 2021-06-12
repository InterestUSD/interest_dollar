const hre = require("hardhat");

const addresses = require("../utils/addresses");
const {
  getAssetAddresses,
  // getOracleAddresses,
  isMainnet,
  isAlfajores,
  isFork,
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
    cAaveStrategy.connect(sDeployer).initialize(
      assetAddresses.AAVE_ADDRESS_PROVIDER,
      cVaultProxy.address,
      addresses.zero, // No reward token for Aave
      [assetAddresses.CUSD],
      [assetAddresses.mCUSD]
    )
  );
  log("Initialized AaveStrategy");
  await withConfirmation(
    cAaveStrategy.connect(sDeployer).transferGovernance(governorAddr)
  );
  log(`AaveStrategy transferGovernance(${governorAddr}) called`);

  // On Mainnet the governance transfer gets executed separately, via the
  // multi-sig wallet. On other networks, this migration script can claim
  // governance by the governor.
  if (!isMainnet) {
    await withConfirmation(
      cAaveStrategy
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance()
    );
    log("Claimed governance for AaveStrategy");
  }

  return cAaveStrategy;
};

// /**
//  * Deploy Compound Strategy which only supports DAI.
//  * Deploys a proxy, the actual strategy, initializes the proxy and initializes
//  * the strategy.
//  */
// const deployCompoundStrategy = async () => {
//   const assetAddresses = await getAssetAddresses(deployments);
//   const { deployerAddr, governorAddr } = await getNamedAccounts();
//   // Signers
//   const sDeployer = await ethers.provider.getSigner(deployerAddr);
//   const sGovernor = await ethers.provider.getSigner(governorAddr);

//   const cVaultProxy = await ethers.getContract("VaultProxy");

//   const dCompoundStrategyProxy = await deployWithConfirmation(
//     "CompoundStrategyProxy"
//   );
//   const cCompoundStrategyProxy = await ethers.getContract(
//     "CompoundStrategyProxy"
//   );
//   const dCompoundStrategy = await deployWithConfirmation("CompoundStrategy");
//   const cCompoundStrategy = await ethers.getContractAt(
//     "CompoundStrategy",
//     dCompoundStrategyProxy.address
//   );
//   await withConfirmation(
//     cCompoundStrategyProxy["initialize(address,address,bytes)"](
//       dCompoundStrategy.address,
//       deployerAddr,
//       []
//     )
//   );
//   log("Initialized CompoundStrategyProxy");
//   await withConfirmation(
//     cCompoundStrategy
//       .connect(sDeployer)
//       .initialize(
//         addresses.dead,
//         cVaultProxy.address,
//         assetAddresses.COMP,
//         [assetAddresses.DAI],
//         [assetAddresses.cDAI]
//       )
//   );
//   log("Initialized CompoundStrategy");
//   await withConfirmation(
//     cCompoundStrategy.connect(sDeployer).transferGovernance(governorAddr)
//   );
//   log(`CompoundStrategy transferGovernance(${governorAddr} called`);

//   // On Mainnet the governance transfer gets executed separately, via the
//   // multi-sig wallet. On other networks, this migration script can claim
//   // governance by the governor.
//   if (!isMainnet) {
//     await withConfirmation(
//       cCompoundStrategy
//         .connect(sGovernor) // Claim governance with governor
//         .claimGovernance()
//     );
//     log("Claimed governance for CompoundStrategy");
//   }
//   return cCompoundStrategy;
// };

// /**
//  * Deploys a 3pool Strategy which supports USDC, USDT and DAI.
//  * Deploys a proxy, the actual strategy, initializes the proxy and initializes
//  */
// const deployThreePoolStrategy = async () => {
//   const assetAddresses = await getAssetAddresses(deployments);
//   const { deployerAddr, governorAddr } = await getNamedAccounts();
//   // Signers
//   const sDeployer = await ethers.provider.getSigner(deployerAddr);
//   const sGovernor = await ethers.provider.getSigner(governorAddr);

//   await deployWithConfirmation("ThreePoolStrategyProxy");
//   const cThreePoolStrategyProxy = await ethers.getContract(
//     "ThreePoolStrategyProxy"
//   );

//   const dThreePoolStrategy = await deployWithConfirmation("ThreePoolStrategy");
//   const cThreePoolStrategy = await ethers.getContractAt(
//     "ThreePoolStrategy",
//     cThreePoolStrategyProxy.address
//   );

//   await withConfirmation(
//     cThreePoolStrategyProxy["initialize(address,address,bytes)"](
//       dThreePoolStrategy.address,
//       deployerAddr,
//       []
//     )
//   );
//   log("Initialized ThreePoolStrategyProxy");

//   // Initialize Strategies
//   const cVaultProxy = await ethers.getContract("VaultProxy");
//   await withConfirmation(
//     cThreePoolStrategy
//       .connect(sDeployer)
//       [
//         "initialize(address,address,address,address[],address[],address,address)"
//       ](
//         assetAddresses.ThreePool,
//         cVaultProxy.address,
//         assetAddresses.CRV,
//         [assetAddresses.DAI, assetAddresses.USDC, assetAddresses.USDT],
//         [
//           assetAddresses.ThreePoolToken,
//           assetAddresses.ThreePoolToken,
//           assetAddresses.ThreePoolToken,
//         ],
//         assetAddresses.ThreePoolGauge,
//         assetAddresses.CRVMinter
//       )
//   );
//   log("Initialized ThreePoolStrategy");

//   await withConfirmation(
//     cThreePoolStrategy.connect(sDeployer).transferGovernance(governorAddr)
//   );
//   log(`ThreePoolStrategy transferGovernance(${governorAddr}) called`);
//   // On Mainnet the governance transfer gets executed separately, via the
//   // multi-sig wallet. On other networks, this migration script can claim
//   // governance by the governor.
//   if (!isMainnet) {
//     await withConfirmation(
//       cThreePoolStrategy
//         .connect(sGovernor) // Claim governance with governor
//         .claimGovernance()
//     );
//     log("Claimed governance for ThreePoolStrategy");
//   }

//   return cThreePoolStrategy;
// };

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

  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.CUSD)
  );
  log("Added cUSD asset to Vault");

  await withConfirmation(
    cVault.connect(sGovernor).supportAsset(assetAddresses.CEUR)
  );
  log("Added cEUR asset to Vault");

  // Unpause deposits
  await withConfirmation(cVault.connect(sGovernor).unpauseCapital());
  log("Unpaused deposits on Vault");
  // Set Strategist address.
  await withConfirmation(
    cVault.connect(sGovernor).setStrategistAddr(strategistAddr)
  );
};

/**
 * Deploy the OracleRouter.
 */
const deployOracles = async () => {
  // const { deployerAddr } = await getNamedAccounts();
  // Signers
  // const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const isLocal = !(isMainnet || isAlfajores || isFork);
  const oracleContract = !isLocal ? "OracleRouter" : "OracleRouterDev";
  await deployWithConfirmation("OracleRouter", [], oracleContract);

  if (isLocal) {
    // set the mock values for cUSD  and cEUR
    const assetAddresses = await getAssetAddresses(deployments);
    const oracleRouter = await ethers.getContract("OracleRouter");
    withConfirmation(
      oracleRouter.setPrice(assetAddresses.CUSD, "1000100000000000000") // 1.0001
    );
    withConfirmation(
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
      .initialize("Origin Dollar", "OUSD", cVaultProxy.address)
  );
  log("Initialized OUSD");
};

// Deploy the Flipper trading contract
const deployFlipper = async () => {
  const assetAddresses = await getAssetAddresses(deployments);
  const { governorAddr } = await hre.getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  const ousd = await ethers.getContract("OUSDProxy");

  await deployWithConfirmation("FlipperDev", [
    assetAddresses.CUSD,
    assetAddresses.CEUR,
    ousd.address,
  ]);
  const flipper = await ethers.getContract("FlipperDev");
  await withConfirmation(flipper.transferGovernance(governorAddr));
  await withConfirmation(flipper.connect(sGovernor).claimGovernance());
};

// const deployBuyback = async () => {
//   const { deployerAddr, governorAddr } = await getNamedAccounts();
//   const sDeployer = await ethers.provider.getSigner(deployerAddr);
//   const sGovernor = await ethers.provider.getSigner(governorAddr);

//   const assetAddresses = await getAssetAddresses(deployments);
//   const ousd = await ethers.getContract("OUSDProxy");
//   const vault = await ethers.getContract("VaultProxy");

//   await deployWithConfirmation(
//     "Buyback",
//     [
//       assetAddresses.uniswapRouter,
//       vault.address,
//       ousd.address,
//       assetAddresses.OGN,
//       assetAddresses.USDT,
//     ],
//     "BuybackConstructor"
//   );
//   const cBuyback = await ethers.getContract("Buyback");

//   await withConfirmation(
//     cBuyback.connect(sDeployer).transferGovernance(governorAddr)
//   );
//   log(`Buyback transferGovernance(${governorAddr} called`);

//   // On Mainnet the governance transfer gets executed separately, via the
//   // multi-sig wallet. On other networks, this migration script can claim
//   // governance by the governor.
//   if (!isMainnet) {
//     await withConfirmation(
//       cBuyback
//         .connect(sGovernor) // Claim governance with governor
//         .claimGovernance()
//     );
//     log("Claimed governance for Buyback");
//   }
//   return cBuyback;
// };

const main = async () => {
  console.log("Running 001_core deployment...");
  await deployOracles();
  await deployCore();
  // await deployCompoundStrategy();
  await deployAaveStrategy();
  // await deployThreePoolStrategy();
  await configureVault();
  await deployFlipper();
  // await deployBuyback();
  console.log("001_core deploy done.");
  return true;
};

main.id = "001_core";
main.dependencies = ["mocks"];

module.exports = main;
