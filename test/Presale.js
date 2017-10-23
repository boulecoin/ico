'use strict';
const BigNumber = web3.BigNumber;
const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();
const assertJump = require('./helpers/assertJump');
var BouleToken = artifacts.require('../../contracts/BouleToken.sol');
var MultiSigWallet = artifacts.require('../../contracts/MultiSigWallet.sol');
var BouleTokenSaleMock = artifacts.require('./helpers/BouleTokenSaleMock.sol');

contract('Presale', function(accounts) {

    let token, presale, multisig;
    const value = new web3.BigNumber(web3.toWei(1, 'ether'));

    beforeEach(async function() {
        // create new token
        token = await BouleToken.new();
        multisig = await MultiSigWallet.new([accounts[0], accounts[1], accounts[2]], 2);
        // create new sale contract
        presale = await BouleTokenSaleMock.new(token.address, 10, 50, 10000, multisig.address);
        // change token ownership
        await token.transferOwnership(presale.address);
    });


    it('should not allow to buy before initial block', async function() {
        try {
            await presale.send(value);
        } catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });


    it('should allow to buy after initial block', async function() {
        await presale.setMockedBlockNumber(10);
        await presale.sendTransaction({value: value, from: accounts[0]}).should.be.fulfilled;
    });

    it('should not allow to buy after final block', async function() {
        await presale.setMockedBlockNumber(10000);
        try {
            await presale.send(value);
        } catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should allocate right number of token during the first 24 hours', async function() {
        await presale.setMockedBlockNumber(10);
        await presale.sendTransaction({value: value, from: accounts[0]});
        let balance0 = await token.balanceOf(accounts[0]);
        balance0.should.be.bignumber.equal(2000 * 10**18);
    });

    it('should allocate right number of token during the first 24 hours', async function() {
        await presale.setMockedBlockNumber(40);
        await presale.sendTransaction({value: value, from: accounts[0]});
        let balance0 = await token.balanceOf(accounts[0]);
        balance0.should.be.bignumber.equal(2000 * 10**18);
    });

    it('should allocate right number of token after the first 24 hours', async function() {
        await presale.setMockedBlockNumber(51);
        await presale.sendTransaction({value: value, from: accounts[0]});
        let balance0 = await token.balanceOf(accounts[0]);
        balance0.div(10**18).should.be.bignumber.equal(1400);
    });

    it('should allow adding a whitelist member', async function() {

        await presale.setWhitelistStatus(accounts[1], 1).should.be.fulfilled;

    });

    it('should not allow adding a whitelist member', async function() {
        try {
            await presale.setWhitelistStatus(accounts[1], 1, {from: accounts[1]});
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should allow to buy to a whitelist member', async function() {
        // whitelist account 1
        await presale.setWhitelistStatus(accounts[1], 1);
        await presale.sendTransaction({value: value, from: accounts[1]});
        let balance0 = await token.balanceOf(accounts[1]);
        balance0.should.be.bignumber.equal(2000 * 10**18);
    });

    it('should keep funds into sale contract if under min funding', async function() {
        // whitelist account 1
        await presale.setMockedBlockNumber(10);
        await presale.sendTransaction({value: value, from: accounts[0]});
        let balance = web3.eth.getBalance(presale.address);
        balance.should.be.bignumber.equal(10**18);
    });

    it('should move funds into multisig wallet if above min funding', async function() {
        // whitelist account 1
        await presale.setMockedBlockNumber(10);
        await presale.send(new web3.BigNumber(web3.toWei(10, 'ether')));
        let balanceWallet = web3.eth.getBalance(multisig.address);
        balanceWallet.should.be.bignumber.equal(10*10**18);
    });


    it('should move funds into multisig wallet if above min funding ETH', async function() {
        await presale.setMockedBlockNumber(10);
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[0]});
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(7, 'ether')), from: accounts[1]});
        let balance = web3.eth.getBalance(presale.address);
        balance.should.be.bignumber.equal(5*10**18);
        let balanceWallet = web3.eth.getBalance(multisig.address);
        balanceWallet.should.be.bignumber.equal(7*10**18);
    });

    it('should not allow finalizing sale before end sale block', async function() {
        await presale.setMockedBlockNumber(9999);
        try {
            await presale.finalizeSale();
        } catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
        await presale.finalizeSale().should.be.fulfilled;
    });

    it('should allow finalizing sale after end sale block', async function() {
        await presale.setMockedBlockNumber(10000);
        await presale.finalizeSale().should.be.fulfilled;
    });


    it('should not allow finalizing sale if not contract owner', async function() {
        await presale.setMockedBlockNumber(10000);
        try {
            await presale.finalizeSale({from: accounts[1]});
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should not allow refunding before sale end', async function() {
        await presale.setMockedBlockNumber(10);
        // invest
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[0]});
        await presale.setMockedBlockNumber(9999);
        try {
            await presale.refund();
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');

    });


    it('should allow refunding', async function() {
        await presale.setMockedBlockNumber(10);
        // invest
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[0], gasPrice: 0});
        //close
        await presale.setMockedBlockNumber(10000);

        let investorBalance = web3.eth.getBalance(accounts[0]);
        await presale.refund({from: accounts[0], gasPrice: 0}).should.be.fulfilled;
        let investorBalance2 = web3.eth.getBalance(accounts[0]);
        assert.equal(investorBalance2 - investorBalance, 5*10**18);

    });

    it('should not allow refunding if not invested', async function() {
        await presale.setMockedBlockNumber(10);
        // invest
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[0]});
        // close
        await presale.setMockedBlockNumber(10000);
        try {
            await presale.refund({from: accounts[1]});
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');

    });

    it('should refund all the investments of the same user', async function() {
        await presale.setMockedBlockNumber(10);
        // invest
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[0], gasPrice: 0});
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(3, 'ether')), from: accounts[0], gasPrice: 0});
        //close
        await presale.setMockedBlockNumber(10000);
        let investorBalance = web3.eth.getBalance(accounts[0]);
        await presale.refund({from: accounts[0], gasPrice: 0}).should.be.fulfilled;
        let investorBalance2 = web3.eth.getBalance(accounts[0]);
        assert.equal(investorBalance2 - investorBalance, 8*10**18);

    });


    it('should refund investments of different users', async function() {
        await presale.setMockedBlockNumber(10);
        // invest
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[1]});
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(3, 'ether')), from: accounts[2]});
        let investor0Balance = web3.eth.getBalance(accounts[1]);
        let investor1Balance = web3.eth.getBalance(accounts[2]);
        //close
        await presale.setMockedBlockNumber(10000, {from: accounts[0]});
        // refund 0
        await presale.refund({from: accounts[1], gasPrice: 0}).should.be.fulfilled;
        let investor0Balance2 = web3.eth.getBalance(accounts[1]);
        investor0Balance2.minus(investor0Balance).should.be.bignumber.equal(5 * 10**18);
