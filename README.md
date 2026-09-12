# Serwerownia

Webowa gra planszowa o budowaniu infrastruktury IT. Kupujesz szafy rack, łącza tranzytowe
i zasilanie, kompletujesz grupy, rozbudowujesz je i inkasujesz opłaty od konkurencji.
2–4 graczy przy jednym ekranie, wolne miejsca zajmują boty.

Gra działa w całości po stronie przeglądarki — bez backendu, bez kont, bez sieci.

## Uruchomienie

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # testy silnika
npm run build          # produkcyjny build do dist/
```

Docker:

```bash
docker compose up -d --build   # http://localhost:8080
```

Obraz to nginx serwujący statyczny build (~74 MB), działa jako użytkownik bez uprawnień
na porcie 8080 i ma healthcheck.

### Parametry URL

| Parametr | Znaczenie |
|---|---|
| `?rounds=N` | Nadpisuje limit rund trybu krótkiego (1–200). Do strojenia czasu partii pod natężenie ruchu przy kiosku. |

## Zasady

**Cel.** Tryb krótki: po 24 rundach wygrywa największy majątek netto (gotówka + wartość pól
+ ulepszenia − hipoteki). Tryb klasyczny: gra do ostatniego wypłacalnego gracza, z twardym
limitem 60 rund jako bezpiecznikiem.

**Plansza.** 32 pola po obwodzie: 15 szaf w 6 grupach kolorystycznych, 4 łącza tranzytowe,
2 pola zasilania, 5 pól kart, 2 podatki i 4 narożniki.

**Ruch.** Rzut dwiema kośćmi, ruch zgodnie z ruchem wskazówek zegara. Przejście przez BOOT
daje 200 PLN. Dublet daje dodatkowy rzut; trzeci dublet z rzędu wysyła do BLACKOUT.

**Kupno i licytacja.** Na wolnym polu kupujesz je po cenie katalogowej albo puszczasz na
licytację — wtedy licytują wszyscy, od ceny wywoławczej równej połowie ceny katalogowej.
Licytacja jest obowiązkowa: pole nigdy nie zostaje „niczyje" tylko dlatego, że ktoś nie chciał
zapłacić pełnej ceny.

**Czynsze.**
- Szafa: czynsz bazowy, podwojony gdy właściciel ma komplet grupy, dalej rośnie z rozbudową.
- Łącze: 50 / 100 / 200 / 400 PLN zależnie od liczby posiadanych łączy.
- Zasilanie: suma oczek × 4 (jedno pole) lub × 10 (oba).

**Rozbudowa.** Wymaga kompletu grupy i musi być równomierna — nie wolno wyprzedzić
najsłabszego pola w grupie o więcej niż jeden poziom. Cztery poziomy: Redundancja,
Automatyzacja, Tier III, Klaster HA.

**BLACKOUT.** Dwie tury postoju. Wychodzisz dubletem, opłatą 50 PLN albo kartą generatora.

**Hipoteka.** Daje połowę ceny katalogowej; wykup kosztuje 10% więcej. Zahipotekowane pole
nie generuje czynszu.

**Wymiana.** Pola bez rozbudowy plus gotówka, w obie strony. Boty oceniają ofertę po jej
wartości dla siebie i same proponują wymiany domykające im grupę.

**Bankructwo.** Gdy nie masz czym zapłacić, sprzedajesz sprzęt i hipotekujesz pola. Jeśli to
nie wystarcza — majątek przejmuje wierzyciel (albo wraca na rynek, jeśli dług był wobec banku).

## Architektura

```
src/game/     logika gry, bez zależności od UI
  types.ts      typy stanu i akcji
  board.ts      definicja 32 pól, grupy, stałe
  cards.ts      talie Incydent i Budżet
  rng.ts        deterministyczny generator (mulberry32)
  engine.ts     reducer: (stan, akcja) -> stan
  selectors.ts  czynsze, majątek, warunki budowy
  bot.ts        heurystyki botów
  plural.ts     polska liczba mnoga
src/ui/       komponenty React
src/test/     testy silnika (vitest)
```

Stan gry jest jedną niemutowalną strukturą, a cała logika to czysty reducer z ziarnowanym
RNG — partia jest w pełni odtwarzalna z ziarna i sekwencji akcji, co pozwala testować
kompletne rozgrywki botów bez uruchamiania UI.

Boty grają tą samą ścieżką co ludzie: `botAction(stan)` zwraca zwykłą akcję, którą przyjmuje
ten sam reducer. Nie ma osobnego „trybu AI" ani dostępu botów do ukrytych informacji.

## Prawa autorskie

Mechanika gry ekonomicznej typu *roll-and-move* (ruch po obwodzie, kupowanie pól, czynsze,
bankructwo) nie podlega prawu autorskiemu i wywodzi się z *The Landlord's Game*
Elizabeth Magie (patent z 1904, wygasły, domena publiczna).

Wszystkie chronione elementy są tu własne i oryginalne: motyw, nazwy pól, układ planszy,
grupy, treści kart, oprawa graficzna i tekst zasad. Projekt świadomie nie używa nazw, nazw
własnych pól, postaci ani szaty graficznej żadnej komercyjnej gry planszowej.

## Tryb kiosku

Działająca maszyna: Debian 13 w VirtualBoksie, Chromium na pełnym ekranie w 1920×1080,
nginx serwujący grę z `/var/www/serwerownia`, autostart razem z systemem bez logowania.

Komplet plików wdrożeniowych i opis pułapek: [`kiosk/README.md`](kiosk/README.md).

```bash
kiosk/create-vm.sh /sciezka/debian-13.2.0-amd64-netinst.iso   # VM + nienadzorowany Debian
sudo kiosk/provision.sh serwerownia-dist.tar.gz               # X, Chromium, nginx, autostart
```

Zrobione pod kiosk: brak backendu i kont, sterowanie wyłącznie dotykiem/kliknięciem,
partia domknięta limitem rund w obu trybach, regulowany czas partii przez `?rounds=N`,
pełny ekran bez paska adresu, autostart przy starcie systemu.

Do zrobienia: automatyczny reset po bezczynności (attract mode) i wyciszenie skrótów
klawiszowych, którymi dałoby się wyjść z Chromium.
