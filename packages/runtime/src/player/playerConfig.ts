/** Maße und Bewegungswerte der Spielfigur (Meter, Sekunden, Grad). */
export interface PlayerConfig {
  radius: number;
  height: number;
  eyeHeight: number;
  stepHeight: number;
  maxSlopeDeg: number;
  gravity: number;
  jumpSpeed: number;
  walkSpeed: number;
  runSpeed: number;
  fallRespawnDepth: number;
}

export const DEFAULT_PLAYER: Readonly<PlayerConfig> = Object.freeze({
  radius: 0.3,
  height: 1.7,
  eyeHeight: 1.6,
  stepHeight: 0.35,
  maxSlopeDeg: 50,
  gravity: 20,
  jumpSpeed: 6.5,
  walkSpeed: 4,
  runSpeed: 6.5,
  fallRespawnDepth: 60,
});
