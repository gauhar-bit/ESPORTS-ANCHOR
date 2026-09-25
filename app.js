// ==========================================
// 1. FIREBASE INITIALIZATION
// =============/=============================
const firebaseConfig = {
    apiKey: "AIzaSyAZ2-N8LftZ9D7FmmQMUq0drOt3YOEQtZg",
  authDomain: "esports-anchor.firebaseapp.com",
  databaseURL: "https://esports-anchor-default-rtdb.firebaseio.com",
  projectId: "esports-anchor",
  storageBucket: "esports-anchor.firebasestorage.app",
  messagingSenderId: "369229923615",
  appId: "1:369229923615:web:359e43a502004bd7379c2a",
  measurementId: "G-931B6VB200"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const database = firebase.database();
const auth = firebase.auth();

// ==========================================
// 2. GLOBAL STATE VARIABLES
// ==========================================
let currentUser = null;
let userFavTeam = "";
let activeTab = 'matches';
let activeGameFilter = 'ALL';
let globalHistoryData = {};
let globalLiveMatchData = {};

// ==========================================
// 3. THEME LOGIC (DAY/NIGHT)
// ==========================================
if(localStorage.getItem('savedTheme') === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    document.getElementById('themeIcon').className = "fa-solid fa-sun";
}

function toggleAppTheme() {
    let current = document.documentElement.getAttribute('data-theme');
    let newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    document.getElementById('themeIcon').className = newTheme === 'light' ? "fa-solid fa-sun" : "fa-solid fa-moon";
    localStorage.setItem('savedTheme', newTheme);
}

// ==========================================
// 4. UI NAVIGATION & TOGGLES
// ==========================================
function switchPortalView(targetId, btnElement) {
    // Hide all views, show targeted view
    document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    // Update active state on top nav bar (if clicked from nav)
    if(btnElement) {
        document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }
    
    if(targetId === 'inbox-view' && currentUser) markMailsAsRead(); 
}

function toggleMatchDetails(detailsId, iconId, headerEl) {
    const detailsDiv = document.getElementById(detailsId);
    const icon = document.getElementById(iconId);
    
    if(detailsDiv.style.display === 'none') {
        detailsDiv.style.display = 'block';
        icon.classList.add('open');
        headerEl.classList.add('expanded');
    } else {
        detailsDiv.style.display = 'none';
        icon.classList.remove('open');
        headerEl.classList.remove('expanded');
    }
}

function setGameFilter(game, btnEl) {
    activeGameFilter = game;
    document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    renderDataViews();
}

function toggleLeaderboardTab(targetMode) {
    activeTab = targetMode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(targetMode === 'matches') {
        document.getElementById('btnActiveTab').classList.add('active');
        document.getElementById('matchesContainerView').style.display = 'block';
        document.getElementById('overallContainerView').style.display = 'none';
    } else {
        document.getElementById('btnOverallTab').classList.add('active');
        document.getElementById('matchesContainerView').style.display = 'none';
        document.getElementById('overallContainerView').style.display = 'block';
    }
    renderDataViews();
}

// ==========================================
// 5. AUTHENTICATION & USER PROFILE
// ==========================================
auth.onAuthStateChanged(user => {
    if(user) {
                   currentUser = user;
            
            
            let shortName = user.displayName ? user.displayName : (user.email ? user.email.split('@')[0] : user.uid);
            if (shortName.length > 10) { shortName = shortName.substring(0, 10) + "..."; }
            document.getElementById('userProfileArea').innerText = "👤 " + shortName.toUpperCase();
            // --------------------------------------------
 
      ('userProfileArea').innerText = "👤 " + user.email.split('@')[0].toUpperCase();
        document.getElementById('authFormBlock').style.display = 'none';
        document.getElementById('authWelcomeBlock').style.display = 'flex';
        document.getElementById('authMenuLink').innerHTML = '<i class="fa-solid fa-user-gear"></i> Profile';
        document.getElementById('squadLoggedOutMsg').style.display = 'none';
        document.getElementById('squadLoggedInBlock').style.display = 'block';
        document.getElementById('displayPlayerUid').innerText = user.uid;

        database.ref(`users/${user.uid}/favTeam`).once('value', s => {
            if(s.exists()) { userFavTeam = s.val(); document.getElementById('userFavTeamInput').value = userFavTeam; }
        });
        syncSquadLeaderOperationsPanel();

        database.ref(`mailboxes/${user.uid}`).on('value', snap => {
            const box = document.getElementById('mailboxContainer'); box.innerHTML = '';
            let unreadCount = 0;
            if(snap.exists()) {
                snap.forEach(child => {
                    const m = child.val();
                    if(!m.read) unreadCount++;
                    let codeHTML = m.redeemCode ? `<div class="mail-code">🎟️ ${m.redeemCode}</div>` : '';
                    box.innerHTML += `
                        <div class="mail-item">
                            <div style="font-size:12px; font-weight: 600; color:var(--text-sub); margin-bottom:10px;"><i class="fa-solid fa-user-shield"></i> ${m.sender}</div>
                            <div style="font-size:14px; line-height:1.6;">${m.message}</div>
                            ${codeHTML}
                        </div>
                    `;
                });
            } else {
                box.innerHTML = '<div class="custom-card center-text">No messages in inbox.</div>';
            }
            let dot = document.getElementById('navMailCount');
            if(unreadCount > 0) { dot.innerText = unreadCount; dot.style.display = 'inline-block'; }
            else { dot.style.display = 'none'; }
        });

    } else {
        currentUser = null;
        document.getElementById('userProfileArea').innerText = "";
        document.getElementById('authFormBlock').style.display = 'flex';
        document.getElementById('authWelcomeBlock').style.display = 'none';
        document.getElementById('authMenuLink').innerHTML = '<i class="fa-solid fa-user-lock"></i> Login';
        document.getElementById('squadLoggedOutMsg').style.display = 'block';
        document.getElementById('squadLoggedInBlock').style.display = 'none';
        document.getElementById('displayPlayerUid').innerText = "Login required";
        document.getElementById('mailboxContainer').innerHTML = '<div class="custom-card center-text">Log in to view your private rewards inbox.</div>';
        userFavTeam = "";
    }
});

function processAuthAction(mode) {
    const email = document.getElementById('authEmail').value.trim();
    const pass = document.getElementById('authPass').value.trim();
    if(!email || !pass) return alert('Fill authorization entry parameters.');
    if(mode === 'login') auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
    else auth.createUserWithEmailAndPassword(email, pass).catch(e => alert(e.message));
}

function terminateUserSession() { auth.signOut().then(() => window.location.reload()); }

function commitFavPreference() {
    if(currentUser) {
        const teamVal = document.getElementById('userFavTeamInput').value.trim();
        database.ref(`users/${currentUser.uid}/favTeam`).set(teamVal).then(() => {
            userFavTeam = teamVal;
            alert('Highlight display preference saved!');
            renderDataViews();
        });
    }
}

function markMailsAsRead() {
    if(!currentUser) return;
    database.ref(`mailboxes/${currentUser.uid}`).once('value', snap => {
        if(snap.exists()) { snap.forEach(child => child.ref.update({read: true})); }
    });
}

// ==========================================
// 6. REALTIME DATA FETCHERS
// ==========================================
function attachDataListeners() {
    database.ref('tournament_1/history').on('value', snap => {
        globalHistoryData = snap.exists() ? snap.val() : {};
        renderDataViews();
    });
    database.ref('tournament_1/liveMatchData').on('value', snap => {
        globalLiveMatchData = snap.exists() ? snap.val() : {};
        renderDataViews();
    });
    
    // App Settings (Broadcast & Links)
    database.ref('app_settings').on('value', s => {
        if(!s.exists()) return;
        let waLink = document.getElementById('navWhatsApp');
        let tgLink = document.getElementById('navTelegram');
        if(waLink) waLink.href = s.val().whatsappUrl || "#";
        if(tgLink) tgLink.href = s.val().telegramUrl || "#";
    });
    
    database.ref('announcements/tournament_1').on('value', s => {
        const el = document.getElementById('broadcastTicker');
        if(s.exists() && s.val().text) { el.innerText = "📣 BULLETIN: " + s.val().text; el.style.display = 'block'; }
        else el.style.display = 'none';
    });
}

// ==========================================
// 7. RENDER ENGINE (MATCHES & OVERALL)
// ==========================================
function renderDataViews() {
    renderSwipeableMatches();
    renderInstantOverall();
}

// Horizontal Match Slider Rendering
function renderSwipeableMatches() {
    const container = document.getElementById('tournamentsList');
    container.innerHTML = '';
    let allMatchesToRender = [];
    
    Object.keys(globalHistoryData).forEach(key => {
        const match = globalHistoryData[key];
        if(activeGameFilter === 'ALL' || (match.gameName && match.gameName.includes(activeGameFilter))) {
            allMatchesToRender.push({...match, isLive: false, sortKey: match.timestamp || 0});
        }
    });

    Object.keys(globalLiveMatchData).forEach(key => {
        const match = globalLiveMatchData[key];
        if(activeGameFilter === 'ALL' || (match.gameName && match.gameName.includes(activeGameFilter))) {
            allMatchesToRender.push({...match, isLive: true, sortKey: Date.now()});
        }
    });

    allMatchesToRender.sort((a, b) => b.sortKey - a.sortKey); 

    if(allMatchesToRender.length === 0) {
        container.innerHTML = '<div class="custom-card center-text" style="width:100%;">No match data found for this filter.</div>';
        return;
    }

    allMatchesToRender.forEach((match, idx) => {
        let sorted = Object.values(match.teams || {}).sort((a,b) => b.totalPoints - a.totalPoints);
        let matchBlocksHTML = '';
        
        let isPUBG = match.gameName && (match.gameName.includes("BGMI") || match.gameName.includes("PUBG"));
        let labelWWCD = isPUBG ? "WWCD Pts" : "Place Pts";

        sorted.forEach((t, tIdx) => {
            let rankMedal = tIdx === 0 ? '🥇' : tIdx === 1 ? '🥈' : tIdx === 2 ? '🥉' : tIdx + 1;
            let matchRowHighlight = (userFavTeam && t.name.toLowerCase() === userFavTeam.toLowerCase()) ? 'background:rgba(0,255,255,0.08);' : '';
            let favBadgeHTML = (userFavTeam && t.name.toLowerCase() === userFavTeam.toLowerCase()) ? '<span class="fav-badge">FAV</span>' : '';

            let customStatusBadge = '';
            if(t.status === 'Booyah_WWCD') {
                let winLabel = isPUBG ? '🍗 WWCD' : '🏆 BOOYAH';
                customStatusBadge = `<span style="background:linear-gradient(135deg, #ffaa00, #ff5500); color:#000; padding:4px 8px; border-radius:6px; font-size:10px; font-weight:900; margin-left:8px;">${winLabel}</span>`;
                matchRowHighlight = 'background:rgba(255, 170, 0, 0.1); border-left: 3px solid #ffaa00;'; 
            } else if(t.status === 'Qualified') {
                customStatusBadge = `<span style="background:rgba(16, 185, 129, 0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:4px 8px; border-radius:6px; font-size:10px; font-weight:900; margin-left:8px;">✅ QUALIFIED</span>`;
            } else if(t.status === 'Disqualified') {
                customStatusBadge = `<span style="background:rgba(239, 68, 68, 0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:4px 8px; border-radius:6px; font-size:10px; font-weight:900; margin-left:8px;">🚫 OUT</span>`;
                matchRowHighlight = 'opacity:0.6; background:rgba(239, 68, 68, 0.05);'; 
            }

            let rosterUnitsHTML = '';
            if(t.players) {
                Object.values(t.players).forEach(p => {
                    let cleanStatusClass = (p.status === "Alive") ? "alive" : "elim";
                    rosterUnitsHTML += `<div class="p-unit ${cleanStatusClass}">${p.name} [${p.status.toUpperCase()}]</div>`;
                });
            }

            matchBlocksHTML += `
                <tr style="${matchRowHighlight}">
                    <td style="text-align:center; font-weight:900; font-size:15px;">${rankMedal}</td>
                    <td style="font-weight:800; font-size:13px;">${t.name} ${favBadgeHTML} ${customStatusBadge}</td>
                    <td style="text-align:center; font-weight:700;">${t.kills || 0}</td>
                    <td style="text-align:center;">${t.placementPoints || 0}</td>
                    <td style="text-align:center; color:var(--primary); font-weight:900; font-size:15px;">${t.totalPoints || 0}</td>
                </tr>
                <tr style="${matchRowHighlight}">
                    <td colspan="5" style="padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <div class="roster-dropdown-details">
                            <div class="roster-grid-row">${rosterUnitsHTML || 'No roster mapped.'}</div>
                        </div>
                    </td>
                </tr>
            `;
        });

        let statusBadge = match.isLive ? `<i class="fa-solid fa-circle live-dot"></i> LIVE` : `<i class="fa-solid fa-clock-rotate-left"></i> ENDED`;
        let borderStyle = match.isLive ? 'border-color: #ef4444; box-shadow: 0 10px 30px rgba(239,68,68,0.15);' : '';
        let winnerPreview = (!match.isLive && sorted.length > 0) ? `<div style="font-size:12px; color:var(--accent); margin-top:8px; font-weight: 700;">🏆 ${sorted[0].name} WON</div>` : '';

        let predictUI = '';
        if(match.status === "UPCOMING") {
            predictUI = `<button class="primary-btn mt-15" style="width:100%; background:linear-gradient(135deg, #10b981, #059669);" onclick="submitPrediction('${match.matchLabel}')"><i class="fa-solid fa-crosshairs"></i> Predict Booyah & Win!</button>`;
        }

        container.innerHTML += `
            <div class="match-card" style="${borderStyle}">
                <div class="card-header clickable" onclick="toggleMatchDetails('details-${idx}', 'icon-${idx}', this)">
                    <div>
                        <div class="tour-name">
                            ${match.tournamentName || 'Tournament'} 
                            <span style="font-size:12px; color:var(--text-sub); font-weight:normal; margin-top:4px;">[${match.matchLabel || 'Match'}]</span>
                        </div>
                        <div style="font-size:12px; color:var(--text-sub); margin-top:8px; font-weight:600; display:flex; gap:12px; align-items:center;">
                            <span>${statusBadge}</span>
                            <span>Map: <span style="color:var(--text-main);">${match.mapName || 'Unknown'}</span></span>
                        </div>
                        ${winnerPreview}
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:12px;">
                        <div class="game-badge">${match.gameName || 'ESPORTS'}</div>
                        <div class="expand-icon" id="icon-${idx}"><i class="fa-solid fa-chevron-down"></i></div>
                    </div>
                </div>

                <div id="details-${idx}" style="display:none; margin-top:15px;">
                    <div style="font-size:12px; color:var(--accent); text-align:right; margin-bottom:10px; font-weight:bold;">${match.status || ''}</div>
                    
                    <div class="table-responsive">
                        <table class="score-table">
                            <thead>
                                <tr><th style="width:10%; text-align:center;">#</th><th>Team Label</th><th style="text-align:center;">Kills</th><th style="text-align:center;">${labelWWCD}</th><th style="text-align:center;">Total</th></tr>
                            </thead>
                            <tbody>${matchBlocksHTML}</tbody>
                        </table>
                    </div>
                    ${predictUI}
                </div>
            </div>
        `;
    });
}

function submitPrediction(matchLabel) {
    if(!currentUser) return alert('Please Login first to submit predictions!');
    const teamName = prompt("Which Team do you predict will get the Booyah/WWCD in this match?");
    if(teamName) {
        database.ref(`predictions/${matchLabel}/${currentUser.uid}`).set({
            teamPredicted: teamName, userEmail: currentUser.email, timestamp: Date.now()
        }).then(() => alert("Prediction Locked! If you win, Admin will send a reward to your Inbox."));
    }
}

function renderInstantOverall() {
    const container = document.getElementById('overallStandingsBlock');
    container.innerHTML = '';
    let aggregatedTeams = {};
    let tourneyName = "Anchor Series";

    function accumulate(teamsObj) {
        if(!teamsObj) return;
        Object.values(teamsObj).forEach(t => {
            let key = t.name.toUpperCase().trim();
            if(!aggregatedTeams[key]) {
                aggregatedTeams[key] = { name: t.name, kills: 0, placementPoints: 0, totalPoints: 0 };
            }
            aggregatedTeams[key].kills += (parseInt(t.kills) || 0);
            aggregatedTeams[key].placementPoints += (parseInt(t.placementPoints) || 0);
            aggregatedTeams[key].totalPoints += (parseInt(t.totalPoints) || 0);
        });
    }

    Object.values(globalHistoryData).forEach(match => {
        if(activeGameFilter === 'ALL' || (match.gameName && match.gameName.includes(activeGameFilter))) {
            tourneyName = match.tournamentName; accumulate(match.teams);
        }
    });
    Object.values(globalLiveMatchData).forEach(match => {
        if(activeGameFilter === 'ALL' || (match.gameName && match.gameName.includes(activeGameFilter))) {
            tourneyName = match.tournamentName; accumulate(match.teams);
        }
    });

    let sorted = Object.values(aggregatedTeams).sort((a,b) => b.totalPoints - a.totalPoints);
    if(sorted.length === 0) {
        container.innerHTML = '<div class="custom-card center-text">No accumulated points available yet.</div>';
        return;
    }

    let rowHTML = '';
    sorted.forEach((t, i) => {
        let rank = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
        let highlightStyle = (userFavTeam && t.name.toLowerCase() === userFavTeam.toLowerCase()) ? 'background:rgba(0,255,255,0.08);' : '';
        rowHTML += `
            <tr style="${highlightStyle}">
                <td style="text-align:center; font-weight:900; font-size:15px;">${rank}</td>
                <td style="font-weight:800; font-size:14px;">${t.name}</td>
                <td style="text-align:center;">${t.kills}</td>
                <td style="text-align:center;">${t.placementPoints}</td>
                <td style="text-align:center; color:var(--accent); font-weight:900; font-size:16px;">${t.totalPoints}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div class="custom-card" style="border-color: var(--accent); box-shadow: 0 5px 30px rgba(255, 170, 0, 0.15);">
            <div class="card-header">
                <div class="tour-name">${tourneyName} <br><span style="font-size:12px; color:var(--accent); margin-top:4px; display:inline-block;">[INSTANT OVERALL LEADERBOARD]</span></div>
                <div class="game-badge" style="background:linear-gradient(135deg, #ffaa00, #ff5500); color:#000;">${activeGameFilter}</div>
            </div>
            <div class="table-responsive">
                <table class="score-table">
                    <thead>
                        <tr><th style="width:10%; text-align:center;">Rank</th><th>Team</th><th style="text-align:center;">Total Kills</th><th style="text-align:center;">Total Place</th><th style="text-align:center;">Grand Total</th></tr>
                    </thead>
                    <tbody>${rowHTML}</tbody>
                </table>
            </div>
        </div>
    `;
}

// ==========================================
// 8. SQUAD & CLAN OPERATIONS
// ==========================================
function publishNewSquadLineup() {
    if(!currentUser) return alert("Verify authentication context profile mapping link.");
    const name = document.getElementById('sqName').value.trim();
    const p2 = document.getElementById('sqP2').value.trim() || 'N/A';
    const p3 = document.getElementById('sqP3').value.trim() || 'N/A';
    const p4 = document.getElementById('sqP4').value.trim() || 'N/A';

    if(!name) return alert('Squad Label target input cannot be blank!');
    const generatedUid = "SQ-" + Math.floor(1000 + Math.random() * 9000);

    const payload = {
        uid: generatedUid, name: name, leaderUid: currentUser.uid,
        leaderEmail: currentUser.email, p2, p3, p4
    };

    database.ref(`squads/${currentUser.uid}`).set(payload).then(() => {
        database.ref(`users/${currentUser.uid}/ownedSquadId`).set(generatedUid);
        alert(`Lineup cataloged dynamically. Unique Squad UID: ${generatedUid}`);
    });
}

function syncSquadLeaderOperationsPanel() {
    database.ref(`squads/${currentUser.uid}`).on('value', s => {
        if(s.exists()) {
            document.getElementById('createSquadConsole').style.display = 'none';
            document.getElementById('leaderSquadConsole').style.display = 'block';
            const squad = s.val();
            document.getElementById('myClanTitle').innerText = squad.name;
            document.getElementById('myClanUid').innerText = squad.uid;
            document.getElementById('myClanLineupText').innerHTML = `<strong>Active Group Array:</strong> ${squad.leaderEmail.split('@')[0]} (IGL), ${squad.p2}, ${squad.p3}, ${squad.p4}`;

            const listBlock = document.getElementById('incomingReqList');
            listBlock.innerHTML = '';
            
            if(squad.joinRequests) {
                Object.keys(squad.joinRequests).forEach(key => {
                    const r = squad.joinRequests[key];
                    listBlock.innerHTML += `
                        <div class="req-item" style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px; margin-top:10px; border-radius:8px;">
                            <span><strong>${r.playerName}</strong> <br><span style="font-size:11px; color:var(--text-sub);">${r.playerEmail}</span></span>
                            <div style="display:flex; gap:8px;">
                                <button class="primary-btn" style="padding:6px 12px; background:linear-gradient(135deg, #10b981, #059669); color:white; border-radius:8px; box-shadow:none;" onclick="respondToJoinRequest('${key}','accept','${r.playerUid}')"><i class="fa-solid fa-check"></i></button>
                                <button class="danger-btn" style="padding:6px 12px; border-radius:8px; box-shadow:none;" onclick="respondToJoinRequest('${key}','reject','${r.playerUid}')"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        </div>
                    `;
                });
            } else {
                listBlock.innerHTML = '<p style="font-size:12px; color:var(--text-sub); margin-top:10px;">No open recruitment applications logs pending.</p>';
            }
        } else {
            document.getElementById('createSquadConsole').style.display = 'block';
            document.getElementById('leaderSquadConsole').style.display = 'none';
        }
    });
}

function dispatchClanJoinRequest() {
    if(!currentUser) return alert('Verification login token session tracking lost.');
    const targetToken = document.getElementById('searchSquadUid').value.trim().toUpperCase();
    if(!targetToken) return alert('Input valid alphanumeric group target UID tag.');

    database.ref(`users/${currentUser.uid}/pendingRequest`).once('value', s => {
        if(s.exists() && s.val() !== "") {
            alert("STRICT SYSTEM BOUNDS: You possess 1 dispatch registration pipeline lock pending already.");
            return;
        }

        database.ref('squads').once('value', snap => {
            let foundMatch = false; let targetLeaderKey = null; let totalCurrentRequests = 0;

            snap.forEach(c => {
                if(c.val().uid === targetToken) {
                    foundMatch = true; targetLeaderKey = c.key;
                    totalCurrentRequests = Object.keys(c.val().joinRequests || {}).length;
                }
            });

            if(!foundMatch) return alert('No squads matrix match located under target UID token.');
            if(targetLeaderKey === currentUser.uid) return alert('Operation blocked. Target matches owner link context.');
            if(totalCurrentRequests >= 5) return alert('MAX QUEUE LIMIT: Target Leader application processing database full.');

            const requestBody = { playerUid: currentUser.uid, playerName: currentUser.email.split('@')[0].toUpperCase(), playerEmail: currentUser.email };
            const newRef = database.ref(`squads/${targetLeaderKey}/joinRequests`).push();
            newRef.set(requestBody).then(() => {
                database.ref(`users/${currentUser.uid}/pendingRequest`).set({ leaderUid: targetLeaderKey, reqKey: newRef.key });
                alert('Recruitment request dispatched to group leader logs successfully!');
            });
        });
    });
}

function respondToJoinRequest(key, systemAction, playerUid) {
    if(systemAction === 'accept') { alert('Player entry authorized into group catalog alignment!'); }
    else { alert('Application cleared.'); }
    database.ref(`squads/${currentUser.uid}/joinRequests/${key}`).remove();
    database.ref(`users/${playerUid}/pendingRequest`).remove();
}

database.ref('squads').on('value', s => {
    const container = document.getElementById('publicSquadsContainer'); container.innerHTML = '';
    if(!s.exists()) { container.innerHTML = '<p class="center-text">No groups registered inside index arrays.</p>'; return; }
    s.forEach(child => {
        const v = child.val();
        container.innerHTML += `
            <div class="custom-card" style="padding:16px 20px; margin-bottom:15px; border-left:4px solid var(--primary);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="font-size:15px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-shield-cat" style="color:var(--primary);"></i> ${v.name}</strong>
                    <span class="badge badge-cyan">${v.uid}</span>
                </div>
                <span style="font-size:12px; color:var(--text-sub); line-height:1.6;"><strong>IGL:</strong> ${v.leaderEmail.split('@')[0]} <br><strong>Roster:</strong> ${v.p2}, ${v.p3}, ${v.p4}</span>
            </div>
        `;
    });
});

// ==========================================
// 9. LOBBY CHAT
// ==========================================
function sendLobbyChatMessage() {
    const input = document.getElementById('chatMsgInput');
    if(!input.value.trim()) return;
    let username = currentUser ? currentUser.email.split('@')[0] : "Guest_Operator";
    database.ref('lobby_chat').push().set({ user: username, text: input.value.trim() });
    input.value = '';
}

database.ref('lobby_chat').limitToLast(30).on('value', s => {
    const box = document.getElementById('chatBox'); box.innerHTML = '';
    s.forEach(c => {
        const m = c.val();
        box.innerHTML += `<div class="msg"><div class="user"><i class="fa-solid fa-bolt"></i> ${m.user}</div><div class="text">${m.text}</div></div>`;
    });
    box.scrollTop = box.scrollHeight;
});

// ==========================================
// 10. ARMORY STORE
// ==========================================
database.ref('shop_items').on('value', snap => {
    const container = document.getElementById('storeItemsContainer'); container.innerHTML = '';
    if(snap.exists()) {
        snap.forEach(child => {
            const item = child.val();
            let isPremium = item.rarity === 'premium' || item.rarity === 'mythic';
            let rarityBadge = isPremium ? `<div style="position:absolute; top:10px; right:10px; font-size:10px; font-weight:bold; background:var(--accent); color:#000; padding:2px 6px; border-radius:4px;">${item.rarity.toUpperCase()}</div>` : '';
            let priceHTML = item.price > 0 ? `<div style="color:var(--accent); font-weight:bold; font-size:13px; margin-top:5px;">🪙 ${item.price} Rs</div>` : `<div style="color:#10b981; font-weight:bold; font-size:13px; margin-top:5px;">FREE</div>`;
            
            container.innerHTML += `
                <div class="custom-card center-text" style="position:relative;">
                    ${rarityBadge}
                    <img src="${item.imageUrl}" style="width:80px; height:80px; object-fit:contain; margin-bottom:10px; border-radius:8px;">
                    <div style="font-size:13px; font-weight:700; color:white;">${item.name}</div>
                    ${priceHTML}
                    <button class="primary-btn mt-10" style="width:100%; font-size:11px; padding:10px;" onclick="buyItem('${child.key}', ${item.price}, '${item.name}')">Equip</button>
                </div>
            `;
        });
    }
});

function buyItem(itemId, price, itemName) {
    if(!currentUser) return alert("Login required to access the Armory.");
    if(price > 0) {
        alert(`Redirecting to Payment Gateway to pay Rs ${price} for ${itemName}... (Integration Pending)`);
    } else {
        database.ref(`users/${currentUser.uid}/inventory/${itemId}`).set(true).then(()=>alert("Free item equipped to your profile!"));
    }
}

// ==========================================
// 11. INITIALIZATION
// ==========================================
window.onload = () => { 
    attachDataListeners(); 
};
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            alert("Welcome " + result.user.email.split('@')[0] + "!");
        })
        .catch((error) => {
            alert("Google Login Failed: " + error.message);
        });
}
// ====== JUGAADU TAB FIX (SESSION BOX HIDE/SHOW) ======
document.addEventListener('click', (e) => {
    // Session verified wala dabba pakdo
    const sessionBox = document.getElementById('squadLoggedInBlock');
    if (!sessionBox) return; // Agar dabba nahi mila toh kuch mat karo
    
    // Jis cheez par click hua hai, uska naam padho
    const clickedText = e.target.innerText || '';
    
    // Agar "Live Hub", "Squads", ya "Drop Chat" par click kiya hai toh box CHHUPA do
    if (clickedText.includes('Live Hub') || clickedText.includes('Squads') || clickedText.includes('Drop Chat')) {
        sessionBox.style.display = 'none';
    }
    
    // Agar "Profile" par click kiya hai toh box DIKHA do
    if (clickedText.includes('Profile')) {
        sessionBox.style.display = 'block';
    }
});
