import dotenv from 'dotenv';

// Carregado antes de qualquer outro módulo do servidor
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
