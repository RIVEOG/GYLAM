#!/usr/bin/env bash
#
# Gylam Panel — Installer
# Made with Nethost Team.
#
# Usage:
#   bash install.sh                      # interactive menu
#   bash install.sh install-panel        # install the web panel on this VPS
#   bash install.sh install-node         # connect this VPS as a compute node
#   bash install.sh update-panel         # pull latest and rebuild
#   bash install.sh create-admin         # create the first admin account
#
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
BLUE="\033[34m"
CYAN="\033[36m"
RESET="\033[0m"

PANEL_DIR="${PANEL_DIR:-/opt/gylam-panel}"
NODE_DIR="${NODE_DIR:-/opt/gylam-node}"
REPO_URL="${REPO_URL:-https://github.com/your-org/gylam-panel.git}"

log()  { echo -e "${GREEN}[gylam]${RESET} $1"; }
warn() { echo -e "${YELLOW}[gylam]${RESET} $1"; }
err()  { echo -e "${RED}[gylam]${RESET} $1" >&2; }
info() { echo -e "${BLUE}[gylam]${RESET} $1"; }

banner() {
  echo ""
  echo -e "${BOLD}  ╔══════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}  ║                                                  ║${RESET}"
  echo -e "${BOLD}  ║            G Y L A M   P A N E L                ║${RESET}"
  echo -e "${BOLD}  ║            Game Server Management                ║${RESET}"
  echo -e "${BOLD}  ║            Made with Nethost Team                ║${RESET}"
  echo -e "${BOLD}  ║                                                  ║${RESET}"
  echo -e "${BOLD}  ╚══════════════════════════════════════════════════╝${RESET}"
  echo ""
}

check_root() {
  if [[ $EUID -ne 0 ]]; then
    err "This installer must be run as root (use sudo)."
    exit 1
  fi
}

prompt() {
  local var_name="$1" prompt_text="$2" default="${3:-}"
  local value
  if [[ -n "$default" ]]; then
    read -rp "$(echo -e "${CYAN}${prompt_text} [${default}]: ${RESET}")" value
    value="${value:-$default}"
  else
    read -rp "$(echo -e "${CYAN}${prompt_text}: ${RESET}")" value
  fi
  printf -v "$var_name" '%s' "$value"
}

# ── Fix dpkg cross-device link errors ──────────────────────────────
# On some VPS/container setups dpkg cannot create backup hard-links
# across filesystem boundaries ("Invalid cross-device link"). This
# repairs any interrupted dpkg state and pre-empts the error.
fix_dpkg() {
  export DEBIAN_FRONTEND=noninteractive
  dpkg --configure -a 2>/dev/null || true
  apt-get install -y --fix-broken 2>/dev/null || true
}

# ── Install a single package only if the command is missing ────────
# This avoids the cross-device link error for packages already present
# (dpkg only fails on UPGRADES in that scenario).
ensure_pkg() {
  local cmd="$1" pkg="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    log "Found ${cmd} — skipping install."
    return 0
  fi
  log "Installing ${pkg}..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y --no-install-recommends \
      -o Dpkg::Options::="--force-overwrite" \
      -o Dpkg::Options::="--force-confdef" \
      -o Dpkg::Options::="--force-confold" \
      "$pkg" 2>/dev/null || {
      warn "Standard install failed, retrying with --force-all..."
      apt-get install -y -o Dpkg::Options::="--force-all" "$pkg"
    }
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q "$pkg"
  elif command -v yum >/dev/null 2>&1; then
    yum install -y -q "$pkg"
  elif command -v pacman >/dev/null 2>&1; then
    pacman -S --noconfirm --needed "$pkg"
  else
    err "No supported package manager found. Please install ${pkg} manually."
    exit 1
  fi
}

install_deps() {
  log "Checking system dependencies..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y -qq 2>/dev/null || true
  fi
  ensure_pkg curl curl
  ensure_pkg git git
  ensure_pkg ca-certificates ca-certificates
}

