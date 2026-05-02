import { motion } from "framer-motion";
import { CheckCircle, Circle, Terminal, Folder, FolderOpen, File, GitBranch, Package, Cpu } from "lucide-react";
import { useState } from "react";

const STEPS = [
  {
    id: 1,
    title: "Prerequisites",
    desc: "Ensure your system meets the minimum requirements before starting.",
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Python", version: "3.10+", note: "Required for all components" },
            { label: "Docker", version: "24.x+", note: "Container orchestration" },
            { label: "CUDA", version: "11.8+ (optional)", note: "GPU acceleration" },
            { label: "RAM", version: "16 GB min", note: "32 GB recommended" },
            { label: "Storage", version: "100 GB free", note: "For models and index" },
            { label: "Git", version: "2.40+", note: "For cloning the repo" },
          ].map(r => (
            <div key={r.label} className="flex items-start gap-3 p-3 bg-background border border-border rounded-md">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <span className="font-mono text-sm font-bold text-foreground">{r.label}</span>
                <span className="font-mono text-sm text-primary ml-2">{r.version}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{r.note}</p>
              </div>
            </div>
          ))}
        </div>
        <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground">
          <code>{`# Verify your setup
python --version        # 3.10+
docker --version        # 24.x+
nvidia-smi              # CUDA check (optional)
df -h                   # Disk space check`}</code>
        </pre>
      </div>
    ),
  },
  {
    id: 2,
    title: "Clone & Install",
    desc: "Get the code and install dependencies in a fresh virtual environment.",
    content: (
      <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
        <code>{`# Clone the repository
git clone https://github.com/omnilearn-ai/omnilearn.git
cd omnilearn

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate

# Install core dependencies
pip install -r requirements.txt

# Install optional GPU support (if CUDA available)
pip install -r requirements-gpu.txt

# Verify installation
python -c "import omnilearn; print(omnilearn.__version__)"
# → 1.0.0-rc.4`}</code>
      </pre>
    ),
  },
  {
    id: 3,
    title: "Configure Your First Source",
    desc: "Edit omni_config.yaml to define a single data source and model before starting the system.",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">Start with a minimal config — one source, one small model, local inference only:</p>
        <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
          <code>{`# omni_config.yaml — minimal quickstart
data_sources:
  - name: hacker_news
    type: api
    endpoint: https://hacker-news.firebaseio.com/v0
    fetch_top_n: 10
    poll_interval_seconds: 3600

model:
  name: mistralai/Mistral-7B-v0.1
  endpoint: local
  quantization: q4_k_m    # Fits in 6 GB VRAM

learning:
  mode: passive           # Start simple: just index
  interval_seconds: 7200

ethics:
  robots_txt_respect: true
  rate_limit_rps: 1

hardware:
  max_ram_gb: 16
  gpu_enabled: false      # CPU-only first run`}</code>
        </pre>
      </div>
    ),
  },
  {
    id: 4,
    title: "Download Your Model",
    desc: "Pull the model weights from HuggingFace before starting the learning engine.",
    content: (
      <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
        <code>{`# Download model weights (requires HuggingFace account for gated models)
python -m omnilearn.cli model pull mistralai/Mistral-7B-v0.1

# Or use the HuggingFace CLI directly
pip install huggingface_hub
huggingface-cli download mistralai/Mistral-7B-v0.1 \\
  --local-dir ./models/mistral-7b

# Verify model files are present
ls -lh ./models/mistral-7b/
# → config.json, tokenizer.json, model-*.safetensors`}</code>
      </pre>
    ),
  },
  {
    id: 5,
    title: "Start the System",
    desc: "Launch all services with Docker Compose for the single-machine quickstart.",
    content: (
      <div className="space-y-4">
        <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
          <code>{`# Start all services (single machine)
docker compose up -d

# Check service status
docker compose ps

# Follow logs from all services
docker compose logs -f

# Access the API
curl http://localhost:8000/query \\
  -H "Content-Type: application/json" \\
  -d '{"text": "What is the latest in AI research?"}'

# Access monitoring
open http://localhost:3000   # Grafana dashboard
open http://localhost:5000   # MLflow experiment tracker`}</code>
        </pre>
        <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-md">
          <Terminal className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">First startup will take several minutes as the vector store initializes and the model loads into memory. Check logs if services don't respond within 5 minutes.</p>
        </div>
      </div>
    ),
  },
];

