// Get session data from hidden inputs
const sessionId = document.getElementById('sessionId').value;
const userId = document.getElementById('userId').value;
const isMaster = document.getElementById('isMaster').value === 'true';

// Initialize SignalR connection
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/lobbyHub")
    .withAutomaticReconnect()
    .build();

// DOM elements
const userList = document.getElementById('userList');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const readyToggle = document.getElementById('readyToggle');
const startSessionBtn = document.getElementById('startSessionBtn');
const toggleOpen = document.getElementById('toggleOpen');
const leaveBtn = document.getElementById('leaveBtn');

// User list state
let users = [];

// Connection event handlers
connection.onreconnecting(() => {
    console.log('Reconnecting...');
    addSystemMessage('Connection lost. Reconnecting...');
});

connection.onreconnected(() => {
    console.log('Reconnected');
    addSystemMessage('Reconnected successfully');
    // Rejoin the lobby
    connection.invoke("JoinLobby", sessionId, userId);
});

connection.onclose(() => {
    console.log('Connection closed');
    addSystemMessage('Connection closed. Please refresh the page.');
});

// SignalR event handlers
connection.on("InitialUserList", (usersList) => {
    users = usersList;
    renderUserList();
});

connection.on("UserJoined", (user) => {
    // Check if user already exists
    const existingIndex = users.findIndex(u => u.id === user.id);
    if (existingIndex === -1) {
        users.push(user);
        renderUserList();
        addSystemMessage(`${user.username} joined the session`);
    }
});

connection.on("UserLeft", (data) => {
    users = users.filter(u => u.id !== data.id);
    renderUserList();
    addSystemMessage(`${data.username} left the session`);
});

connection.on("UserDisconnected", (data) => {
    addSystemMessage(`${data.username} disconnected`);
});

connection.on("UserReadyChanged", (data) => {
    const user = users.find(u => u.id === data.id);
    if (user) {
        user.isReady = data.isReady;
        renderUserList();
    }
});

connection.on("AllPlayersReadyStatus", (allReady) => {
    if (isMaster && startSessionBtn) {
        startSessionBtn.disabled = !allReady;
    }
});

connection.on("ReceiveMessage", (data) => {
    addChatMessage(data.username, data.message, data.timestamp);
});

connection.on("ChatHistory", (messages) => {
    chatMessages.innerHTML = '';
    messages.forEach(msg => {
        addChatMessage(msg.username, msg.message, msg.timestamp);
    });
});

connection.on("UserKicked", () => {
    alert('You have been kicked from the session');
    window.location.href = '/';
});

connection.on("SessionStarted", () => {
    addSystemMessage('Session is starting! Good luck adventurers!');
    setTimeout(() => {
        alert('The session has started! The Game Master will now guide the adventure.');
    }, 500);
});

connection.on("SessionOpenChanged", (isOpen) => {
    const statusBadge = document.getElementById('sessionStatus');
    if (statusBadge) {
        statusBadge.textContent = isOpen ? 'Open to New Players' : 'Closed to New Players';
        statusBadge.className = isOpen ? 'badge bg-info' : 'badge bg-secondary';
    }
});

// UI Functions
function renderUserList() {
    userList.innerHTML = '';

    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'list-group-item d-flex justify-content-between align-items-center';

        const userInfo = document.createElement('div');
        userInfo.className = 'flex-grow-1';

        const username = document.createElement('strong');
        username.textContent = user.username;
        userInfo.appendChild(username);

        const roleBadge = document.createElement('span');
        roleBadge.className = user.role === 'Master' ? 'badge bg-danger ms-2' : 'badge bg-primary ms-2';
        roleBadge.textContent = user.role;
        userInfo.appendChild(roleBadge);

        if (user.role === 'Player' && user.isReady) {
            const readyBadge = document.createElement('span');
            readyBadge.className = 'badge bg-success ms-2';
            readyBadge.textContent = 'Ready';
            userInfo.appendChild(readyBadge);
        }

        userItem.appendChild(userInfo);

        // Add kick button for master (only for players)
        if (isMaster && user.role === 'Player') {
            const kickBtn = document.createElement('button');
            kickBtn.className = 'btn btn-sm btn-danger';
            kickBtn.textContent = 'Kick';
            kickBtn.onclick = () => kickUser(user.id);
            userItem.appendChild(kickBtn);
        }

        userList.appendChild(userItem);
    });
}

function addChatMessage(username, message, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message mb-2';

    const time = new Date(timestamp).toLocaleTimeString();

    messageDiv.innerHTML = `
        <div class="d-flex justify-content-between">
            <strong class="text-primary">${escapeHtml(username)}</strong>
            <small class="text-muted">${time}</small>
        </div>
        <div>${escapeHtml(message)}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message mb-2 text-center';
    messageDiv.innerHTML = `<small class="text-muted fst-italic">${escapeHtml(message)}</small>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// User actions
function sendMessage() {
    const message = chatInput.value.trim();
    if (message) {
        connection.invoke("SendMessage", sessionId, userId, message)
            .catch(err => console.error(err));
        chatInput.value = '';
    }
}

function toggleReady() {
    connection.invoke("ToggleReady", sessionId, userId)
        .catch(err => console.error(err));
}

function kickUser(targetUserId) {
    if (confirm('Are you sure you want to kick this player?')) {
        connection.invoke("KickUser", sessionId, userId, targetUserId)
            .catch(err => console.error(err));
    }
}

function startSession() {
    if (confirm('Are you ready to start the session?')) {
        connection.invoke("StartSession", sessionId, userId)
            .catch(err => console.error(err));
    }
}

function toggleSessionOpen() {
    const isOpen = toggleOpen.checked;
    connection.invoke("ToggleSessionOpen", sessionId, userId, isOpen)
        .catch(err => console.error(err));
}

// Event listeners
sendBtn.addEventListener('click', sendMessage);

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

if (readyToggle) {
    readyToggle.addEventListener('change', toggleReady);
}

if (startSessionBtn) {
    startSessionBtn.addEventListener('click', startSession);
}

if (toggleOpen) {
    toggleOpen.addEventListener('change', toggleSessionOpen);
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    connection.invoke("LeaveLobby", sessionId, userId);
});

// Start connection
connection.start()
    .then(() => {
        console.log('Connected to SignalR hub');
        return connection.invoke("JoinLobby", sessionId, userId);
    })
    .catch(err => {
        console.error('Error connecting to SignalR hub:', err);
        addSystemMessage('Failed to connect to server. Please refresh the page.');
    });
