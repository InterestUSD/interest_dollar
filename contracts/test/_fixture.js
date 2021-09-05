const hre = require("hardhat");

const addresses = require("../utils/addresses");
const fundAccounts = require("../utils/funding");
const { getAssetAddresses, cusdUnits, isFork } = require("./helpers");
const { utils } = require("ethers");

const { loadFixture } = require("./helpers");

const cusdAbi = require("./abi/erc20.json");
const ceurAbi = require("./abi/erc20.json");

async function defaultFixture() {
  await deployments.fixture();

  const { governorAddr } = await getNamedAccounts();

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const vaultProxy = await ethers.getContract("VaultProxy");

  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);
  const governorContract = await ethers.getContract("Governor");

  const aaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const aaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    aaveStrategyProxy.address
  );

  const oracleRouter = await ethers.getContract("OracleRouter");

  let ceur,
    cusd,
    nonStandardToken,
    acusd,
    aceur,
    moo,
    mockNonRebasing,
    mockNonRebasingTwo;

  let aaveAddressProvider, flipper;

  if (isFork) {
    ceur = await ethers.getContractAt(ceurAbi, addresses.mainnet.CEUR);
    cusd = await ethers.getContractAt(cusdAbi, addresses.mainnet.CUSD);
    moo = await ethers.getContractAt(cusdAbi, addresses.mainnet.MOO);
    aaveAddressProvider = await ethers.getContractAt(
      "ILendingPoolAddressesProvider",
      addresses.mainnet.AAVE_ADDRESS_PROVIDER
    );
  } else {
    ceur = await ethers.getContract("MockCEUR");
    cusd = await ethers.getContract("MockCUSD");
    moo = await ethers.getContract("MockMOO");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");

    acusd = await ethers.getContract("MockMCUSD");
    aceur = await ethers.getContract("MockMCEUR");

    const aave = await ethers.getContract("MockAave");
    // currently in test the mockAave is itself the address provder
    aaveAddressProvider = await ethers.getContractAt(
      "ILendingPoolAddressesProvider",
      aave.address
    );

    // Mock contracts for testing rebase opt out
    mockNonRebasing = await ethers.getContract("MockNonRebasing");
    await mockNonRebasing.setOUSD(ousd.address);
    mockNonRebasingTwo = await ethers.getContract("MockNonRebasingTwo");
    await mockNonRebasingTwo.setOUSD(ousd.address);

    flipper = await ethers.getContract("FlipperDev");
  }
  const assetAddresses = await getAssetAddresses(deployments);

  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Enable capital movement
  await vault.connect(sGovernor).unpauseCapital();

  const signers = await hre.ethers.getSigners();
  const governor = signers[1];
  const strategist = signers[0];
  const adjuster = signers[0];
  const matt = signers[4];
  const josh = signers[5];
  const anna = signers[6];

  await fundAccounts();

  // Matt and Josh each have $100 OUSD
  for (const user of [matt, josh]) {
    await cusd.connect(user).approve(vault.address, cusdUnits("100"));
    await vault.connect(user).mint(cusd.address, cusdUnits("100"), 0);
  }

  return {
    // Accounts
    matt,
    josh,
    anna,
    governor,
    strategist,
    adjuster,
    // Contracts
    ousd,
    vault,
    mockNonRebasing,
    mockNonRebasingTwo,
    // Oracle
    governorContract,
    oracleRouter,
    // Assets
    ceur,
    cusd,
    nonStandardToken,
    // aTokens,
    acusd,
    aceur,
    moo,
    // strategy
    aaveStrategy,
    aaveAddressProvider,
    // flipper
    flipper,
  };
}

/**
 * Configure the MockVault contract by initializing it and setting supported
 * assets and then upgrade the Vault implementation via VaultProxy.
 */
async function mockVaultFixture() {
  const fixture = await loadFixture(defaultFixture);

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Initialize and configure MockVault
  const cMockVault = await ethers.getContract("MockVault");

  // There is no need to initialize and setup the mock vault because the
  // proxy itself is already setup and the proxy is the one with the storage

  // Upgrade Vault to MockVault via proxy
  const cVaultProxy = await ethers.getContract("VaultProxy");

  // disbale trustee
  const cVaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    cVaultProxy.address
  );
  cVaultAdmin.connect(sGovernor)["setTrusteeAddress(address)"](addresses.zero);

  await cVaultProxy.connect(sGovernor).upgradeTo(cMockVault.address);

  fixture.mockVault = await ethers.getContractAt(
    "MockVault",
    cVaultProxy.address
  );

  return fixture;
}

/**
 * Configure a Vault with only the Aave strategy.
 */