;
        // refund 1
        await presale.refund({from: accounts[2], gasPrice: 0}).should.be.fulfilled;
        let investor1Balance2 = web3.eth.getBalance(accounts[2]);
        investor1Balance2.minus(investor1Balance).should.be.bignumber.equal(3 * 10**18);


    });


    it('should finalize sale with all funds and 50% token in multisig', async function() {
        await presale.setMockedBlockNumber(10);
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(9, 'ether')), from: accounts[1]});
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(11, 'ether')), from: accounts[2]});
        let balanceTokenWallet = await token.balanceOf(multisig.address);
        balanceTokenWallet.should.be.bignumber.equal(0);
        // close
        await presale.setMockedBlockNumber(10000);
        //finalize
        await presale.finalizeSale().should.be.fulfilled;
        // presale balance should be 0
        let balance = web3.eth.getBalance(presale.address);
        balance.should.be.bignumber.equal(0);
        // multisig balance should be 20 ETH
        let balanceWallet = web3.eth.getBalance(multisig.address);
        balanceWallet.should.be.bignumber.equal(20*10**18);

        balanceTokenWallet = await token.balanceOf(multisig.address);
        balanceTokenWallet.should.be.bignumber.equal(40000 * 10**18);

    });


    it('check if before sale end, presale is the token owner', async function() {
        var owner = await token.owner();
        assert.equal(owner, presale.address);
    });

    it('check if after sale, multisig is the token owner', async function() {
        // close
        await presale.setMockedBlockNumber(10000);
        //finalize
        await presale.finalizeSale().should.be.fulfilled;
        var owner = await token.owner();
        assert.equal(owner, multisig.address);
    });


    it('should allow multisig to change the token owner after sale', async function() {
        // close
        await presale.setMockedBlockNumber(10000);
        await presale.finalizeSale().should.be.fulfilled;
        var owner = await token.owner();
        assert.equal(owner, multisig.address);

        var tokenABI = JSON.parse('[{"constant":true,"inputs":[],"name":"mintingFinished","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"}],"name":"mint","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[],"name":"finishMinting","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"type":"function"},{"payable":true,"type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[],"name":"MintFinished","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]');
        var multisigABI = JSON.parse('[{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"owners","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"}],"name":"removeOwner","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"revokeConfirmation","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"isOwner","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"},{"name":"","type":"address"}],"name":"confirmations","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"pending","type":"bool"},{"name":"executed","type":"bool"}],"name":"getTransactionCount","outputs":[{"name":"count","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"}],"name":"addOwner","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"isConfirmed","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"getConfirmationCount","outputs":[{"name":"count","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"transactions","outputs":[{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"},{"name":"executed","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"getOwners","outputs":[{"name":"","type":"address[]"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"from","type":"uint256"},{"name":"to","type":"uint256"},{"name":"pending","type":"bool"},{"name":"executed","type":"bool"}],"name":"getTransactionIds","outputs":[{"name":"_transactionIds","type":"uint256[]"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"getConfirmations","outputs":[{"name":"_confirmations","type":"address[]"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"transactionCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_required","type":"uint256"}],"name":"changeRequirement","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"confirmTransaction","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"}],"name":"submitTransaction","outputs":[{"name":"transactionId","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"MAX_OWNER_COUNT","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"required","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"owner","type":"address"},{"name":"newOwner","type":"address"}],"name":"replaceOwner","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"transactionId","type":"uint256"}],"name":"executeTransaction","outputs":[],"payable":false,"type":"function"},{"inputs":[{"name":"_owners","type":"address[]"},{"name":"_required","type":"uint256"}],"payable":false,"type":"constructor"},{"payable":true,"type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"sender","type":"address"},{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Confirmation","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"sender","type":"address"},{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Revocation","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Submission","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"Execution","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"transactionId","type":"uint256"}],"name":"ExecutionFailure","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"sender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"}],"name":"OwnerAddition","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"}],"name":"OwnerRemoval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"required","type":"uint256"}],"name":"RequirementChange","type":"event"}]');

        const tContract =  web3.eth.contract(tokenABI);
        var deployedTContract = tContract.at(token.address);

        // data for changing token ownership
        var data = deployedTContract.transferOwnership.getData(accounts[0]);

        const mContract = web3.eth.contract(multisigABI);

        const mContractInstance = mContract.at(multisig.address);

        await mContractInstance.submitTransaction.sendTransaction(token.address, 0, data, {from: accounts[0], gas: 500000});

        // confirm transaction
        await mContractInstance.confirmTransaction.sendTransaction(0, {from: accounts[1], gas: 500000});

        var owner2 = await token.owner();
        assert.equal(owner2, accounts[0]);

    });


    it('should not allow changing blocks if not owner', async function() {
        try {
            await presale.changeSaleBlocks(100, 200, 500, {from: accounts[1]});
        } catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });


    it('should allow changing blocks if owner', async function() {
        await presale.changeSaleBlocks(100, 200, 500, {from: accounts[0]}).should.be.fulfilled;
        var initialBlock = await presale.initialBlock();
        var discountBlock = await presale.discountBlock();
        var finalBlock = await presale.finalBlock();
        assert.equal(initialBlock, 100);
        assert.equal(discountBlock, 200);
        assert.equal(finalBlock, 500);
    });


    it('should move funds to multisig wallet if min funding has been reached', async function() {
        await presale.setMockedBlockNumber(10);
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[3]});
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[4]});
        var presaleBalance = web3.eth.getBalance(presale.address);
        presaleBalance.should.be.bignumber.equal(5*10**18);
        await presale.moveFunds({from: accounts[0]}).should.be.fulfilled;
        let balanceWallet = web3.eth.getBalance(multisig.address);
        balanceWallet.should.be.bignumber.equal(10*10**18);
    });

    it('should not move funds to multisig wallet if not owner', async function() {
        await presale.setMockedBlockNumber(10);
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[3]});
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[4]});
        var presaleBalance = web3.eth.getBalance(presale.address);
        presaleBalance.should.be.bignumber.equal(5*10**18);
        try {
            await presale.moveFunds({from: accounts[1]});
        } catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should not move funds to multisig wallet until min funding has been reached', async function() {

        try {
            await presale.moveFunds({from: accounts[0]});
        } catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });


    it('should finalize event if no funds', async function() {
        await presale.setMockedBlockNumber(10);
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[3]});
        await presale.sendTransaction({value: new web3.BigNumber(web3.toWei(5, 'ether')), from: accounts[4]});
        var presaleBalance = web3.eth.getBalance(presale.address);
        presaleBalance.should.be.bignumber.equal(5*10**18);

        // move all funds
        await presale.moveFunds({from: accounts[0]}).should.be.fulfilled;

        // presale balance should be 0
        let balance = web3.eth.getBalance(presale.address);
        balance.should.be.bignumber.equal(0);

        let balanceWallet = web3.eth.getBalance(multisig.address);
        balanceWallet.should.be.bignumber.equal(10*10**18);
        // finalize
        await presale.setMockedBlockNumber(10000);
        await presale.finalizeSale().should.be.fulfilled;

        // multisig balance should be the same
        balanceWallet = web3.eth.getBalance(multisig.address);
        balanceWallet.should.be.bignumber.equal(10*10**18);

        var balanceTokenWallet = await token.balanceOf(multisig.address);
        balanceTokenWallet.should.be.bignumber.equal(20000 * 10**18);
    });


});
