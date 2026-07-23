#!/usr/bin/env bash
#
# Gylam Panel — Installer
# Made with Nethost Team.
#
# Usage:
#   bash install.sh                      # interactive menu
#   bash install.sh install-panel        # install the web panel on this VPS
#   bash install.sh install-node         # connect this VPS as a compute node
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

# ── Resolve the directory containing the panel source files ────────
# When piped via `curl | bash`, BASH_SOURCE resolves to /proc/self/fd
# or /dev/fd — not a real directory. Fall back to $PWD in that case.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
if [[ "${SCRIPT_DIR}" == /proc/* || "${SCRIPT_DIR}" == /dev/fd* || ! -d "${SCRIPT_DIR}" ]]; then
  SCRIPT_DIR="$(pwd)"
fi
export SCRIPT_DIR

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

# ── Find the panel source directory ────────────────────────────────
# Checks SCRIPT_DIR first (files next to install.sh), then PWD.
# This handles both `bash install.sh` and `curl | bash` invocations.
find_source_dir() {
  local dir="${SCRIPT_DIR}"

  if [[ -f "${dir}/package.json" ]] && [[ -d "${dir}/server" ]]; then
    echo "${dir}"
    return 0
  fi

  dir="$(pwd)"
  if [[ -f "${dir}/package.json" ]] && [[ -d "${dir}/server" ]]; then
    echo "${dir}"
    return 0
  fi

  return 1
}

# ── Copy panel source ──────────────────────────────────────────────
copy_panel_source() {
  local dest="$1"
  local src
  src="$(find_source_dir)" || {
    err "Panel source files not found."
    err "Looked in: ${SCRIPT_DIR} and $(pwd)"
    err ""
    err "Please place the panel files (package.json, server/, src/, etc.)"
    err "in the same folder as install.sh and re-run."
    err ""
    err "Or run install.sh from the directory containing the panel files."
    exit 1
  }

  log "Copying panel files from ${src} to ${dest}..."
  mkdir -p "$(dirname "${dest}")"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a \
      --exclude='node_modules' \
      --exclude='dist' \
      --exclude='.git' \
      --exclude='*.log' \
      "${src}/" "${dest}/"
  else
    cp -a "${src}/." "${dest}/"
    rm -rf "${dest}/node_modules" "${dest}/dist" "${dest}/.git" 2>/dev/null || true
  fi
  log "Panel files copied."
}

# ====================================================================
# MENU
# ====================================================================
show_menu() {
  echo -e "  ${BOLD}1)${RESET} Install Panel     — set up the web panel on this VPS"
  echo -e "  ${BOLD}2)${RESET} Install Node      — connect this VPS as a compute node"
  echo -e "  ${BOLD}3)${RESET} Create Admin      — create the first admin account"
  echo -e "  ${BOLD}4)${RESET} ${RED}Delete Panel${RESET}     — ${RED}completely remove the panel + node${RESET}"
  echo -e "  ${BOLD}0)${RESET} Exit"
  echo ""
}

# ====================================================================
# INSTALL PANEL
# ====================================================================
install_panel() {
  log "=== Installing Gylam Panel ==="
  export DEBIAN_FRONTEND=noninteractive
  dpkg --configure -a 2>/dev/null || true
  apt-get install -y --fix-broken 2>/dev/null || true

  log "Installing npm..."
  if ! command -v npm >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      apt-get update -y -qq 2>/dev/null || true
      apt-get install -y --no-install-recommends \
        -o Dpkg::Options::="--force-overwrite" \
        -o Dpkg::Options::="--force-confdef" \
        -o Dpkg::Options::="--force-confold" \
        npm 2>/dev/null || {
        warn "npm not in apt — installing Node.js 20 LTS via NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y --no-install-recommends nodejs
      }
    else
      err "Please install npm manually and re-run."
      exit 1
    fi
  fi
  log "npm $(npm -v) is ready."

  # ── Copy panel source ──
  copy_panel_source "${PANEL_DIR}"

  # ── npm install ──
  log "Installing dependencies..."
  npm --prefix "${PANEL_DIR}" install --no-audit --no-fund

  # ── Ensure data files exist ──
  mkdir -p "${PANEL_DIR}/data"
  [[ -f "${PANEL_DIR}/data/users.json" ]] || echo '{"users":[]}' > "${PANEL_DIR}/data/users.json"
  [[ -f "${PANEL_DIR}/data/nodes.json" ]] || echo '{"nodes":[]}' > "${PANEL_DIR}/data/nodes.json"

  # ── Install systemd service (runs npm run dev on port 8080) ──
  install_panel_service

  if systemctl is-system-running >/dev/null 2>&1; then
    log "Starting panel via systemd..."
    systemctl daemon-reload
    systemctl enable gylam-panel 2>/dev/null || true
    systemctl restart gylam-panel
    log "Panel started."
  else
    warn "systemd not available — starting in background..."
    cd "${PANEL_DIR}"
    nohup npm run dev > /var/log/gylam-panel.log 2>&1 &
    log "Panel started (PID $!)."
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
  echo -e "  ${BOLD}Manage the panel:${RESET}"
  echo -e "   • Restart:  ${CYAN}systemctl restart gylam-panel${RESET}"
  echo -e "   • Logs:     ${CYAN}journalctl -u gylam-panel -f${RESET}"
  echo ""
  echo -e "  ${BOLD}Or run manually:${RESET}"
  echo -e "   cd ${PANEL_DIR} && npm run dev"
  echo ""
}

install_panel_service() {
  log "Installing systemd service..."
  cat > /etc/systemd/system/gylam-panel.service <<UNIT
[Unit]
Description=Gylam Panel (dev server on port 8080)
After=network.target

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
  export DEBIAN_FRONTEND=noninteractive

  if ! command -v node >/dev/null 2>&1; then
    err "Node.js is not installed on this VPS."
    err "Install it first:  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"
    exit 1
  fi

  echo ""
  info "To connect this node to your Gylam Panel, you need:"
  info "  • The Node ID (shown in Admin > Nodes > Connect)"
  info "  • Your panel URL (e.g. http://panel-ip:8080)"
  echo ""

  prompt NODE_ID "Node ID (from panel)"
  prompt PANEL_URL "Panel URL" "http://$(hostname -I 2>/dev/null | awk '{print $1}'):8080"
  prompt NODE_NAME "Node display name" "node-$(hostname)"

  local node_ip
  node_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"
  prompt NODE_IP "IP / Domain for this node" "${node_ip}"

  log "Creating node directory ${NODE_DIR}..."
  mkdir -p "${NODE_DIR}"

  write_node_agent "${NODE_DIR}/agent.mjs"

  cat > "${NODE_DIR}/.env" <<ENVEOF
NODE_ID=${NODE_ID}
PANEL_URL=${PANEL_URL}
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
const PANEL_URL = env.PANEL_URL;
const NODE_ID = env.NODE_ID;
const HEARTBEAT_INTERVAL = parseInt(env.HEARTBEAT_INTERVAL || '30', 10) * 1000;

if (!PANEL_URL || !NODE_ID) {
  console.error('[gylam-node] Missing PANEL_URL or NODE_ID in .env');
  process.exit(1);
}

console.log(`[gylam-node] Agent started. Heartbeat every ${HEARTBEAT_INTERVAL / 1000}s to ${PANEL_URL}`);

async function heartbeat(status) {
  try {
    const res = await fetch(`${PANEL_URL}/api/nodes/${NODE_ID}/heartbeat`, {
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
# CREATE ADMIN
# ====================================================================
create_admin() {
  log "=== Create Admin Account ==="
  echo ""
  info "This creates an admin account stored in the panel's users.json."
  echo ""

  local users_file="${PANEL_DIR}/data/users.json"
  if [[ ! -f "${users_file}" ]]; then
    local src_dir
    src_dir="$(find_source_dir 2>/dev/null || echo "${SCRIPT_DIR}")"
    users_file="${src_dir}/data/users.json"
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
  log "Creating admin account..."

  local node_path="${PANEL_DIR}/node_modules"
  if [[ ! -d "${node_path}" ]]; then
    node_path="${SCRIPT_DIR}/node_modules"
  fi

  NODE_PATH="${node_path}" node -e "
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

  echo ""
  echo -e "  ${BOLD}Admin account created:${RESET}"
  echo -e "   Username: ${CYAN}${ADMIN_USER}${RESET}"
  echo -e "   Email:    ${CYAN}${ADMIN_EMAIL}${RESET}"
  echo ""
  warn "Restart the panel to pick up the new account:"
  echo -e "   systemctl restart gylam-panel"
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
  echo -e "   • The panel web frontend + API"
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
  for svc in gylam-panel gylam-node; do
    if systemctl list-unit-files 2>/dev/null | grep -q "${svc}"; then
      systemctl stop "${svc}" 2>/dev/null || true
      systemctl disable "${svc}" 2>/dev/null || true
      log "Stopped + disabled ${svc}"
    fi
  done

  log "Removing systemd unit files..."
  for unit in \
    /etc/systemd/system/gylam-panel.service \
    /etc/systemd/system/gylam-node.service; do
    if [[ -f "${unit}" ]]; then
      rm -f "${unit}"
      log "Removed ${unit}"
    fi
  done
  systemctl daemon-reload 2>/dev/null || true

  log "Killing any lingering Gylam processes..."
  pkill -f "gylam" 2>/dev/null || true
  if command -v fuser >/dev/null 2>&1; then
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
  rm -f /var/log/gylam-panel.log 2>/dev/null && log "Removed /var/log/gylam-panel.log" || true
  rm -f /var/log/gylam-api.log 2>/dev/null || true
  rm -f /var/log/gylam-node.log 2>/dev/null || true

  echo ""
  log "=== Gylam Panel has been completely deleted ==="
  echo ""
  echo -e "  ${BOLD}Removed:${RESET}"
  echo -e "   • Panel directory:  ${PANEL_DIR}"
  echo -e "   • Node directory:   ${NODE_DIR}"
  echo -e "   • systemd services: gylam-panel, gylam-node"
  echo -e "   • Log files:        /var/log/gylam-*.log"
  echo ""
  echo -e "  ${BOLD}Note:${RESET} Node.js and npm were ${BOLD}not${RESET} removed."
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
      create-admin)  create_admin ;;
      delete-panel)  delete_panel ;;
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
      3) create_admin; break ;;
      4) delete_panel; break ;;
      0) echo "Bye."; exit 0 ;;
      *) warn "Invalid option." ;;
    esac
  done
}

main "$@"
