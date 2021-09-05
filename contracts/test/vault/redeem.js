const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const {
  ousdUnits,
  cusdUnits,
  ceurUnits,
  usdtUnits,
  loadFixture,
  setOracleTokenPriceUsd,
  isFork,
  expectApproxSupply,
  setOracleTokenPriceCusd,
} = require("../helpers");

describe("Vault Redeem", function () {
  if (isFork) {
    this.timeout(0);
  }

  it("Should allow a redeem", async () => {
    const { ousd, vault, ceur, anna, cusd } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("1000.00", ceur);
    await expect(anna).has.a.balanceOf("1000.00", cusd);
    await ceur.connect(anna).approve(vault.address, ceurUnits("100.0"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("125.00", ousd);
    await vault.connect(anna).redeem(ousdUnits("125.0"), 0);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(anna).has.an.approxBalanceOf("938.46", ceur);
    await expect(anna).has.an.approxBalanceOf("1076.92", cusd);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));
  });

  it("Should allow a redeem over the rebase threshold", async () => {
    const { ousd, vault, ceur, anna, matt, cusd } = await loadFixture(
      defaultFixture
    );

    await expect(anna).has.a.balanceOf("1000.00", ceur);
    await expect(anna).has.a.balanceOf("1000.00", cusd);

    await expect(anna).has.a.balanceOf("0.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);

    // Anna mints OUSD with ceur
    await ceur.connect(anna).approve(vault.address, ceurUnits("1000.00"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("1000.00"), 0);
    await expect(anna).has.a.balanceOf("1250.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);

    // Anna mints OUSD with cusd
    await cusd.connect(anna).approve(vault.address, cusdUnits("1000.00"));
    await vault.connect(anna).mint(cusd.address, cusdUnits("1000.00"), 0);
    await expect(anna).has.a.balanceOf("2250.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);

    // Rebase should do nothing
    await vault.rebase();
    await expect(anna).has.a.balanceOf("2250.00", ousd);
    await expect(matt).has.a.balanceOf("100.00", ousd);

    // Anna redeems over the rebase threshold
    await vault.connect(anna).redeem(ousdUnits("1750.0"), 0);
    await expect(anna).has.a.approxBalanceOf("500.00", ousd);
    await expect(matt).has.a.approxBalanceOf("100.00", ousd);

    // Redeem outputs will be 1000/2200 * 1500 ceur and 1200/2200 * 1500 cusd from fixture
    await expect(anna).has.an.approxBalanceOf("714.2857", ceur);
    await expect(anna).has.a.approxBalanceOf("857.1428", cusd);

    await expectApproxSupply(ousd, ousdUnits("700.0"));
  });

  it("Changing an asset price affects a redeem", async () => {
    const { ousd, vault, cusd, matt } = await loadFixture(defaultFixture);
    await expectApproxSupply(ousd, ousdUnits("200"));
    await expect(matt).has.a.balanceOf("100.00", ousd);
    await expect(matt).has.a.balanceOf("900", cusd);
    await setOracleTokenPriceCusd(cusd.address, "0.95");
    await vault.rebase();
    await vault.connect(matt).redeem(ousdUnits("2.0"), 0);
    await expectApproxSupply(ousd, ousdUnits("198"));
    // Amount of cusd collected is affected by redeem oracles
    await expect(matt).has.a.approxBalanceOf("902", cusd);
  });

  it("Should allow redeems of non-standard tokens", async () => {
    const { ousd, vault, anna, governor, nonStandardToken } = await loadFixture(
      defaultFixture
    );

    await vault.connect(governor).supportAsset(nonStandardToken.address);

    await setOracleTokenPriceCusd(nonStandardToken.address, "1.00");

    await expect(anna).has.a.balanceOf("1000.00", nonStandardToken);

    // Mint 100 OUSD for 100 tokens
    await nonStandardToken
      .connect(anna)
      .approve(vault.address, cusdUnits("100.0"));
    await vault
      .connect(anna)
      .mint(nonStandardToken.address, cusdUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("100.00", ousd);

    // Redeem 100 tokens for 100 OUSD
    await vault.connect(anna).redeem(ousdUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    // 66.66 would have come back as cusd because there is 100 NST and 200 cusd
    await expect(anna).has.an.approxBalanceOf("933.33", nonStandardToken);
  });

  it("Should have a default redeem fee of 0", async () => {
    const { vault } = await loadFixture(defaultFixture);
    await expect(await vault.redeemFeeBps()).to.equal("0");
  });

  it("Should charge a redeem fee if redeem fee set", async () => {
    const { ousd, vault, ceur, anna, governor } = await loadFixture(
      defaultFixture
    );
    // 1000 basis points = 10%
    await vault.connect(governor).setRedeemFeeBps(1000);
    await expect(anna).has.a.balanceOf("1000.00", ceur);
    await ceur.connect(anna).approve(vault.address, ceurUnits("50.0"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("62.50", ousd);
    await vault.connect(anna).redeem(ousdUnits("62.50"), 0);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    // 45 after redeem fee
    // ceur is 62.5/262.5 of total assets, so balance should be 950 + 62.5/262.5 * 45 = 960.71
    await expect(anna).has.an.approxBalanceOf("960.71", ceur);
  });

  it("Should revert redeem if balance is insufficient", async () => {
    const { ousd, vault, cusd, anna } = await loadFixture(defaultFixture);

    // Mint some OUSD tokens
    await expect(anna).has.a.balanceOf("1000.00", cusd);
    await cusd.connect(anna).approve(vault.address, ceurUnits("50.0"));
    await vault.connect(anna).mint(cusd.address, ceurUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("50.00", ousd);

    // Try to withdraw more than balance
    await expect(
      vault.connect(anna).redeem(ousdUnits("100.0"), 0)
    ).to.be.revertedWith("Remove exceeds balance");
  });

  it("Should only allow Governor to set a redeem fee", async () => {
    const { vault, anna } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).setRedeemFeeBps(100)).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should redeem entire OUSD balance", async () => {
    const { ousd, vault, ceur, cusd, anna } = await loadFixture(defaultFixture);

    await expect(anna).has.a.balanceOf("1000.00", ceur);

    // Mint 125 OUSD tokens using ceur
    await ceur.connect(anna).approve(vault.address, ceurUnits("100.0"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("125.00", ousd);

    // Mint 150 OUSD tokens using cusd
    await cusd.connect(anna).approve(vault.address, cusdUnits("150.0"));
    await vault.connect(anna).mint(cusd.address, cusdUnits("150.0"), 0);
    await expect(anna).has.a.balanceOf("275.00", ousd);

    // Withdraw all
    await vault.connect(anna).redeemAll(0);

    // 100 ceur and 350 cusd in contract
    await expect(anna).has.an.approxBalanceOf("957.89", ceur);
    await expect(anna).has.an.approxBalanceOf("1052.63", cusd);
  });

  it("Should redeem entire OUSD balance, with a lower oracle price", async () => {
    const { ousd, vault, ceur, cusd, anna, governor } = await loadFixture(
      defaultFixture
    );

    await expect(anna).has.a.balanceOf("1000.00", ceur);

    // Mint 125 OUSD tokens using ceur
    await ceur.connect(anna).approve(vault.address, ceurUnits("100.0"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("100.0"), 0);
    await expect(anna).has.a.balanceOf("125.00", ousd);

    // Mint 150 OUSD tokens using cusd
    await cusd.connect(anna).approve(vault.address, cusdUnits("150.0"));
    await vault.connect(anna).mint(cusd.address, cusdUnits("150.0"), 0);
    await expect(anna).has.a.balanceOf("275.00", ousd);

    await setOracleTokenPriceCusd(ceur.address, "0.90");
    await setOracleTokenPriceCusd(cusd.address, "0.80");
    await vault.connect(governor).rebase();

    // Anna's share of OUSD is unaffected
    await expect(anna).has.an.approxBalanceOf("275.00", ousd);

    // Withdraw all
    await ousd.connect(anna).approve(vault.address, ousdUnits("500"));
    await vault.connect(anna).redeemAll(0);

    // OUSD to Withdraw	275
    await expect(anna).has.an.approxBalanceOf(
      "961.111",
      ceur,
      "ceur has wrong balance"
    );
    await expect(anna).has.an.approxBalanceOf(
      "1063.888",
      cusd,
      "cusd has wrong balance"
    );
  });

  it("Should have correct balances on consecutive mint and redeem", async () => {
    const { ousd, vault, ceur, cusd, anna, matt, josh } = await loadFixture(
      defaultFixture
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

  it("Should have correct balances on consecutive mint and redeem with varying oracle prices", async () => {
    const { ousd, vault, cusd, ceur, matt, josh } = await loadFixture(
      defaultFixture
    );

    const users = [matt, josh];
    const assetsWithUnits = [
      [cusd, cusdUnits],
      [ceur, ceurUnits],
    ];
    const amounts = [7.19, 11.32, 25.39, 110.01];
    const prices = [0.98, 0.95, 0.91];

    const getUserOusdBalance = async (user) => {
      const bn = await ousd.balanceOf(await user.getAddress());
      return parseFloat(bn.toString() / 1e12 / 1e6);
    };

    for (const user of users) {
      for (const [asset, units] of assetsWithUnits) {
        for (const price of prices) {
          await setOracleTokenPriceCusd(asset.address, price.toString());
          // Manually call rebase because not triggered by mint
          await vault.rebase();
          // Rebase could have changed user balance
          // as there could have been yield from different
          // oracle prices on redeems during a previous loop.
          let userBalance = await getUserOusdBalance(user);
          for (const amount of amounts) {
            const ousdToReceive = amount * Math.min(price, 1);
            await expect(user).has.an.approxBalanceOf(
              userBalance.toString(),
              ousd
            );
            await asset
              .connect(user)
              .approve(vault.address, units(amount.toString()));
            await vault
              .connect(user)
              .mint(asset.address, units(amount.toString()), 0);
            await expect(user).has.an.approxBalanceOf(
              (userBalance + ousdToReceive).toString(),
              ousd
            );
            await vault
              .connect(user)
              .redeem(ousdUnits(ousdToReceive.toString()), 0);
            await expect(user).has.an.approxBalanceOf(
              userBalance.toString(),
              ousd
            );
          }
        }
      }
    }
  });

  it("Should correctly handle redeem without a rebase and then redeemAll", async function () {
    const { ousd, vault, ceur, anna } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0.00", ousd);
    await ceur.connect(anna).mint(ceurUnits("3000.0"));
    await ceur.connect(anna).approve(vault.address, ceurUnits("3000.0"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("3000.0"), 0);
    await expect(anna).has.a.balanceOf("3750.00", ousd);

    //peturb the oracle a slight bit.
    await setOracleTokenPriceCusd(ceur.address, "1.2");
    //redeem without rebasing (not over threshold)
    await vault.connect(anna).redeem(ousdUnits("200.00"), 0);
    //redeem with rebasing (over threshold)
    await vault.connect(anna).redeemAll(0);

    await expect(anna).has.a.balanceOf("0.00", ousd);
  });

  it("Should have redeemAll result in zero balance", async () => {
    const {
      ousd,
      vault,
      ceur,
      cusd,
      anna,
      governor,
      josh,
      matt,
    } = await loadFixture(defaultFixture);

    await expect(anna).has.a.balanceOf("1000", ceur);
    await expect(anna).has.a.balanceOf("1000", cusd);

    // Mint 1250 OUSD tokens using ceur
    await ceur.connect(anna).approve(vault.address, ceurUnits("1000"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("1000"), 0);
    await expect(anna).has.balanceOf("1250", ousd);

    await vault.connect(governor).setRedeemFeeBps("500");
    await setOracleTokenPriceCusd(ceur.address, "1.2");
    await vault.connect(governor).rebase();

    await vault.connect(anna).redeemAll(0);

    cusd.connect(josh).approve(vault.address, cusdUnits("50"));
    vault.connect(josh).mint(cusd.address, cusdUnits("50"), 0);
    cusd.connect(matt).approve(vault.address, cusdUnits("100"));
    vault.connect(matt).mint(cusd.address, cusdUnits("100"), 0);

    let newBalance = await ceur.balanceOf(await anna.getAddress());
    let newcusdBalance = await cusd.balanceOf(await anna.getAddress());
    await ceur.connect(anna).approve(vault.address, newBalance);
    await vault.connect(anna).mint(ceur.address, newBalance, 0);
    await cusd.connect(anna).approve(vault.address, newcusdBalance);
    await vault.connect(anna).mint(cusd.address, newcusdBalance, 0);
    await vault.connect(anna).redeemAll(0);
    await expect(anna).has.a.balanceOf("0.00", ousd);
  });

  it("Should respect minimum unit amount argument in redeem", async () => {
    const { ousd, vault, ceur, anna, cusd } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("1000.00", ceur);
    await expect(anna).has.a.balanceOf("1000.00", cusd);
    await ceur.connect(anna).approve(vault.address, ceurUnits("100.0"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("62.5", ousd);
    await vault.connect(anna).redeem(ousdUnits("62.5"), ousdUnits("62.49"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("50.0"), 0);
    await expect(
      vault.connect(anna).redeem(ousdUnits("62.5"), ousdUnits("63"))
    ).to.be.revertedWith("Redeem amount lower than minimum");
  });

  it("Should respect minimum unit amount argument in redeemAll", async () => {
    const { ousd, vault, ceur, anna, cusd } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("1000.00", ceur);
    await expect(anna).has.a.balanceOf("1000.00", cusd);
    await ceur.connect(anna).approve(vault.address, ceurUnits("100.0"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("50.0"), 0);
    await expect(anna).has.a.balanceOf("62.50", ousd);
    await vault.connect(anna).redeemAll(ousdUnits("62.49"));
    await vault.connect(anna).mint(ceur.address, ceurUnits("50.0"), 0);
    await expect(
      vault.connect(anna).redeemAll(ousdUnits("63"))
    ).to.be.revertedWith("Redeem amount lower than minimum");
  });
});
