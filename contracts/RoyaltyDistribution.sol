// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract RoyaltyDistribution {
    struct Member {
        address memberAddress;
        uint256 percentage;
        uint256 distributedRoyaltyAmount;
    }

    bool public isLocked;
    address public _admin;
    uint256 public totalDistributions;
    uint256 public _totalPercentage;
    uint256 private _totalCosts;

    mapping(address => Member) public members;
    mapping(string => uint256) public costs;

    constructor() {
        _admin = msg.sender;
        isLocked = true;
    }

    modifier onlyAdmin() {
        require(msg.sender == _admin, "not admin");
        _;
    }

    modifier contractNotLocked() {
        require(!isLocked, "contract is locked");
        _;
    }

    modifier contractLocked() {
        require(isLocked, "contract is not locked");
        _;
    }

    function addMember(
        address _memberWalletAddress,
        uint256 _percentage
    ) external onlyAdmin contractLocked {
        require(
            _memberWalletAddress != address(0),
            "member cant be zero address"
        );
        require(
            members[_memberWalletAddress].memberAddress == address(0),
            "member already exists"
        );
        require(
            _totalPercentage + _percentage <= 100,
            "percentage cant be greater than 100"
        );
        members[_memberWalletAddress] = Member(
            _memberWalletAddress,
            _percentage,
            0
        );
        _totalPercentage += _percentage;
    }

    function editMember(
        address _memberWalletAddress,
        uint256 _percentage
    ) external onlyAdmin contractLocked {
        require(
            members[_memberWalletAddress].memberAddress != address(0),
            "member doesnt exist"
        );
        require(
            _totalPercentage + _percentage <= 100,
            "percentage cant be greater than 100"
        );
        _totalPercentage -= members[_memberWalletAddress].percentage;
        _totalPercentage += _percentage;
        members[_memberWalletAddress].percentage = _percentage;
    }

    function setAdminPercentage(uint256 _percentage) public onlyAdmin {
        require(
            _totalPercentage + _percentage <= 100,
            "percentage cant be greater than 100"
        );
        _totalPercentage += _percentage;
        members[msg.sender].percentage = _percentage;
    }

    function claimRoyalties() external contractNotLocked {
        require(_totalCosts == 0, "costs values not deducted");
        require(totalDistributions > 0, "ensufficient funds");
        require(
            members[msg.sender].memberAddress != address(0),
            "member doesnt exist"
        );
        uint256 _memberCost = (totalDistributions *
            members[msg.sender].percentage) / 100;

        require(
            _memberCost > members[msg.sender].distributedRoyaltyAmount,
            "already taken"
        );

        uint256 newMemberCost = _memberCost -
            members[msg.sender].distributedRoyaltyAmount;

        members[msg.sender].distributedRoyaltyAmount += newMemberCost;
        payable(msg.sender).transfer(newMemberCost);
    }

    function addCost(
        string calldata _name,
        uint256 _cost
    ) external onlyAdmin contractLocked {
        _totalCosts += _cost;
        costs[_name] = _cost;
    }

    function deleteCost(
        string calldata _name
    ) external onlyAdmin contractLocked {
        _totalCosts -= costs[_name];
        delete costs[_name];
    }

    function deductCost(
        string calldata _name
    ) external onlyAdmin contractLocked {
        require(costs[_name] != 0, "");
        require(
            totalDistributions >= costs[_name],
            "not enough total distribution"
        );
        require(_totalCosts >= costs[_name], "not enough total costs");
        _totalCosts -= costs[_name];
        totalDistributions -= costs[_name];
    }

    function submitFinalCosts() external onlyAdmin contractLocked {
        require(_totalCosts != 0, "total costs is 0");
        unlockContract();
    }

    function claimCosts() external onlyAdmin contractNotLocked {
        uint256 amountToSend = _totalCosts * 1 ether;
        require(amountToSend < totalDistributions, "not enough balance");
        totalDistributions -= amountToSend;
        payable(_admin).transfer(amountToSend);
        _totalCosts = 0;
    }

    function unlockContract() public onlyAdmin {
        isLocked = false;
    }

    receive() external payable {
        totalDistributions += msg.value;
    }
}
