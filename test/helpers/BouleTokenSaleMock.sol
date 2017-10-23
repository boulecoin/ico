pragma solidity ^0.4.8;

import '../../contracts/BoulePreSale.sol';

// @dev BouleTokenSaleMock mocks current block number

contract BouleTokenSaleMock is BoulePreSale {

  function BouleTokenSaleMock (
  address _token,
  uint _initialBlock,
  uint _discountBlock,
  uint _finalBlock,
  address _bouleDevMultisig
  ) BoulePreSale(_token, _initialBlock, _discountBlock, _finalBlock, _bouleDevMultisig) {
    minFundingGoal = 10 ether;
  }

  function getBlockNumber() internal constant returns (uint) {
    return mock_blockNumber;
  }

  function setMockedBlockNumber(uint _b) {
    mock_blockNumber = _b;
  }

  function setMockedTotalCollected(uint _totalCollected) {
    totalCollected = _totalCollected;
  }

  uint mock_blockNumber = 1;

}
