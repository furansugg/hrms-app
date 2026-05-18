import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether user exists
      return NextResponse.json({ message: "If the email is registered, a reset link has been generated." });
    }

    // Invalidate old tokens
    await prisma.passwordResetToken.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    // In production, send email with reset link. For now, return token directly.
    // The reset link would be: /reset-password?token=<token>
    return NextResponse.json({
      message: "If the email is registered, a reset link has been generated.",
      // Only expose token in development for testing
      ...(process.env.NODE_ENV !== "production" && { token, resetUrl: `/reset-password?token=${token}` }),
    });
  } catch (e) {
    console.error("[forgot-password]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
