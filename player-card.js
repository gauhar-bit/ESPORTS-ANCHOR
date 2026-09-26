/* Dynamic player-card behavior. Loaded after app.js so Firebase auth is available. */
(function () {
    'use strict';

    function setText(selector, value) {
        const element = document.querySelector(selector);
        if (element) element.textContent = value == null ? '' : String(value);
    }

    function updatePlayerCard(user, profile) {
        const data = profile || {};
        const fallbackName = user && user.email ? user.email.split('@')[0] : 'PLAYER_IGN';
        const name = data.displayName || (user && user.displayName) || fallbackName;
        const level = Number(data.level) || 1;
        const wins = Number(data.wins) || 0;
        const kills = Number(data.kills) || 0;
        const deaths = Number(data.deaths) || 0;
        const kd = data.kd != null ? Number(data.kd) : (deaths ? kills / deaths : 0);
        const rank = data.rank != null ? data.rank : '--';
        const xp = Number(data.xp) || 0;
        const xpToNextLevel = Number(data.xpToNextLevel) || 1000;
        const progress = Math.max(0, Math.min(100, (xpToNextLevel ? (xp / xpToNextLevel) * 100 : 0)));

        setText('.player-name', name);
        setText('.level-badge', `LVL ${level}`);
        setText('.wins-value', wins);
        setText('.kd-value', kd.toFixed(2));
        setText('.rank-value', rank === '--' ? rank : `#${rank}`);
        setText('.xp-value', xp);

        const xpFill = document.querySelector('.xp-bar-fill');
        if (xpFill) {
            xpFill.style.width = `${progress}%`;
            xpFill.setAttribute('aria-valuenow', String(Math.round(progress)));
        }
    }

    function showSignedOutCard() {
        updatePlayerCard(null, {
            displayName: 'GUEST PLAYER', level: 1, wins: 0,
            kills: 0, deaths: 0, rank: '--', xp: 0, xpToNextLevel: 1000
        });
    }

    function initialisePlayerCard() {
        if (typeof auth === 'undefined') return;
        auth.onAuthStateChanged(function (user) {
            if (!user) {
                showSignedOutCard();
                return;
            }

            updatePlayerCard(user, {});
            if (typeof database === 'undefined') return;

            database.ref(`users/${user.uid}/profile`).on('value', function (snapshot) {
                updatePlayerCard(user, snapshot.exists() ? snapshot.val() : {});
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialisePlayerCard);
    } else {
        initialisePlayerCard();
    }
}());
