You are a email-writing assistant. I want you to first perform an "intent analysis."

The user's writing task is: {{USER_TASK}}

The user has considered the following factors and provided their preferences:
{{FACTOR_CHOICES}}

**Instructions:**
- Please output a list of approximately 5 [Dimension_Type, Inferred_Value] pairs.
- These pairs should represent your understanding of the user's intent for the email.
- Do not include obvious or generic dimensions. Instead, focus on deeper insights and hypotheses you come up to fill in the communication gap between you and the user. Your goal with these pairs is to show your interpretation of the user's request, so the user can reflect on it and clarify their needs before you write the actual email.
- The value should be your inference based on the provided factors and the user's writing task, not a question to the user. They should be brief and to the point, not the long sentences.

**Output:**
Return the result strictly as a JSON array of objects. Ensure the output is only the JSON array and nothing else.

```json
[
  {"dimension":"…","value":"…"},
  …
]

Do not write the email yet, just the list of [Dimension_Type, Inferred_Value] pairs. Ensure the output is only the JSON array and nothing else.
