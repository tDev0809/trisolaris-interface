import { ChainId, JSBI } from '@trisolaris/sdk'
import _ from 'lodash'
import { darken } from 'polished'
import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import BalanceButtonValueEnum from '../../components/BalanceButton/BalanceButtonValueEnum'
import { ButtonLight, ButtonConfirmed, ButtonError } from '../../components/Button'
import { DarkGreyCard } from '../../components/Card'
import { AutoColumn } from '../../components/Column'
import useCurrencyInputPanel from '../../components/CurrencyInputPanel/useCurrencyInputPanel'
import CurrencyLogo from '../../components/CurrencyLogo'
import NumericalInput from '../../components/NumericalInput'
import { PageWrapper } from '../../components/Page'
import { RowBetween } from '../../components/Row'
import { BIG_INT_ZERO } from '../../constants'
import { useActiveWeb3React } from '../../hooks'
import { ApprovalState, useApproveCallback } from '../../hooks/useApproveCallback'
import useStablePoolsData from '../../hooks/useStablePoolsData'
import useStableSwapEstimateRemoveLiquidity from '../../hooks/useStableSwapEstimateRemoveLiquidity'
import useStableSwapRemoveLiquidity from '../../hooks/useStableSwapRemoveLiquidity'
import { useWalletModalToggle } from '../../state/application/hooks'
import { StableSwapPoolName, STABLESWAP_POOLS } from '../../state/stableswap/constants'
import { tryParseAmount } from '../../state/stableswap/hooks'
import { TYPE } from '../../theme'
import { unwrappedToken } from '../../utils/wrappedCurrency'
import { Dots } from '../Pool/styleds'
import StableSwapRemoveLiquidityInputPanel from './StableSwapRemoveLiquidityInputPanel'
import { StyledTokenName } from './StableSwapRemoveLiquidityInputPanel.styles'
import StableSwapRemoveLiquidityTokenSelector from './StableSwapRemoveLiquidityTokenSelector'

const InputRow = styled.div<{ selected: boolean }>`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  padding: ${({ selected }) => (selected ? '0.75rem 0.5rem 0.75rem 1rem' : '0.75rem 0.75rem 0.75rem 1rem')};
`

const CurrencySelect = styled.button<{ selected: boolean }>`
  align-items: center;
  height: 2.2rem;
  font-size: 20px;
  font-weight: 500;
  background-color: ${({ selected, theme }) => (selected ? theme.bg3 : theme.primary1)};
  color: ${({ selected, theme }) => (selected ? theme.text1 : theme.white)};
  border-radius: 12px;
  box-shadow: ${({ selected }) => (selected ? 'none' : '0px 6px 10px rgba(0, 0, 0, 0.075)')};
  outline: none;
  cursor: pointer;
  user-select: none;
  border: none;
  padding: 0 0.5rem;

  :focus,
  :hover {
    background-color: ${({ selected, theme }) => (selected ? theme.bg3 : darken(0.05, theme.primary1))};
  }
`

const Aligner = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const INPUT_CHAR_LIMIT = 18

type Props = {
  stableSwapPoolName: StableSwapPoolName
}

