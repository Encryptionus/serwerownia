#!/bin/bash
# Provisioning kiosku na świeżym, minimalnym Debianie 13.
# Uruchamiać jako root (lub przez sudo) na maszynie docelowej. Skrypt jest idempotentny.
#
#   sudo ./provision.sh serwerownia-dist.tar.gz
#
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

HERE="$(cd "$(dirname "$0")" && pwd)"
KIOSK_USER="kiosk"
WEBROOT="/var/www/serwerownia"
BUNDLE="${1:-$HERE/serwerownia-dist.tar.gz}"

[ -f "$BUNDLE" ] || { echo "Brak paczki z aplikacją: $BUNDLE" >&2; exit 1; }

echo "==> Pakiety"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
    xserver-xorg-core \
    xserver-xorg-input-libinput \
    xserver-xorg-video-fbdev \
    xinit \
    x11-xserver-utils \
    openbox \
    unclutter \
    chromium \
    nginx-light \
    ca-certificates

echo "==> Użytkownik kiosku"
if ! id "$KIOSK_USER" >/dev/null 2>&1; then
    adduser --disabled-password --gecos "Kiosk" "$KIOSK_USER"
fi
usermod -aG video,input,tty "$KIOSK_USER"

echo "==> Zezwolenie na start X spoza sesji graficznej"
cat > /etc/X11/Xwrapper.config <<'XW'
allowed_users=anybody
needs_root_rights=yes
XW

echo "==> Aplikacja"
mkdir -p "$WEBROOT"
rm -rf "${WEBROOT:?}"/*
tar -xzf "$BUNDLE" -C "$WEBROOT"
chown -R www-data:www-data "$WEBROOT"

echo "==> nginx"
install -m 644 "$HERE/nginx-kiosk.conf" /etc/nginx/sites-available/serwerownia
ln -sf /etc/nginx/sites-available/serwerownia /etc/nginx/sites-enabled/serwerownia
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx >/dev/null
systemctl restart nginx

echo "==> Polityka Chromium"
# flagi wiersza poleceń nie wyłączają paska tłumaczenia - robi to dopiero polityka
mkdir -p /etc/chromium/policies/managed
install -m 644 "$HERE/chromium-policy.json" /etc/chromium/policies/managed/kiosk.json

echo "==> Domyślna konfiguracja kiosku"
if [ ! -f /etc/default/kiosk ]; then
    cat > /etc/default/kiosk <<'KD'
# Ustawienia kiosku Serwerownia
KIOSK_RESOLUTION=1920x1080
KIOSK_URL=http://localhost/
KD
fi

echo "==> Sesja kiosku"
install -m 755 -o "$KIOSK_USER" -g "$KIOSK_USER" "$HERE/xinitrc" "/home/$KIOSK_USER/.xinitrc"
install -m 644 "$HERE/kiosk.service" /etc/systemd/system/kiosk.service

echo "==> Autostart przy starcie systemu"
# bez menedżera logowania - kiosk.service sam podnosi X na tty1
systemctl set-default multi-user.target >/dev/null
# getty musi zwolnić tty1, inaczej xinit nie dostanie konsoli
systemctl disable --now getty@tty1.service >/dev/null 2>&1 || true
systemctl daemon-reload
systemctl enable kiosk.service >/dev/null

echo "==> GRUB: verbose boot"
# bez "quiet" widać komunikaty jądra i systemd zamiast czarnego ekranu;
# consoleblank=0 wyłącza wygaszanie konsoli, zanim wstanie X
GRUB_LINE='GRUB_CMDLINE_LINUX_DEFAULT="consoleblank=0 loglevel=7 systemd.show_status=1"'
if ! grep -qxF "$GRUB_LINE" /etc/default/grub; then
    if grep -q '^GRUB_CMDLINE_LINUX_DEFAULT=' /etc/default/grub; then
        sed -i "s|^GRUB_CMDLINE_LINUX_DEFAULT=.*|$GRUB_LINE|" /etc/default/grub
    else
        echo "$GRUB_LINE" >> /etc/default/grub
    fi
    update-grub
fi

echo "==> Gotowe. Po restarcie kiosk wstanie automatycznie."
