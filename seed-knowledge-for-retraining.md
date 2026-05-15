# Seed Knowledge for Manual Retraining

Organized by category. Paste each into the **Intelligence → Train** panel (Manual source).

---

## OmniLearn Basics

1. **What is OmniLearn**
   ```
   OmniLearn is an open-source AI agent that continuously learns and evolves on your own hardware
   ```

2. **Ownership & Privacy**
   ```
   OmniLearn belongs only to the person running it — no cloud dependency, no shared data
   ```

3. **Core Philosophy**
   ```
   OmniLearn's core philosophy is that AI should be personal, private, and owned by the individual user - not controlled by large corporations in the cloud
   ```

4. **Vision**
   ```
   The platform was created by Emmanuel with the vision of building AI that truly learns and adapts like humans do, rather than just processing queries and forgetting everything
   ```

5. **Unlike Traditional Chatbots**
   ```
   Unlike traditional chatbots that reset after each session, OmniLearn permanently retains knowledge in a structured knowledge graph
   ```

---

## Knowledge Graph Architecture

6. **Knowledge Graph Structure**
   ```
   OmniLearn uses a knowledge graph architecture
   ```

7. **Nodes & Edges**
   ```
   The knowledge graph consists of nodes (atomic units of knowledge) and edges (typed relationships between nodes)
   ```

8. **Node Properties**
   ```
   Each node has a confidence score, type classification, and associated tags
   ```

9. **Node Types**
   ```
   Knowledge nodes represent atomic units of information including facts, concepts, opinions, and rules
   ```

10. **Knowledge Extraction**
    ```
    OmniLearn extracts structured facts from conversations using pattern matching and natural language processing
    ```

---

## Memory System

11. **Multi-Tier Memory**
    ```
    OmniLearn has a multi-tier memory system with short-term conversational, long-term knowledge graph, and episodic memory
    ```

12. **Long-Term Memory**
    ```
    Long-term memory is stored in the knowledge graph as persistent nodes that survive across sessions
    ```

13. **Episodic Memory**
    ```
    Episodic memory records specific events and conversations, including timestamps, topics discussed, and knowledge that was learned during each interaction
    ```

14. **Semantic Memory**
    ```
    Semantic memory contains general facts, concepts, and relationships extracted from conversations and training data - this is the core knowledge graph content
    ```

15. **Working Memory**
    ```
    Working memory is the active set of knowledge nodes retrieved during query processing, used to construct responses in real-time
    ```

16. **Memory Consolidation**
    ```
    The memory consolidation process periodically reviews and strengthens important connections while allowing less-used knowledge to gradually fade, similar to human memory optimization
    ```

---

## Character System (7 Traits)

17. **Character Overview**
    ```
    The character engine tracks traits including curiosity, confidence, caution, technical depth, empathy, verbosity, and creativity
    ```

18. **Trait Evolution**
    ```
    Character traits evolve gradually based on learning events, new knowledge, and conversation interactions
    ```

19. **Curiosity**
    ```
    High curiosity makes OmniLearn more eager to explore new topics and ask follow-up questions
    ```

20. **Confidence**
    ```
    High confidence comes from having many high-quality knowledge nodes on a topic
    ```

21. **Caution**
    ```
    High caution makes OmniLearn more careful about expressing uncertainty when knowledge is incomplete
    ```

22. **Technical Depth**
    ```
    High technical depth enables detailed, jargon-rich responses for expert users
    ```

23. **Empathy**
    ```
    High empathy leads to more supportive and understanding responses
    ```

24. **Verbosity**
    ```
    High verbosity produces longer, more comprehensive answers while low verbosity keeps responses brief
    ```

25. **Creativity**
    ```
    High creativity leads to more analogies and cross-domain connections
    ```

---

## Learning Modes

26. **Three Modes Overview**
    ```
    The learning system has three modes: Local (knowledge graph only), Native (knowledge + web search), and Ghost (distributed AI)
    ```

27. **Local Mode**
    ```
    Local mode means OmniLearn runs entirely on the user's own hardware without cloud services
    ```

28. **Native Mode**
    ```
    Native mode uses OmniLearn's own built-in intelligence engine without any external AI API
    ```

29. **Ghost Mode**
    ```
    Ghost mode enables distributed execution of the agent across multiple devices
    ```

---

## AI/ML Concepts

30. **Machine Learning**
    ```
    Machine learning is a subset of artificial intelligence where systems learn from data without explicit programming
    ```

31. **Deep Learning**
    ```
    Deep learning uses multi-layer neural networks to learn hierarchical representations of data, excelling at image, speech, and language tasks
    ```

32. **Transformers**
    ```
    Transformers are neural network architectures that use self-attention mechanisms to process sequences in parallel, enabling large language models
    ```

33. **Embeddings**
    ```
    Embeddings are dense vector representations of text that capture semantic meaning in high-dimensional space
    ```

34. **RAG**
    ```
    Retrieval augmented generation combines a retrieval system with a text generator for grounded responses
    ```

35. **Fine-Tuning**
    ```
    Fine-tuning adapts a pre-trained model to a specific task by training on a smaller domain-specific dataset
    ```

36. **Prompt Engineering**
    ```
    Prompt engineering is the practice of designing inputs that guide AI models toward desired outputs
    ```

37. **Hebbian Learning**
    ```
    The system uses Hebbian learning principles inspired by neuroscience, where connections between knowledge nodes strengthen over time through repeated activation and association
    ```

38. **Hebbian Principle**
    ```
    Hebbian learning in OmniLearn follows the principle that "neurons that fire together, wire together"
    ```

---

## Search & Retrieval

39. **TF-IDF Search**
    ```
    OmniLearn uses TF-IDF semantic search to find relevant knowledge when answering questions
    ```

40. **TF-IDF Definition**
    ```
    TF-IDF stands for Term Frequency-Inverse Document Frequency and measures word importance in documents
    ```

41. **Vector Databases**
    ```
    Vector databases store embeddings for efficient similarity search, enabling semantic retrieval across large knowledge bases
    ```

---

## Tech Stack

42. **Monorepo**
    ```
    OmniLearn is built as a pnpm monorepo with TypeScript across all packages
    ```

43. **Frontend**
    ```
    The frontend uses React with Vite for fast development and production builds
    ```

44. **Backend**
    ```
    The backend is an Express.js server that handles API requests, knowledge graph operations, and response synthesis
    ```

45. **Database**
    ```
    The database is PostgreSQL managed through Supabase, with Drizzle ORM for type-safe database operations and migrations
    ```

46. **Authentication**
    ```
    Authentication is handled by Clerk, which provides user management, session handling, and OAuth integrations including Google sign-in
    ```

47. **Deployment**
    ```
    The system runs on a free-tier architecture: Vercel for frontend hosting, Railway for backend deployment, and Supabase for database storage
    ```

48. **API Style**
    ```
    A REST API uses HTTP methods such as GET, POST, PUT, and DELETE to perform operations on resources
    ```

49. **SSE**
    ```
    Server-sent events enable a server to push real-time data to a client over a single HTTP connection
    ```

---

## How to Retrain

1. Go to **Intelligence** page
2. Select **Manual** source
3. Paste each fact above
4. Click **Train Knowledge**
5. Repeat for all ~50 seed nodes

**Pro tip:** Start with "OmniLearn Basics" first (5 nodes), then do "Knowledge Graph" (5 nodes), then continue category by category. This rebuilds the foundation systematically.
