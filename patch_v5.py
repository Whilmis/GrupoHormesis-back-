import sys

path = r'c:\Users\whilmis\Documents\GitHub\Hormesis-back\src\controllers\workflow.controller.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# I will just replace the fetch body string to add max_tokens.
old_str = """              body: JSON.stringify({
                model: 'openai/gpt-oss-20b',
                messages: [
                  { role: 'system', content: 'You are an elite HTML Email Designer and Copywriter that only responds in JSON.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.6,
                response_format: { type: "json_object" }
              })"""

new_str = """              body: JSON.stringify({
                model: 'openai/gpt-oss-20b',
                messages: [
                  { role: 'system', content: 'You are an elite HTML Email Designer and Copywriter that only responds in JSON.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.6,
                max_tokens: 1000,
                response_format: { type: "json_object" }
              })"""

if old_str in content:
    content = content.replace(old_str, new_str)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Could not find the target string to replace.")
    sys.exit(1)
