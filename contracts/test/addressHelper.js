const addresses = require("../utils/addresses");

const getAssetAddresses = async (hre, deployments) => {
  const isFork = process.env.FORK === "true";
  const isMainnet = hre.network.name === "mainnet";
  const isMainnetOrFork = isMainnet || isFork;
  const isAlfajores = hre.network.name === "alfajores";

  if (isMainnetOrFork) {
    return {
      CELO: addresses.mainnet.CELO,
      CUSD: addresses.mainnet.CUSD,
      CEUR: addresses.mainnet.CEUR,
      mCUSD: addresses.mainnet.mCUSD,
      mCEUR: addresses.mainnet.mCEUR,
      AAVE: addresses.mainnet.Aave,
      AAVE_ADDRESS_PROVIDER: addresses.mainnet.AAVE_ADDRESS_PROVIDER,
      UBE: addresses.mainnet.UBE,
      uniswapRouter: addresses.mainnet.uniswapRouter,
      MOO: addresses.mainnet.MOO,
      UBEStaking: addresses.zero,
    };
  } else {
    return {
      CELO: (await deployments.get("MockCELO")).address,
      CUSD: (await deployments.get("MockCUSD")).address,
      CEUR: (await deployments.get("MockCEUR")).address,
      NonStandardToken: (await deployments.get("MockNonStandardToken")).address,
      mCUSD: (await deployments.get("MockMCUSD")).address,
      mCEUR: (await deployments.get("MockMCEUR")).address,
      AAVE: (await deployments.get("MockAave")).address,
      AAVE_ADDRESS_PROVIDER: (await deployments.get("MockAave")).address,
      // OGN: isAlfajores
      //   ? addresses.alfajores.OGN
      //   : (await deployments.get("MockOGN")).address,
      UBE: (await deployments.get("MockUBE")).address,
      uniswapRouter: (await deployments.get("MockUniswapRouter")).address,
      MOO: (await deployments.get("MockMOO")).address,
      MOO_LP: (await deployments.get("MockMCUSDMEURLPToken")).address,
      UBEStaking: (await deployments.get("MockUbeStaking")).address,
    };
  }
};

module.exports = {
  getAssetAddresses,
};
