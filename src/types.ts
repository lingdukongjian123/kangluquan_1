/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Status = 'pending' | 'in_progress' | 'completed' | 'normal' | 'fault';

export interface RepairHistoryItem {
  id: string;
  faultDesc: string;
  reportTime: string;
  reportMan: string;
  startTime?: string;
  startMan?: string;
  completeTime?: string;
  completeMan?: string;
  repairContent?: string;
  partsReplaced?: string;
  notes?: string[];
}

export interface Machine {
  id: string;
  currentStatus: Status;
  community: string;
  location: string;
  lastFault?: string;
  lastRepairTime?: string;
  lastRepairMan?: string;
  repairHistory: RepairHistoryItem[];
}