install_nodejs() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -v | cut -d. -f1 | tr -d v)" -ge 20 ]]; then
    log "Node.js $(node -v) already installed."
    return 0
  fi
  log "Installing Node.js 20 LTS via NodeSource..."
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y --no-install-recommends \
      -o Dpkg::Options::="--force-overwrite" \
      -o Dpkg::Options::="--force-confdef" \
      -o Dpkg::Options::="--force-confold" \
      nodejs 2>/dev/null || {
      warn "Standard install failed, retrying with --force-all..."
      apt-get install -y -o Dpkg::Options::="--force-all" nodejs
    }
  else
    err "Please install Node.js 20+ manually and re-run."
    exit 1
  fi
}

# ====================================================================
# MENU
# ====================================================================
show_menu() {
  echo -e "  ${BOLD}1)${RESET} Install Panel     — set up the web panel on this VPS"
  echo -e "  ${BOLD}2)${RESET} Install Node      — connect this VPS as a compute node"
  echo -e "  ${BOLD}3)${RESET} Update Panel      — pull latest and rebuild"
  echo -e "  ${BOLD}4)${RESET} Create Admin      — create the first admin account"
  echo -e "  ${BOLD}0)${RESET} Exit"
  echo ""
}

# ====================================================================
# INSTALL PANEL  — clone, npm install, npm build, systemd
# ====================================================================
install_panel() {
  log "=== Installing Gylam Panel ==="
  fix_dpkg
  install_deps
  install_nodejs

  # ── Clone or update ──
  if [[ -d "${PANEL_DIR}/.git" ]]; then
    log "Repository exists at ${PANEL_DIR}, pulling latest..."
    git -C "${PANEL_DIR}" fetch --all
    git -C "${PANEL_DIR}" pull --ff-only || true
  else
    log "Cloning Gylam Panel into ${PANEL_DIR}..."
    mkdir -p "$(dirname "${PANEL_DIR}")"
    git clone "${REPO_URL}" "${PANEL_DIR}"
  fi

  # ── npm install ──
  log "Installing npm dependencies..."
  if [[ -f "${PANEL_DIR}/package-lock.json" ]]; then
    npm --prefix "${PANEL_DIR}" ci --no-audit --no-fund
  else
    npm --prefix "${PANEL_DIR}" install --no-audit --no-fund
  fi

  # ── Configure .env ──
  local env_file="${PANEL_DIR}/.env"
  if [[ -f "${env_file}" ]]; then
    warn ".env already exists — leaving it untouched."
  else
    log "Generating .env from template..."
    if [[ -f "${PANEL_DIR}/.env.example" ]]; then
      cp "${PANEL_DIR}/.env.example" "${env_file}"
    else
      cat > "${env_file}" <<ENVMIN
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PANEL_NAME=Gylam Panel
API_PORT=3001
JWT_SECRET=change-this-secret
ADMIN_BOOTSTRAP_SECRET=gylam-bootstrap
ENVMIN
    fi
    echo ""
    warn "Configure .env now? You can also do it later."
    read -rp "$(echo -e "${CYAN}Configure now? [y/N]: ${RESET}")" configure_now
    if [[ "${configure_now,,}" == "y" ]]; then
      configure_env "${env_file}"
    else
      warn "Edit ${env_file} manually before starting the panel."
    fi
  fi

  # ── Ensure data directory + users.json exist ──
  mkdir -p "${PANEL_DIR}/data"
  if [[ ! -f "${PANEL_DIR}/data/users.json" ]]; then
    echo '{"users":[]}' > "${PANEL_DIR}/data/users.json"
    log "Created data/users.json"
  fi

  # ── npm build ──
  log "Building production bundle..."
  npm --prefix "${PANEL_DIR}" run build

  # ── systemd services (API + web) ──
  install_panel_service

  echo ""
  log "Panel installed successfully!"
  echo ""
  local server_ip
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'server-ip')"
  echo -e "  ${BOLD}Next steps:${RESET}"
  echo -e "   1. Edit  ${CYAN}${env_file}${RESET}  with your config"
  echo -e "   2. Start:  ${CYAN}systemctl start gylam-panel gylam-api${RESET}"
  echo -e "   3. Open:   ${CYAN}http://${server_ip}:8080${RESET}"
  echo -e "   4. Create your admin:  ${CYAN}bash install.sh create-admin${RESET}"
  echo ""
}

