import { NextResponse } from "next/server";
import { DashboardRepo } from "@/app/repositories/dashboardRepo";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireAuth } from "@/lib/auth";

export const GET = withErrorHandler(async () => {
    await requireAuth();
    const dashboardData = await DashboardRepo.getDashboardStats();
    return NextResponse.json(dashboardData);
});
