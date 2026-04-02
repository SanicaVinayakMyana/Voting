const FACTORY_ADDRESS = "0xd9145CCE52D386f254917e481eB44e9943F39138";


const FACTORY_ABI = [
  "function createElection() returns (address)",
  "function getAllElections() view returns (address[])",
  "function getElectionsByCommissioner(address) view returns (address[])",
  "function getTotalElections() view returns (uint256)",
  "function getElectionFullInfo(address) view returns (address, string, address, uint256, string, uint256, uint256)",
  "function updateElectionInfo(address, string)",
];

const ELECTION_ABI = [
  "function electionCommissioner() view returns (address)",
  "function isInitialized() view returns (bool)",
  "function initializeElection(string, string, uint256, uint256, uint256, uint256)",
  "function updateTimings(uint256, uint256, uint256, uint256)",
  "function addCandidate(string, string)",
  "function registerVoter()",
  "function approveVoters(address[])",
  "function getRegisteredVoters() view returns (address[])",
  "function vote(uint256)",
  "function getAllCandidates() view returns (tuple(uint256 id, string name, string description, uint256 voteCount, bool exists)[])",
  "function getVoter(address) view returns (bool, bool, bool, uint256)",
  "function getElectionStatus() view returns (string)",
  "function getWinner() view returns (uint256, string, uint256)",
  "function finalizeElection()",
  "function getElectionDetails() view returns (string, string, address, uint256, uint256, string)",
];

let provider, signer, factoryContract, userAddress;
let currentElection = null;
let voterElection = null;
let isCommissioner = false;

