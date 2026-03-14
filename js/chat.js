// CricClash AI - Realtime Battlefield Chat v3
// FIX: Optimistic rendering so messages always appear, even if realtime fails

window.Chat = {
    messages: [],
    renderedIds: new Set(), // Track rendered message IDs to avoid duplicates
    selectedImage: null,

    init(user) {
        this.currentUser = user;
        this.chatMessages = document.getElementById('chatMessages');
        this.chatForm = document.getElementById('chatForm');
        this.chatInput = document.getElementById('chatInput');
        this.chatImageInput = document.getElementById('chatImageInput');
        this.onlineCount = document.getElementById('onlineCount');

        if (!this.chatMessages || !this.chatForm) {
            console.warn("Chat: required DOM elements not found.");
            return;
        }

        this.chatMessages.innerHTML = `
            <div style="text-align:center; padding:2rem; color:rgba(255,255,255,0.3);">
                <div style="font-size:2rem; margin-bottom:0.5rem;">⚔️</div>
                <div>Loading arena messages...</div>
            </div>`;

        this.bindEvents();
        this.fetchRecentMessages();
        this.subscribeToMessages();
        this.setupPresence();
    },

    bindEvents() {
        // Send message on form submit
        this.chatForm.addEventListener('submit', (e) => this.handleSendMessage(e));

        // Image select
        if (this.chatImageInput) {
            this.chatImageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                    alert("Image too large! Max 2MB.");
                    this.chatImageInput.value = '';
                    return;
                }
                this.selectedImage = file;
                this.chatInput.placeholder = `📎 ${file.name} — add a caption and send`;
            });
        }

        // Event delegation for DM and reactions
        this.chatMessages.addEventListener('click', (e) => {
            const btn = e.target.closest('.action-btn');
            if (!btn) return;

            if (btn.classList.contains('dm-btn')) {
                const authorId = btn.dataset.authorId;
                const authorName = btn.dataset.authorName || 'Titan';
                const modal = document.getElementById('dmModal');
                if (modal) {
                    modal.classList.remove('hidden');
                    if (window.DM) window.DM.openConversation(authorId, authorName);
                }
                return;
            }

            const messageId = btn.dataset.messageId;
            const authorId = btn.dataset.authorId;
            const type = btn.dataset.type;
            this.handleReaction(messageId, authorId, type, btn);
        });
    },

    async fetchRecentMessages() {
        try {
            // Step 1: Fetch messages without join (avoids FK requirement)
            const { data: msgs, error } = await window.supabaseClient
                .from('messages')
                .select('id, message, roast_points, created_at, user_id')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error("Chat fetch error:", error);
                this.chatMessages.innerHTML = `
                    <div style="text-align:center; padding:2rem; color:rgba(255,100,100,0.7);">
                        <p>⚠️ Could not load messages.</p>
                        <small style="opacity:0.6">${error.message}</small>
                        <br><button onclick="window.Chat.fetchRecentMessages()" style="margin-top:1rem; padding:8px 16px; border-radius:8px; background:var(--primary-ai-blue); border:none; color:white; cursor:pointer;">Retry</button>
                    </div>`;
                return;
            }

            if (!msgs || msgs.length === 0) {
                this.messages = [];
                this.renderAllMessages();
                return;
            }

            // Step 2: Batch-fetch unique user profiles
            const userIds = [...new Set(msgs.map(m => m.user_id))];
            const { data: users } = await window.supabaseClient
                .from('users')
                .select('id, name, team, avatar_url, level')
                .in('id', userIds);

            // Step 3: Build a lookup map and merge
            const userMap = {};
            (users || []).forEach(u => { userMap[u.id] = u; });

            this.messages = msgs.map(msg => ({
                ...msg,
                users: userMap[msg.user_id] || {
                    name: 'Titan',
                    team: '',
                    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.user_id}`,
                    level: 1
                }
            }));

            this.renderAllMessages();
        } catch (err) {
            console.error("Chat fetch exception:", err);
        }
    },

    async subscribeToMessages() {
        if (!window.supabaseClient) return;
        console.log("Chat: Subscribing to realtime updates...");
        
        // Remove any existing subscription before creating a new one
        if (this.subscription) {
            await window.supabaseClient.removeChannel(this.subscription);
        }

        this.subscription = window.supabaseClient
            .channel('public:messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                async (payload) => {
                    const newMsg = payload.new;
                    if (!newMsg) return;

                    // If we sent this recently, ignore (optimistic UI)
                    if (this.renderedIds.has(newMsg.id)) return;
                    
                    // Fetch user info for the new message
                    try {
                        const { data: user } = await window.supabaseClient
                            .from('users')
                            .select('name, avatar_url, team, level')
                            .eq('id', newMsg.user_id)
                            .single();

                        if (user) {
                            newMsg.users = user;
                        } else {
                             newMsg.users = { name: 'Titan', team: '', avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newMsg.user_id}`, level: 1 };
                        }
                    } catch(e) { /* ignore */ }

                    this.messages.unshift(newMsg);
                    if (this.messages.length > 100) this.messages.pop();
                    this.renderedIds.add(newMsg.id);
                    this.renderSingleMessage(newMsg, true);
                }
            )
            .subscribe((status) => {
                console.log('Chat realtime:', status);
            });
    },

    setupPresence() {
        const room = window.supabaseClient.channel('arena_presence_v2');
        room.on('presence', { event: 'sync' }, () => {
            const state = room.presenceState();
            const count = Object.keys(state).length;
            if (this.onlineCount) {
                this.onlineCount.textContent = count + Math.floor(Math.random() * 15) + 120;
            }
        }).subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await room.track({
                    user_id: this.currentUser.id,
                    at: new Date().toISOString()
                });
            }
        });
    },

    async handleSendMessage(e) {
        e.preventDefault();
        const text = this.chatInput.value.trim();
        const imageFile = this.selectedImage;

        if (!text && !imageFile) return;

        // Clear input immediately for responsiveness
        const sentText = text;
        this.chatInput.value = '';
        this.chatInput.placeholder = 'Drop a hot take or a roast... 🔥';
        this.selectedImage = null;
        if (this.chatImageInput) this.chatImageInput.value = '';

        // OPTIMISTIC RENDER: Show message immediately without waiting for DB/realtime
        const tempId = `temp_${Date.now()}`;
        const optimisticMsg = {
            id: tempId,
            message: sentText,
            image_url: null,
            roast_points: 0,
            created_at: new Date().toISOString(),
            user_id: this.currentUser.id,
            users: {
                name: this.currentUser.name,
                team: this.currentUser.team,
                avatar_url: this.currentUser.avatar_url,
                level: this.currentUser.level
            },
            isOptimistic: true
        };
        this.renderedIds.add(tempId);
        this.messages.unshift(optimisticMsg);
        this.renderSingleMessage(optimisticMsg, true);

        // Send to Supabase
        const { data, error } = await window.supabaseClient
            .from('messages')
            .insert([{
                user_id: this.currentUser.id,
                message: sentText,
                roast_points: 0
            }])
            .select()
            .single();

        if (error) {
            console.error("Message send error:", error);
            // Remove optimistic message on failure
            const card = document.getElementById(`msg-${tempId}`);
            if (card) {
                card.style.opacity = '0.3';
                card.title = 'Failed to send';
            }
            // Restore input
            this.chatInput.value = sentText;
            return;
        }

        // Replace temp ID tracking with real ID so realtime doesn't duplicate
        this.renderedIds.delete(tempId);
        this.renderedIds.add(data.id);

        // Update the DOM element's ID
        const tempCard = document.getElementById(`msg-${tempId}`);
        if (tempCard) {
            tempCard.id = `msg-${data.id}`;
            // Update data attributes on action buttons
            tempCard.querySelectorAll('[data-message-id]').forEach(btn => {
                btn.dataset.messageId = data.id;
            });
        }

        // Award XP for sending
        if (window.Gamification) {
            window.Gamification.addXP(window.Gamification.awards.MESSAGE_SENT || 2);
        }
    },

    async handleReaction(messageId, authorId, type, btnEl) {
        if (!messageId || messageId.startsWith('temp_')) return;
        if (authorId === this.currentUser.id) return;

        // Immediate visual feedback
        btnEl.classList.add('active');
        if (type === 'roast') btnEl.classList.add('roast');

        const { error } = await window.supabaseClient
            .from('reactions')
            .insert([{
                user_id: this.currentUser.id,
                message_id: messageId,
                type: type
            }]);

        if (!error && type === 'roast') {
            const card = document.getElementById(`msg-${messageId}`);
            if (card) {
                const countSpan = card.querySelector('.roast-count');
                if (countSpan) countSpan.textContent = parseInt(countSpan.textContent || '0') + 1;
                card.classList.remove('roast-highlight');
                void card.offsetWidth;
                card.classList.add('roast-highlight');
                this.createParticles(card);
            }

            const { data: msg } = await window.supabaseClient
                .from('messages')
                .select('roast_points')
                .eq('id', messageId)
                .single();

            if (msg) {
                await window.supabaseClient
                    .from('messages')
                    .update({ roast_points: msg.roast_points + 1 })
                    .eq('id', messageId);
            }

            if (window.Gamification) {
                window.Gamification.addRoastPoints(1, authorId);
                window.Gamification.addXP(window.Gamification.awards.ROAST_REACTION || 10);
            }
        }
    },

    renderAllMessages() {
        if (!this.chatMessages) return;
        this.chatMessages.innerHTML = '';
        this.renderedIds.clear();

        if (this.messages.length === 0) {
            this.chatMessages.innerHTML = `
                <div style="text-align:center; padding:3rem; color:rgba(255,255,255,0.3);">
                    <div style="font-size:3rem; margin-bottom:1rem;">⚔️</div>
                    <p>The arena is silent... Be the first to drop a roast!</p>
                </div>`;
            return;
        }

        // Messages are fetched newest-first; since flex-direction: column-reverse
        // we render them in as-fetched order. The visual will show newest at bottom.
        this.messages.forEach(msg => {
            this.renderedIds.add(msg.id);
            this.renderSingleMessage(msg, false);
        });
    },

    renderSingleMessage(msg, prepend = true) {
        if (!this.chatMessages) return;

        const isOwn = msg.user_id === this.currentUser.id;
        const user = msg.users || {};
        const name = user.name || 'Titan';
        const team = user.team || '';
        const avatar = user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

        // Team-specific glow colors
        const teamColors = {
            'CSK': '#FFCC00', 'MI': '#006EC1', 'RCB': '#E00000',
            'KKR': '#3B0067', 'RR': '#FF3D8B', 'SRH': '#FF6000',
            'DC': '#0072BC', 'PBKS': '#DD1133', 'GT': '#1B2B52', 'LSG': '#96C0CE'
        };
        const teamColor = teamColors[team] || 'var(--primary-ai-blue)';
        const levelBadge = user.level ? `<span style="font-size:0.65rem; color:rgba(255,255,255,0.4); margin-left:4px;">Lvl ${user.level}</span>` : '';

        const msgTextHtml = msg.message ? `<div class="msg-text">${this.escapeHTML(msg.message)}</div>` : '';
        const imgHtml = msg.image_url ? `<img src="${msg.image_url}" class="msg-attachment" alt="Shared image" onclick="window.open('${msg.image_url}','_blank')">` : ''; // image_url col optional

        // Don't show actions on temp/optimistic messages
        const actionsHtml = msg.isOptimistic ? `
            <div class="msg-actions" style="opacity:0.5;">
                <span style="font-size:0.75rem; color:rgba(255,255,255,0.3);">Sending...</span>
            </div>
        ` : `
            <div class="msg-actions">
                <button class="action-btn" data-type="roast" data-message-id="${msg.id}" data-author-id="${msg.user_id}" title="Roast this">
                    🔥 <span class="roast-count">${msg.roast_points || 0}</span>
                </button>
                <button class="action-btn" data-type="laugh" data-message-id="${msg.id}" data-author-id="${msg.user_id}" title="Laugh">😂</button>
                <button class="action-btn" data-type="savage" data-message-id="${msg.id}" data-author-id="${msg.user_id}" title="Savage">💀</button>
                ${!isOwn ? `<button class="action-btn dm-btn" data-author-id="${msg.user_id}" data-author-name="${name}" title="Send DM">💬 DM</button>` : ''}
            </div>
        `;

        const html = `
            <div class="message-card ${isOwn ? 'own-message' : ''}" id="msg-${msg.id}">
                <img src="${avatar}"
                     class="msg-avatar"
                     alt="${name}"
                     onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${name}'">
                <div class="msg-content" style="${isOwn ? `border-color:rgba(0,194,255,0.4); box-shadow: 0 0 20px rgba(0,194,255,0.1);` : `border-left: 3px solid ${teamColor};`}">
                    <div class="msg-header">
                        <span class="msg-name">${name}</span>
                        ${team ? `<span class="msg-team" style="background:${teamColor}; color:#000;">${team}</span>` : ''}
                        ${levelBadge}
                    </div>
                    ${msgTextHtml}
                    ${imgHtml}
                    ${actionsHtml}
                </div>
            </div>
        `;

        if (prepend) {
            this.chatMessages.insertAdjacentHTML('afterbegin', html);
        } else {
            this.chatMessages.insertAdjacentHTML('beforeend', html);
        }
    },

    createParticles(element) {
        try {
            const rect = element.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;

            for (let i = 0; i < 10; i++) {
                const p = document.createElement('div');
                p.className = 'particle';
                document.body.appendChild(p);
                const angle = Math.random() * Math.PI * 2;
                const dist = 40 + Math.random() * 60;
                p.style.left = `${cx}px`;
                p.style.top = `${cy}px`;
                p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
                p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
                setTimeout(() => p.remove(), 700);
            }
        } catch (e) { /* ignore */ }
    },

    escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};
