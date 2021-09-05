const {
  defaultFixture,
  aaveVaultFixture,
  multiStrategyVaultFixture,
} = require("../_fixture");
const { expect } = require("chai");
const { utils } = require("ethers");

const {
  advanceTime,
  ousdUnits,
  cusdUnits,
  usdcUnits,
  usdtUnits,
  tusdUnits,
  setOracleTokenPriceUsd,
  loadFixture,
  isFork,
  expectApproxSupply,
  ceurUnits,
  setOracleTokenPriceCusd,
} = require("../helpers");
const { getAssetAddresses } = require("../addressHelper");
const addresses = require("../../utils/addresses");

describe("Vault with aave strategy", function () {
  if (isFork) {
    this.timeout(0);
  }

  it("Governor can call removePToken", async () => {
    const { governor, aaveStrategy } = await loadFixture(aaveVaultFixture);
    const tx = await aaveStrategy.connect(governor).removePToken(0);
    const receipt = await tx.wait();

    const event = receipt.events.find((e) => e.event === "PTokenRemoved");
    expect(event).to.not.be.undefined;
  });

  it("Governor can call setPTokenAddress", async () => {
    const { cusd, ousd, matt, aaveStrategy } = await loadFixture(
      aaveVaultFixture
    );
    await expect(
      aaveStrategy.connect(matt).setPTokenAddress(ousd.address, cusd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Only Vault can call collectRewardToken", async () => {
    const { matt, aaveStrategy } = await loadFixture(aaveVaultFixture);
    await expect(
      aaveStrategy.connect(matt).collectRewardToken()
    ).to.be.revertedWith("Caller is not the Vault");
  });

  it("Should allocate unallocated assets", async () => {
    const {
      anna,
      governor,
      cusd,
      ceur,
      vault,
      aaveStrategy,
    } = await loadFixture(aaveVaultFixture);

    await cusd.connect(anna).transfer(vault.address, cusdUnits("100"));
    await ceur.connect(anna).transfer(vault.address, ceurUnits("200"));

    await vault.connect(governor).allocate();

    // Note aaveVaultFixture sets up with 200 cusd already in the Strategy
    // 200 + 100 = 300
    await expect(await aaveStrategy.checkBalance(cusd.address)).to.approxEqual(
      cusdUnits("300")
    );
    await expect(await aaveStrategy.checkBalance(ceur.address)).to.approxEqual(
      ceurUnits("200")
    );
  });

  it("Should allow withdrawals", async () => {
    const {
      anna,
      aaveStrategy,
      ousd,
      cusd,
      vault,
      governor,
    } = await loadFixture(aaveVaultFixture);
    await expect(anna).has.a.balanceOf("1000.00", cusd);
    await cusd.connect(anna).approve(vault.address, cusdUnits("50.0"));
    await vault.connect(anna).mint(cusd.address, cusdUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("50.00", ousd);

    await vault.connect(governor).allocate();

    // Verify the deposit went to aave
    expect(await aaveStrategy.checkBalance(cusd.address)).to.approxEqual(
      ceurUnits("250.0")
    );

    // Note Anna will have slightly less than 50 due to deposit to aave
    // according to the MockAToken implementation
    await ousd.connect(anna).approve(vault.address, ousdUnits("40.0"));
    await vault.connect(anna).redeem(ousdUnits("40.0"), 0);

    await expect(anna).has.an.approxBalanceOf("10", ousd);
    await expect(anna).has.an.approxBalanceOf("990", cusd);
  });

  it("Should calculate the balance correctly with cusd in strategy", async () => {
    const { cusd, vault, josh, aaveStrategy, governor } = await loadFixture(
      aaveVaultFixture
    );

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Josh deposits cusd, 18 decimals
    await cusd.connect(josh).approve(vault.address, cusdUnits("22.0"));
    await vault.connect(josh).mint(cusd.address, cusdUnits("22.0"), 0);

    await vault.connect(governor).allocate();

    // Josh had 1000 cusd but used 100 cusd to mint OUSD in the fixture
    await expect(josh).has.an.approxBalanceOf("878.0", cusd, "Josh has less");

    // Verify the deposit went to aave (as well as existing Vault assets)
    expect(await aaveStrategy.checkBalance(cusd.address)).to.approxEqual(
      cusdUnits("222")
    );

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("222", 18)
    );
  });

  it("Should calculate the balance correctly with cusd in strategy", async () => {
    const { cusd, vault, matt, aaveStrategy, governor } = await loadFixture(
      aaveVaultFixture
    );

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Matt deposits cusd
    await cusd.connect(matt).approve(vault.address, cusdUnits("8.0"));
    await vault.connect(matt).mint(cusd.address, cusdUnits("8.0"), 0);

    await vault.connect(governor).allocate();

    // Verify the deposit went to aave
    await expect(matt).has.an.approxBalanceOf("892.0", cusd, "Matt has less");

    expect(await aaveStrategy.checkBalance(cusd.address)).to.approxEqual(
      cusdUnits("208.0")
    );

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("208", 18)
    );
  });

  it("Should correctly rebase with changes in aave exchange rates", async () => {
    // Mocks can't handle increasing time
    if (!isFork) return;

    const { vault, matt, cusd, governor } = await loadFixture(aaveVaultFixture);
    await expect(await vault.totalValue()).to.equal(
      utils.parseUnits("200", 18)
    );
    await cusd.connect(matt).approve(vault.address, cusdUnits("100"));
    await vault.connect(matt).mint(cusd.address, cusdUnits("100"), 0);

    await vault.connect(governor).allocate();

    await expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("300", 18)
    );

    // Advance one year
    await advanceTime(365 * 24 * 24 * 60);

    // Rebase OUSD
    await vault.rebase();

    // Expect a yield > 2%
    await expect(await vault.totalValue()).gt(utils.parseUnits("306", 18));
  });

  it("Should withdrawAll assets in Strategy and return them to Vault on removal", async () => {
    const {
      ceur,
      vault,
      matt,
      josh,
      cusd,
      aaveStrategy,
      governor,
    } = await loadFixture(aaveVaultFixture);
    setOracleTokenPriceCusd(ceur.address, "1.0");
    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Matt deposits ceur
    await ceur.connect(matt).approve(vault.address, ceurUnits("8.0"));
    await vault.connect(matt).mint(ceur.address, ceurUnits("8.0"), 0);

    await vault.connect(governor).allocate();

    expect(await aaveStrategy.checkBalance(ceur.address)).to.approxEqual(
      ceurUnits("8.0")
    );
    await cusd.connect(josh).approve(vault.address, cusdUnits("22.0"));
    await vault.connect(josh).mint(cusd.address, cusdUnits("22.0"), 0);

    expect((await vault.totalValue()).gt(utils.parseUnits("230", 18))).to.be
      .true;

    await expect(await vault.getStrategyCount()).to.equal(1);

    await vault.connect(governor).removeStrategy(aaveStrategy.address);

    await expect(await vault.getStrategyCount()).to.equal(0);

    // Vault value should remain the same (with small yeild) because the liquidattion sent the
    // assets back to the vault
    expect((await vault.totalValue()).gt(utils.parseUnits("230", 18))).to.be
      .true;

    // Should be able to add Strategy back. Proves the struct in the mapping
    // was updated i.e. isSupported set to false
    await vault.connect(governor).approveStrategy(aaveStrategy.address);
  });

  it("Should handle non-standard token deposits", async () => {
    let { ousd, vault, matt, nonStandardToken, governor } = await loadFixture(
      aaveVaultFixture
    );

    if (nonStandardToken) {
      await vault.connect(governor).supportAsset(nonStandardToken.address);
    }

    await setOracleTokenPriceCusd(nonStandardToken.address, "1.00");

    await nonStandardToken
      .connect(matt)
      .approve(vault.address, cusdUnits("10000"));

    // Try to mint more than balance, to check failure state
    try {
      await vault
        .connect(matt)
        .mint(nonStandardToken.address, cusdUnits("1200"), 0);
    } catch (err) {
      expect(/ERC20 operation did not succeed/gi.test(err.message)).to.be.true;
    } finally {
      // Make sure nothing got affected
      await expectApproxSupply(ousd, ousdUnits("200.0"));
      await expect(matt).has.an.approxBalanceOf("100", ousd);
      await expect(matt).has.an.approxBalanceOf("1000", nonStandardToken);
    }

    // Try minting with a valid balance of tokens
    await vault
      .connect(matt)
      .mint(nonStandardToken.address, cusdUnits("100"), 0);
    await expect(matt).has.an.approxBalanceOf("900", nonStandardToken);

    await expectApproxSupply(ousd, ousdUnits("300.0"));
    await expect(matt).has.an.approxBalanceOf("200", ousd, "Initial");
    await vault.rebase();
    await expect(matt).has.an.approxBalanceOf("200", ousd, "After null rebase");
  });

  it("Should never allocate anything when Vault buffer is 1e18 (100%)", async () => {
    const { cusd, vault, governor, aaveStrategy } = await loadFixture(
      aaveVaultFixture
    );

    await expect(await vault.getStrategyCount()).to.equal(1);

    // Set a Vault buffer and allocate
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 18));
    await vault.allocate();

    // Verify that nothing went to aave
    await expect(await aaveStrategy.checkBalance(cusd.address)).to.equal(0);
  });

  it("Should allocate correctly with cusd when Vault buffer is 1e17 (10%)", async () => {
    const { cusd, vault, governor, aaveStrategy } = await loadFixture(
      aaveVaultFixture
    );

    await expect(await vault.getStrategyCount()).to.equal(1);

    // Set a Vault buffer and allocate
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 17));
    await vault.allocate();

    // Verify 80% went to aave
    await expect(await aaveStrategy.checkBalance(cusd.address)).to.approxEqual(
      ousdUnits("180")
    );
    // Remaining 20 should be in Vault
    await expect(await vault.totalValue()).to.approxEqual(ousdUnits("200"));
  });

  it("Should allow transfer of arbitrary token by Governor", async () => {
    const { vault, ousd, cusd, matt, governor } = await loadFixture(
      aaveVaultFixture
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
    const { aaveStrategy, ousd, matt } = await loadFixture(aaveVaultFixture);
    // Naughty Matt
    await expect(
      aaveStrategy.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should have correct balances on consecutive mint and redeem", async () => {
    const { ousd, vault, ceur, cusd, anna, matt, josh } = await loadFixture(
      aaveVaultFixture
    );

    setOracleTokenPriceCusd(ceur.address, "1");

    const usersWithBalances = [
      [anna, 0],
      [matt, 100],
      [josh, 100],
    ];

    const assetsWithUnits = [
      [cusd, cusdUnits],
      [ceur, ceurUnits],
    ];

    for (const [user, startBalance] of usersWithBalances) {
      for (const [asset, units] of assetsWithUnits) {
        for (const amount of [5.09, 10.32, 20.99, 100.01]) {
          asset.connect(user).approve(vault.address, units(amount.toString()));
          vault.connect(user).mint(asset.address, units(amount.toString()), 0);
          await expect(user).has.an.approxBalanceOf(
            (startBalance + amount).toString(),
            ousd
          );
          await vault.connect(user).redeem(ousdUnits(amount.toString()), 0);
          await expect(user).has.an.approxBalanceOf(
            startBalance.toString(),
            ousd
          );
        }
      }
    }
  });

  it("Should collect reward tokens using collect rewards on all strategies", async () => {
    const { vault, governor, aaveStrategy, moo } = await loadFixture(
      aaveVaultFixture
    );
    await vault.connect(governor).setUniswapAddr(addresses.zero);
    const mooAmount = utils.parseUnits("100", 18);
    await moo.connect(governor).mint(mooAmount);
    await moo.connect(governor).transfer(aaveStrategy.address, mooAmount);

    // Make sure the Strategy has MOO balance
    await expect(await moo.balanceOf(await governor.getAddress())).to.be.equal(
      "0"
    );
    await expect(await moo.balanceOf(aaveStrategy.address)).to.be.equal(
      mooAmount
    );

    await vault.connect(governor)["harvest()"]();

    // Note if Uniswap address was configured, it would withdrawAll the MOO for
    // a stablecoin to increase the value of Vault. No Uniswap configured here
    // so the MOO just sits in Vault
    await expect(await moo.balanceOf(vault.address)).to.be.equal(mooAmount);
  });

  it("Should collect reward tokens using collect rewards on a specific strategy", async () => {
    const { vault, governor, aaveStrategy, moo } = await loadFixture(
      aaveVaultFixture
    );
    await vault.connect(governor).setUniswapAddr(addresses.zero);
    const mooAmount = utils.parseUnits("100", 18);
    await moo.connect(governor).mint(mooAmount);
    await moo.connect(governor).transfer(aaveStrategy.address, mooAmount);

    // Make sure the Strategy has MOO balance
    await expect(await moo.balanceOf(await governor.getAddress())).to.be.equal(
      "0"
    );
    await expect(await moo.balanceOf(aaveStrategy.address)).to.be.equal(
      mooAmount
    );

    // prettier-ignore
    await vault
      .connect(governor)["harvest(address)"](aaveStrategy.address);

    await expect(await moo.balanceOf(vault.address)).to.be.equal(mooAmount);
  });

  it("Should collect reward tokens and swap via Uniswap", async () => {
    const {
      josh,
      vault,
      governor,
      aaveStrategy,
      moo,
      cusd,
    } = await loadFixture(aaveVaultFixture);

    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

    mockUniswapRouter.initialize(
      moo.address,
      cusd.address,
      (await ethers.getContract("MockMCUSDMEURLPToken")).address
    );

    const mooAmount = utils.parseUnits("100", 18);
    await moo.connect(governor).mint(mooAmount);
    await moo.connect(governor).transfer(aaveStrategy.address, mooAmount);

    await vault.connect(governor).setUniswapAddr(mockUniswapRouter.address);

    // Make sure Vault has 200 cusd balance
    await expect(vault).has.a.balanceOf("200", cusd);

    // Make sure the Strategy has COMP balance
    await expect(await moo.balanceOf(await governor.getAddress())).to.be.equal(
      "0"
    );
    await expect(await moo.balanceOf(aaveStrategy.address)).to.be.equal(
      mooAmount
    );

    // Give Uniswap mock some cusd so it can give it back in COMP liquidation
    await cusd
      .connect(josh)
      .transfer(mockUniswapRouter.address, cusdUnits("100"));

    // prettier-ignore
    await vault
      .connect(governor)["harvest()"]();

    // Make sure Vault has 300 cusd balance (the Uniswap mock converts at 1:1)
    await expect(vault).has.a.balanceOf("300", cusd);

    // No MOO in Vault or aave strategy
    await expect(vault).has.a.balanceOf("0", moo);
    await expect(await moo.balanceOf(aaveStrategy.address)).to.be.equal("0");
  });
});

