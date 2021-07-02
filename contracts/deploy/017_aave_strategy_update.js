const {
  isMainnet,
  isFork,
  isAlfajores,
  isSmokeTest,
  getAssetAddresses,
} = require("../test/helpers.js");
const addresses = require("../utils/addresses");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
  executeProposal,
  sendProposal,
} = require("../utils/deploy");
const { proposeArgs } = require("../utils/governor");
const { getTxOpts } = require("../utils/tx");

const deployName = "017_aave_strategy_update";

const runDeployment = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const aaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");

  // Deploy Updated Aave strategy.
  const dAaveStrategy = await deployWithConfirmation("AaveStrategy");

  const aaveStrategy = await ethers.getContract("AaveStrategy");


  const assetAddr = await getAssetAddresses(hre.deployments);
  // Configure new aave strategy for MOO staking
  if (isMainnet) {
    // set uniswap router
    await aaveStrategy
      .connect(sGovernor)
      .setUniswapAddress(addresses.mainnet.uniswapRouter);
    // set the LP pair, mcUSD(cUSD) - mcEUR(cEUR)
    await aaveStrategy
      .connect(sGovernor)
      .setRewardLpPair(assetAddr.CUSD, assetAddr.CEUR);
  } else if (isAlfajores) {
    // set uniswap router
    log("Setting Uniswap router address in new Aave strategy")
    await aaveStrategy
      .connect(sGovernor)
      .setUniswapAddress(addresses.alfajores.uniswapRouter);
    // set the LP pair, mcUSD(cUSD) - mcEUR(cEUR)
    log("Setting mcUSD-mcEUR LP Pair in new Aave strategy")
    await aaveStrategy
      .connect(sGovernor)
      .setRewardLpPair(assetAddr.CUSD, assetAddr.CEUR);
  } else {
    // set uniswap router
    await aaveStrategy
      .connect(sGovernor)
      .setUniswapAddress(
        (await ethers.getContract("MockUniswapRouter")).address
      );
    // set the LP pair, mcUSD(cUSD) - mcEUR(cEUR)
    await aaveStrategy
      .connect(sGovernor)
      .setRewardLpPair(assetAddr.CUSD, assetAddr.CEUR);
    // set the staking contract address
    await aaveStrategy
      .connect(sGovernor)
      .setStakingAddress((await ethers.getContract("MockMOOStaking")).address);
  }

  // Proposal for the governor update the contract
  const propDescription = "Update Aave implementation";
  const propArgs = await proposeArgs([
    {
      contract: aaveStrategyProxy,
      signature: "upgradeTo(address)",
      args: [dAaveStrategy.address],
    },
  ]);

  if (isMainnet) {
    // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
    log("Sending proposal to governor...");
    await sendProposal(propArgs, propDescription);
    log("Proposal sent.");
  } else if (isFork) {
    // On Fork we can send the proposal then impersonate the guardian to execute it.
    log("Sending and executing proposal...");
    await executeProposal(propArgs, propDescription);
    log("Proposal executed.");
  } else {
    await withConfirmation(
      aaveStrategyProxy
        .connect(sGovernor)
        .upgradeTo(dAaveStrategy.address)
    );
    log("Switched implementation of AaveStrategy");
  }

  return true;
};

const main = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  if (!hre) {
    hre = require("hardhat");
  }
  await runDeployment(hre);
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.dependencies = ["016_upgrade_vault", "mocks"];
main.skip = () => !(isMainnet || isAlfajores || isFork) || isSmokeTest;

module.exports = main;
