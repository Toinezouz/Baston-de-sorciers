import { randomBytes, randomInt } from "node:crypto";

/** Alphabet sans caractères ambigus (0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Code de partie lisible, à partager (6 caractères ≈ 887 millions de combinaisons). */
export function newGameCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Jeton de session secret (256 bits). */
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function newPlayerId(): string {
  return `pl_${randomBytes(8).toString("hex")}`;
}

/** Graine de partie (journalisée pour pouvoir rejouer un bug). */
export function newSeed(): string {
  return randomBytes(16).toString("hex");
}
