import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './utils/logger';

let initialized = false;

try {
  const certRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (certRaw) {
    let serviceAccount: admin.ServiceAccount;
    
    if (certRaw.trim().startsWith('{')) {
      // JSON string
      serviceAccount = JSON.parse(certRaw);
    } else {
      // File path — resolve relative to the backend root (where package.json / .env lives)
      const resolvedPath = path.resolve(process.cwd(), certRaw);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Service account file not found at: ${resolvedPath}`);
      }
      const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
      serviceAccount = JSON.parse(fileContent);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    logger.info('Firebase', 'Admin SDK initialized successfully');
  } else {
    logger.warn('Firebase', 'No FIREBASE_SERVICE_ACCOUNT env var. Auth verification will reject all tokens.');
  }
} catch (err) {
  logger.error('Firebase', 'Error initializing Admin SDK', { error: String(err) });
}

export const verifyFirebaseToken = async (idToken: string): Promise<admin.auth.DecodedIdToken> => {
  if (!initialized) {
    throw new Error('Firebase Admin SDK is not initialized.');
  }
  return admin.auth().verifyIdToken(idToken);
};

export const isFirebaseInitialized = (): boolean => initialized;
