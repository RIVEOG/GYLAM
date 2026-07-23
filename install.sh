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
#   bash install.sh delete-panel         # completely remove the panel + node
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

# Directory this script lives in — the panel source files sit next to it.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
fix_dpkg() {
  export DEBIAN_FRONTEND=noninteractive
  dpkg --configure -a 2>/dev/null || true
  apt-get install -y --fix-broken 2>/dev/null || true
}

# ── Install a single package only if the command is missing ────────
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
  ensure_pkg ca-certificates ca-certificates
  # git is optional now — only needed for update-panel / remote clone fallback
  ensure_pkg git git
}

# ── Check + install Node.js and npm ────────────────────────────────
ensure_node_and_npm() {
  local need_install=false

  if ! command -v node >/dev/null 2>&1; then
    need_install=true
    warn "Node.js is not installed."
  elif [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
    need_install=true
    warn "Node.js version is too old ($(node -v)). Need v20+."
  fi

  if ! command -v npm >/dev/null 2>&1; then
    need_install=true
    warn "npm is not installed."
  fi

  if [[ "$need_install" == "true" ]]; then
    log "Installing Node.js 20 LTS (includes npm) via NodeSource..."
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
      err "Please install Node.js 20+ (with npm) manually and re-run."
      exit 1
    fi
  fi

  if ! command -v node >/dev/null 2>&1; then
    err "Node.js installation failed. Please install it manually."
    exit 1
  fi
  if ! command -v npm >/dev/null 2>&1; then
    err "npm installation failed. Please install it manually."
    exit 1
  fi
  log "Node.js $(node -v) and npm $(npm -v) are ready."
}

# ── Copy panel source from the directory this script lives in ──────
# This avoids relying on git clone (which can fail on some VPS images
# with broken git remote helpers / Rust-based git wrappers).
copy_panel_source() {
  local dest="$1"

  # The panel source is the folder containing install.sh.
  local src="${SCRIPT_DIR}"

  # Sanity check: does the source actually contain the panel files?
  if [[ ! -f "${src}/package.json" ]] || [[ ! -d "${src}/server" ]]; then
    warn "Panel source files not found next to install.sh (${src})."
    warn "Falling back to git clone from ${REPO_URL}..."
    git_clone_fallback "${dest}"
    return $?
  fi

  log "Copying panel files from ${src} to ${dest}..."
  mkdir -p "$(dirname "${dest}")"

  # rsync if available (fast, excludes junk), otherwise cp -a
  if command -v rsync >/dev/null 2>&1; then
    rsync -a \
      --exclude='node_modules' \
      --exclude='dist' \
      --exclude='.git' \
      --exclude='*.log' \
      "${src}/" "${dest}/"
  else
    cp -a "${src}/." "${dest}/"
    # Clean up junk that cp can't exclude
    rm -rf "${dest}/node_modules" "${dest}/dist" "${dest}/.git" 2>/dev/null || true
  fi

  log "Panel files copied."
  return 0
}

# ── Fallback: try git clone (with error handling for broken git) ───
git_clone_fallback() {
  local dest="$1"

  if ! command -v git >/dev/null 2>&1; then
    err "git is not installed and no local panel source was found."
    err "Please place the panel files next to install.sh and re-run."
    exit 1
  fi

  log "Attempting git clone of ${REPO_URL}..."
  if git clone "${REPO_URL}" "${dest}" 2>&1; then
    log "Clone succeeded."
    return 0
  fi

  # git clone failed — could be the broken Rust git helper panic,
  # a non-existent repo, or network issues.
  err "git clone failed."
  err ""
  err "Common causes:"
  err "  • The repository URL is a placeholder and doesn't exist yet."
  err "  • A broken git remote helper (Rust panic) on this VPS image."
  err ""
  err "Fix: place the panel source files (package.json, server/, src/, etc.)"
  err "     in the same folder as install.sh, then re-run."
  err "     The installer will copy them locally instead of cloning."
  exit 1
}

# ====================================================================
# MENU
# ====================================================================
show_menu() {
  echo -e "  ${BOLD}1)${RESET} Install Panel     — set up the web panel on this VPS"
  echo -e "  ${BOLD}2)${RESET} Install Node      — connect this VPS as a compute node"
  echo -e "  ${BOLD}3)${RESET} Update Panel      — pull latest and rebuild"
  echo -e "  ${BOLD}4)${RESET} Create Admin      — create the first admin account"
  echo -e "  ${BOLD}5)${RESET} ${RED}Delete Panel${RESET}     — ${RED}completely remove the panel + node${RESET}"
  echo -e "  ${BOLD}0)${RESET} Exit"
  echo ""
}

# ====================================================================
# INSTALL PANEL
# ====================================================================
install_panel() {
  log "=== Installing Gylam Panel ==="
  fix_dpkg
  install_deps
  ensure_node_and_npm

  # ── Get the panel source onto disk ──
  # First try copying from the local directory (robust, no git needed).
  # Falls back to git clone only if local files are missing.
  if [[ -d "${PANEL_DIR}" && -f "${PANEL_DIR}/package.json" ]]; then
    log "Panel already exists at ${PANEL_DIR} — updating in place."
    copy_panel_source "${PANEL_DIR}"
  else
    copy_panel_source "${PANEL_DIR}"
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
VITE_PANEL_NAME=Gylam Panel
API_PORT=3001
JWT_SECRET=change-this-secret
ADMIN_BOOTSTRAP_SECRET=gylam-bootstrap
VITE_API_BASE=/api
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

  # ── Start the API server (background) ──
  log "Starting API server on port 3001..."
  cd "${PANEL_DIR}"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 3001/tcp 2>/dev/null || true
  fi
  nohup node server/index.js > /var/log/gylam-api.log 2>&1 &
  local api_pid=$!
  log "API server started (PID ${api_pid})."

  # ── npm run dev — starts the Vite dev server on port 8080 ──
  echo ""
  log "Starting the panel in dev mode (npm run dev)..."
  log "The panel will be available on port 8080."
  echo ""

  install_panel_service

  if systemctl is-system-running >/dev/null 2>&1; then
    log "Starting services via systemd..."
    systemctl daemon-reload
    systemctl enable gylam-api gylam-panel-dev 2>/dev/null || true
    systemctl restart gylam-api 2>/dev/null || true
    systemctl restart gylam-panel-dev 2>/dev/null || true
    log "Services started via systemd."
  else
    warn "systemd not available — panel is running in the background."
    warn "To start manually: cd ${PANEL_DIR} && npm run dev"
  fi

  echo ""
  log "Panel installed and running!"
  echo ""
  local server_ip
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'server-ip')"
  echo -e "  ${BOLD}Access your panel:${RESET}"
  echo -e "   ${CYAN}http://${server_ip}:8080${RESET}"
  echo ""
  echo -e "  ${BOLD}Next steps:${RESET}"
  echo -e "   1. Open the URL above in your browser"
  echo -e "   2. Create your admin account:  ${CYAN}bash install.sh create-admin${RESET}"
  echo ""
  echo -e "  ${BOLD}Manage services:${RESET}"
  echo -e "   • Restart panel:  ${CYAN}systemctl restart gylam-panel-dev${RESET}"
  echo -e "   • Restart API:    ${CYAN}systemctl restart gylam-api${RESET}"
  echo -e "   • View logs:      ${CYAN}journalctl -u gylam-panel-dev -f${RESET}"
  echo ""
}