configure_env() {
  local env_file="$1"
  echo ""
  prompt JWT_SECRET_INPUT "JWT Secret (for session tokens)" "gylam-$(head -c 8 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9')"
  prompt API_PORT_INPUT "API Port" "3001"

  sed -i \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET_INPUT}|" \
    -e "s|^API_PORT=.*|API_PORT=${API_PORT_INPUT}|" \
    -e "s|^VITE_API_BASE=.*|VITE_API_BASE=http://$(hostname -I 2>/dev/null | awk '{print $1}'):${API_PORT_INPUT}/api|" \
    "${env_file}"
  log ".env configured."
}

install_panel_service() {
  log "Installing systemd services..."

  # API server
  cat > /etc/systemd/system/gylam-api.service <<UNIT
[Unit]
Description=Gylam Panel API Server
After=network.target

[Service]
Type=simple
WorkingDirectory=${PANEL_DIR}
EnvironmentFile=${PANEL_DIR}/.env
ExecStart=$(command -v node) server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT

  # Web frontend (vite preview)
  cat > /etc/systemd/system/gylam-panel.service <<UNIT
[Unit]
Description=Gylam Panel Web Frontend
After=network.target gylam-api.service

[Service]
Type=simple
WorkingDirectory=${PANEL_DIR}
ExecStart=$(command -v npx) vite preview --host 0.0.0.0 --port 8080
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable gylam-api gylam-panel 2>/dev/null || true
  warn "Services installed. Start with: systemctl start gylam-api gylam-panel"
}

# ====================================================================
# INSTALL NODE  — node agent that heartbeats to the panel
# ====================================================================
install_node() {
  log "=== Installing Gylam Node Agent ==="
  fix_dpkg
  install_deps
  install_nodejs

  echo ""
  info "To connect this node to your Gylam Panel, you need:"
  info "  • The Node ID (shown in Admin > Nodes > Connect)"
  info "  • Your panel API URL"
  echo ""

  prompt NODE_ID "Node ID (from panel)"
  prompt PANEL_API "Panel API URL" "http://$(hostname -I 2>/dev/null | awk '{print $1}'):3001"
  prompt NODE_NAME "Node display name" "node-$(hostname)"

  local node_ip
  node_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"
  prompt NODE_IP "IP / Domain for this node" "${node_ip}"

  log "Creating node directory ${NODE_DIR}..."
  mkdir -p "${NODE_DIR}"

  write_node_agent "${NODE_DIR}/agent.mjs"

  cat > "${NODE_DIR}/.env" <<ENVEOF
NODE_ID=${NODE_ID}
PANEL_API=${PANEL_API}
NODE_NAME=${NODE_NAME}
NODE_IP=${NODE_IP}
HEARTBEAT_INTERVAL=30
ENVEOF
  chmod 600 "${NODE_DIR}/.env"

  install_node_service

  log "Starting node agent..."
  systemctl daemon-reload
  systemctl enable gylam-node 2>/dev/null || true
  systemctl restart gylam-node

  echo ""
  log "Node agent installed and started!"
  echo ""
  echo -e "  ${BOLD}Status:${RESET}"
  echo -e "   • Check logs:    ${CYAN}journalctl -u gylam-node -f${RESET}"
  echo -e "   • Restart:       ${CYAN}systemctl restart gylam-node${RESET}"
  echo ""
}

