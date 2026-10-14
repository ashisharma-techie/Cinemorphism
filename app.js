let room_id = new URLSearchParams(window.location.search).get('room') || '';
let username = '';
let socket = null;
const player = document.getElementById("main-player");
let isSyncing = false;
let selectedProfileUser = '';
let isHost = false;

if (room_id) {
    document.getElementById("modal-room").value = room_id;
}

// FEATURE 2: Web Audio API Synthesizer for Emoji & Chat Sound Effects
function playPopSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
}

function submitJoinModal() {
    const uInput = document.getElementById("modal-username").value.trim();
    const rInput = document.getElementById("modal-room").value.trim();

    if (!uInput || !rInput) {
        alert("Please enter both a username and a room code!");
        return;
    }

    username = uInput;
    room_id = rInput;

    document.getElementById("active-user-badge").innerText = "User: " + username;
    document.getElementById("active-room-badge").innerText = "Room: " + room_id;
    window.history.pushState({}, "", "?room=" + encodeURIComponent(room_id));

    document.getElementById("join-modal").classList.add("hidden");
    connectWebSocket();
}

function toggleChat(side) {
    const panel = document.getElementById(side + "-chat-panel");
    if (panel) {
        panel.classList.toggle("hidden");
    }
}

function copyInviteLink() {
    const inviteUrl = window.location.href;
    navigator.clipboard.writeText(inviteUrl).then(() => {
        const btnText = document.getElementById("copy-btn-text");
        if (btnText) {
            btnText.innerText = "Copied! ✨";
            setTimeout(() => { btnText.innerText = "Copy Link"; }, 2000);
        }
    }).catch(() => {
        alert("Invite URL: " + inviteUrl);
    });
}

function openUserProfileModal(targetUsername) {
    selectedProfileUser = targetUsername;
    document.getElementById("profile-username").innerText = targetUsername;
    document.getElementById("profile-avatar").innerText = targetUsername.charAt(0).toUpperCase();
    document.getElementById("user-profile-modal").classList.remove("hidden");
}

function closeUserProfileModal() {
    document.getElementById("user-profile-modal").classList.add("hidden");
}

function sendWave() {
    if (!socket || !selectedProfileUser) return;
    socket.send(JSON.stringify({ 
        type: "chat", 
        text: `waved at ${selectedProfileUser}! 👋💕`, 
        side: "left" 
    }));
    closeUserProfileModal();
}

function changeTheme(themeName) {
    document.body.className = "";
    if (themeName !== "default") {
        document.body.classList.add("theme-" + themeName);
    }
}

// FEATURE 1: Flying On-Screen Chat Comments (Danmaku)
function createDanmakuComment(user, text) {
    const container = document.getElementById("danmaku-container");
    if (!container) return;

    const el = document.createElement("div");
    el.className = "danmaku-text";
    el.innerText = `${user}: ${text}`;

    // Random pastel colors for flying text
    const colors = ["#f472b6", "#c084fc", "#38bdf8", "#34d399", "#fb923c", "#facc15"];
    el.style.color = colors[Math.floor(Math.random() * colors.length)];
    
    // Random height position on player screen
    el.style.top = Math.random() * 65 + 10 + "%";

    container.appendChild(el);
    setTimeout(() => el.remove(), 7000);
}

