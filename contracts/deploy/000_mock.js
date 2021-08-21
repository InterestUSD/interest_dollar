const { parseUnits } = require("ethers").utils;
const { isMainnetOrFork, isAlfajores } = require("../test/helpers");
const addresses = require("../utils/addresses");

const deployMocks = async ({
  getNamedAccounts,
  deployments,
  getUnnamedAccounts,
}) => {
  const { deploy } = deployments;
  const { deployerAddr, governorAddr } = await getNamedAccounts();

  console.log("Running 000_mock deployment...");
  console.log("Deployer address", deployerAddr);
  console.log("Governor address", governorAddr);

  // Deploy mock coins (assets)
  const assetContracts = [
    "MockMOO",
    "MockUBE",
    "MockCELO",
    "MockCUSD",
    "MockCEUR",
    "MockNonStandardToken",
    "MockAave",
  ];
  for (const contract of assetContracts) {
    // console.log(`Deploying: ${contract}`);
    await deploy(contract, { from: deployerAddr });
  }

  // Deploy a mock Vault with additional functions for tests
  await deploy("MockVault", {
    from: governorAddr,
  });

  const cusd = await ethers.getContract("MockCUSD");
  const ceur = await ethers.getContract("MockCEUR");
  const moo = await ethers.getContract("MockMOO");
  const ube = await ethers.getContract("MockUBE");

  // Deploy mock aTokens (Aave)
  // MockAave is the mock lendingPool
  const lendingPool = await ethers.getContract("MockAave");
  await deploy("MockMCUSD", {
    args: [lendingPool.address, "Mock Aave CUSD", "mcUSD", cusd.address],
    contract: "MockAToken",
    from: deployerAddr,
  });
  lendingPool.addAToken(
    (await ethers.getContract("MockMCUSD")).address,
    cusd.address
  );

  await deploy("MockMCEUR", {
    args: [lendingPool.address, "Mock Aave CEUR", "mcEUR", ceur.address],
    contract: "MockAToken",
    from: deployerAddr,
  });
  lendingPool.addAToken(
    (await ethers.getContract("MockMCEUR")).address,
    ceur.address
  );

  // Deploy mock Uniswap router
  await deploy("MockUniswapRouter", {
    from: deployerAddr,
  });

  const mcusd = await ethers.getContract("MockMCUSD");
  const mceur = await ethers.getContract("MockMCEUR");
  const uniswapRouter = await ethers.getContract("MockUniswapRouter");

  await deploy("MockMCUSDMEURLPToken", {
    from: deployerAddr,
    args: [mcusd.address, mceur.address, uniswapRouter.address],
  });

  const mCUSDmCEURPair_address = isAlfajores
    ? addresses.alfajores.mCUSD_mCEUR_Pair
    : (await ethers.getContract("MockMCUSDMEURLPToken")).address;

  // Deploy mock Ube Staking contract
  await deploy("MockUbeStaking", {
    from: deployerAddr,
    args: [ube.address, moo.address, mCUSDmCEURPair_address],
  });

  await deploy("MockNonRebasing", {
    from: deployerAddr,
  });

  await deploy("MockNonRebasingTwo", {
    from: deployerAddr,
    contract: "MockNonRebasing",
  });

  console.log("000_mock deploy done.");

  return true;
};

deployMocks.id = "000_mock";
deployMocks.tags = ["mocks"];
deployMocks.skip = () => isMainnetOrFork;

module.exports = deployMocks;
