const { getApp, getApps, initializeApp } = require('firebase-admin/app');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const options = {};
  if (process.env.FIREBASE_PROJECT_ID) {
    options.projectId = process.env.FIREBASE_PROJECT_ID;
  }

  return initializeApp(options);
}

function getDb() {
  return getFirebaseApp().firestore();
}

module.exports = { getDb };
