import "server-only";

import { GoogleGenAI } from "@google/genai";

import { getServerEnvironment, type ServerEnvironment } from "../environment";

export type GeminiServerClient = {
  client: GoogleGenAI;
  model: string;
};

export function createGeminiServerClient(
  environment: ServerEnvironment = getServerEnvironment(),
): GeminiServerClient {
  return {
    client: new GoogleGenAI({ apiKey: environment.geminiApiKey }),
    model: environment.geminiModel,
  };
}
