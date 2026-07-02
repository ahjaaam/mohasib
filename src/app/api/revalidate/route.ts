import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const configuredSecret = process.env.SANITY_REVALIDATE_SECRET;
  const suppliedSecret = request.headers.get("x-sanity-secret") ?? new URL(request.url).searchParams.get("secret");
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as {
    _type?: string;
    slug?: string | { current?: string };
  } | null;
  const slug = typeof payload?.slug === "string" ? payload.slug : payload?.slug?.current;

  revalidatePath("/ressources/blog");
  revalidatePath("/ressources/blog/[slug]", "page");
  revalidatePath("/ressources/guides");

  if (payload?._type === "post" && slug) {
    revalidatePath(`/ressources/blog/${slug}`);
  }

  return Response.json({ revalidated: true, slug: slug ?? null });
}
