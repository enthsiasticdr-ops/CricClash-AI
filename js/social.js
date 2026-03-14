// CricClash AI - Social Features (Stories & DMs)

window.Social = {
    stories: [],
    
    init(user) {
        this.currentUser = user;
        this.storiesContainer = document.getElementById('storiesContainer');
        this.addStoryBtn = document.getElementById('addStoryBtn');
        
        this.bindEvents();
        this.fetchStories();
    },

    bindEvents() {
        if(this.addStoryBtn) {
            this.addStoryBtn.addEventListener('click', () => this.handleStoryUpload());
        }
    },

    async fetchStories() {
        try {
            // Step 1: fetch stories without join (avoids FK/400 errors)
            const { data: stories, error } = await window.supabaseClient
                .from('stories')
                .select('id, user_id, image_url, created_at')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false });

            if (error) {
                // Table may not exist yet – silently clear the stories area
                if (error.code !== 'PGRST116') console.warn('Stories feed uninitialized (ignore if intentional):', error.message);
                return;
            }

            if (!stories || stories.length === 0) {
                this.stories = [];
                this.renderStories();
                return;
            }

            // Step 2: batch-fetch user profiles
            const userIds = [...new Set(stories.map(s => s.user_id))];
            const { data: users } = await window.supabaseClient
                .from('users')
                .select('id, name, avatar_url')
                .in('id', userIds);

            const userMap = {};
            (users || []).forEach(u => { userMap[u.id] = u; });

            this.stories = stories.map(s => ({
                ...s,
                users: userMap[s.user_id] || { name: 'Titan', avatar_url: null }
            }));
            this.renderStories();
        } catch (err) {
            console.warn('Stories exception:', err);
        }
    },


    renderStories() {
        if(!this.storiesContainer) return;
        
        // Clear all but the add button
        const addBtnHTML = `<div class="add-story-circle" id="addStoryBtn">+</div>`;
        this.storiesContainer.innerHTML = addBtnHTML;
        this.addStoryBtn = this.storiesContainer.querySelector('#addStoryBtn'); // Re-bind
        this.addStoryBtn.addEventListener('click', () => this.handleStoryUpload());

        this.stories.forEach((story, index) => {
            const html = `
                <div class="story-circle" title="${story.users?.name}'s story" onclick="Social.showStory(${index})">
                    <img src="${story.image_url}" alt="Story">
                </div>
            `;
            this.storiesContainer.insertAdjacentHTML('beforeend', html);
        });
    },

    showStory(index) {
        const story = this.stories[index];
        if(!story) return;

        let modal = document.getElementById('storyViewModal');
        if(!modal) {
            modal = document.createElement('div');
            modal.id = 'storyViewModal';
            modal.className = 'modal-overlay hidden';
            modal.style.zIndex = '2000';
            modal.innerHTML = `
                <div class="story-view-content">
                    <button class="close-story">&times;</button>
                    <div class="story-progress-bar"><div class="story-progress-fill"></div></div>
                    <div class="story-user-info">
                        <img id="storyUserAvatar" src="">
                        <span id="storyUserName"></span>
                    </div>
                    <img id="storyMainImg" src="">
                </div>
                <style>
                    .story-view-content { position:relative; width:100%; max-width:450px; height:80vh; background:#000; border-radius:15px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
                    .close-story { position:absolute; top:20px; right:20px; font-size:2rem; color:white; background:none; border:none; cursor:pointer; z-index:10; }
                    .story-main-img { width:100%; height:100%; object-fit:contain; }
                    .story-progress-bar { position:absolute; top:10px; left:10px; right:10px; height:3px; background:rgba(255,255,255,0.3); border-radius:3px; z-index:5; }
                    .story-progress-fill { height:100%; background:white; width:0%; transition: width 5s linear; }
                    .story-user-info { position:absolute; top:25px; left:20px; display:flex; align-items:center; gap:10px; color:white; z-index:5; }
                    .story-user-info img { width:32px; height:32px; border-radius:50%; border:2px solid var(--primary-ai-blue); }
                </style>
            `;
            document.body.appendChild(modal);
            modal.querySelector('.close-story').onclick = () => modal.classList.add('hidden');
        }

        const mainImg = modal.querySelector('#storyMainImg');
        const userAvatar = modal.querySelector('#storyUserAvatar');
        const userName = modal.querySelector('#storyUserName');
        const progressFill = modal.querySelector('.story-progress-fill');

        mainImg.src = story.image_url;
        userAvatar.src = story.users?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${story.users?.name}`;
        userName.textContent = story.users?.name || 'Titan';
        
        modal.classList.remove('hidden');
        
        // Auto-close animation
        progressFill.style.transition = 'none';
        progressFill.style.width = '0%';
        setTimeout(() => {
            progressFill.style.transition = 'width 5s linear';
            progressFill.style.width = '100%';
        }, 50);

        setTimeout(() => {
            if(!modal.classList.contains('hidden')) modal.classList.add('hidden');
        }, 5050);
    },

    async handleStoryUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Size limit (1MB)
            if (file.size > 1024 * 1024) {
                alert("File too large! Max size for stories is 1MB.");
                return;
            }

            if (!this.addStoryBtn) return;
            const originalHTML = this.addStoryBtn.innerHTML;
            const btn = this.addStoryBtn;
            btn.innerHTML = '<span style="font-size:0.6rem">🚀...</span>';
            btn.style.pointerEvents = 'none';

            try {
                if (!window.supabaseClient) throw new Error("Supabase client not initialized.");
                
                // Ensure helper exists in supabase.js
                if (typeof window.supabaseClient.uploadImage !== 'function') {
                    throw new Error("Critical: storage.uploadImage helper missing in supabase.js.");
                }

                const url = await window.supabaseClient.uploadImage(file);
                
                if (!url) {
                    throw new Error("Upload failed. Verify 'user-media' bucket exists in your Supabase project and is set to PUBLIC.");
                }

                const { error } = await window.supabaseClient
                    .from('stories')
                    .insert([{
                        user_id: this.currentUser.id,
                        image_url: url
                    }]);

                if (error) throw error;

                if (window.Gamification) {
                    await window.Gamification.addXP(15, this.currentUser.id);
                }
                
                if (window.App) window.App.showAchievement("Story shared with the Arena! +15 XP 📸");
                this.fetchStories(); 
            } catch (err) {
                console.error("Story upload failed:", err);
                const msg = err.message || "Unknown error";
                alert(`Story Upload Failed: ${msg}\n\nCheck Supabase Storage Bucket 'user-media' and Policies.`);
            } finally {
                if (btn) {
                    btn.innerHTML = originalHTML;
                    btn.style.pointerEvents = '';
                }
            }
        };
        input.click();
    }
};
