const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RoyaltyDistribution", () => {
  const deployRDFixture = async () => {
    const [owner, addr1] = await ethers.getSigners();

    const RD = await ethers.getContractFactory("RoyaltyDistribution");
    const royaltyDistribution = await RD.deploy();

    return { royaltyDistribution, owner, addr1 };
  };

  describe("Deployment", () => {
    it("Should set the right admin", async () => {
      const { royaltyDistribution, owner } = await loadFixture(deployRDFixture);

      expect(await royaltyDistribution._admin()).to.equal(owner.address);
    });

    it("Should set the right locked value", async () => {
      const { royaltyDistribution } = await loadFixture(deployRDFixture);

      expect(await royaltyDistribution.isLocked()).to.equal(true);
    });
  });

  describe("Costs", () => {
    it("Should add cost if an admin", async () => {
      const { royaltyDistribution } = await loadFixture(deployRDFixture);
      await royaltyDistribution.addCost("marketName", 10);

      expect(await royaltyDistribution.costs("marketName")).to.equal(10);
    });

    it("Should revert if not an admin", async () => {
      const { royaltyDistribution, addr1 } = await loadFixture(deployRDFixture);

      const addCostTx = royaltyDistribution
        .connect(addr1)
        .addCost("marketName", 10);

      await expect(addCostTx).to.be.revertedWith("not admin");
    });

    it("Should revert if contract locked", async () => {
      const { royaltyDistribution, addr1 } = await loadFixture(deployRDFixture);

      await royaltyDistribution.unlockContract();

      const addCostTx = royaltyDistribution.addCost("marketName", 10);

      await expect(addCostTx).to.be.revertedWith("contract is not locked");
    });

    it("Should delete cost", async () => {
      const { royaltyDistribution } = await loadFixture(deployRDFixture);
      await royaltyDistribution.deleteCost("marketName");

      expect(await royaltyDistribution.costs("marketName")).to.equal(0);
    });

    it("Should revert if not an admin or contract locked", async () => {
      const { royaltyDistribution, addr1 } = await loadFixture(deployRDFixture);
      const removeCostTxNotAdmin = royaltyDistribution
        .connect(addr1)
        .deleteCost("notExistingName");

      await royaltyDistribution.unlockContract();

      const removeCostTxNotLocked =
        royaltyDistribution.deleteCost("notExistingName");

      await expect(removeCostTxNotAdmin).to.be.revertedWith("not admin");
      await expect(removeCostTxNotLocked).to.be.revertedWith(
        "contract is not locked"
      );
    });
  });

  describe("Admin percentage", () => {
    it("Should set admin percentage", async () => {
      const { royaltyDistribution, owner } = await loadFixture(deployRDFixture);
      await royaltyDistribution.setAdminPercentage(10);

      const member = await royaltyDistribution.members(owner.address);

      expect(member.percentage.toNumber()).to.be.eq(10);
    });

    it("Should revert if percentage is gt 100", async () => {
      const { royaltyDistribution } = await loadFixture(deployRDFixture);
      const setAdminPercentageTx = royaltyDistribution.setAdminPercentage(101);

      await expect(setAdminPercentageTx).to.be.revertedWith(
        "percentage cant be greater than 100"
      );
    });
  });

  describe("Members", () => {
    describe("Add member", () => {
      it("Should add a member", async () => {
        const { royaltyDistribution, addr1 } = await loadFixture(
          deployRDFixture
        );
        await royaltyDistribution.addMember(addr1.address, 10);

        const member = await royaltyDistribution.members(addr1.address);

        expect(member.percentage.toNumber()).to.be.eq(10);
        expect(
          (await royaltyDistribution._totalPercentage()).toNumber()
        ).to.be.eq(10);
      });

      it("Should revert if _memberWalletAddress is address(0)", async () => {
        const { royaltyDistribution, addr1 } = await loadFixture(
          deployRDFixture
        );
        const addMemberTx = royaltyDistribution.addMember(
          ethers.constants.AddressZero,
          10
        );

        await expect(addMemberTx).to.be.revertedWith(
          "member cant be zero address"
        );
      });

      it("Should revert if member already exists", async () => {
        const { royaltyDistribution, addr1 } = await loadFixture(
          deployRDFixture
        );
        await royaltyDistribution.addMember(addr1.address, 10);

        const addSecondMemberTx = royaltyDistribution.addMember(
          addr1.address,
          20
        );

        await expect(addSecondMemberTx).to.be.revertedWith(
          "member already exists"
        );
      });

      it("Should revert if percentage is gt 100", async () => {
        const { royaltyDistribution, addr1 } = await loadFixture(
          deployRDFixture
        );
        const addMemberTx = royaltyDistribution.addMember(addr1.address, 101);

        await expect(addMemberTx).to.be.revertedWith(
          "percentage cant be greater than 100"
        );
      });
    });

    describe("Edit member", () => {
      it("Should edit a member", async () => {
        const { royaltyDistribution, addr1 } = await loadFixture(
          deployRDFixture
        );
        await royaltyDistribution.addMember(addr1.address, 10);

        await royaltyDistribution.editMember(addr1.address, 21);

        const member = await royaltyDistribution.members(addr1.address);

        expect(member.percentage.toNumber()).to.be.eq(21);
        expect(
          (await royaltyDistribution._totalPercentage()).toNumber()
        ).to.be.eq(21);
      });

      it("Should revert if member doesnt exist", async () => {
        const { royaltyDistribution, addr1 } = await loadFixture(
          deployRDFixture
        );

        const editMemberTx = royaltyDistribution.editMember(addr1.address, 21);

        await expect(editMemberTx).to.be.revertedWith("member doesnt exist");
      });

      it("Should revert if percentage to edit is gt 100", async () => {
        const { royaltyDistribution, addr1 } = await loadFixture(
          deployRDFixture
        );
        await royaltyDistribution.addMember(addr1.address, 10);

        const editMemberTx = royaltyDistribution.editMember(addr1.address, 211);

        await expect(editMemberTx).to.be.revertedWith(
          "percentage cant be greater than 100"
        );
      });
    });
  });

  describe("Receive funds", () => {
    it("Should receive funds and update totalDistributions", async () => {
      const { royaltyDistribution, owner, addr1 } = await loadFixture(
        deployRDFixture
      );

      await royaltyDistribution.addMember(addr1.address, 10);

      await owner.sendTransaction({
        to: royaltyDistribution.address,
        value: ethers.utils.parseEther("1"),
      });

      expect(await royaltyDistribution.totalDistributions()).to.be.eq(
        ethers.utils.parseEther("1")
      );
    });
  });

  describe("Submit final costs", () => {
    it("Should transfer costs to admin", async () => {
      const { royaltyDistribution, owner, addr1 } = await loadFixture(
        deployRDFixture
      );

      await royaltyDistribution.addMember(owner.address, 10);
      await royaltyDistribution.addMember(addr1.address, 10);

      await owner.sendTransaction({
        to: royaltyDistribution.address,
        value: ethers.utils.parseEther("10"),
      });

      await royaltyDistribution.addCost("marketName", 1);

      await royaltyDistribution.submitFinalCosts();

      await expect(royaltyDistribution.claimCosts()).to.changeEtherBalances(
        [owner, royaltyDistribution],
        [ethers.utils.parseEther("1"), `-${ethers.utils.parseEther("1")}`]
      );
    });

    it("Should revert if not enough balance", async () => {
      const { royaltyDistribution, owner, addr1 } = await loadFixture(
        deployRDFixture
      );

      await royaltyDistribution.addMember(owner.address, 10);
      await royaltyDistribution.addMember(addr1.address, 10);

      await owner.sendTransaction({
        to: royaltyDistribution.address,
        value: ethers.utils.parseEther("10"),
      });

      await royaltyDistribution.addCost("marketName", 11);
      await royaltyDistribution.submitFinalCosts();

      await expect(royaltyDistribution.claimCosts()).to.be.revertedWith(
        "not enough balance"
      );
    });
  });

  describe("Withdraw distributed royalties", () => {
    it("Should transfer funds to member and update distribution value", async () => {
      const { royaltyDistribution, addr1, owner } = await loadFixture(
        deployRDFixture
      );
      await royaltyDistribution.addMember(addr1.address, 10);

      await owner.sendTransaction({
        to: royaltyDistribution.address,
        value: ethers.utils.parseEther("100"),
      });
      expect(await royaltyDistribution.totalDistributions()).to.be.eq(
        ethers.utils.parseEther("100")
      );

      await owner.sendTransaction({
        to: royaltyDistribution.address,
        value: ethers.utils.parseEther("100"),
      });
      expect(await royaltyDistribution.totalDistributions()).to.be.eq(
        ethers.utils.parseEther("200")
      );

      await royaltyDistribution.unlockContract();

      await expect(
        royaltyDistribution.connect(addr1).claimRoyalties()
      ).to.changeEtherBalances(
        [addr1, royaltyDistribution],
        [ethers.utils.parseEther("20"), `-${ethers.utils.parseEther("20")}`]
      );
    });

    it("Should revert if already taken", async () => {
      const { royaltyDistribution, addr1, owner } = await loadFixture(
        deployRDFixture
      );
      await royaltyDistribution.addMember(addr1.address, 10);
      await owner.sendTransaction({
        to: royaltyDistribution.address,
        value: ethers.utils.parseEther("10"),
      });
      expect(await royaltyDistribution.totalDistributions()).to.be.eq(
        ethers.utils.parseEther("10")
      );
      await royaltyDistribution.unlockContract();
      await royaltyDistribution.connect(addr1).claimRoyalties();
      await expect(
        royaltyDistribution.connect(addr1).claimRoyalties()
      ).to.be.revertedWith("already taken");
    });

    it("Should revert if locked", async () => {
      const { royaltyDistribution, addr1, owner } = await loadFixture(
        deployRDFixture
      );
      await royaltyDistribution.addMember(addr1.address, 10);
      await owner.sendTransaction({
        to: royaltyDistribution.address,
        value: ethers.utils.parseEther("1"),
      });
      expect(await royaltyDistribution.totalDistributions()).to.be.eq(
        ethers.utils.parseEther("1")
      );
      await expect(
        royaltyDistribution.connect(addr1).claimRoyalties()
      ).to.be.revertedWith("contract is locked");
    });

    it("Should be able to claim again after contract balance increased", async () => {
      const { royaltyDistribution, addr1, owner } = await loadFixture(
        deployRDFixture
      );
      await royaltyDistribution.addMember(addr1.address, 10);
      await owner.sendTransaction({
        to: royaltyDistribution.address,
        value: ethers.utils.parseEther("10"),
      });

      expect(await royaltyDistribution.totalDistributions()).to.be.eq(
        ethers.utils.parseEther("10")
      );

      await royaltyDistribution.unlockContract();
      await royaltyDistribution.connect(addr1).claimRoyalties();

      await owner.sendTransaction({
        to: royaltyDistribution.address,
        value: ethers.utils.parseEther("10"),
      });

      expect(await royaltyDistribution.totalDistributions()).to.be.eq(
        ethers.utils.parseEther("20")
      );

      await expect(
        royaltyDistribution.connect(addr1).claimRoyalties()
      ).to.changeEtherBalances(
        [addr1, royaltyDistribution],
        [ethers.utils.parseEther("1"), `-${ethers.utils.parseEther("1")}`]
      );

      await expect(
        royaltyDistribution.connect(addr1).claimRoyalties()
      ).to.be.revertedWith("already taken");
    });
  });
});
