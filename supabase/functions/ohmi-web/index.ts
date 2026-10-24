import { handleAiRequest } from "../ohmi-ai/handler.ts";
import { handleLibraryRequest } from "./library.ts";
Deno.serve((request: Request) =>
  new URL(request.url).pathname.endsWith("/guide")
    ? handleLibraryRequest(request)
    : handleAiRequest(request),
);
