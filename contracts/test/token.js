const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");
const { utils } = require("ethers");

const {
  daiUnits,
  ousdUnits,
  usdcUnits,
  isFork,
  loadFixture,
} = require("./helpers");

describe("Token", function () {
  if (isFork) {
    this.timeout(0);
  }

  it("Should return the token name and symbol", async () => {
    const { ousd } = await loadFixture(defaultFixture);
    expect(await ousd.name()).to.equal("Interest Dollar");
    expect(await ousd.symbol()).to.equal("iUSD");
  });

  it("Should have 18 decimals", async () => {
    const { ousd } = await loadFixture(defaultFixture);
    expect(await ousd.decimals()).to.equal(18);
  });

  it("Should return 0 balance for the zero address", async () => {
    const { ousd } = await loadFixture(defaultFixture);
    expect(
      await ousd.balanceOf("0x0000000000000000000000000000000000000000")
    ).to.equal(0);
  });

  it("Should not allow anyone to mint OUSD directly", async () => {
    const { ousd, matt } = await loadFixture(defaultFixture);
    await expect(
      ousd.connect(matt).mint(matt.getAddress(), ousdUnits("100"))
    ).to.be.revertedWith("Caller is not the Vault");
    await expect(matt).has.a.balanceOf("100.00", ousd);
  });

  it("Should allow a simple transfer of 1 OUSD", async () => {
    const { ousd, anna, matt } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0", ousd);
    await expect(matt).has.a.balanceOf("100", ousd);
    await ousd.connect(matt).transfer(anna.getAddress(), ousdUnits("1"));
    await expect(anna).has.a.balanceOf("1", ousd);
    await expect(matt).has.a.balanceOf("99", ousd);
  });

  it("Should allow a transferFrom with an allowance", async () => {
    const { ousd, anna, matt } = await loadFixture(defaultFixture);
    // Approve OUSD for transferFrom
    await ousd.connect(matt).approve(anna.getAddress(), ousdUnits("1000"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("1000"));

    // Do a transferFrom of OUSD
    await ousd
      .connect(anna)
      .transferFrom(
        await matt.getAddress(),
        await anna.getAddress(),
        ousdUnits("1")
      );

    // Anna should have the dollar
    await expect(anna).has.a.balanceOf("1", ousd);

    // Check if it has reflected in allowance
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("999"));
  });

  it("Should transfer the correct amount from a non-rebasing account without previously set creditssPerToken to a rebasing account", async () => {
    let { ousd, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    await mockNonRebasing.transfer(await matt.getAddress(), ousdUnits("100"));
    await expect(matt).has.an.approxBalanceOf("200.00", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", ousd);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await ousd.rebasingCredits())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerToken())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });


  it("Should transferFrom the correct amount from a non-rebasing account without previously set creditsPerToken to a rebasing account", async () => {
    let { ousd, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", ousd);
    await mockNonRebasing.increaseAllowance(
      await matt.getAddress(),
      ousdUnits("100")
    );

    await ousd
      .connect(matt)
      .transferFrom(
        mockNonRebasing.address,
        await matt.getAddress(),
        ousdUnits("100")
      );
    await expect(matt).has.an.approxBalanceOf("200.00", ousd);
    await expect(josh).has.an.approxBalanceOf("0", ousd);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", ousd);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await ousd.rebasingCredits())
      .mul(utils.parseUnits("1", 18))
      .div(await ousd.rebasingCreditsPerToken())
      .add(await ousd.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await ousd.totalSupply()
    );
  });

  it("Should not allow EOA to call rebaseOptIn when already opted in to rebasing", async () => {
    let { ousd, matt } = await loadFixture(defaultFixture);
    await expect(ousd.connect(matt).rebaseOptIn()).to.be.revertedWith(
      "Account has not opted out"
    );
  });

  it("Should not allow EOA to call rebaseOptOut when already opted out of rebasing", async () => {
    let { ousd, matt } = await loadFixture(defaultFixture);
    await ousd.connect(matt).rebaseOptOut();
    await expect(ousd.connect(matt).rebaseOptOut()).to.be.revertedWith(
      "Account has not opted in"
    );
  });

  it("Should not allow contract to call rebaseOptIn when already opted in to rebasing", async () => {
    let { mockNonRebasing } = await loadFixture(defaultFixture);
    await mockNonRebasing.rebaseOptIn();
    await expect(mockNonRebasing.rebaseOptIn()).to.be.revertedWith(
      "Account has not opted out"
    );
  });

  it("Should not allow contract to call rebaseOptOut when already opted out of rebasing", async () => {
    let { mockNonRebasing } = await loadFixture(defaultFixture);
    await expect(mockNonRebasing.rebaseOptOut()).to.be.revertedWith(
      "Account has not opted in"
    );
  });

  it("Should maintain the correct balance on a partial transfer for a non-rebasing account without previously set creditsPerToken", async () => {
    let { ousd, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Opt in to rebase so contract doesn't set a fixed creditsPerToken for the contract
    await mockNonRebasing.rebaseOptIn();
    // Give contract 100 OUSD from Josh
    await ousd
      .connect(josh)
      .transfer(mockNonRebasing.address, ousdUnits("100"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("100", ousd);
    await ousd.connect(matt).rebaseOptOut();
    // Transfer will cause a fixed creditsPerToken to be set for mockNonRebasing
    await mockNonRebasing.transfer(await matt.getAddress(), ousdUnits("50"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("50", ousd);
    await expect(matt).has.an.approxBalanceOf("150", ousd);
    await mockNonRebasing.transfer(await matt.getAddress(), ousdUnits("25"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("25", ousd);
    await expect(matt).has.an.approxBalanceOf("175", ousd);
  });

  it("Should maintain the same totalSupply on many transfers between different account types", async () => {
    let {
      ousd,
      matt,
      josh,
      mockNonRebasing,
      mockNonRebasingTwo,
    } = await loadFixture(defaultFixture);

    // Only Matt and Josh have OUSD, give some to contracts
    await ousd.connect(josh).transfer(mockNonRebasing.address, ousdUnits("50"));
    await ousd
      .connect(matt)
      .transfer(mockNonRebasingTwo.address, ousdUnits("50"));

    // Set up accounts
    await ousd.connect(josh).rebaseOptOut();
    const nonRebasingEOA = josh;
    const rebasingEOA = matt;
    const nonRebasingContract = mockNonRebasing;
    await mockNonRebasingTwo.rebaseOptIn();
    const rebasingContract = mockNonRebasingTwo;

    const allAccounts = [
      nonRebasingEOA,
      rebasingEOA,
      nonRebasingContract,
      rebasingContract,
    ];

    const initialTotalSupply = await ousd.totalSupply();
    for (let i = 0; i < 10; i++) {
      for (const fromAccount of allAccounts) {
        const toAccount =
          allAccounts[Math.floor(Math.random() * allAccounts.length)];

        if (typeof fromAccount.transfer === "function") {
          // From account is a contract
          await fromAccount.transfer(
            toAccount.address,
            (await ousd.balanceOf(fromAccount.address)).div(2)
          );
        } else {
          // From account is a EOA
          await ousd
            .connect(fromAccount)
            .transfer(
              toAccount.address,
              (await ousd.balanceOf(fromAccount.address)).div(2)
            );
        }

        await expect(await ousd.totalSupply()).to.equal(initialTotalSupply);
      }
    }
  });

  it("Should revert a transferFrom if an allowance is insufficient", async () => {
    const { ousd, anna, matt } = await loadFixture(defaultFixture);
    // Approve OUSD for transferFrom
    await ousd.connect(matt).approve(anna.getAddress(), ousdUnits("10"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("10"));

    // Do a transferFrom of OUSD
    await expect(
      ousd
        .connect(anna)
        .transferFrom(
          await matt.getAddress(),
          await anna.getAddress(),
          ousdUnits("100")
        )
    ).to.be.revertedWith("SafeMath: subtraction overflow");
  });

  it("Should allow to increase/decrease allowance", async () => {
    const { ousd, anna, matt } = await loadFixture(defaultFixture);
    // Approve OUSD
    await ousd.connect(matt).approve(anna.getAddress(), ousdUnits("1000"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("1000"));

    // Decrease allowance
    await ousd
      .connect(matt)
      .decreaseAllowance(await anna.getAddress(), ousdUnits("100"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("900"));

    // Increase allowance
    await ousd
      .connect(matt)
      .increaseAllowance(await anna.getAddress(), ousdUnits("20"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("920"));

    // Decrease allowance more than what's there
    await ousd
      .connect(matt)
      .decreaseAllowance(await anna.getAddress(), ousdUnits("950"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("0"));
  });
});
