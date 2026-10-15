> Current state, 15 October 2026: Phase 3 (0.3.0), stabilized on `codex/stabilize-phases-1-3`. See [current verification and remaining gates](PHASES_1-3_STABILIZATION.md) and [Antigravity handoff](ANTIGRAVITY_HANDOFF.md). Phase 4 was rolled back and will be redesigned from scratch; do not resume the old implementation or begin Phase 5. Seven migration files preserve existing hosted history; retained Phase 4 tables are dormant. Original-path extension identity and unverified privileged-key rotation remain explicit owner requirements. The product vision below is historical context, not approval to rebuild.
>
> This is the original Phase 0 brief, preserved for reference. Sections 9–10 describe the initial context task; later user instructions set the active phase.

> Mascot authority: [OHMI_MASCOT.md](OHMI_MASCOT.md) defines the approved pixel-art PNG assets. Use its front image for the future floating mascot and its six-view sheet for future animation reference. The original 3D-style wording below is historical; these assets are 2D illustrations, not rigged models.

# OHMI — Project Context and Development Guidelines

Act as an experienced senior full-stack developer, Chrome extension engineer, AI integration specialist, and UI/UX designer.

We are developing a project called **OHMI**, an intelligent, interactive AI learning companion designed specifically for students using Autodesk Tinkercad Circuits.

Before starting development, I want you to fully understand our project, its goals, features, architecture, and design principles.

**IMPORTANT: This is a context initialization task only. Do not start implementing the application, generating components, or installing dependencies. We will begin development after I provide additional skills and instructions.**

## 1. Project Overview

OHMI is an AI-powered browser extension that appears as an animated, floating robot companion while students work inside Tinkercad Circuits.

Its primary purpose is to help students understand electronics, construct circuits, complete educational exercises, and troubleshoot mistakes through interactive, step-by-step guidance.

Our main objective is to make electronics education more accessible, understandable, and enjoyable.

OHMI is not intended to replace Tinkercad. It will operate alongside the existing website as an independent educational assistant.

## 2. Target Users

Initially, this application is intended for me and my classmates, particularly Computer Engineering and other students learning electronics.

We will first develop a small, reliable MVP and expand it after testing.

The initial platform is Google Chrome on desktop computers.

## 3. Main Features

These are the planned capabilities:

**A. Floating AI Companion**
- An animated 3D-style mascot named OHMI.
- Appears only within the intended Tinkercad Circuits environment.
- Draggable and minimizable.
- Opens an interactive assistant panel.
- Lightweight animations and expressive reactions.
- Designed not to obstruct the circuit workspace.

**B. AI Assignment Analyzer**
- Students can upload PDF, PNG, and JPG assignments.
- The AI analyzes the provided instructions and circuit diagrams.
- Identifies required electronic components.
- Explains the assignment's objectives.
- Generates an organized, step-by-step construction guide.

**C. Interactive Circuit Tutor**
- Guides students through assignments one step at a time.
- Explains component placement, wiring, Arduino code, and circuit concepts.
- Supports follow-up questions.
- Provides hints and explanations instead of unnecessarily complicated responses.
- Tracks assignment progress.

**D. AI Circuit Checker**
- Students can manually upload circuit screenshots.
- Students can also explicitly request a screenshot of the visible Tinkercad tab, subject to browser permissions and applicable platform policies.
- The AI analyzes visible circuit components and wiring.
- Identifies possible errors and explains recommended corrections.
- Clearly acknowledges uncertainty when a screenshot does not provide sufficient evidence.
- Does not claim to have electrically verified a circuit without actual verification.

**E. Arduino Programming Assistant**
- Explains Arduino code.
- Helps identify programming errors.
- Guides students through corrections.
- Provides beginner-friendly technical explanations.

**F. Language Support**
- English.
- Filipino/Tagalog.
- Natural Taglish.
- Optional speech features in a later milestone.

**G. Student Progress**
- User accounts.
- Saved assignments.
- Conversation history.
- Tutorial progress.
- Previous circuit-check feedback.

## 4. OHMI Mascot Identity

OHMI is our original, friendly electronics-themed robot mascot.

We have already finalized the visual design.

Character characteristics:
- Rounded teal/mint robot body.
- Cream-colored digital face.
- Black oval eyes and a small smile.
- Pink cheeks.
- Two yellow-tipped antennae.
- Short rounded arms and legs.
- Electronics-inspired details on the front.
- Mini breadboard, circuit traces, resistor detail, LED indicator, and rotary control.
- White OHMI lettering on the front.
- Bold black OHMI lettering on the left side.
- Clean 3D toy-like appearance.

