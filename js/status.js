const discord_id = '735581916887121943';

async function fetch_status() {
    try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${discord_id}`);
        const data = await res.json();

        if (!data.success) return set_status('offline');

        const online = data.data.discord_status !== 'offline';
        set_status(online ? 'online' : 'offline');
    } catch {
        set_status('offline');
    }
}

function set_status(text) {
    const el = document.getElementById('discord_status');
    if (!el) return;
    el.textContent = text;
}

fetch_status();
setInterval(fetch_status, 30000);
