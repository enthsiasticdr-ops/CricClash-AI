const FALLBACK_QUIZZES = [
    {
        id: 'f1',
        question: "Which Titan holds the record for the fastest IPL century?",
        option_a: "Chris Gayle",
        option_b: "Yusuf Pathan",
        option_c: "David Miller",
        option_d: "AB de Villiers",
        correct_option: "A",
        xp_reward: 50
    },
    {
        id: 'f2',
        question: "How many IPL titles have the Mumbai Indians won?",
        option_a: "3",
        option_b: "4",
        option_c: "5",
        option_d: "6",
        correct_option: "C",
        xp_reward: 40
    },
    {
        id: 'f3',
        question: "Who was the first player to be sold in the inaugural IPL auction?",
        option_a: "MS Dhoni",
        option_b: "Shane Warne",
        option_c: "Shoaib Akhtar",
        option_d: "Richard Levi",
        correct_option: "B",
        xp_reward: 60
    }
];

async function loadQuiz() {
    // Reset UI
    const buttons = document.querySelectorAll(".option");
    buttons.forEach(btn => {
        btn.style.background = "";
        btn.style.borderColor = "";
        btn.classList.remove('correct', 'wrong', 'correct-glow', 'wrong-shake');
    });

    const questionEl = document.getElementById("question");
    if (questionEl) {
        questionEl.innerHTML = `
            <div class="loading-state">
                <p>Summoning the ultimate challenge...</p>
                <div class="loading-bar"><div class="loading-progress"></div></div>
            </div>
        `;
    }

    try {
        // Robust check for Supabase and Auth
        let attempts = 0;
        console.log("🎮 Quiz Arena: Checking modules...");
        while ((!window.supabaseClient || !window.Auth) && attempts < 15) {
            console.warn(`⏳ Waiting for Supabase/Auth (Attempt ${attempts + 1}/15)...`);
            await new Promise(r => setTimeout(r, 600));
            attempts++;
        }

        if (!window.supabaseClient) {
            console.error("❌ Quiz Arena: Supabase Client not found after 15 attempts. Check supabase.js and your HTML scripts.");
            throw new Error("Supabase connection failed.");
        }

        if (!window.Auth) {
            console.error("❌ Quiz Arena: Auth module missing. Check auth.js.");
            throw new Error("Authentication module missing.");
        }

        console.log("✅ Quiz Arena: Modules ready. Checking user...");
        let user = await window.Auth.getCurrentUser();
        
        // Retry once after a short delay if user is null (auth might be initializing)
        if (!user) {
            console.log("👤 User not found yet, retrying in 2s...");
            await new Promise(r => setTimeout(r, 2000));
            user = await window.Auth.getCurrentUser();
        }

        if (!user) {
            console.error("🚫 Quiz Arena: No active user. Redirecting to home.");
            window.location.href = "index.html";
            return;
        }

        console.log("🏆 Welcome,", user.name, "to the Quiz Arena! Fetching questions...");
        let { data, error } = await window.supabaseClient
            .from("quizzes")
            .select("*");

        if (error || !data || data.length === 0) {
            console.warn("No quizzes in DB, using fallback Arena data.");
            data = FALLBACK_QUIZZES;
        }

        // Randomly pick a quiz from the set
        const quiz = data[Math.floor(Math.random() * data.length)];
        window.currentQuiz = quiz;

        // Animate question entry
        const questionEl = document.getElementById("question");
        questionEl.style.opacity = '0';
        setTimeout(() => {
            questionEl.innerText = quiz.question;
            questionEl.style.opacity = '1';
            questionEl.style.transition = 'opacity 0.5s ease-out';
        }, 300);

        document.getElementById("xpReward").innerText = `+${quiz.xp_reward} XP`;

        buttons[0].innerText = quiz.option_a;
        buttons[1].innerText = quiz.option_b;
        buttons[2].innerText = quiz.option_c;
        buttons[3].innerText = quiz.option_d;

        setupAnswerHandlers(quiz, user);
    } catch (err) {
        console.error("Quiz Error:", err);
        document.getElementById("question").innerHTML = `
            <div style="text-align:center;">
                <p>Connection lost with the Arena!</p>
                <button class="btn-primary" onclick="loadQuiz()" style="margin-top:1rem;">Reconnect</button>
            </div>
        `;
    }
}

function setupAnswerHandlers(quiz, user) {
    const buttons = document.querySelectorAll(".option");
    
    buttons.forEach(btn => {
        // Clone and replace to remove old listeners
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener("click", async () => {
            const selected = newBtn.dataset.option;
            const isCorrect = selected === quiz.correct_option;

            // Premium visual feedback
            if (isCorrect) {
                newBtn.style.background = "linear-gradient(135deg, rgba(0, 255, 153, 0.2), rgba(0, 255, 153, 0.1))";
                newBtn.style.borderColor = "var(--secondary-neon)";
                newBtn.classList.add('correct-glow');
                
                if (window.Gamification && window.Gamification.addXP) {
                    await window.Gamification.addXP(quiz.xp_reward, user.id);
                }
                
                if(window.App) window.App.showAchievement(`CORRECT! +${quiz.xp_reward} XP`);
            } else {
                newBtn.style.background = "linear-gradient(135deg, rgba(255, 51, 102, 0.2), rgba(255, 51, 102, 0.1))";
                newBtn.style.borderColor = "#ff3366";
                newBtn.classList.add('wrong-shake');
            }

            await saveAttempt(user.id, quiz.id, selected, isCorrect, isCorrect ? quiz.xp_reward : 0);
            
            // Wait slightly so user sees the feedback, then load next
            setTimeout(() => {
                loadQuiz();
            }, 2000);
        });
    });
}

async function saveAttempt(userId, quizId, selected, isCorrect, xpEarned) {
    try {
        // Use a minor delay so the actual gamification XP finishes first
        const { error } = await window.supabaseClient
            .from("quiz_attempts")
            .insert({
                user_id: userId,
                quiz_id: (typeof quizId === 'string' && quizId.startsWith('f')) ? null : quizId, // Don't save fallback IDs
                selected_option: selected,
                is_correct: isCorrect,
                xp_earned: xpEarned
            });

        if (error) console.warn("Could not save attempt (Expected for fallbacks)");
    } catch (err) {
        console.error("Error saving attempt:", err);
    }
}

// Start the arena
document.addEventListener('DOMContentLoaded', loadQuiz);
