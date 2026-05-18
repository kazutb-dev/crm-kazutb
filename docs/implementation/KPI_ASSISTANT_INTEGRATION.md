# KPI System AI Assistant Integration

## Overview
The AI Assistant has been enhanced to answer questions about the KPI (Key Performance Indicators) system in addition to campus navigation. The assistant automatically detects whether a question is about KPI or navigation and provides contextual responses.

## Architecture

### Components

1. **KpiKnowledgeService** (`app/Services/KpiKnowledgeService.php`)
   - Loads and manages KPI documentation from extracted DOCX files
   - Detects KPI-related questions
   - Identifies user roles (ППС, Заведующий кафедрой, Декан, Структурное подразделение)
   - Provides role-specific documentation

2. **Updated AiChatController** (`app/Http/Controllers/Api/AiChatController.php`)
   - Analyzes incoming questions
   - Routes to appropriate knowledge base (KPI or Navigation)
   - Builds contextual system prompts for OpenAI API
   - Returns relevant responses

3. **KPI Knowledge Base** (`storage/kpi_knowledge_base.json`)
   - Extracted from 4 DOCX files:
     - `KPI инструкция для ппс.docx` - Instructions for Faculty/Lecturers
     - `KPI инструкция для зав кафедрой.docx` - Instructions for Department Heads
     - `KPI инструкция для декана.docx` - Instructions for Deans
     - `KPI инструкция для СП.docx` - Instructions for Structural Subdivisions

## How It Works

### Question Detection
The assistant identifies KPI questions by searching for keywords:
- Direct: `кпи`, `kpi`, `показатели`, `статусы`, `утверждение`
- Role-based: `декан`, `заведующий`, `кафедра`, `ППС`, `подразделение`
- Process-related: `проверка`, `черновик`, `подано`, `возвращено`

### Role Detection
When a user mentions their role, the assistant provides role-specific documentation:
- **Декан** (Dean) - Access to dean-specific workflow and approval process
- **Заведующий кафедрой** (Department Head) - Department-specific procedures
- **ППС** (Faculty) - Faculty member instructions for creating KPI entries
- **Структурное подразделение** (Structural Subdivision) - Final approval authority

### Response Generation
1. User sends message to `/api/ai/chat`
2. Controller detects question type (KPI vs Navigation)
3. Appropriate knowledge base is loaded
4. System prompt is built with context
5. OpenAI API generates response
6. Response is returned to frontend

## API Usage

### Request Format
```json
{
  "messages": [
    {
      "role": "user",
      "text": "Как мне заполнить KPI-запись?"
    }
  ]
}
```

### Example KPI Questions
- "Как создать KPI-запись?"
- "Какие статусы может иметь моя запись?"
- "Что делает заведующий кафедрой в системе KPI?"
- "Как проверить записи ППС в системе?"
- "Я декан, как мне отправить записи на утверждение?"

### Example Navigation Questions (Still Supported)
- "Где находится кабинет 201?"
- "Как мне найти отдел кадров?"
- "Какой номер кабинета у декана?"

## KPI System Workflow Summary

### Process Flow
1. **ППС** creates KPI entry in "KPI — Мои показатели"
2. **ППС** clicks "Отправить на проверку"
3. **Заведующий кафедрой** (Department Head) reviews:
   - Can return for corrections
   - Can forward to Dean
4. **Декан** (Dean) reviews entries from ППС and Department Heads:
   - Can return for corrections
   - Can forward to Structural Subdivision
5. **Структурное подразделение** (Structural Subdivision) makes final decision:
   - Approves entry
   - Rejects entry

### Record Statuses
- **Черновик** (Draft) - Not yet submitted
- **Подано** (Submitted) - Under review
- **Возвращено** (Returned) - Needs correction
- **На проверке** (In Review) - Being reviewed
- **На утверждении** (Pending Approval) - At final stage
- **Утверждено** (Approved) - Finally accepted
- **Отклонено** (Rejected) - Finally rejected

After approval, record enters summary and ratings.

## Files Modified/Created

### New Files
- `app/Services/KpiKnowledgeService.php` - KPI knowledge management service
- `storage/kpi_knowledge_base.json` - Extracted KPI documentation

### Modified Files
- `app/Http/Controllers/Api/AiChatController.php` - Enhanced with KPI support

## Configuration

### Environment Variables (if needed)
```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini  # or other OpenAI model
```

The service automatically loads the KPI knowledge base from `storage/kpi_knowledge_base.json`.

## Testing

### Test KPI Questions
```bash
curl -X POST http://localhost:8000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "text": "Я ППС, как мне создать KPI-запись?"
    }]
  }'
```

### Test Navigation Questions
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

## Limitations & Future Improvements

### Current Limitations
- Knowledge base is static (extracted from DOCX)
- No persistent conversation history
- Maximum 20 messages per request
- 500 token response limit

### Future Enhancements
- [ ] Add database persistence for conversations
- [ ] Implement RAG (Retrieval-Augmented Generation) pipeline
- [ ] Support for multiple languages (Kazakh, English)
- [ ] Admin panel to update KPI documentation
- [ ] User role detection from authentication
- [ ] Integration with actual KPI system database
- [ ] Real-time KPI status queries

## Troubleshooting

### AI service not responding
- Check `OPENAI_API_KEY` is configured
- Verify API key has sufficient credits
- Check network connectivity to OpenAI API

### KPI knowledge not loaded
- Verify `storage/kpi_knowledge_base.json` exists
- Check file permissions (should be readable)
- Check `app/Services/KpiKnowledgeService.php` logs

### Question not recognized as KPI
- Check if keywords are properly spelled
- KPI keyword detection is case-insensitive
- Add more keywords in `KpiKnowledgeService::isKpiQuestion()`

## Support

For issues or questions about the KPI system integration:
1. Check AI assistant logs in `storage/logs/`
2. Review the `kazutb-campus-ai-technical-report.md`
3. Contact the development team for API-level issues
