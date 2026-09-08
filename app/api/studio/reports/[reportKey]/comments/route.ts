import {
  completeStudioComment,
  deleteStudioComment,
  readStudioComments,
  requireStudioShare,
  studioErrorResponse,
  writeStudioComment,
} from "@/lib/vercel-studio-store";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reportKey: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { reportKey } = await context.params;
    await requireStudioShare(request, reportKey);
    return Response.json(await readStudioComments(reportKey), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return studioErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { reportKey } = await context.params;
    await requireStudioShare(request, reportKey);
    const comment = await writeStudioComment(reportKey, await request.json());
    return Response.json(comment, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return studioErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { reportKey } = await context.params;
    await requireStudioShare(request, reportKey);
    const body = await request.json();
    return Response.json(await completeStudioComment(reportKey, String(body?.id ?? "")), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return studioErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { reportKey } = await context.params;
    await requireStudioShare(request, reportKey);
    const body = await request.json();
    return Response.json(await deleteStudioComment(reportKey, String(body?.id ?? "")), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return studioErrorResponse(error);
  }
}
