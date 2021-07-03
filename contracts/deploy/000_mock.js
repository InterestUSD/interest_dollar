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

  // await deploy("MockOGN", {
  //   from: deployerAddr,
  //   args: [parseUnits("1000000000", 18)],
  // });

  // // Mock Comptroller
  // await deploy("MockComptroller", {
  //   from: deployerAddr,
  // });

  // // Deploy mock cTokens (Compound)
  // await deploy("MockCDAI", {
  //   args: [
  //     (await ethers.getContract("MockDAI")).address,
  //     (await ethers.getContract("MockComptroller")).address,
  //   ],
  //   contract: "MockCToken",
  //   from: deployerAddr,
  // });

  // await deploy("MockCUSDC", {
  //   args: [
  //     (await ethers.getContract("MockUSDC")).address,
  //     (await ethers.getContract("MockComptroller")).address,
  //   ],
  //   contract: "MockCToken",
  //   from: deployerAddr,
  // });

  // await deploy("MockCUSDT", {
  //   args: [
  //     (await ethers.getContract("MockUSDT")).address,
  //     (await ethers.getContract("MockComptroller")).address,
  //   ],
  //   contract: "MockCToken",
  //   from: deployerAddr,
  // });

  // // Mock COMP token
  // await deploy("MockCOMP", {
  //   from: deployerAddr,
  // });

  // Deploy a mock Vault with additional functions for tests
  await deploy("MockVault", {
    from: governorAddr,
  });

  // Deploy mock uniswap pair oracles.
  // const weth = await ethers.getContract("MockWETH");
  // const dai = await ethers.getContract("MockDAI");
  // const usdc = await ethers.getContract("MockUSDC");
  // const usdt = await ethers.getContract("MockUSDT");
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

  // // Deploy mock chainlink oracle price feeds.
  // await deploy("MockChainlinkOracleFeedDAI", {
  //   from: deployerAddr,
  //   contract: "MockChainlinkOracleFeed",
  //   args: [parseUnits("1", 8).toString(), 18], // 1 DAI = 1 USD, 8 digits decimal.
  // });
  // await deploy("MockChainlinkOracleFeedUSDT", {
  //   from: deployerAddr,
  //   contract: "MockChainlinkOracleFeed",
  //   args: [parseUnits("1", 8).toString(), 18], // 1 USDT = 1 USD, 8 digits decimal.
  // });
  // await deploy("MockChainlinkOracleFeedUSDC", {
  //   from: deployerAddr,
  //   contract: "MockChainlinkOracleFeed",
  //   args: [parseUnits("1", 8).toString(), 18], // 1 USDC = 1 USD, 8 digits decimal.
  // });
  // await deploy("MockChainlinkOracleFeedTUSD", {
  //   from: deployerAddr,
  //   contract: "MockChainlinkOracleFeed",
  //   args: [parseUnits("1", 8).toString(), 18], // 1 TUSD = 1 USD, 8 digits decimal.
  // });
  // await deploy("MockChainlinkOracleFeedNonStandardToken", {
  //   from: deployerAddr,
  //   contract: "MockChainlinkOracleFeed",
  //   args: [parseUnits("1", 8).toString(), 18], // 1 = 1 USD, 8 digits decimal.
  // });

  // Deploy mock Uniswap router
  await deploy("MockUniswapRouter", {
    from: deployerAddr,
  });

  // Deploy mock MOO Staking contract
  await deploy("MockMOOStaking", {
    from: deployerAddr,
    args: [moo.address, mooLp.address],
  });

  // // Deploy 3pool mocks
  // await deploy("Mock3CRV", {
  //   from: deployerAddr,
  // });

  // // Mock CRV token
  // await deploy("MockCRV", {
  //   from: deployerAddr,
  // });

  // // Mock Curve minter for minting CRV
  // const mockCRV = await ethers.getContract("MockCRV");
  // await deploy("MockCRVMinter", {
  //   from: deployerAddr,
  //   args: [mockCRV.address],
  // });

  // const threePoolToken = await ethers.getContract("Mock3CRV");

  // // Mock Curve gauge for depositing LP tokens from pool
  // await deploy("MockCurveGauge", {
  //   from: deployerAddr,
  //   args: [threePoolToken.address],
  // });

  // await deploy("MockCurvePool", {
  //   from: deployerAddr,
  //   args: [[dai.address, usdc.address, usdt.address], threePoolToken.address],
  // });

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
