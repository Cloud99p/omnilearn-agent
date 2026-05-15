import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ghost,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Wifi,
  WifiOff,
  AlertCircle,
  Activity,
  Clock,
  Brain,
} from "lucide-react";
import { useSearch } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface WorkerCreds {
  workerId: string;
  workerSecret: string;
}

type Phase = "loading" | "invalid" | "join" | "connecting" | "active" | "error";

interface LiveStats {
  tasksCompleted: number;
  tasksFailed: number;
  avgMs: number | null;
  currentTask: string | null;
  lastCompletedAt: number | null;
}

export default function WorkerPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const inviteToken = params.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [tokenLabel, setTokenLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [name, setName] = useState("");
  const [creds, setCreds] = useState<WorkerCreds | null>(null);
  const [stats, setStats] = useState<LiveStats>({
    tasksCompleted: 0,
    tasksFailed: 0,
    avgMs: null,
    currentTask: null,
    lastCompletedAt: null,
  });
  const [log, setLog] = useState<
    Array<{ ts: number; text: string; ok: boolean }>
  >([]);

  const runningRef = useRef(false);
  const credsRef = useRef<WorkerCreds | null>(null);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  // Validate token on mount
  useEffect(() => {
    if (!inviteToken) {
      setPhase("invalid");
      setErrorMsg(
        "No invite token provided. Ask the OmniLearn operator for a shareable worker link.",
      );
      return;
    }
    fetch(`${BASE}/api/ghost/worker/invite/${encodeURIComponent(inviteToken)}`)
      .then((r) => r.json())
      .then((data: { valid?: boolean; label?: string; error?: string }) => {
        if (data.valid) {
          setTokenLabel(data.label ?? "OmniLearn Network");
          setPhase("join");
        } else {
          setPhase("invalid");
          setErrorMsg(data.error ?? "Invalid invite token.");
        }
      })
      .catch(() => {
        setPhase("invalid");
        setErrorMsg(
          "Could not reach the OmniLearn server. Check your connection.",
        );
      });
  }, [inviteToken]);

  const addLog = useCallback((text: string, ok: boolean) => {
    setLog((prev) => [{ ts: Date.now(), text, ok }, ...prev].slice(0, 40));
  }, []);

  // Main worker polling loop — no API key needed, server handles AI calls
  const startWorking = useCallback(
    async (w: WorkerCreds) => {
      runningRef.current = true;
      credsRef.current = w;

      while (runningRef.current) {
        try {
          const pollRes = await fetch(
            `${BASE}/api/ghost/worker/poll?workerId=${encodeURIComponent(w.workerId)}&workerSecret=${encodeURIComponent(w.workerSecret)}`,
          );
          if (!pollRes.ok) {
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }

          const pollData = (await pollRes.json()) as {
            task?: { taskId: string; payload: { message: string } };
          };

          if (!pollData.task) {
            continue; // server held for 25s, poll again immediately
          }

          const { taskId, payload } = pollData.task;
          setStats((s) => ({
            ...s,
            currentTask: payload.message.slice(0, 80),
          }));
          addLog(`Task received: "${payload.message.slice(0, 60)}…"`, true);

          const start = Date.now();
          let failed = false;
          let processingMs = 0;

          try {
            // Ask the server to run the AI call — no API key needed from contributor
            const execRes = await fetch(
              `${BASE}/api/ghost/worker/execute/${encodeURIComponent(taskId)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workerId: w.workerId,
                  workerSecret: w.workerSecret,
                }),
              },
            );
            processingMs = Date.now() - start;
            if (!execRes.ok) {
              failed = true;
              const err = (await execRes.json().catch(() => ({}))) as {
                error?: string;
              };
              addLog(
                `Task failed: ${err?.error ?? `server error ${execRes.status}`}`,
                false,
              );
            }
          } catch (err) {
            processingMs = Date.now() - start;
            failed = true;
            addLog(
              `Network error: ${err instanceof Error ? err.message : "unknown"}`,
              false,
            );
          }

          const prev = statsRef.current;
          const newCompleted = failed
            ? prev.tasksCompleted
            : prev.tasksCompleted + 1;
          const newFailed = failed ? prev.tasksFailed + 1 : prev.tasksFailed;
          const total = newCompleted;
          const newAvg =
            total > 0 && !failed
              ? ((prev.avgMs ?? processingMs) * (total - 1) + processingMs) /
                total
              : prev.avgMs;

          setStats({
            tasksCompleted: newCompleted,
            tasksFailed: newFailed,
            avgMs: newAvg,
            currentTask: null,
            lastCompletedAt: failed ? prev.lastCompletedAt : Date.now(),
          });

          if (!failed) {
            addLog(`Completed in ${(processingMs / 1000).toFixed(1)}s`, true);
          }
        } catch {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    },
    [addLog],
  );

  const handleJoin = async () => {
    if (!name.trim()) return;
    setPhase("connecting");

    try {
      const res = await fetch(`${BASE}/api/ghost/worker/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken, name: name.trim() }),
      });
      const data = (await res.json()) as {
        workerId?: string;
        workerSecret?: string;
        error?: string;
      };

      if (!res.ok || !data.workerId) {
        setPhase("join");
        setErrorMsg(data.error ?? "Failed to join network.");
        return;
      }

      const w: WorkerCreds = {
        workerId: data.workerId,
        workerSecret: data.workerSecret!,
      };
      setCreds(w);
      setPhase("active");
      addLog("Joined network — waiting for tasks", true);
      startWorking(w);
    } catch {
      setPhase("join");
      setErrorMsg("Could not connect to OmniLearn server.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <Ghost className="w-7 h-7 text-violet-400" />
          <span className="font-mono text-xl font-bold text-foreground tracking-tight">
            OmniLearn
          </span>
          <span className="font-mono text-xs text-muted-foreground ml-1">
            / ghost worker
          </span>
        </div>

        {/* Loading */}
        {phase === "loading" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="font-mono text-sm">Validating invite token…</span>
          </div>
        )}

        {/* Invalid */}
        {phase === "invalid" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="font-mono text-sm font-bold text-red-400">
                Invalid invite
              </span>
            </div>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              {errorMsg}
            </p>
          </div>
        )}

        {/* Join form */}
        {(phase === "join" || phase === "connecting") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div>
              <h1 className="font-mono text-2xl font-bold text-foreground mb-2">
                Join the network
              </h1>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                You were invited to contribute compute to{" "}
                <span className="text-primary">{tokenLabel}</span>. Your browser
                acts as a worker node — no API keys or accounts required.
              </p>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="font-mono text-xs text-red-400">
                  {errorMsg}
                </span>
              </div>
            )}

            <div>
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Worker name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="e.g. Alice's MacBook"
                className="w-full bg-card border border-border rounded-lg px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={!name.trim() || phase === "connecting"}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-sm font-bold transition-all"
            >
              {phase === "connecting" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Connecting…
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> Start contributing
                </>
              )}
            </button>

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  icon: Brain,
                  text: "The server handles all AI calls — no API key needed from you",
                },
                {
                  icon: Activity,
                  text: "Your worker is assigned tasks by the network load balancer",
                },
                { icon: Ghost, text: "Disconnect any time by closing the tab" },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="rounded-lg border border-border/30 bg-card/30 p-3 text-center"
                >
                  <Icon className="w-4 h-4 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Active worker dashboard */}
        {phase === "active" && creds && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {/* Status header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-mono text-2xl font-bold text-foreground mb-1">
                  {name}
                </h1>
                <div className="flex items-center gap-2">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-mono text-xs text-emerald-400">
                    {stats.currentTask
                      ? "processing task"
                      : "idle — waiting for tasks"}
                  </span>
                </div>
              </div>
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Completed",
                  value: stats.tasksCompleted,
                  color: "#34d399",
                  icon: CheckCircle2,
                },
                {
                  label: "Failed",
                  value: stats.tasksFailed,
                  color: "#f87171",
                  icon: XCircle,
                },
                {
                  label: "Avg time",
                  value: stats.avgMs
                    ? `${(stats.avgMs / 1000).toFixed(1)}s`
                    : "—",
                  color: "#22d3ee",
                  icon: Clock,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-border/40 bg-card/40 p-4"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <s.icon className="w-3 h-3" style={{ color: s.color }} />
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                      {s.label}
                    </span>
                  </div>
                  <span
                    className="font-mono text-2xl font-bold"
                    style={{ color: s.color }}
                  >
                    {s.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Current task */}
            <AnimatePresence>
              {stats.currentTask && (
                <motion.div
                  key="current"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                    <span className="font-mono text-xs text-violet-400 font-bold">
                      Processing
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground truncate">
                    "{stats.currentTask}"
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Activity log */}
            <div>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                Activity log
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {log.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground/40">
                    Waiting for first task…
                  </p>
                ) : (
                  log.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2">
                      {entry.ok ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                      )}
                      <span className="font-mono text-xs text-muted-foreground leading-relaxed">
                        {entry.text}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/40 ml-auto shrink-0">
                        {new Date(entry.ts).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/30 bg-card/20">
              <WifiOff className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">
                Keep this tab open to continue contributing. Closing it
                disconnects your worker from the network.
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
