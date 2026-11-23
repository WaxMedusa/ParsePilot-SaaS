# Agent workflow

Read STATE.json and README.md before work. Resume the active task or start its approved followUp; otherwise wait for human direction.
STATE is the sole task definition: goal, criteria, scope, constraints, current, next, blocked.
Read further docs or relevant source only as needed; no mandatory layer traversal.
Run checks, update necessary usage docs, verify, then close with a knowledge summary.
Docs contain purpose and usage only. Notes and temporary findings are optional.
Re-read state before writing; human changes invalidate old verification. Never overwrite new human intent.
Keep modifications in Git task branches. Use git_status to resume, git_create to allocate a worktree before assigning a writing delegate; explicitly set its working directory and allowed paths. Read-only delegates need no branch.
Review git_diff, git_commit, then test and git_verify the exact commit. Integrate verified workers into the managed coordinator only; test the combined result again. Main merge/push requires human approval. Never stash/reset user changes automatically.
