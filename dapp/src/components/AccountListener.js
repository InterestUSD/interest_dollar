import React, { useState, useEffect } from 'react'
import { ethers, BigNumber } from 'ethers'
import { useCookies } from 'react-cookie'
import { useWeb3React } from '@web3-react/core'
import _ from 'lodash'

import AccountStore from 'stores/AccountStore'
import { usePrevious } from 'utils/hooks'
import { isCorrectNetwork } from 'utils/web3'
import { useStoreState } from 'pullstate'
import { setupContracts } from 'utils/contracts'
import { login } from 'utils/account'
import { mergeDeep } from 'utils/utils'
import { displayCurrency } from 'utils/math'

const AccountListener = (props) => {
  const web3react = useWeb3React()
  const { account, chainId, library, active } = web3react
  const prevAccount = usePrevious(account)
  const prevActive = usePrevious(active)
  const [contracts, setContracts] = useState(null)
  const [cookies, setCookie, removeCookie] = useCookies(['loggedIn'])
  const {
    active: userActive,
    refetchUserData,
    refetchStakingData,
  } = useStoreState(AccountStore, (s) => s)
  const prevRefetchStakingData = usePrevious(refetchStakingData)
  const prevRefetchUserData = usePrevious(refetchUserData)
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isProduction = process.env.NODE_ENV === 'production'
  const AIR_DROPPED_STAKE_TYPE = 1

  useEffect(() => {
    if ((prevActive && !active) || prevAccount !== account) {
      AccountStore.update((s) => {
        s.allowances = {}
        s.balances = {}
      })
    }
  }, [active, prevActive, account, prevAccount])

  const loadData = async (contracts) => {
    if (!account) {
      return
    }
    if (!contracts.ousd.provider) {
      console.warn('Contract provider not yet set')
      return
    }
    if (!contracts) {
      console.warn('Contracts not yet loaded!')
      return
    }
    if (!isCorrectNetwork(chainId)) {
      return
    }

    const { ceur, cusd, ousd, vault } = contracts

    const loadbalancesDev = async () => {
      try {
        const [ousdBalance, ceurBalance, cusdBalance] = await Promise.all([
          /* IMPORTANT (!) production uses a different method to load balances. Any changes here need to
           * also happen in production version of this function.
           */
          displayCurrency(await ousd.balanceOf(account), ousd),
          displayCurrency(await ceur.balanceOf(account), ceur),
          displayCurrency(await cusd.balanceOf(account), cusd),
        ])

        AccountStore.update((s) => {
          s.balances = {
            ceur: ceurBalance,
            cusd: cusdBalance,
            ousd: ousdBalance,
          }
        })
      } catch (e) {
        console.trace(
          'AccountListener.js error - can not load account balances: ',
          e
        )
      }
    }

    let jsonCallId = 1
    const loadBalancesProd = async () => {
      const data = {
        jsonrpc: '2.0',
        method: 'alchemy_getTokenBalances',
        params: [account, [ousd.address, ceur.address, cusd.address]],
        id: jsonCallId.toString(),
      }
      jsonCallId++

      const response = await fetch(process.env.ETHEREUM_RPC_PROVIDER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        referrerPolicy: 'no-referrer',
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const responseJson = await response.json()
        const balanceData = {}

        const allContractData = [
          { name: 'ousd', decimals: 18, contract: ousd },
          { name: 'ceur', decimals: 18, contract: ceur },
          { name: 'cusd', decimals: 18, contract: cusd },
        ]

        allContractData.forEach((contractData) => {
          const balanceResponseData = responseJson.result.tokenBalances.filter(
            (tokenBalanceData) =>
              tokenBalanceData.contractAddress.toLowerCase() ===
              contractData.contract.address.toLowerCase()
          )[0]

          if (balanceResponseData.error === null) {
            balanceData[contractData.name] =
              balanceResponseData.tokenBalance === '0x'
                ? '0'
                : ethers.utils.formatUnits(
                    balanceResponseData.tokenBalance,
                    contractData.decimals
                  )
          } else {
            console.error(
              `Can not load balance for ${contractData.name} reason: ${balanceResponseData.error}`
            )
          }
        })

        AccountStore.update((s) => {
          s.balances = balanceData
        })
      } else {
        throw new Error(
          `Could not fetch balances from Alchemy http status: ${response.status}`
        )
      }
    }

    const loadBalances = async () => {
      if (!account) return

      // if (isProduction) {
      //   await loadBalancesProd()
      // } else {
      await loadbalancesDev()
      // }
    }

    const loadAllowances = async () => {
      if (!account) return

      try {
        const [
          ceurAllowance,
          cusdAllowance,
          ousdAllowance,
        ] = await Promise.all([
          displayCurrency(await ceur.allowance(account, vault.address), ceur),
          displayCurrency(await cusd.allowance(account, vault.address), cusd),
          displayCurrency(await ousd.allowance(account, vault.address), ousd),
        ])

        AccountStore.update((s) => {
          s.allowances = {
            ceur: ceurAllowance,
            cusd: cusdAllowance,
            ousd: ousdAllowance,
          }
        })
      } catch (e) {
        console.error(
          'AccountListener.js error - can not load account allowances: ',
          e
        )
      }
    }

    await Promise.all([loadBalances(), loadAllowances()])
  }

  useEffect(() => {
    if (account) {
      login(account, setCookie)
    }

    const setupContractsAndLoad = async () => {
      /* If we have a web3 provider present and is signed into the allowed network:
       * - NODE_ENV === production -> mainnet
       * - NODE_ENV === development -> localhost, forknet
       * then we use that chainId to setup contracts.
       *
       * In other case we still want to have read only capability of the contracts with a general provider
       * so we can fetch `getAPR` from Vault for example to use on marketing pages even when the user is not
       * logged in with a web3 provider.
       *
       */
      let usedChainId, usedLibrary
      if (chainId && isCorrectNetwork(chainId)) {
        usedChainId = chainId
        usedLibrary = library
      } else {
        usedChainId = parseInt(process.env.ETHEREUM_RPC_CHAIN_ID)
        usedLibrary = null
      }

      const contracts = await setupContracts(account, usedLibrary, usedChainId)
      setContracts(contracts)

      setTimeout(() => {
        loadData(contracts)
      }, 1)
    }

    setupContractsAndLoad()
  }, [account, chainId])

  useEffect(() => {
    // trigger a force referch user data when the flag is set by a user
    if (
      (contracts && isCorrectNetwork(chainId),
      refetchUserData && !prevRefetchUserData)
    ) {
      loadData(contracts)
    }
    AccountStore.update((s) => {
      s.refetchUserData = false
    })
  }, [userActive, contracts, refetchUserData, prevRefetchUserData])

  useEffect(() => {
    // trigger a force referch user data when the flag is set by a user
    if (
      (contracts && isCorrectNetwork(chainId),
      refetchStakingData && !prevRefetchStakingData)
    ) {
      loadData(contracts)
    }
    AccountStore.update((s) => {
      s.refetchStakingData = false
    })
  }, [userActive, contracts, refetchStakingData, prevRefetchStakingData])

  useEffect(() => {
    let balancesInterval
    if (contracts && userActive === 'active' && isCorrectNetwork(chainId)) {
      loadData(contracts)

      balancesInterval = setInterval(() => {
        loadData(contracts)
      }, 7000)
    }

    return () => {
      if (balancesInterval) {
        clearInterval(balancesInterval)
      }
    }
  }, [userActive, contracts])

  return ''
}

export default AccountListener
