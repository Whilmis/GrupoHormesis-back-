import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
// Clave secreta para encriptar (debe tener 32 bytes). Usamos una por defecto si no hay en el .env
const ENCRYPTION_KEY = process.env.WORKFLOW_ENCRYPTION_KEY || 'default_secret_key_needs_32_bytes'; 
// Si la clave no tiene 32 caracteres, la rellenamos/truncamos a 32
const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);

export class CredentialService {
  /**
   * Encripta un valor de credencial (ej. un API Key)
   */
  static encrypt(text: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }

  /**
   * Desencripta un valor usando el vector de inicialización (iv)
   */
  static decrypt(encryptedData: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
