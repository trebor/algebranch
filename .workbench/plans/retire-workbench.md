---
status: active
issue: "none"
branch: feat/retire-workbench
updated: 2026-06-12
---

# #00 Retire Workbench System and Transition to GitHub-Native Flow

## 1. Goal
Retire the `.workbench/` directory and all its files (`INDEX.md`, `plans/`, `archive/`, `notes/`) and transition all status tracking and technical blueprints directly to the GitHub Project Board and GitHub Issues.

---

## 2. Target Workflow
1. **Board Status Columns**:
   - `Inbox` (Raw thoughts/bugs)
   - `Planning` (Design/blueprints being drafted in comments/descriptions)
   - `Planned` (Plan/checklist finalized in the issue body, ready for coding)
   - `In progress` (Code changes being implemented)
   - `Done` (Merged to main, issue closed)
2. **Blueprints**: Linked directly in the issue body/description.
3. **No Local State**: No local files to create, rename, commit, or delete for planning.

---

## 3. Execution Steps

### Step 1: User UI Updates
- [ ] User renames columns on GitHub Project 6 web interface to:
  - `Inbox`
  - `Planning`
  - `Planned`
  - `In progress`
  - `Done`

### Step 2: Re-align Issue Statuses
- [ ] Query and map all current issues on Project 6.
- [ ] Use `gh project item-edit` to map:
  - `Backlog` -> `Inbox`
  - `Research` -> `Planning`
  - `Ready` -> `Planning` (or `Planned` if they have plans)

### Step 3: Evacuate Active Plans to GitHub
- [ ] Copy the content of `.workbench/plans/issue-54-library-cleanup.md` and paste it as a description/comment in GitHub Issue #54.
- [ ] If there are any other active/relevant plans in `plans/` or `archive/`, ensure they are represented in their GitHub issues.

### Step 4: Update Project Guidelines
- [ ] Modify `rules.md` (and `AGENTS.md`) to:
  - Remove all mentions of `.workbench/` and `INDEX.md`.
  - Define the new GitHub-native planning guidelines (branch naming, reading issue body, posting progress updates via `gh` CLI).

### Step 5: Clean Up Repository
- [ ] Run `git rm -r .workbench` to delete the workbench directory.
- [ ] Verify clean status and that all tests still pass.
- [ ] Commit, push, and merge the cleanup.
