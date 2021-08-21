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
      CELO: isAlfajores
        ? addresses.alfajores.CELO
        : (await deployments.get("MockCELO")).address,
      CUSD: isAlfajores
        ? addresses.alfajores.CUSD
        : (await deployments.get("MockCUSD")).address,
      CEUR: isAlfajores
        ? addresses.alfajores.CEUR
        : (await deployments.get("MockCEUR")).address,
      NonStandardToken: (await deployments.get("MockNonStandardToken")).address,
      mCUSD: isAlfajores
        ? addresses.alfajores.mCUSD
        : (await deployments.get("MockMCUSD")).address,
      mCEUR: isAlfajores
        ? addresses.alfajores.mCEUR
        : (await deployments.get("MockMCEUR")).address,
      AAVE: isAlfajores
        ? addresses.alfajores.AAVE
        : (await deployments.get("MockAave")).address,
      AAVE_ADDRESS_PROVIDER: isAlfajores
        ? addresses.alfajores.AAVE_ADDRESS_PROVIDER
        : (await deployments.get("MockAave")).address,
      // OGN: isAlfajores
      //   ? addresses.alfajores.OGN
      //   : (await deployments.get("MockOGN")).address,
      UBE: (await deployments.get("MockUBE")).address,
      MOO: (await deployments.get("MockMOO")).address,
      uniswapRouter: isAlfajores
        ? addresses.alfajores.uniswapRouter
        : (await deployments.get("MockUniswapRouter")).address,
      UBEmCUSDmCEURPair: (await deployments.get("MockMCUSDMEURLPToken"))
        .address,
      UBEStaking: (await deployments.get("MockUbeStaking")).address,
    };
  }
};

module.exports = {
  getAssetAddresses,
};
