# 🧠 TRAE AI Prompt – Bug & Task Management System (Frontend Only)

## 🎯 Objective
Build a **React.js frontend-only web application** for a **Bug & Task Management System** (like Bugzilla + Task Tracker) using the **Material Tailwind Dashboard React** theme library.  
Follow the **TRAE AI Implementation Guidelines (AIG.md)** strictly — ensuring developer-, QA-, user-, and security-friendly standards.

---

## ⚙️ Project Setup Requirements
1. **Frontend Only**
   - Create all code under the `frontend/` folder.
   - No backend or database setup.
   - Use `Vite` for React project setup.
   - Use `react-router-dom` for routing.
   - All pages should be inside `frontend/src/pages/`.

2. **Styling & Theme**
   - Use **Tailwind CSS** for all styling.
   - Base theme: **Material Tailwind Dashboard React**.
   - Design must be **completely responsive** for desktop, tablet, and mobile.
   - White, modern, minimal design with soft shadows and rounded corners.
   - Use `lucide-react` icons and `shadcn/ui` components where needed.

3. **UI/UX Standards**
   - Clean hierarchy (Headings > Content > Buttons).
   - Smooth transitions and hover effects.
   - Clear error messages, tooltips, and input hints.
   - Maintain consistent spacing, typography, and visual clarity.
   - Every user flow must have explicit success/error states.

---

## 🧩 Modules & Pages to Create
### 1. 🏠 Dashboard
- Overview of open bugs, pending tasks, and project statistics.
- Quick summary cards: “Open Bugs”, “Closed Bugs”, “Active Tasks”, “Completed Tasks”.

### 2. 🐞 Bug Management
- **List View**: Bug ID, Title, Severity, Assigned To, Status.
- **Bug Details Page**: Description, Comments, Attachments, Status Updates.
- **Create/Edit Bug Page**: Form with validation, priority, and assignee dropdown.

### 3. ✅ Task Management
- **List View**: Task Title, Assignee, Due Date, Status, Progress Bar.
- **Task Details Page**: Description, Subtasks, Attachments, and Comments.
- **Create/Edit Task Page**: Form with validation and deadline inputs.

### 4. 👤 User Management
- **List of Users** with role (Admin, Developer, Tester).
- **Add/Edit User** form with validations.
- Manage role-based UI visibility (Admin-only features).

### 5. ⚙️ Settings Page
- Light/Dark mode toggle.
- Profile settings and notification preferences.

### 6. 🚫 NotFound Page (404)
- Friendly error page with link to home/dashboard.

---

## 🧠 Functional Notes
- Implement reusable components: `Button`, `Card`, `Modal`, `Table`, `FormField`, etc.
- Include a global loading spinner and skeleton loader for list pages.
- Use mock JSON data or simple state management for demo content.
- Include sample routes for all modules.

---

## 🔐 Guidelines to Follow
- No fallback logic — handle all errors explicitly.
- Follow **DRY, KISS, SOLID** principles.
- Optimize for performance, reusability, and clarity.
- No hardcoded secrets or sensitive info.
- Follow **AIG.md** for all quality, QA, and performance standards.

---

## 🚀 Expected Outcome
After running `npm install` and `npm run dev`,  
the app should open a **fully responsive Material Tailwind Dashboard UI** with the above modules, pages, and routes working (mock data only).

**No backend logic or APIs should be created.**
