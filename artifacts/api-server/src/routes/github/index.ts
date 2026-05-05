import { Router } from "express";
import { createClerkClient } from "@clerk/express";
import { Octokit } from "@octokit/rest";
import { requireAuth, type AuthenticatedRequest } from "../../middlewares/requireAuth.js";

const router = Router();

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function getGitHubToken(clerkId: string): Promise<string | null> {
  try {
    const tokens = await clerkClient.users.getUserOauthAccessToken(clerkId, "oauth_github");
    return tokens.data?.[0]?.token ?? null;
  } catch {
    return null;
  }
}

function makeOctokit(token: string) {
  return new Octokit({ auth: token });
}

router.get("/github/repos", requireAuth, async (req, res) => {
  const clerkId = (req as AuthenticatedRequest).clerkId;
  const token = await getGitHubToken(clerkId);
  if (!token) {
    res.status(403).json({ error: "GitHub account not connected. Sign in with GitHub to access repositories." });
    return;
  }
  try {
    const octokit = makeOctokit(token);
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
      visibility: "all",
    });
    res.json(
      data.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        name: r.name,
        owner: r.owner.login,
        description: r.description,
        private: r.private,
        language: r.language,
        stargazersCount: r.stargazers_count,
        forksCount: r.forks_count,
        htmlUrl: r.html_url,
        cloneUrl: r.clone_url,
        defaultBranch: r.default_branch,
        updatedAt: r.updated_at,
        topics: r.topics ?? [],
      })),
    );
  } catch (err) {
    req.log.error(err, "Failed to list GitHub repos");
    res.status(500).json({ error: "Failed to fetch repositories" });
  }
});

router.get("/github/repos/search", requireAuth, async (req, res) => {
  const clerkId = (req as AuthenticatedRequest).clerkId;
  const token = await getGitHubToken(clerkId);
  const q = String(req.query.q ?? "");
  if (!token) {
    res.status(403).json({ error: "GitHub account not connected." });
    return;
  }
  if (!q) {
    res.status(400).json({ error: "Missing query parameter `q`" });
    return;
  }
  try {
    const octokit = makeOctokit(token);
    const { data } = await octokit.search.repos({ q, per_page: 30 });
    res.json(
      data.items.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        name: r.name,
        owner: r.owner?.login,
        description: r.description,
        private: r.private,
        language: r.language,
        stargazersCount: r.stargazers_count,
        forksCount: r.forks_count,
        htmlUrl: r.html_url,
        cloneUrl: r.clone_url,
        defaultBranch: r.default_branch,
        updatedAt: r.updated_at,
        topics: r.topics ?? [],
      })),
    );
  } catch (err) {
    req.log.error(err, "Failed to search GitHub repos");
    res.status(500).json({ error: "Failed to search repositories" });
  }
});

router.post("/github/repos", requireAuth, async (req, res) => {
  const clerkId = (req as AuthenticatedRequest).clerkId;
  const token = await getGitHubToken(clerkId);
  if (!token) {
    res.status(403).json({ error: "GitHub account not connected." });
    return;
  }
  const { name, description, isPrivate, autoInit } = req.body as {
    name: string;
    description?: string;
    isPrivate?: boolean;
    autoInit?: boolean;
  };
  if (!name) {
    res.status(400).json({ error: "Repository name is required" });
    return;
  }
  try {
    const octokit = makeOctokit(token);
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate ?? false,
      auto_init: autoInit ?? true,
    });
    res.json({
      id: data.id,
      fullName: data.full_name,
      htmlUrl: data.html_url,
      cloneUrl: data.clone_url,
      defaultBranch: data.default_branch,
    });
  } catch (err) {
    req.log.error(err, "Failed to create GitHub repo");
    res.status(500).json({ error: "Failed to create repository" });
  }
});

router.post("/github/repos/:owner/:repo/fork", requireAuth, async (req, res) => {
  const clerkId = (req as AuthenticatedRequest).clerkId;
  const token = await getGitHubToken(clerkId);
  if (!token) {
    res.status(403).json({ error: "GitHub account not connected." });
    return;
  }
  const { owner, repo } = req.params;
  try {
    const octokit = makeOctokit(token);
    const { data } = await octokit.repos.createFork({ owner, repo });
    res.json({
      id: data.id,
      fullName: data.full_name,
      htmlUrl: data.html_url,
      cloneUrl: data.clone_url,
    });
  } catch (err) {
    req.log.error(err, "Failed to fork GitHub repo");
    res.status(500).json({ error: "Failed to fork repository" });
  }
});

router.get("/github/repos/:owner/:repo/contents", requireAuth, async (req, res) => {
  const clerkId = (req as AuthenticatedRequest).clerkId;
  const token = await getGitHubToken(clerkId);
  if (!token) {
    res.status(403).json({ error: "GitHub account not connected." });
    return;
  }
  const { owner, repo } = req.params;
  const pathQuery = req.query.path;
  const path = Array.isArray(pathQuery) ? pathQuery[0] : (pathQuery ?? "");
  try {
    const octokit = makeOctokit(token);
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    res.json(data);
  } catch (err) {
    req.log.error(err, "Failed to get repo contents");
    res.status(500).json({ error: "Failed to fetch repository contents" });
  }
});

router.post("/github/share", requireAuth, async (req, res) => {
  const clerkId = (req as AuthenticatedRequest).clerkId;
  const token = await getGitHubToken(clerkId);
  if (!token) {
    res.status(403).json({ error: "GitHub account not connected." });
    return;
  }
  const { description, content, filename, isPublic } = req.body as {
    description?: string;
    content: string;
    filename?: string;
    isPublic?: boolean;
  };
  if (!content) {
    res.status(400).json({ error: "Content is required" });
    return;
  }
  const name = filename ?? "omnilearn-config.json";
  try {
    const octokit = makeOctokit(token);
    const { data } = await octokit.gists.create({
      description: description ?? "OmniLearn agent configuration",
      public: isPublic ?? true,
      files: {
        [name]: { content },
      },
    });
    res.json({
      id: data.id,
      htmlUrl: data.html_url,
      rawUrl: (data.files as Record<string, { raw_url?: string }>)[name]?.raw_url,
    });
  } catch (err) {
    req.log.error(err, "Failed to share via GitHub Gist");
    res.status(500).json({ error: "Failed to share configuration" });
  }
});

router.get("/github/status", requireAuth, async (req, res) => {
  const clerkId = (req as AuthenticatedRequest).clerkId;
  const token = await getGitHubToken(clerkId);
  if (!token) {
    res.json({ connected: false });
    return;
  }
  try {
    const octokit = makeOctokit(token);
    const { data } = await octokit.users.getAuthenticated();
    res.json({
      connected: true,
      username: data.login,
      avatarUrl: data.avatar_url,
      publicRepos: data.public_repos,
    });
  } catch {
    res.json({ connected: false });
  }
});

export default router;
