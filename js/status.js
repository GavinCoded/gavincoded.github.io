const discord_id = '735581916887121943';
let progress_timer = null;
let app_icon_map = null;

function format_time(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${m}:${String(sec).padStart(2, '0')}`;
}

async function fetch_app_icons() {
    try {
        const res = await fetch('https://discord.com/api/v9/applications/detectable');
        const apps = await res.json();
        if (!Array.isArray(apps)) return;
        app_icon_map = {};
        for (let i = 0; i < apps.length; i++) {
            if (apps[i].icon_hash) {
                app_icon_map[apps[i].id] = apps[i].icon_hash;
            }
        }
    } catch (e) {
        console.warn('could not fetch app icons', e);
    }
}

function get_asset_url(a) {
    if (a.assets && a.assets.large_image) {
        const img = a.assets.large_image;
        if (img.startsWith('mp:external/')) {
            return img.replace(/^mp:external\/[^/]+\//, '');
        }
        return 'https://cdn.discordapp.com/app-assets/' + a.application_id + '/' + img + '.png';
    }
    if (app_icon_map && app_icon_map[a.application_id]) {
        return 'https://cdn.discordapp.com/app-icons/' + a.application_id + '/' + app_icon_map[a.application_id] + '.png';
    }
    return null;
}

async function fetch_discord() {
    try {
        const res = await fetch('https://api.lanyard.rest/v1/users/' + discord_id);
        const data = await res.json();
        if (!data.success) {
            set_offline();
            return;
        }
        render(data.data);
    } catch (e) {
        console.warn('discord fetch failed', e);
        set_offline();
    }
}

function render(d) {
    const user = d.discord_user;
    const avatar_url = 'https://cdn.discordapp.com/avatars/' + user.id + '/' + user.avatar + '.png?size=64';

    const status_colors = {
        online: '#43b581',
        idle: '#faa61a',
        dnd: '#f04747',
        offline: '#747f8d',
    };
    const status_labels = {
        online: 'online',
        idle: 'idle',
        dnd: 'Do Not Disturb',
        offline: 'offline',
    };
    const ds = d.discord_status || 'offline';

    document.getElementById('discord_avatar').src = avatar_url;
    document.getElementById('discord_username').textContent = user.global_name || user.username;
    document.getElementById('status_dot').style.background = status_colors[ds];
    document.getElementById('status_label').textContent = status_labels[ds];

    render_activities(d);
}

function build_list(d) {
    const acts = [];
    if (d.listening_to_spotify && d.spotify) {
        acts.push({ kind: 'spotify', data: d.spotify });
    }
    if (d.activities) {
        for (let i = 0; i < d.activities.length; i++) {
            const a = d.activities[i];
            if (a.type === 0) {
                acts.push({ kind: 'game', data: a });
            }
        }
        for (let i = 0; i < d.activities.length; i++) {
            const a = d.activities[i];
            if (a.type !== 0 && a.type !== 4 && a.type !== 2) {
                acts.push({ kind: 'other', data: a });
            }
        }
    }
    return acts;
}

function render_activities(d) {
    if (progress_timer) {
        clearInterval(progress_timer);
        progress_timer = null;
    }

    document.getElementById('activity_spotify').style.display = 'none';
    document.getElementById('activity_game').style.display = 'none';
    document.getElementById('extra_toggle').style.display = 'none';
    document.getElementById('extra_list').style.display = 'none';

    const all = build_list(d);

    if (all.length === 0) return;

    const primary = all[0];
    if (primary.kind === 'spotify') {
        show_spotify(primary.data);
    } else if (primary.kind === 'game') {
        show_game(primary.data);
    }

    if (all.length > 1) {
        const extras = all.slice(1);
        const toggle = document.getElementById('extra_toggle');
        const text = document.getElementById('extra_toggle_text');
        const list = document.getElementById('extra_list');
        const chevron = document.getElementById('extra_chevron');

        text.textContent = '+' + extras.length + ' more';
        toggle.style.display = 'flex';

        toggle.onclick = function () {
            const open = list.style.display === 'flex';
            list.style.display = open ? 'none' : 'flex';
            chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
        };

        list.innerHTML = '';
        for (let i = 0; i < extras.length; i++) {
            const ex = extras[i];
            const row = document.createElement('div');
            row.className = 'extra_row';
            if (ex.kind === 'spotify') {
                row.innerHTML = '<span class="extra_row_name">' + ex.data.song + '</span><span class="extra_row_detail">' + ex.data.artist + '</span>';
            } else if (ex.kind === 'game') {
                let h = '<span class="extra_row_name">' + ex.data.name + '</span>';
                if (ex.data.details) h += '<span class="extra_row_detail">' + ex.data.details + '</span>';
                row.innerHTML = h;
            } else {
                row.innerHTML = '<span class="extra_row_name">' + ex.data.name + '</span>';
            }
            list.appendChild(row);
        }
        list.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}

function show_spotify(sp) {
    document.getElementById('spotify_art').src = sp.album_art_url;
    document.getElementById('spotify_song').textContent = sp.song;
    document.getElementById('spotify_artist').textContent = sp.artist;
    document.getElementById('activity_spotify').style.display = 'flex';

    const start = sp.timestamps.start;
    const total = Math.floor((sp.timestamps.end - start) / 1000);

    function tick() {
        const now = Date.now();
        const elapsed = Math.max(0, Math.floor((now - start) / 1000));
        const remaining = Math.max(0, total - elapsed);
        const pct = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
        document.getElementById('spotify_progress_fill').style.width = pct + '%';
        document.getElementById('spotify_time').textContent = format_time(elapsed) + ' / ' + format_time(total);
        if (remaining <= 0 && progress_timer) {
            clearInterval(progress_timer);
            progress_timer = null;
        }
    }

    tick();
    progress_timer = setInterval(tick, 1000);
}

function show_game(game) {
    const art = document.getElementById('game_art');
    document.getElementById('game_name').textContent = game.name;
    document.getElementById('game_details').textContent = game.details || '';
    document.getElementById('game_state').textContent = game.state || '';
    document.getElementById('game_details').style.display = game.details ? '' : 'none';
    document.getElementById('game_state').style.display = game.state ? '' : 'none';

    const url = get_asset_url(game);
    if (url) {
        art.src = url;
        art.style.display = '';
    } else {
        art.style.display = 'none';
    }
    document.getElementById('activity_game').style.display = 'flex';
}

function set_offline() {
    document.getElementById('status_dot').style.background = '#747f8d';
    document.getElementById('status_label').textContent = 'offline';
    if (progress_timer) {
        clearInterval(progress_timer);
        progress_timer = null;
    }
    document.getElementById('activity_spotify').style.display = 'none';
    document.getElementById('activity_game').style.display = 'none';
    document.getElementById('extra_toggle').style.display = 'none';
    document.getElementById('extra_list').style.display = 'none';
}

fetch_app_icons();
fetch_discord();
setInterval(fetch_discord, 15000);
