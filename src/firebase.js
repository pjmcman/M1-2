const path = require('node:path');
const admin = require('firebase-admin');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function getFirebaseApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const options = {};
  if (process.env.FIREBASE_PROJECT_ID) {
    options.projectId = process.env.FIREBASE_PROJECT_ID;
  }

  return admin.initializeApp(options);
}

function getDb() {
  return getFirebaseApp().firestore();
}

module.exports = { getDb };
