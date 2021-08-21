/* IMPORTANT these are duplicated in `dapp/src/constants/contractAddresses` changes here should
 * also be done there.
 */

const addresses = {};

// Utility addresses
addresses.zero = "0x0000000000000000000000000000000000000000";
addresses.dead = "0x0000000000000000000000000000000000000001";

addresses.registry = "0x000000000000000000000000000000000000ce10";

addresses.mainnet = {};
// Native stablecoins
// This not binance public address, just some random account with large amount
// of cUSD and cEUR
addresses.mainnet.Binance = "0xF02D85c9b70b8141DC30bE5011cb3C1Aa4B4382e";
addresses.mainnet.CELO = "0x471EcE3750Da237f93B8E339c536989b8978a438";
addresses.mainnet.CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
addresses.mainnet.CEUR = "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73";
addresses.mainnet.UBE = "0x00be915b9dcf56a3cbe739d9b9c202ca692409ec";
addresses.mainnet.MOO = "0x17700282592D6917F6A73D0bF8AcCf4D578c131e";

// AAVE/Moola
addresses.mainnet.AAVE_ADDRESS_PROVIDER =
  "0x7AAaD5a5fa74Aec83b74C2a098FBC86E17Ce4aEA";
addresses.mainnet.Aave = "0xc1548F5AA1D76CDcAB7385FA6B5cEA70f941e535";
addresses.mainnet.mCUSD = "0x64dEFa3544c695db8c535D289d843a189aa26b98";
addresses.mainnet.mCEUR = "0xa8d0E6799FF3Fd19c6459bf02689aE09c4d78Ba7";
addresses.mainnet.mCUSD_mCEUR_Pair =
  "0x27616d3dba43f55279726c422daf644bc60128a8";
// Currently don't have dual staking address 
addresses.mainnet.UBE_DualStaking =
  "abcdabcdabcdabcdabcdabcbdabcadaldkqlkafllf";

// Ubeswap router
addresses.mainnet.uniswapRouter = "0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121";

// Deployed OUSD contracts
addresses.mainnet.VaultProxy = "0x277e80f3E14E7fB3fc40A9d6184088e0241034bD";
addresses.mainnet.Vault = "0xf251Cb9129fdb7e9Ca5cad097dE3eA70caB9d8F9";
addresses.mainnet.OUSDProxy = "0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86";
addresses.mainnet.OUSD = "0xB72b3f5523851C2EB0cA14137803CA4ac7295f3F";

//
// Alfajores
//
addresses.alfajores = {};
addresses.alfajores.CELO = "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9";
addresses.alfajores.CUSD = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";
addresses.alfajores.CEUR = "0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F";

// Ubeswap Address
addresses.alfajores.uniswapRouter =
  "0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121";
addresses.alfajores.mCUSD_mCEUR_Pair =
  "0xD3D03c681f3E4408600a7fd9c7f94c1f942d3A6D";
// addresses.alfajores.UBE_DualStaking =
//   "0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121";

// Aave/Moola
addresses.alfajores.AAVE_ADDRESS_PROVIDER =
  "0x6EAE47ccEFF3c3Ac94971704ccd25C7820121483";
addresses.alfajores.Aave = "0x0886f74eEEc443fBb6907fB5528B57C28E813129";
addresses.alfajores.mCUSD = "0x71DB38719f9113A36e14F409bAD4F07B58b4730b";
addresses.alfajores.mCEUR = "0x32974C7335e649932b5766c5aE15595aFC269160";

module.exports = addresses;
