import { UserRole } from './types';

export interface PermissionSet {
  registerFarmer: boolean;
  scanQR: boolean;
  viewFarmerList: boolean;
  editFarmer: boolean;
  deleteFarmer: boolean;
  reprintCard: boolean;
  addStaff: boolean;
  removeStaff: boolean;
  viewAnalytics: boolean;
  modifyShopProfile: boolean;
  accessSettings: boolean;
  logVisit: boolean;
  deleteVisit: boolean;
  viewVisitHistory: boolean;
  manageInventory: boolean;
  viewInventory: boolean;
}

export const PERMISSIONS: Record<UserRole, PermissionSet> = {
  dealer: {
    registerFarmer: true,
    scanQR: true,
    viewFarmerList: true,
    editFarmer: true,
    deleteFarmer: true,
    reprintCard: true,
    addStaff: true,
    removeStaff: true,
    viewAnalytics: true,
    modifyShopProfile: true,
    accessSettings: true,
    logVisit: true,
    deleteVisit: true,
    viewVisitHistory: true,
    manageInventory: true,
    viewInventory: true,
  },
  staff: {
    registerFarmer: true,
    scanQR: true,
    viewFarmerList: true,
    editFarmer: false,
    deleteFarmer: false,
    reprintCard: false,
    addStaff: false,
    removeStaff: false,
    viewAnalytics: false,
    modifyShopProfile: false,
    accessSettings: false,
    logVisit: true,
    deleteVisit: false,
    viewVisitHistory: true,
    manageInventory: false,
    viewInventory: true,
  },
};
