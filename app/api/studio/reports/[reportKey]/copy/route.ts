import {
  readStudioCopy,
  requireStudioShare,
  studioErrorResponse,
  writeStudioCopy,
} from "@/lib/vercel-studio-store";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reportKey: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { reportKey } = await context.params;
    await requireStudioShare(request, reportKey);
    return Response.json(await readStudioCopy(reportKey), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return studioErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { reportKey } = await context.params;
    await requireStudioShare(request, reportKey);
    const body = await request.json();
    return Response.json(await writeStudioCopy(reportKey, body?.fields), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return studioErrorResponse(error);
  }
}
