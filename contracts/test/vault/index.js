const { defaultFixture, multiStrategyVaultFixture } = require("../_fixture");
const chai = require("chai");
const hre = require("hardhat");
const { solidity } = require("ethereum-waffle");
const { utils } = require("ethers");

const {
  ousdUnits,
  ceurUnits,
  usdcUnits,
  cusdUnits,
  tusdUnits,
  loadFixture,
  getOracleAddresses,
  isFork,
  setOracleTokenPriceCusd,
} = require("../helpers");

// Support BigNumber and all that with ethereum-waffle
chai.use(solidity);
const expect = chai.expect;

describe("Vault", function () {
  if (isFork) {
    this.timeout(0);
  }

  it("Should support an asset", async () => {
    const { vault, oracleRouter, ousd, governor } = await loadFixture(
      defaultFixture
    );
    const origAssetCount = await vault.connect(governor).getAssetCount();
    expect(await vault.isSupportedAsset(ousd.address)).to.be.false;
    await oracleRouter.setPrice(ousd.address, cusdUnits("1"));
    await expect(vault.connect(governor).supportAsset(ousd.address)).to.emit(
      vault,
      "AssetSupported"
    );
    expect(await vault.getAssetCount()).to.equal(origAssetCount.add(1));
    const assets = await vault.connect(governor).getAllAssets();
    expect(assets.length).to.equal(origAssetCount.add(1));
    expect(await vault["checkBalance(address)"](ousd.address)).to.equal(0);
    expect(await vault.isSupportedAsset(ousd.address)).to.be.true;
  });

  it("Should revert when adding an asset that is already supported", async function () {
    const { vault, cusd, governor } = await loadFixture(defaultFixture);
    expect(await vault.isSupportedAsset(cusd.address)).to.be.true;
    await expect(
      vault.connect(governor).supportAsset(cusd.address)
    ).to.be.revertedWith("Asset already supported");
  });

  it("Should revert when attempting to support an asset and not governor", async function () {
    const { vault, cusd } = await loadFixture(defaultFixture);
    await expect(vault.supportAsset(cusd.address)).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should revert when adding a strategy that is already approved", async function () {
    const { vault, governor, aaveStrategy } = await loadFixture(defaultFixture);
    await vault.connect(governor).approveStrategy(aaveStrategy.address);
    await expect(
      vault.connect(governor).approveStrategy(aaveStrategy.address)
    ).to.be.revertedWith("Strategy already approved");
  });

  it("Should revert when attempting to approve a strategy and not Governor", async function () {
    const { vault, josh, aaveStrategy } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(josh).approveStrategy(aaveStrategy.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  // //
  // // NOTE: We don't have currenies of different decimals as cUSD and cEUR have same decimals
  // //
  // it("Should correctly ratio deposited currencies of differing decimals", async function () {
  //   const { ousd, vault, usdc, ceur, matt } = await loadFixture(defaultFixture);

  //   await expect(matt).has.a.balanceOf("100.00", ousd);

  //   // Matt deposits USDC, 6 decimals
  //   await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
  //   await vault.connect(matt).mint(usdc.address, usdcUnits("2.0"), 0);
  //   await expect(matt).has.a.balanceOf("102.00", ousd);

  //   // Matt deposits ceur, 18 decimals
  //   await ceur.connect(matt).approve(vault.address, ceurUnits("4.0"));
  //   await vault.connect(matt).mint(ceur.address, ceurUnits("4.0"), 0);
  //   await expect(matt).has.a.balanceOf("106.00", ousd);
  // });

  it("Should correctly handle a deposit of ceur (18 decimals)", async function () {
    const { ousd, vault, ceur, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await setOracleTokenPriceCusd(ceur.address, "1.30");
    await ceur.connect(anna).approve(vault.address, ceurUnits("3.0"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("3.0"), 0);
    await expect(anna).has.a.balanceOf("3.90", ousd);
  });

  // it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
  //   const { ousd, vault, usdc, anna } = await loadFixture(defaultFixture);
  //   await expect(anna).has.a.balanceOf("0.00", ousd);
  //   await setOracleTokenPriceUsd("USDC", "0.96");
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
  //   await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
  //   await expect(anna).has.a.balanceOf("48.00", ousd);

  it("Should correctly handle a deposit failure of Non-Standard ERC20 Token", async function () {
    const { ousd, vault, anna, nonStandardToken, governor } = await loadFixture(
      defaultFixture
    );

    await vault.connect(governor).supportAsset(nonStandardToken.address);

    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    await setOracleTokenPriceCusd(nonStandardToken.address, "1.30");
    await nonStandardToken
      .connect(anna)
      .approve(vault.address, cusdUnits("1500.0"));

    // Anna has a balance of 1000 tokens and she is trying to
    // transfer 1500 tokens. The contract doesn't throw but
    // fails silently, so Anna's OUSD balance should be zero.
    try {
      await vault
        .connect(anna)
        .mint(nonStandardToken.address, cusdUnits("1500.0"), 0);
    } catch (err) {
      expect(
        /SafeERC20: ERC20 operation did not succeed/gi.test(err.message)
      ).to.be.true;
    } finally {
      // Make sure nothing got affected
      await expect(anna).has.a.balanceOf("0.00", ousd);
      await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    }
  });

  it("Should correctly handle a deposit of Non-Standard ERC20 Token", async function () {
    const { ousd, vault, anna, nonStandardToken, governor } = await loadFixture(
      defaultFixture
    );
    await vault.connect(governor).supportAsset(nonStandardToken.address);

    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);
    await setOracleTokenPriceCusd(nonStandardToken.address, "1.00");

    await nonStandardToken
      .connect(anna)
      .approve(vault.address, cusdUnits("100.0"));
    await vault
      .connect(anna)
      .mint(nonStandardToken.address, cusdUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("100.00", ousd);
    await expect(anna).has.a.balanceOf("900.00", nonStandardToken);
  });

  it("Should calculate the balance correctly with ceur", async () => {
    const { vault } = await loadFixture(defaultFixture);
    // Vault already has ceur from default ficture
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("200", 18)
    );
  });

  // it("Should calculate the balance correctly with USDC", async () => {
  //   const { vault, usdc, matt } = await loadFixture(defaultFixture);

  //   // Matt deposits USDC, 6 decimals
  //   await usdc.connect(matt).approve(vault.address, usdcUnits("2.0"));
  //   await vault.connect(matt).mint(usdc.address, usdcUnits("2.0"), 0);
  //   // Fixture loads 200 ceur, so result should be 202
  //   await expect(await vault.totalValue()).to.equal(utils.parseUnits("202", 18));
  // });

  it("Should calculate the balance correctly with cusd", async () => {
    const { vault, cusd, matt } = await loadFixture(defaultFixture);

    // Matt deposits cusd, 18 decimals
    await cusd.connect(matt).approve(vault.address, cusdUnits("5.0"));
    await vault.connect(matt).mint(cusd.address, cusdUnits("5.0"), 0);
    // Fixture loads 200 ceur, so result should be 205
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("205", 18)
    );
  });

  it("Should calculate the balance correctly with ceur, cusd", async () => {
    const { vault, cusd, matt } = await loadFixture(defaultFixture);

    // Matt deposits cusd, 18 decimals
    await cusd.connect(matt).approve(vault.address, cusdUnits("20.0"));
    await vault.connect(matt).mint(cusd.address, cusdUnits("20.0"), 0);
    // Fixture loads 200 ceur, so result should be 237
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("220", 18)
    );
  });

  it("Should allow transfer of arbitrary token by Governor", async () => {
    const { vault, ousd, cusd, matt, governor } = await loadFixture(
      defaultFixture
    );
    // Matt deposits cusd
    await cusd.connect(matt).approve(vault.address, cusdUnits("8.0"));
    await vault.connect(matt).mint(cusd.address, cusdUnits("8.0"), 0);
    // Matt sends his OUSD directly to Vault
    await ousd.connect(matt).transfer(vault.address, ousdUnits("8.0"));
    // Matt asks Governor for help
    await vault.connect(governor).transferToken(ousd.address, ousdUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", ousd);
  });

  it("Should not allow transfer of arbitrary token by non-Governor", async () => {
    const { vault, ousd, matt } = await loadFixture(defaultFixture);
    // Naughty Matt
    await expect(
      vault.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should not allow transfer of supported token by governor", async () => {
    const { vault, cusd, governor } = await loadFixture(defaultFixture);
    // Matt puts cusd in vault
    await cusd.transfer(vault.address, cusdUnits("8.0"));
    // Governor cannot move USDC because it is a supported token.
    await expect(
      vault.connect(governor).transferToken(cusd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Only unsupported assets");
  });

  it("Should allow Governor to add Strategy", async () => {
    const { vault, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is a strategy and add its address
    await vault.connect(governor).approveStrategy(ousd.address);
  });

  it("Should revert when removing a Strategy that has not been added", async () => {
    const { vault, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is a strategy and remove its address
    await expect(
      vault.connect(governor).removeStrategy(ousd.address)
    ).to.be.revertedWith("Strategy not approved");
  });

  it("Should correctly handle a mint with auto rebase", async function () {
    const { ousd, vault, cusd, matt, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);
    await cusd.connect(anna).mint(cusdUnits("5000.0"));
    await cusd.connect(anna).approve(vault.address, cusdUnits("5000.0"));
    await vault.connect(anna).mint(cusd.address, cusdUnits("5000.0"), 0);
    await expect(anna).has.a.balanceOf("5000.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);
  });

  it("Should revert mint/mintMultiple if minMintAmount check fails", async () => {
    const { vault, matt, ousd, ceur, cusd } = await loadFixture(defaultFixture);

    await cusd.connect(matt).approve(vault.address, cusdUnits("50.0"));
    await ceur.connect(matt).approve(vault.address, ceurUnits("25.0"));

    await expect(
      vault.connect(matt).mint(cusd.address, cusdUnits("50"), ceurUnits("100"))
    ).to.be.revertedWith("Mint amount lower than minimum");

    await expect(
      vault
        .connect(matt)
        .mintMultiple(
          [cusd.address, ceur.address],
          [cusdUnits("50"), ceurUnits("25")],
          ceurUnits("100")
        )
    ).to.be.revertedWith("Mint amount lower than minimum");

    await expect(matt).has.a.balanceOf("100.00", ousd);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
  });

  it("Should mint for multiple tokens in a single call", async () => {
    const { vault, matt, ousd, ceur, cusd } = await loadFixture(defaultFixture);

    await cusd.connect(matt).approve(vault.address, cusdUnits("50.0"));
    await ceur.connect(matt).approve(vault.address, ceurUnits("25.0"));

    await vault
      .connect(matt)
      .mintMultiple(
        [cusd.address, ceur.address],
        [cusdUnits("50"), ceurUnits("25")],
        0
      );

    await expect(matt).has.a.balanceOf("181.25", ousd);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("281.25"));
  });

  it("Should mint for multiple tokens in a single call with auto rebase", async () => {
    const { vault, matt, anna, ousd, ceur, cusd } = await loadFixture(
      defaultFixture
    );

    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);

    await cusd.connect(anna).mint(cusdUnits("2500.00"));
    await cusd.connect(anna).approve(vault.address, cusdUnits("2500.00"));
    await ceur.connect(anna).mint(ceurUnits("2500.00"));
    await ceur.connect(anna).approve(vault.address, ceurUnits("2500.00"));

    await vault
      .connect(anna)
      .mintMultiple(
        [cusd.address, ceur.address],
        [cusdUnits("2500.00"), ceurUnits("2500.00")],
        0
      );

    await expect(anna).has.a.balanceOf("5625.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("5825.0"));
  });

  it("Should revert mint for multiple tokens if any transfer fails", async () => {
    const { vault, matt, ousd, ceur, cusd } = await loadFixture(defaultFixture);

    await cusd.connect(matt).approve(vault.address, cusdUnits("50.0"));
    await ceur.connect(matt).approve(vault.address, ceurUnits("25.0"));

    await expect(
      vault
        .connect(matt)
        .mintMultiple(
          [cusd.address, ceur.address],
          [cusdUnits("50"), ceurUnits("250")],
          0
        )
    ).to.be.reverted;

    await expect(matt).has.a.balanceOf("100.00", ousd);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
  });

  it("Should handle mintMultiple with duplicate tokens correctly", async () => {
    const { ousd, vault, josh, cusd } = await loadFixture(defaultFixture);
    // 900 cusd because 100 was used to mint OUSD in the fixture
    await expect(josh).has.a.balanceOf("900", cusd);
    await cusd.connect(josh).approve(vault.address, cusdUnits("247"));
    await vault
      .connect(josh)
      .mintMultiple(
        [cusd.address, cusd.address, cusd.address],
        [cusdUnits("105"), cusdUnits("50"), cusdUnits("92")],
        0
      );
    // Josh had 100 OUSD from the fixture
    await expect(josh).has.a.balanceOf("347", ousd);
    await expect(josh).has.a.balanceOf("653", cusd);
  });

  it("Should not mint OUSD for unsupported assets in mintMultiple", async () => {
    const { vault, josh, nonStandardToken, ceur } = await loadFixture(
      defaultFixture
    );
    await setOracleTokenPriceCusd(nonStandardToken.address, "1.00");
    await nonStandardToken
      .connect(josh)
      .approve(vault.address, cusdUnits("100.0"));
    await ceur.connect(josh).approve(vault.address, ceurUnits("50"));
    await expect(
      vault
        .connect(josh)
        .mintMultiple(
          [nonStandardToken.address, ceur.address],
          [cusdUnits("100.0"), ceurUnits("50")],
          0
        )
    ).to.be.revertedWith("Asset is not supported");
  });

  it("Should allow transfer of arbitrary token by Governor", async () => {
    const { vault, ousd, cusd, matt, governor } = await loadFixture(
      defaultFixture
    );
    // Matt deposits cusd
    await cusd.connect(matt).approve(vault.address, cusdUnits("8.0"));
    await vault.connect(matt).mint(cusd.address, cusdUnits("8.0"), 0);
    // Matt sends his OUSD directly to Vault
    await ousd.connect(matt).transfer(vault.address, ousdUnits("8.0"));
    // Matt asks Governor for help
    await vault.connect(governor).transferToken(ousd.address, ousdUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", ousd);
  });

  it("Should not allow transfer of arbitrary token by non-Governor", async () => {
    const { vault, ousd, matt } = await loadFixture(defaultFixture);
    // Naughty Matt
    await expect(
      vault.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow governor to change rebase threshold", async () => {
    const { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).setRebaseThreshold(ousdUnits("400"));
  });

  it("Should not allow non-governor to change rebase threshold", async () => {
    const { vault } = await loadFixture(defaultFixture);
    expect(vault.setRebaseThreshold(ousdUnits("400"))).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should allow governor to change Strategist address", async () => {
    const { vault, governor, josh } = await loadFixture(defaultFixture);
    await vault.connect(governor).setStrategistAddr(await josh.getAddress());
  });

  it("Should not allow non-governor to change Strategist address", async () => {
    const { vault, josh, matt } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(matt).setStrategistAddr(await josh.getAddress())
    ).to.be.revertedWith("Caller is not the Governor");
  });


  // TODO: Running these tests two with full test suite, cause "Startegy not approved"
  // revert due to fixtures overwrite.
  // If run seprately they pass
  xit("Should allow the Governor to call reallocate", async () => {
    const {
      vault,
      governor,
      ceur,
      josh,
      aaveStrategy,
      strategyTwo,
    } = await loadFixture(multiStrategyVaultFixture);

    // await vault.connect(governor).approveStrategy(aaveStrategy.address);
    // Send all ceur to Compound
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(ceur.address, aaveStrategy.address);
    await ceur.connect(josh).approve(vault.address, ceurUnits("200"));
    await vault.connect(josh).mint(ceur.address, ceurUnits("200"), 0);
    await vault.connect(governor).allocate();
    // await vault.connect(governor).approveStrategy(strategyTwo.address);

    await vault
      .connect(governor)
      .reallocate(
        aaveStrategy.address,
        strategyTwo.address,
        [ceur.address],
        [ceurUnits("200")]
      );
  });

  xit("Should allow the Strategist to call reallocate", async () => {
    const {
      vault,
      governor,
      ceur,
      josh,
      aaveStrategy,
      strategyTwo,
    } = await loadFixture(multiStrategyVaultFixture);

    await vault.connect(governor).setStrategistAddr(await josh.getAddress());
    // await vault.connect(governor).approveStrategy(aaveStrategy.address);
    // Send all ceur to Compound
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(ceur.address, aaveStrategy.address);
    await ceur.connect(josh).approve(vault.address, ceurUnits("200"));
    await vault.connect(josh).mint(ceur.address, ceurUnits("200"), 0);
    await vault.connect(governor).allocate();
    // await vault.connect(governor).approveStrategy(strategyTwo.address);

    await vault
      .connect(josh)
      .reallocate(
        aaveStrategy.address,
        strategyTwo.address,
        [ceur.address],
        [ceurUnits("200")]
      );
  });

  it("Should not allow non-Governor and non-Strategist to call reallocate", async () => {
    const { vault, ceur, josh } = await loadFixture(defaultFixture);

    await expect(
      vault.connect(josh).reallocate(
        vault.address, // Args don't matter because it doesn't reach checks
        vault.address,
        [ceur.address],
        [ceurUnits("200")]
      )
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should allow Governor and Strategist to set vaultBuffer", async () => {
    const { vault, governor, strategist } = await loadFixture(defaultFixture);
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("5", 17));
    await vault.connect(strategist).setVaultBuffer(utils.parseUnits("5", 17));
  });

  it("Should not allow other to set vaultBuffer", async () => {
    const { vault, josh } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(josh).setVaultBuffer(utils.parseUnits("2", 19))
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should not allow setting a vaultBuffer > 1e18", async () => {
    const { vault, governor } = await loadFixture(defaultFixture);
    await expect(
      vault.connect(governor).setVaultBuffer(utils.parseUnits("2", 19))
    ).to.be.revertedWith("Invalid value");
  });

  it("Should only allow Governor and Strategist to call withdrawAllFromStrategies", async () => {
    const { vault, governor, matt, strategist } = await loadFixture(
      defaultFixture
    );
    await vault.connect(governor).withdrawAllFromStrategies();
    await vault.connect(strategist).withdrawAllFromStrategies();
    await expect(
      vault.connect(matt).withdrawAllFromStrategies()
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should only allow Governor and Strategist to call withdrawAllFromStrategy", async () => {
    const {
      vault,
      governor,
      strategist,
      aaveStrategy,
      matt,
      josh,
      ceur,
    } = await loadFixture(defaultFixture);
    await vault.connect(governor).approveStrategy(aaveStrategy.address);

    // Get the vault's initial ceur balance.
    const vaultceurBalance = await ceur.balanceOf(vault.address);

    // Mint and allocate ceur to Compound.
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(ceur.address, aaveStrategy.address);
    await ceur.connect(josh).approve(vault.address, ceurUnits("200"));
    await vault.connect(josh).mint(ceur.address, ceurUnits("200"), 0);
    await vault.connect(governor).allocate();

    // Call to withdrawAll by the governor should go thru.
    await vault.connect(governor).withdrawAllFromStrategy(aaveStrategy.address);

    // All the ceur should have been moved back to the vault.
    const expectedVaultceurBalance = vaultceurBalance.add(ceurUnits("200"));
    await expect(await ceur.balanceOf(vault.address)).to.equal(
      expectedVaultceurBalance
    );

    // Call to withdrawAll by the strategist should go thru.
    await vault
      .connect(strategist)
      .withdrawAllFromStrategy(aaveStrategy.address);

    // Call to withdrawAll from random dude matt should get rejected.
    await expect(
      vault.connect(matt).withdrawAllFromStrategy(aaveStrategy.address)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });
});
