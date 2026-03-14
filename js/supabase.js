const SUPABASE_URL = "https://kotiuwsxvzammmwkqebw.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdGl1d3N4dnphbW1td2txZWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzQwOTAsImV4cCI6MjA4ODk1MDA5MH0.UzQxkdGiwXbxxXEA80PkxeqgshGuTuynCPMdYeEukRA"

try {
    if (typeof supabase !== 'undefined') {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Supabase Client Initialized.");
    } else {
        console.error("❌ CRITICAL: Supabase CDN script missing or failed to load. Check that <script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'></script> is present in your HTML <head>.");
    }
} catch (err) {
    console.error("❌ Error initializing Supabase client:", err);
}

// Utility: Upload Image to Supabase Storage (User Implementation)
window.supabaseClient.uploadImage = async function(file) {
    if (!file) return null;

    const filePath = `images/${Date.now()}-${file.name}`;

    try {
        const { data, error } = await window.supabaseClient.storage
            .from("user-media")
            .upload(filePath, file);

        if (error) {
            console.error("Storage upload error:", error);
            return null;
        }

        // Return the public URL directly as per user request
        return `https://kotiuwsxvzammmwkqebw.supabase.co/storage/v1/object/public/user-media/${filePath}`;
    } catch (err) {
        console.error("Upload exception:", err);
        return null;
    }
};