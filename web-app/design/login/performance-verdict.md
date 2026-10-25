## verdict

1. Resolved — workspace shell deferral. AppFrame dynamically imports AppShell only for workspace rendering and returns login children directly. The parent verified the exclusive AppShell chunk is not requested on login; shared dependencies still load. The final regression report lists all six sizes/both themes and local PKCE, navigation and session checks with no errors or accessibility violations.
2. Resolved — countryside priority. The login image now declares fetchPriority="high" and loading="eager"; the final Lighthouse discovery audit confirms the high-priority hint.

## remaining

Clear for these two scoped performance fixes. One local production-build mobile lab run improved performance 79→89, LCP approximately 4.0→3.7s and TBT 250→130ms; accessibility and best practices remain 100. CLS displays as 0 (raw 0.000077). LCP remains above 2.5s and is a disclosed limitation, not a field-performance claim or an unmet user-specified numeric target. This verdict covers the scored fixes only; live Google consent and production delivery remain unverified. Owner review is required before deployment.

disposition: ship