export default function StableSwapPoolAddLiquidity({ stableSwapPoolName }: Props) {
  const toggleWalletModal = useWalletModalToggle() // toggle wallet when disconnected
  const [input, _setInput] = useState<string>('')

  // If this is `null`, withdraw all tokens evenly, otherwise withdraw to the selected token index
  const [withdrawTokenIndex, setWithdrawTokenIndex] = useState<number | null>(null)
  const withdrawTokenIndexRef = useRef(withdrawTokenIndex)
  const [poolData, userShareData] = useStablePoolsData(stableSwapPoolName)
  const pool = STABLESWAP_POOLS[ChainId.AURORA][stableSwapPoolName]
  const currency = unwrappedToken(pool.lpToken)

  const { account } = useActiveWeb3React()

  const parsedAmount = tryParseAmount(input, currency)
  const parsedAmountString = parsedAmount?.raw?.toString() ?? null
  const rawParsedAmountRef = useRef(parsedAmountString)

  const [estimatedAmounts, estimateRemovedLiquidityTokenAmounts, error] = useStableSwapEstimateRemoveLiquidity({
    amount: parsedAmount,
    stableSwapPoolName,
    withdrawTokenIndex
  })

  useEffect(() => {
    if (withdrawTokenIndexRef.current !== withdrawTokenIndex || rawParsedAmountRef.current !== parsedAmountString) {
      withdrawTokenIndexRef.current = withdrawTokenIndex
      rawParsedAmountRef.current = parsedAmountString

      void estimateRemovedLiquidityTokenAmounts()
    }
  }, [estimateRemovedLiquidityTokenAmounts, withdrawTokenIndex, parsedAmountString, error])

  const { getMaxInputAmount } = useCurrencyInputPanel()
  const { atMaxAmount: atMaxAmountInput, atHalfAmount: atHalfAmountInput, getClickedAmount } = getMaxInputAmount({
    amount: userShareData?.lpTokenBalance,
    parsedAmount
  })

  function setInput(v: string) {
    // Allows user to paste in long balances
    const value = v.slice(0, INPUT_CHAR_LIMIT)
    _setInput(value)
  }

  const handleBalanceClick = (value: BalanceButtonValueEnum) => {
    const amount = getClickedAmount(value)
    _setInput(amount)
  }

  const [approvalState, handleApproval] = useApproveCallback(parsedAmount, pool.lpToken.address)
  const handleRemoveLiquidity = useStableSwapRemoveLiquidity({
    amount: parsedAmount,
    withdrawTokenIndex,
    stableSwapPoolName
  })

  function renderApproveButton() {
    return (
      <ButtonConfirmed
        mr="0.5rem"
        onClick={handleApproval}
        confirmed={approvalState === ApprovalState.APPROVED}
        disabled={approvalState !== ApprovalState.NOT_APPROVED}
      >
        {approvalState === ApprovalState.PENDING ? (
          <Dots>Approving</Dots>
        ) : approvalState === ApprovalState.APPROVED ? (
          'Approved'
        ) : (
          'Approve'
        )}
      </ButtonConfirmed>
    )
  }

  return (
    <PageWrapper gap="lg" justify="center">
      <AutoColumn style={{ width: '100%' }}>
        <DarkGreyCard>
          <AutoColumn gap="20px">
            <RowBetween>
              <AutoColumn gap="20px" justify="start">
                <TYPE.mediumHeader>Remove Liquidity from {poolData.name}</TYPE.mediumHeader>
              </AutoColumn>
              <AutoColumn gap="20px">
                <StableSwapRemoveLiquidityTokenSelector
                  stableSwapPoolName={stableSwapPoolName}
                  tokenIndex={withdrawTokenIndex}
                  onSelectTokenIndex={setWithdrawTokenIndex}
                />
              </AutoColumn>
            </RowBetween>
            <StableSwapRemoveLiquidityInputPanel
              id="stable-swap-remove-liquidity"
              value={input}
              onUserInput={setInput}
              stableSwapPoolName={stableSwapPoolName}
              onMax={() => handleBalanceClick(BalanceButtonValueEnum.MAX)}
              onClickBalanceButton={handleBalanceClick}
              disableMaxButton={atMaxAmountInput}
              disableHalfButton={atHalfAmountInput}
            />

            {estimatedAmounts.map((currencyAmount, i) => {
              const { currency } = currencyAmount
              return (
                <InputRow key={currency.name ?? i} selected={false}>
                  <NumericalInput
                    className="token-amount-input"
                    value={currencyAmount.toExact()}
                    onUserInput={_.identity}
                  />
                  <CurrencySelect selected={!!currency} className="open-currency-select-button">
                    <Aligner>
                      <CurrencyLogo currency={currency} size={'24px'} />
                      <StyledTokenName className="token-symbol-container" active={Boolean(currency && currency.symbol)}>
                        {currency && currency.symbol && currency.symbol.length > 20
                          ? currency.symbol.slice(0, 4) +
                            '...' +
                            currency.symbol.slice(currency.symbol.length - 5, currency.symbol.length)
                          : currency?.symbol}
                      </StyledTokenName>
                    </Aligner>
                  </CurrencySelect>
                </InputRow>
              )
            })}
          </AutoColumn>
          <div style={{ marginTop: '1rem' }}>
            {account == null ? (
              <ButtonLight onClick={toggleWalletModal}>Connect Wallet</ButtonLight>
            ) : (
              <RowBetween>
                {renderApproveButton()}
                <ButtonError
                  error={error != null}
                  disabled={
                    approvalState !== ApprovalState.APPROVED ||
                    parsedAmount == null ||
                    JSBI.equal(parsedAmount.raw, BIG_INT_ZERO)
                  }
                  onClick={handleRemoveLiquidity}
                >
                  {error != null ? error.reason : 'Remove Liquidity'}
                </ButtonError>
              </RowBetween>
            )}
          </div>
        </DarkGreyCard>
      </AutoColumn>
    </PageWrapper>
  )
}
