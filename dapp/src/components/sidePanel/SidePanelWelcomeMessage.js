import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import { formatCurrency } from 'utils/math'
import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'

const SidePanelWelcomeMessage = () => {
  const ousdExchangeRates = useStoreState(
    ContractStore,
    (s) => s.ousdExchangeRates
  )
  const balances = useStoreState(AccountStore, (s) => s.balances)

  const ousdToBuy = ['cusd', 'ceur']
    .map((coin) => balances[coin] * ousdExchangeRates[coin].mint)
    .reduce((a, b) => a + b)

  return (
    <>
      <div className="side-panel-message">
        <div className="title">{fbt('Welcome!', 'Welcome!')}</div>
        <div className="text">
          {fbt(
            `The Origin Dollar lets you easily convert other stablecoins into OUSD so you can instantly earn yields.`,
            'welcome-message'
          )}{' '}
          {ousdToBuy > 0 &&
            fbt(
              'You can buy up to ~' +
                fbt.param('ousd-coin', formatCurrency(ousdToBuy, 2)) +
                ' OUSD with the ' +
                fbt.param('ceur-coin', formatCurrency(balances['ceur'], 0)) +
                ' cEUR, ' +
                fbt.param('cusd-coin', formatCurrency(balances['cusd'], 0)) +
                ' cUSD in your wallet.',
              'welcome-message-buying-power'
            )}
        </div>
      </div>
      <style jsx>{`
        .side-panel-message {
          width: 100%;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          padding: 15px 20px;
          margin-bottom: 10px;
        }

        .side-panel-message .title {
          font-family: Lato;
          font-size: 14px;
          font-weight: bold;
          color: #183140;
          margin-bottom: 7px;
        }

        .side-panel-message .text {
          font-size: 14px;
          line-height: 1.5;
          color: #8293a4;
        }
      `}</style>
    </>
  )
}

export default SidePanelWelcomeMessage
