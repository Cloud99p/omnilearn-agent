# OmniLearn Training Data - Bulk Import

**Ready-to-paste content for the Training page**

Copy and paste each section separately to build comprehensive knowledge across different domains.

---

## 1. OmniLearn Core Identity (Paste as one block)

```
OmniLearn is an open-source AI agent platform that continuously learns and evolves through user interactions. Unlike traditional chatbots that reset after each session, OmniLearn permanently retains knowledge in a structured knowledge graph.

The platform was created by Emmanuel with the vision of building AI that truly learns and adapts like humans do, rather than just processing queries and forgetting everything.

OmniLearn's core philosophy is that AI should be personal, private, and owned by the individual user - not controlled by large corporations in the cloud.

The system uses Hebbian learning principles inspired by neuroscience, where connections between knowledge nodes strengthen over time through repeated activation and association.

OmniLearn treats the entire internet as its potential data center while keeping all actual knowledge storage local to the user's control.
```

---

## 2. Architecture & Technical Stack (Paste as one block)

```
OmniLearn is built as a pnpm monorepo with TypeScript across all packages. The frontend uses React with Vite for fast development and production builds.

The backend is an Express.js server that handles API requests, knowledge graph operations, and response synthesis. It uses Server-Sent Events (SSE) for real-time streaming responses.

The database is PostgreSQL managed through Supabase, with Drizzle ORM for type-safe database operations and migrations.

Authentication is handled by Clerk, which provides user management, session handling, and OAuth integrations including Google sign-in.

The knowledge graph consists of nodes (atomic units of knowledge) and edges (typed relationships between nodes). Each node has a confidence score, type classification, and associated tags.

TF-IDF (Term Frequency-Inverse Document Frequency) is used for semantic retrieval, measuring word importance to find relevant knowledge nodes for any given query.

The system runs on a free-tier architecture: Vercel for frontend hosting, Railway for backend deployment, and Supabase for database storage.
```

---

## 3. Character System Deep Dive (Paste as one block)

```
OmniLearn's character system tracks seven evolving personality traits that shape how the agent communicates and behaves over time.

Curiosity drives the agent's eagerness to explore new topics and ask follow-up questions. High curiosity makes responses more exploratory and question-heavy.

Confidence affects how certain the agent sounds when providing information. High confidence comes from having many high-quality knowledge nodes on a topic.

Caution determines how carefully the agent handles uncertainty and potential contradictions. High caution leads to more hedged statements and acknowledgment of limitations.

Technical depth influences the complexity and specificity of explanations. High technical depth enables detailed, jargon-rich responses for expert users.

Empathy shapes how the agent responds to emotional content and personal disclosures. High empathy leads to more supportive and understanding responses.

Verbosity controls response length and detail level. High verbosity produces longer, more comprehensive answers while low verbosity keeps things concise.

Creativity affects how the agent connects disparate ideas and generates novel insights. High creativity leads to more analogies and cross-domain connections.

Each trait evolves gradually based on learning events, conversation patterns, and the types of content the agent processes. The evolution is tracked in a historical log that can be reviewed over time.
```

---

## 4. Memory Systems Explained (Paste as one block)

```
OmniLearn implements a multi-tier memory architecture inspired by human cognitive systems.

Short-term memory holds the current conversation context, typically the last 10-20 message exchanges. This enables coherent multi-turn conversations and contextual understanding.

Long-term memory is the knowledge graph itself - persistent storage that survives across sessions and accumulates over the lifetime of the instance.

Episodic memory records specific events and conversations, including timestamps, topics discussed, and knowledge that was learned during each interaction.

Semantic memory contains general facts, concepts, and relationships extracted from conversations and training data - this is the core knowledge graph content.

Working memory is the active set of knowledge nodes retrieved during query processing, used to construct responses in real-time.

The memory consolidation process periodically reviews and strengthens important connections while allowing less-used knowledge to gradually fade, similar to human memory optimization.
```

---

## 5. Learning Mechanisms (Paste as one block)

```
Hebbian learning in OmniLearn follows the principle that "neurons that fire together, wire together." When two knowledge nodes are frequently accessed together, their connection strength increases.

The system uses SHA-256 proof chains to create verifiable learning trails, documenting when and how each piece of knowledge was acquired.

Ontology self-reflection is a background process that periodically evaluates the knowledge graph structure, identifying gaps, contradictions, and optimization opportunities.

Knowledge extraction uses pattern matching and natural language processing to identify factual statements, opinions, rules, and concepts from conversational text.

Confidence scoring assigns reliability weights to knowledge based on source quality, content clarity, and consistency with existing knowledge.

The learning log tracks all knowledge acquisition events with timestamps, source classification, and impact on character traits.
```

---

## 6. AI/ML Concepts (Paste as one block)

```
Machine learning is a subset of artificial intelligence where systems improve at tasks through experience rather than explicit programming.

Deep learning uses multi-layer neural networks to learn hierarchical representations of data, excelling at image, speech, and language tasks.

Transformers are neural network architectures that use self-attention mechanisms to process sequences in parallel, enabling large language models.

Embeddings are dense vector representations of text that capture semantic meaning, enabling mathematical operations on concepts and similarity comparisons.

Retrieval-Augmented Generation (RAG) combines knowledge retrieval with text generation, grounding AI responses in factual information rather than pure generation.

Fine-tuning adapts pre-trained models to specific domains by training on smaller, specialized datasets while preserving general capabilities.

Prompt engineering is the practice of designing inputs that guide AI models toward desired outputs, leveraging understanding of model behavior and biases.

Vector databases store embeddings for efficient similarity search, enabling semantic retrieval across large knowledge bases.
```

---

