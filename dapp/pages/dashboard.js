import React, { useEffect, useState } from 'react'
import { useStoreState } from 'pullstate'
import { ethers } from 'ethers'
import { get } from 'lodash'
import { useWeb3React } from '@web3-react/core'

import Layout from 'components/layout'
import Nav from 'components/Nav'
import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math'
import { displayCurrency } from 'utils/math'

const governorAddress = '0xA202d366B5DB613255871162F3B8502B1DD95d3a'

const Dashboard = ({ locale, onLocale }) => {
  const allowances = useStoreState(AccountStore, s => s.allowances)
  const balances = useStoreState(AccountStore, s => s.balances)

  const account = useStoreState(AccountStore, s => s.address)
  const { chainId } = useWeb3React()

  const { vault, ceur, cusd, ousd} = useStoreState(ContractStore, s => s.contracts || {})
  const isMainnetFork = process.env.NODE_ENV === 'development' && chainId === 42220
  const isProduction = process.env.NODE_ENV === 'production'
  const isGovernor = account && account === governorAddress

  const randomAmount = (multiple = 0) => {
    return String(Math.floor(Math.random() * (999999 * multiple)) / 100 + 1000)
  }

  const mintByCommandLineOption = () => {
    if (isMainnetFork) {
      alert("To grant stable coins go to project's 'contracts' folder and run 'yarn run grant-stable-coins:fork' ")
    }
  }

  const notSupportedOption = () => {
    if (isMainnetFork) {
      alert("Not supported when running main net fork -> 'yarn run node:fork'")
    }
  }

  const clearAllAllowances = async () => {
    notSupportedOption()
    await ceur.decreaseAllowance(
      vault.address,
      ethers.utils.parseUnits(allowances['ceur'], await ceur.decimals())
    )

    await cusd.decreaseAllowance(
      vault.address,
      ethers.utils.parseUnits(allowances['cusd'], await cusd.decimals())
    )

    // await tusd.decreaseAllowance(
    //   vault.address,
    //   ethers.utils.parseUnits(allowances['tusd'], await tusd.decimals())
    // )
  }

  const mintCEUR = async (multiple) => {
    mintByCommandLineOption()
    await ceur.mint(
      ethers.utils.parseUnits(randomAmount(multiple), await ceur.decimals())
    )
  }

  const approveCEUR = async () => {
    notSupportedOption()
    await ceur.approve(
      vault.address,
      ethers.constants.MaxUint256
    )
  }

  const mintCUSD = async (multiple) => {
    mintByCommandLineOption()
    await cusd.mint(
      ethers.utils.parseUnits(randomAmount(multiple), await cusd.decimals())
    )
  }

  const approveCUSD = async () => {
    notSupportedOption()
    await cusd.approve(
      vault.address,
      ethers.constants.MaxUint256
    )
  }


  // const mintTUSD = async (amount) => {
  //   mintByCommandLineOption()
  //   await tusd.mint(
  //     ethers.utils.parseUnits(amount || randomAmount(), await tusd.decimals())
  //   )
  // }

  // const approveTUSD = async () => {
  //   notSupportedOption()
  //   await tusd.approve(
  //     vault.address,
  //     ethers.constants.MaxUint256
  //   )
  // }

  const buyOUSD = async () => {
    await ousd.mint(
      ceur.address,
      ethers.utils.parseUnits('100.0', await ceur.decimals())
    )
  }

  const depositYield = async () => {
    notSupportedOption()
    await ousd.depositYield(
      ceur.address,
      ethers.utils.parseUnits('10.0', await ceur.decimals())
    )
  }

  const unPauseDeposits = async () => {
    notSupportedOption()
    await vault.unpauseDeposits()
  }

  const approveOUSD = async () => {
    notSupportedOption()
    await ousd.approve(
      vault.address,
      ethers.constants.MaxUint256
    )
  }

  const redeemOutputs = async () => {
    const result = await vault.calculateRedeemOutputs(
      ethers.utils.parseUnits(
        "10",
        await ousd.decimals()
      )
    )

    console.log(result)
  }

  const redeemCUSD = async () => {
    await vault.redeemAll(cusd.address)
  }

  const redeemCEUR = async () => {
    await vault.redeemAll(ceur.address)
  }

  const setupSupportAssets = async () => {
    notSupportedOption()
    await vault.supportAsset(
      cusd.address,
      "cUSD"
    )

    await vault.supportAsset(
      ceur.address,
      "cEUR"
    )
  }

  const tableRows = () => {
    return [...Object.keys(currencies), 'ousd'].map((x) => {
      const name = x.toUpperCase()
      const balance = get(balances, x)
      const allowance = Number(get(allowances, x))
      const unlimited = allowance && allowance > Number.MAX_SAFE_INTEGER

      return (
          <tr key={x}>
          <td>{name}</td>
          <td>{unlimited ? 'Unlimited' : (allowance ? 'Some' : 'None')}</td>
          <td>1</td>
          <td>{formatCurrency(balance)}</td>
          <td>{unlimited ? 'Max' : formatCurrency(allowance)}</td>
        </tr>
      )
    })
  }

  // if (process.env.NODE_ENV === 'production') {
  //   return '';
  // }

  return (
    <>
      <Layout locale={locale} onLocale={onLocale} dapp>
        <Nav
          dapp
          locale={locale}
          onLocale={onLocale}
        />
        <div className="my-5">
        {!account && <h1 className="text-white">No account :(</h1>}
        {account && (
          <>
            <h1>Balances</h1>
            <div className="card w25 mb-4">
              <div className="card-body">
                <h5 className="card-title">Current Balance</h5>
                <p className="card-text">{formatCurrency(get(balances, 'ousd'))} OUSD</p>
              </div>
            </div>
            <table className="table table-bordered">
              <thead>
                <tr>
                  <td>Asset</td>
                  <td>Permission</td>
                  <td>Exchange Rate</td>
                  <td>Your Balance</td>
                  <td>Allowance</td>
                </tr>
              </thead>
              <tbody>{tableRows()}</tbody>
            </table>
            <div className="d-flex flex-wrap">
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintCEUR()}>
                Mint 1,000 cEUR
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintCEUR(1)}>
                Mint random cEUR
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintCEUR(10000)}>
                Mint hella cEUR
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveCEUR}>
                Approve cEUR
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={redeemCEUR}>
                Redeem cEUR
              </div>
            </div>
            <div className="d-flex flex-wrap">
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintCUSD()}>
                Mint 1,000 cUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintCUSD(1)}>
                Mint random cUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintCUSD(10000)}>
                Mint hella cUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveCUSD}>
                Approve cUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={redeemCUSD}>
                Redeem cUSD
              </div>
            </div>
            {/*
            <div className="d-flex flex-wrap">
              <div className="btn btn-primary my-4 mr-3" onClick={() => mintTUSD()}>
                Mint TUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveTUSD}>
                Approve TUSD
              </div>
            </div>
            */}
            <div className="d-flex flex-wrap">
              {isGovernor && (
                <div className="btn btn-primary my-4 mr-3" onClick={depositYield}>
                  Deposit $10 Yield
                </div>
              )}
              <div className="btn btn-primary my-4 mr-3" onClick={clearAllAllowances}>
                Clear All Allowances
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={buyOUSD}>
                Buy OUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={unPauseDeposits}>
                Un-Pause Deposits
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={approveOUSD}>
                Approve OUSD
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={setupSupportAssets}>
                Support cUSD & cEUR
              </div>
              <div className="btn btn-primary my-4 mr-3" onClick={redeemOutputs}>
                Calculate Redeem outputs
              </div>
            </div>
          </>
        )}
      </div>
      </Layout>
      <style jsx>{`
        .home {
          padding-top: 80px;
        }

        table {
          background-color: white;
        }

        @media (max-width: 799px) {
          .home {
            padding: 0;
          }
        }
      `}</style>
    </>

  )
}

export default Dashboard

