/**
 * Schémas Zod de validation des messages entrants.
 * Tout message qui ne correspond pas exactement est rejeté (INVALID_PAYLOAD) avant d'atteindre le moteur.
 */
import { NAME_MAX_LENGTH, RUNE_SLOTS, type PlayerAction } from "@baston/engine";
import { z } from "zod";
import type { ActionRequest, CreateGameRequest, JoinGameRequest, ResumeRequest } from "./protocol";

/** Caractères de contrôle, zéro-largeur et de direction du texte (anti-usurpation visuelle). */
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069\\ufeff]", "g");

/** Pseudo : caractères de contrôle retirés, espaces normalisés, 1 à 20 caractères. */
export const playerNameSchema = z
  .string()
  .transform((s) => s.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1, "Pseudo requis").max(NAME_MAX_LENGTH, `Pseudo trop long (${NAME_MAX_LENGTH} max)`));

/** Code de partie : lettres/chiffres, insensible à la casse. */
export const gameIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[A-Z0-9]{4,8}$/, "Code de partie invalide"));

const id = z.string().min(1).max(40);
const slot = z.enum(RUNE_SLOTS);

export const playerActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SET_READY"), ready: z.boolean() }).strict(),
  z.object({ type: z.literal("START_GAME") }).strict(),
  z.object({ type: z.literal("PLACE_RUNE"), cardId: id, slot }).strict(),
  z.object({ type: z.literal("REMOVE_RUNE"), slot }).strict(),
  z.object({ type: z.literal("LOCK_SPELL") }).strict(),
  z.object({ type: z.literal("UNLOCK_SPELL") }).strict(),
  z.object({ type: z.literal("CHOOSE"), requestId: id, optionIds: z.array(id).min(1).max(10) }).strict(),
  z.object({ type: z.literal("LEAVE") }).strict(),
]) satisfies z.ZodType<PlayerAction>;

export const createGameSchema = z
  .object({
    name: playerNameSchema,
    mode: z.enum(["standard", "quick"]).optional(),
    maxPlayers: z.number().int().min(2).max(6).optional(),
  })
  .strict() satisfies z.ZodType<CreateGameRequest, z.ZodTypeDef, unknown>;

export const joinGameSchema = z.object({ gameId: gameIdSchema, name: playerNameSchema }).strict() satisfies z.ZodType<
  JoinGameRequest,
  z.ZodTypeDef,
  unknown
>;

export const resumeSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict() satisfies z.ZodType<ResumeRequest>;

export const actionRequestSchema = z
  .object({ clientSeq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), action: playerActionSchema })
  .strict() satisfies z.ZodType<ActionRequest>;
