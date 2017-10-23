pragma solidity ^0.4.11;

import "./TestToken.sol";
import "./MultiSigWallet.sol";
import 'zeppelin/math/SafeMath.sol';

/*
    Copyright 2017, Giovanni Zorzato (Boulé Foundation)
 */

contract TestPreSale{

    uint public initialBlock;             // Block number in which the sale starts. Inclusive. sale will be opened at initial block.
    uint public finalBlock;               // Block number in which the sale end. Exclusive, sale will be closed at ends block.

    address public bouleDevMultisig;     // The address to hold the funds donated


    uint public totalCollected = 0;               // In wei
    bool public saleStopped = false;              // Has Boulé Dev stopped the sale?
    bool public saleFinalized = false;            // Has Boulé Dev finalized the sale?

    TestToken public token;                             // The token

    MultiSigWallet wallet;

    uint constant public minInvestment = 1 finney;         // Minimum investment  0,001 ETH
    uint public hardCap = 10000 ether;          // Cap
    uint public minFundingGoal = 700 ether;          // Minimum funding goal for sale success


    /** Addresses that are allowed to invest even before ICO offical opens. For testing, for ICO partners, etc. */
    mapping (address => bool) public whitelist;

    /** How much they have invested */
    mapping(address => uint) public balances;

    event NewBuyer(address indexed holder, uint256 bouAmount, uint256 etherAmount);
    // Address early participation whitelist status changed
    event Whitelisted(address addr, bool status);
    // Investor has been refunded because the ico did not reach the min funding goal
    event Refunded(address investor, uint value);

    function TestPreSale (
    address _token,
    uint _initialBlock,
    uint _finalBlock,
    address _bouleDevMultisig
    )
    {
        if (_initialBlock >= _finalBlock) throw;

        // Save constructor arguments as global variables
        token = TestToken(_token);

        initialBlock = _initialBlock;
        finalBlock = _finalBlock;
        bouleDevMultisig = _bouleDevMultisig;
        // create wallet object
        wallet = MultiSigWallet(bouleDevMultisig);

    }

    // change whitelist status for a specific address
    function setWhitelistStatus(address addr, bool status)
    only(bouleDevMultisig){
        whitelist[addr] = status;
        Whitelisted(addr, status);
    }

    // @notice Get the price for a BOU token at any given block number
    // @param _blockNumber the block for which the price is requested
    // @return price of boule
    // If sale isn't ongoing for that block, returns 0.
    function getPrice(uint _blockNumber) constant public returns (uint256) {
        if (_blockNumber >= finalBlock) return 0;
        if(_blockNumber <= initialBlock + 5100){
            return 500000000000000; // 2000 BOU for 1 ETH first 24 hours (approx in blocks)
        }
        return 714285714285714; // 1400 BOU for 1 ETH after 24 hours (approx in blocks)
    }


    /// @dev The fallback function is called when ether is sent to the contract, it
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
        // do not allow to go past hard cap
        if ((totalCollected + msg.value) > hardCap) throw; // If past hard cap, throw

        if ((totalCollected + msg.value) < minFundingGoal){ // if under min funding goal
            // record the investment for possible refund in case the ICO does not finalize
            balances[_owner] = SafeMath.add(balances[_owner], msg.value);
            // keep funds here
        }
        else{
            if (!wallet.send(msg.value)) throw; // Send funds to multisig wallet
        }

        uint256 boughtTokens = SafeMath.div(SafeMath.mul(msg.value, 10 ** 18), getPrice(getBlockNumber())); // Calculate how many tokens bought

        if (!token.mint(_owner, boughtTokens)) throw; // Allocate tokens.

        totalCollected = SafeMath.add(totalCollected, msg.value); // Save total collected amount

        NewBuyer(_owner, boughtTokens, msg.value);
    }

    // allow investors to be refunded if the sale does not reach min investment target (minFundingGoal)
    // refund can be asked only after sale period
    function refund()
    only_sale_refundable {
        address investor = msg.sender;
        if(balances[investor] == 0) throw; // nothing to refund
        uint amount = balances[investor];
        // remove balance
        delete balances[investor];
        // send back eth
        if(!investor.send(amount)) throw;

        Refunded(investor, amount);
    }

    // @notice Function to stop sale for an emergency.
    // @dev Only Boulé Dev can do it after it has been activated.
    function emergencyStopSale()
    only_sale_not_stopped
    only(bouleDevMultisig)
    public {

        saleStopped = true;
    }

    // @notice Function to restart stopped sale.
    // @dev Only Boulé Dev can do it after it has been disabled and sale is ongoing.
    function restartSale()
    only_during_sale_period
    only_sale_stopped
    only(bouleDevMultisig)
    public {

        saleStopped = false;
    }



    // @notice Finalizes sale generating the tokens for Boulé Dev.
    // @dev Transfers the token controller power to the ANPlaceholder.
    function finalizeSale()
    only_after_sale
    only(bouleDevMultisig)
    public {

        doFinalizeSale();
    }

    function doFinalizeSale()
    internal {
        // Doesn't check if saleStopped is false, because sale could end in a emergency stop.
        // This function cannot be successfully called twice, because it will top being the controller,
        // and the generateTokens call will fail if called again.

        // Boulé owns 50% of the total number of emitted tokens at the end of the pre-sale.

        if (totalCollected >= minFundingGoal){ // if min funding goal reached
            // move all remaining eth in the sale contract into multisig wallet (no refund is possible anymore)
            if (!wallet.send(this.balance)) throw;

            uint256 TestTokenSupply = token.totalSupply();

            if (!token.mint(bouleDevMultisig, TestTokenSupply)) throw; // Allocate tokens for Boulé.
        }
        // token will be owned by Boulé multisig wallet, this contract cannot mint anymore
        token.transferOwnership(bouleDevMultisig);

        saleFinalized = true;
        saleStopped = true;
    }


    function getBlockNumber() constant internal returns (uint) {
        return block.number;
    }


    modifier only(address x) {
        if (msg.sender != x) throw;
        _;
    }

    modifier only_before_sale {
        if (getBlockNumber() >= initialBlock) throw;
        _;
    }

    modifier only_during_sale_period {
        if (getBlockNumber() < initialBlock) throw;
        if (getBlockNumber() >= finalBlock) throw;
        _;
    }

    // valid only during sale or before sale if the sender is whitelisted
    modifier only_during_sale_period_or_whitelisted(address x) {
        if (getBlockNumber() < initialBlock && !whitelist[x]) throw;
        if (getBlockNumber() >= finalBlock) throw;
        _;
    }

    modifier only_after_sale {
        if (getBlockNumber() < finalBlock) throw;
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

    modifier only_finalized_sale {
        if (getBlockNumber() < finalBlock) throw;
        if (!saleFinalized) throw;
        _;
    }

    modifier non_zero_address(address x) {
        if (x == 0) throw;
        _;
    }

    modifier only_sale_refundable {
        if (getBlockNumber() < finalBlock) throw; // sale must have ended
        if (totalCollected >= minFundingGoal) throw; // sale must be under min funding goal
        _;
    }

    modifier minimum_value(uint256 x) {
        if (msg.value < x) throw;
        _;
    }
}
