import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { JSBI, ChainId } from '@trisolaris/sdk'
import { Text } from 'rebass'

import { PageWrapper } from '../../components/Page'
import StakeBox from './StakeBox'
import ClaimPtri from './ClaimPtri'
import StatsBox from './StatsBox'
import { ExternalLink } from '../../theme'
import { StyledContainer } from './StatsBox'
import MigrateXtri from './MigrateXtri'
import Modal from '../../components/Modal'

import { useActiveWeb3React } from '../../hooks'
import { useTokenBalance } from '../../state/wallet/hooks'

import { XTRI, PTRI } from '../../constants/tokens'
import { BIG_INT_ZERO } from '../../constants'

const StyledLinksContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
`

const StyledExternalLink = styled(ExternalLink)`
  font-weight: 600;
  color: ${({ theme }) => theme.primaryText1};
  margin: 2px 0 10px;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`

const StyledTextinfo = styled.div`
  margin: 20px 0;
`

const TopContainer = styled.div`
  display: flex;
  justify-content: space-between;
`

const StatsBoxContainer = styled.div`
  flex: 1;
  max-width: 55%;
  width: 100%;
  height: 100%;
`

const AboutContainer = styled(StyledContainer)`
  flex: 1;
  max-width: 40%;
  width: 100%;
`

function StakeTri() {
  const { account } = useActiveWeb3React()
  const xTriBalance = useTokenBalance(account ?? undefined, XTRI[ChainId.AURORA])!
  const pTriBalance = useTokenBalance(account ?? undefined, PTRI[ChainId.AURORA])!

  const [openModal, setOpenModal] = useState(false)

  const hasXTriBalance = JSBI.greaterThan(xTriBalance?.raw ?? BIG_INT_ZERO, BIG_INT_ZERO)
  const hasPtriBalance = JSBI.greaterThan(pTriBalance?.raw ?? BIG_INT_ZERO, BIG_INT_ZERO)

  const closeModal = () => setOpenModal(false)

  useEffect(() => {
    if (hasXTriBalance && !openModal) {
      setOpenModal(true)
    }
  }, [hasXTriBalance])

  return (
    <PageWrapper gap="lg">
      <Modal isOpen={true} onDismiss={closeModal}>
        <MigrateXtri />
      </Modal>
      <TopContainer>
        <StatsBoxContainer>
          <StatsBox />
        </StatsBoxContainer>
        <AboutContainer>
          <Text fontSize={24} fontWeight={500}>
            About pTRI
          </Text>
          <StyledTextinfo>pTri is the new Trisolaris revenue share Token.</StyledTextinfo>
          <StyledLinksContainer>
            <StyledExternalLink href=""> Learn about how it works ↗</StyledExternalLink>
          </StyledLinksContainer>
        </AboutContainer>
      </TopContainer>
      <StakeBox />
      <ClaimPtri />
    </PageWrapper>
  )
}

export default StakeTri
