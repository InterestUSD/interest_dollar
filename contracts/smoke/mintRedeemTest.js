const { fund, mint } = require("../tasks/account");
const {
  cusdUnits,
  ceurUnits,
  ousdUnits,
  ousdUnitsFormat,
  isWithinTolerance,
} = require("../test/helpers");
const addresses = require("../utils/addresses");
const erc20Abi = require("../test/abi/erc20.json");

let utils, BigNumber, cusd, ceur, ousd, vault, signer, signer2;

async function fundAccount4(hre) {
  await fund(
    {
      num: 1,
      amount: "3000",
    },
    hre
  );
}

const getcusdBalance = async () => {
  return await cusd.connect(signer).balanceOf(signer.address);
};

const getceurBalance = async () => {
  return await ceur.connect(signer).balanceOf(signer.address);
};

const getOusdBalance = async (signer) => {
  return await ousd.connect(signer).balanceOf(signer.address);
};

const assertExpectedOusd = (bigNumber, bigNumberExpected, tolerance = 0.03) => {
  if (!isWithinTolerance(bigNumber, bigNumberExpected, 0.03)) {
    throw new Error(
      `Unexpected OUSD value. Expected ${ousdUnitsFormat(
        bigNumberExpected
      )} with the tolerance of ${tolerance}. Received: ${ousdUnitsFormat(
        bigNumber
      )}`
    );
  }
};

const assertExpectedStablecoins = (
  cusdBn,
  ceurBn,
  unitsExpected,
  tolerance = 0.03
) => {
  // adjust decimals of all stablecoins to 18 so they are easier to compare
  const allStablecoins = ceurBn.add(cusdBn);
  const stableCoinsExpected = utils.parseUnits(unitsExpected, 18);

  if (!isWithinTolerance(allStablecoins, stableCoinsExpected, 0.03)) {
    throw new Error(
      `Unexpected value. Expected to receive total stablecoin units ${ousdUnitsFormat(
        stableCoinsExpected
      )} with the tolerance of ${tolerance}. Received: ${ousdUnitsFormat(
        allStablecoins
      )}`
    );
  }
};

async function setup(hre) {
  utils = hre.ethers.utils;
  BigNumber = hre.ethers.BigNumber;
  ousd = await hre.ethers.getContractAt("OUSD", addresses.mainnet.OUSDProxy);
  cusd = await hre.ethers.getContractAt(erc20Abi, addresses.mainnet.CUSD);
  ceur = await hre.ethers.getContractAt(erc20Abi, addresses.mainnet.CEUR);
  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  vault = await ethers.getContractAt("IVault", vaultProxy.address);
  signer = (await hre.ethers.getSigners())[4];
  signer2 = (await hre.ethers.getSigners())[5];

  await fundAccount4(hre);
}

async function beforeDeploy(hre) {
  // fund stablecoins to the 4th account in signers
  await setup(hre);

  const cusdBeforeMint = await getcusdBalance();
  const ousdBeforeMint = await getOusdBalance(signer);
  const cusdToMint = "1100";
  await mint(
    {
      num: 1,
      amount: cusdToMint,
    },
    hre
  );

  const cusdAfterMint = await getcusdBalance();
  const ousdAfterMint = await getOusdBalance(signer);

  const expectedCusd = cusdBeforeMint.sub(cusdUnits(cusdToMint));
  if (!cusdAfterMint.eq(expectedCusd)) {
    throw new Error(
      `Incorrect cusd value. Got ${cusdAfterMint.toString()} expected: ${expectedCusd.toString()}`
    );
  }

  const expectedOusd = ousdBeforeMint.add(ousdUnits(usdtToMint));
  assertExpectedOusd(ousdAfterMint, expectedOusd);

  return {
    ousdBeforeMint,
    ousdAfterMint,
  };
}

const testMint = async (hre, beforeDeployData) => {
  const ousdBeforeMint = await getOusdBalance(signer);
  await mint(
    {
      num: 1,
      amount: "500",
    },
    hre
  );

  const ousdAfterMint = await getOusdBalance(signer);

  if (!beforeDeployData.ousdAfterMint.eq(ousdBeforeMint)) {
    throw new Error(
      `Deploy changed the amount of ousd in user's account from ${ousdUnitsFormat(
        beforeDeployData.ousdAfterMint
      )} to ${ousdUnitsFormat(ousdBeforeMint)}`
    );
  }

  return ousdAfterMint;
};

const testRedeem = async (ousdAfterMint) => {
  const cusdBeforeRedeem = await getcusdBalance();
  const ceurBeforeRedeem = await getceurBalance();

  const unitsToRedeem = "800";
  const ousdToRedeem = ousdUnits(unitsToRedeem);
  await vault.connect(signer).redeem(ousdToRedeem, ousdUnits("770"));

  const ousdAfterRedeem = await getOusdBalance(signer);
  const cusdAfterRedeem = await getcusdBalance();
  const ceurAfterRedeem = await getceurBalance();

  const expectedOusd = ousdAfterMint.sub(ousdToRedeem);
  assertExpectedOusd(ousdAfterRedeem, expectedOusd, 0.0);

  assertExpectedStablecoins(
    cusdAfterRedeem.sub(cusdBeforeRedeem),
    ceurAfterRedeem.sub(ceurBeforeRedeem),
    "800"
  );
};

const testTransfer = async () => {
  const ousdSenderBeforeSend = await getOusdBalance(signer);
  const ousdReceiverBeforeSend = await getOusdBalance(signer2);
  const ousdToTransfer = "245.5";

  await ousd
    .connect(signer)
    .transfer(signer2.address, ousdUnits(ousdToTransfer));

  const ousdSenderAfterSend = await getOusdBalance(signer);
  const ousdReceiverAfterSend = await getOusdBalance(signer2);

  assertExpectedOusd(
    ousdSenderAfterSend,
    ousdSenderBeforeSend.sub(ousdUnits(ousdToTransfer)),
    0.0
  );
  assertExpectedOusd(
    ousdReceiverAfterSend,
    ousdReceiverBeforeSend.add(ousdUnits(ousdToTransfer)),
    0.0
  );
};

const testMultipleMint = async () => {
  const amountToMint = "100";
  await ceur
    .connect(signer)
    .approve(vault.address, ceurUnits(amountToMint), { gasLimit: 1000000 });
  await cusd
    .connect(signer)
    .approve(vault.address, cusdUnits(amountToMint), { gasLimit: 1000000 });

  const ousdBalanceBeforeMint = await getOusdBalance(signer);
  await vault
    .connect(signer)
    .mintMultiple(
      [ceur.address, cusd.address],
      [ceurUnits(amountToMint), cusdUnits(amountToMint)],
      291,
      { gasLimit: 2000000 }
    );

  const ousdBalanceAfterMint = await getOusdBalance(signer);
  assertExpectedOusd(
    ousdBalanceAfterMint,
    ousdBalanceBeforeMint.add(ousdUnits(amountToMint).mul(BigNumber.from(3))),
    0.0
  );
};

async function afterDeploy(hre, beforeDeployData) {
  const ousdAfterMint = await testMint(hre, beforeDeployData);
  await testRedeem(ousdAfterMint);
  await testTransfer();
  await testMultipleMint();
}

module.exports = {
  beforeDeploy,
  afterDeploy,
};
