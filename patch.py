import re

path = r'c:\Users\whilmis\Documents\GitHub\Grupo Hormesis\src\pages\portal\admin\AdminWorkflows.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add states
content = re.sub(
    r'(const \[newWfConfig, setNewWfConfig\] = useState<any>\(\{\}\);)',
    r'\1\n  const [newWfCreds, setNewWfCreds] = useState<Record<string, string>>({});\n  const [selectedGroqKey, setSelectedGroqKey] = useState<string>(\'\');',
    content
)

# 2. Add credentialIds to save payload
old_payload = """        await apiClient('/workflows', {
          method: 'POST',
          data: {
            templateId,
            name: newWfName,
            config: finalConfig
          }
        });"""
new_payload = """        await apiClient('/workflows', {
          method: 'POST',
          data: {
            templateId,
            name: newWfName,
            config: finalConfig,
            credentialIds: Object.values(newWfCreds)
          }
        });"""
content = content.replace(old_payload, new_payload)

# 3. Add groq select to generateTemplates call
old_gen = """        const res = await apiClient('/workflows/generate-templates', {
          method: 'POST',
          data: { business_context: businessContext, services: servicesInput.split(',').map(s => s.trim()) }
        });"""
new_gen = """        const res = await apiClient('/workflows/generate-templates', {
          method: 'POST',
          data: { 
            business_context: businessContext, 
            services: servicesInput.split(',').map(s => s.trim()),
            groqCredentialId: selectedGroqKey || undefined
          }
        });"""
content = content.replace(old_gen, new_gen)

# 4. Add UI dropdowns (Gmail creds + Groq creds)
old_ui = """                      <div className="input-group">
                        <label>Nombre de esta instancia</label>
                        <input type="text" required value={newWfName} onChange={(e) => setNewWfName(e.target.value)} className="auth-input" placeholder="Ej. Formulario Landing Page" />
                      </div>"""
new_ui = old_ui + """

                      {/* Selectores de Credenciales requeridas (Gmail) */}
                      {activeTemplate.requiredCreds && activeTemplate.requiredCreds.map((reqCred: string) => (
                        <div className="input-group" key={reqCred}>
                          <label>Seleccionar {reqCred}</label>
                          <select 
                            required 
                            className="auth-input"
                            value={newWfCreds[reqCred] || ''}
                            onChange={(e) => setNewWfCreds({...newWfCreds, [reqCred]: e.target.value})}
                          >
                            <option value="">-- Elige una credencial --</option>
                            {credentials.filter(c => c.type === reqCred).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
"""
content = content.replace(old_ui, new_ui)

old_wiz = """                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                              <label>Contexto del Negocio</label>"""
new_wiz = """                            <div className="input-group" style={{ marginBottom: '1rem' }}>
                              <label>API Key de Groq a usar</label>
                              <select className="auth-input" value={selectedGroqKey} onChange={(e) => setSelectedGroqKey(e.target.value)}>
                                <option value="">Automático (La primera que encuentre)</option>
                                {credentials.filter(c => c.type === 'groq_api_key').map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>\n\n""" + old_wiz
content = content.replace(old_wiz, new_wiz)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
