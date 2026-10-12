import { ExecutionEngine } from './src/services/execution.engine';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    // Busca un workflow activo de tipo lead collector
    console.log('Iniciando prueba manual...');
    // El frontend pasa esto, pasamos datos mock:
    await ExecutionEngine.executeWorkflow('74b68d38-a2bd-45cb-8fd8-0a3013504762'); 
  } catch (err) {
    console.error('Crash in execution:', err);
  }
}
run();