configure_env() {
  local env_file="$1"
  echo ""
  prompt JWT_SECRET_INPUT "JWT Secret (for session tokens — just press Enter to use the auto-generated one)" "gylam-$(head -c 8 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9')"
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

  cat > /etc/systemd/system/gylam-panel-dev.service <<UNIT
[Unit]
Description=Gylam Panel Web Frontend (dev mode)
After=network.target gylam-api.service

[Service]
Type=simple
WorkingDirectory=${PANEL_DIR}
ExecStart=$(command -v npm) run dev
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=development

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
}

# ====================================================================
# INSTALL NODE
# ====================================================================
install_node() {
  log "=== Installing Gylam Node Agent ==="
  fix_dpkg
  install_deps
  ensure_node_and_npm

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
# UPDATE PANEL
# ====================================================================
update_panel() {
  log "=== Updating Gylam Panel ==="
  if [[ ! -d "${PANEL_DIR}" ]]; then
    err "Panel not found at ${PANEL_DIR}. Run 'install-panel' first."
    exit 1
  fi
  ensure_node_and_npm

  # Re-copy from local source (same robust approach as install)
  log "Updating panel files from ${SCRIPT_DIR}..."
  copy_panel_source "${PANEL_DIR}"

  log "Installing dependencies..."
  if [[ -f "${PANEL_DIR}/package-lock.json" ]]; then
    npm --prefix "${PANEL_DIR}" ci --no-audit --no-fund
  else
    npm --prefix "${PANEL_DIR}" install --no-audit --no-fund
  fi

  log "Restarting services (npm run dev)..."
  systemctl restart gylam-api 2>/dev/null || warn "gylam-api not running"
  systemctl restart gylam-panel-dev 2>/dev/null || warn "gylam-panel-dev not running"
  log "Panel updated and restarted."
}

# ====================================================================
# CREATE ADMIN
# ====================================================================
create_admin() {
  log "=== Create Admin Account ==="
  echo ""
  info "This creates an admin account stored in users.json (file-based auth)."
  info "No Supabase required — the admin is saved with is_admin: true."
  echo ""

  local users_file="${PANEL_DIR}/data/users.json"
  if [[ ! -f "${users_file}" ]]; then
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

  node -e "
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
" 2>&1 || {
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
# DELETE PANEL
# ====================================================================
delete_panel() {
  echo ""
  err "============================================"
  err "  WARNING: THIS WILL DELETE EVERYTHING!"
  err "============================================"
  echo ""
  echo -e "  This will permanently remove:"
  echo -e "   • The panel web frontend + API server"
  echo -e "   • All user accounts and data"
  echo -e "   • The node agent (if installed)"
  echo -e "   • All systemd services"
  echo -e "   • All log files"
  echo ""
  echo -e "  ${BOLD}Directories to be deleted:${RESET}"
  echo -e "   ${RED}${PANEL_DIR}${RESET}"
  echo -e "   ${RED}${NODE_DIR}${RESET}"
  echo ""
  echo -e "  ${BOLD}This action CANNOT be undone.${RESET}"
  echo ""

  prompt CONFIRM_DELETE "Type 'yes' to confirm deletion" ""
  if [[ "${CONFIRM_DELETE}" != "yes" ]]; then
    warn "Deletion cancelled — nothing was removed."
    exit 0
  fi

  echo ""
  prompt CONFIRM2 "Are you absolutely sure? Type 'DELETE' to proceed" ""
  if [[ "${CONFIRM2}" != "DELETE" ]]; then
    warn "Deletion cancelled — nothing was removed."
    exit 0
  fi

  echo ""
  log "=== Deleting Gylam Panel ==="

  log "Stopping systemd services..."
  for svc in gylam-panel-dev gylam-api gylam-node; do
    if systemctl list-unit-files 2>/dev/null | grep -q "${svc}"; then
      systemctl stop "${svc}" 2>/dev/null || true
      systemctl disable "${svc}" 2>/dev/null || true
      log "Stopped + disabled ${svc}"
    fi
  done

  log "Removing systemd unit files..."
  for unit in \
    /etc/systemd/system/gylam-api.service \
    /etc/systemd/system/gylam-panel-dev.service \
    /etc/systemd/system/gylam-node.service; do
    if [[ -f "${unit}" ]]; then
      rm -f "${unit}"
      log "Removed ${unit}"
    fi
  done
  systemctl daemon-reload 2>/dev/null || true

  log "Killing any lingering Gylam processes..."
  pkill -f "gylam" 2>/dev/null || true
  pkill -f "server/index.js" 2>/dev/null || true
  pkill -f "gylam-node/agent.mjs" 2>/dev/null || true
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 3001/tcp 2>/dev/null || true
    fuser -k 8080/tcp 2>/dev/null || true
  fi

  log "Removing panel directory..."
  if [[ -d "${PANEL_DIR}" ]]; then
    rm -rf "${PANEL_DIR}"
    log "Removed ${PANEL_DIR}"
  else
    warn "Panel directory not found at ${PANEL_DIR}"
  fi

  log "Removing node directory..."
  if [[ -d "${NODE_DIR}" ]]; then
    rm -rf "${NODE_DIR}"
    log "Removed ${NODE_DIR}"
  else
    warn "Node directory not found at ${NODE_DIR}"
  fi

  log "Removing log files..."
  rm -f /var/log/gylam-api.log 2>/dev/null && log "Removed /var/log/gylam-api.log" || true
  rm -f /var/log/gylam-panel.log 2>/dev/null || true
  rm -f /var/log/gylam-node.log 2>/dev/null || true

  echo ""
  log "=== Gylam Panel has been completely deleted ==="
  echo ""
  echo -e "  ${BOLD}Removed:${RESET}"
  echo -e "   • Panel directory:  ${PANEL_DIR}"
  echo -e "   • Node directory:   ${NODE_DIR}"
  echo -e "   • systemd services: gylam-api, gylam-panel-dev, gylam-node"
  echo -e "   • Log files:        /var/log/gylam-*.log"
  echo ""
  echo -e "  ${BOLD}Note:${RESET} Node.js and npm were ${BOLD}not${RESET} removed."
  echo -e "  To remove them too:  ${CYAN}apt-get purge -y nodejs && apt-get autoremove -y${RESET}"
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
      delete-panel)  delete_panel ;;
      *) err "Unknown command: $cmd"; show_menu; exit 1 ;;
    esac
    exit 0
  fi

  while true; do
    show_menu
    read -rp "$(echo -e "${CYAN}Choose an option [0-5]: ${RESET}")" choice
    case "$choice" in
      1) install_panel; break ;;
      2) install_node; break ;;
      3) update_panel; break ;;
      4) create_admin; break ;;
      5) delete_panel; break ;;
      0) echo "Bye."; exit 0 ;;
      *) warn "Invalid option." ;;
    esac
  done
}

main "$@"
