#!/usr/bin/env bash
# Tworzy w VirtualBoksie VM z Debianem 13 i instaluje go bez nadzoru.
# Po zakończeniu maszyna ma działający SSH na porcie 2222 hosta.
#
#   ./create-vm.sh /sciezka/debian-13.2.0-amd64-netinst.iso
#
set -euo pipefail

ISO="${1:?Podaj ścieżkę do ISO Debiana}"
VM="${VM_NAME:-Serwerownia-Kiosk}"
RAM="${VM_RAM:-2048}"
CPUS="${VM_CPUS:-2}"
DISK_MB="${VM_DISK:-20480}"
SSH_PORT="${VM_SSH_PORT:-2222}"
VM_USER="${VM_USER:-kiosk}"
VM_PASS="${VM_PASS:-kiosk123}"

VMDIR="$(VBoxManage list systemproperties | sed -n 's/^Default machine folder: *//p')"

VBoxManage createvm --name "$VM" --ostype Debian_64 --register

# BIOS zamiast EFI: VirtualBox nie utrwala wpisów NVRAM, przez co instalacja EFI
# potrafi nie wstać po restarcie.
VBoxManage modifyvm "$VM" \
    --memory "$RAM" --vram 128 --cpus "$CPUS" \
    --firmware bios \
    --graphicscontroller vboxsvga \
    --nic1 nat --nictype1 virtio \
    --audio-driver none \
    --rtcuseutc on \
    --boot1 dvd --boot2 disk --boot3 none --boot4 none

VBoxManage modifyvm "$VM" --natpf1 "ssh,tcp,127.0.0.1,${SSH_PORT},,22"

VBoxManage createmedium disk --filename "${VMDIR}/${VM}/${VM}.vdi" --size "$DISK_MB" --format VDI
VBoxManage storagectl "$VM" --name "SATA" --add sata --controller IntelAhci --portcount 2
VBoxManage storageattach "$VM" --storagectl "SATA" --port 0 --device 0 --type hdd \
    --medium "${VMDIR}/${VM}/${VM}.vdi"

# 'minimal' w szablonie VirtualBoksa dociąga openssh-server - to jedyny kanał
# potrzebny do dalszego provisioningu.
VBoxManage unattended install "$VM" \
    --iso="$ISO" \
    --user="$VM_USER" --user-password="$VM_PASS" --admin-password="$VM_PASS" \
    --full-user-name="Kiosk" \
    --hostname=serwerownia.local \
    --locale=en_US --country=PL --time-zone=Europe/Warsaw \
    --package-selection-adjustment=minimal \
    --no-install-additions \
    --start-vm=headless

echo
echo "Instalacja ruszyła. Poczekaj, aż port ${SSH_PORT} odpowie bannerem SSH, potem:"
echo "  ssh -p ${SSH_PORT} ${VM_USER}@127.0.0.1"
echo
echo "Uwaga: świeży Debian z ustawionym hasłem roota NIE dodaje użytkownika do sudo."
echo "Nadaj je raz przez konsolę lub: ssh -tt ... 'su -c \"apt-get install -y sudo && usermod -aG sudo ${VM_USER}\"'"
