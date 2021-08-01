const { utils } = require("ethers");
const { formatUnits } = utils;

const erc20Abi = require("../test/abi/erc20.json");
const { getAssetAddresses } = require("../test/addressHelper");
const addresses = require("../utils/addresses");

/**
 * Prints information about deployed contracts and their config.
 */
async function debug(taskArguments, hre) {
  let assetAddresses = await getAssetAddresses(hre, hre.deployments);

  //
  // Get all contracts to operate on.
  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  const ousdProxy = await hre.ethers.getContract("OUSDProxy");
  const aaveProxy = await hre.ethers.getContract("AaveStrategyProxy");
  const vault = await hre.ethers.getContractAt("IVault", vaultProxy.address);
  const cVault = await hre.ethers.getContract("Vault");
  const vaultAdmin = await hre.ethers.getContract("VaultAdmin");
  const vaultCore = await hre.ethers.getContract("VaultCore");
  const ousd = await hre.ethers.getContractAt("OUSD", ousdProxy.address);
  const cOusd = await hre.ethers.getContract("OUSD");
  const aaveStrategy = await hre.ethers.getContractAt(
    "AaveStrategy",
    aaveProxy.address
  );
  const cAaveStrategy = await hre.ethers.getContract("AaveStrategy");

  const oracleRouter = await hre.ethers.getContract("OracleRouter");

  const governor = await hre.ethers.getContract("Governor");

  //
  // Addresses
  //
  console.log("\nContract addresses");
  console.log("====================");
  console.log(`OUSD proxy:              ${ousdProxy.address}`);
  console.log(`OUSD impl:               ${await ousdProxy.implementation()}`);
  console.log(`OUSD:                    ${cOusd.address}`);
  console.log(`Vault proxy:             ${vaultProxy.address}`);
  console.log(`Vault impl:              ${await vaultProxy.implementation()}`);
  console.log(`Vault:                   ${cVault.address}`);
  console.log(`VaultCore:               ${vaultCore.address}`);
  console.log(`VaultAdmin:              ${vaultAdmin.address}`);
  console.log(`OracleRouter:            ${oracleRouter.address}`);
  console.log(`AaveStrategy proxy:      ${aaveProxy.address}`);
  console.log(`AaveStrategy impl:       ${await aaveProxy.implementation()}`);
  console.log(`AaveStrategy:            ${cAaveStrategy.address}`);
  console.log(`Governor:                ${governor.address}`);

  //
  // Governor
  //
  const govAdmin = await governor.admin();
  const govPendingAdmin = await governor.pendingAdmin();
  const govDelay = await governor.delay();
  const govPropCount = await governor.proposalCount();
  console.log("\nGovernor");
  console.log("====================");
  console.log("Admin:           ", govAdmin);
  console.log("PendingAdmin:    ", govPendingAdmin);
  console.log("Delay (seconds): ", govDelay.toString());
  console.log("ProposalCount:   ", govPropCount.toString());

  //
  // Governance
  //

  // Read the current governor address on all the contracts.
  const ousdGovernorAddr = await ousd.governor();
  const vaultGovernorAddr = await vault.governor();
  const aaveStrategyGovernorAddr = await aaveStrategy.governor();

  console.log("\nGovernor addresses");
  console.log("====================");
  console.log("OUSD:              ", ousdGovernorAddr);
  console.log("Vault:             ", vaultGovernorAddr);
  console.log("AaveStrategy:      ", aaveStrategyGovernorAddr);

  //
  // OUSD
  //
  const name = await ousd.name();
  const decimals = await ousd.decimals();
  const symbol = await ousd.symbol();
  const totalSupply = await ousd.totalSupply();
  const vaultAddress = await ousd.vaultAddress();
  const nonRebasingSupply = await ousd.nonRebasingSupply();
  const rebasingSupply = totalSupply.sub(nonRebasingSupply);
  const rebasingCreditsPerToken = await ousd.rebasingCreditsPerToken();
  const rebasingCredits = await ousd.rebasingCredits();

  console.log("\nOUSD");
  console.log("=======");
  console.log(`name:                    ${name}`);
  console.log(`symbol:                  ${symbol}`);
  console.log(`decimals:                ${decimals}`);
  console.log(`totalSupply:             ${formatUnits(totalSupply, 18)}`);
  console.log(`vaultAddress:            ${vaultAddress}`);
  console.log(`nonRebasingSupply:       ${formatUnits(nonRebasingSupply, 18)}`);
  console.log(`rebasingSupply:          ${formatUnits(rebasingSupply, 18)}`);
  console.log(`rebasingCreditsPerToken: ${rebasingCreditsPerToken}`);
  console.log(`rebasingCredits:         ${rebasingCredits}`);

  //
  // Oracle
  //
  console.log("\nOracle");
  console.log("========");
  const priceCUSD = await oracleRouter.price(assetAddresses.CUSD);
  const priceCEUR = await oracleRouter.price(assetAddresses.CEUR);
  console.log(`CUSD price :  ${formatUnits(priceCUSD, 8)} CUSD`);
  console.log(`CEUR price:  ${formatUnits(priceCEUR, 8)} CUSD`);

  //
  // Vault
  //
  const rebasePaused = await vault.rebasePaused();
  const capitalPaused = await vault.capitalPaused();
  const redeemFeeBps = Number(await vault.redeemFeeBps());
  const trusteeFeeBps = Number(await vault.trusteeFeeBps());
  const vaultBuffer = Number(
    formatUnits((await vault.vaultBuffer()).toString(), 18)
  );
  const autoAllocateThreshold = await vault.autoAllocateThreshold();
  const rebaseThreshold = await vault.rebaseThreshold();
  const maxSupplyDiff = await vault.maxSupplyDiff();
  const uniswapAddr = await vault.uniswapAddr();
  const celoGoldAddr = await vault.celoGoldAddr();
  const strategyCount = await vault.getStrategyCount();
  const assetCount = await vault.getAssetCount();
  const strategistAddress = await vault.strategistAddr();
  const trusteeAddress = await vault.trusteeAddress();
  const priceProvider = await vault.priceProvider();

  console.log("\nVault Settings");
  console.log("================");
  console.log("rebasePaused:\t\t\t", rebasePaused);
  console.log("capitalPaused:\t\t\t", capitalPaused);
  console.log(`redeemFeeBps:\t\t\t ${redeemFeeBps} (${redeemFeeBps / 100}%)`);
  console.log(
    `trusteeFeeBps:\t\t\t ${trusteeFeeBps} (${trusteeFeeBps / 100}%)`
  );
  console.log(`vaultBuffer:\t\t\t ${vaultBuffer} (${vaultBuffer * 100}%)`);
  console.log(
    "autoAllocateThreshold (USD):\t",
    formatUnits(autoAllocateThreshold.toString(), 18)
  );
  console.log(
    "rebaseThreshold (USD):\t\t",
    formatUnits(rebaseThreshold.toString(), 18)
  );

  console.log(
    `maxSupplyDiff:\t\t\t ${formatUnits(maxSupplyDiff.toString(), 16)}%`
  );

  console.log("Price provider address:\t\t", priceProvider);
  console.log("Uniswap address:\t\t", uniswapAddr);
  console.log("Celo Gold address:\t\t", celoGoldAddr);
  console.log("Strategy count:\t\t\t", Number(strategyCount));
  console.log("Asset count:\t\t\t", Number(assetCount));
  console.log("Strategist address:\t\t", strategistAddress);

  const assets = [
    {
      symbol: "cUSD",
      address: assetAddresses.CUSD,
      decimals: 18,
    },
    {
      symbol: "cEUR",
      address: assetAddresses.CEUR,
      decimals: 18,
    },
  ];

  const totalValue = await vault.totalValue();
  const balances = {};
  for (const asset of assets) {
    const balance = await vault["checkBalance(address)"](asset.address);
    balances[asset.symbol] = formatUnits(balance.toString(), asset.decimals);
  }

  console.log("\nVault balances");
  console.log("================");
  console.log(
    `totalValue (cUSD):\t $${Number(
      formatUnits(totalValue.toString(), 18)
    ).toFixed(2)}`
  );
  for (const [symbol, balance] of Object.entries(balances)) {
    console.log(`  ${symbol}:\t\t\t ${Number(balance).toFixed(2)}`);
  }

  console.log("\nVault buffer balances");
  console.log("================");

  const vaultBufferBalances = {};
  for (const asset of assets) {
    vaultBufferBalances[asset.symbol] =
      (await (
        await hre.ethers.getContractAt(erc20Abi, asset.address)
      ).balanceOf(vault.address)) /
      (1 * 10 ** asset.decimals);
  }
  for (const [symbol, balance] of Object.entries(vaultBufferBalances)) {
    console.log(`${symbol}:\t\t\t ${balance}`);
  }

  console.log("\nStrategies balances");
  console.log("=====================");
  //
  // Aave Strategy
  //
  for (asset of assets) {
    let balanceRaw = await aaveStrategy.checkBalance(asset.address);
    let balance = formatUnits(balanceRaw.toString(), asset.decimals);
    console.log(`Aave ${asset.symbol}:\t balance=${balance}`);
  }

  //
  // Strategies settings
  //

  console.log("\nDefault strategies");
  console.log("============================");
  for (const asset of assets) {
    console.log(
      asset.symbol,
      `\t${await vault.assetDefaultStrategies(asset.address)}`
    );
  }

  console.log("\nAave strategy settings");
  console.log("============================");
  console.log("vaultAddress:\t\t\t", await aaveStrategy.vaultAddress());
  console.log("platformAddress:\t\t", await aaveStrategy.platformAddress());
  console.log(
    "rewardTokenAddress:\t\t",
    await aaveStrategy.rewardTokenAddress()
  );
  console.log(
    "rewardLiquidationThreshold:\t",
    (await aaveStrategy.rewardLiquidationThreshold()).toString()
  );
  for (const asset of assets) {
    console.log(
      `supportsAsset(${asset.symbol}):\t\t`,
      await aaveStrategy.supportsAsset(asset.address)
    );
  }
}

module.exports = {
  debug,
};
