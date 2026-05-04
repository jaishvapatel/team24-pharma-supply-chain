// PharmaSC Frontend — Team 24 CSE 540
const CONTRACT_ABI=[
  "function admin() view returns (address)",
  "function assignRole(address _account, uint8 _role)",
  "function getRole(address _account) view returns (uint8)",
  "function registerBatch(string _batchId, string _drugName, uint256 _manufactureDate, uint256 _expiryDate, string _ipfsHash)",
  "function transferOwnership(string _batchId, address _to, string _note)",
  "function receiveShipment(string _batchId)",
  "function verifyBatch(string _batchId)",
  "function flagBatch(string _batchId, string _reason)",
  "function getBatch(string _batchId) view returns (tuple(string batchId, string drugName, address currentOwner, uint8 status, uint256 manufactureDate, uint256 expiryDate, string ipfsHash))",
  "function getHistory(string _batchId) view returns (tuple(address from, address to, uint256 timestamp, string note)[])",
  "function getBatchCount() view returns (uint256)",
  "event BatchRegistered(string batchId, string drugName, address manufacturer, uint256 timestamp)",
  "event OwnershipTransferred(string batchId, address from, address to, uint256 timestamp)",
  "event BatchReceived(string batchId, address receiver, uint256 timestamp)",
  "event BatchVerified(string batchId, address verifiedBy, uint256 timestamp)",
  "event BatchFlagged(string batchId, address flaggedBy, string reason, uint256 timestamp)",
  "event RoleAssigned(address account, uint8 role)"
];
const ROLES=["None","Manufacturer","Distributor","Pharmacy","Regulator","Consumer"];
const STATUSES=["Registered","InTransit","Received","Verified","Flagged"];
let provider,contract,contractAddr,accounts={},stats={total:0,verified:0,flagged:0,transit:0};

function short(a){return a.slice(0,6)+"…"+a.slice(-4)}
function now(){return new Date().toLocaleTimeString()}
function $(id){return document.getElementById(id)}

function log(tag,cls,msg){
  const el=$("console");
  const d=document.createElement("div");
  d.className="log-line";
  d.innerHTML=`<span class="ts">[${now()}]</span> <span class="tag ${cls}">${tag}</span> ${msg}`;
  el.appendChild(d);el.scrollTop=el.scrollHeight;
}

function toast(msg,type="success"){
  const el=$("toast");el.textContent=msg;
  el.className=`toast ${type} show`;
  setTimeout(()=>el.classList.remove("show"),3500);
}

function updateStats(){
  $("statTotal").textContent=stats.total;
  $("statVerified").textContent=stats.verified;
  $("statFlagged").textContent=stats.flagged;
  $("statTransit").textContent=stats.transit;
}

function switchRole(role){
  document.querySelectorAll(".role-tab").forEach(t=>t.classList.remove("active"));
  event.currentTarget.classList.add("active");
  document.querySelectorAll(".action-panel").forEach(p=>p.classList.remove("visible"));
  $(`panel-${role}`).classList.add("visible");
}

function setStage(id,s){const el=$(id);el.classList.remove("active","done");if(s)el.classList.add(s)}
function setArrow(id,done){$(id).classList.toggle("done",done)}

// ── Connect & Deploy ────────────────────────────────────
async function connectAndDeploy(){
  const btn=$("btnConnect");btn.disabled=true;
  btn.innerHTML='<span class="spinner"></span>Deploying…';
  try{
    provider=new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const signers=await provider.listAccounts();
    if(signers.length<6)throw new Error("Need 6+ accounts. Run: npx hardhat node");
    log("CONN","tag-ok",`Connected — ${signers.length} accounts`);
    accounts.admin=await provider.getSigner(0);
    accounts.manufacturer=await provider.getSigner(1);
    accounts.distributor=await provider.getSigner(2);
    accounts.pharmacy=await provider.getSigner(3);
    accounts.regulator=await provider.getSigner(4);
    accounts.consumer=await provider.getSigner(5);
    for(const[r,s]of Object.entries(accounts)){
      log("INFO","tag-info",`${r}: <span class="addr">${short(await s.getAddress())}</span>`);
    }
    log("TX","tag-tx","Deploying contract…");
    const factory=new ethers.ContractFactory(CONTRACT_ABI,BYTECODE,accounts.admin);
    contract=await factory.deploy();
    await contract.waitForDeployment();
    contractAddr=await contract.getAddress();
    log("OK","tag-ok",`Deployed at <span class="addr">${short(contractAddr)}</span>`);

    log("TX","tag-tx","Assigning roles…");
    const roles=[[accounts.manufacturer,1],[accounts.distributor,2],[accounts.pharmacy,3],[accounts.regulator,4],[accounts.consumer,5]];
    for(const[s,r]of roles){
      await(await contract.connect(accounts.admin).assignRole(await s.getAddress(),r)).wait();
      log("OK","tag-ok",`${ROLES[r]}: <span class="addr">${short(await s.getAddress())}</span>`);
    }

    $("connStatus").innerHTML='<span class="dot"></span>Connected';
    $("connStatus").className="conn-badge connected";
    $("connectCard").classList.add("hidden");
    $("roleTabs").classList.remove("hidden");
    $("mainGrid").classList.remove("hidden");
    $("statsRow").classList.remove("hidden");
    $("pipelineCard").classList.remove("hidden");
    $("mfgTransTo").value=await accounts.distributor.getAddress();
    $("distTransTo").value=await accounts.pharmacy.getAddress();
    toast("Contract deployed & roles assigned!");
  }catch(err){
    log("ERR","tag-err",err.message);toast(err.message,"error");
    btn.disabled=false;btn.textContent="Deploy Contract & Connect";
  }
}

