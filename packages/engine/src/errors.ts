import type { RejectReason } from "./types";

/** Rejet contrôlé d'une action : l'état n'est pas modifié. */
export class Rejection extends Error {
  constructor(
    public readonly reason: RejectReason,
    message?: string,
  ) {
    super(message ?? reason);
    this.name = "Rejection";
  }
}

export function reject(reason: RejectReason, message?: string): never {
  throw new Rejection(reason, message);
}

/** Incohérence interne du moteur (bug) : la partie est protégée par le dispatcher. */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}
