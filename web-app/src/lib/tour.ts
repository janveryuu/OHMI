export const tourSteps = [
  { route: "/", target: ".welcome-visual", title: "Meet your circuit buddy", text: "Hi, I’m OHMI. Let’s find the tools for your next electronics question or build." },
  { route: "/", target: ".welcome-panel", title: "Your workspace, at a glance", text: "Find your recent learning and choose what to explore next." },
  { route: "/ask", target: ".page-heading", title: "Ask OHMI", text: "Ask electronics and Arduino questions. Follow up whenever an explanation needs another look." },
  { route: "/assignments", target: ".page-heading", title: "Keep your materials together", text: "Upload supported PDFs, PNGs or JPGs to your private assignments. Nothing is uploaded during this tour." },
  { route: "/checker", target: ".page-heading", title: "Take a closer look", text: "Review a circuit screenshot for possible issues. A screenshot cannot prove physical connections or electrical safety." },
  { route: "/guide", target: ".page-heading", title: "Learn one connection at a time", text: "Follow the LED lesson or a saved assignment guide. Mark steps complete when you do them." },
  { route: "/playground", target: ".pg-heading", title: "Try ideas in Playground", text: "Build supported circuits and try learning missions. Its built-in checks cover a limited set of electronics rules." },
  { route: "/library", target: ".page-heading", title: "Get to know your components", text: "Recognize components, read beginner guides, and find separate wiring references in the Circuit Library." },
  { route: "/progress", target: ".page-heading", title: "See your learning trail", text: "Review saved learning activity and guide progress. Your records stay private to your account." },
  { route: "/settings", target: ".profile-panel", title: "Make OHMI feel like home", text: "Manage your profile, appearance and accessibility. Find Floating OHMI here, and replay anytime with Take a Tour." },
] as const;