async function connectWallet() {
  try {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    userAddress = accounts[0];
    provider = new ethers.BrowserProvider(window.ethereum);

    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 11155111) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
      provider = new ethers.BrowserProvider(window.ethereum);
    }

    signer = await provider.getSigner();
    factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

    document.getElementById("walletStatus").textContent = "Connected";
    document.getElementById(
      "walletAddress"
    ).textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(
      38
    )}`;
    document.getElementById("connectWallet").disabled = true;
    document.getElementById("connectWallet").textContent = "Connected";

    await detectUserRole();
  } catch (error) {
    console.error("Connection error:", error);
    alert("Failed to connect wallet");
  }
}

async function detectUserRole() {
  try {
    const myElections = await factoryContract.getElectionsByCommissioner(
      userAddress
    );

    if (myElections && myElections.length > 0) {
      isCommissioner = true;
      document.getElementById("roleIndicator").textContent = "Commissioner";
      document.getElementById("roleIndicator").style.display = "inline-block";
      document.getElementById("commissionerMode").style.display = "block";
      await loadMyElections();
    } else {
      isCommissioner = false;
      document.getElementById("roleIndicator").textContent = "Voter";
      document.getElementById("roleIndicator").style.display = "inline-block";
      document.getElementById("voterMode").style.display = "block";
      await loadAllElections();
    }
  } catch (error) {
    console.error("Role detection error:", error);
    document.getElementById("voterMode").style.display = "block";
    await loadAllElections();
  }
}

async function loadMyElections() {
  try {
    const myElections = await factoryContract.getElectionsByCommissioner(
      userAddress
    );

    if (!myElections || myElections.length === 0) {
      document.getElementById("electionsList").innerHTML =
        '<p class="alert alert-info">No elections yet. Create your first election.</p>';
      return;
    }

    let html = "";
    for (let addr of myElections) {
      const info = await factoryContract.getElectionFullInfo(addr);
      const [, title, , , status, candidates, votes] = info;

      const statusClass = status.includes("Open")
        ? "badge-open"
        : status.includes("Ended") || status.includes("Finalized")
          ? "badge-closed"
          : "badge-pending";

      html += `
        <div class="card" onclick="selectElection('${addr}')">
          <h3>${title || "Untitled"}</h3>
          <p><span class="badge ${statusClass}">${status}</span></p>
          <p class="mono">${addr.substring(0, 10)}...${addr.substring(38)}</p>
          <p>${candidates} candidates · ${votes} votes</p>
        </div>
      `;
    }
    document.getElementById("electionsList").innerHTML = html;
  } catch (error) {
    console.error("Load error:", error);
  }
}

async function loadAllElections() {
  try {
    const allElections = await factoryContract.getAllElections();

    if (allElections.length === 0) {
      document.getElementById("allElections").innerHTML =
        '<p class="alert alert-info">No elections available.</p>';
      return;
    }

    let html = "";
    for (let addr of allElections) {
      const info = await factoryContract.getElectionFullInfo(addr);
      const [, title, , , status, candidates, votes] = info;

      const statusClass = status.includes("Open")
        ? "badge-open"
        : status.includes("Ended") || status.includes("Finalized")
          ? "badge-closed"
          : "badge-pending";

      html += `
        <div class="card" onclick="selectVoterElection('${addr}')">
          <h3>${title || "Untitled"}</h3>
          <p><span class="badge ${statusClass}">${status}</span></p>
          <p class="mono">${addr.substring(0, 10)}...${addr.substring(38)}</p>
          <p>${candidates} candidates · ${votes} votes</p>
        </div>
      `;
    }
    document.getElementById("allElections").innerHTML = html;
  } catch (error) {
    console.error("Load error:", error);
  }
}

async function createNewElection() {
  try {
    showMessage("electionsList", "Creating election...", "info");
    const tx = await factoryContract.createElection({ gasLimit: 3500000 });
    await tx.wait();
    showMessage("electionsList", "Election created successfully", "success");
    await loadMyElections();
  } catch (error) {
    console.error(error);
    showMessage("electionsList", parseError(error), "error");
  }
}

async function selectElection(addr) {
  currentElection = addr;
  document.getElementById("manageSection").style.display = "block";

  document
    .querySelectorAll("#electionsList .card")
    .forEach((c) => c.classList.remove("selected"));
  event.target.closest(".card").classList.add("selected");

  const contract = new ethers.Contract(addr, ELECTION_ABI, signer);
  const isInit = await contract.isInitialized();

  if (isInit) {
    const details = await contract.getElectionDetails();
    document.getElementById("setupTitle").value = details[0];
    document.getElementById("setupDescription").value = details[1];
  }

  await loadCandidates();
}

async function selectVoterElection(addr) {
  voterElection = addr;
  document.getElementById("voterElectionSection").style.display = "block";

  const contract = new ethers.Contract(addr, ELECTION_ABI, signer);
  const details = await contract.getElectionDetails();
  const voterInfo = await contract.getVoter(userAddress);
  const [isReg, isAppr, hasVoted] = voterInfo;

  document.getElementById("voterElectionTitle").textContent = details[0];

  const statusClass = details[5].includes("Open")
    ? "badge-open"
    : "badge-closed";

  let userStatus = "";
  let showRegisterButton = false;

  if (!isReg) {
    userStatus = "❌ Not registered";
    showRegisterButton = true;
  } else if (!isAppr) {
    userStatus = "⏳ Registration Pending Approval";
    showRegisterButton = false;
  } else if (hasVoted) {
    userStatus = "✅ Already voted";
    showRegisterButton = false;
  } else {
    userStatus = "✅ Registered & Approved - Ready to vote";
    showRegisterButton = false;
  }

  document.getElementById("voterElectionInfo").innerHTML = `
    <p>${details[1]}</p>
    <p><span class="badge ${statusClass}">${details[5]}</span></p>
    <p style="margin-top: 12px; color: #b0b0b0;">${userStatus}</p>
  `;

  const registerBtn = document.getElementById("voterRegisterBtn");
  if (showRegisterButton) {
    registerBtn.style.display = "inline-block";
  } else {
    registerBtn.style.display = "none";
  }

  if (isReg && isAppr) {
    document.getElementById("voterCandidatesSection").style.display = "block";
    await loadVoterCandidates(hasVoted);
  } else {
    document.getElementById("voterCandidatesSection").style.display = "none";
  }
}

async function initializeElection() {
  if (!currentElection) return;

  const title = document.getElementById("setupTitle").value;
  const desc = document.getElementById("setupDescription").value;
  const regStart =
    new Date(document.getElementById("setupRegStart").value).getTime() / 1000;
  const regEnd =
    new Date(document.getElementById("setupRegEnd").value).getTime() / 1000;
  const voteStart =
    new Date(document.getElementById("setupVoteStart").value).getTime() / 1000;
  const voteEnd =
    new Date(document.getElementById("setupVoteEnd").value).getTime() / 1000;

  if (!title || !desc) {
    alert("Fill all fields");
    return;
  }

  try {
    const contract = new ethers.Contract(currentElection, ELECTION_ABI, signer);
    showMessage("setupMessage", "Initializing...", "info");
    const tx = await contract.initializeElection(
      title,
      desc,
      regStart,
      regEnd,
      voteStart,
      voteEnd
    );
    await tx.wait();
    await factoryContract.updateElectionInfo(currentElection, title);
    showMessage("setupMessage", "Election initialized", "success");
    await loadMyElections();
  } catch (error) {
    showMessage("setupMessage", parseError(error), "error");
  }
}

async function updateTimings() {
  if (!currentElection) return;

  const regStart =
    new Date(document.getElementById("setupRegStart").value).getTime() / 1000;
  const regEnd =
    new Date(document.getElementById("setupRegEnd").value).getTime() / 1000;
  const voteStart =
    new Date(document.getElementById("setupVoteStart").value).getTime() / 1000;
  const voteEnd =
    new Date(document.getElementById("setupVoteEnd").value).getTime() / 1000;

  try {
    const contract = new ethers.Contract(currentElection, ELECTION_ABI, signer);
    showMessage("setupMessage", "Updating...", "info");
    const tx = await contract.updateTimings(
      regStart,
      regEnd,
      voteStart,
      voteEnd
    );
    await tx.wait();
    showMessage("setupMessage", "Timings updated", "success");
  } catch (error) {
    showMessage("setupMessage", parseError(error), "error");
  }
}

async function addCandidate() {
  if (!currentElection) return;

  const name = document.getElementById("candidateName").value;
  const desc = document.getElementById("candidateDescription").value;

  if (!name || !desc) {
    alert("Fill all fields");
    return;
  }

  try {
    const contract = new ethers.Contract(currentElection, ELECTION_ABI, signer);
    showMessage("candidatesMessage", "Adding candidate...", "info");
    const tx = await contract.addCandidate(name, desc);
    await tx.wait();
    showMessage("candidatesMessage", "Candidate added", "success");
    document.getElementById("candidateName").value = "";
    document.getElementById("candidateDescription").value = "";
    await loadCandidates();
  } catch (error) {
    showMessage("candidatesMessage", parseError(error), "error");
  }
}

async function loadCandidates() {
  if (!currentElection) return;

  try {
    const contract = new ethers.Contract(currentElection, ELECTION_ABI, signer);
    const candidates = await contract.getAllCandidates();

    if (candidates.length === 0) {
      document.getElementById("candidatesList").innerHTML =
        "<p>No candidates</p>";
      return;
    }

    let html = "";
    for (let c of candidates) {
      html += `
        <div class="card">
          <h3>${c.name}</h3>
          <p>${c.description}</p>
          <p><strong>${c.voteCount}</strong> votes</p>
        </div>
      `;
    }
    document.getElementById("candidatesList").innerHTML = html;
  } catch (error) {
    console.error(error);
  }
}

async function loadVoters() {
  if (!currentElection) return;

  try {
    const contract = new ethers.Contract(currentElection, ELECTION_ABI, signer);
    const voterAddresses = await contract.getRegisteredVoters();

    if (voterAddresses.length === 0) {
      document.getElementById("votersList").innerHTML =
        "<p>No voters registered yet.</p>";
      return;
    }

    let html = "";
    for (let addr of voterAddresses) {
      const voterInfo = await contract.getVoter(addr);
      const [, isAppr, hasVoted] = voterInfo;

      html += `
        <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <p class="mono">${addr.substring(0, 12)}...${addr.substring(
        30
      )}</p>
            <p><span class="badge ${isAppr ? "badge-open" : "badge-pending"
        }">${isAppr ? "Approved" : "Pending"}</span> 
            ${hasVoted ? '<span class="badge badge-closed">Voted</span>' : ""}</p>
          </div>
          <div>
            ${!isAppr
          ? `<button class="btn-sm" onclick="approveVoter('${addr}')">Approve</button>`
          : ""
        }
          </div>
        </div>
      `;
    }
    document.getElementById("votersList").innerHTML = html;
  } catch (error) {
    console.error(error);
  }
}

async function approveVoter(addr) {
  if (!currentElection) return;

  try {
    const contract = new ethers.Contract(currentElection, ELECTION_ABI, signer);
    showMessage("votersMessage", "Approving voter...", "info");
    const tx = await contract.approveVoters([addr]);
    await tx.wait();
    showMessage("votersMessage", "Voter approved!", "success");
    await loadVoters();
  } catch (error) {
    showMessage("votersMessage", parseError(error), "error");
  }
}

async function voterRegister() {
  if (!voterElection) return;

  try {
    const contract = new ethers.Contract(voterElection, ELECTION_ABI, signer);
    showMessage("voterMessage", "Registering...", "info");
    const tx = await contract.registerVoter();
    await tx.wait();
    showMessage("voterMessage", "Registered successfully", "success");
    await selectVoterElection(voterElection);
  } catch (error) {
    showMessage("voterMessage", parseError(error), "error");
  }
}

async function loadVoterCandidates(hasVoted) {
  if (!voterElection) return;

  try {
    const contract = new ethers.Contract(voterElection, ELECTION_ABI, signer);
    const candidates = await contract.getAllCandidates();

    let html = "";
    for (let c of candidates) {
      html += `
        <div class="card">
          <h3>${c.name}</h3>
          <p>${c.description}</p>
          <p><strong>${c.voteCount}</strong> votes</p>
          <button onclick="voterCastVote(${c.id})" ${hasVoted ? "disabled" : ""
        } style="margin-top: 12px;">
            ${hasVoted ? "Already Voted" : "Vote"}
          </button>
        </div>
      `;
    }
    document.getElementById("voterCandidatesList").innerHTML = html;
  } catch (error) {
    console.error(error);
  }
}

async function voterCastVote(id) {
  if (!voterElection) return;

  try {
    const contract = new ethers.Contract(voterElection, ELECTION_ABI, signer);
    showMessage("voterMessage", "Casting vote...", "info");
    const tx = await contract.vote(id);
    await tx.wait();
    showMessage("voterMessage", "✅ Vote cast successfully!", "success");
    await selectVoterElection(voterElection);
  } catch (error) {
    showMessage("voterMessage", parseError(error), "error");
  }
}

async function finalizeElection() {
  if (!currentElection) return;

  try {
    const contract = new ethers.Contract(currentElection, ELECTION_ABI, signer);
    const tx = await contract.finalizeElection();
    await tx.wait();
    alert("Election finalized");
    await loadResults();
  } catch (error) {
    alert(parseError(error));
  }
}

async function loadResults() {
  if (!currentElection) return;

  try {
    const contract = new ethers.Contract(currentElection, ELECTION_ABI, signer);
    const winner = await contract.getWinner();

    document.getElementById("resultsContent").innerHTML = `
      <div style="background: #1f1f1f; padding: 24px; border-radius: 10px; margin-top: 16px; text-align: center; border: 1px solid #2a2a2a;">
        <h2 style="color: #fbbf24; margin-bottom: 8px;">🏆 ${winner[1]}</h2>
        <p style="font-size: 24px; font-weight: 600;">${winner[2]} votes</p>
      </div>
    `;
  } catch (error) {
    console.error(error);
  }
}

function showTab(tab) {
  ["setupTab", "candidatesTab", "votersTab", "resultsTab"].forEach((t) => {
    document.getElementById(t).style.display = "none";
  });
  document.getElementById(tab + "Tab").style.display = "block";

  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  event.target.classList.add("active");

  if (tab === "results") loadResults();
  if (tab === "voters") loadVoters();
}

function parseError(error) {
  if (error.code === 4001) return "Transaction rejected";
  if (error.message.includes("Already initialized"))
    return "Already initialized";
  if (error.message.includes("insufficient funds")) return "Insufficient ETH";
  return error.reason || error.message || "Transaction failed";
}

function showMessage(id, msg, type) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  }
}

function toggleAdminDebug() {
  const isCurrentlyAdmin = document.getElementById("commissionerMode").style.display === "block";
  
  if (isCurrentlyAdmin) {
    document.getElementById("commissionerMode").style.display = "none";
    document.getElementById("voterMode").style.display = "block";
    document.getElementById("roleIndicator").textContent = "Voter (Debug)";
  } else {
    document.getElementById("commissionerMode").style.display = "block";
    document.getElementById("voterMode").style.display = "none";
    document.getElementById("roleIndicator").textContent = "Admin (Debug)";
    document.getElementById("roleIndicator").style.display = "inline-block";
  }
}

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => location.reload());
  window.ethereum.on("chainChanged", () => location.reload());
}
