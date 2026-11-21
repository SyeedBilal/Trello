export interface BoardSummaryInput {
  board: { title: string; description: string | null };
  currentDate: string;
  lists: Array<{
    name: string;
    status: 'completed' | 'inProgress' | 'pending';
    cards: Array<{
      title: string;
      description: string | null;
      priority: 'LOW' | 'MEDIUM' | 'HIGH';
      dueDate: string | null;
      labels: string[];
      status: 'completed' | 'inProgress' | 'pending';
    }>;
  }>;
  statistics: {
    totalTasks: number;
    completed: number;
    inProgress: number;
    pending: number;
    completionPercentage: number;
  };
  overdueTasks: Array<{ title: string; dueDate: string }>;
  highPriorityTasks: Array<{ title: string; dueDate: string | null }>;
}

export function buildSummaryPrompt(input: BoardSummaryInput) {
  const system = `You are a project management assistant. Analyze only the supplied board data.
Base every conclusion on the supplied titles, descriptions, list names, priorities, due dates, labels, and backend-computed statistics.
Do not invent tasks, deadlines, progress, or project information.
Status labels are classification hints based on list membership: completed means completion-oriented list names, inProgress means active/work-in-progress-oriented list names, and pending means all remaining lists.
A bottleneck must include evidence that is directly visible in the supplied data.
Return only valid JSON with exactly these keys: "overview", "bottlenecks", "recommendedActions".
"overview" must be a concise project summary.
"bottlenecks" must contain objects with "issue" and "evidence".
"recommendedActions" must contain practical strings.
Clearly state that information is insufficient when the board has too little data.`;

  const user = `Current server date: ${input.currentDate}
Board data:
${JSON.stringify(input)}

Respond with JSON only.`;

  return { system, user };
}
