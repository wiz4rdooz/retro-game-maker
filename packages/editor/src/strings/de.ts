/** Alle Oberflächen-Texte (Deutsch). */
export const t = {
  fehler: {
    neuereVersion: 'Dieses Projekt stammt aus einer neueren Version des Programms.',
    kaputt: 'Die Datei ist beschädigt und kann nicht gelesen werden.',
    tilesetFehlt: (f: string) => `Tileset fehlt: ${f}`,
    dateiUebersprungen: (f: string) => `Beschädigte Datei übersprungen: ${f}`,
    speichernFehlgeschlagen: 'Nicht gespeichert – der nächste Versuch läuft automatisch.',
    keinWebgl2: 'Dein Browser unterstützt kein WebGL2. Bitte nutze eine aktuelle Version von Chrome oder Edge.',
  },
};
