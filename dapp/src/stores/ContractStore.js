import { Store } from 'pullstate'

const ContractStore = new Store({
  contracts: null,
  apy: null,
  ousdExchangeRates: {
    cusd: {
      mint: 1,
      redeem: 1,
    },
    ceur: {
      mint: 1,
      redeem: 1,
    },
  },
})

export default ContractStore
