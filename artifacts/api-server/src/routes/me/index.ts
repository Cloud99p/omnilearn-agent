import { Router } from "express";
import { createClerkClient } from "@clerk/express";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../../middlewares/requireAuth.js";
import { db } from "../../lib/db.js";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

router.get("/me", requireAuth, async (req, res) => {
  const clerkId = (req as AuthenticatedRequest).clerkId;
  try {
    const clerkUser = await clerkClient.users.getUser(clerkId);

    const githubAccount = clerkUser.externalAccounts.find(
      (a) => a.provider === "oauth_github",
    );
    const googleAccount = clerkUser.externalAccounts.find(
      (a) => a.provider === "oauth_google",
    );

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    const userData = {
      clerkId,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
      displayName:
        clerkUser.fullName ?? clerkUser.username ?? clerkUser.firstName ?? null,
      avatarUrl: clerkUser.imageUrl ?? null,
      githubUsername: githubAccount?.username ?? null,
    };

    if (existing.length === 0) {
      await db.insert(users).values(userData);
    } else {
      await db
        .update(users)
        .set({ ...userData, updatedAt: new Date() })
        .where(eq(users.clerkId, clerkId));
    }

    res.json({
      ...userData,
      hasGitHub: !!githubAccount,
      hasGoogle: !!googleAccount,
      githubEmail: githubAccount?.emailAddress ?? null,
      googleEmail: googleAccount?.emailAddress ?? null,
    });
  } catch (err) {
    req.log.error(err, "Failed to fetch user profile");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

export default router;
