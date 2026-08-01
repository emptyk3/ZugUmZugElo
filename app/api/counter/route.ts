import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const counter = await prisma.counter.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, value: 0 },
  });
  return NextResponse.json({ value: counter.value });
}

export async function POST() {
  const counter = await prisma.counter.upsert({
    where: { id: 1 },
    update: { value: { increment: 1 } },
    create: { id: 1, value: 1 },
  });
  return NextResponse.json({ value: counter.value });
}
