// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DecentralizedElection
 * @dev Individual election contract
 */
contract DecentralizedElection {
    
    struct Candidate {
        uint256 id;
        string name;
        string description;
        uint256 voteCount;
        bool exists;
    }
    
    struct Voter {
        bool isRegistered;
        bool isApproved;
        bool hasVoted;
        uint256 votedCandidateId;
        uint256 registrationTime;
    }
    
    // State variables
    address public electionCommissioner;
    string public electionTitle;
    string public electionDescription;
    
    uint256 public candidateCount;
    uint256 public totalVotes;
    
    uint256 public registrationStartTime;
    uint256 public registrationEndTime;
    uint256 public votingStartTime;
    uint256 public votingEndTime;
    
    bool public electionFinalized;
    bool public isInitialized;
    
    // Mappings
    mapping(uint256 => Candidate) public candidates;
    mapping(address => Voter) public voters;
    address[] public registeredVoters;
    
    // Events
    event ElectionInitialized(string title, address commissioner);
    event CandidateAdded(uint256 indexed candidateId, string name);
    event VoterRegistered(address indexed voter);
    event VoterApproved(address indexed voter);
    event VoteCasted(address indexed voter, uint256 indexed candidateId);
    event ElectionFinalized(uint256 winningCandidateId, uint256 totalVotes);
    event TimingsUpdated(uint256 regStart, uint256 regEnd, uint256 voteStart, uint256 voteEnd);
    
    // Modifiers
    modifier onlyCommissioner() {
        require(msg.sender == electionCommissioner, "Only commissioner can perform this action");
        _;
    }
    
    modifier onlyInitialized() {
        require(isInitialized, "Election not initialized yet");
        _;
    }
    
    modifier registrationOpen() {
        require(isInitialized, "Election not initialized");
        require(block.timestamp >= registrationStartTime, "Registration not started yet");
        require(block.timestamp <= registrationEndTime, "Registration period ended");
        _;
    }
    
    modifier votingOpen() {
        require(isInitialized, "Election not initialized");
        require(block.timestamp >= votingStartTime, "Voting not started yet");
        require(block.timestamp <= votingEndTime, "Voting period ended");
        require(!electionFinalized, "Election already finalized");
        _;
    }
    
    modifier notFinalized() {
        require(!electionFinalized, "Election already finalized");
        _;
    }
    
    constructor(address _commissioner) {
        electionCommissioner = _commissioner;
    }
    
    function initializeElection(
        string memory _title,
        string memory _description,
        uint256 _regStartTime,
        uint256 _regEndTime,
        uint256 _voteStartTime,
        uint256 _voteEndTime
    ) public onlyCommissioner {
        require(!isInitialized, "Already initialized");
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(_regStartTime < _regEndTime, "Invalid registration period");
        require(_regEndTime <= _voteStartTime, "Registration must end before voting");
        require(_voteStartTime < _voteEndTime, "Invalid voting period");
        
        electionTitle = _title;
        electionDescription = _description;
        registrationStartTime = _regStartTime;
        registrationEndTime = _regEndTime;
        votingStartTime = _voteStartTime;
        votingEndTime = _voteEndTime;
        isInitialized = true;
        
        emit ElectionInitialized(_title, msg.sender);
    }
    
    /**
     * @dev Update election timings (only commissioner, before finalization)
     */
    function updateTimings(
        uint256 _regStartTime,
        uint256 _regEndTime,
        uint256 _voteStartTime,
        uint256 _voteEndTime
    ) public onlyCommissioner onlyInitialized notFinalized {
        require(_regStartTime < _regEndTime, "Invalid registration period");
        require(_regEndTime <= _voteStartTime, "Registration must end before voting");
        require(_voteStartTime < _voteEndTime, "Invalid voting period");
        require(block.timestamp < votingStartTime, "Cannot update after voting starts");
        
        registrationStartTime = _regStartTime;
        registrationEndTime = _regEndTime;
        votingStartTime = _voteStartTime;
        votingEndTime = _voteEndTime;
        
        emit TimingsUpdated(_regStartTime, _regEndTime, _voteStartTime, _voteEndTime);
    }
    
    function addCandidate(string memory _name, string memory _description) 
        public 
        onlyCommissioner 
        onlyInitialized
        notFinalized 
    {
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        require(block.timestamp < votingStartTime, "Cannot add candidates after voting starts");
        
        candidateCount++;
        candidates[candidateCount] = Candidate({
            id: candidateCount,
            name: _name,
            description: _description,
            voteCount: 0,
            exists: true
        });
        
        emit CandidateAdded(candidateCount, _name);
    }
    
    function registerVoter() public registrationOpen {
        require(!voters[msg.sender].isRegistered, "Already registered");
        
        voters[msg.sender] = Voter({
            isRegistered: true,
            isApproved: false,
            hasVoted: false,
            votedCandidateId: 0,
            registrationTime: block.timestamp
        });
        
        registeredVoters.push(msg.sender);
        emit VoterRegistered(msg.sender);
    }
    
    function approveVoters(address[] memory _voterAddresses) public onlyCommissioner {
        for (uint256 i = 0; i < _voterAddresses.length; i++) {
            address voterAddr = _voterAddresses[i];
            if (voters[voterAddr].isRegistered && !voters[voterAddr].isApproved) {
                voters[voterAddr].isApproved = true;
                emit VoterApproved(voterAddr);
            }
        }
    }
    
    function getRegisteredVoters() public view returns (address[] memory) {
        return registeredVoters;
    }
    
    function vote(uint256 _candidateId) public votingOpen {
        require(voters[msg.sender].isRegistered, "Not registered as voter");
        require(voters[msg.sender].isApproved, "Voter not approved by commissioner");
        require(!voters[msg.sender].hasVoted, "Already voted");
        require(candidates[_candidateId].exists, "Invalid candidate");
        
        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedCandidateId = _candidateId;
        
        candidates[_candidateId].voteCount++;
        totalVotes++;
        
        emit VoteCasted(msg.sender, _candidateId);
    }
    
    function getAllCandidates() public view returns (Candidate[] memory) {
        Candidate[] memory allCandidates = new Candidate[](candidateCount);
        
        for (uint256 i = 1; i <= candidateCount; i++) {
            allCandidates[i - 1] = candidates[i];
        }
        
        return allCandidates;
    }
    
    function getVoter(address _voter) 
        public 
        view 
        returns (
            bool isReg,
            bool isAppr,
            bool hasVote,
            uint256 votedCandidateId
        ) 
    {
        Voter memory v = voters[_voter];
        return (v.isRegistered, v.isApproved, v.hasVoted, v.votedCandidateId);
    }
    
    function getElectionStatus() public view returns (string memory) {
        if (!isInitialized) {
            return "Not Initialized";
        } else if (electionFinalized) {
            return "Finalized";
        } else if (block.timestamp < registrationStartTime) {
            return "Not Started";
        } else if (block.timestamp <= registrationEndTime) {
            return "Registration Open";
        } else if (block.timestamp < votingStartTime) {
            return "Registration Closed";
        } else if (block.timestamp <= votingEndTime) {
            return "Voting Open";
        } else {
            return "Voting Ended";
        }
    }
    
    function getWinner() public view returns (uint256 winningCandidateId, string memory winnerName, uint256 winningVoteCount) {
        require(isInitialized, "Election not initialized");
        require(block.timestamp > votingEndTime || electionFinalized, "Election still ongoing");
        require(candidateCount > 0, "No candidates");
        
        uint256 winningVoteCountTemp = 0;
        uint256 winningCandidateIdTemp = 0;
        
        for (uint256 i = 1; i <= candidateCount; i++) {
            if (candidates[i].voteCount > winningVoteCountTemp) {
                winningVoteCountTemp = candidates[i].voteCount;
                winningCandidateIdTemp = i;
            }
        }
        
        return (winningCandidateIdTemp, candidates[winningCandidateIdTemp].name, winningVoteCountTemp);
    }
    
    function finalizeElection() public onlyCommissioner onlyInitialized {
        require(block.timestamp > votingEndTime, "Voting period not ended");
        require(!electionFinalized, "Already finalized");
        
        electionFinalized = true;
        
        (uint256 winnerId, , uint256 votes) = getWinner();
        emit ElectionFinalized(winnerId, votes);
    }
    
    function getElectionDetails() 
        public 
        view 
        returns (
            string memory title,
            string memory description,
            address commissioner,
            uint256 totalCandidates,
            uint256 totalVotesCasted,
            string memory status
        ) 
    {
        return (
            electionTitle,
            electionDescription,
            electionCommissioner,
            candidateCount,
            totalVotes,
            getElectionStatus()
        );
    }
}


