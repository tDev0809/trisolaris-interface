import { AddressZero } from '@ethersproject/constants'

import { BigNumber } from '@ethersproject/bignumber'
import { useActiveWeb3React } from '.'
// import { useRewardsHelpers } from './useRewardsHelpers'
import { getTokenForStablePoolType, StableSwapPoolName, STABLESWAP_POOLS } from '../state/stableswap/constants'
import { useStableSwapContract } from './useContract'
import { ChainId, Fraction, JSBI, Percent, Token, TokenAmount } from '@trisolaris/sdk'
import { useSingleCallResult, useSingleContractMultipleData } from '../state/multicall/hooks'
import { useTokenBalance } from '../state/wallet/hooks'
import { useTotalSupply } from '../data/TotalSupply'
import { BIG_INT_ZERO } from '../constants'
import { USDC } from '../constants/tokens'

interface TokenShareType {
  percent: Percent
  token: Token
  value: JSBI
}

export type Partners = 'keep' | 'sharedStake' | 'alchemix'
export interface StablePoolDataType {
  adminFee: Percent
  aParameter: JSBI
  apy: JSBI | null
  name: string
  reserve: JSBI | null
  swapFee: Percent
  tokens: TokenShareType[]
  totalLocked: TokenAmount | null
  utilization: JSBI | null
  virtualPrice: Fraction | null
  volume: JSBI | null
  triPerDay: JSBI | null
  isPaused: boolean
  // @TODO Add APRs here
  //   aprs: Partial<
  //     Record<
  //       Partners,
  //       {
  //         apr: JSBI
  //         symbol: string
  //       }
  //     >
  //   >
  // lpTokenPriceUSD: JSBI
  lpToken: Token | null
}

export interface UserShareType {
  lpTokenBalance: TokenAmount
  name: StableSwapPoolName // TODO: does this need to be on user share?
  share: Percent
  tokens: TokenShareType[]
  usdBalance: string
  underlyingTokensAmount: JSBI
  amountsStaked: Partial<Record<Partners, BigNumber>>
}

export type PoolDataHookReturnType = [StablePoolDataType, UserShareType | null]

