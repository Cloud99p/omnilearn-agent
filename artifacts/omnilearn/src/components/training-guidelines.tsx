import { cn } from "../lib/utils";

export function TrainingGuidelines() {
  return (
    <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
      <h3 className="text-sm font-semibold mb-3">💡 What to Teach OmniLearn</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {/* DOs */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <span className="text-lg">✅</span>
            <span className="font-semibold">DO Teach:</span>
          </div>
          <ul className="space-y-1.5 text-muted-foreground ml-6">
            <li>• Facts about you (name, projects, preferences)</li>
            <li>• Information about your work or interests</li>
            <li>• Domain knowledge you want to remember</li>
            <li>• Concepts, definitions, explanations</li>
            <li>• Your opinions and perspectives</li>
            <li>• Historical facts or technical details</li>
          </ul>
        </div>

        {/* DON'Ts */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <span className="text-lg">❌</span>
            <span className="font-semibold">DON'T Teach:</span>
          </div>
          <ul className="space-y-1.5 text-muted-foreground ml-6">
            <li>• The AI's own responses</li>
            <li>• System messages or meta-text</li>
            <li>• Phrases like "I've learned:" or "Based on..."</li>
            <li>• Questions back to the AI</li>
            <li>• Instructions about how to learn</li>
            <li>• Repetitive or duplicate content</li>
          </ul>
        </div>
      </div>

      {/* Examples */}
      <div className="mt-4 pt-4 border-t border-border">
        <h4 className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
          Examples
        </h4>

        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-green-600">✅</span>
            <code className="px-2 py-1 rounded bg-green-500/10 text-green-700 dark:text-green-400">
              "Emmanuel is the creator of OmniLearn"
            </code>
          </div>
          <div className="flex gap-2">
            <span className="text-green-600">✅</span>
            <code className="px-2 py-1 rounded bg-green-500/10 text-green-700 dark:text-green-400">
              "TypeScript is a typed superset of JavaScript"
            </code>
          </div>
          <div className="flex gap-2">
            <span className="text-red-600">❌</span>
            <code className="px-2 py-1 rounded bg-red-500/10 text-red-700 dark:text-red-400">
              "I've learned: TypeScript is a typed superset"
            </code>
          </div>
          <div className="flex gap-2">
            <span className="text-red-600">❌</span>
            <code className="px-2 py-1 rounded bg-red-500/10 text-red-700 dark:text-red-400">
              "That connects to what I've learned about JavaScript"
            </code>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        💡 <strong>Tip:</strong> OmniLearn automatically extracts knowledge from
        conversations. You don't need to use special formats - just share
        information naturally!
      </p>
    </div>
  );
}
