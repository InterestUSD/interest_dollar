const hre = require("hardhat");
const { utils } = require("ethers");

const addresses = require("./addresses");
const daiAbi = require("../test/abi/dai.json").abi;
const usdtAbi = require("../test/abi/usdt.json").abi;
const tusdAbi = require("../test/abi/erc20.json");
const usdcAbi = require("../test/abi/erc20.json");
const ognAbi = require("../test/abi/erc20.json");

const { cusdUnits, isFork } = require("../test/helpers");

const fundAccounts = async () => {
  let cusd, ceur, nonStandardToken;
  if (isFork) {
    cusd = await ethers.getContractAt(usdtAbi, addresses.mainnet.CUSD);
    ceur = await ethers.getContractAt(daiAbi, addresses.mainnet.CEUR);
  } else {
    cusd = await ethers.getContract("MockCUSD");
    ceur = await ethers.getContract("MockCEUR");
    nonStandardToken = await ethers.getContract("MockNonStandardToken");
  }

  let binanceSigner;
  const signers = await hre.ethers.getSigners();
  const { governorAddr } = await getNamedAccounts();

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    binanceSigner = await ethers.provider.getSigner(addresses.mainnet.Binance);
    // Send some Ethereum to Governor
    await binanceSigner.sendTransaction({
      to: governorAddr,
      value: utils.parseEther("100"),
    });
  }

  for (let i = 0; i < 10; i++) {
    if (isFork) {
      await cusd
        .connect(binanceSigner)
        .transfer(await signers[i].getAddress(), cusdUnits("1000"));
      await ceur
        .connect(binanceSigner)
        .transfer(await signers[i].getAddress(), cusdUnits("1000"));
    } else {
      await cusd.connect(signers[i]).mint(cusdUnits("1000"));
      await ceur.connect(signers[i]).mint(cusdUnits("1000"));
      await nonStandardToken.connect(signers[i]).mint(cusdUnits("1000"));
    }
  }

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [addresses.mainnet.Binance],
    });
  }
};

module.exports = fundAccounts;
