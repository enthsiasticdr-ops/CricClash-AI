// CricClash AI - Authentication Module

window.Auth = {
    currentUser: null,

    async getCurrentUser() {
        if (this.currentUser) return this.currentUser;
        if (!window.supabaseClient) {
            console.error("Supabase client not initialized.");
            return null;
        }

        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session && session.user) {
                return await this.fetchUserProfile(session.user.id);
            }
        } catch (e) {
            console.error("Error getting session:", e);
        }
        return null;
    },

    async fetchUserProfile(userId) {
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) {
            console.error("Error fetching user profile:", error);
            return null;
        }
        
        this.currentUser = data;
        return data;
    },

    async login(name, team) {
        try {
            // 1. Sign in Anonymously to bypass email limits
            const { data: authData, error: authError } = await window.supabaseClient.auth.signInAnonymously();

            if (authError) throw authError;

            const userId = authData.user.id;
            
            // 2. Generate a cool avatar based on name
            const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name.replace(/\s/g,'')}&backgroundColor=b6e3f4`;

            // 3. Upsert public.users record (handles returning users / re-logins)
            const { data: userData, error: dbError } = await window.supabaseClient
                .from('users')
                .upsert([
                    {
                        id: userId,
                        name: name,
                        email: null,
                        team: team,
                        avatar_url: avatarUrl,
                        roast_points: 0,
                        level: 1,
                        xp: 0
                    }
                ], { onConflict: 'id', ignoreDuplicates: false })
                .select()
                .single();

            if (dbError) throw dbError;

            this.currentUser = userData;
            return userData;
            
        } catch (error) {
            console.error("Auth Error:", error.message);
            // Return null or throw for UI handling
            throw error;
        }
    },

    async logout() {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) console.error("Error logging out:", error);
        this.currentUser = null;
        window.location.reload();
    }
};
