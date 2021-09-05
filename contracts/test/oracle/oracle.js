const { defaultFixture } = require("../_fixture");

const {
  ousdUnits,
  setOracleTokenPriceCusd,
  loadFixture,
} = require("../helpers");
const { expect } = require("chai");

/*
 * Because the oracle code is so tightly intergrated into the vault,
 * the actual tests for the core oracle features are just a part of the vault tests.
 */

describe("Oracle", async () => {
  describe("Oracle read methods for DAPP", () => {
    it("should read the mint price", async () => {
      const { vault, ceur } = await loadFixture(defaultFixture);
      const tests = ["1.80", "1.00", "1.15"];
      for (const test of tests) {
        const price = test;
        await setOracleTokenPriceCusd(ceur.address, price);
        expect(await vault.priceUSDMint(ceur.address)).to.equal(
          ousdUnits(price)
        );
      }
    });

    it("should read the redeem price", async () => {
      const { vault, ceur, oracleRouter } = await loadFixture(defaultFixture);
      const tests = [
        ["0.80", "1.00"],
        ["1.00", "1.00"],
        ["1.15", "1.15"],
      ];
      for (const test of tests) {
        const [actual, expectedRead] = test;
        await setOracleTokenPriceCusd(ceur.address, actual);
        expect(await vault.priceUSDRedeem(ceur.address)).to.equal(
          ousdUnits(expectedRead)
        );
      }
    });
  });
});
