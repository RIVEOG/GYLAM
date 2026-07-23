#!/usr/bin/env bash
#
# Gylam Panel — Installer
# Made with Nethost Team.
#
# Usage:
#   bash install.sh                      # interactive menu
#   bash install.sh install-panel        # install the web panel
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
# function repairs any interrupted dpkg state and pre-empts the error.
fix_dpkg() {
  export DEBIAN_FRONTEND=noninteractive
  # Repair any half-installed packages from a previous failed run
  dpkg --configure -a 2>/dev/null || true
  apt-get install -y --fix-broken 2>/dev/null || true
}

# ── Install a single apt package only if the command is missing ────
# This avoids the cross-device link error entirely for packages that
# are already installed (dpkg only fails on UPGRADES in that scenario).
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
      apt-get install -y --no-install-recommends \
        -o Dpkg::Options::="--force-all" "$pkg"
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
# INSTALL PANEL  — clone files, npm install, npm build, systemd
# ====================================================================
install_panel() {
  log "=== Installing Gylam Panel ==="
  fix_dpkg
  install_deps
  install_nodejs

  # ── Clone or update the repo ──
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
      # repo may not ship .env.example — create a minimal one
      cat > "${env_file}" <<ENVMIN
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_ADMIN_EMAIL=admin@gylam.panel
VITE_ADMIN_PASSWORD=changeme123
VITE_ADMIN_USERNAME=admin
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

  # ── npm build ──
  log "Building production bundle..."
  npm --prefix "${PANEL_DIR}" run build

  # ── systemd service ──
  install_panel_service

  echo ""
  log "Panel installed successfully!"
  echo ""
  local server_ip
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'server-ip')"
  echo -e "  ${BOLD}Next steps:${RESET}"
  echo -e "   1. Edit  ${CYAN}${env_file}${RESET}  with your Supabase + admin config"
  echo -e "   2. Start:  ${CYAN}systemctl start gylam-panel${RESET}"
  echo -e "   3. Open:   ${CYAN}http://${server_ip}:8080${RESET}"
  echo -e "   4. Create your admin:  ${CYAN}bash install.sh create-admin${RESET}"
  echo ""
}

configure_env() {
  local env_file="$1"
  echo ""
  info "Enter your Supabase credentials (from your Supabase project settings):"
  prompt SUP_URL "Supabase URL"
  prompt SUP_ANON "Supabase Anon Key"
  prompt SUP_SERVICE "Supabase Service Role Key"

  echo ""
  info "Enter the first admin account:"
  prompt ADMIN_EMAIL "Admin Email" "admin@gylam.panel"
  prompt ADMIN_USER "Admin Username" "admin"

  local admin_pass
  while true; do
    read -rsp "$(echo -e "${CYAN}Admin Password (min 8 chars): ${RESET}")" admin_pass
    echo ""
    if [[ ${#admin_pass} -ge 8 ]]; then break; fi
    warn "Password must be at least 8 characters."
  done

  sed -i \
    -e "s|^VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=${SUP_URL}|" \
    -e "s|^VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=${SUP_ANON}|" \
    -e "s|^SUPABASE_URL=.*|SUPABASE_URL=${SUP_URL}|" \
    -e "s|^SUPABASE_ANON_KEY=.*|SUPABASE_ANON_KEY=${SUP_ANON}|" \
    -e "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${SUP_SERVICE}|" \
    -e "s|^VITE_ADMIN_EMAIL=.*|VITE_ADMIN_EMAIL=${ADMIN_EMAIL}|" \
    -e "s|^VITE_ADMIN_PASSWORD=.*|VITE_ADMIN_PASSWORD=${admin_pass}|" \
    -e "s|^VITE_ADMIN_USERNAME=.*|VITE_ADMIN_USERNAME=${ADMIN_USER}|" \
    "${env_file}"
  log ".env configured."
}

install_panel_service() {
  local svc="/etc/systemd/system/gylam-panel.service"
  log "Installing systemd service..."
  cat > "${svc}" <<UNIT
[Unit]
Description=Gylam Panel — Game Server Management
After=network.target

[Service]
Type=simple
WorkingDirectory=${PANEL_DIR}
EnvironmentFile=${PANEL_DIR}/.env
ExecStart=$(command -v npx) vite preview --host 0.0.0.0 --port 8080
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable gylam-panel 2>/dev/null || true
  warn "Service installed. Start with: systemctl start gylam-panel"
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
  info "  • The Node ID    (shown in Admin > Nodes > Connect)"
  info "  • The Node Token (generated in the same place)"
  info "  • Your Supabase URL and Anon Key"
  echo ""

  prompt NODE_ID "Node ID (from panel)"
  prompt NODE_TOKEN "Node Token (from panel)"
  prompt SUP_URL_NODE "Supabase URL"
  prompt SUP_ANON_NODE "Supabase Anon Key"
  prompt NODE_NAME "Node display name" "node-$(hostname)"

  local node_ip
  node_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"
  prompt NODE_IP "IP / Domain for this node" "${node_ip}"

  log "Creating node directory ${NODE_DIR}..."
  mkdir -p "${NODE_DIR}"

  write_node_agent "${NODE_DIR}/agent.mjs"

  cat > "${NODE_DIR}/.env" <<ENVEOF
NODE_ID=${NODE_ID}
NODE_TOKEN=${NODE_TOKEN}
SUPABASE_URL=${SUP_URL_NODE}
SUPABASE_ANON_KEY=${SUP_ANON_NODE}
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
  echo -e "   • The panel should now show this node as ${GREEN}online${RESET}"
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
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
const NODE_TOKEN = env.NODE_TOKEN;
const HEARTBEAT_INTERVAL = parseInt(env.HEARTBEAT_INTERVAL || '30', 10) * 1000;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !NODE_TOKEN) {
  console.error('[gylam-node] Missing SUPABASE_URL, SUPABASE_ANON_KEY, or NODE_TOKEN in .env');
  process.exit(1);
}

console.log(`[gylam-node] Agent started. Heartbeat every ${HEARTBEAT_INTERVAL / 1000}s`);

async function heartbeat(status) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/node_heartbeat`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_token: NODE_TOKEN, p_status: status }),
    });
    if (!res.ok) {
      console.error(`[gylam-node] Heartbeat failed: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`[gylam-node] Heartbeat error: ${err.message}`);
    return null;
  }
}

