const {
  isMainnet,
  isFork,
  isAlfajores,
  isSmokeTest,
  getAssetAddresses,
  isMainnetOrFork,
  isMainnetOrAlfajoresOrFork,
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
  const assetAddresses = await getAssetAddresses(hre.deployments);
  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const aaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");

  // Deploy Updated Aave strategy.
  const dAaveStrategy = await deployWithConfirmation("AaveStrategy");
  const aaveStrategy = await ethers.getContract("AaveStrategy");

  // Proposal for the governor update the contract
  const propDescription =
    "Update Aave implementation, enable cEUR and set MOO as reward token";
  const propArgs = await proposeArgs([
    // upgrade AaveStrategy
    {
      contract: aaveStrategyProxy,
      signature: "upgradeTo(address)",
      args: [dAaveStrategy.address],
    },
    // set MOO as reward token
    {
      contract: aaveStrategy,
      signature: "setRewardTokenAddress(address)",
      args: [assetAddresses.MOO],
    },
    // enable cEUR deposits
    {
      contract: aaveStrategy,
      signature: "setPTokenAddress(address,address)",
      args: [assetAddresses.CEUR, assetAddresses.mCEUR],
    },
    // set uniswap router address in new implementation
    {
      contract: aaveStrategy,
      signature: "setUniswapAddress(address)",
      args: [
        isMainnetOrFork
          ? addresses.mainnet.uniswapRouter
          : addresses.alfajores.uniswapRouter,
      ],
    },
    // set staking contract address in new implementation
    {
      contract: aaveStrategy,
      signature: "setStakingAddress(address)",
      args: [
        isMainnetOrFork
          ? addresses.zero
          : (await ethers.getContract("MockMOOStaking")).address,
      ],
    },
  ]);

  log(`Proposal: ${propDescription}`);
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
      aaveStrategyProxy.connect(sGovernor).upgradeTo(dAaveStrategy.address)
    );
    log(`Successfully Executed: ${propDescription}`);
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
