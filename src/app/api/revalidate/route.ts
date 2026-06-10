import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const configuredSecret = process.env.SANITY_REVALIDATE_SECRET;
  const suppliedSecret = request.headers.get("x-sanity-secret") ?? new URL(request.url).searchParams.get("secret");
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  revalidatePath("/ressources/blog");
  revalidatePath("/ressources/blog/[slug]", "page");
  revalidatePath("/ressources/guides");
  return Response.json({ revalidated: true });
}
