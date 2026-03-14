// CricClash AI - AI Meme Studio Module v2

window.Memes = {
    memes: [],
    currentMeme: null,

    init(user) {
        this.currentUser = user;

        this.memeForm = document.getElementById('memeForm');
        this.memePrompt = document.getElementById('memePrompt');
        this.generateBtn = document.getElementById('generateMemeBtn');
        this.memePreview = document.getElementById('memePreview');
        this.memePlaceholder = document.getElementById('memePlaceholder');
        this.generatedImg = document.getElementById('generatedMemeImg');
        this.memeFeed = document.getElementById('memeFeed');

        if (!this.memeForm || !this.generateBtn) {
            console.warn("Meme Studio: form elements not found, skipping init.");
            return;
        }

        this.bindEvents();
        this.fetchRecentMemes();
    },

    bindEvents() {
        this.memeForm.addEventListener('submit', (e) => this.handleGenerate(e));
        if (this.memePreview) {
            this.memePreview.addEventListener('click', (e) => {
                if (e.target.classList.contains('post-btn')) this.postMeme();
            });
        }
    },

    async fetchRecentMemes() {
        try {
            // Step 1: fetch memes without join
            const { data: memes, error } = await window.supabaseClient
                .from('memes')
                .select('id, image_url, caption, created_at, user_id')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) { console.error('Memes fetch error:', error); return; }
            if (!memes || memes.length === 0) { if (this.memeFeed) this.renderFeed(); return; }

            // Step 2: batch-fetch user profiles
            const userIds = [...new Set(memes.map(m => m.user_id))];
            const { data: users } = await window.supabaseClient
                .from('users')
                .select('id, name, avatar_url')
                .in('id', userIds);

            const userMap = {};
            (users || []).forEach(u => { userMap[u.id] = u; });

            this.memes = memes.map(m => ({
                ...m,
                users: userMap[m.user_id] || { name: 'Anon', avatar_url: null }
            }));
            if (this.memeFeed) this.renderFeed();
        } catch (err) {
            console.error('Memes fetch exception:', err);
        }
    },


    async handleGenerate(e) {
        e.preventDefault();
        const prompt = this.memePrompt.value.trim();
        if (!prompt) return;

        this.generateBtn.disabled = true;
        this.generateBtn.textContent = '⚡ AI Generating...';
        if (this.memePreview) this.memePreview.classList.add('generating');
        if (this.memePlaceholder) this.memePlaceholder.style.display = 'none';
        if (this.generatedImg) this.generatedImg.style.display = 'none';

        const existingPost = this.memePreview ? this.memePreview.querySelector('.post-btn') : null;
        if (existingPost) existingPost.remove();

        try {
            await new Promise(res => setTimeout(res, 1800));

            // === Canvas Meme Generation ===
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');

            // Rich background gradients
            const bgOptions = [
                ['#1a1a2e', '#16213e', '#0f3460'],
                ['#200122', '#6f0000', '#1a0000'],
                ['#0d0d1f', '#001a33', '#002244'],
                ['#0a0f1e', '#1a1144', '#2d0066'],
                ['#003300', '#001a00', '#0d1f0d'],
            ];
            const bg = bgOptions[Math.floor(Math.random() * bgOptions.length)];
            const grd = ctx.createLinearGradient(0, 0, 600, 600);
            grd.addColorStop(0, bg[0]);
            grd.addColorStop(0.5, bg[1]);
            grd.addColorStop(1, bg[2]);
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, 600, 600);

            // Glowing radial overlay
            const radial = ctx.createRadialGradient(300, 300, 50, 300, 300, 350);
            radial.addColorStop(0, 'rgba(0, 194, 255, 0.08)');
            radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = radial;
            ctx.fillRect(0, 0, 600, 600);

            // Cricket emojis as decorative bg elements
            const emojiChoices = ['🏏', '🔥', '💥', '🏆', '🎯', '💀', '🚀'];
            const e1 = emojiChoices[Math.floor(Math.random() * emojiChoices.length)];
            const e2 = emojiChoices[Math.floor(Math.random() * emojiChoices.length)];

            ctx.font = '200px serif';
            ctx.globalAlpha = 0.08;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(e1, 20, 350);
            ctx.fillText(e2, 320, 580);
            ctx.globalAlpha = 1;

            // Dark text area at bottom
            const shade = ctx.createLinearGradient(0, 340, 0, 600);
            shade.addColorStop(0, 'rgba(0,0,0,0)');
            shade.addColorStop(0.4, 'rgba(0,0,0,0.7)');
            shade.addColorStop(1, 'rgba(0,0,0,0.95)');
            ctx.fillStyle = shade;
            ctx.fillRect(0, 340, 600, 260);

            // CricClash AI watermark top-right
            ctx.font = 'bold 13px "Arial", sans-serif';
            ctx.fillStyle = 'rgba(0, 194, 255, 0.6)';
            ctx.textAlign = 'right';
            ctx.fillText('⚡ CricClash AI', 590, 24);

            // Meme text (bold wrapped)
            const upperPrompt = prompt.toUpperCase();
            const words = upperPrompt.split(' ');
            const lines = [];
            let line = '';
            const maxCharsPerLine = 22;
            words.forEach(word => {
                if ((line + ' ' + word).trim().length <= maxCharsPerLine) {
                    line = (line + ' ' + word).trim();
                } else {
                    if (line) lines.push(line);
                    line = word;
                }
            });
            if (line) lines.push(line);

            const displayLines = lines.slice(0, 3);
            const lineHeight = 68;
            const totalH = displayLines.length * lineHeight;
            let startY = 600 - totalH - 16;

            ctx.textAlign = 'center';
            displayLines.forEach((l, i) => {
                const y = startY + i * lineHeight;
                ctx.font = 'bold 52px Impact, "Arial Black", sans-serif';
                ctx.strokeStyle = 'rgba(0,0,0,0.9)';
                ctx.lineWidth = 7;
                ctx.strokeText(l, 300, y);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(l, 300, y);
            });

            const dataUrl = canvas.toDataURL('image/png');
            this.currentMeme = { url: dataUrl, caption: prompt, isDataUrl: true };

            if (this.generatedImg) {
                this.generatedImg.src = dataUrl;
                this.generatedImg.style.display = 'block';
            }
            if (this.memePreview) this.memePreview.classList.remove('generating');
            this.showPostButton();

        } catch (err) {
            console.error("Meme generation failed:", err);
            if (this.memePreview) this.memePreview.classList.remove('generating');
            if (this.memePlaceholder) this.memePlaceholder.style.display = '';
            alert("Meme generation failed: " + err.message);
        } finally {
            this.generateBtn.disabled = false;
            this.generateBtn.textContent = '✨ Generate Masterpiece';
        }
    },

    showPostButton() {
        const existing = this.memePreview ? this.memePreview.querySelector('.post-btn') : null;
        if (existing) return;

        const btn = document.createElement('button');
        btn.className = 'post-btn btn-magic';
        btn.style.cssText = `
            position: absolute; bottom: 16px; left: 50%;
            transform: translateX(-50%); z-index: 5;
            padding: 10px 24px; border-radius: 50px;
            font-weight: 700; font-size: 0.9rem;
            white-space: nowrap;
        `;
        btn.innerHTML = '🚀 Post to Arena &amp; Get +20 XP';
        if (this.memePreview) this.memePreview.appendChild(btn);
    },

    async postMeme() {
        if (!this.currentMeme) return;

        const btn = this.memePreview ? this.memePreview.querySelector('.post-btn') : null;
        if (btn) { btn.textContent = 'Posting... ⚡'; btn.disabled = true; }

        try {
            // FIX: Use the base64 data URL directly.
            // This prevents "converting into any other thing" (the dicebear fallback)
            // if the user hasn't set up their Supabase Storage 'user-media' bucket.
            let imageUrl = this.currentMeme.url;

            const caption = this.currentMeme.caption;
            const { data, error } = await window.supabaseClient
                .from('memes')
                .insert([{ user_id: this.currentUser.id, image_url: imageUrl, caption }])
                .select()
                .single();

            if (error) throw error;

            // ✅ ALSO POST TO BATTLEFIELD CHAT so everyone sees the meme
            try {
                await window.supabaseClient
                    .from('messages')
                    .insert([{
                        user_id: this.currentUser.id,
                        message: `🎭 Meme: "${caption}"`,
                        image_url: imageUrl,
                        roast_points: 0
                    }]);
            } catch (chatErr) {
                // If image_url column doesn't exist, try without it
                try {
                    await window.supabaseClient
                        .from('messages')
                        .insert([{
                            user_id: this.currentUser.id,
                            message: `🎭 Meme posted: "${caption}" → ${imageUrl}`,
                            roast_points: 0
                        }]);
                } catch (_) { /* ignore if chat insert fails */ }
            }

            if (window.Gamification) window.Gamification.addXP(20);
            if (window.App) window.App.showAchievement('🎭 Meme dropped to Arena! +20 XP');


            if (btn) btn.remove();
            if (this.generatedImg) this.generatedImg.style.display = 'none';
            if (this.memePlaceholder) this.memePlaceholder.style.display = '';
            if (this.memePrompt) this.memePrompt.value = '';
            this.currentMeme = null;

            this.memes.unshift({ ...data, users: { name: this.currentUser.name, avatar_url: this.currentUser.avatar_url } });
            this.renderFeed();

        } catch (err) {
            console.error('Post failed:', err);
            if (btn) { btn.textContent = '🚀 Post to Arena & Get +20 XP'; btn.disabled = false; }
            alert("Could not post meme. Make sure you're logged in.");
        }
    },

    renderFeed() {
        if (!this.memeFeed) return;

        if (this.memes.length === 0) {
            this.memeFeed.innerHTML = `
                <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                    <p>No memes yet. Be the first to roast! 🎭</p>
                </div>`;
            return;
        }

        this.memeFeed.innerHTML = this.memes.slice(0, 10).map(meme => {
            const userName = meme.users?.name || 'Anonymous';
            const avatarUrl = meme.users?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`;
            const timeAgo = this.getTimeAgo(meme.created_at);

            const imgSrc = meme.image_url; // Render the real image directly

            return `
                <div class="meme-card">
                    <img src="${imgSrc}" alt="${meme.caption}" loading="lazy"
                        onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(meme.caption)}'">
                    <div class="meme-caption" style="font-size:0.9rem; margin:8px 0; font-weight:600;">
                        "${meme.caption}"
                    </div>
                    <div class="meme-author" style="display:flex; align-items:center; gap:8px;">
                        <img src="${avatarUrl}" style="width:24px; height:24px; border-radius:50%;" 
                             onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}'">
                        <span>${userName}</span>
                        <span style="margin-left:auto; color:var(--text-muted); font-size:0.75rem;">${timeAgo}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    getTimeAgo(dateStr) {
        if (!dateStr) return '';
        const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }
};
