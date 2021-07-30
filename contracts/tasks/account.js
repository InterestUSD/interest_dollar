const cusdAbi = require("../test/abi/erc20.json");
const ceurAbi = require("../test/abi/erc20.json");

// By default we use 10 test accounts.
const defaultNumAccounts = 10;

// The first 4 hardhat accounts are reserved for use as the deployer, governor, etc...
const defaultAccountIndex = 4;

// By default, fund each test account with 10k worth of each stable coin.
const defaultFundAmount = 10000;

// By default, mint 1k worth of OUSD for each test account.
const defaultMintAmount = 1000;

// By default, redeem 1k worth of OUSD for each test account.
const defaultRedeemAmount = 1000;

// By default, cUSD will be used
const defaultStableToken = "cusd";

/**
 * Prints test accounts.
 */
async function accounts(taskArguments, hre, privateKeys) {
  const accounts = await hre.ethers.getSigners();
  const roles = ["Deployer", "Governor"];

  const isMainnetOrAlfajores = ["mainnet", "alfajores"].includes(
    hre.network.name
  );
  if (isMainnetOrAlfajores) {
    privateKeys = [process.env.DEPLOYER_PK, process.env.GOVERNOR_PK];
  }

  let i = 0;
  for (const account of accounts) {
    const role = roles.length > i ? `[${roles[i]}]` : "";
    const address = await account.getAddress();
    console.log(address, privateKeys[i], role);
    if (!address) {
      throw new Error(`No address defined for role ${role}`);
    }
    i++;
  }
}

/**
 * Funds test accounts on local or fork with cUSD, cEUR.
 */
async function fund(taskArguments, hre) {
  const addresses = require("../utils/addresses");
  const {
    cusdUnits,
    ceurUnits,
    isFork,
    isLocalhost,
  } = require("../test/helpers");

  if (!isFork && !isLocalhost) {
    throw new Error("Task can only be used on local or fork");
  }

  let cusd, ceur;
  if (isFork) {
    cusd = await hre.ethers.getContractAt(cusdAbi, addresses.mainnet.CUSD);
    ceur = await hre.ethers.getContractAt(ceurAbi, addresses.mainnet.CEUR);
  } else {
    cusd = await hre.ethers.getContract("MockCUSD");
    ceur = await hre.ethers.getContract("MockCEUR");
  }

  let binanceSigner;
  const signers = await hre.ethers.getSigners();

  if (isFork) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.mainnet.Binance],
    });
    binanceSigner = await hre.ethers.provider.getSigner(
      addresses.mainnet.Binance
    );
  }

  const numAccounts = Number(taskArguments.num) || defaultNumAccounts;
  const accountIndex = Number(taskArguments.account) || defaultAccountIndex;
  const fundAmount = taskArguments.amount || defaultFundAmount;

  console.log(`cUSD: ${cusd.address}`);
  console.log(`cEUR: ${ceur.address}`);

  for (let i = accountIndex; i < accountIndex + numAccounts; i++) {
    const signer = signers[i];
    const address = signer.address;
    console.log(`Funding account ${i} at address ${address}`);
    if (isFork) {
      await cusd
        .connect(binanceSigner)
        .transfer(address, cusdUnits(fundAmount));
    } else {
      await cusd.connect(signer).mint(cusdUnits(fundAmount));
    }
    console.log(`  Funded with ${fundAmount} cUSD`);
    if (isFork) {
      await ceur
        .connect(binanceSigner)
        .transfer(address, ceurUnits(fundAmount));
    } else {
      await ceur.connect(signer).mint(ceurUnits(fundAmount));
    }
    console.log(`  Funded with ${fundAmount} cEUR`);
  }
}

/**
 * Mints OUSD using cUSD on local or fork.
 */
async function mint(taskArguments, hre) {
  const addresses = require("../utils/addresses");
  const { cusdUnits, isFork, isLocalhost } = require("../test/helpers");

  if (!isFork && !isLocalhost) {
    throw new Error("Task can only be used on local or fork");
  }

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);

  let cusd, ceur;
  if (isFork) {
    cusd = await hre.ethers.getContractAt(cusdAbi, addresses.mainnet.CUSD);
    ceur = await hre.ethers.getContractAt(ceurAbi, addresses.mainnet.CEUR);
  } else {
    cusd = await hre.ethers.getContract("MockCUSD");
    ceur = await hre.ethers.getContract("MockCEUR");
  }

  const numAccounts = Number(taskArguments.num) || defaultNumAccounts;
  const accountIndex = Number(taskArguments.index) || defaultAccountIndex;
  const mintAmount = taskArguments.amount || defaultMintAmount;
  const stableToken = taskArguments.stable || defaultStableToken;

  const signers = await hre.ethers.getSigners();
  for (let i = accountIndex; i < accountIndex + numAccounts; i++) {
    const signer = signers[i];
    const address = signer.address;
    const stable = stableToken === "ceur" ? ceur : cusd;
    console.log(
      `Minting OUSD with ${mintAmount} ${stableToken} for account ${i} at address ${address}`
    );

    // Ensure the account has sufficient cUSD balance to cover the mint.
    const stableBalance = await stable.balanceOf(address);
    if (stableBalance.lt(cusdUnits(mintAmount))) {
      throw new Error(
        `Account ${stableToken} balance (${stableBalance}) insufficient to mint the requested amount`
      );
    }

    // Mint.
    await stable
      .connect(signer)
      .approve(vault.address, cusdUnits(mintAmount), { gasLimit: 1000000 });
    await vault
      .connect(signer)
      .mint(stable.address, cusdUnits(mintAmount), 0, { gasLimit: 2000000 });

    // Show new account's balance.
    const ousdBalance = await ousd.balanceOf(address);
    console.log(
      "New OUSD balance=",
      hre.ethers.utils.formatUnits(ousdBalance, 18)
    );
  }
}

