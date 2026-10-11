export function getIssueDate(issue: { sentAt?: Date; startedAt?: Date } | null | undefined) {
	return issue?.sentAt || issue?.startedAt || null;
}
