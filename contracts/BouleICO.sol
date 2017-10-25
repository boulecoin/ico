pragma solidity ^0.4.11;

import "./BouleToken.sol";
import "./MultiSigWallet.sol";
import 'zeppelin/math/SafeMath.sol';
import 'zeppelin/ownership/Ownable.sol';

/*
    Copyright 2017, Giovanni Zorzato (Boulé Foundation)
 */


contract BouleICO is Ownable{

    uint public startTime;             // unix ts in which the sale starts.
    uint public secondPriceTime;       // unix ts in which the second price triggers.
    uint public thirdPriceTime;        // unix ts in which the third price starts.
    uint public fourthPriceTime;       // unix ts in which the fourth price starts.
    uint public endTime;               // unix ts in which the sale end.

    address public bouleDevMultisig;   // The address to hold the funds donated

    uint public totalCollected = 0;    // In wei
    bool public saleStopped = false;   // Has Boulé stopped the sale?
    bool public saleFinalized = false; // Has Boulé finalized the sale?

    BouleToken public token;           // The token

    MultiSigWallet wallet;             // Multisig

    uint constant public minInvestment = 0.1 ether;    // Minimum investment  0.1 ETH

    /** Addresses that are allowed to invest even before ICO opens. For testing, for ICO partners, etc. */
    mapping (address => bool) public whitelist;

    event NewBuyer(address indexed holder, uint256 bouAmount, uint256 amount);
    event Whitelisted(address addr, bool status);

    function BouleICO (
    address _token,
    address _bouleDevMultisig,
    uint _startTime,
    uint _secondPriceTime,
    uint _thirdPriceTime,
    uint _fourthPriceTime,
    uint _endTime
    )
    {
        if (_startTime >= _endTime) throw;

        // Save constructor arguments as global variables
        token = BouleToken(_token);
        bouleDevMultisig = _bouleDevMultisig;
        // create wallet object
        wallet = MultiSigWallet(bouleDevMultisig);

        startTime = _startTime;
        secondPriceTime = _secondPriceTime;
        thirdPriceTime = _thirdPriceTime;
        fourthPriceTime = _fourthPriceTime;
        endTime = _endTime;
    }

    // change whitelist status for a specific address
    function setWhitelistStatus(address addr, bool status)
    onlyOwner {
        whitelist[addr] = status;
        Whitelisted(addr, status);
    }

    // @notice Get the price for a BOU token at current time (how many tokens for 1 ETH)
    // @return price of BOU
    function getPrice() constant public returns (uint256) {
        var time = getNow();
        if(time < startTime){
            // whitelist
            return 1400;
        }
        if(time < secondPriceTime){
            return 1200; //20%
        }
        if(time < thirdPriceTime){
            return 1150; //15%
        }
        if(time < fourthPriceTime){
            return 1100; //10%
        }
        return 1050; //5%
    }


    /**
        * Get the amount of unsold tokens allocated to this contract;
    */
    function getTokensLeft() public constant returns (uint) {
        return token.balanceOf(this);
    }


    /// The fallback function is called when ether is sent to the contract, it
    /// simply calls `doPayment()` with the address that sent the ether as the
    /// `_owner`. Payable is a required solidity modifier for functions to receive
    /// ether, without this modifier functions will throw if ether is sent to them

    function () public payable {
        doPayment(msg.sender);
    }



    /// @dev `doPayment()` is an internal function that sends the ether that this
    ///  contract receives to the bouleDevMultisig and creates tokens in the address of the
    /// @param _owner The address that will hold the newly created tokens

    function doPayment(address _owner)
    only_during_sale_period_or_whitelisted(_owner)
    only_sale_not_stopped
    non_zero_address(_owner)
    minimum_value(minInvestment)
    internal {
        // Calculate how many tokens at current price
        uint256 tokenAmount = SafeMath.mul(msg.value, getPrice());
        // do not allow selling more than what we have
        if(tokenAmount > getTokensLeft()) {
            throw;
        }
        // transfer token (it will throw error if transaction is not valid)
        token.transfer(_owner, tokenAmount);

        // record total selling
        totalCollected = SafeMath.add(totalCollected, msg.value);

        NewBuyer(_owner, tokenAmount, msg.value);
    }

    // @notice Function to stop sale for an emergency.
    // @dev Only Boulé Dev can do it after it has been activated.
    function emergencyStopSale()
    only_sale_not_stopped
    onlyOwner
    public {
        saleStopped = true;
    }

    // @notice Function to restart stopped sale.
    // @dev Only Boulé can do it after it has been disabled and sale is ongoing.
    function restartSale()
    only_during_sale_period
    only_sale_stopped
    onlyOwner
    public {
        saleStopped = false;
    }


    // @notice Moves funds in sale contract to Boulé MultiSigWallet.
    // @dev  Moves funds in sale contract to Boulé MultiSigWallet.
    function moveFunds()
    onlyOwner
    public {
        // move funds
        if (!wallet.send(this.balance)) throw;
    }


    function finalizeSale()
    only_after_sale
    onlyOwner
    public {
        doFinalizeSale();
    }

    function doFinalizeSale()
    internal {
        // move all remaining eth in the sale contract into multisig wallet
        if (!wallet.send(this.balance)) throw;
        // transfer remaining tokens
        token.transfer(bouleDevMultisig, getTokensLeft());

        saleFinalized = true;
        saleStopped = true;
    }

    function getNow() internal constant returns (uint) {
        return now;
    }

    modifier only(address x) {
        if (msg.sender != x) throw;
        _;
    }

    modifier only_during_sale_period {
        if (getNow() < startTime) throw;
        if (getNow() >= endTime) throw;
        _;
    }

    // valid only during sale or before sale if the sender is whitelisted
    modifier only_during_sale_period_or_whitelisted(address x) {
        if (getNow() < startTime && !whitelist[x]) throw;
        if (getNow() >= endTime) throw;
        _;
    }

    modifier only_after_sale {
        if (getNow() < endTime) throw;
        _;
    }

    modifier only_sale_stopped {
        if (!saleStopped) throw;
        _;
    }

    modifier only_sale_not_stopped {
        if (saleStopped) throw;
        _;
    }

    modifier non_zero_address(address x) {
        if (x == 0) throw;
        _;
    }

    modifier minimum_value(uint256 x) {
        if (msg.value < x) throw;
        _;
    }
}