## 7. Web Development Concepts (Paste as one block)

```
APIs (Application Programming Interfaces) define how software components communicate, specifying available operations, data formats, and protocols.

REST is an architectural style for APIs using HTTP methods (GET, POST, PUT, DELETE) to perform operations on resources identified by URLs.

Server-Sent Events (SSE) enable servers to push real-time updates to clients over a single persistent HTTP connection, ideal for streaming responses.

CORS (Cross-Origin Resource Sharing) is a security mechanism that controls which domains can access resources from a web server.

OAuth 2.0 is an authorization framework that enables applications to access user data without handling passwords, using token-based authentication.

TypeScript is a strongly-typed superset of JavaScript that adds static types, enabling better tooling, refactoring, and error detection.

PostgreSQL is an advanced open-source relational database supporting complex queries, transactions, and JSONB for semi-structured data.

Drizzle ORM is a TypeScript ORM that provides type-safe database operations with minimal abstraction overhead.
```

---

## 8. Deployment & DevOps (Paste as one block)

```

Vercel is a frontend hosting platform optimized for Next.js and static sites, with automatic HTTPS, CDN distribution, and preview deployments.

Railway is a cloud platform that deploys applications from GitHub with automatic builds, environment variables, and managed infrastructure.

Supabase provides managed PostgreSQL databases with real-time subscriptions, authentication, and storage in a single platform.

CI/CD pipelines automate testing and deployment, running checks on every commit and deploying to production when all gates pass.

Containerization with Docker packages applications with all dependencies, ensuring consistent behavior across development and production environments.

Environment variables store configuration separately from code, enabling different settings for development, staging, and production without code changes.

Health check endpoints provide real-time status information about application health, database connectivity, and external service dependencies.

Rate limiting protects APIs from abuse by restricting the number of requests from a single source within a time window.
```

---

## 9. Project Management & Workflow (Paste as one block)

```

GitHub is a code hosting platform with version control, issue tracking, code review, and collaboration features for software development teams.

Git is a distributed version control system that tracks code changes, enables branching and merging, and maintains complete project history.

Agile methodology emphasizes iterative development, frequent releases, and adaptive planning based on user feedback and changing requirements.

Sprints are time-boxed development cycles, typically 1-2 weeks, where specific features or improvements are completed and shipped.

Retrospectives are regular meetings where teams reflect on what went well, what didn't, and how to improve processes for the next cycle.

Roadmaps are strategic plans outlining major milestones, features, and goals over a defined time horizon, typically quarters or years.

Documentation is essential for knowledge transfer, onboarding new team members, and maintaining institutional knowledge over time.

Code reviews are peer evaluations of code changes before merging, catching bugs, improving quality, and sharing knowledge across the team.
```

---

## 10. Personal Context (Customize and Paste)

```

Emmanuel is the creator and primary developer of OmniLearn, building the platform with a vision of personal, evolving AI that truly learns.

The project started as an exploration of how AI agents could maintain persistent knowledge and evolve their capabilities over time through interaction.

OmniLearn represents a belief that AI should augment human intelligence rather than replace it, serving as a personal knowledge companion.

The development philosophy emphasizes building in public, learning from the community, and contributing back to open-source ecosystems.

Key influences include neuroscience research on memory formation, knowledge graph theory, and the vision of truly personal computing.
```

---

## How to Use This Training Data

### Method 1: Bulk Training Page

1. Go to **Intelligence → Training** in your OmniLearn dashboard
2. Select **Source: manual**
3. Copy one section above
4. Paste into the text area
5. Click **Train** to ingest
6. Repeat for each section

### Method 2: Chat-Based Learning

1. Go to **Chat**
2. Switch to **Local** or **Native** mode
3. Have conversations using the content above
4. OmniLearn will automatically extract and store knowledge

### Method 3: API Import (Advanced)

```bash
curl -X POST https://workspaceapi-server-production-29ee.up.railway.app/api/brain/train \
  -H "Content-Type: application/json" \
  -d '{"text": "[paste content here]", "source": "manual_training"}'
```

---

## Expected Results After Training

| Training Section    | Knowledge Nodes | Connections |
| ------------------- | --------------- | ----------- |
| Core Identity       | +5-8            | +10-15      |
| Architecture        | +10-15          | +20-30      |
| Character System    | +8-12           | +15-25      |
| Memory Systems      | +8-10           | +15-20      |
| Learning Mechanisms | +8-12           | +20-30      |
| AI/ML Concepts      | +10-15          | +15-25      |
| Web Development     | +10-15          | +15-25      |
| Deployment          | +8-12           | +10-20      |
| Project Management  | +8-10           | +10-15      |
| Personal Context    | +5-8            | +5-10       |

**Total expected after all training:** ~200-250 knowledge nodes, ~150-250 connections

---

## Testing Your Knowledge Base

After training, test OmniLearn with these queries:

**Identity & Architecture:**

- "What is OmniLearn and who created it?"
- "How does the knowledge graph work?"
- "What's the difference between Local and Native mode?"

**Character System:**

- "What are the 7 character traits?"
- "How does curiosity affect responses?"
- "How does the character evolve over time?"

**Technical Concepts:**

- "Explain TF-IDF in simple terms"
- "What is Hebbian learning?"
- "How does RAG work?"

**Deployment:**

- "Where is OmniLearn hosted?"
- "What database does it use?"
- "How does authentication work?"

---

**Pro tip:** Train in multiple sessions rather than all at once. This gives the ontology reflection process time to organize knowledge and build better connections between concepts.

---

**Last Updated:** May 7, 2026  
**Total Training Content:** ~10 sections, 2000+ words  
**Estimated Training Time:** 15-20 minutes (all sections)
