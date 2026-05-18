# Quick Reference — KPI Assistant Integration

## 📍 File Locations

```
Service:    app/Services/KpiKnowledgeService.php
Controller: app/Http/Controllers/Api/AiChatController.php
Frontend:   resources/js/Components/ChatBot.jsx
Knowledge:  storage/kpi_knowledge_base.json
API Route:  POST /api/ai/chat
```

## 🚀 How to Use

### Detect KPI Question
```php
$kpiService = new KpiKnowledgeService();
$isKpi = $kpiService->isKpiQuestion($userQuery);
```

### Get Role-Specific Documentation
```php
$context = $kpiService->getKpiContext($query);
// or for specific role:
$context = $kpiService->getRoleDocumentation('dean');
```

### Detect User Role
```php
$role = $kpiService->detectUserRole($query);
// Returns: 'dean', 'head', 'pps', 'sp', or 'general'
```

## 🔍 KPI Keywords
```
Direct:    кпи, kpi, показатели, статусы, утверждение
Roles:     декан, заведующий, кафедра, ппс, подразделение
Process:   проверка, черновик, подано, возвращено
```

## 📝 API Request Example
```json
POST /api/ai/chat
{
  "messages": [
    {
      "role": "user",
      "text": "Как создать KPI-запись как ППС?"
    }
  ]
}
```

## 📨 API Response
```json
{
  "text": "Вот пошаговые инструкции для ППС..."
}
```

## ⚙️ Configuration
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

## 📊 KPI Status Flow
```
Черновик → Подано → На проверке → Возвращено
                                      ↓
                              На утверждении
                                      ↓
                        Утверждено / Отклонено
```

## 🧪 Test KPI Detection
```bash
curl -X POST http://localhost:8000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","text":"Как ППС создать запись?"}]}'
```

## 🔧 Troubleshooting
| Problem | Solution |
|---------|----------|
| No KPI detection | Check keywords in question |
| Missing knowledge | Verify knowledge base file |
| API error | Check OPENAI_API_KEY in .env |
| Wrong role detected | Add more keywords |

## 📚 Documentation Files
```
KPI_ASSISTANT_INTEGRATION.md  - Technical guide
KPI_TESTING_GUIDE.md          - Testing procedures
KPI_USER_GUIDE.md             - User manual
KPI_IMPLEMENTATION_SUMMARY.md - Complete overview
```

## 🎯 Key Classes & Methods

### KpiKnowledgeService
- `isKpiQuestion(string $query): bool`
- `detectUserRole(string $query): string`
- `getKpiContext(string $query, string $role): string`
- `getRoleDocumentation(string $role): string`
- `getKpiProcessSummary(): string`

### AiChatController
- `chat(Request $request): JsonResponse`
- `buildSystemPrompt(KpiKnowledgeService, bool, string): string`

---

**Quick Integration Checklist:**
- [ ] Service imported in controller
- [ ] Knowledge base file exists
- [ ] API key configured
- [ ] Frontend calls /api/ai/chat
- [ ] Error handling in place
- [ ] Tests pass

**Status: ✅ Ready to deploy**
