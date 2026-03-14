// CricClash AI - Main Application Logic v3

window.App = {
    init() {
        this.currentPage = window.location.pathname.split('/').pop() || 'index.html';
        this.cacheDOM();
        this.bindEvents();

        // Clear older Service Workers to prevent aggressive caching of old UI layouts
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.unregister();
                }
            });
        }

        // CRITICAL FIX: On sub-pages (battlefield, studio, quiz), appShell is always visible.
        // We don't have a splash/login on these pages – just check auth and init modules.
        if (this.currentPage !== 'index.html' && this.currentPage !== '') {
            this.checkAuthStatus();
            if (this.currentPage === 'battlefield.html') {
                this.fetchLiveScore();
            }
        } else {
            // On index.html, go through standard splash → login flow
            this.handleSplash();
            this.fetchLiveScore();
        }
    },

    cacheDOM() {
        this.splash = document.getElementById('splashScreen');
        this.loginPortal = document.getElementById('loginPortal');
        this.appShell = document.getElementById('appShell');
        this.loginForm = document.getElementById('loginForm');
        this.welcomeUserName = document.getElementById('welcomeUserName');
        this.profileNavBtn = document.getElementById('profileNavBtn');
        this.closeProfileBtn = document.getElementById('closeProfileBtn');
        this.profileModal = document.getElementById('profileModal');
        this.logoutBtn = document.getElementById('logoutBtn');

        // Match Elements
        this.liveScore1 = document.getElementById('liveScore1');
        this.liveScore2 = document.getElementById('liveScore2');
    },

    bindEvents() {
        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        if (this.profileNavBtn) {
            this.profileNavBtn.addEventListener('click', () => this.showProfileModal());
        }
        if (this.closeProfileBtn) {
            this.closeProfileBtn.addEventListener('click', () => this.hideProfileModal());
        }
        if (this.profileModal) {
            this.profileModal.addEventListener('click', (e) => {
                if (e.target === this.profileModal) this.hideProfileModal();
            });
        }
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => {
                if (window.Auth) window.Auth.logout();
            });
        }
    },

    handleSplash() {
        setTimeout(() => {
            if (this.splash) {
                this.splash.style.opacity = '0';
                setTimeout(() => {
                    this.splash.classList.add('hidden');
                    this.checkAuthStatus();
                }, 500);
            } else {
                this.checkAuthStatus();
            }
        }, 2000);
    },

    setTeamTheme(teamCode) {
        const root = document.documentElement;
        let color = 'var(--primary-ai-blue)';
        const themes = {
            'CSK': 'var(--csk)', 'MI': 'var(--mi)', 'RCB': 'var(--rcb)',
            'KKR': 'var(--kkr)', 'RR': 'var(--rr)', 'SRH': 'var(--srh)',
            'DC': 'var(--dc)', 'PBKS': 'var(--pbks)', 'GT': 'var(--gt)', 'LSG': 'var(--lsg)'
        };
        color = themes[teamCode] || color;
        root.style.setProperty('--theme-color', color);
    },

    updateProfileNav(user) {
        if (!user) return;
        const nameEl = document.getElementById('navUserName');
        const teamEl = document.getElementById('navUserTeam');
        const levelEl = document.getElementById('navLevelBadge');
        const avatarEl = document.getElementById('navAvatar');

        if (nameEl) nameEl.textContent = user.name || 'Titan';
        if (teamEl) teamEl.textContent = user.team || '';
        if (levelEl) levelEl.textContent = `Lvl ${user.level || 1}`;
        if (avatarEl && user.avatar_url) {
            avatarEl.src = user.avatar_url;
            avatarEl.onerror = () => { avatarEl.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`; };
        }

        if (user.team) {
            this.setTeamTheme(user.team);
            if (teamEl) teamEl.style.color = 'var(--theme-color)';
        }
    },

    async checkAuthStatus() {
        if (!window.Auth) return;
        try {
            const user = await window.Auth.getCurrentUser();
            if (user) {
                this.showDashboard(user);
            } else {
                // Wait a tiny bit more for session if on a subpage, just in case
                setTimeout(async () => {
                    const retryUser = await window.Auth.getCurrentUser();
                    if (retryUser) {
                        this.showDashboard(retryUser);
                    } else if (this.currentPage === 'index.html' || this.currentPage === '') {
                        if (this.loginPortal) this.loginPortal.classList.remove('hidden');
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 1000);
            }
        } catch (err) {
            console.error("Auth check failed:", err);
            if (this.currentPage !== 'index.html') window.location.href = 'index.html';
        }
    },

    showDashboard(user) {
        if (this.loginPortal) this.loginPortal.classList.add('hidden');
        if (this.appShell) this.appShell.classList.remove('hidden');
        if (this.welcomeUserName) this.welcomeUserName.textContent = user.name;

        this.updateProfileNav(user);

        // Always init gamification and DM
        if (window.Gamification) window.Gamification.init(user);
        if (window.DM) window.DM.init(user);

        // Page-specific init
        if (this.currentPage === 'index.html' || this.currentPage === '') {
            if (window.Social) window.Social.init(user);
            this.setupPollWidget();
        } else if (this.currentPage === 'battlefield.html') {
            if (window.Chat) window.Chat.init(user);
            if (window.Engagement) window.Engagement.init(user);
        } else if (this.currentPage === 'studio.html') {
            if (window.Memes) window.Memes.init(user);
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const btnSpan = this.loginForm.querySelector('.login-btn span') || this.loginForm.querySelector('button');
        const originalText = btnSpan ? btnSpan.textContent : '';
        if (btnSpan) btnSpan.textContent = 'Entering Arena...';

        const nameInput = document.getElementById('fullName');
        const teamInput = document.getElementById('iplTeam');
        if (!nameInput || !teamInput) return;

        const name = nameInput.value.trim();
        const team = teamInput.value;

        try {
            if (window.Auth) {
                const user = await window.Auth.login(name, team);
                if (user) {
                    this.showDashboard(user);
                } else {
                    alert("Login failed.");
                    if (btnSpan) btnSpan.textContent = originalText;
                }
            }
        } catch (error) {
            console.error(error);
            alert("Login Error: " + (error.message || error));
            if (btnSpan) btnSpan.textContent = originalText;
        }
    },

    showProfileModal() {
        if (!window.Auth || !window.Auth.currentUser) return;
        const user = window.Auth.currentUser;

        const fields = {
            modalAvatar: user.avatar_url,
            modalName: user.name,
            modalTeam: user.team,
            modalLevel: user.level,
            modalRoasts: user.roast_points || 0,
            modalXP: user.xp || 0
        };

        for (const [id, val] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) {
                if (el.tagName === 'IMG') el.src = val;
                else el.textContent = val;
            }
        }

        if (window.Gamification && this.profileModal) {
            const currentLvlData = (window.Gamification.levels || []).find(l => l.level === user.level);
            const currentLvlXP = currentLvlData ? currentLvlData.xpRequired : 0;
            const nextLvlXP = window.Gamification.getNextLevelXp ? window.Gamification.getNextLevelXp(user.level) : 100;
            const xpInLevel = user.xp - currentLvlXP;
            const xpNeeded = nextLvlXP - currentLvlXP;
            let percent = Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100));

            const bar = document.getElementById('xpBarFill');
            const txt = document.getElementById('xpProgressText');
            if (bar) bar.style.width = `${percent}%`;
            if (txt) txt.textContent = `${user.xp} / ${nextLvlXP} XP`;
        }

        if (this.profileModal) this.profileModal.classList.remove('hidden');
    },

    hideProfileModal() {
        if (this.profileModal) this.profileModal.classList.add('hidden');
    },

    showAchievement(msg) {
        const existing = document.getElementById('achievementToast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'achievementToast';
        toast.style.cssText = `
            position: fixed; bottom: 90px; right: 20px; z-index: 9999;
            background: rgba(17, 17, 24, 0.95);
            border: 1px solid var(--theme-color, var(--primary-ai-blue));
            color: white; padding: 1rem 1.5rem; border-radius: 16px;
            box-shadow: 0 0 30px rgba(0, 194, 255, 0.3);
            animation: slideInUp 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
            font-weight: 700; font-family: 'Space Grotesk', sans-serif;
            font-size: 1rem; display: flex; align-items: center; gap: 10px;
        `;
        toast.innerHTML = `🌟 ${msg}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.4s';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    },
    async setupPollWidget() {
        const widget = document.getElementById('activePollWidget');
        if (!widget) return;
        
        let rcbVotes = parseInt(localStorage.getItem('poll_rcb')) || 0;
        let srhVotes = parseInt(localStorage.getItem('poll_srh')) || 0;
        
        // Attempt Global Sync
        try {
            if (window.supabaseClient) {
                const { data } = await window.supabaseClient.from('polls').select('*').eq('id', 'match1').single();
                if (data) {
                    rcbVotes = data.rcb_votes || rcbVotes;
                    srhVotes = data.srh_votes || srhVotes;
                }
            }
        } catch(e) { console.warn("Poll global sync failed, using local."); }

        const total = rcbVotes + srhVotes;
        
        // "Law of Comparison" Probability
        let rcbProb = 50;
        let srhProb = 50;
        
        if (total > 0) {
            rcbProb = Math.round((rcbVotes / total) * 100);
            srhProb = 100 - rcbProb;
        }
        
        const hasVoted = localStorage.getItem('poll_voted') === 'true';
        const votedTeam = localStorage.getItem('poll_voted_team');

        widget.innerHTML = `
            <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1.2px; color:var(--text-muted); margin-bottom:10px;">⚡ Match Win Probability</div>
            <div style="font-size:0.9rem; font-weight:600; margin-bottom:12px; color:#fff;">RCB vs SRH - Who wins the clash?</div>
            
            <div style="display:flex; flex-direction:column; gap:10px;" id="pollOptions">
                <div class="poll-row" style="position:relative;">
                    <button class="poll-opt-btn" id="btnRCB" onclick="window.App.votePoll('RCB')" 
                        style="width:100%; position:relative; overflow:hidden; background:rgba(255,0,0,0.05); border:1px solid ${votedTeam === 'RCB' ? 'var(--rcb)' : 'rgba(255,255,255,0.1)'}; color:#fff; border-radius:12px; padding:12px 16px; cursor:${hasVoted ? 'default' : 'pointer'}; font-size:0.95rem; font-weight:700; text-align:left; transition:all 0.3s; z-index:1; ${hasVoted && votedTeam !== 'RCB' ? 'opacity:0.6;' : ''}"
                        ${hasVoted ? 'disabled' : ''}>
                        
                        <div id="progRCB" style="position:absolute; top:0; left:0; height:100%; width:${hasVoted ? rcbProb : 0}%; background:linear-gradient(90deg, rgba(255,0,0,0.25), transparent); transition:width 1.2s cubic-bezier(0.18, 0.89, 0.32, 1.28); z-index:0;"></div>
                        <div style="position:relative; z-index:2; display:flex; justify-content:space-between; align-items:center;">
                            <span>❤️ RCB ${votedTeam === 'RCB' ? '✅' : ''}</span>
                            <span id="txtRCB" style="${hasVoted ? '' : 'display:none;'} color:var(--rcb); font-family:'JetBrains Mono';">${rcbProb}%</span>
                        </div>
                    </button>
                </div>

                <div class="poll-row" style="position:relative;">
                    <button class="poll-opt-btn" id="btnSRH" onclick="window.App.votePoll('SRH')" 
                        style="width:100%; position:relative; overflow:hidden; background:rgba(255,96,0,0.05); border:1px solid ${votedTeam === 'SRH' ? 'var(--srh)' : 'rgba(255,255,255,0.1)'}; color:#fff; border-radius:12px; padding:12px 16px; cursor:${hasVoted ? 'default' : 'pointer'}; font-size:0.95rem; font-weight:700; text-align:left; transition:all 0.3s; z-index:1; ${hasVoted && votedTeam !== 'SRH' ? 'opacity:0.6;' : ''}"
                        ${hasVoted ? 'disabled' : ''}>
                        
                        <div id="progSRH" style="position:absolute; top:0; left:0; height:100%; width:${hasVoted ? srhProb : 0}%; background:linear-gradient(90deg, rgba(255,96,0,0.25), transparent); transition:width 1.2s cubic-bezier(0.18, 0.89, 0.32, 1.28); z-index:0;"></div>
                        <div style="position:relative; z-index:2; display:flex; justify-content:space-between; align-items:center;">
                            <span>🧡 SRH ${votedTeam === 'SRH' ? '✅' : ''}</span>
                            <span id="txtSRH" style="${hasVoted ? '' : 'display:none;'} color:var(--srh); font-family:'JetBrains Mono';">${srhProb}%</span>
                        </div>
                    </button>
                </div>
            </div>
            
            <div id="pollFooter" style="${hasVoted ? '' : 'display:none;'} margin-top:12px; font-size:0.7rem; color:var(--text-muted); text-align:center; text-transform:uppercase; letter-spacing:1px;">
                Winning Probability based on ${total} Fan Vote${total !== 1 ? 's' : ''}
            </div>
        `;
    },

    async votePoll(team) {
        if (localStorage.getItem('poll_voted') === 'true') return;

        let rcbVotes = parseInt(localStorage.getItem('poll_rcb')) || 0;
        let srhVotes = parseInt(localStorage.getItem('poll_srh')) || 0;

        // Try to fetch latest before adding
        try {
            if (window.supabaseClient) {
                const { data } = await window.supabaseClient.from('polls').select('*').eq('id', 'match1').single();
                if (data) {
                    rcbVotes = data.rcb_votes || rcbVotes;
                    srhVotes = data.srh_votes || srhVotes;
                }
            }
        } catch(e) {}

        if (team === 'RCB') rcbVotes++;
        else srhVotes++;

        // Save Local
        localStorage.setItem('poll_rcb', rcbVotes);
        localStorage.setItem('poll_srh', srhVotes);
        localStorage.setItem('poll_voted', 'true');
        localStorage.setItem('poll_voted_team', team);

        // Save Global
        try {
             if (window.supabaseClient) {
                 await window.supabaseClient.from('polls').upsert({
                     id: 'match1', rcb_votes: rcbVotes, srh_votes: srhVotes
                 });
             }
        } catch(e) { console.warn("Global poll save failed."); }

        // Calc Winning Probability
        const total = rcbVotes + srhVotes;
        const rcbProb = Math.round((rcbVotes / total) * 100);
        const srhProb = 100 - rcbProb;

        // UI Feedback
        const btnRcb = document.getElementById('btnRCB');
        const btnSrh = document.getElementById('btnSRH');
        const progRcb = document.getElementById('progRCB');
        const progSrh = document.getElementById('progSRH');
        const txtRcb = document.getElementById('txtRCB');
        const txtSrh = document.getElementById('txtSRH');
        const footer = document.getElementById('pollFooter');

        document.querySelectorAll('.poll-opt-btn').forEach(btn => {
            btn.disabled = true;
            btn.style.cursor = 'default';
            if ((team === 'RCB' && btn.id !== 'btnRCB') || (team === 'SRH' && btn.id !== 'btnSRH')) {
                btn.style.opacity = '0.6';
            }
        });

        const selectedBtn = team === 'RCB' ? btnRcb : btnSrh;
        if(selectedBtn) {
            selectedBtn.style.borderColor = team === 'RCB' ? 'var(--rcb)' : 'var(--srh)';
            selectedBtn.querySelector('span').innerHTML += ' ✅';
        }

        if (progRcb) progRcb.style.width = rcbProb + '%';
        if (progSrh) progSrh.style.width = srhProb + '%';
        
        if (txtRcb) { txtRcb.textContent = rcbProb + '%'; txtRcb.style.display = 'block'; }
        if (txtSrh) { txtSrh.textContent = srhProb + '%'; txtSrh.style.display = 'block'; }

        if(footer) {
            footer.innerHTML = `Winning Probability based on ${total} Fan Vote${total !== 1 ? 's' : ''}`;
            footer.style.display = 'block';
        }

        if (window.Gamification) {
            const userId = window.Auth && window.Auth.currentUser ? window.Auth.currentUser.id : null;
            window.Gamification.addXP(25, userId);
        }
        this.showAchievement(`📊 Predicted ${team} victory! Probability updated. +25 XP`);
    },

    liveScoreInterval: null,
    lastScoreString: "",

    async fetchLiveScore() {
        if (this.liveScoreInterval) clearInterval(this.liveScoreInterval);

        const updateScore = async () => {
            try {
                const response = await fetch(
                    "https://api.cricapi.com/v1/cricScore?apikey=9929b697-391c-4ce6-8dbc-3a49be133bcb",
                    {cache: "no-store"}
                );
                
                if (!response.ok) throw new Error("API Limit or Error");
                const data = await response.json();
                
                // If API is limited or has no data
                if (!data || data.status === "failure" || !data.data || !data.data.length) {
                    this.showOfflineScorecard();
                    return;
                }
                
                // Try to find a major match (RCB/SRH/CSK/MI/etc)
                let match = data.data.find(m => m.name && (m.name.includes("RCB") || m.name.includes("SRH") || m.name.includes("CSK") || m.name.includes("MI") || m.name.includes("India") || m.name.includes("ENG")));
                if (!match) match = data.data[0]; 
                
                if (!match || !match.name) { 
                    this.showOfflineScorecard();
                    return; 
                }

                // UI Updates
                const updates = {
                    matchName: match.name,
                    score: match.score || "Match Not Started",
                    status: match.status || "Check back soon"
                };

                for (const [id, val] of Object.entries(updates)) {
                    const el = document.getElementById(id);
                    if (el) el.innerText = val;
                }

                // Arena updates
                const team1El = document.getElementById('teamTag1');
                const team2El = document.getElementById('teamTag2');
                const liveScore1El = document.getElementById('liveScore1');
                const tickerEl = document.getElementById('matchTickerText');

                if (team1El) {
                    const teams = match.name.split(/vs|v/i).map(t => t.trim());
                    team1El.innerText = teams[0] ? teams[0].substring(0,3).toUpperCase() : "T1";
                    if (team2El) team2El.innerText = teams[1] ? teams[1].substring(0,3).toUpperCase() : "T2";
                }
                if (liveScore1El) liveScore1El.innerText = match.score || "-/-";
                if (tickerEl) tickerEl.textContent = match.status || "WAITING FOR TOSS";

                // Chat/XP Connections
                if (this.lastScoreString && this.lastScoreString !== match.score) {
                    const s = (match.score || "").toLowerCase();
                    const last = (this.lastScoreString || "").toLowerCase();
                    // Basic heuristic for auto-messaging
                    if (s.includes("6") && !last.includes("6")) {
                        this.autoSendChatMessage("🔥 SIX JUST HIT!");
                    } else if (s.includes("w") && !last.includes("w")) {
                        this.autoSendChatMessage("💀 WICKET FALLS!");
                    }
                }
                this.lastScoreString = match.score;

            } catch (err) {
                console.error("API Error:", err);
                this.showOfflineScorecard();
            }
        };

        updateScore();
        this.liveScoreInterval = setInterval(updateScore, 10000);
    },

    showOfflineScorecard() {
        // Fallback UI when API is unavailable or limits reached
        const t1El = document.getElementById('teamTag1');
        const t2El = document.getElementById('teamTag2');
        const matchNameEl = document.getElementById('matchName');
        const scoreEl = document.getElementById('liveScore1');
        const hubScore = document.getElementById('score');
        const hubStatus = document.getElementById('status');
        const ticker = document.getElementById('matchTickerText');

        if (t1El) t1El.innerText = "TBA";
        if (t2El) t2El.innerText = "TBA";
        if (matchNameEl) matchNameEl.innerText = "Next IPL Match";
        if (scoreEl) scoreEl.textContent = "0/0";
        if (hubScore) hubScore.textContent = "Awaiting Live Feed";
        if (hubStatus) hubStatus.textContent = "API Limit Reached or Offline";
        if (ticker) ticker.textContent = "📡 LIVE FEED DISCONNECTED";
    },

    simulateMatch(t1, t2) {
        // Ensure labels are correct
        const t1El = document.getElementById('teamTag1');
        const t2El = document.getElementById('teamTag2');
        const matchNameEl = document.getElementById('matchName');
        if (t1El) t1El.innerText = t1;
        if (t2El) t2El.innerText = t2;
        if (matchNameEl) matchNameEl.innerText = `${t1} vs ${t2}`;

        let s = 0, w = 0, o = 0, b = 0;
        const tick = () => {
            b++; if(b>5){ b=0; o++; }
            const roll = Math.random();
            let msg = "Dot ball.";
            let outcome = "Dot";
            if(roll > 0.95) { s += 6; msg = "🚀 HUGE SIX!"; outcome = "6"; }
            else if(roll > 0.85) { s += 4; msg = "🏏 FOUR!"; outcome = "4"; }
            else if(roll < 0.05) { w++; msg = "💀 WICKET!"; outcome = "Wicket"; }
            
            const ticker = document.getElementById('matchTickerText');
            const scoreEl = document.getElementById('liveScore1');
            const hubScore = document.getElementById('score');
            const hubStatus = document.getElementById('status');

            if(ticker) ticker.textContent = `OVR ${o}.${b} | ${msg}`;
            if(scoreEl) scoreEl.textContent = `${s}/${w}`;
            if(hubScore) hubScore.textContent = `${s}/${w} (${o}.${b})`;
            if(hubStatus) hubStatus.textContent = msg;

            if(window.Engagement) window.Engagement.checkPrediction(outcome);
            if(o >= 20 || w >= 10) {
                if(hubStatus) hubStatus.textContent = "Match Ended";
                clearInterval(this.simTimer);
            }
        };
        this.simTimer = setInterval(tick, 5000);
        tick();
    },

    async autoSendChatMessage(msgStr) {
        try {
            if (!window.Auth || !window.Auth.currentUser) return;
            const user = window.Auth.currentUser;
            
            // Check if Chat.sendMessage exists on the client
            if (window.Chat && typeof window.Chat.sendMessage === 'function') {
                // For optimal UI reflection
                const input = document.getElementById('chatInput');
                if (input) {
                    input.value = msgStr;
                    document.getElementById('sendChatBtn').click();
                } else {
                    // Fallback to direct insertion
                    await window.supabaseClient.from('messages').insert([{
                        user_id: user.id, message: msgStr, roast_points: 0
                    }]);
                }
            } else {
                // Direct database insertion if not on Battlefield page
                await window.supabaseClient.from('messages').insert([{
                    user_id: user.id, message: msgStr, roast_points: 0
                }]);
            }
        } catch(e) {
            console.error("Auto chat failed:", e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => window.App.init());