The mascot should be consistent with the provided reference images.

Do not redesign or replace OHMI without my approval.

The provided images are visual assets, not an actual rigged 3D model.

### Mascot Personality

OHMI should be:
- Friendly and encouraging.
- Intelligent but approachable.
- Playful without becoming distracting.
- Patient when explaining difficult concepts.
- Supportive of independent learning.
- Honest when uncertain.

### Planned Animations

Idle, blinking, thinking, talking, happy, confused, checking, explaining, and sleepy.

Animations should be lightweight, smooth, and respectful of reduced-motion accessibility settings.

## 5. Proposed Technology Stack

Our preferred technologies are:

**Frontend and Extension**
- WXT
- React
- TypeScript
- Tailwind CSS
- Chrome Manifest V3

**Backend**
- Supabase Authentication
- Supabase PostgreSQL
- Supabase Storage
- Supabase Edge Functions

**Artificial Intelligence**
- Google Gemini, with Gemini 3.8 Flash as our proposed model, subject to verification of API availability, supported features, and pricing.

**Development**
- Git and GitHub
- Codex as our primary AI development assistant

We may introduce additional libraries or tools where justified, but avoid unnecessary dependencies and complexity.

Our project must remain maintainable and suitable for a small student development team.

## 6. UI/UX Direction

The application should have a polished, modern, friendly, and professional appearance.

Design principles:
- Clean and minimal interface.
- Soft rounded corners.
- Teal/mint primary colors.
- Comfortable typography.
- Smooth but restrained animations.
- Responsive panels.
- Clear visual hierarchy.
- Accessible and readable controls.
- Minimal visual clutter.
- Consistent branding.

OHMI will have three primary interface states:

1. **Floating Mode:** A small draggable mascot.
2. **Assistant Mode:** A compact AI chat interface.
3. **Tutorial Mode:** An expanded step-by-step learning panel.

Prioritize the students' circuit workspace. The extension must not interfere with essential Tinkercad interactions.

## 7. Engineering and Security Principles

Throughout development:

1. Prioritize correctness, reliability, and maintainability.
2. Write clean, understandable, reusable code.
3. Keep implementation proportional to the current milestone.
4. Protect user data and API credentials.
5. Use secure backend requests and proper authorization.
6. Implement appropriate Supabase Row Level Security.
7. Avoid unnecessary background processing.
8. Do not depend on undocumented Tinkercad APIs or unauthorized scraping.
9. Request appropriate permissions before accessing screenshots.
10. Never exaggerate AI accuracy or claim unverified results.
11. Ensure good performance and accessibility.
12. Test actual functionality instead of assuming the code works.
13. Explain significant technical decisions and trade-offs.
14. Do not install tools or implement unrelated features without justification.

OHMI is an independent project and should not imply official Autodesk affiliation.

## 8. Development Roadmap

We will develop OHMI incrementally.

- **Phase 0:** Project context, planning, and development skills.
- **Phase 1:** Chrome extension foundation and floating OHMI mascot.
- **Phase 2:** Complete UI/UX and mascot animations.
- **Phase 3:** Supabase integration and student accounts.
- **Phase 4:** Gemini AI integration and assignment tutoring.
- **Phase 5:** Screenshot-based circuit checking and troubleshooting.
- **Phase 6:** Testing, optimization, and classmate beta.

We may adjust this roadmap after technical validation.

Each phase must be reviewed and approved before moving to the next phase.

## 9. Important Instructions for Codex

Treat this document as our project's foundational context.

If an accessible project workspace already exists:

- Create or update `docs/PROJECT_CONTEXT.md` to preserve this information.
- Create a concise `AGENTS.md` containing durable project instructions, development principles, and a reference to the project context.
- Preserve existing project files and avoid replacing unrelated content.
- Do not create application code, initialize the extension, or install dependencies yet.

I will provide additional frontend, UI/UX, accessibility, development, and other relevant skills before Phase 1.

When I provide those skills, incorporate their relevant guidance into future implementation tasks.

Do not assume that any skills have been installed until they have been verified.

## 10. Your Task Right Now

For this request only:

1. Carefully review and understand the complete OHMI project vision.
2. Identify any major technical constraints or unresolved architectural decisions.
3. Save the project context and development guidelines if a workspace is available.
4. Briefly summarize your understanding of OHMI.
5. Confirm what information has been preserved.
6. Wait for my next instructions.

**Do not proceed to Phase 1. Do not write application code. Do not install dependencies.**

Our next task will be preparing the development environment and adding the necessary skills before implementation.
