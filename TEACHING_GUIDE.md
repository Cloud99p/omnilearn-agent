# Teaching Guide - What to Teach OmniLearn

**OmniLearn automatically learns from your conversations** - but knowing what to teach helps it build better knowledge.

---

## ✅ DO Teach

### Personal Information
- Your name, role, projects
- Your preferences and opinions
- Your work and interests
- Relationships and connections

**Examples:**
```
My name is Emmanuel and I'm building OmniLearn
I prefer TypeScript over JavaScript for large projects
I'm interested in AI, machine learning, and knowledge graphs
```

### Domain Knowledge
- Technical concepts and definitions
- Industry facts and best practices
- Historical information
- Scientific principles

**Examples:**
```
TypeScript is a typed superset of JavaScript that compiles to plain JavaScript
Hebbian learning follows the principle "neurons that fire together, wire together"
PostgreSQL is an open-source relational database system
```

### Project Information
- Features and capabilities
- Architecture decisions
- Documentation
- Use cases

**Examples:**
```
OmniLearn has three modes: Local, Native, and Ghost
Local mode uses only the knowledge graph without web search
Native mode combines knowledge graph with web search
```

### Opinions and Perspectives
- Your thoughts on topics
- Comparisons and preferences
- Lessons learned
- Insights and realizations

**Examples:**
```
I think knowledge graphs are better than vector databases for explainable AI
The most important trait in AI systems is transparency
I learned that simplicity often beats complexity in system design
```

---

## ❌ DON'T Teach

### AI's Own Responses
Never teach the AI's responses back to it - this creates loops and corruption.

**Bad:**
```
I've learned: Emmanuel is building OmniLearn
That connects to what I've learned about AI
Based on what I've learned, TypeScript is typed
```

### Meta-Text and System Messages
Don't teach phrases about the learning process itself.

**Bad:**
```
I've added this to my knowledge base
Is there more you'd like to share about this?
Would you like me to remember this information?
Thanks for sharing. I've learned:
```

### Questions Back to the AI
Questions are for getting information, not teaching it.

**Bad:**
```
What do you think about machine learning?
Can you explain quantum computing?
Should I use React or Vue?
```

### Instructions About Learning
Don't teach the AI how to learn - it already knows.

**Bad:**
```
Remember this for later
Save this information permanently
Add this to your knowledge graph
```

### Repetitive Content
Avoid teaching the same fact multiple times - it's already learned.

---

## 🎯 Best Practices

### 1. **Be Specific**
```
✅ Good: "OmniLearn uses TF-IDF for semantic retrieval with a top-K of 6 nodes"
❌ Bad: "OmniLearn searches for information"
```

### 2. **Use Complete Sentences**
```
✅ Good: "TypeScript was created by Microsoft and first released in 2012"
❌ Bad: "TypeScript Microsoft 2012"
```

### 3. **One Fact at a Time**
```
✅ Good: "Emmanuel created OmniLearn"
         "OmniLearn uses a knowledge graph"
❌ Bad: "Emmanuel created OmniLearn which uses a knowledge graph and has three modes"
```

### 4. **Natural Conversation is Best**
Just talk naturally! OmniLearn extracts facts automatically.

```
✅ Perfect: "I've been working on OmniLearn for 6 months now. 
             It's an AI agent that learns from conversations."
```

---

## 🔍 How Learning Works

1. **You share information** (conversation or training)
2. **OmniLearn extracts facts** automatically
3. **Validation filters** out meta-text and system messages
4. **Facts are stored** in the knowledge graph with confidence scores
5. **Future responses** use this knowledge

---

## 🛡️ Safety Features

**Automatic filters prevent:**
- Meta-text ("I've learned:", "Based on what I know")
- System messages ("Is there more to share?")
- Fragments (< 20 characters)
- Run-on content (> 500 characters)
- Duplicates (similarity > 85%)

**You don't need to worry** - the system protects itself from corrupted learning!

---

## 📊 Examples

### Good Training Input

```
Emmanuel is a software developer based in Nigeria. He created OmniLearn 
to explore how AI agents can continuously learn and evolve through 
user interactions.

OmniLearn is built with TypeScript, React, Express, and PostgreSQL. 
It uses a pnpm monorepo structure with multiple packages.

The knowledge graph stores information as nodes (facts) and edges 
(relationships). TF-IDF semantic search finds relevant knowledge.

Hebbian learning strengthens connections between related nodes over time, 
inspired by how human brains form memories.
```

### Bad Training Input

```
I've learned: Emmanuel is a developer
That connects to what I've learned about OmniLearn
Based on what I know, it uses TypeScript
Is there more you'd like to share about this?
Would you like me to remember this?
Thanks for sharing. I've added this to my knowledge base.
```

---

## 🧪 Test Your Teaching

After teaching something, ask:

```
What do you know about [topic]?
```

**Good response:** Clear, accurate information  
**Bad response:** Meta-text, repetition, or "I haven't learned about that"

If the response is bad, try teaching again with clearer, more specific information.

---

## 💡 Pro Tips

1. **Teach through conversation** - Most natural way to share knowledge
2. **Review knowledge periodically** - Check what OmniLearn has learned
3. **Correct mistakes** - If it learned something wrong, teach the correct version
4. **Build on existing knowledge** - Reference what it already knows
5. **Be patient** - Learning is gradual, like teaching a person

---

**Remember:** OmniLearn is designed to learn naturally from conversation. You don't need special commands or formats - just share information naturally! 🎯

---

**Last Updated:** May 7, 2026  
**Version:** 1.0.0