async function loop() {
  while (true) {
    const id = await heartbeat('online');
    if (id) {
      console.log(`[gylam-node] Heartbeat OK (node ${id}) — online`);
    } else {
      console.error('[gylam-node] Heartbeat rejected — check NODE_TOKEN');
    }
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
  local svc="/etc/systemd/system/gylam-node.service"
  log "Installing systemd service for node agent..."
  cat > "${svc}" <<UNIT
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
  log "Restarting service..."
  systemctl restart gylam-panel 2>/dev/null || warn "Service not running — start with: systemctl start gylam-panel"
  log "Panel updated and restarted."
}

# ====================================================================
# CREATE ADMIN  — calls Supabase bootstrap_admin RPC
# ====================================================================
create_admin() {
  log "=== Create Admin Account ==="

  local sup_url sup_service
  if [[ -f "${PANEL_DIR}/.env" ]]; then
    sup_url="$(grep -m1 '^SUPABASE_URL=' "${PANEL_DIR}/.env" | cut -d= -f2- || true)"
    sup_service="$(grep -m1 '^SUPABASE_SERVICE_ROLE_KEY=' "${PANEL_DIR}/.env" | cut -d= -f2- || true)"
  fi

  if [[ -z "${sup_url}" ]]; then
    prompt sup_url "Supabase URL"
  else
    info "Using SUPABASE_URL from .env"
  fi
  if [[ -z "${sup_service}" ]]; then
    prompt sup_service "Supabase Service Role Key"
  else
    info "Using SUPABASE_SERVICE_ROLE_KEY from .env"
  fi

  echo ""
  prompt ADMIN_EMAIL "Admin Email" "admin@gylam.panel"
  prompt ADMIN_USER "Admin Username" "admin"

  local admin_pass
  while true; do
    read -rsp "$(echo -e "${CYAN}Admin Password (min 8 chars): ${RESET}")" admin_pass
    echo ""
    if [[ ${#admin_pass} -ge 8 ]]; then break; fi
    warn "Password must be at least 8 characters."
  done

  echo ""
  log "Creating admin account via Supabase..."
  local response http_code body
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${sup_url}/rest/v1/rpc/bootstrap_admin" \
    -H "Content-Type: application/json" \
    -H "apikey: ${sup_service}" \
    -H "Authorization: Bearer ${sup_service}" \
    -d "{\"p_email\": \"${ADMIN_EMAIL}\", \"p_password\": \"${admin_pass}\", \"p_username\": \"${ADMIN_USER}\"}")

  http_code="$(echo "$response" | tail -1)"
  body="$(echo "$response" | sed '$d')"

  if [[ "${http_code}" == "200" ]] && [[ "$body" != "null" ]]; then
    log "Admin account created successfully!"
    echo ""
    echo -e "  ${BOLD}Admin credentials:${RESET}"
    echo -e "   Email:    ${CYAN}${ADMIN_EMAIL}${RESET}"
    echo -e "   Username: ${CYAN}${ADMIN_USER}${RESET}"
    echo -e "   You can now sign in at the panel."
    echo ""
    warn "Add these to your .env for persistence:"
    echo -e "   VITE_ADMIN_EMAIL=${ADMIN_EMAIL}"
    echo -e "   VITE_ADMIN_USERNAME=${ADMIN_USER}"
  else
    err "Failed to create admin (HTTP ${http_code})."
    err "Response: ${body}"
    err "Check your Supabase URL and Service Role Key."
    exit 1
  fi
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