const FILE_TREE = [
  { name: "omnilearn/", type: "root", depth: 0 },
  { name: "omnilearn/", type: "folder", depth: 0 },
  { name: "ingestion/", type: "folder", depth: 1 },
  { name: "connectors/", type: "folder", depth: 2 },
  { name: "crawler.py", type: "file", depth: 3 },
  { name: "rss.py", type: "file", depth: 3 },
  { name: "api.py", type: "file", depth: 3 },
  { name: "pipeline.py", type: "file", depth: 2 },
  { name: "knowledge/", type: "folder", depth: 1 },
  { name: "store.py", type: "file", depth: 2 },
  { name: "embedder.py", type: "file", depth: 2 },
  { name: "tiering.py", type: "file", depth: 2 },
  { name: "learning/", type: "folder", depth: 1 },
  { name: "engine.py", type: "file", depth: 2 },
  { name: "finetune/", type: "folder", depth: 2 },
  { name: "lora.py", type: "file", depth: 3 },
  { name: "character/", type: "folder", depth: 1 },
  { name: "engine.py", type: "file", depth: 2 },
  { name: "persona.py", type: "file", depth: 2 },
  { name: "versions/", type: "folder", depth: 2 },
  { name: "metacog/", type: "folder", depth: 1 },
  { name: "monitor.py", type: "file", depth: 2 },
  { name: "sandbox.py", type: "file", depth: 2 },
  { name: "compliance/", type: "folder", depth: 1 },
  { name: "layer.py", type: "file", depth: 2 },
  { name: "robots.py", type: "file", depth: 2 },
  { name: "api/", type: "folder", depth: 1 },
  { name: "routes.py", type: "file", depth: 2 },
  { name: "models.py", type: "file", depth: 2 },
  { name: "config/", type: "folder", depth: 0 },
  { name: "omni_config.yaml", type: "file", depth: 1 },
  { name: "schema.py", type: "file", depth: 1 },
  { name: "models/", type: "folder", depth: 0 },
  { name: "tests/", type: "folder", depth: 0 },
  { name: "unit/", type: "folder", depth: 1 },
  { name: "integration/", type: "folder", depth: 1 },
  { name: "quality/", type: "folder", depth: 1 },
  { name: "plugins/", type: "folder", depth: 0 },
  { name: "connectors/", type: "folder", depth: 1 },
  { name: "learning/", type: "folder", depth: 1 },
  { name: "personality/", type: "folder", depth: 1 },
  { name: "docker-compose.yml", type: "file", depth: 0 },
  { name: "omni_config.yaml", type: "file", depth: 0 },
  { name: "requirements.txt", type: "file", depth: 0 },
];

const TESTING = [
  { type: "Unit Tests", desc: "Each module has isolated unit tests. Mock external dependencies (HTTP, DB). Run with pytest.", cmd: "pytest tests/unit/ -v" },
  { type: "Integration Tests", desc: "Spin up Docker Compose and run end-to-end flows against real services.", cmd: "pytest tests/integration/ --integration" },
  { type: "Learning Quality", desc: "Evaluate RAG retrieval precision/recall and fine-tuned model perplexity against held-out datasets.", cmd: "python -m omnilearn.eval quality --split tests/quality/" },
];

export default function Onboarding() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <h1 className="text-4xl font-bold tracking-tight mb-4">Developer Onboarding</h1>
        <p className="text-xl text-muted-foreground font-mono">
          From zero to running OmniLearn in 20 minutes.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Quickstart Steps</h2>
          {STEPS.map((step, i) => {
            const done = completed.has(step.id);
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className={`border rounded-lg overflow-hidden transition-colors ${done ? "border-primary/30 bg-primary/5" : "border-border bg-card/40"}`}
              >
                <div className="flex items-start gap-4 p-5">
                  <button
                    data-testid={`step-${step.id}`}
                    onClick={() => toggle(step.id)}
                    className="mt-0.5 shrink-0 text-primary hover:text-primary/80 transition-colors"
                  >
                    {done ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6 text-border" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">STEP {step.id}</span>
                      <h3 className="font-bold text-lg">{step.title}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">{step.desc}</p>
                    {step.content}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Directory Structure</h2>
            <div className="bg-background border border-border rounded-lg p-4 font-mono text-xs overflow-x-auto">
              {FILE_TREE.map((item, i) => {
                const indent = item.depth * 16;
                const Icon = item.type === "file" ? File : item.type === "root" ? Cpu : FolderOpen;
                const color = item.type === "file" ? "text-muted-foreground" : "text-cyan-400";
                return (
                  <div key={i} style={{ paddingLeft: indent }} className={`flex items-center gap-1.5 py-0.5 ${color}`}>
                    <Icon className="w-3 h-3 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Plugin Architecture</h2>
            <div className="bg-background border border-border rounded-lg p-4 space-y-4">
              <p className="text-xs text-muted-foreground">Drop new plugins into the <code className="text-cyan-400">plugins/</code> directory. They are auto-discovered at startup.</p>
              <pre className="text-xs font-mono text-muted-foreground leading-5">
                <code>{`# Interface contract
class ConnectorPlugin:
    name: str
    version: str

    async def stream(self):
        """Yield raw documents."""
        ...

    def validate_config(self, cfg):
        """Raise ValueError if invalid."""
        ...`}</code>
              </pre>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Package className="w-3 h-3 text-primary" />
                <span>Community plugins live in <code className="text-cyan-400">plugins/</code></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <GitBranch className="w-3 h-3 text-primary" />
                <span>Contributions via PR to <code className="text-cyan-400">main</code> branch</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Testing Strategy</h2>
            <div className="space-y-3">
              {TESTING.map(t => (
                <div key={t.type} className="bg-background border border-border rounded-lg p-4">
                  <div className="font-mono text-sm font-bold text-foreground mb-1">{t.type}</div>
                  <p className="text-xs text-muted-foreground mb-2">{t.desc}</p>
                  <code className="text-xs text-primary font-mono bg-primary/5 px-2 py-1 rounded block">{t.cmd}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
