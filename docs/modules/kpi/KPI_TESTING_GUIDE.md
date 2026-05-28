# KPI Assistant - Quick Start & Testing Guide

## Setup Verification

### ✅ Installation Checklist
- [x] KPI knowledge base extracted: `storage/kpi_knowledge_base.json` (80KB)
- [x] Service created: `app/Services/KpiKnowledgeService.php`
- [x] Controller updated: `app/Http/Controllers/Api/AiChatController.php`
- [x] Frontend updated: `resources/js/Components/ChatBot.jsx` (now calls real API)
- [x] Documentation created: `docs/KPI_ASSISTANT_INTEGRATION.md`

## Testing the Integration

### 1. Backend API Test (via curl)

#### Test KPI Question
```bash
curl -X POST http://localhost:8000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "text": "Я ППС. Как мне создать KPI-запись?"
    }]
  }'
```

Expected response will include KPI-specific instructions for faculty members.

#### Test Navigation Question (backward compatibility)
```bash
curl -X POST http://localhost:8000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "text": "Где находится кабинет 201?"
    }]
  }'
```

Expected response will include location and directions.

#### Test Role-Specific Question
```bash
curl -X POST http://localhost:8000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "text": "Я декан, как я должен проверять KPI-записи?"
    }]
  }'
```

Expected response will include dean-specific workflow.

### 2. Frontend Testing

#### Open the Chat Interface
1. Navigate to the portal homepage
2. Look for "Campus AI" chat button (bottom right or in components)
3. Click to open the chat modal

#### Test KPI Questions in UI
Try asking:
- "Как создать KPI-запись?"
- "Что делает заведующий кафедрой в системе KPI?"
- "Какие статусы могут быть у записи?"
- "Как долго проходит проверка KPI?"

#### Test Navigation Questions in UI
- "Где кабинет 201?"
- "Как найти деканат?"
- "Какой номер отдела кадров?"

### 3. Integration Debugging

#### Check if API is reachable
```bash
curl -X GET http://localhost:8000/api/ai/chat 2>&1 | head
```
Should show method not allowed (since it's POST only)

#### Check OpenAI configuration
```bash
# In your .env file, verify:
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

#### Check knowledge base exists
```bash
ls -lh storage/kpi_knowledge_base.json
```

#### Check PHP errors
```bash
# Monitor Laravel logs
tail -f storage/logs/laravel.log
```

## Example Conversations

### Scenario 1: Faculty Member (ППС)
```
User: "Я новый сотрудник ППС. Как заполнить KPI?"

Expected: Detailed instructions on:
- How to access KPI section
- How to create new entry
- Required fields to fill
- How to submit for review
```

### Scenario 2: Department Head (Заведующий)
```
User: "Как я как заведующий должен проверять записи ППС?"

Expected: Information about:
- Where to see ППС submissions
- How to approve or reject
- How to return for corrections
- How to forward to dean
```

### Scenario 3: Dean (Декан)
```
User: "Какие записи должны пройти мою проверку?"

Expected: Explanation of:
- Dean's role in KPI workflow
- What records they review
- Approval authority and limits
- Process for forwarding to structures
```

### Scenario 4: Navigation (Backward Compatibility)
```
User: "Где находится структурное подразделение?"

Expected: Location information:
- Building number
- Floor
- Office number
- Directions
```

## Troubleshooting

### Issue: "AI service is not configured"
**Solution:** Add `OPENAI_API_KEY` to your `.env` file

### Issue: "AI service unavailable"
**Solution:** Check network connection and OpenAI API status at https://status.openai.com

### Issue: KPI questions not recognized
**Solution:** Check that keywords are spelled correctly. Current keywords:
- `кпи`, `kpi`, `показатели`, `статусы`, `утверждение`
- `декан`, `заведующий`, `кафедра`, `пп[сс]`
- `проверка`, `черновик`, `подано`, `возвращено`

### Issue: Chat returns generic response
**Solution:** 
1. Verify knowledge base file exists: `storage/kpi_knowledge_base.json`
2. Check that question contains KPI keywords
3. Try rephrasing question with more specific keywords

## Files to Monitor

Monitor these files for debugging:
```
storage/logs/laravel.log          # API errors and logs
storage/kpi_knowledge_base.json   # Knowledge base content
resources/js/Components/ChatBot.jsx  # Frontend component
app/Services/KpiKnowledgeService.php # Service logic
app/Http/Controllers/Api/AiChatController.php # Controller
```

## Next Steps

After testing:
1. ✅ Deploy to production
2. ✅ Gather user feedback on responses
3. ✅ Add additional keywords if needed
4. ✅ Consider implementing conversation persistence
5. ✅ Plan for Kazakh language support

## Support & Questions

If the assistant isn't responding as expected:
1. Check `storage/logs/laravel.log` for errors
2. Test API directly with curl
3. Verify OpenAI API key and credits
4. Review `docs/KPI_ASSISTANT_INTEGRATION.md` for complete details

---

**Status:** ✅ Ready for Testing and Deployment
**Last Updated:** May 16, 2026
