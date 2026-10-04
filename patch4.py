import sys

path = r'c:\Users\whilmis\Documents\GitHub\Hormesis-back\src\controllers\workflow.controller.ts'
missing_path = r'c:\Users\whilmis\Documents\GitHub\Hormesis-back\missing.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

with open(missing_path, 'r', encoding='utf-8') as f:
    missing_content = f.read()

start_idx = content.find("  async refineTemplates(")
if start_idx == -1:
    print("Could not find refineTemplates!")
    sys.exit(1)

content = content[:start_idx] + missing_content + "\n\n" + content[start_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
