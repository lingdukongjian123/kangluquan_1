/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Machine, Status, RepairHistoryItem } from '../types';

const STORAGE_KEY = 'water_purifier_maintenance_data';

const communities = ['领秀城', '阳光100', '中海国际社区', '燕山小区', '万象新天', '保利华庭', '绿地城', '恒大名都', '鲁能领秀公馆', '名士豪庭'];

const generateInitialData = (): Machine[] => {
  const machines: Machine[] = [];
  for (let i = 1; i <= 100; i++) {
    const id = `JSJ-${String(i).padStart(3, '0')}`;
    const community = communities[Math.floor(Math.random() * communities.length)];
    const location = `${Math.floor(Math.random() * 20) + 1}号楼${Math.random() > 0.5 ? '东' : '西'}侧`;
    machines.push({
      id,
      currentStatus: 'normal',
      community,
      location,
      repairHistory: [],
    });
  }
  return machines;
};

export const getMachines = (): Machine[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    const initialData = generateInitialData();
    saveMachines(initialData);
    return initialData;
  }
  const machines: Machine[] = JSON.parse(data);
  // Migration: Add missing fields if they don't exist
  let updated = false;
  machines.forEach(m => {
    if (!m.community || !m.location) {
      m.community = m.community || communities[Math.floor(Math.random() * communities.length)];
      m.location = m.location || `${Math.floor(Math.random() * 20) + 1}号楼${Math.random() > 0.5 ? '东' : '西'}侧`;
      updated = true;
    }
  });
  if (updated) saveMachines(machines);
  return machines;
};

export const saveMachines = (machines: Machine[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(machines));
};

export const addMachine = (machine: Machine) => {
  const machines = getMachines();
  if (machines.some(m => m.id === machine.id)) {
    throw new Error(`设备编号 ${machine.id} 已存在`);
  }
  machines.push(machine);
  saveMachines(machines);
};

export const updateMachineDetails = (machineId: string, community: string, location: string) => {
  const machines = getMachines();
  const index = machines.findIndex(m => m.id === machineId);
  if (index !== -1) {
    machines[index].community = community;
    machines[index].location = location;
    saveMachines(machines);
  }
};

export const updateResponsiblePerson = (machineId: string, person: string) => {
  const machines = getMachines();
  const index = machines.findIndex(m => m.id === machineId);
  if (index !== -1) {
    machines[index].lastRepairMan = person;
    saveMachines(machines);
  }
};

export const reportFault = (machineId: string, faultDesc: string, reportMan: string) => {
  const machines = getMachines();
  const index = machines.findIndex(m => m.id === machineId);
  if (index !== -1) {
    const newHistoryItem: RepairHistoryItem = {
      id: crypto.randomUUID(),
      faultDesc,
      reportTime: new Date().toLocaleString(),
      reportMan,
    };
    machines[index].currentStatus = 'pending';
    machines[index].lastFault = faultDesc;
    machines[index].repairHistory.unshift(newHistoryItem);
    saveMachines(machines);
  }
};

export const startRepair = (machineId: string, startMan: string) => {
  const machines = getMachines();
  const index = machines.findIndex(m => m.id === machineId);
  if (index !== -1) {
    const machine = machines[index];
    if (machine.repairHistory.length > 0) {
      machine.currentStatus = 'in_progress';
      machine.repairHistory[0].startTime = new Date().toLocaleString();
      machine.repairHistory[0].startMan = startMan;
      saveMachines(machines);
    }
  }
};

export const completeRepair = (
  machineId: string,
  repairContent: string,
  partsReplaced: string,
  completeMan: string
) => {
  const machines = getMachines();
  const index = machines.findIndex(m => m.id === machineId);
  if (index !== -1) {
    const machine = machines[index];
    if (machine.repairHistory.length > 0) {
      machine.currentStatus = 'completed';
      const latest = machine.repairHistory[0];
      latest.completeTime = new Date().toLocaleString();
      latest.completeMan = completeMan;
      latest.repairContent = repairContent;
      latest.partsReplaced = partsReplaced;
      
      machine.lastRepairTime = latest.completeTime;
      machine.lastRepairMan = completeMan;
      saveMachines(machines);
    }
  }
};

export const addNote = (machineId: string, historyId: string, note: string) => {
  const machines = getMachines();
  const index = machines.findIndex(m => m.id === machineId);
  if (index !== -1) {
    const historyItem = machines[index].repairHistory.find(h => h.id === historyId);
    if (historyItem) {
      if (!historyItem.notes) historyItem.notes = [];
      historyItem.notes.push(`${new Date().toLocaleString()} - ${note}`);
      saveMachines(machines);
    }
  }
};
