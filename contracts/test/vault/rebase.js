const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const {
  ousdUnits,
  getOracleAddress,
  expectApproxSupply,
  loadFixture,
  setOracleTokenPriceCusd,
  ceurUnits,
  cusdUnits,
} = require("../helpers");

describe("Vault rebase pausing", async () => {
  it("Should allow non-governor to call rebase", async () => {
    let { vault, anna } = await loadFixture(defaultFixture);
    await vault.connect(anna).rebase();
  });

  it("Should handle rebase pause flag correctly", async () => {
    let { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseRebase();
    await expect(vault.rebase()).to.be.revertedWith("Rebasing paused");
    await vault.connect(governor).unpauseRebase();
    await vault.rebase();
  });

  it("Should not allow the public to pause or unpause rebasing", async () => {
    let { vault, anna } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).pauseRebase()).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
    await expect(vault.connect(anna).unpauseRebase()).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should allow strategist to pause rebasing", async () => {
    let { vault, governor, josh } = await loadFixture(defaultFixture);
    await vault.connect(governor).setStrategistAddr(josh.address);
    await vault.connect(josh).pauseRebase();
  });

  it("Should allow strategist to unpause rebasing", async () => {
    let { vault, governor, josh } = await loadFixture(defaultFixture);
    await vault.connect(governor).setStrategistAddr(josh.address);
    await expect(vault.connect(josh).unpauseRebase()).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("Should allow governor tonpause rebasing", async () => {
    let { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseRebase();
  });

  it("Should allow governor to unpause rebasing", async () => {
    let { vault, governor } = await loadFixture(defaultFixture);
    await vault.connect(governor).unpauseRebase();
  });

  it("Rebase pause status can be read", async () => {
    let { vault, anna } = await loadFixture(defaultFixture);
    await expect(await vault.connect(anna).rebasePaused()).to.be.false;
  });
});

describe("Vault rebasing", async () => {
  it("Should not alter balances after an asset price change", async () => {
    let { ousd, vault, matt, ceur } = await loadFixture(defaultFixture);
    await ceur.connect(matt).approve(vault.address, ceurUnits("100"));
    await vault.connect(matt).mint(ceur.address, ceurUnits("100"), 0);
    // default fixture minted 100ousd
    await expect(matt).has.a.balanceOf("225.00", ousd);
    await vault.rebase();
    await expect(matt).has.a.balanceOf("225.00", ousd);
    await setOracleTokenPriceCusd(ceur.address, "1.2");

    await vault.rebase();
    await expect(matt).has.a.approxBalanceOf("225.00", ousd);
    await setOracleTokenPriceCusd(ceur.address, "1.25");
    await vault.rebase();
    await expect(matt).has.a.balanceOf("225.00", ousd);
  });

  it("Should not alter balances after an asset price change, single", async () => {
    let { ousd, vault, matt, ceur } = await loadFixture(defaultFixture);
    await ceur.connect(matt).approve(vault.address, ceurUnits("100"));
    await vault.connect(matt).mint(ceur.address, ceurUnits("100"), 0);
    await expect(matt).has.a.balanceOf("225.00", ousd);
    await vault.rebase();
    await expect(matt).has.a.balanceOf("225.00", ousd);
    await setOracleTokenPriceCusd(ceur.address, "1.2");
    await vault.rebase();
    await expect(matt).has.a.approxBalanceOf("225.00", ousd);
    await setOracleTokenPriceCusd(ceur.address, "1.25");
    await vault.rebase();
    await expect(matt).has.a.balanceOf("225.00", ousd);
  });

  it("Should not alter balances after an asset price change with multiple assets", async () => {
    let { ousd, vault, matt, ceur, cusd } = await loadFixture(defaultFixture);
    await ceur.connect(matt).approve(vault.address, ceurUnits("200"));
    await vault.connect(matt).mint(ceur.address, ceurUnits("200"), 0);
    // ceur price is 1.25, 200 * 1.25 = 250
    expect(await ousd.totalSupply()).to.eq(ousdUnits("450.0"));
    await expect(matt).has.a.balanceOf("350.00", ousd);
    await vault.rebase();
    await expect(matt).has.a.balanceOf("350.00", ousd);

    await setOracleTokenPriceCusd(cusd.address, "0.90");
    await vault.rebase();
    expect(await ousd.totalSupply()).to.eq(ousdUnits("450.0"));
    await expect(matt).has.an.approxBalanceOf("350.00", ousd);

    await setOracleTokenPriceCusd(cusd.address, "1.00");
    await vault.rebase();
    expect(await ousd.totalSupply()).to.eq(
      ousdUnits("450.0"),
      "After assets go back"
    );
    await expect(matt).has.a.balanceOf("350.00", ousd);
  });

  it("Should alter balances after supported asset deposited and rebase called for rebasing accounts", async () => {
    let { ousd, vault, matt, cusd, josh } = await loadFixture(defaultFixture);
    // Transfer cusd into the Vault to simulate yield
    await cusd.connect(matt).transfer(vault.address, cusdUnits("200"));
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("100.00", ousd);
    await vault.rebase();
    await expect(matt).has.an.approxBalanceOf(
      "200.00",
      ousd,
      "Matt has wrong balance"
    );
    await expect(josh).has.an.approxBalanceOf(
      "200.00",
      ousd,
      "Josh has wrong balance"
    );
  });

  it("Should not alter balances after supported asset deposited and rebase called for non-rebasing accounts", async () => {
    let { ousd, vault, matt, cusd, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );

    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("100.00", ousd);

    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));

    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);

    // Transfer cusd into the Vault to simulate yield
    await cusd.connect(matt).transfer(vault.address, cusdUnits("200"));
    await vault.rebase();

    await expect(matt).has.an.approxBalanceOf("300.00", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
  });

  it("Should not allocate unallocated assets when no Strategy configured", async () => {
    const { anna, governor, cusd, ceur, vault } = await loadFixture(
      defaultFixture
    );
    await cusd.connect(anna).transfer(vault.address, cusdUnits("100"));
    await ceur.connect(anna).transfer(vault.address, ceurUnits("300"));

    await expect(await vault.getStrategyCount()).to.equal(0);
    await vault.connect(governor).allocate();

    // All assets should still remain in Vault

    // Note defaultFixture sets up with 200 cusd already in the Strategy
    // 200 + 100 = 300
    await expect(await cusd.balanceOf(vault.address)).to.equal(
      cusdUnits("300")
    );
    await expect(await ceur.balanceOf(vault.address)).to.equal(
      ceurUnits("300")
    );
  });

  // it("Should correctly handle a deposit of USDC (6 decimals)", async function () {
  //   const { anna, ousd, usdc, vault } = await loadFixture(defaultFixture);
  //   await expect(anna).has.a.balanceOf("0", ousd);
  //   // The price should be limited by the code to $1
  //   await setOracleTokenPriceUsd("USDC", "1.20");
  //   await usdc.connect(anna).approve(vault.address, usdcUnits("50"));
  //   await vault.connect(anna).mint(usdc.address, usdcUnits("50"), 0);
  //   await expect(anna).has.a.balanceOf("50", ousd);
  // });

  it("Should allow priceProvider to be changed", async function () {
    const { anna, governor, vault } = await loadFixture(defaultFixture);
    const oracle = await getOracleAddress(deployments);
    await expect(await vault.priceProvider()).to.be.equal(oracle);
    const annaAddress = await anna.getAddress();
    await vault.connect(governor).setPriceProvider(annaAddress);
    await expect(await vault.priceProvider()).to.be.equal(annaAddress);

    // Only governor should be able to set it
    await expect(
      vault.connect(anna).setPriceProvider(oracle)
    ).to.be.revertedWith("Caller is not the Governor");

    await vault.connect(governor).setPriceProvider(oracle);
    await expect(await vault.priceProvider()).to.be.equal(oracle);
  });
});

