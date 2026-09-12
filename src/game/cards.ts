import type { Card, DeckId } from './types';

export const DECKS: Record<DeckId, Card[]> = {
  incydent: [
    { id: 'i1',  text: 'Awaria chłodzenia w Sali A. Serwis przyjeżdża w nocy.', effect: { t: 'pay', amount: 120 } },
    { id: 'i2',  text: 'Wolumetryczny DDoS na twoje łącze. Płacisz za scrubbing.', effect: { t: 'pay', amount: 80 } },
    { id: 'i3',  text: 'Dysk wypadł z macierzy. Odbudowa RAID trwa i kosztuje.', effect: { t: 'pay', amount: 60 } },
    { id: 'i4',  text: 'Naruszenie SLA. Wypłacasz rekompensatę każdemu klientowi przy stole.', effect: { t: 'payEach', amount: 50 } },
    { id: 'i5',  text: 'Wyciek danych. Wszystko wyłączone do czasu wyjaśnienia.', effect: { t: 'gotoBlackout' } },
    { id: 'i6',  text: 'Ktoś potknął się o kabel krosowy. Cofasz się o 3 pola.', effect: { t: 'move', delta: -3 } },
    { id: 'i7',  text: 'Kontrola zgodności RODO. Kara administracyjna.', effect: { t: 'pay', amount: 100 } },
    { id: 'i8',  text: 'Certyfikat TLS wygasł w piątek o 23:50. Ekspresowe odnowienie.', effect: { t: 'pay', amount: 30 } },
    { id: 'i9',  text: 'Przepięcie w szafie. Płacisz za każdy serwer i każdy klaster.', effect: { t: 'perNode', perNode: 40, perCluster: 150 } },
    { id: 'i10', text: 'Pilna migracja do nowej lokalizacji. Wracasz na BOOT.', effect: { t: 'goto', tile: 0, collectStart: false } },
    { id: 'i11', text: 'Taryfa za prąd w górę. Dopłata za każdą posiadaną szafę.', effect: { t: 'perRack', amount: 25 } },
    { id: 'i12', text: 'Aktualizacja firmware ubiła kontroler. Tracisz następną turę.', effect: { t: 'skipTurn' } },
  ],
  budzet: [
    { id: 'b1',  text: 'Nowy klient podpisał kontrakt roczny.', effect: { t: 'gain', amount: 200 } },
    { id: 'b2',  text: 'Zwrot z leasingu wycofanego sprzętu.', effect: { t: 'gain', amount: 150 } },
    { id: 'b3',  text: 'Dotacja na efektywność energetyczną (PUE poniżej 1.2).', effect: { t: 'gain', amount: 100 } },
    { id: 'b4',  text: 'Generator awaryjny. Zatrzymaj tę kartę — wyciągnie cię z BLACKOUT.', effect: { t: 'generator' } },
    { id: 'b5',  text: 'Sprzedałeś wycofane serwery na aukcji.', effect: { t: 'gain', amount: 75 } },
    { id: 'b6',  text: 'Bonus za uptime 99,999%. Konkurencja płaci ci karę umowną.', effect: { t: 'collectEach', amount: 50 } },
    { id: 'b7',  text: 'Wygrywasz przetarg. Przenosisz się na Kampus Hyperscale.', effect: { t: 'goto', tile: 27, collectStart: true } },
    { id: 'b8',  text: 'Rabat wolumenowy od dostawcy sprzętu.', effect: { t: 'gain', amount: 60 } },
    { id: 'b9',  text: 'Refaktoryzacja obcięła rachunek za chmurę.', effect: { t: 'gain', amount: 120 } },
    { id: 'b10', text: 'Koniec kwartału — wracasz na BOOT po nowy budżet.', effect: { t: 'goto', tile: 0, collectStart: true } },
  ],
};