/**
 * Redeems OUSD on local or fork.
 */
async function redeem(taskArguments, hre) {
  const addresses = require("../utils/addresses");
  const {
    ousdUnits,
    ousdUnitsFormat,
    cusdUnitsFormat,
    ceurUnitsFormat,
    isFork,
    isLocalhost,
  } = require("../test/helpers");

  if (!isFork && !isLocalhost) {
    throw new Error("Task can only be used on local or fork");
  }

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);

  let cusd, ceur;
  if (isFork) {
    cusd = await hre.ethers.getContractAt(cusdAbi, addresses.mainnet.CUSD);
    ceur = await hre.ethers.getContractAt(ceurAbi, addresses.mainnet.CEUR);
  } else {
    cusd = await hre.ethers.getContract("MockCUSD");
    ceur = await hre.ethers.getContract("MockCEUR");
  }

  const numAccounts = Number(taskArguments.num) || defaultNumAccounts;
  const accountIndex = Number(taskArguments.index) || defaultAccountIndex;
  const redeemAmount = taskArguments.amount || defaultRedeemAmount;

  const signers = await hre.ethers.getSigners();
  for (let i = accountIndex; i < accountIndex + numAccounts; i++) {
    const signer = signers[i];
    const address = signer.address;
    console.log(
      `Redeeming ${redeemAmount} OUSD for account ${i} at address ${address}`
    );

    // Show the current balances.
    let ousdBalance = await ousd.balanceOf(address);
    let cusdBalance = await cusd.balanceOf(address);
    let ceurBalance = await ceur.balanceOf(address);

    console.log("OUSD balance=", ousdUnitsFormat(ousdBalance, 18));
    console.log("cUSD balance=", cusdUnitsFormat(cusdBalance, 18));
    console.log("cEUR balance=", ceurUnitsFormat(ceurBalance, 18));

    // Redeem.
    await vault
      .connect(signer)
      .redeem(ousdUnits(redeemAmount), 0, { gasLimit: 2000000 });

    // Show the new balances.
    ousdBalance = await ousd.balanceOf(address);
    cusdBalance = await cusd.balanceOf(address);
    ceurBalance = await ceur.balanceOf(address);
    console.log("New OUSD balance=", ousdUnitsFormat(ousdBalance, 18));
    console.log("New cUSD balance=", cusdUnitsFormat(cusdBalance, 18));
    console.log("New cEUR balance=", ceurUnitsFormat(ceurBalance, 18));
  }
}

// Sends OUSD to a destination address.
async function transfer(taskArguments) {
  const {
    ousdUnits,
    ousdUnitsFormat,
    isFork,
    isLocalHost,
  } = require("../test/helpers");

  if (!isFork && !isLocalHost) {
    throw new Error("Task can only be used on local or fork");
  }

  const ousdProxy = await ethers.getContract("OUSDProxy");
  const ousd = await ethers.getContractAt("OUSD", ousdProxy.address);

  const index = Number(taskArguments.index);
  const amount = taskArguments.amount;
  const to = taskArguments.to;

  const signers = await hre.ethers.getSigners();
  const signer = signers[index];

  // Print balances prior to the transfer
  console.log("\nOUSD balances prior transfer");
  console.log(
    `${signer.address}: ${ousdUnitsFormat(
      await ousd.balanceOf(signer.address)
    )} OUSD`
  );
  console.log(`${to}: ${ousdUnitsFormat(await ousd.balanceOf(to))} OUSD`);

  // Send OUSD.
  console.log(
    `\nTransferring ${amount} OUSD from ${signer.address} to ${to}...`
  );
  await ousd.connect(signer).transfer(to, ousdUnits(amount));

  // Print balances after to the transfer
  console.log("\nOUSD balances after transfer");
  console.log(
    `${signer.address}: ${ousdUnitsFormat(
      await ousd.balanceOf(signer.address)
    )} OUSD`
  );
  console.log(`${to}: ${ousdUnitsFormat(await ousd.balanceOf(to))} OUSD`);
}

module.exports = {
  accounts,
  fund,
  mint,
  redeem,
  transfer,
};