describe("Vault auto allocation", async () => {
  if (isFork) {
    this.timeout(0);
  }

  const mintDoesAllocate = async (amount) => {
    const { anna, vault, cusd, governor } = await loadFixture(aaveVaultFixture);
    await vault.connect(governor).setVaultBuffer(0);
    await vault.allocate();
    await cusd.connect(anna).mint(cusdUnits(amount));
    await cusd.connect(anna).approve(vault.address, cusdUnits(amount));
    await vault.connect(anna).mint(cusd.address, cusdUnits(amount), 0);
    return (await cusd.balanceOf(vault.address)).isZero();
  };

  const setThreshold = async (amount) => {
    const { vault, governor } = await loadFixture(aaveVaultFixture);
    await vault.connect(governor).setAutoAllocateThreshold(ousdUnits(amount));
  };

  it("Triggers auto allocation at the threshold", async () => {
    await setThreshold("25000");
    expect(await mintDoesAllocate("25000")).to.be.true;
  });

  it("Alloc with both threshhold and buffer", async () => {
    const {
      anna,
      vault,
      ceur,
      cusd,
      governor,
      aaveStrategy,
    } = await loadFixture(aaveVaultFixture);
    await setOracleTokenPriceCusd(ceur.address, "1.0");
    await vault.allocate();
    await vault.connect(governor).setVaultBuffer(utils.parseUnits("1", 17));
    await vault.connect(governor).setAutoAllocateThreshold(ousdUnits("3"));

    const amount = "4";
    await ceur.connect(anna).mint(ceurUnits(amount));
    await ceur.connect(anna).approve(vault.address, ceurUnits(amount));
    await vault.connect(anna).mint(ceur.address, ceurUnits(amount), 0);
    // No allocate triggered due to threshold so call manually
    await vault.allocate();

    // 5 should be below the 10% vault buffer (4/204 * 100 = 1.96%)
    // All funds should remain in vault
    await expect(await ceur.balanceOf(vault.address)).to.equal(
      ceurUnits(amount)
    );
    // cusd was allocated before the vault buffer was set
    await expect(await cusd.balanceOf(vault.address)).to.equal(cusdUnits("0"));
    // Use an amount above the vault buffer size that will trigger an allocate
    const allocAmount = "5000";
    await ceur.connect(anna).mint(ceurUnits(allocAmount));
    await ceur.connect(anna).approve(vault.address, ceurUnits(allocAmount));
    await vault.connect(anna).mint(ceur.address, ceurUnits(allocAmount), 0);

    // await expect(await ceur.balanceOf(vault.address)).to.approximately(
    //   ceurUnits("520.4")
    // );
    await expect(vault).has.an.approxBalanceOf("520.4", ceur);

    const minAmount = "0.000001";
    await ceur.connect(anna).mint(ceurUnits(minAmount));
    await ceur.connect(anna).approve(vault.address, ceurUnits(minAmount));
    await vault.connect(anna).mint(ceur.address, ceurUnits(minAmount), 0);

    //alloc should not crash here
    await expect(vault.allocate()).not.to.be.reverted;
  });

  it("Triggers auto allocation above the threshold", async () => {
    await setThreshold("25000");
    expect(await mintDoesAllocate("25001")).to.be.true;
  });

  it("Does not trigger auto allocation below the threshold", async () => {
    await setThreshold("25000");
    expect(await mintDoesAllocate("24999")).to.be.false;
  });

  it("Governor can change the threshold", async () => {
    await setThreshold("25000");
  });

  it("Non-governor cannot change the threshold", async () => {
    const { vault, anna } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).setAutoAllocateThreshold(10000)).to.be
      .reverted;
  });
});

