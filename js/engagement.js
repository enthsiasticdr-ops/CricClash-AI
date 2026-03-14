// CricClash AI - Engagement Features (Polls & Ball Prediction)

window.Engagement = {
    activePoll: null,
    currentPrediction: null,
    predictionTimeout: null,

    init(user) {
        this.currentUser = user;
        this.predictBtns = document.querySelectorAll('.predict-btn');
        this.bindEvents();
    },

    bindEvents() {
        if (!this.predictBtns) return;
        this.predictBtns.forEach(btn => {
            btn.addEventListener('click', () => this.handlePrediction(btn.dataset.outcome, btn));
        });
    },

    handlePrediction(outcome, clickedBtn) {
        if (this.predictionTimeout) clearTimeout(this.predictionTimeout);

        this.currentPrediction = outcome;

        if (this.predictBtns) {
            this.predictBtns.forEach(btn => {
                btn.classList.remove('predicted');
                btn.style.borderColor = '';
                btn.style.background = '';
            });
        }

        if (clickedBtn) {
            clickedBtn.style.borderColor = 'var(--primary-ai-blue)';
            clickedBtn.style.background = 'rgba(0, 194, 255, 0.2)';
            clickedBtn.style.boxShadow = '0 0 15px rgba(0, 194, 255, 0.4)';
            clickedBtn.classList.add('predicted');
        }

        if (window.App) window.App.showAchievement(`🎯 Predicted: ${outcome} — Good luck, Titan!`);

        this.predictionTimeout = setTimeout(() => {
            this.currentPrediction = null;
            if (this.predictBtns) {
                this.predictBtns.forEach(btn => {
                    btn.style.borderColor = '';
                    btn.style.background = '';
                    btn.style.boxShadow = '';
                });
            }
        }, 15000);
    },

    checkPrediction(realOutcome) {
        // Guard: safe to call even before init() runs
        if (!this.currentPrediction) return;

        const isCorrect = this.currentPrediction === realOutcome;
        this.currentPrediction = null;
        if (this.predictionTimeout) clearTimeout(this.predictionTimeout);

        if (this.predictBtns) {
            this.predictBtns.forEach(btn => {
                btn.style.borderColor = '';
                btn.style.background = '';
                btn.style.boxShadow = '';
                btn.classList.remove('predicted');
            });
        }

        if (isCorrect) {
            const xpToAward = 25;
            if (window.Gamification) window.Gamification.addXP(xpToAward);
            if (window.App) window.App.showAchievement(`🔮 PREDICTION CORRECT! +${xpToAward} XP`);
        } else {
            if (window.App) window.App.showAchievement(`❌ Wrong prediction. Better luck next ball!`);
        }
    }
};
