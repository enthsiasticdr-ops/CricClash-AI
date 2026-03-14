// CricClash AI - Direct Messaging Module v2
// Requires 'direct_messages' table in Supabase.
// SQL to create: see notification in app on first open.

window.DM = {
    activeConversation: null,
    activeConversationName: null,

    init(user) {
        this.currentUser = user;
        this.createUI();
        this.bindEvents();
    },

    createUI() {
        if (document.getElementById('dmModal')) return;

        const modal = document.createElement('div');
        modal.id = 'dmModal';
        modal.className = 'profile-modal hidden';
        modal.innerHTML = `
            <div class="modal-content glass-panel dm-modal-content">
                <div class="modal-header" style="padding:1.2rem 1.5rem; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span id="dmBackBtn" style="display:none; cursor:pointer; font-size:1.2rem; padding:4px 8px;">←</span>
                        <h3 style="margin:0; font-size:1.1rem;" id="dmTitle">💬 Direct Messages</h3>
                    </div>
                    <button id="closeDmBtn" style="background:none; border:none; color:rgba(255,255,255,0.6); font-size:1.4rem; cursor:pointer; line-height:1;">&times;</button>
                </div>
                <div id="dmInbox" style="flex:1; overflow-y:auto; padding:1rem;">
                    <div style="text-align:center; color:rgba(255,255,255,0.4); padding:3rem 1rem;">
                        <div style="font-size:2.5rem; margin-bottom:0.8rem;">📬</div>
                        <p>No conversations yet.</p>
                        <p style="font-size:0.85rem; margin-top:0.5rem;">Click <strong>💬 DM</strong> on any chat message to start one!</p>
                    </div>
                </div>
                <div id="dmChatView" style="display:none; flex-direction:column; flex:1; min-height:0;">
                    <div id="dmMessages" style="flex:1; overflow-y:auto; padding:1.2rem; display:flex; flex-direction:column; gap:10px;"></div>
                    <div style="padding:1rem; border-top:1px solid rgba(255,255,255,0.08); display:flex; gap:10px;">
                        <input id="dmInput" type="text" placeholder="Type a private message..." 
                            style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); padding:10px 16px; border-radius:24px; color:white; outline:none; font-size:0.95rem;">
                        <button id="sendDmBtn" 
                            style="background:linear-gradient(135deg,var(--primary-ai-blue),#6A5CFF); border:none; width:44px; height:44px; border-radius:50%; cursor:pointer; color:white; font-size:1.1rem; display:flex; align-items:center; justify-content:center;">
                            ➤
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Inject styles
        if (!document.getElementById('dmStyles')) {
            const style = document.createElement('style');
            style.id = 'dmStyles';
            style.textContent = `
                #dmModal .modal-content.dm-modal-content {
                    max-width: 480px;
                    width: 95vw;
                    height: 80vh;
                    max-height: 700px;
                    padding: 0 !important;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .dm-contact-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border-radius: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 6px;
                    border: 1px solid transparent;
                }
                .dm-contact-item:hover {
                    background: rgba(0,194,255,0.08);
                    border-color: rgba(0,194,255,0.2);
                }
                .dm-bubble {
                    padding: 10px 16px;
                    border-radius: 18px;
                    max-width: 78%;
                    font-size: 0.95rem;
                    line-height: 1.5;
                    word-break: break-word;
                    animation: slideInUp 0.3s ease;
                }
                .dm-bubble.sent {
                    align-self: flex-end;
                    background: linear-gradient(135deg, var(--primary-ai-blue), #5a4dff);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .dm-bubble.received {
                    align-self: flex-start;
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-bottom-left-radius: 4px;
                }
                @media (max-width: 600px) {
                    #dmModal .modal-content.dm-modal-content { height: 95vh; }
                }
            `;
            document.head.appendChild(style);
        }
    },

    bindEvents() {
        const modal = document.getElementById('dmModal');
        const closeBtn = document.getElementById('closeDmBtn');
        const backBtn = document.getElementById('dmBackBtn');
        const sendBtn = document.getElementById('sendDmBtn');
        const input = document.getElementById('dmInput');

        // Close modal
        if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

        // Back to inbox
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showInbox();
            });
        }

        // Send DM
        if (sendBtn) sendBtn.addEventListener('click', () => this.sendMessage());
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
            });
        }

        // Handle #navDM button clicks
        document.querySelectorAll('#navDM').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.open();
            });
        });
    },

    open() {
        const modal = document.getElementById('dmModal');
        if (modal) {
            modal.classList.remove('hidden');
            this.showInbox();
            this.fetchConversations();
        }
    },

    showInbox() {
        this.activeConversation = null;
        document.getElementById('dmInbox').style.display = 'block';
        document.getElementById('dmChatView').style.display = 'none';
        document.getElementById('dmTitle').textContent = '💬 Direct Messages';
        document.getElementById('dmBackBtn').style.display = 'none';
    },

    showChat(contactId, contactName) {
        this.activeConversation = contactId;
        this.activeConversationName = contactName;
        document.getElementById('dmInbox').style.display = 'none';
        document.getElementById('dmChatView').style.display = 'flex';
        document.getElementById('dmTitle').textContent = `💬 ${contactName}`;
        document.getElementById('dmBackBtn').style.display = 'inline';
        document.getElementById('dmMessages').innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);padding:1rem;">Loading...</div>';
        this.loadMessages(contactId);
    },

    async fetchConversations() {
        const inbox = document.getElementById('dmInbox');
        if (!inbox) return;

        try {
            const { data, error } = await window.supabaseClient
                .from('direct_messages')
                .select('sender_id, receiver_id, message, created_at')
                .or(`sender_id.eq.${this.currentUser.id},receiver_id.eq.${this.currentUser.id}`)
                .order('created_at', { ascending: false });

            if (error) {
                // Table probably doesn't exist
                inbox.innerHTML = `
                    <div style="padding:1.5rem; text-align:center;">
                        <div style="font-size:2rem; margin-bottom:1rem;">⚠️</div>
                        <p style="color:rgba(255,100,100,0.8); margin-bottom:1rem;">DM table not set up yet.</p>
                        <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin-bottom:1.5rem;">Run this SQL in your Supabase dashboard:</p>
                        <code style="display:block; background:rgba(0,0,0,0.4); padding:1rem; border-radius:8px; font-size:0.75rem; text-align:left; white-space:pre; line-height:1.6; color:#00c2ff;">CREATE TABLE direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own DMs" ON direct_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "Users can send DMs" ON direct_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);</code>
                    </div>`;
                return;
            }

            if (!data || data.length === 0) {
                inbox.innerHTML = `
                    <div style="text-align:center; color:rgba(255,255,255,0.4); padding:3rem 1rem;">
                        <div style="font-size:2.5rem; margin-bottom:0.8rem;">📬</div>
                        <p>No conversations yet.</p>
                        <p style="font-size:0.85rem; margin-top:0.5rem;">Click <strong>💬 DM</strong> on any chat message to start one!</p>
                    </div>`;
                return;
            }

            // Group by contact
            const contacts = {};
            data.forEach(msg => {
                const contactId = msg.sender_id === this.currentUser.id ? msg.receiver_id : msg.sender_id;
                if (!contacts[contactId]) contacts[contactId] = msg;
            });

            // Batch fetch contact profiles
            const contactIds = Object.keys(contacts);
            const { data: profiles } = await window.supabaseClient
                .from('users')
                .select('id, name, avatar_url')
                .in('id', contactIds);

            const profileMap = {};
            (profiles || []).forEach(p => { profileMap[p.id] = p; });

            inbox.innerHTML = '';
            for (const contactId of contactIds) {
                const profile = profileMap[contactId] || { name: 'Titan', avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${contactId}` };
                const lastMsg = contacts[contactId];
                const preview = (lastMsg.message || '').substring(0, 35) + (lastMsg.message?.length > 35 ? '...' : '');

                const item = document.createElement('div');
                item.className = 'dm-contact-item';
                item.innerHTML = `
                    <img src="${profile.avatar_url}" style="width:44px; height:44px; border-radius:50%; border:2px solid var(--primary-ai-blue);"
                         onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}'">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:700; font-size:0.95rem;">${profile.name}</div>
                        <div style="font-size:0.8rem; color:rgba(255,255,255,0.4); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${preview}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                `;
                item.onclick = () => this.showChat(contactId, profile.name);
                inbox.appendChild(item);
            }
        } catch (err) {
            console.error("DM fetchConversations error:", err);
        }
    },

    async loadMessages(contactId) {
        const container = document.getElementById('dmMessages');
        if (!container) return;

        try {
            const { data, error } = await window.supabaseClient
                .from('direct_messages')
                .select('*')
                .or(`and(sender_id.eq.${this.currentUser.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${this.currentUser.id})`)
                .order('created_at', { ascending: true });

            container.innerHTML = '';

            if (error) {
                container.innerHTML = `<p style="color:red; text-align:center;">${error.message}</p>`;
                return;
            }

            if (!data || data.length === 0) {
                container.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.3); padding:2rem;">Send a message to start the conversation!</div>`;
                return;
            }

            data.forEach(msg => this.renderBubble(msg));
            container.scrollTop = container.scrollHeight;

            // Subscribe to realtime for this conversation
            this.subscribeToConversation(contactId);
        } catch (err) {
            console.error("DM loadMessages error:", err);
        }
    },

    renderBubble(msg) {
        const container = document.getElementById('dmMessages');
        if (!container) return;

        const isSent = msg.sender_id === this.currentUser.id;
        const div = document.createElement('div');
        div.className = `dm-bubble ${isSent ? 'sent' : 'received'}`;
        div.textContent = msg.message;
        div.dataset.dmId = msg.id;
        container.appendChild(div);
    },

    subscribeToConversation(contactId) {
        // Remove previous subscription if any
        if (this._dmChannel) {
            window.supabaseClient.removeChannel(this._dmChannel);
        }

        this._dmChannel = window.supabaseClient
            .channel(`dm:${this.currentUser.id}:${contactId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'direct_messages'
            }, (payload) => {
                const msg = payload.new;
                // Only show if it's in the active conversation
                if (
                    (msg.sender_id === contactId && msg.receiver_id === this.currentUser.id) ||
                    (msg.sender_id === this.currentUser.id && msg.receiver_id === contactId)
                ) {
                    // Avoid duplicate (optimistic already rendered)
                    const exists = document.querySelector(`[data-dm-id="${msg.id}"]`);
                    if (!exists) {
                        this.renderBubble(msg);
                        const container = document.getElementById('dmMessages');
                        if (container) container.scrollTop = container.scrollHeight;
                    }
                }
            })
            .subscribe();
    },

    async sendMessage() {
        const input = document.getElementById('dmInput');
        const text = input ? input.value.trim() : '';
        if (!text || !this.activeConversation) return;

        input.value = '';

        // Optimistic render
        const tempMsg = {
            id: `dm_temp_${Date.now()}`,
            sender_id: this.currentUser.id,
            receiver_id: this.activeConversation,
            message: text
        };
        this.renderBubble(tempMsg);
        const container = document.getElementById('dmMessages');
        if (container) container.scrollTop = container.scrollHeight;

        const { data, error } = await window.supabaseClient
            .from('direct_messages')
            .insert({
                sender_id: this.currentUser.id,
                receiver_id: this.activeConversation,
                message: text
            })
            .select()
            .single();

        if (error) {
            console.error("DM send error:", error);
            // Mark the temp bubble as failed
            const tempEl = document.querySelector(`[data-dm-id="${tempMsg.id}"]`);
            if (tempEl) tempEl.style.opacity = '0.4';
        } else {
            // Replace temp bubble ID
            const tempEl = document.querySelector(`[data-dm-id="${tempMsg.id}"]`);
            if (tempEl) tempEl.dataset.dmId = data.id;
        }
    },

    // Called externally from chat.js DM button
    openConversation(contactId, contactName) {
        this.showChat(contactId, contactName);
    }
};
