import React, { useState, useEffect, useRef } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { ethers, BigNumber } from 'ethers'

import AccountStore from 'stores/AccountStore'
import TransactionStore from 'stores/TransactionStore'
import ContractStore from 'stores/ContractStore'
import CoinRow from 'components/buySell/CoinRow'
import SellWidget from 'components/buySell/SellWidget'
import ApproveModal from 'components/buySell/ApproveModal'
import AddOUSDModal from 'components/buySell/AddOUSDModal'
import ErrorModal from 'components/buySell/ErrorModal'
import DisclaimerTooltip from 'components/buySell/DisclaimerTooltip'
import ApproveCurrencyInProgressModal from 'components/buySell/ApproveCurrencyInProgressModal'
import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math'
import { sleep } from 'utils/utils'
import { providersNotAutoDetectingOUSD, providerName } from 'utils/web3'
import withRpcProvider from 'hoc/withRpcProvider'
import usePriceTolerance from 'hooks/usePriceTolerance'
import BuySellModal from 'components/buySell/BuySellModal'
import { isMobileMetaMask } from 'utils/device'
import { getUserSource } from 'utils/user'
import Dropdown from 'components/Dropdown'

import analytics from 'utils/analytics'
import { truncateDecimals } from '../../utils/math'

const BuySellWidget = ({
  storeTransaction,
  storeTransactionError,
  rpcProvider,
}) => {
  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const pendingMintTransactions = useStoreState(TransactionStore, (s) =>
    s.transactions.filter((tx) => !tx.mined && tx.type === 'mint')
  )
  const balances = useStoreState(AccountStore, (s) => s.balances)
  const ousdExchangeRates = useStoreState(
    ContractStore,
    (s) => s.ousdExchangeRates
  )
  const [displayedOusdToSell, setDisplayedOusdToSell] = useState('')
  const [ousdToSell, setOusdToSell] = useState(0)
  const [sellFormErrors, setSellFormErrors] = useState({})
  const [sellAllActive, setSellAllActive] = useState(false)
  const [generalErrorReason, setGeneralErrorReason] = useState(null)
  const [sellWidgetIsCalculating, setSellWidgetIsCalculating] = useState(false)
  const [sellWidgetCoinSplit, setSellWidgetCoinSplit] = useState([])
  // redeem now, waiting-user, waiting-network
  const [sellWidgetState, setSellWidgetState] = useState('redeem now')
  const [sellWidgetSplitsInterval, setSellWidgetSplitsInterval] = useState(null)
  // buy/modal-buy, waiting-user/modal-waiting-user, waiting-network/modal-waiting-network
  const [buyWidgetState, setBuyWidgetState] = useState('buy')
  const [priceToleranceOpen, setPriceToleranceOpen] = useState(false)
  const [tab, setTab] = useState('buy')
  const [resetStableCoins, setResetStableCoins] = useState(false)
  const [cusdOusd, setCusdOusd] = useState(0)
  const [ceurOusd, setCeurOusd] = useState(0)
  const [cusdActive, setCusdActive] = useState(false)
  const [ceurActive, setCeurActive] = useState(false)
  const [buyErrorToDisplay, setBuyErrorToDisplay] = useState(false)
  const [cusd, setCusd] = useState(0)
  const [ceur, setCeur] = useState(0)
  const [showApproveModal, _setShowApproveModal] = useState(false)
  const [currenciesNeedingApproval, setCurrenciesNeedingApproval] = useState([])
  const {
    vault: vaultContract,
    ceur: ceurContract,
    cusd: cusdContract,
    ousd: ousdContract,
  } = useStoreState(ContractStore, (s) => s.contracts || {})
  const [buyFormErrors, setBuyFormErrors] = useState({})
  const [buyFormWarnings, setBuyFormWarnings] = useState({})
  const totalStablecoins =
    parseFloat(balances['cusd']) + parseFloat(balances['ceur'])
  const stableCoinsLoaded =
    typeof balances['cusd'] === 'string' && typeof balances['ceur'] === 'string'
  const totalOUSD = cusdOusd + ceurOusd
  const {
    setPriceToleranceValue,
    priceToleranceValue,
    dropdownToleranceOptions,
  } = usePriceTolerance('mint')
  const totalOUSDwithTolerance =
    totalOUSD -
    (totalOUSD * (priceToleranceValue ? priceToleranceValue : 0)) / 100
  const buyFormHasErrors = Object.values(buyFormErrors).length > 0
  const buyFormHasWarnings = Object.values(buyFormWarnings).length > 0
  const connectorIcon = useStoreState(AccountStore, (s) => s.connectorIcon)
  const downsized = [cusdOusd, ceurOusd].some((num) => num > 999999)
  const addOusdModalState = useStoreState(
    AccountStore,
    (s) => s.addOusdModalState
  )
  const providerNotAutoDetectOUSD = providersNotAutoDetectingOUSD().includes(
    providerName()
  )

  // check if form should display any errors
  useEffect(() => {
    const newFormErrors = {}
    if (parseFloat(cusd) > parseFloat(truncateDecimals(balances['cusd']))) {
      newFormErrors.cusd = 'not_have_enough'
    }
    if (parseFloat(ceur) > parseFloat(truncateDecimals(balances['ceur']))) {
      newFormErrors.ceur = 'not_have_enough'
    }

    setBuyFormErrors(newFormErrors)
  }, [cusd, ceur, pendingMintTransactions])

  // check if form should display any warnings
  useEffect(() => {
    if (pendingMintTransactions.length > 0) {
      const allPendingCoins = pendingMintTransactions
        .map((tx) => tx.data)
        .reduce(
          (a, b) => {
            return {
              cusd: parseFloat(a.cusd) + parseFloat(b.cusd),
              ceur: parseFloat(a.ceur) + parseFloat(b.ceur),
            }
          },
          {
            cusd: 0,
            ceur: 0,
          }
        )

      const newFormWarnings = {}
      if (
        parseFloat(cusd) >
        parseFloat(balances['cusd']) - parseFloat(allPendingCoins.cusd)
      ) {
        newFormWarnings.cusd = 'not_have_enough'
      }
      if (
        parseFloat(ceur) >
        parseFloat(balances['ceur']) - parseFloat(allPendingCoins.ceur)
      ) {
        newFormWarnings.ceur = 'not_have_enough'
      }

      setBuyFormWarnings(newFormWarnings)
    } else {
      setBuyFormWarnings({})
    }
  }, [cusd, ceur, pendingMintTransactions])

  const errorMap = [
    {
      errorCheck: (err) => {
        return err.name === 'EthAppPleaseEnableContractData'
      },
      friendlyMessage: fbt(
        'Contract data not enabled. Go to Ethereum app Settings and set "Contract Data" to "Allowed"',
        'Enable contract data'
      ),
    },
    {
      errorCheck: (err) => {
        return err.message.includes(
          'Failed to sign with Ledger device: U2F DEVICE_INELIGIBL'
        )
      },
      friendlyMessage: fbt(
        'Can not detect ledger device. Please make sure your Ledger is unlocked and Ethereum App is opened.',
        'See ledger connected'
      ),
    },
  ]

  const onMintingError = (error) => {
    if (errorMap.filter((eMap) => eMap.errorCheck(error)).length > 0) {
      setBuyErrorToDisplay(error)
    }
  }

  /* Mobile MetamMsk app has this bug where it doesn't throw an exception on contract
   * call when user rejects the transaction. Interestingly if you quit and re-enter
   * the app after you reject the transaction the correct error with "user rejected..."
   * message is thrown.
   *
   * As a workaround we hide the "waiting for user" modal after 5 seconds no matter what the
   * user does if environment is the mobile metamask.
   */
  const mobileMetaMaskHack = (prependStage) => {
    if (isMobileMetaMask()) {
      setTimeout(() => {
        setBuyWidgetState(`${prependStage}buy`)
      }, 5000)
    }
  }

  const mintAmountAnalyticsObject = () => {
    const returnObject = {}
    const coins = [
      {
        name: 'ceur',
        amount: ceur,
        decimals: 18,
      },
      {
        name: 'cusd',
        amount: cusd,
        decimals: 18,
      },
    ]

    let total = 0
    coins.forEach((coin) => {
      if (coin.amount > 0) {
        const amount = parseFloat(coin.amount)
        total += amount
        returnObject[coin.name] = amount
      }
    })
    returnObject.totalStablecoins = total
    return returnObject
  }

  const onMintOusd = async (prependStage) => {
    const mintedCoins = []
    setBuyWidgetState(`${prependStage}waiting-user`)
    try {
      const mintAddresses = []
      const mintAmounts = []
      let minMintAmount = ethers.utils.parseUnits(
        totalOUSDwithTolerance.toString(),
        '18'
      )

      const addMintableToken = async (amount, contract, symbol) => {
        if (amount <= 0) {
          // Nothing to add
          return
        }

        mintAddresses.push(contract.address)
        mintAmounts.push(
          ethers.utils
            .parseUnits(amount.toString(), await contract.decimals())
            .toString()
        )

        mintedCoins.push(symbol)
      }

      await addMintableToken(ceur, ceurContract, 'ceur')

      await addMintableToken(cusd, cusdContract, 'cusd')

      const absoluteGasLimitBuffer = 20000
      const percentGasLimitBuffer = 0.1

      let gasEstimate, gasLimit, result
      mobileMetaMaskHack(prependStage)

      analytics.track('Mint attempt started', {
        coins: mintedCoins.join(','),
        ...mintAmountAnalyticsObject(),
      })

      if (mintAddresses.length === 1) {
        gasEstimate = (
          await vaultContract.estimateGas.mint(
            mintAddresses[0],
            mintAmounts[0],
            minMintAmount
          )
        ).toNumber()
        gasLimit = parseInt(
          gasEstimate +
            Math.max(
              absoluteGasLimitBuffer,
              gasEstimate * percentGasLimitBuffer
            )
        )
        result = await vaultContract.mint(
          mintAddresses[0],
          mintAmounts[0],
          minMintAmount,
          {
            gasLimit,
          }
        )
      } else {
        gasEstimate = (
          await vaultContract.estimateGas.mintMultiple(
            mintAddresses,
            mintAmounts,
            minMintAmount
          )
        ).toNumber()
        gasLimit = parseInt(
          gasEstimate +
            Math.max(
              absoluteGasLimitBuffer,
              gasEstimate * percentGasLimitBuffer
            )
        )
        result = await vaultContract.mintMultiple(
          mintAddresses,
          mintAmounts,
          minMintAmount,
          {
            gasLimit,
          }
        )
      }

      setBuyWidgetState(`${prependStage}waiting-network`)
      onResetStableCoins()
      storeTransaction(result, `mint`, mintedCoins.join(','), {
        ceur,
        cusd,
        ousd: totalOUSD,
      })
      setStoredCoinValuesToZero()

      const receipt = await rpcProvider.waitForTransaction(result.hash)
      analytics.track('Mint tx succeeded', {
        coins: mintedCoins.join(','),
        // we already store utm_source as user property. This is for easier analytics
        utm_source: getUserSource(),
        ousd: totalOUSD,
        minMintAmount,
        priceTolerance: priceToleranceValue,
        ...mintAmountAnalyticsObject(),
      })
      if (localStorage.getItem('addOUSDModalShown') !== 'true') {
        AccountStore.update((s) => {
          s.addOusdModalState = 'waiting'
        })
      }
    } catch (e) {
      // 4001 code happens when a user rejects the transaction
      if (e.code !== 4001) {
        await storeTransactionError(`mint`, mintedCoins.join(','))
        analytics.track('Mint tx failed', {
          coins: mintedCoins.join(','),
          ...mintAmountAnalyticsObject(),
        })
      } else {
        analytics.track('Mint tx canceled', {
          coins: mintedCoins.join(','),
          ...mintAmountAnalyticsObject(),
        })
      }

      onMintingError(e)
      console.error('Error minting ousd! ', e)
    }
    setBuyWidgetState(`buy`)
  }

  // kind of ugly but works
  const onResetStableCoins = () => {
    setResetStableCoins(true)
    setTimeout(() => {
      setResetStableCoins(false)
    }, 100)
  }

  const setStoredCoinValuesToZero = () => {
    Object.values(currencies).forEach(
      (c) => (localStorage[c.localStorageSettingKey] = '0')
    )
  }

  const setShowApproveModal = (show) => {
    _setShowApproveModal(show)
    if (show) {
      analytics.track('Show Approve Modal', mintAmountAnalyticsObject())
    } else {
      analytics.track('Hide Approve Modal')
    }
  }

  const onBuyNow = async (e) => {
    e.preventDefault()
    analytics.track('Mint Now clicked', {
      ...mintAmountAnalyticsObject(),
      location: 'Mint widget',
    })

    const allowancesNotLoaded = ['cusd', 'ceur'].filter(
      (coin) => !allowances[coin] || Number.isNaN(parseFloat(allowances[coin]))
    )

    if (allowancesNotLoaded.length > 0) {
      setGeneralErrorReason(
        fbt(
          'Unable to load allowances for ' +
            fbt.param(
              'coin-name(s)',
              allowancesNotLoaded.join(', ').toUpperCase()
            ) +
            '.',
          'Allowance load error'
        )
      )
      return
    }

    const needsApproval = []

    const checkForApproval = (name, selectedAmount) => {
      // float conversion is not ideal, but should be good enough for allowance check
      if (
        selectedAmount > 0 &&
        parseFloat(allowances[name]) < parseFloat(selectedAmount)
      ) {
        needsApproval.push(name)
      }
    }

    checkForApproval('cusd', cusd)
    checkForApproval('ceur', ceur)
    setCurrenciesNeedingApproval(needsApproval)
    if (needsApproval.length > 0) {
      setShowApproveModal(true)
    } else {
      await onMintOusd('')
    }
  }

  let currenciesActive = [
    {
      name: 'ceur',
      active: ceurActive,
      amount: ceur,
    },
    {
      name: 'cusd',
      active: cusdActive,
      amount: cusd,
    },
  ]
    .filter((currency) => currency.active && currency.amount > 0)
    .map((currency) => currency.name)

  return (
    <>
      <div className="buy-sell-widget d-flex flex-column flex-grow">
        {/* If approve modal is not shown and transactions are pending show
          the pending approval transactions modal */}
        {!showApproveModal && <ApproveCurrencyInProgressModal />}
        {addOusdModalState === 'show' && providerNotAutoDetectOUSD && (
          <AddOUSDModal
            onClose={(e) => {
              localStorage.setItem('addOUSDModalShown', 'true')
              AccountStore.update((s) => {
                s.addOusdModalState = 'none'
              })
            }}
          />
        )}
        {showApproveModal && (
          <ApproveModal
            currenciesNeedingApproval={currenciesNeedingApproval}
            currenciesActive={currenciesActive}
            mintAmountAnalyticsObject={mintAmountAnalyticsObject()}
            onClose={(e) => {
              e.preventDefault()
              // do not close modal if in network or user waiting state
              if ('buy' === buyWidgetState) {
                setShowApproveModal(false)
              }
            }}
            onFinalize={async () => {
              await onMintOusd('modal-')
              setShowApproveModal(false)
            }}
            buyWidgetState={buyWidgetState}
            onMintingError={onMintingError}
          />
        )}
        {generalErrorReason && (
          <ErrorModal
            reason={generalErrorReason}
            showRefreshButton={true}
            onClose={() => {}}
          />
        )}
        {buyErrorToDisplay && (
          <ErrorModal
            error={buyErrorToDisplay}
            errorMap={errorMap}
            onClose={() => {
              setBuyErrorToDisplay(false)
            }}
          />
        )}
        {buyWidgetState === 'waiting-user' && (
          <BuySellModal
            content={
              <div className="d-flex align-items-center justify-content-center">
                <img
                  className="waiting-icon"
                  src={`/images/${connectorIcon}`}
                />
                {fbt(
                  'Waiting for you to confirm...',
                  'Waiting for you to confirm...'
                )}
              </div>
            }
          />
        )}
        <div className="tab-navigation">
          <a
            onClick={(e) => {
              e.preventDefault()
              setTab('buy')
            }}
            className={`${tab === 'buy' ? 'active' : ''}`}
          >
            {fbt('Mint OUSD', 'Mint OUSD')}
          </a>
          <a
            onClick={(e) => {
              e.preventDefault()
              setTab('sell')
            }}
            className={`${tab === 'sell' ? 'active' : ''}`}
          >
            {fbt('Redeem OUSD', 'Redeem OUSD')}
          </a>
        </div>
        {tab === 'buy' && !parseFloat(totalStablecoins) && (
          <div className="no-coins flex-grow d-flex flex-column align-items-center justify-content-center">
            <div className="d-flex logos">
              <img src="/images/ceur-icon.svg" alt="cEUR logo" />
              <img src="/images/cusd-icon.svg" alt="cUSD logo" />
            </div>
            {!stableCoinsLoaded && (
              <h2>{fbt('Loading balances...', 'Loading balances...')}</h2>
            )}
            {stableCoinsLoaded && (
              <>
                <h2>
                  {fbt('You have no stablecoins', 'You have no stablecoins')}
                </h2>
                <p>
                  {fbt(
                    'Get cEUR or cUSD to mint OUSD.',
                    'Get cEUR or cUSD to mint OUSD.'
                  )}
                </p>
              </>
            )}
            {stableCoinsLoaded && (
              <a
                href="https://app.ubeswap.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-clear-blue btn-lg get-coins"
              >
                <img
                  src="/images/uniswap-icon.svg"
                  alt="Ubeswap logo"
                  className="mr-3"
                />
                <div>{fbt('Visit Ubeswap', 'Visit Ubeswap')}</div>
              </a>
            )}
          </div>
        )}
        {tab === 'buy' && !!parseFloat(totalStablecoins) && (
          <div className="coin-table">
            <div className="header d-flex align-items-end">
              <div>{fbt('Stablecoin', 'Stablecoin')}</div>
              <div className="d-flex d-md-none ml-auto pr-2">
                {fbt('OUSD Amount', 'OUSD Amount')}
              </div>
              <div className="d-md-flex flex-grow d-none">
                <div className="col-3 info d-flex align-items-end justify-content-end text-right balance pr-0">
                  {fbt('Exchange', 'Exchange Rate')}
                </div>
                <div className="col-4 info d-flex align-items-end justify-content-end text-right balance pr-0">
                  {fbt('Balance', 'Balance')}
                </div>
                <div className="col-5 currency d-flex align-items-end justify-content-end text-right">
                  {fbt('OUSD Amount', 'OUSD Amount')}
                </div>
              </div>
            </div>
            <CoinRow
              coin="ceur"
              formError={buyFormErrors['ceur']}
              formWarning={buyFormWarnings['ceur']}
              onOusdChange={setCeurOusd}
              onActive={setCeurActive}
              exchangeRate={ousdExchangeRates['ceur'].mint}
              onCoinChange={setCeur}
              reset={resetStableCoins}
              downsized={downsized}
            />
            <CoinRow
              coin="cusd"
              formError={buyFormErrors['cusd']}
              formWarning={buyFormWarnings['cusd']}
              onOusdChange={setCusdOusd}
              onActive={setCusdActive}
              exchangeRate={ousdExchangeRates['cusd'].mint}
              onCoinChange={setCusd}
              reset={resetStableCoins}
              downsized={downsized}
            />
            <div className="horizontal-break" />
            <div className="ousd-section d-flex justify-content-between">
              <div className="ousd-estimation d-flex align-items-center justify-content-start w-100">
                <div className="ousd-icon align-items-center justify-content-center d-flex">
                  <img
                    src="/images/currency/ousd-token.svg"
                    alt="OUSD token icon"
                  />
                </div>
                <div className="d-flex flex-column w-100 h-150">
                  <div className="d-flex bottom-border">
                    <div className="approx-purchase d-flex align-items-center justify-content-start">
                      <div className="mr-2 grey-bold">
                        {fbt('Estimated amount', 'Estimated amount')}
                      </div>
                      <DisclaimerTooltip
                        id="howPurchaseCalculatedPopover"
                        smallIcon
                        text={fbt(
                          'You may receive more or less OUSD than estimated. The amount will be determined by stablecoin exchange rates when your transaction is confirmed.',
                          'You may receive more or less OUSD than estimated. The amount will be determined by stablecoin exchange rates when your transaction is confirmed.'
                        )}
                      />
                    </div>
                    <div className="value ml-auto">
                      {formatCurrency(totalOUSD, 2, true)}
                    </div>
                  </div>
                  <div className="d-flex flex-column flex-md-row tolerance-holder">
                    <div className="col-12 col-md-6 border-lg-right border-md-bottom grey-bold d-flex justify-content-between">
                      <div className="d-flex min-h-42">
                        <div className="mr-2 d-flex align-items-center">
                          {fbt('Price tolerance', 'Price tolerance')}
                        </div>
                        <DisclaimerTooltip
                          id="howPriceTolerance"
                          className="align-items-center"
                          smallIcon
                          text={fbt(
                            'Much like slippage, exchange rate movement can cause you to receive less OUSD than expected. The price tolerance is the maximum reduction in OUSD that you are willing to accept. If exchange rates fall below this threshold, your transaction will revert.',
                            'Much like slippage, exchange rate movement can cause you to receive less OUSD than expected. The price tolerance is the maximum reduction in OUSD that you are willing to accept. If exchange rates fall below this threshold, your transaction will revert.'
                          )}
                        />
                      </div>
                      <Dropdown
                        className="d-flex align-items-center min-h-42"
                        content={
                          <div className="d-flex flex-column dropdown-menu show">
                            {dropdownToleranceOptions.map((toleranceOption) => {
                              return (
                                <div
                                  key={toleranceOption}
                                  className={`price-tolerance-option ${
                                    priceToleranceValue === toleranceOption
                                      ? 'selected'
                                      : ''
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setPriceToleranceValue(toleranceOption)
                                    setPriceToleranceOpen(false)
                                  }}
                                >
                                  {toleranceOption}%
                                </div>
                              )
                            })}
                          </div>
                        }
                        open={priceToleranceOpen}
                        onClose={() => setPriceToleranceOpen(false)}
                      >
                        <div
                          className="price-tolerance-selected d-flex"
                          onClick={(e) => {
                            setPriceToleranceOpen(!priceToleranceOpen)
                          }}
                        >
                          <div>
                            {priceToleranceValue
                              ? `${priceToleranceValue}%`
                              : '...'}
                          </div>
                          <div>
                            <img
                              className="tolerance-caret"
                              src="/images/caret-left-grey.svg"
                            />
                          </div>
                        </div>
                      </Dropdown>
                    </div>
                    <div className="col-12 col-md-6 grey-bold d-flex justify-content-between">
                      <div className="d-flex min-h-42">
                        <div className="mr-2 d-flex align-items-center">
                          {fbt('Min. received', 'Min. received')}
                        </div>
                        <DisclaimerTooltip
                          id="howPriceTolerance"
                          className="align-items-center"
                          smallIcon
                          text={fbt(
                            'You will receive at least this amount of OUSD or your transaction will revert. The exact amount of OUSD will be determined by exchange rates when your transaction is confirmed.',
                            'You will receive at least this amount of OUSD or your transaction will revert. The exact amount of OUSD will be determined by exchange rates when your transaction is confirmed.'
                          )}
                        />
                      </div>
                      <div className="d-flex align-items-center min-h-42">
                        {formatCurrency(totalOUSDwithTolerance, 2, true)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="actions d-flex flex-column flex-md-row justify-content-md-between">
              <div>
                {buyFormHasErrors ? (
                  <div className="error-box d-flex align-items-center justify-content-center">
                    {fbt(
                      'You don’t have enough ' +
                        fbt.param(
                          'coins',
                          Object.keys(buyFormErrors).join(', ').toUpperCase()
                        ),
                      'You dont have enough stablecoins'
                    )}
                  </div>
                ) : buyFormHasWarnings ? (
                  <div className="warning-box d-flex align-items-center justify-content-center">
                    {fbt(
                      'Some of the needed ' +
                        fbt.param(
                          'coins',
                          Object.keys(buyFormWarnings).join(', ').toUpperCase()
                        ) +
                        ' is in pending transactions.',
                      'Some of needed coins are pending'
                    )}
                  </div>
                ) : null}
              </div>
              <button
                disabled={buyFormHasErrors || buyFormHasWarnings || !totalOUSD}
                className="btn-blue buy-button"
                onClick={onBuyNow}
              >
                {fbt('Mint Now', 'Mint Now')}
              </button>
            </div>
          </div>
        )}
        {tab === 'sell' && (
          <SellWidget
            ousdToSell={ousdToSell}
            setOusdToSell={setOusdToSell}
            displayedOusdToSell={displayedOusdToSell}
            setDisplayedOusdToSell={setDisplayedOusdToSell}
            sellFormErrors={sellFormErrors}
            setSellFormErrors={setSellFormErrors}
            sellAllActive={sellAllActive}
            setSellAllActive={setSellAllActive}
            storeTransaction={storeTransaction}
            storeTransactionError={storeTransactionError}
            sellWidgetCoinSplit={sellWidgetCoinSplit}
            setSellWidgetCoinSplit={setSellWidgetCoinSplit}
            sellWidgetState={sellWidgetState}
            setSellWidgetState={setSellWidgetState}
            sellWidgetIsCalculating={sellWidgetIsCalculating}
            setSellWidgetIsCalculating={setSellWidgetIsCalculating}
            sellWidgetSplitsInterval={sellWidgetSplitsInterval}
            setSellWidgetSplitsInterval={setSellWidgetSplitsInterval}
            toBuyTab={() => {
              setTab('buy')
            }}
          />
        )}
      </div>
      <style jsx>{`
        .buy-sell-widget {
          margin: 0px -1px -1px -1px;
          border-radius: 0px 0px 10px 10px;
          border: solid 1px #cdd7e0;
          background-color: #fafbfc;
          min-height: 445px;
          padding: 35px 40px 40px 40px;
          position: relative;
        }

        .buy-sell-widget .header {
          font-size: 12px;
          font-weight: bold;
          color: #8293a4;
          margin-top: 18px;
          margin-bottom: 9px;
        }

        .buy-sell-widget .header > :first-of-type {
          width: 190px;
        }

        .buy-sell-widget .header > :last-of-type {
          margin-left: 10px;
          width: 350px;
        }

        .buy-sell-widget .tab-navigation a {
          font-size: 14px;
          font-weight: bold;
          color: #1a82ff;
          padding-bottom: 5px;
          margin-right: 40px;
          cursor: pointer;
          position: relative;
          z-index: 2;
        }

        .buy-sell-widget .tab-navigation a.active {
          color: #183140;
          border-bottom: solid 1px #183140;
        }

        .horizontal-break {
          width: 100%;
          height: 1px;
          background-color: #dde5ec;
          margin-top: 20px;
          margin-bottom: 20px;
        }

        .buy-sell-widget .ousd-section {
          margin-bottom: 31px;
        }

        .buy-sell-widget .ousd-section .approx-purchase {
          min-width: 190px;
          padding: 7px 14px;
        }

        .buy-sell-widget .ousd-estimation {
          width: 350px;
          min-height: 85px;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          background-color: #f2f3f5;
          padding: 0;
        }

        .price-tolerance-selected {
          cursor: pointer;
        }

        .buy-sell-widget .ousd-section .grey-bold {
          font-size: 12px;
          font-weight: bold;
          color: #8293a4;
        }

        .buy-sell-widget .ousd-icon {
          border-right: solid 1px #cdd7e0;
          height: 100%;
          min-width: 70px;
          width: 70px;
        }

        .buy-sell-widget .ousd-icon img {
          height: 30px;
          width: 30px;
        }

        .ousd-estimation .bottom-border {
          border-bottom: solid 1px #cdd7e0;
        }

        .ousd-estimation .border-lg-right {
          border-right: solid 1px #cdd7e0;
        }

        .buy-sell-widget .ousd-estimation .value {
          font-size: 18px;
          color: black;
          padding: 7px 14px;
        }

        .buy-sell-widget .ousd-estimation .balance {
          font-size: 12px;
          color: #8293a4;
        }

        .tolerance-caret {
          width: 5px;
          height: 7px;
          transform: rotate(270deg);
          margin-left: 6px;
        }

        .tolerance-holder {
          height: 100%;
        }

        .min-h-42 {
          min-height: 42px;
        }

        .error-box {
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #183140;
          border-radius: 5px;
          border: solid 1px #ed2a28;
          background-color: #fff0f0;
          height: 50px;
          min-width: 320px;
        }

        .warning-box {
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #183140;
          border-radius: 5px;
          border: solid 1px #eaad00;
          background-color: #fff0c4;
          height: 50px;
          min-width: 320px;
          padding: 5px 10px;
        }

        .no-coins {
          min-height: 400px;
        }

        .no-coins .logos {
          margin-bottom: 20px;
        }

        .no-coins .logos img:not(:first-of-type):not(:last-of-type) {
          margin: 0 -15px;
        }

        .no-coins h2 {
          font-size: 1.375rem;
          margin-bottom: 0;
        }

        .no-coins p {
          font-size: 0.875rem;
          line-height: 1.36;
          color: #8293a4;
          margin: 10px 0 0;
        }

        .no-coins .get-coins {
          font-size: 1.125rem;
          font-weight: bold;
          margin-top: 50px;
        }

        .waiting-icon {
          width: 30px;
          height: 30px;
          margin-right: 10px;
        }

        .buy-button {
          min-width: 190px;
          margin-left: 20px;
        }

        .dropdown-menu {
          top: 100%;
          min-width: 100px;
        }

        .price-tolerance-option {
          cursor: pointer;
          text-align: right;
        }

        .price-tolerance-option.selected {
          cursor: auto;
          color: #8293a4;
        }

        @media (max-width: 799px) {
          .buy-sell-widget {
            padding: 25px 20px;
          }

          .buy-sell-widget .ousd-section .approx-purchase {
            min-width: 100px;
            padding-right: 0px;
          }

          .buy-sell-widget .ousd-estimation .value {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .ousd-estimation .border-lg-right {
            border-right: 0px;
          }

          .border-md-bottom {
            border-bottom: solid 1px #cdd7e0;
          }

          .buy-sell-widget .ousd-section {
            margin-bottom: 20px;
          }

          .error-box {
            margin-bottom: 20px;
          }

          .buy-button {
            margin-left: 0px;
          }

          .warning-box {
            margin-bottom: 20px;
          }

          .tolerance-holder {
            height: auto;
          }
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(BuySellWidget)