write_node_agent() {
  local agent_file="$1"
  cat > "${agent_file}" <<'AGENTEOF'
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');

function loadEnv() {
  const raw = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const PANEL_API = env.PANEL_API;
const NODE_ID = env.NODE_ID;
const HEARTBEAT_INTERVAL = parseInt(env.HEARTBEAT_INTERVAL || '30', 10) * 1000;

if (!PANEL_API || !NODE_ID) {
  console.error('[gylam-node] Missing PANEL_API or NODE_ID in .env');
  process.exit(1);
}

console.log(`[gylam-node] Agent started. Heartbeat every ${HEARTBEAT_INTERVAL / 1000}s to ${PANEL_API}`);

async function heartbeat(status) {
  try {
    const res = await fetch(`${PANEL_API}/api/nodes/${NODE_ID}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      console.error(`[gylam-node] Heartbeat failed: HTTP ${res.status}`);
      return false;
    }
    console.log(`[gylam-node] Heartbeat OK — ${status}`);
    return true;
  } catch (err) {
    console.error(`[gylam-node] Heartbeat error: ${err.message}`);
    return false;
  }
}

async function loop() {
  while (true) {
    await heartbeat('online');
    await new Promise((r) => setTimeout(r, HEARTBEAT_INTERVAL));
  }
}

async function shutdown() {
  console.log('[gylam-node] Shutting down — marking offline...');
  await heartbeat('offline');
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

loop().catch((err) => {
  console.error('[gylam-node] Fatal:', err);
  process.exit(1);
});
AGENTEOF
  log "Node agent written to ${agent_file}"
}

install_node_service() {
  cat > /etc/systemd/system/gylam-node.service <<UNIT
[Unit]
Description=Gylam Node Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=${NODE_DIR}
EnvironmentFile=${NODE_DIR}/.env
ExecStart=$(command -v node) ${NODE_DIR}/agent.mjs
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
}

# ====================================================================
# UPDATE PANEL  — git pull, npm install, npm build, restart
# ====================================================================
update_panel() {
  log "=== Updating Gylam Panel ==="
  if [[ ! -d "${PANEL_DIR}/.git" ]]; then
    err "Panel not found at ${PANEL_DIR}. Run 'install-panel' first."
    exit 1
  fi
  log "Pulling latest code..."
  git -C "${PANEL_DIR}" fetch --all
  git -C "${PANEL_DIR}" pull --ff-only
  log "Installing dependencies..."
  if [[ -f "${PANEL_DIR}/package-lock.json" ]]; then
    npm --prefix "${PANEL_DIR}" ci --no-audit --no-fund
  else
    npm --prefix "${PANEL_DIR}" install --no-audit --no-fund
  fi
  log "Rebuilding..."
  npm --prefix "${PANEL_DIR}" run build
  log "Restarting services..."
  systemctl restart gylam-api 2>/dev/null || warn "gylam-api not running"
  systemctl restart gylam-panel 2>/dev/null || warn "gylam-panel not running"
  log "Panel updated and restarted."
}

# ====================================================================
# CREATE ADMIN  — writes directly to users.json with is_admin: true
# This bypasses Supabase entirely, using file-based JSON auth.
# ====================================================================
create_admin() {
  log "=== Create Admin Account ==="
  echo ""
  info "This creates an admin account stored in users.json (file-based auth)."
  info "No Supabase required — the admin is saved with is_admin: true."
  echo ""

  local users_file="${PANEL_DIR}/data/users.json"
  if [[ ! -f "${users_file}" ]]; then
    # fallback to local file if running from source
    users_file="$(dirname "$(readlink -f "$0")")/data/users.json"
  fi
  if [[ ! -f "${users_file}" ]]; then
    users_file="./data/users.json"
  fi

  prompt ADMIN_USER "Admin Username" "admin"
  prompt ADMIN_EMAIL "Admin Email" "admin@gylam.panel"

  local admin_pass
  while true; do
    read -rsp "$(echo -e "${CYAN}Admin Password (min 8 chars): ${RESET}")" admin_pass
    echo ""
    if [[ ${#admin_pass} -ge 8 ]]; then break; fi
    warn "Password must be at least 8 characters."
  done

  echo ""
  log "Creating admin account in users.json..."

  # Use Node.js to safely generate the bcrypt hash and write JSON
  node -e "
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const usersFile = '${users_file}';
const username = '${ADMIN_USER}';
const email = '${ADMIN_EMAIL}';
const password = '${admin_pass}';

let data;
try {
  data = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
} catch {
  data = { users: [] };
}
if (!data.users) data.users = [];

// Check if user already exists
const existing = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
if (existing) {
  existing.is_admin = true;
  existing.password_hash = bcrypt.hashSync(password, 10);
  fs.writeFileSync(usersFile, JSON.stringify(data, null, 2));
  console.log('[gylam] Existing user promoted to admin.');
  process.exit(0);
}

const user = {
  id: crypto.randomUUID(),
  username: username,
  email: email.toLowerCase(),
  password_hash: bcrypt.hashSync(password, 10),
  is_admin: true,
  created_at: new Date().toISOString()
};

data.users.push(user);
fs.writeFileSync(usersFile, JSON.stringify(data, null, 2));
console.log('[gylam] Admin account created successfully.');
" --deps-dir "${PANEL_DIR}/node_modules" 2>&1 || {
    # If bcryptjs isn't available, try with the panel's node_modules
    warn "Trying with panel node_modules..."
    if [[ -d "${PANEL_DIR}/node_modules" ]]; then
      NODE_PATH="${PANEL_DIR}/node_modules" node -e "
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const usersFile = '${users_file}';
let data;
try { data = JSON.parse(fs.readFileSync(usersFile, 'utf-8')); } catch { data = { users: [] }; }
if (!data.users) data.users = [];
const existing = data.users.find(u => u.email.toLowerCase() === '${ADMIN_EMAIL}'.toLowerCase());
if (existing) {
  existing.is_admin = true;
  existing.password_hash = bcrypt.hashSync('${admin_pass}', 10);
  fs.writeFileSync(usersFile, JSON.stringify(data, null, 2));
  console.log('[gylam] Existing user promoted to admin.');
  process.exit(0);
}
data.users.push({
  id: crypto.randomUUID(),
  username: '${ADMIN_USER}',
  email: '${ADMIN_EMAIL}'.toLowerCase(),
  password_hash: bcrypt.hashSync('${admin_pass}', 10),
  is_admin: true,
  created_at: new Date().toISOString()
});
fs.writeFileSync(usersFile, JSON.stringify(data, null, 2));
console.log('[gylam] Admin account created successfully.');
"
    else
      err "Could not find bcryptjs. Run 'npm install' in ${PANEL_DIR} first."
      exit 1
    fi
  }

  echo ""
  echo -e "  ${BOLD}Admin account created:${RESET}"
  echo -e "   Username: ${CYAN}${ADMIN_USER}${RESET}"
  echo -e "   Email:    ${CYAN}${ADMIN_EMAIL}${RESET}"
  echo -e "   File:     ${CYAN}${users_file}${RESET}"
  echo -e "   is_admin: ${GREEN}true${RESET}"
  echo ""
  warn "Restart the API server to pick up the new account:"
  echo -e "   systemctl restart gylam-api"
  echo ""
}

# ====================================================================
# MAIN
# ====================================================================
main() {
  banner
  check_root

  local cmd="${1:-}"

  if [[ -n "$cmd" ]]; then
    case "$cmd" in
      install-panel) install_panel ;;
      install-node)  install_node ;;
      update-panel)  update_panel ;;
      create-admin)  create_admin ;;
      *) err "Unknown command: $cmd"; show_menu; exit 1 ;;
    esac
    exit 0
  fi

  while true; do
    show_menu
    read -rp "$(echo -e "${CYAN}Choose an option [0-4]: ${RESET}")" choice
    case "$choice" in
      1) install_panel; break ;;
      2) install_node; break ;;
      3) update_panel; break ;;
      4) create_admin; break ;;
      0) echo "Bye."; exit 0 ;;
      *) warn "Invalid option." ;;
    esac
  done
}

main "$@"
