const { parseUnits } = require("ethers").utils;
const { isMainnetOrAlfajoresOrFork } = require("../test/helpers");

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
    "MockCUSD",
    "MockCEUR",
    "MockNonStandardToken",
    "MockAave",
    "MockMCUSDMEURLPToken",
  ];
  for (const contract of assetContracts) {
    await deploy(contract, { from: deployerAddr });
  }

  // Deploy a mock Vault with additional functions for tests
  await deploy("MockVault", {
    from: governorAddr,
  });

  const cusd = await ethers.getContract("MockCUSD");
  const ceur = await ethers.getContract("MockCEUR");
  const moo = await ethers.getContract("MockMOO");
  const mooLp = await ethers.getContract("MockMCUSDMEURLPToken");

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

  // Deploy mock MOO Staking contract
  await deploy("MockMOOStaking", {
    from: deployerAddr,
    args: [moo.address, mooLp.address],
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
deployMocks.skip = () => isMainnetOrAlfajoresOrFork;

module.exports = deployMocks;
