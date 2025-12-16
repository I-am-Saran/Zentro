# 🧭 TRAE AI Project Implementation Guidelines

## Core commandments:
1. User friendly
2. Performance Freindly
3. Security freindly
4. Low engineering style
5. Developer friendly
6. Test friendly
7. QA friendly
8. Scalability freindly
9. Maintainability freindly
10. Extensibility freindly
11. No hardcoding
12. Use environment variables for configuration
13. Use environment variables for configuration


---

##  🔒 1. Core Principles
- **No fallbacks:** Do not include automatic or silent fallback mechanisms.  
  Every failure must be explicitly handled with clear error messages or logs.  
- **Strict adherence:** Follow this document for all code, configuration, and UI implementations.  
- **Developer & QA friendly:** Ensure all code, comments, and responses are easy to understand, test, and maintain.  
- **User friendly:** The interface must be clean, consistent, and intuitive for all user roles.  
- **Security friendly:** Never expose secrets, tokens, or sensitive data. Validate and sanitize every input/output.  
- **Performance friendly:** Optimize for minimal latency, small bundle size, and efficient API calls.  
- **Low engineering style:** Keep code simple, modular, and reusable—avoid unnecessary abstractions.  
- Implement / test / develop everything in sequential order and not in parallel, layer by layer
---

## 🧱 2. Code Implementation Standards
- Follow **DRY**, **KISS**, and **SOLID** principles.  
- All components and APIs must include **error handling** (try/catch + user feedback).  
- Implement **input validation** and **output escaping** at both frontend & backend.  
- Use **async/await** consistently for readability.  
- Prefer **constants + env variables** over hardcoded values.  
- Ensure every endpoint or UI action has an **explicit success/failure state**.  
- Add **console and network logging** only for debugging; remove before production builds.  

---

## 🎨 3. UI/UX Standards
- Ensure clear hierarchy: headings > content > buttons.  
- Use consistent padding, typography, and color palette.  
- Add tooltips or inline hints for all user inputs.  
- Use friendly validation messages instead of technical jargon.  
- Avoid clutter—each view should focus on one primary user goal.  
- Ensure responsive behavior across desktop and mobile.  

---

## 🧩 4. Security Practices
- Validate all API inputs (server + client).  
- Implement CSRF/XSS/SQL-injection prevention measures.  
- Mask sensitive data in logs and responses.  
- Use HTTPS and secure tokens for all API communication.  
- Follow OWASP Top 10 guidelines.  

---

## ⚡ 5. Performance Practices
- Use lazy loading and dynamic imports.  
- Cache API responses intelligently.  
- Optimize image & asset loading.  
- Minimize re-renders (memoization or proper state structure).  
- Keep dependencies minimal.  

---

## 🧪 6. QA Guidelines
- Each module must include test scenarios before merging.  
- Test for boundary cases, error states, and negative flows.  
- Run accessibility, security, and performance checks.  
- Document all found issues + their resolutions.  
- No deployment without QA approval.  

---

## 🚀 7. Review Checklist
Before merge or release:
1. ✅ Code reviewed by developer + QA  
2. ✅ All logs & fallbacks removed  
3. ✅ Tests passed (Manual + Automated)  
4. ✅ UI/UX validated  
5. ✅ Security headers and validations checked  
6. ✅ Performance metrics verified  

---

**File Name:** `TRAE_AI_Project_Guidelines.md`  
**Location:** `/docs/` or project root  

---

## 🌐 8. Local Execution & Session Management

Single Instance Rule: For any execution or preview run, always reuse the same local development server instance.

Prevent Multiple Ports: Do not spin up new ports for every execution.

Kill Previous Session: Before launching a new instance, terminate any existing process running on the target port.

# Example: Kill process using port 5179 before reusing it
npx kill-port 5179
npm run dev


Reuse Environment: All subsequent executions should attach to the same environment instead of launching new windows.

Goal: Maintain a single, stable runtime so that aig.md prompts and configurations remain consistent across executions.