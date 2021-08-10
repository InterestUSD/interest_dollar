import { InjectedConnector } from '@web3-react/injected-connector'
import { LedgerConnector } from './LedgerConnector'
import { InjectedConnector as CEWConnector } from '@ubeswap/injected-connector'

import { providerName } from 'utils/web3'

const POLLING_INTERVAL = 12000
const RPC_HTTP_URLS = {
  42220: process.env.RPC_HTTP_URL_42220,
  44787: process.env.RPC_HTTP_URL_44787,
}

const getChainId = () => {
  if (process.env.NODE_ENV === 'production') {
    return 42220
  } else if (process.env.NODE_ENV === 'development') {
    return process.env.MAINNET_FORK ? 42220 : 31337
  }
}

export const injected = new InjectedConnector({
  supportedChainIds: [42220, 44787, 31337],
})

export const celoExtensionWallet = new CEWConnector({
  supportedChainIds: [42220, 44787, 31337],
})

export const ledger = new LedgerConnector({
  chainId: getChainId(),
  url: RPC_HTTP_URLS[getChainId()],
  pollingInterval: POLLING_INTERVAL,
})

export const getConnectorImage = (activeConnector) => {
  if (activeConnector.connector === ledger) {
    return 'ledger-icon.svg'
  } else if (activeConnector.connector === celoExtensionWallet) {
    return 'metamask-icon.svg'
  } else {
    const prName = providerName()
    if (prName === 'metamask') {
      return 'metamask-icon.svg'
    }
  }

  return 'default-wallet-icon.svg'
}

export const getConnector = (connector) => {
  return Object.values(connectorsByName).filter(
    (conInfo) => conInfo.connector === connector
  )[0]
}

export const connectorsByName = {
  MetaMask: {
    connector: injected,
    displayName: 'MetaMask',
    fileName: 'metamask',
  },
  CeloExtensionWallet: {
    connector: celoExtensionWallet,
    displayName: 'CeloExtensionWallet',
    fileName: 'celoextensionwallet',
  },
  Ledger: {
    connector: ledger,
    displayName: 'Ledger',
    fileName: 'ledger',
  },
}
