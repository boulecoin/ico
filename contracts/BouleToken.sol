pragma solidity ^0.4.11;

import 'zeppelin/token/MintableToken.sol';

/*
    Copyright 2017, Giovanni Zorzato (Boulé Foundation)
*/

contract BouleToken is MintableToken {
    // BouleToken is an OpenZeppelin Mintable Token
    string public name = "Boule Token";
    string public symbol = "BOU";
    uint public decimals = 18;

    // do no allow to send ether to this token
    function () public payable {
        throw;
    }

}


