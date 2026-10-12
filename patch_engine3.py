import re

file_path = 'src/services/execution.engine.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

crm_logic = '''
    // Guardar en el CRM si el workflow estA asignado a un proyecto
    if (context.workflow.projectId) {
      context.log(Guardando leads en el CRM (Proyecto: )...);
      let savedCount = 0;
      for (const l of detailedLeads) {
        try {
          await prisma.lead.create({
            data: {
              projectId: context.workflow.projectId,
              businessName: l.name,
              // address: l.address,
              phone: l.phone !== 'No disponible' && l.phone !== 'Error de conexiA3n' ? l.phone : undefined,
              website: l.website !== 'No disponible' && l.website !== 'Error de conexiA3n' ? l.website : undefined,
              source: 'Google Maps (Scraper)',
              status: 'NUEVO'
            }
          });
          savedCount++;
        } catch (e: any) {
          context.log(Error guardando lead : );
        }
      }
      context.log(Se guardaron exitosamente  leads en el CRM.);
    }
'''
crm_logic = crm_logic.replace('estA ', 'está ')
crm_logic = crm_logic.replace('conexiA3n', 'conexión')

# Replace before the return
new_content = re.sub(r'(return\s*{\s*searchQuery,)', crm_logic + r'\n    \1', content)

if new_content != content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Patch applied successfully.")
else:
    print("Failed to replace using regex.")