// ── Admin ───────────────────────────────────────────────
async function assignRole(){
  const addr=$("roleAddr").value.trim();
  const role=parseInt($("roleSelect").value);
  if(!addr)return toast("Enter address","error");
  try{
    log("TX","tag-tx",`Assigning ${ROLES[role]} to <span class="addr">${short(addr)}</span>…`);
    await(await contract.connect(accounts.admin).assignRole(addr,role)).wait();
    log("OK","tag-ok",`${ROLES[role]} assigned`);toast(`Role assigned: ${ROLES[role]}`);
  }catch(e){log("ERR","tag-err",e.reason||e.message);toast(e.reason||e.message,"error")}
}
async function checkRole(){
  const addr=$("checkRoleAddr").value.trim();
  if(!addr)return toast("Enter address","error");
  try{
    const r=await contract.getRole(addr);
    $("roleResult").textContent=`Role: ${ROLES[Number(r)]}`;
    $("roleResult").style.display="block";
    log("INFO","tag-info",`<span class="addr">${short(addr)}</span> → ${ROLES[Number(r)]}`);
  }catch(e){log("ERR","tag-err",e.reason||e.message)}
}

// ── Manufacturer ────────────────────────────────────────
async function registerBatch(){
  const id=$("regBatchId").value.trim(),name=$("regDrugName").value.trim();
  const mfg=new Date($("regMfgDate").value).getTime()/1000||Math.floor(Date.now()/1000);
  const exp=new Date($("regExpDate").value).getTime()/1000||(Math.floor(Date.now()/1000)+365*86400);
  const ipfs=$("regIpfs").value.trim()||"QmNoHash";
  if(!id||!name)return toast("Fill Batch ID & Drug Name","error");
  try{
    log("TX","tag-tx",`Registering <b>${id}</b> — ${name}…`);
    await(await contract.connect(accounts.manufacturer).registerBatch(id,name,BigInt(Math.floor(mfg)),BigInt(Math.floor(exp)),ipfs)).wait();
    log("OK","tag-ok",`<b>${id}</b> registered`);toast(`Batch ${id} registered!`);
    stats.total++;updateStats();setStage("s-mfg","active");
  }catch(e){log("ERR","tag-err",e.reason||e.message);toast(e.reason||e.message,"error")}
}

// ── Transfer ────────────────────────────────────────────
async function transferFrom(fromRole){
  let id,to,note,signer;
  if(fromRole==="manufacturer"){
    id=$("mfgTransBatchId").value.trim();to=$("mfgTransTo").value.trim();
    note=$("mfgTransNote").value.trim()||"Transfer";signer=accounts.manufacturer;
  }else{
    id=$("distTransBatchId").value.trim();to=$("distTransTo").value.trim();
    note=$("distTransNote").value.trim()||"Transfer";signer=accounts.distributor;
  }
  if(!id||!to)return toast("Fill Batch ID & address","error");
  try{
    log("TX","tag-tx",`Transferring <b>${id}</b> → <span class="addr">${short(to)}</span>…`);
    await(await contract.connect(signer).transferOwnership(id,to,note)).wait();
    log("OK","tag-ok",`<b>${id}</b> transferred`);toast("Batch transferred!");
    stats.transit++;updateStats();
    if(fromRole==="manufacturer"){setStage("s-mfg","done");setArrow("a1",true);setStage("s-dist","active")}
    else{setStage("s-dist","done");setArrow("a2",true);setStage("s-pharm","active")}
  }catch(e){log("ERR","tag-err",e.reason||e.message);toast(e.reason||e.message,"error")}
}

// ── Receive ─────────────────────────────────────────────
async function receiveShipment(role){
  const id=$(role==="distributor"?"distRecvBatchId":"pharmRecvBatchId").value.trim();
  if(!id)return toast("Enter Batch ID","error");
  try{
    log("TX","tag-tx",`Confirming receipt of <b>${id}</b>…`);
    await(await contract.connect(accounts[role]).receiveShipment(id)).wait();
    log("OK","tag-ok",`Receipt confirmed for <b>${id}</b>`);toast("Receipt confirmed!");
    if(stats.transit>0)stats.transit--;updateStats();
  }catch(e){log("ERR","tag-err",e.reason||e.message);toast(e.reason||e.message,"error")}
}

