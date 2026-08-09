# Todo List Widget

The Todo List widget provides an interactive interface for managing todos with support for marking items as complete and recurring tasks.

## Features

- ✅ **Mark items as done** - Click the checkbox icon to toggle completion status
- 🔄 **Recurring todos** - Support for daily, weekly, monthly, and yearly recurring tasks
- 🗑️ **Delete todos** - Remove items from the list
- 🔁 **Reset recurring todos** - Easily reset completed recurring tasks for the next cycle
- 📊 **Visual organization** - Active and completed sections with item counts
- 💾 **Auto-save** - Changes are automatically saved to the notebook entry

## Creating a Todo List Entry

To create a new todo list widget in your notebook, use the API endpoint:

```bash
curl -X POST http://localhost:5173/api/notebook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "slug": "my-todo-list",
    "title": "My Todo List",
    "type": "todo-list",
    "owner": "user-id",
    "visibility": "family",
    "tags": ["personal", "daily"],
    "body": "## My tasks for today",
    "data": {
      "items": [
        {
          "id": "todo-1",
          "text": "Complete project milestone",
          "done": false,
          "recurring": "weekly"
        },
        {
          "id": "todo-2",
          "text": "Review pull requests",
          "done": false,
          "recurring": "daily"
        }
      ]
    }
  }'
```

## Data Structure

Each todo item has the following structure:

```typescript
interface TodoItem {
  id: string;                    // Unique identifier (auto-generated)
  text: string;                  // The todo task description
  done: boolean;                 // Completion status
  dueDate?: string;              // Optional due date (YYYY-MM-DD format)
  recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly';  // Recurrence pattern
}
```

## Example Markdown Entry

To create a todo list via markdown file, structure your entry like this:

```markdown
---
title: Weekly Tasks
type: todo-list
owner: user-123
visibility: family
tags: [weekly, work]
created: 2026-08-08
updated: 2026-08-08
items:
  - id: todo-1
    text: "Monday team sync"
    done: false
    recurring: weekly
  - id: todo-2
    text: "Code review"
    done: false
    recurring: daily
  - id: todo-3
    text: "Project planning"
    done: true
---

## Weekly Recurring Tasks

These are the tasks that repeat every week.
```

## Using the Widget UI

### Adding a New Todo

1. Enter the task description in the "Add a new todo..." input field
2. Select a recurrence pattern from the dropdown (Once, Daily, Weekly, Monthly, Yearly)
3. Click the "Add" button or press Enter
4. The new todo will appear in the Active section

### Marking a Todo as Complete

1. Click the circle icon next to any active todo
2. The icon will change to a checkmark and the item moves to the Completed section
3. The change is automatically saved

### Resetting a Recurring Todo

1. Find the completed recurring task in the Completed section
2. Click the "Reset" button
3. The todo will move back to Active with done status reset to false
4. The recurrence pattern is maintained

### Deleting a Todo

1. Click the trash icon on any todo item
2. The item will be immediately removed from the list
3. The change is automatically saved

## API Updates

All changes made through the UI are automatically saved by making PUT requests to:

```
PUT /api/notebook/{slug}
Content-Type: application/json
X-API-Key: {api-key}

{
  "data": {
    "items": [...]  // Updated todo items array
  }
}
```

## Styling

The widget follows the family-net design system with:
- Responsive layout that adapts to different screen sizes
- Color-coded status indicators (blue for active, green for completed)
- Hover effects for better interactivity
- Clear visual separation between active and completed sections

## Accessibility

- All interactive elements are keyboard accessible
- Buttons have clear titles and labels
- Color is not the only indicator of status (icons and text provide context)
- Proper semantic HTML structure

## Future Enhancements

Potential features that could be added:
- Due dates with date picker
- Priority levels
- Assignees for family members
- Progress tracking and statistics
- Subtasks and task dependencies
- Custom recurrence patterns
- Due date notifications
