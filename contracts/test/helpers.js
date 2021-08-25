const hre = require("hardhat");
const chai = require("chai");
const { parseUnits, formatUnits } = require("ethers").utils;
const BigNumber = require("ethers").BigNumber;
const { createFixtureLoader } = require("ethereum-waffle");
const { getAssetAddresses: gAsset } = require("./addressHelper");

const addresses = require("../utils/addresses");

chai.Assertion.addMethod("approxEqual", function (expected, message) {
  const actual = this._obj;
  chai.expect(actual, message).gte(expected.mul("99999").div("100000"));
  chai.expect(actual, message).lte(expected.mul("100001").div("100000"));
});

chai.Assertion.addMethod("approxBalanceOf", async function (
  expected,
  contract,
  message
) {
  var user = this._obj;
  var address = user.address || user.getAddress(); // supports contracts too
  const actual = await contract.balanceOf(address);
  expected = parseUnits(expected, await decimalsFor(contract));
  chai.expect(actual).to.approxEqual(expected, message);
});

chai.Assertion.addMethod("balanceOf", async function (
  expected,
  contract,
  message
) {
  var user = this._obj;
  var address = user.address || user.getAddress(); // supports contracts too
  const actual = await contract.balanceOf(address);
  expected = parseUnits(expected, await decimalsFor(contract));
  chai.expect(actual).to.equal(expected, message);
});

const DECIMAL_CACHE = {};
async function decimalsFor(contract) {
  if (DECIMAL_CACHE[contract.address] != undefined) {
    return DECIMAL_CACHE[contract.address];
  }
  let decimals = await contract.decimals();
  if (decimals.toNumber) {
    decimals = decimals.toNumber();
  }
  DECIMAL_CACHE[contract.address] = decimals;
  return decimals;
}

async function units(amount, contract) {
  return parseUnits(amount.toString(), await decimalsFor(contract));
}

// function ognUnits(amount) {
//   return parseUnits(amount.toString(), 18);
// }

function ousdUnits(amount) {
  return parseUnits(amount.toString(), 18);
}

function ousdUnitsFormat(amount) {
  return formatUnits(amount, 18);
}

function ceurUnits(amount) {
  return parseUnits(amount.toString(), 18);
}

function ceurUnitsFormat(amount) {
  return formatUnits(amount, 18);
}

function cusdUnits(amount) {
  return parseUnits(amount.toString(), 18);
}

function cusdUnitsFormat(amount) {
  return formatUnits(amount, 18);
}

function goldUnits(amount) {
  return parseUnits(amount.toString(), 18);
}

function oracleUnits(amount) {
  return parseUnits(amount.toString(), 18);
}

async function expectApproxSupply(contract, expected, message) {
  const balance = await contract.totalSupply();
  // shortcuts the 0 case, since that's neither gt or lt
  if (balance.eq(expected)) {
    return;
  }
  chai.expect(balance, message).gt(expected.mul("999").div("1000"));
  chai.expect(balance, message).lt(expected.mul("1001").div("1000"));
}

async function humanBalance(user, contract) {
  let address = user.address || user.getAddress(); // supports contracts too
  const balance = await contract.balanceOf(address);
  const decimals = await decimalsFor(contract);
  const divisor = BigNumber.from("10").pow(decimals);
  return parseFloat(balance.div(divisor).toString()).toFixed(2);
}

const isFork = process.env.FORK === "true";
const isLocalhost = !isFork && hre.network.name === "localhost";
const isAlfajores = hre.network.name === "alfajores";
const isMainnet = hre.network.name === "mainnet";
const isTest = process.env.IS_TEST === "true";
const isSmokeTest = process.env.SMOKE_TEST === "true";
const isMainnetOrFork = isMainnet || isFork;
const isMainnetOrAlfajoresOrFork = isMainnetOrFork || isAlfajores;

// Fixture loader that is compatible with Ganache
const loadFixture = createFixtureLoader(
  [
    hre.ethers.provider.getSigner(0),
    hre.ethers.provider.getSigner(1),
    hre.ethers.provider.getSigner(2),
    hre.ethers.provider.getSigner(3),
    hre.ethers.provider.getSigner(4),
    hre.ethers.provider.getSigner(5),
    hre.ethers.provider.getSigner(6),
    hre.ethers.provider.getSigner(7),
    hre.ethers.provider.getSigner(8),
    hre.ethers.provider.getSigner(9),
  ],
  hre.ethers.provider
);

const advanceTime = async (seconds) => {
  await hre.ethers.provider.send("evm_increaseTime", [seconds]);
  await hre.ethers.provider.send("evm_mine");
};

const advanceBlocks = async (numBlocks) => {
  for (let i = 0; i < numBlocks; i++) {
    await hre.ethers.provider.send("evm_mine");
  }
};

const getOracleAddress = async (deployments) => {
  return (await deployments.get("OracleRouter")).address;
};

