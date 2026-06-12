import "server-only";

import { resolveTeamContext } from "@/lib/team";

export async function resolveAccountOwnerId(userId: string) {
  return (await resolveTeamContext(userId))?.ownerId ?? userId;
}