async function aaveVaultFixture() {
  const fixture = await loadFixture(defaultFixture);

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  // Add Aave which only supports cUSD and cEUR
  await fixture.vault
    .connect(sGovernor)
    .approveStrategy(fixture.aaveStrategy.address);
  // Add direct allocation of cUSD to Aave
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.cusd.address,
      fixture.aaveStrategy.address
    );
  // Add direct allocation of cEUR to Aave
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(
      fixture.ceur.address,
      fixture.aaveStrategy.address
    );
  return fixture;
}

/**
 * Configure a Vault with two strategies
 */
async function multiStrategyVaultFixture() {
  const fixture = await aaveVaultFixture();
  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deploy("StrategyTwo", {
    from: governorAddr,
    contract: "AaveStrategy",
  });

  const cStrategyTwo = await ethers.getContract("StrategyTwo");
  // Initialize the second strategy with DAI and USDC
  await cStrategyTwo
    .connect(sGovernor)
    [
      "initialize(address,address,address,address[],address[],address,address,address,address)"
    ](
      fixture.aaveAddressProvider.address,
      fixture.vault.address,
      addresses.zero, // Setting MOO as primary reward token
      [assetAddresses.CEUR],
      [assetAddresses.mCEUR],
      addresses.zero, // Staking contract address
      assetAddresses.CUSD, // LP Reward Pair Token 1
      assetAddresses.CEUR, // LP Reward Pair Token 2
      assetAddresses.UBE // Setting UBE as secondary reward
    );
  // Add second strategy to Vault
  await fixture.vault.connect(sGovernor).approveStrategy(cStrategyTwo.address);
  // cusd to second strategy
  await fixture.vault
    .connect(sGovernor)
    .setAssetDefaultStrategy(fixture.ceur.address, cStrategyTwo.address);

  // Set up third strategy
  await deploy("StrategyThree", {
    from: governorAddr,
    contract: "AaveStrategy",
  });
  const cStrategyThree = await ethers.getContract("StrategyThree");
  // Initialize the third strategy with only DAI
  await cStrategyThree
    .connect(sGovernor)
    [
      "initialize(address,address,address,address[],address[],address,address,address,address)"
    ](
      fixture.aaveAddressProvider.address,
      fixture.vault.address,
      addresses.zero,
      [assetAddresses.CUSD],
      [assetAddresses.mCUSD],
      addresses.zero, 
      assetAddresses.CUSD, // LP Reward Pair Token 1
      assetAddresses.CEUR, // LP Reward Pair Token 2
      assetAddresses.UBE // Setting UBE as secondary reward
    );

  fixture.strategyTwo = cStrategyTwo;
  fixture.strategyThree = cStrategyThree;
  return fixture;
}

/**
 * Configure a hacked Vault
 */
async function hackedVaultFixture() {
  const fixture = await loadFixture(defaultFixture);
  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { vault, oracleRouter } = fixture;
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  await deploy("MockEvilCUSD", {
    from: governorAddr,
    args: [vault.address, assetAddresses.CUSD],
  });

  const evilCUSD = await ethers.getContract("MockEvilCUSD");

  await oracleRouter.setPrice(evilCUSD.address, cusdUnits("1"));
  await fixture.vault.connect(sGovernor).supportAsset(evilCUSD.address);

  fixture.evilCUSD = evilCUSD;

  return fixture;
}

/**
 * Configure a reborn hack attack
 */
async function rebornFixture() {
  const fixture = await loadFixture(defaultFixture);
  const assetAddresses = await getAssetAddresses(deployments);
  const { deploy } = deployments;
  const { governorAddr } = await getNamedAccounts();
  const { vault } = fixture;

  await deploy("Sanctum", {
    from: governorAddr,
    args: [assetAddresses.CUSD, vault.address],
  });

  const sanctum = await ethers.getContract("Sanctum");

  const encodedCallbackAddress = utils.defaultAbiCoder
    .encode(["address"], [sanctum.address])
    .slice(2);
  const initCode = (await ethers.getContractFactory("Reborner")).bytecode;
  const deployCode = `${initCode}${encodedCallbackAddress}`;

  await sanctum.deploy(12345, deployCode);
  const rebornAddress = await sanctum.computeAddress(12345, deployCode);
  const reborner = await ethers.getContractAt("Reborner", rebornAddress);

  const rebornAttack = async (shouldAttack = true, targetMethod = null) => {
    await sanctum.setShouldAttack(shouldAttack);
    if (targetMethod) await sanctum.setTargetMethod(targetMethod);
    await sanctum.setOUSDAddress(fixture.ousd.address);
    await sanctum.deploy(12345, deployCode);
  };

  fixture.reborner = reborner;
  fixture.rebornAttack = rebornAttack;

  return fixture;
}

module.exports = {
  defaultFixture,
  mockVaultFixture,
  multiStrategyVaultFixture,
  aaveVaultFixture,
  hackedVaultFixture,
  rebornFixture,
};
