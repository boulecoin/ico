pragma solidity ^0.4.11;

import 'zeppelin/token/MintableToken.sol';

contract TestToken is MintableToken {
    string public name = "Test Token";
    string public symbol = "T";
    uint public decimals = 18;

    // do no allow to send ether to this token
    function () public payable {
        throw;
    }

}