/**
 * @title ElectionFactory
 * @dev Factory contract to create and manage multiple election sessions
 */
contract ElectionFactory {
    
    struct ElectionInfo {
        address electionAddress;
        string title;
        address commissioner;
        uint256 createdAt;
        bool exists;
    }
    
    // Array of all election addresses
    address[] public allElections;
    
    // Mapping from election address to info
    mapping(address => ElectionInfo) public electionInfo;
    
    // Mapping from commissioner to their elections
    mapping(address => address[]) public commissionerElections;
    
    // Events
    event ElectionCreated(address indexed electionAddress, address indexed commissioner, string title);
    
    /**
     * @dev Create a new election session
     */
    function createElection() public returns (address) {
        DecentralizedElection newElection = new DecentralizedElection(msg.sender);
        address electionAddress = address(newElection);
        
        allElections.push(electionAddress);
        commissionerElections[msg.sender].push(electionAddress);
        
        electionInfo[electionAddress] = ElectionInfo({
            electionAddress: electionAddress,
            title: "Untitled Election",
            commissioner: msg.sender,
            createdAt: block.timestamp,
            exists: true
        });
        
        emit ElectionCreated(electionAddress, msg.sender, "Untitled Election");
        
        return electionAddress;
    }
    
    /**
     * @dev Update election info after initialization
     */
    function updateElectionInfo(address _electionAddress, string memory _title) public {
        require(electionInfo[_electionAddress].exists, "Election does not exist");
        require(electionInfo[_electionAddress].commissioner == msg.sender, "Not the commissioner");
        
        electionInfo[_electionAddress].title = _title;
    }
    
    /**
     * @dev Get all elections
     */
    function getAllElections() public view returns (address[] memory) {
        return allElections;
    }
    
    /**
     * @dev Get elections by commissioner
     */
    function getElectionsByCommissioner(address _commissioner) public view returns (address[] memory) {
        return commissionerElections[_commissioner];
    }
    
    /**
     * @dev Get total number of elections
     */
    function getTotalElections() public view returns (uint256) {
        return allElections.length;
    }
    
    /**
     * @dev Get election info with details
     */
    function getElectionFullInfo(address _electionAddress) 
        public 
        view 
        returns (
            address electionAddress,
            string memory title,
            address commissioner,
            uint256 createdAt,
            string memory status,
            uint256 totalCandidates,
            uint256 totalVotes
        ) 
    {
        require(electionInfo[_electionAddress].exists, "Election does not exist");
        
        DecentralizedElection election = DecentralizedElection(_electionAddress);
        
        ElectionInfo memory info = electionInfo[_electionAddress];
        
        return (
            info.electionAddress,
            info.title,
            info.commissioner,
            info.createdAt,
            election.getElectionStatus(),
            election.candidateCount(),
            election.totalVotes()
        );
    }
}
