import { requireStudioShare, studioErrorResponse } from "@/lib/vercel-studio-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await requireStudioShare(request), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return studioErrorResponse(error);
  }
}
