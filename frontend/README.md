# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## UI Layout & Button Component

This app uses a single responsive layout source and a shared Button component to ensure consistency across pages:

- Layout rules:
  - Sidebar is `fixed` at `w-64` and visible on `sm` and above; it slides in on mobile.
  - `<main>` uses `sm:ml-64` so the left offset is applied only when the sidebar is visible (no double offset on mobile).
  - Z-index order: sidebar `z-30`, mobile overlay/drawer `z-40`, modal `z-50`.

- Shared Button (`src/components/ui/Button.jsx`):
  - Props: `variant` (`primary` | `secondary` | `ghost`), `size` (`sm` | `md` | `lg`), `ariaLabel`, `className`, and common button attributes.
  - Variants:
    - `primary`: `bg-[#445A4A] text-white hover:bg-[#3B4E41]`
    - `secondary`: `bg-white text-[#445A4A] border border-[#DDE6D5] hover:bg-[#F6F8F5]`
    - `ghost`: `bg-transparent text-[#445A4A] hover:text-[#3B4E41]`
  - Sizes provide consistent padding and font sizing, and buttons use `inline-flex items-center gap-2` for icon alignment.

- Usage examples:
  - Create buttons on Bugs/Tasks/Users pages:
    ```jsx
    import Button from "./src/components/ui/Button";
    <Button variant="primary" size="md" onClick={onCreate}>+ Create Task</Button>
    ```
  - Modal actions use `secondary` for cancel and `primary` for confirm.

Avoid page-level hardcoded paddings like `pl-64`; rely on `MainLayout` for offsets and responsive behavior.
