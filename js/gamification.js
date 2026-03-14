// CricClash AI - Gamification & XP System

window.Gamification = {
    // Level thresholds defined in prompt
    levels: [
        { level: 1, xpRequired: 0 },
        { level: 2, xpRequired: 100 },
        { level: 3, xpRequired: 300 },
        { level: 4, xpRequired: 700 },
        { level: 5, xpRequired: 1500 }
    ],

    // XP Awards
    awards: {
        MESSAGE_SENT: 2,
        ROAST_REACTION: 10,
        MEME_POSTED: 20,
        TOP_ROAST: 50,
        STORY_POST: 10,
        POLL_VOTE: 15,
        BALL_PREDICT_CORRECT: 25
    },

    init(user) {
        this.currentUser = user;
        this.subscribeToLeaderboard();
        this.fetchLeaderboard();
    },

    async addXP(amount, userId = this.currentUser.id) {
        if(!this.currentUser) return;

        // Optimistic UI Update if it's the current user
        if(userId === this.currentUser.id) {
            this.currentUser.xp += amount;
            this.checkLevelUp();
            window.App.updateProfileNav(this.currentUser);
        }

        // Database Update (using RPC for atomic increment in production, but for MVP we can do direct update or just let a trigger handle it if we had one.
        // We will fetch current, add, update to be safe if no RPC)
        
        const { data: user, error: fetchErr } = await window.supabaseClient
            .from('users')
            .select('xp, level, roast_points')
            .eq('id', userId)
            .single();

        if(!fetchErr && user) {
            let newXp = user.xp + amount;
            let newLevel = this.calculateLevel(newXp);
            
            await window.supabaseClient
                .from('users')
                .update({ xp: newXp, level: newLevel })
                .eq('id', userId);
        }
    },

    async addRoastPoints(amount, userId) {
        // Find user, increment roast points and XP
        const { data: user, error: fetchErr } = await window.supabaseClient
            .from('users')
            .select('xp, level, roast_points')
            .eq('id', userId)
            .single();
            
        if(!fetchErr && user) {
            let newRoastPoints = user.roast_points + amount;
            let newXp = user.xp + this.awards.ROAST_REACTION; // Add 10 XP for getting roasted (or roasting? prompt says "Roast reaction -> +10 XP")
            let newLevel = this.calculateLevel(newXp);
            
            await window.supabaseClient
                .from('users')
                .update({ roast_points: newRoastPoints, xp: newXp, level: newLevel })
                .eq('id', userId);
                
            // Update local user if it was us
            if(window.Auth.currentUser && window.Auth.currentUser.id === userId) {
                window.Auth.currentUser.roast_points = newRoastPoints;
                window.Auth.currentUser.xp = newXp;
                window.Auth.currentUser.level = newLevel;
                window.App.updateProfileNav(window.Auth.currentUser);
            }
        }
    },

    calculateLevel(currentXp) {
        let currentLevel = 1;
        for(let i=0; i<this.levels.length; i++) {
            if(currentXp >= this.levels[i].xpRequired) {
                currentLevel = this.levels[i].level;
            } else {
                break;
            }
        }
        return currentLevel;
    },

    checkLevelUp() {
        const expectedLevel = this.calculateLevel(this.currentUser.xp);
        if(expectedLevel > this.currentUser.level) {
            this.currentUser.level = expectedLevel;
            // Could trigger a nice UI animation here using particles
            window.App.showAchievement(`Level Up! You are now Level ${expectedLevel}`);
        }
    },
    
    getNextLevelXp(currentLevel) {
        let next = this.levels.find(l => l.level === currentLevel + 1);
        return next ? next.xpRequired : this.levels[this.levels.length-1].xpRequired;
    },

    // Leaderboard
    async fetchLeaderboard() {
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('id, name, avatar_url, team, roast_points, level, xp')
            .order('xp', { ascending: false })
            .limit(10);
            
        if (!error && data) {
            this.renderLeaderboard(data);
        } else if (error) {
            console.error("Leaderboard fetch error:", error);
        }
    },

    subscribeToLeaderboard() {
        window.supabaseClient
          .channel('public:users:leaderboard')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => {
            this.fetchLeaderboard();
          })
          .subscribe();
    },

    renderLeaderboard(users) {
        const container = document.getElementById('leaderboardList');
        if (!container) return;

        const medals = ['🥇', '🥈', '🥉'];

        container.innerHTML = users.map((user, index) => {
            const medal = medals[index] || `#${index + 1}`;
            const isTop3 = index < 3;
            const teamColors = {
                'CSK': '#FFCC00', 'MI': '#006EC1', 'RCB': '#E00000',
                'KKR': '#3B0067', 'RR': '#FF3D8B', 'SRH': '#FF6000',
                'DC': '#0072BC', 'PBKS': '#DD1133', 'GT': '#1B2B52', 'LSG': '#A7D8F0'
            };
            const teamColor = teamColors[user.team] || 'var(--primary-ai-blue)';

            return `
                <div class="lb-item ${isTop3 ? 'lb-top-' + (index + 1) : ''}" style="${isTop3 ? `border-left: 3px solid ${teamColor};` : ''}">
                    <div class="lb-rank" style="font-size:${isTop3 ? '1.2rem' : '0.85rem'}; color:${teamColor};">${medal}</div>
                    <img src="${user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}" class="lb-avatar" 
                         style="width:36px; height:36px; border-radius:8px; border: 2px solid ${teamColor};"
                         onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}'">
                    <div class="lb-info" style="flex:1; min-width:0;">
                        <div class="lb-name" style="font-weight:700; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user.name}</div>
                        <div class="lb-points" style="font-size:0.75rem; color:var(--text-muted);">⚡ ${user.xp || 0} XP · Lvl ${user.level || 1}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
};
