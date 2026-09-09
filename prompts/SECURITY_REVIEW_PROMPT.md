# Security Review Prompt

Review the current change as an application-security engineer.

Focus on:
- authentication
- authorization / IDOR
- tenant/user ownership
- session/cookie configuration
- CORS/CSRF
- SSRF for fetched URLs
- stored XSS
- secret/token leakage
- logging
- OAuth scope
- prompt injection from external resource text
- unsafe command execution
- database transaction consistency

Return:
1. Critical
2. High
3. Medium
4. Low
5. Tests that should be added

Do not report theoretical issues without identifying the affected code path.