/**
 * Sets the price in USD the oracle will return for a specific token.
 *
 * @param {string} token: token address
 * @param {number} cusdPrice: price of the token in cUSD.
 * @returns {Promise<void>}
 */
const setOracleTokenPriceCusd = async (tokenAddr, cusdPrice) => {
  if (isMainnetOrFork) {
    throw new Error(
      `setOracleTokenPriceCusd not supported on network ${hre.network.name}`
    );
  }
  // Set the oracle token price in cUSD, with 18 decimals.
  const oracle = await ethers.getContract("OracleRouter");
  await oracle.setPrice(tokenAddr, cusdUnits(cusdPrice));
};

const getOracleAddresses = async (deployments) => {
  if (isMainnetOrFork) {
    // On mainnet or fork, return mainnet addresses.
    return {
      chainlink: {
        ETH_USD: addresses.mainnet.chainlinkETH_USD,
        DAI_USD: addresses.mainnet.chainlinkDAI_USD,
        USDC_USD: addresses.mainnet.chainlinkUSDC_USD,
        USDT_USD: addresses.mainnet.chainlinkUSDT_USD,
      },
      openOracle: addresses.mainnet.openOracle, // Depreciated
    };
  } else {
    // On other environments, return mock feeds.
    return {
      chainlink: {
        DAI_USD: (await deployments.get("MockChainlinkOracleFeedDAI")).address,
        USDC_USD: (await deployments.get("MockChainlinkOracleFeedUSDC"))
          .address,
        USDT_USD: (await deployments.get("MockChainlinkOracleFeedUSDT"))
          .address,
        TUSD_USD: (await deployments.get("MockChainlinkOracleFeedTUSD"))
          .address,
        NonStandardToken_USD: (
          await deployments.get("MockChainlinkOracleFeedNonStandardToken")
        ).address,
      },
    };
  }
};

const getAssetAddresses = async (deployments) => {
  return await gAsset(hre, deployments);
};

/**
 * Is first parameter's BigNumber value inside expected tolerance
 * @param {BigNumber} bigNumber: The BigNumber whose value is being inspected
 * @param {BigNumber} bigNumberExpected: Expected value of the first BigNumber
 * @param {Float} tolerance: Tolerance expressed in percentages. E.g. 0.05 equals 5%
 *
 * @returns {boolean}
 */
function isWithinTolerance(bigNumber, bigNumberExpected, tolerance) {
  const bgTolerance = bigNumberExpected
    .mul(tolerance * 1000)
    .div(BigNumber.from(1000));
  const lowestAllowed = bigNumberExpected.sub(bgTolerance);
  const highestAllowed = bigNumberExpected.add(bgTolerance);

  return bigNumber.gte(lowestAllowed) && bigNumber.lte(highestAllowed);
}

async function governorArgs({ contract, signature, args = [] }) {
  const method = signature.split("(")[0];
  const tx = await contract.populateTransaction[method](...args);
  const data = "0x" + tx.data.slice(10);
  return [tx.to, signature, data];
}

async function proposeArgs(governorArgsArray) {
  const targets = [],
    sigs = [],
    datas = [];
  for (const g of governorArgsArray) {
    const [t, s, d] = await governorArgs(g);
    targets.push(t);
    sigs.push(s);
    datas.push(d);
  }
  return [targets, sigs, datas];
}

async function propose(fixture, governorArgsArray, description) {
  const { governorContract, governor } = fixture;
  const lastProposalId = await governorContract.proposalCount();
  await governorContract
    .connect(governor)
    .propose(...(await proposeArgs(governorArgsArray)), description);
  const proposalId = await governorContract.proposalCount();
  chai.expect(proposalId).not.to.be.equal(lastProposalId);
  return proposalId;
}

async function proposeAndExecute(fixture, governorArgsArray, description) {
  const { governorContract, governor } = fixture;
  const proposalId = await propose(fixture, governorArgsArray, description);
  await governorContract.connect(governor).queue(proposalId);
  // go forward 3 days
  await advanceTime(3 * 24 * 60 * 60);
  await governorContract.connect(governor).execute(proposalId);
}

module.exports = {
  ousdUnits,
  cusdUnits,
  ceurUnits,
  // ognUnits,
  goldUnits,
  oracleUnits,
  units,
  ousdUnitsFormat,
  cusdUnitsFormat,
  ceurUnitsFormat,
  humanBalance,
  expectApproxSupply,
  advanceTime,
  isMainnet,
  isAlfajores,
  isFork,
  isTest,
  isSmokeTest,
  isLocalhost,
  isMainnetOrFork,
  isMainnetOrAlfajoresOrFork,
  loadFixture,
  getOracleAddress,
  setOracleTokenPriceCusd,
  getOracleAddresses,
  getAssetAddresses,
  governorArgs,
  proposeArgs,
  propose,
  proposeAndExecute,
  advanceBlocks,
  isWithinTolerance,
};
