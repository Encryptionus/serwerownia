# Kiosk — wdrożenie na maszynie z Debianem

Zestaw plików, który zamienia świeżego, minimalnego Debiana 13 w kiosk wyświetlający
Serwerownię na pełnym ekranie, startujący automatycznie razem z systemem.

## Pliki

| Plik | Rola |
|---|---|
| `create-vm.sh` | Tworzy VM w VirtualBoksie i odpala nienadzorowaną instalację Debiana |
| `provision.sh` | Instaluje X, Chromium, nginx, konfiguruje autostart. Idempotentny |
| `xinitrc` | Sesja X: rozdzielczość, brak wygaszania, Chromium w trybie kiosku |
| `kiosk.service` | Jednostka systemd podnosząca X na tty1 |
| `nginx-kiosk.conf` | Serwowanie gry z `/var/www/serwerownia` na porcie 80 |
| `chromium-policy.json` | Polityka Chromium — wyłącza m.in. pasek tłumaczenia |

## Wdrożenie

Na hoście:

```bash
npm run build
tar -czf serwerownia-dist.tar.gz -C dist .
scp -P 2222 -r kiosk serwerownia-dist.tar.gz kiosk@127.0.0.1:~/
```

Na maszynie docelowej:

```bash
sudo ./kiosk/provision.sh ~/serwerownia-dist.tar.gz
sudo reboot
```

Po restarcie kiosk wstaje sam — bez logowania, bez menedżera okien pulpitu.

## Konfiguracja

`/etc/default/kiosk`:

```sh
KIOSK_RESOLUTION=1920x1080
KIOSK_URL=http://localhost/
```

Rozdzielczość jest ustawiana przez `xrandr` przy starcie sesji — VirtualBox domyślnie
podaje 800×600, co daje ciasny ekran z suwakiem.

### Verbose boot

`provision.sh` ustawia w `/etc/default/grub`:

```
GRUB_CMDLINE_LINUX_DEFAULT="consoleblank=0 loglevel=7 systemd.show_status=1"
```

Świadomie bez `quiet` — podczas startu lecą komunikaty jądra i statusy jednostek systemd,
więc awaria na kiosku jest widoczna na ekranie zamiast chować się za czarnym tłem.
Jeśli kiedyś ma to wyglądać „czysto" dla publiczności, wystarczy dopisać `quiet splash`
i przebudować konfigurację (`update-grub`).

## Aktualizacja samej gry

```bash
scp -P 2222 serwerownia-dist.tar.gz kiosk@127.0.0.1:/tmp/
ssh -p 2222 kiosk@127.0.0.1 \
  'sudo rm -rf /var/www/serwerownia/* && \
   sudo tar -xzf /tmp/serwerownia-dist.tar.gz -C /var/www/serwerownia && \
   sudo chown -R www-data:www-data /var/www/serwerownia && \
   sudo systemctl restart kiosk.service'
```

## Pułapki, na które się natknąłem

- **`getty@tty1` musi zostać wyłączony.** Inaczej `xinit` wisi bez konsoli, usługa jest
  „active", ale X nigdy nie startuje. `kiosk.service` ma `Conflicts=getty@tty1.service`.
- **Kontroler grafiki VMSVGA nie działa.** Jądro 6.12 odrzuca go komunikatem
  `vmwgfx: unsupported hypervisor`. Trzeba VBoxSVGA — jądro Debiana ma wbudowany
  sterownik DRM `vboxvideo` i nie wymaga Guest Additions.
- **BIOS, nie EFI.** VirtualBox nie utrwala wpisów NVRAM, więc instalacja EFI potrafi
  nie wstać po restarcie.
- **Pasek tłumaczenia Chromium ignoruje flagi CLI.** Wyłącza go dopiero polityka
  `TranslateEnabled: false` w `/etc/chromium/policies/managed/`.
- **Debian z hasłem roota nie daje użytkownikowi sudo.** Szablon VirtualBoksa dodaje go
  do nieistniejącej grupy `admin`. Trzeba raz wejść przez `su`.
