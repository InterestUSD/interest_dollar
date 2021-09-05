const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const { cusdUnits, loadFixture, isFork } = require("../helpers");

describe("Vault deposit pausing", async () => {
  if (isFork) {
    this.timeout(0);
  }

  it("Governor can pause and unpause", async () => {
    const { anna, governor, vault } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(governor).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });

  it("Strategist can pause and unpause", async () => {
    const { anna, strategist, vault } = await loadFixture(defaultFixture);
    await vault.connect(strategist).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(strategist).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });

  it("Other can not pause and unpause", async () => {
    const { anna, vault } = await loadFixture(defaultFixture);
    await expect(vault.connect(anna).pauseCapital()).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
    await expect(vault.connect(anna).unpauseCapital()).to.be.revertedWith(
      "Caller is not the Strategist or Governor"
    );
  });

  it("Pausing deposits stops mint", async () => {
    const { anna, governor, vault, cusd } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await cusd.connect(anna).approve(vault.address, cusdUnits("50.0"));
    await expect(vault.connect(anna).mint(cusd.address, cusdUnits("50.0"), 0))
      .to.be.reverted;
  });

  it("Pausing deposits stops mintMultiple", async () => {
    const { anna, governor, vault, cusd } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await cusd.connect(anna).approve(vault.address, cusdUnits("50.0"));
    await expect(
      vault.connect(anna).mintMultiple([cusd.address], [cusdUnits("50.0")], 0)
    ).to.be.reverted;
  });

  it("Unpausing deposits allows mint", async () => {
    const { anna, governor, vault, cusd } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(governor).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
    await cusd.connect(anna).approve(vault.address, cusdUnits("50.0"));
    await vault.connect(anna).mint(cusd.address, cusdUnits("50.0"), 0);
  });

  it("Unpausing deposits allows mintMultiple", async () => {
    const { anna, governor, vault, cusd } = await loadFixture(defaultFixture);
    await vault.connect(governor).pauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.true;
    await vault.connect(governor).unpauseCapital();
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
    await cusd.connect(anna).approve(vault.address, cusdUnits("50.0"));
    await vault
      .connect(anna)
      .mintMultiple([cusd.address], [cusdUnits("50.0")], 0);
  });

  it("Deposit pause status can be read", async () => {
    const { anna, vault } = await loadFixture(defaultFixture);
    expect(await vault.connect(anna).capitalPaused()).to.be.false;
  });
});
