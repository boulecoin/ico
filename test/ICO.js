'use strict';
const BigNumber = web3.BigNumber;
const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();
const assertJump = require(__dirname + '/helpers/assertJump');
var BouleToken = artifacts.require('BouleToken');
var MultiSigWallet = artifacts.require('MultiSigWallet');
var BouleICOMock = artifacts.require('BouleICOMock');

contract('ICO', function(accounts) {

    let token, ico, multisig;
    const value = new web3.BigNumber(web3.toWei(1, 'ether'));
    const supply = 10000;
    beforeEach(async function() {
        // create new token
        token = await BouleToken.new();
        multisig = await MultiSigWallet.new([accounts[0], accounts[1], accounts[2]], 2);
        // create new sale contract
        ico = await BouleICOMock.new(token.address, multisig.address, 10, 20, 30, 40, 3000000);
        // mint supply token to account
        await token.mint(ico.address, new web3.BigNumber(web3.toWei(supply, 'ether')));
        // stop token emission
        await token.finishMinting();
    });

    it('check token balance', async function() {
        var balance = await token.balanceOf(ico.address);
        balance.should.be.bignumber.equal(supply*10**18);
    });


   it('should not allow to buy before start', async function() {
       try {
           await ico.send(value);
       } catch(error) {
           return assertJump(error);
       }
       assert.fail('should have thrown before');
   });


   it('should allow to buy after sale start', async function() {
       await ico.setMockedNow(10);
       await ico.sendTransaction({value: value, from: accounts[0]}).should.be.fulfilled;
   });

   it('should not allow to buy after sale end', async function() {
       await ico.setMockedNow(3000000);
       try {
           await ico.send(value);
       } catch(error) {
           return assertJump(error);
       }
       assert.fail('should have thrown before');
   });

    it('should not allow to invest less than min investment', async function() {
        await ico.setMockedNow(10);
        try {
            await ico.sendTransaction({value: new web3.BigNumber(web3.toWei(0.01, 'ether')), from: accounts[0]});
        } catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });


    it('should allocate right number of token during the first 24 hours', async function() {
        await ico.setMockedNow(10);
        await ico.sendTransaction({value: value, from: accounts[0]});
        let balance0 = await token.balanceOf(accounts[0]);
        balance0.should.be.bignumber.equal(1200 * 10**18);
    });

    it('should reduce token availability', async function() {
        await ico.setMockedNow(10);
        await ico.sendTransaction({value: value, from: accounts[0]});
        let balance = await token.balanceOf(ico.address);
        balance.should.be.bignumber.equal((supply -1200)*10**18);
    });

    it('should allocate right number of token in second slot', async function() {
        await ico.setMockedNow(20);
        await ico.sendTransaction({value: value, from: accounts[0]});
        let balance0 = await token.balanceOf(accounts[0]);
        balance0.should.be.bignumber.equal(1150 * 10**18);
    });

    it('should allocate right number of token in third slot', async function() {
        await ico.setMockedNow(30);
        await ico.sendTransaction({value: value, from: accounts[0]});
        let balance0 = await token.balanceOf(accounts[0]);
        balance0.should.be.bignumber.equal(1100 * 10**18);
    });

    it('should allocate right number of token in fourth slot', async function() {
        await ico.setMockedNow(40);
        await ico.sendTransaction({value: value, from: accounts[0]});
        let balance0 = await token.balanceOf(accounts[0]);
        balance0.should.be.bignumber.equal(1050 * 10**18);
    });

    it('should allocate right number of token in fourth slot', async function() {
        await ico.setMockedNow(100);
        await ico.sendTransaction({value: value, from: accounts[0]});
        let balance0 = await token.balanceOf(accounts[0]);
        balance0.should.be.bignumber.equal(1050 * 10**18);
    });

    it('should allow adding a whitelist member', async function() {

        await ico.setWhitelistStatus(accounts[1], 1).should.be.fulfilled;

    });

    it('should not allow adding a whitelist member if not owner', async function() {
        try {
            await ico.setWhitelistStatus(accounts[1], 1, {from: accounts[1]});
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should allow to buy to a whitelist member', async function() {
        // whitelist account 1
        await ico.setWhitelistStatus(accounts[1], 1);
        await ico.sendTransaction({value: value, from: accounts[1]});
        let balance0 = await token.balanceOf(accounts[1]);
        balance0.should.be.bignumber.equal(1400 * 10**18);
    });

    it('should not allow to buy too much', async function() {
        await ico.setMockedNow(10);
        try {
            await ico.sendTransaction({value: new web3.BigNumber(web3.toWei(9, 'ether')), from: accounts[0]});
        }
        catch(error) {
            let balance = await token.balanceOf(ico.address);
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should allow to buy quite enough', async function() {
        await ico.setMockedNow(10);
        await ico.sendTransaction({value: new web3.BigNumber(web3.toWei(8.3, 'ether')), from: accounts[0]}).should.be.fulfilled;
    });


    it('should not allow finalizing sale before sale end', async function() {
        await ico.setMockedNow(2999999);
        try {
            await ico.finalizeSale();
        } catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should allow finalizing sale after sale end', async function() {
        await ico.setMockedNow(3000000);
        await ico.finalizeSale().should.be.fulfilled;
    });


    it('should not allow finalizing sale if not contract owner', async function() {
        await ico.setMockedNow(3000000);
        try {
            await ico.finalizeSale({from: accounts[1]});
        }
        catch(error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

    it('should finalize sale with all funds remaining token in multisig', async function() {
        await ico.setMockedNow(10);
        await ico.sendTransaction({value: new web3.BigNumber(web3.toWei(2, 'ether')), from: accounts[1]});
        await ico.setMockedNow(86410);
        await ico.sendTransaction({value: new web3.BigNumber(web3.toWei(3, 'ether')), from: accounts[2]});
        let balanceTokenWallet = await token.balanceOf(multisig.address);
        balanceTokenWallet.should.be.bignumber.equal(0);
        // close
        await ico.setMockedNow(3000000);
        //finalize
        await ico.finalizeSale().should.be.fulfilled;
        // presale balance should be 0
        let balance = web3.eth.getBalance(ico.address);
        balance.should.be.bignumber.equal(0);

        let balanceToken = await token.balanceOf(ico.address);
        balanceToken.should.be.bignumber.equal(0);

        // multisig balance should be 5 ETH
        let balanceWallet = web3.eth.getBalance(multisig.address);
        balanceWallet.should.be.bignumber.equal(5*10**18);

        balanceTokenWallet = await token.balanceOf(multisig.address);
        balanceTokenWallet.should.be.bignumber.equal((supply - 2*1200 - 3*1050) * 10**18);
    });

    it('should move funds', async function() {
        await ico.setMockedNow(10);
        await ico.sendTransaction({value: new web3.BigNumber(web3.toWei(2, 'ether')), from: accounts[1]});
        let balanceTokenWallet = await token.balanceOf(multisig.address);
        balanceTokenWallet.should.be.bignumber.equal(0);
        //finalize
        await ico.moveFunds().should.be.fulfilled;
        // presale balance should be 0
        let balance = web3.eth.getBalance(ico.address);
        balance.should.be.bignumber.equal(0);
        // multisig balance should be 5 ETH
        let balanceWallet = web3.eth.getBalance(multisig.address);
        balanceWallet.should.be.bignumber.equal(2*10**18);

        balanceTokenWallet = await token.balanceOf(multisig.address);
        balanceTokenWallet.should.be.bignumber.equal(0);
    });

    it('should calculate totalCollected', async function() {
        await ico.setMockedNow(10);
        await ico.sendTransaction({value: new web3.BigNumber(web3.toWei(2, 'ether')), from: accounts[1]});
        await ico.setMockedNow(86410);
        await ico.sendTransaction({value: new web3.BigNumber(web3.toWei(3, 'ether')), from: accounts[2]});
        var totalCollected = await ico.totalCollected();
        totalCollected.should.be.bignumber.equal(5*10**18);
    });
});

contract('ICO2', function(accounts) {

    it('should not allow to buy when tokens are finished', async function () {
        // create new token
        var token = await BouleToken.new();
        var multisig = await MultiSigWallet.new([accounts[0], accounts[1], accounts[2]], 2);
        // create new sale contract
        var ico = await BouleICOMock.new(token.address, multisig.address, 10, 20, 30, 40, 3000000);
        // no token allocated
        await ico.setMockedNow(10);
        try {
            await ico.sendTransaction({value: new web3.BigNumber(web3.toWei(1, 'ether')), from: accounts[0]});
        } catch (error) {
            return assertJump(error);
        }
        assert.fail('should have thrown before');
    });

});