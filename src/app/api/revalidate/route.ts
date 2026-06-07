import { revalidatePath } from "next/cache";

export async function POST() {
  revalidatePath("/ressources/blog");
  revalidatePath("/ressources/blog/[slug]", "page");
  revalidatePath("/ressources/guides");
  return Response.json({ revalidated: true });
}