// ── Verify ──────────────────────────────────────────────
async function verifyBatch(){
  const id=$("verifyBatchId").value.trim();
  if(!id)return toast("Enter Batch ID","error");
  try{
    log("TX","tag-tx",`Verifying <b>${id}</b>…`);
    await(await contract.connect(accounts.pharmacy).verifyBatch(id)).wait();
    log("OK","tag-ok",`<b>${id}</b> VERIFIED ✓`);toast("Batch verified!");
    stats.verified++;updateStats();
    setStage("s-pharm","done");setArrow("a3",true);setStage("s-verify","done");
  }catch(e){log("ERR","tag-err",e.reason||e.message);toast(e.reason||e.message,"error")}
}

// ── Flag ────────────────────────────────────────────────
async function flagBatch(){
  const id=$("flagBatchId").value.trim();
  const reason=$("flagReason").value.trim()||"Suspicious";
  if(!id)return toast("Enter Batch ID","error");
  try{
    log("TX","tag-tx",`Flagging <b>${id}</b>…`);
    await(await contract.connect(accounts.pharmacy).flagBatch(id,reason)).wait();
    log("OK","tag-err",`<b>${id}</b> FLAGGED — ${reason}`);toast("Batch flagged!");
    stats.flagged++;updateStats();
  }catch(e){log("ERR","tag-err",e.reason||e.message);toast(e.reason||e.message,"error")}
}
async function regFlagBatch(){
  const id=$("regFlagBatchId").value.trim();
  const reason=$("regFlagReason").value.trim()||"Compliance issue";
  if(!id)return toast("Enter Batch ID","error");
  try{
    log("TX","tag-tx",`Regulator flagging <b>${id}</b>…`);
    await(await contract.connect(accounts.regulator).flagBatch(id,reason)).wait();
    log("OK","tag-err",`<b>${id}</b> FLAGGED — ${reason}`);toast("Batch flagged!");
    stats.flagged++;updateStats();
  }catch(e){log("ERR","tag-err",e.reason||e.message);toast(e.reason||e.message,"error")}
}

// ── Lookup ──────────────────────────────────────────────
function getReadContract(){
  return new ethers.Contract(contractAddr, CONTRACT_ABI, provider);
}
async function lookupBatch(){
  const id=$("lookupBatchId").value.trim();
  if(!id)return toast("Enter Batch ID","error");
  try{
    const reader=getReadContract();
    const b=await reader.getBatch(id);
    $("batchResult").innerHTML=`<div class="batch-grid">
      <div class="batch-item"><div class="lbl">Batch ID</div><div class="val">${b.batchId}</div></div>
      <div class="batch-item"><div class="lbl">Drug Name</div><div class="val">${b.drugName}</div></div>
      <div class="batch-item"><div class="lbl">Owner</div><div class="val"><span class="addr">${short(b.currentOwner)}</span></div></div>
      <div class="batch-item"><div class="lbl">Status</div><div class="val"><span class="status-badge status-${b.status}">${STATUSES[Number(b.status)]}</span></div></div>
      <div class="batch-item"><div class="lbl">Mfg Date</div><div class="val">${new Date(Number(b.manufactureDate)*1000).toLocaleDateString()}</div></div>
      <div class="batch-item"><div class="lbl">Exp Date</div><div class="val">${new Date(Number(b.expiryDate)*1000).toLocaleDateString()}</div></div>
      <div class="batch-item full"><div class="lbl">IPFS Hash</div><div class="val" style="font-size:11px;font-family:'JetBrains Mono',monospace">${b.ipfsHash}</div></div>
    </div>`;
    log("INFO","tag-info",`<b>${id}</b>: ${b.drugName} — ${STATUSES[Number(b.status)]}`);
  }catch(e){log("ERR","tag-err",e.reason||e.message);toast("Batch not found","error")}
}
async function lookupHistory(){
  const id=$("lookupBatchId").value.trim();
  if(!id)return toast("Enter Batch ID","error");
  try{
    const reader=getReadContract();
    const h=await reader.getHistory(id);
    if(!h.length){$("historyResult").innerHTML='<p style="color:var(--text-dim);font-size:13px">No transfers yet.</p>';return}
    let html='<table class="history-table"><thead><tr><th>#</th><th>From</th><th>To</th><th>Time</th><th>Note</th></tr></thead><tbody>';
    h.forEach((r,i)=>{html+=`<tr><td style="font-weight:600">${i+1}</td><td><span class="addr">${short(r.from)}</span></td><td><span class="addr">${short(r.to)}</span></td><td>${new Date(Number(r.timestamp)*1000).toLocaleString()}</td><td>${r.note}</td></tr>`});
    html+='</tbody></table>';
    $("historyResult").innerHTML=html;
    log("INFO","tag-info",`<b>${id}</b>: ${h.length} transfer(s)`);
  }catch(e){log("ERR","tag-err",e.reason||e.message);toast("Could not fetch history","error")}
}
