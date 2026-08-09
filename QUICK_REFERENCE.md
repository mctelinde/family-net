# Quick Reference: Todo List Widget

## What's New

Your family-net notebook now includes a **Todo List Widget** that allows you to:
- ✅ Mark tasks as complete with one click
- 🔄 Set up recurring tasks (daily, weekly, monthly, yearly)
- 💾 Automatically save changes
- 👨‍👩‍👧‍👦 Share lists with family members

## Quick Start

### 1. View the Example
Navigate to: `http://localhost:5173/notebook/daily-tasks`

This shows a sample todo list with different recurrence patterns.

### 2. Add a New Todo
1. Type your task in the "Add a new todo..." input field
2. Select a recurrence pattern (Daily, Weekly, Monthly, Yearly, or Once)
3. Click "Add" or press Enter
4. The task appears in the Active section

### 3. Complete a Task
- Click the ⭕ circle icon next to any task
- It moves to the Completed section with a ✅ checkmark

### 4. Reset a Recurring Task
- For completed recurring tasks, click the "Reset" button
- The task moves back to Active for the next cycle

### 5. Delete a Task
- Click the 🗑️ trash icon to remove a task permanently

## Creating Your Own Lists

### Option 1: Via Markdown File
Create a file in `data/entries/my-list.md`:

```markdown
---
title: My Task List
type: todo-list
owner: your-username
visibility: family
items:
  - id: task-1
    text: "First task"
    done: false
    recurring: daily
---

# My Tasks
```

Then access at: `http://localhost:5173/notebook/my-list`

### Option 2: Via API
```bash
curl -X POST http://localhost:5173/api/notebook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{
    "slug": "my-todos",
    "title": "My Todos",
    "type": "todo-list",
    "owner": "you",
    "visibility": "family",
    "data": {
      "items": []
    }
  }'
```

## Key Features Explained

### Recurrence Options
- **Once**: One-time task, stays in Completed when done
- **Daily**: Repeats every day
- **Weekly**: Repeats every 7 days
- **Monthly**: Repeats every month
- **Yearly**: Repeats every year

### Visual Organization
- **Active Section**: Uncompleted tasks (blue counter)
- **Completed Section**: Finished tasks (gray counter)
- **Empty State**: Friendly message when no tasks exist

### Auto-Save
- Changes save immediately after any action
- No manual save button needed
- Error messages appear if save fails

## Data Storage

Todos are stored in the frontmatter of markdown files:

```yaml
---
title: Task List
type: todo-list
items:
  - id: todo-1234567890-abc123
    text: "Task description"
    done: false
    recurring: weekly
---
```

## Sharing & Permissions

- Set `visibility: family` to share with all family members
- Set `visibility: private` to keep it personal
- Only the entry owner or admins can edit

## Tips & Tricks

1. **Naming**: Use descriptive task names for clarity
2. **Organization**: Create separate lists for different areas (work, home, personal)
3. **Recurring Tasks**: Perfect for habits, chores, and recurring responsibilities
4. **Completed Lists**: Archive old lists by renaming them with dates

## Troubleshooting

### Changes not saving?
- Check browser console (F12) for errors
- Ensure you're logged in
- Try refreshing the page

### Can't see my changes?
- Wait a moment for the auto-save to complete
- Look for the loading indicator
- Check that you have edit permissions

### Task won't delete?
- Try again - there may be a temporary network issue
- Check browser console for errors
- Refresh and try deleting again

## File Structure

```
src/lib/widgets/
  └── TodoList.svelte          (The widget component)

src/routes/notebook/[slug]/
  └── +page.server.ts          (Handles todo updates)

data/entries/
  └── daily-tasks.md           (Example todo list)
```

## Documentation

- Full documentation: `TODO_LIST_WIDGET.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- Example data file: `data/entries/daily-tasks.md`

---

**Enjoy organizing your family tasks! 📋✨**
