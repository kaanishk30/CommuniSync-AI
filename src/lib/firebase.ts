import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, Timestamp, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId); 

export { 
  collection, addDoc, getDocs, query, where, Timestamp, onSnapshot, doc, updateDoc, setDoc, deleteDoc
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function seedVolunteers() {
  const volunteersRef = collection(db, 'volunteers');
  const snapshot = await getDocs(volunteersRef);
  const existingNames = snapshot.docs.map(d => d.data().name);
  
  const initialVolunteers = [
    { name: 'Alice', email: 'alice@sync.ai', group: 'Medical', skills: ['Clinical Nurse', 'Suture Expert', 'Paramedic'], isAvailable: true, currentTask: null, location: { lat: 37.7749, lng: -122.4194 } },
    { name: 'Bob', email: 'bob@sync.ai', group: 'Fire', skills: ['Rescue Firefighter', 'Hazmat Specialist'], isAvailable: true, currentTask: null, location: { lat: 37.7849, lng: -122.4094 } },
    { name: 'Elena', email: 'elena@sync.ai', group: 'Civil', skills: ['Social Coordinator', 'Public Safety Officer'], isAvailable: true, currentTask: null, location: { lat: 37.7649, lng: -122.4294 } }, 
    { name: 'David', email: 'david@sync.ai', group: 'Logistics', skills: ['Heavy Lift Operator', 'Strategic Transport'], isAvailable: true, currentTask: null, location: { lat: 37.7549, lng: -122.4394 } }
  ];

  for (const v of initialVolunteers) {
    if (!existingNames.includes(v.name)) {
      await addDoc(volunteersRef, v);
    }
  }
}

export async function seedSectorKeywords() {
  const keywordsRef = collection(db, 'sector_keywords');
  const snapshot = await getDocs(keywordsRef);
  
  if (snapshot.empty) {
    const initialKeywords = [
      { sector: 'Medical', keywords: ['injury', 'blood', 'head', 'pain', 'unconscious', 'fainting', 'breathing', 'heart', 'broken', 'wound', 'nurse', 'doctor', 'paramedic', 'ambulance', 'clinic', 'first aid', 'symptoms', 'burns', 'allergic', 'shock'] },
      { sector: 'Fire', keywords: ['fire', 'flame', 'smoke', 'explosion', 'burning', 'sparks', 'gas leak', 'chemical', 'hazard', 'heat', 'thermal', 'blaze', 'inferno'] },
      { sector: 'Logistics', keywords: ['debris', 'lifting', 'transport', 'truck', 'moving', 'supplies', 'tents', 'blankets', 'water bottles', 'shelter', 'clearing', 'digging', 'heavy', 'carry', 'storage', 'cables', 'generator', 'tools', 'ladder'] },
      { sector: 'Civil', keywords: ['missing', 'information', 'coordination', 'update', 'news', 'alert', 'lost', 'found', 'meeting', 'registration', 'food', 'water', 'clothing', 'non-emergency', 'general', 'id check', 'security', 'public'] }
    ];

    for (const k of initialKeywords) {
      await setDoc(doc(keywordsRef, k.sector), k);
    }
  }
}
