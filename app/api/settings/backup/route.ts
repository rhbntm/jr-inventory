import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { requireRole } from "@/lib/auth";
import { withErrorHandler } from "@/lib/api-wrapper";
import { Readable } from "stream";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireRole("OWNER");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const url = new URL(dbUrl);
  const PGUSER = url.username;
  const PGPASSWORD = url.password;
  const PGHOST = url.hostname;
  const PGPORT = url.port;
  const PGDATABASE = url.pathname.slice(1);

  const pgDump = spawn('pg_dump', [
    '--no-owner', 
    '--clean', 
    '--if-exists', 
    '-U', PGUSER, 
    '-h', PGHOST, 
    '-p', PGPORT, 
    PGDATABASE
  ], { 
    env: { ...process.env, PGPASSWORD } 
  });

  pgDump.stderr.on('data', (data) => {
    console.error(`pg_dump stderr: ${data}`);
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.sql`;

  const stream = Readable.toWeb(pgDump.stdout) as ReadableStream<Uint8Array>;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/sql",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
