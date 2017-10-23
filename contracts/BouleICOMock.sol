pragma solidity ^0.4.8;

import './BouleICO.sol';

// @dev BouleTokenSaleMock mocks current block number

contract BouleICOMock is BouleICO {

  uint public mockedNow;

  function BouleICOMock (
  address _token,
  address _bouleDevMultisig,
  uint _startTime,
  uint _secondPriceTime,
  uint _thirdPrice,
  uint _fourthPriceTime,
  uint _endTime

  ) BouleICO(_token, _bouleDevMultisig, _startTime, _secondPriceTime, _thirdPrice, _fourthPriceTime, _endTime) {
    mockedNow = 0;
  }

  function getNow() internal constant returns (uint) {
    return mockedNow;
  }

  function setMockedNow(uint _b) {
    mockedNow = _b;
  }

}