describe("Vault with two aave strategies", function () {
  if (isFork) {
    this.timeout(0);
  }

  it("Should reallocate from one strategy to another", async () => {
    const {
      vault,
      cusd,
      governor,
      aaveStrategy,
      strategyThree,
    } = await loadFixture(multiStrategyVaultFixture);
    await vault.connect(governor).approveStrategy(strategyThree.address);

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    await vault.allocate();

    expect(await aaveStrategy.checkBalance(cusd.address)).to.equal(
      cusdUnits("200")
    );
    expect(await strategyThree.checkBalance(cusd.address)).to.equal(
      cusdUnits("0")
    );

    await vault
      .connect(governor)
      .reallocate(
        aaveStrategy.address,
        strategyThree.address,
        [cusd.address],
        [cusdUnits("200")]
      );

    expect(await aaveStrategy.checkBalance(cusd.address)).to.equal(
      cusdUnits("0")
    );
    expect(await strategyThree.checkBalance(cusd.address)).to.equal(
      cusdUnits("200")
    );
  });

  it("Should not reallocate to a strategy that does not support the asset", async () => {
    const {
      vault,
      cusd,
      josh,
      governor,
      aaveStrategy,
      strategyTwo,
    } = await loadFixture(multiStrategyVaultFixture);

    expect(await vault.totalValue()).to.approxEqual(
      utils.parseUnits("200", 18)
    );

    // Stick 200 cusd in aaveStrategy via mint and allocate
    await cusd.connect(josh).approve(vault.address, cusdUnits("200"));
    await vault.connect(josh).mint(cusd.address, cusdUnits("200"), 0);
    await vault.allocate();

    // 200 cusd arre already in strategy
    expect(await aaveStrategy.checkBalance(cusd.address)).to.equal(
      cusdUnits("400")
    );

    // await vault.connect(governor).approveStrategy(strategyTwo.address);

    await expect(
      vault
        .connect(governor)
        .reallocate(
          aaveStrategy.address,
          strategyTwo.address,
          [cusd.address],
          [cusdUnits("200")]
        )
    ).to.be.revertedWith("Asset unsupported");
  });

  it("Should not reallocate to strategy that has not been added to the Vault", async () => {
    const {
      vault,
      cusd,
      governor,
      aaveStrategy,
      strategyThree,
    } = await loadFixture(multiStrategyVaultFixture);
    await expect(
      vault
        .connect(governor)
        .reallocate(
          aaveStrategy.address,
          strategyThree.address,
          [cusd.address],
          [cusdUnits("200")]
        )
    ).to.be.revertedWith("Invalid to Strategy");
  });

  it("Should not reallocate from strategy that has not been added to the Vault", async () => {
    const {
      vault,
      cusd,
      governor,
      aaveStrategy,
      strategyThree,
    } = await loadFixture(multiStrategyVaultFixture);
    await expect(
      vault
        .connect(governor)
        .reallocate(
          strategyThree.address,
          aaveStrategy.address,
          [cusd.address],
          [cusdUnits("200")]
        )
    ).to.be.revertedWith("Invalid from Strategy");
  });
});