export default function usePoolData(poolName: StableSwapPoolName): PoolDataHookReturnType {
  const { account } = useActiveWeb3React()

  const pool = STABLESWAP_POOLS[ChainId.AURORA][poolName]
  const { lpToken, rewardPids /* @TODO Update this when rewarders are added */, metaSwapAddresses } = pool
  const effectivePoolTokens =
    pool?.underlyingPoolTokens != null && pool.underlyingPoolTokens.length > 0
      ? pool.underlyingPoolTokens
      : pool.poolTokens
  const isMetaSwap = metaSwapAddresses != null

  const swapContract = useStableSwapContract(poolName)

  const swapStorage = useSingleCallResult(swapContract, 'swapStorage')
  const [adminFee, swapFee] = [
    swapStorage?.result?.adminFee ?? BIG_INT_ZERO,
    swapStorage?.result?.swapFee ?? BIG_INT_ZERO
  ].map(value => new Percent(value, JSBI.BigInt(JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(12)))))
  const rawVirtualPrice = useSingleCallResult(swapContract, 'getVirtualPrice')?.result?.[0] ?? BIG_INT_ZERO
  const virtualPrice = JSBI.equal(BIG_INT_ZERO, JSBI.BigInt(rawVirtualPrice))
    ? null
    : new Fraction(JSBI.BigInt(rawVirtualPrice), JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(18)))

  const aParameter: JSBI = useSingleCallResult(swapContract, 'getA')?.result?.[0] ?? BIG_INT_ZERO
  const isPaused: boolean = useSingleCallResult(swapContract, 'paused')?.result?.[0] ?? false
  const userLPTokenBalance = useTokenBalance(account ?? AddressZero, lpToken) ?? new TokenAmount(lpToken, BIG_INT_ZERO)
  const totalLpTokenBalance = useTotalSupply(lpToken) ?? new TokenAmount(lpToken, BIG_INT_ZERO)

  // Pool token data
  const tokenBalanceInputs: number[][] = (effectivePoolTokens ?? []).map((_, i) => [i])
  const tokenBalances = useSingleContractMultipleData(swapContract, 'getTokenBalance', tokenBalanceInputs)
    ?.map(response => response?.result)
    ?.flat()
    ?.map((item: any) => JSBI.BigInt(item ?? BIG_INT_ZERO))

  const tokenBalancesSum = sumAllJSBI(tokenBalances)

  const tokenBalancesUSD = effectivePoolTokens.map((token, i, arr) => {
    // use another token to estimate USD price of meta LP tokens
    const effectiveToken = isMetaSwap && i === arr.length - 1 ? getTokenForStablePoolType(pool.type) : token
    const balance = tokenBalances[i]
    const tokenAmount = new TokenAmount(effectiveToken, balance)

    return tokenAmount.raw
  })

  const tokenBalancesUSDSum = tokenBalancesUSD.reduce((acc, item) => JSBI.add(acc, item), BIG_INT_ZERO)

  const userShare = calculatePctOfTotalShare(userLPTokenBalance, totalLpTokenBalance)
  const userPoolTokenBalances = tokenBalances.map(balance => userShare.multiply(balance).quotient)
  const userPoolTokenBalancesSum = sumAllJSBI(userPoolTokenBalances)

  const userPoolTokenBalancesUSD = tokenBalancesUSD.map(balance => userShare.multiply(balance).quotient)
  const userPoolTokenBalancesUSDSum = new TokenAmount(
    USDC[ChainId.AURORA],
    sumAllJSBI(userPoolTokenBalancesUSD)
  ).toFixed(2)

  const poolTokens = effectivePoolTokens.map((token, i) => ({
    token,
    percent: new Percent(
      tokenBalances[i],
      JSBI.equal(tokenBalancesSum, BIG_INT_ZERO) ? JSBI.BigInt(1) : tokenBalancesSum
    ),
    value: JSBI.divide(
      tokenBalances[i],
      JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(effectivePoolTokens[i].decimals))
    )
  }))

  const userPoolTokens = effectivePoolTokens.map((token, i) => ({
    token,
    percent: new Percent(
      userPoolTokenBalances[i],
      JSBI.equal(tokenBalancesSum, BIG_INT_ZERO) ? JSBI.BigInt(1) : tokenBalancesSum
    ),
    value: JSBI.divide(
      userPoolTokenBalances[i],
      JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(effectivePoolTokens[i].decimals))
    )
  }))

  const poolAddress = pool.address?.toLowerCase()
  const metaSwapAddress = pool.metaSwapAddresses?.toLowerCase()
  const underlyingPool = metaSwapAddress || poolAddress

  // @TODO Add for calculating volume (if possible)
  // const { oneDayVolume, apy, utilization } =
  //   swapStats && underlyingPool in swapStats
  //     ? swapStats[underlyingPool]
  //     : { oneDayVolume: null, apy: null, utilization: null }

  // @TODO Update when rewards are implemented
  // let triPerDay = null
  // if (rewardsContract && rewardsPid !== null) {
  //   const [poolInfo, saddlePerSecond, totalAllocPoint] = await Promise.all([
  //     rewardsContract.poolInfo(rewardsPid),
  //     rewardsContract.saddlePerSecond(),
  //     rewardsContract.totalAllocPoint()
  //   ])
  //   const { allocPoint } = poolInfo
  //   const oneDaySecs = BigNumber.from(24 * 60 * 60)
  //   triPerDay = saddlePerSecond
  //     .mul(oneDaySecs)
  //     .mul(allocPoint)
  //     .div(totalAllocPoint)
  // }

  const poolData: StablePoolDataType = {
    name: poolName,
    tokens: poolTokens,
    reserve: tokenBalancesUSDSum,
    totalLocked: totalLpTokenBalance,
    virtualPrice: virtualPrice,
    adminFee: adminFee,
    swapFee: swapFee,
    aParameter: aParameter,
    volume: null, // @TODO
    utilization: null, // @TODO
    apy: null, // @TODO
    //   aprs,
    // lpTokenPriceUSD, // not needed now, might be needed for metapool
    //   lpToken: POOL.lpToken.symbol,
    lpToken,
    isPaused,
    triPerDay: null //@TODO
  }
  const userShareData: UserShareType | null = account
    ? {
        name: poolName,
        share: userShare,
        underlyingTokensAmount: userPoolTokenBalancesSum,
        usdBalance: userPoolTokenBalancesUSDSum,
        tokens: userPoolTokens,
        lpTokenBalance: userLPTokenBalance,
        amountsStaked: {}
        // @TODO Add this when staking/gauges are introduced
        //   amountsStaked: Object.keys(amountsStaked).reduce((acc, key) => {
        //     const amount = amountsStaked[key as Partners]
        //     return key
        //       ? {
        //           ...acc,
        //           [key]: amount?.mul(virtualPrice).div(BigNumber.from(10).pow(18))
        //         }
        //       : acc
        //   }, {}) // this is # of underlying tokens (eg btc), not lpTokens
      }
    : null

  return [poolData, userShareData]
}

function calculatePctOfTotalShare(lpTokenAmount: TokenAmount, totalLpTokenBalance: TokenAmount): Percent {
  // returns the % of total lpTokens
  return new Percent(
    lpTokenAmount.raw,
    JSBI.equal(totalLpTokenBalance.raw, BIG_INT_ZERO) ? JSBI.BigInt(1) : totalLpTokenBalance.raw
  )
}

function sumAllJSBI(items: JSBI[], startValue: JSBI = BIG_INT_ZERO): JSBI {
  return items.reduce((acc, item) => JSBI.ADD(JSBI.BigInt(item), acc), startValue)
}
