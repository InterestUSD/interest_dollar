import { ethers, Contract, BigNumber } from 'ethers'

import ContractStore from 'stores/ContractStore'
import CoinStore from 'stores/CoinStore'
import { aprToApy } from 'utils/math'
import { displayCurrency } from 'utils/math'
import { sleep } from 'utils/utils'

import AccountStore from 'stores/AccountStore'
import YieldStore from 'stores/YieldStore'
import addresses from 'constants/contractAddresses'
import erc20Abi from 'constants/mainnetAbi/erc20.json'

export async function setupContracts(account, library, chainId) {
  // without an account logged in contracts are initialized with JsonRpcProvider and
  // can operate in a read-only mode
  const jsonRpcProvider = new ethers.providers.JsonRpcProvider(
    process.env.ETHEREUM_RPC_PROVIDER,
    { chainId: parseInt(process.env.ETHEREUM_RPC_CHAIN_ID) }
  )

  let provider = jsonRpcProvider

  let walletConnected = false

  // if web3 account signed in change the dapp's "general provider" with the user's web3 provider
  if (account && library) {
    walletConnected = true
    provider = library.getSigner(account)
  }

  const getContract = (address, abi, overrideProvider) => {
    return new ethers.Contract(
      address,
      abi,
      overrideProvider ? overrideProvider : provider
    )
  }

  let network
  try {
    const nt =
      chainId == 42220
        ? 'prod.network'
        : chainId == 44787
        ? 'network.alfajores'
        : 'network'
    network = require(`../../${nt}.json`)
  } catch (e) {
    console.error('network.json file not present')
    // contract addresses not present no need to continue initialisation
    return
  }

  const contracts = {}
  for (const key in network.contracts) {
    // Use Proxy address if one exists
    const address = network.contracts[`${key}Proxy`]
      ? network.contracts[`${key}Proxy`].address
      : network.contracts[key].address

    contracts[key] = new ethers.Contract(
      address,
      network.contracts[key].abi,
      library ? library.getSigner(account) : null
    )
  }

  const ousdProxy = contracts['OUSDProxy']
  const vaultProxy = contracts['VaultProxy']

  let cusd, ceur, ousd, vault

  let iVaultJson, iErc20Json, iUniPairJson

  try {
    iVaultJson = require('../../abis/IVault.json')
    iErc20Json = require('../../abis/IERC20.json')
    iUniPairJson = require('../../abis/IUniswapV2Pair.json')
  } catch (e) {
    console.error(`Can not find contract artifact file: `, e)
  }

  vault = getContract(vaultProxy.address, iVaultJson.abi)

  ousd = getContract(ousdProxy.address, network.contracts['OUSD'].abi)
  if (chainId == 31337 || chainId == 44787) {
    cusd = contracts['MockCUSD']
    ceur = contracts['MockCEUR']
  } else {
    cusd = getContract(addresses.mainnet.CUSD, erc20Abi.abi)
    ceur = getContract(addresses.mainnet.CEUR, erc20Abi.abi)
  }

  const fetchExchangeRates = async () => {
    const coins = {
      cusd: cusd,
      ceur: ceur,
    }
    const ousdExchangeRates = {
      ...ContractStore.currentState.ousdExchangeRates,
    }
    const userActive = AccountStore.currentState.active === 'active'
    // do not fetch anything if the user is not active
    if (!userActive) {
      return
    }

    for (const name in coins) {
      const coin = coins[name]
      try {
        const priceBNMint = await vault.priceUSDMint(coin.address)
        const priceBNRedeem = await vault.priceUSDRedeem(coin.address)
        // Oracle returns with 18 decimal places
        // Also, convert that to USD/<coin> format
        const priceMint = Number(priceBNMint.toString()) / 1000000000000000000
        const priceRedeem =
          Number(priceBNRedeem.toString()) / 1000000000000000000
        ousdExchangeRates[name] = {
          mint: priceMint,
          redeem: priceRedeem,
        }
      } catch (err) {
        console.error('Failed to fetch exchange rate', name, err)
      }
    }

    ContractStore.update((store) => {
      store.ousdExchangeRates = { ...ousdExchangeRates }
    })
  }

  const fetchAPY = async () => {
    try {
      // const response = await fetch(process.env.APR_ANALYTICS_ENDPOINT)
      // if (response.ok) {
      //   const json = await response.json()
      //   const apy = aprToApy(parseFloat(json.apr), 7)
      // ContractStore.update((s) => {
      //   s.apy = apy
      // })
      // }
      ContractStore.update((s) => {
        s.apy = 'N/A'
      })
    } catch (err) {
      console.error('Failed to fetch APY', err)
    }
  }

  const fetchCreditsPerToken = async () => {
    try {
      const response = await fetch(process.env.CREDITS_ANALYTICS_ENDPOINT)
      if (response.ok) {
        const json = await response.json()
        YieldStore.update((s) => {
          s.currentCreditsPerToken = parseFloat(json.current_credits_per_token)
          s.nextCreditsPerToken = parseFloat(json.next_credits_per_token)
        })
      }
    } catch (err) {
      console.error('Failed to fetch credits per token', err)
    }
  }

  const fetchCreditsBalance = async () => {
    try {
      if (!walletConnected) {
        return
      }
      const credits = await ousd.creditsBalanceOf(account)
      AccountStore.update((s) => {
        s.creditsBalanceOf = ethers.utils.formatUnits(credits[0], 18)
      })
    } catch (err) {
      console.error('Failed to fetch credits balance', err)
    }
  }

  const callWithDelay = () => {
    setTimeout(async () => {
      Promise.all([
        fetchExchangeRates(),
        // fetchCreditsPerToken(),
        fetchCreditsBalance(),
        fetchAPY(),
      ])
    }, 2)
  }

  callWithDelay()

  if (window.fetchInterval) {
    clearInterval(fetchInterval)
  }

  if (walletConnected) {
    // execute in parallel and repeat in an interval
    window.fetchInterval = setInterval(() => {
      callWithDelay()
    }, 20000)
  }

  const contractsToExport = {
    cusd,
    ceur,
    ousd,
    vault,
  }

  ContractStore.update((s) => {
    s.contracts = contractsToExport
  })

  await afterSetup(contractsToExport)

  return contractsToExport
}

// calls to be executed only once after setup
const afterSetup = async ({ vault }) => {
  const redeemFee = await vault.redeemFeeBps()
  YieldStore.update((s) => {
    s.redeemFee = parseFloat(ethers.utils.formatUnits(redeemFee, 4))
  })
}