function connectWebSocket() {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${wsProtocol}//${window.location.host}/ws/${encodeURIComponent(room_id)}/${encodeURIComponent(username)}`);

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "error") {
            alert(data.message);
            location.reload();
            return;
        }

        // FEATURE 5: Host Badge assignment (First connected user becomes Host)
        if (data.type === "user_update") {
            const uCount = document.getElementById("user-count");
            if (uCount && data.users) {
                uCount.innerText = `${data.users.length}/10 online`;
                
                // Set Host status for first user in room array
                if (data.users.length > 0 && data.users[0] === username) {
                    isHost = true;
                    document.getElementById("active-user-badge").innerText = "User: " + username + " 👑 (Host)";
                } else {
                    isHost = false;
                    document.getElementById("active-user-badge").innerText = "User: " + username;
                }
            }
        }

        if (data.type === "chat") {
            const side = data.side || "left";
            const chatBox = document.getElementById(side + "-chat-messages");
            if (chatBox) {
                const msg = document.createElement("div");
                msg.className = side === "left" 
                    ? "bg-rose-50/90 p-2 rounded-xl border border-rose-100 text-slate-700"
                    : "bg-purple-50/90 p-2 rounded-xl border border-purple-100 text-slate-700";
                
                msg.innerHTML = `<span class="font-bold cursor-pointer hover:underline ${side === 'left' ? 'text-rose-500' : 'text-purple-500'}" onclick="openUserProfileModal('${data.user}')">${data.user}:</span> ${data.text}`;
                chatBox.appendChild(msg);
                chatBox.scrollTop = chatBox.scrollHeight;
            }

            // Trigger Danmaku Flying Chat Text + Sound
            createDanmakuComment(data.user, data.text);
            playPopSound();
        }

        if (data.type === "sync") {
            isSyncing = true;
            if (data.video_url) {
                player.src = data.video_url;
                player.load();
            }
            if (Math.abs(player.currentTime - data.time) > 0.5 || data.action === "seek") {
                player.currentTime = data.time;
            }
            if (data.action === "play") player.play().catch(() => {});
            if (data.action === "pause") player.pause();
            setTimeout(() => { isSyncing = false; }, 200);
        }

        if (data.type === "reaction") {
            const container = document.getElementById("emoji-container");
            if (container) {
                const el = document.createElement("div");
                el.className = "floating-emoji";
                el.innerText = data.emoji;
                el.style.left = Math.random() * 80 + 10 + "%";
                container.appendChild(el);
                setTimeout(() => el.remove(), 2200);
            }
            playPopSound();
        }
    };
}

player.addEventListener("play", () => {
    if (isSyncing || !socket) return;
    socket.send(JSON.stringify({ type: "sync", action: "play", time: player.currentTime }));
});

player.addEventListener("pause", () => {
    if (isSyncing || !socket) return;
    socket.send(JSON.stringify({ type: "sync", action: "pause", time: player.currentTime }));
});

player.addEventListener("seeked", () => {
    if (isSyncing || !socket) return;
    socket.send(JSON.stringify({ type: "sync", action: "seek", time: player.currentTime }));
});

function sendChat(side) {
    const input = document.getElementById(side + "-chat-input");
    if (!input || !input.value.trim() || !socket) return;
    socket.send(JSON.stringify({ type: "chat", text: input.value, side: side }));
    input.value = "";
}

function sendEmoji(emoji) {
    if (!socket) return;
    socket.send(JSON.stringify({ type: "reaction", emoji: emoji, time: player.currentTime }));
}

async function fetchMovies() {
    const searchInput = document.getElementById("search-input");
    const search = searchInput ? searchInput.value : "";
    const res = await fetch(`/api/movies?search=${encodeURIComponent(search)}`);
    const data = await res.json();
    const grid = document.getElementById("catalog-grid");
    if (!grid) return;
    grid.innerHTML = "";
    
    data.movies.forEach(m => {
        const card = document.createElement("div");
        card.className = "bg-rose-50/60 rounded-xl p-2 border border-rose-100 hover:border-rose-300 hover:shadow-md transition cursor-pointer";
        card.innerHTML = `
            <img src="${m.poster}" class="h-24 w-full object-cover rounded-lg mb-1">
            <div class="font-bold text-xs text-rose-600 truncate">${m.title}</div>
            <div class="text-[10px] text-slate-400">${m.category}</div>
        `;
        
        card.onclick = () => {
            player.pause();
            player.src = m.url;
            player.currentTime = 0;
            player.load();

            const scrollArea = document.getElementById("main-scroll-area");
            if (scrollArea) scrollArea.scrollTop = 0;
            
            const playPromise = player.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log("Auto-play prevented, click play on player:", error);
                });
            }

            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ 
                    type: "sync", 
                    action: "play", 
                    time: 0, 
                    video_url: m.url 
                }));
            }
        };

        grid.appendChild(card);
    });
}

function toggleDiagnostics() {
    const panel = document.getElementById("diagnostics-panel");
    if (panel) panel.classList.toggle("hidden");
}

fetchMovies();