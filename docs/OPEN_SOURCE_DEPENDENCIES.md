# Open-Source Dependencies

## Installed (Phase 1)
| Package | Licence | Why |
|---|---|---|
| next 15, react 19 | MIT | App framework |
| tailwindcss 4 | MIT | Styling with tokens |
| shadcn/ui + @base-ui/react | MIT | Accessible primitives (copied into `components/ui`) |
| lucide-react | ISC | Icons |
| zustand | MIT | Persisted demo session state |
| zod | MIT | Request validation in provider contracts |
| gsap + @gsap/react | GSAP standard licence (free, incl. commercial) | Purposeful motion |
| sonner | MIT | Toasts |
| clsx, tailwind-merge, class-variance-authority | MIT | Class utilities |

## Added in Phase 4
| Package | Licence | Why |
|---|---|---|
| @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities | MIT | Collection board reordering with pointer and keyboard sensors |

React Konva was evaluated and **not** added: the canvas is a single SVG plus positioned pins, which DOM handles accessibly.

## Dev / test (Phase 2)
| Package | Licence | Why |
|---|---|---|
| vitest 3 | MIT | Unit + component tests |
| @testing-library/react, user-event, jest-dom | MIT | UI interaction tests |
| jsdom | MIT | Browser environment for tests |

## Planned, add only when the phase needs it
| Package | Phase | Why |
|---|---|---|
| @tanstack/react-query | Pilot | Server state once `/api/v1` exists |
| prisma, pg | Pilot | Database |

Model weights are never installed in this project.