describe("Vault yield accrual to Trustee", async () => {
  [
    { yield: "1000", basis: 100, expectedFee: "10" },
    { yield: "1000", basis: 5000, expectedFee: "500" },
    { yield: "1523", basis: 900, expectedFee: "137.07" },
    { yield: "0.000001", basis: 10, expectedFee: "0.00000001" },
    { yield: "0", basis: 1000, expectedFee: "0" },
  ].forEach((options) => {
    const { yield, basis, expectedFee } = options;
    it(`should collect on rebase a ${expectedFee} fee from ${yield} yield at ${basis}bp `, async function () {
      const fixture = await loadFixture(defaultFixture);
      const { matt, governor, ousd, cusd, vault, mockNonRebasing } = fixture;
      const trustee = mockNonRebasing;

      // Setup trustee trustee on vault
      await vault.connect(governor).setTrusteeAddress(trustee.address);
      await vault.connect(governor).setTrusteeFeeBps(900);
      await expect(trustee).has.a.balanceOf("0", ousd);

      // Create yield for the vault
      await cusd.connect(matt).mint(cusdUnits("1523"));
      await cusd.connect(matt).transfer(vault.address, cusdUnits("1523"));
      // Do rebase
      const supplyBefore = await ousd.totalSupply();
      await vault.rebase();
      // OUSD supply increases correctly
      await expectApproxSupply(ousd, supplyBefore.add(ousdUnits("1523")));
      // ogntrustee address increases correctly
      // 1523 * 0.09 = 137.07
      await expect(trustee).has.a.balanceOf("137.07", ousd);
    });
  });
});
