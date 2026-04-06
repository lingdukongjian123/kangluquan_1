import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  writeBatch,
  getDoc,
  getDocFromServer,
  where,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Machine, Status } from '../types';

const MACHINES_COLLECTION = 'machines';
const REPAIRS_COLLECTION = 'repairs';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      throw new Error('the client is offline');
    }
    // Ignore other errors like permission denied for this test doc
  }
};

export const subscribeToMachines = (callback: (machines: Machine[]) => void) => {
  const q = query(collection(db, MACHINES_COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const machines = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
    
    const formattedMachines: Machine[] = machines.map(m => ({
      id: m.id,
      currentStatus: m.status || 'normal',
      community: m.community || '',
      location: m.location || '',
      lastFault: m.lastFault || '',
      lastRepairTime: m.lastRepairTime || '',
      lastRepairMan: m.lastRepairMan || '',
      repairHistory: []
    }));
    
    callback(formattedMachines);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, MACHINES_COLLECTION);
  });
};

export const subscribeToRepairs = (callback: (repairs: any[]) => void) => {
  const q = query(collection(db, REPAIRS_COLLECTION), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const repairs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate()?.toLocaleString() || ''
    }));
    callback(repairs);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, REPAIRS_COLLECTION);
  });
};

export const addMachine = async (machine: Partial<Machine>) => {
  if (!machine.id) throw new Error('ID is required');
  const path = `${MACHINES_COLLECTION}/${machine.id}`;
  try {
    const docRef = doc(db, MACHINES_COLLECTION, machine.id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) throw new Error('设备编号已存在');
    
    await setDoc(docRef, {
      id: machine.id,
      community: machine.community,
      location: machine.location,
      status: 'normal',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const reportFault = async (machineId: string, faultDesc: string, workerName: string) => {
  const batch = writeBatch(db);
  const machineRef = doc(db, MACHINES_COLLECTION, machineId);
  const repairRef = doc(collection(db, REPAIRS_COLLECTION));
  
  try {
    batch.update(machineRef, { 
      status: 'fault',
      lastFault: faultDesc
    });
    
    batch.set(repairRef, {
      machineId,
      faultDesc,
      status: 'pending',
      date: serverTimestamp(),
      worker: workerName
    });
    
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_report_fault');
  }
};

export const startRepair = async (machineId: string, workerName: string) => {
  const machineRef = doc(db, MACHINES_COLLECTION, machineId);
  try {
    await updateDoc(machineRef, { 
      status: 'in_progress',
      lastRepairMan: workerName
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${MACHINES_COLLECTION}/${machineId}`);
  }
};

export const completeRepair = async (machineId: string, repairContent: string, partsReplaced: string, workerName: string, repairId?: string) => {
  const batch = writeBatch(db);
  const machineRef = doc(db, MACHINES_COLLECTION, machineId);
  
  try {
    batch.update(machineRef, { 
      status: 'normal',
      lastRepairTime: new Date().toLocaleString(),
      lastRepairMan: workerName,
      lastFault: null
    });
    
    if (repairId) {
      const repairRef = doc(db, REPAIRS_COLLECTION, repairId);
      batch.update(repairRef, {
        status: 'completed',
        repairContent,
        partsReplaced,
        completeDate: serverTimestamp(),
        repairMan: workerName
      });
    } else {
      // Create a new record if one wasn't found (e.g. after rename)
      const repairRef = doc(collection(db, REPAIRS_COLLECTION));
      batch.set(repairRef, {
        machineId,
        faultDesc: '手动完成维修 (原记录丢失或设备已重命名)',
        repairContent,
        partsReplaced,
        status: 'completed',
        date: serverTimestamp(),
        completeDate: serverTimestamp(),
        worker: workerName,
        repairMan: workerName
      });
    }
    
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_complete_repair');
  }
};

export const updateMachine = async (machineId: string, data: Partial<Machine>) => {
  const machineRef = doc(db, MACHINES_COLLECTION, machineId);
  try {
    await updateDoc(machineRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${MACHINES_COLLECTION}/${machineId}`);
  }
};

export const deleteMachine = async (machineId: string) => {
  const machineRef = doc(db, MACHINES_COLLECTION, machineId);
  try {
    const batch = writeBatch(db);
    batch.delete(machineRef);
    
    // Also delete associated repairs? Or just leave them? 
    // Usually better to delete them to keep DB clean if the machine is gone.
    // But for now, let's just delete the machine.
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${MACHINES_COLLECTION}/${machineId}`);
  }
};

export const renameMachine = async (oldId: string, newId: string, data: Partial<Machine>) => {
  if (oldId === newId) {
    return updateMachine(oldId, data);
  }
  
  const oldRef = doc(db, MACHINES_COLLECTION, oldId);
  const newRef = doc(db, MACHINES_COLLECTION, newId);
  
  try {
    const oldSnap = await getDoc(oldRef);
    if (!oldSnap.exists()) throw new Error('原设备不存在');
    
    const newSnap = await getDoc(newRef);
    if (newSnap.exists()) throw new Error('新设备编号已存在');
    
    // Get all repair records for this machine
    const repairsQuery = query(collection(db, REPAIRS_COLLECTION), where('machineId', '==', oldId));
    const repairsSnapshot = await getDocs(repairsQuery);
    
    const batch = writeBatch(db);
    const oldData = oldSnap.data();
    
    batch.set(newRef, {
      ...oldData,
      ...data,
      id: newId
    });
    
    batch.delete(oldRef);
    
    // Update all repair records
    repairsSnapshot.forEach((repairDoc) => {
      const repairRef = doc(db, REPAIRS_COLLECTION, repairDoc.id);
      batch.update(repairRef, { machineId: newId });
    });
    
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rename_${oldId}_to_${newId}`);
  }
};
