// ─── Auth ───────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'manager' | 'sales';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
}

// ─── Employees ───────────────────────────────────────────────────────────────
export type EmployeeRole = 'manager' | 'sales' | 'technician' | 'admin';
export type EmployeeStatus = 'active' | 'inactive';

export interface Employee {
  id: string;
  empId: string;
  name: string;
  role: EmployeeRole;
  phone: string;
  email: string;
  joinDate: string;
  salary: number;
  status: EmployeeStatus;
}

// ─── Stock ───────────────────────────────────────────────────────────────────
export type AcCategory = 'split-ac' | 'window-ac' | 'cassette-ac' | 'tower-ac';
export type AcTonnage = '1T' | '1.5T' | '2T';
export type StarRating = 3 | 4 | 5;

export interface Stock {
  id: string;
  sku: string;
  productName: string;
  category: AcCategory;
  tonnage: AcTonnage;
  starRating: StarRating;
  modelNumber: string;
  price: number;
  quantity: number;
  minStock: number;
  location: string;
  lastUpdated: string;
}

// ─── Sales ───────────────────────────────────────────────────────────────────
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'emi' | 'cheque' | 'bank-transfer';
export type SaleStatus = 'completed' | 'pending' | 'cancelled';
export type CustomerType = 'individual' | 'business';
export type LeadSource = 'walk-in' | 'referral' | 'online' | 'phone' | 'exhibition' | 'other';
export type InstallationStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled';
export type SaleTargetCategory = 'retail' | 'wholesale' | 'corporate' | 'government';
export type CustomerSegment = 'budget' | 'mid-range' | 'premium';

export interface SaleItem {
  id: string;
  productName: string;
  modelNumber: string;
  sku: string;
  serialNumber: string;
  tonnage: string;
  acType: string;
  energyRating: string;
  quantity: number;
  mrp: number;
  sellingPrice: number;
  discount: number;
  gstPercent: number;
  itemCost: number;          // hidden margin analytics
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;               // ISO date
  time: string;               // HH:MM
  // Basic
  paymentMethod: PaymentMethod;
  employeeId: string;
  employeeName: string;
  storeLocation: string;
  gstApplicable: boolean;
  status: SaleStatus;
  // Customer
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerType: CustomerType;
  billingAddress: string;
  shippingAddress: string;
  gstin: string;
  leadSource: LeadSource;
  pan: string;
  // Items
  items: SaleItem[];
  // Financials
  subtotal: number;
  totalDiscount: number;
  gstAmount: number;
  installationCharges: number;
  deliveryCharges: number;
  otherCharges: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: string;
  // Installation
  installationRequired: boolean;
  installationDate: string;
  assignedTechnicianId: string;
  assignedTechnicianName: string;
  installationStatus: InstallationStatus;
  extraMaterialCharges: number;
  amcSold: boolean;
  extendedWarrantySold: boolean;
  // Analytics (hidden)
  expectedDeliveryDate: string;
  customerSegment: CustomerSegment;
  season: string;
  salesCampaignId: string;
  targetCategory: SaleTargetCategory;
  // Legacy compat
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────
export type ComplaintType =
  | 'installation' | 'gas-refill' | 'repair' | 'maintenance'
  | 'noise-issue' | 'water-leakage' | 'remote-issue' | 'other';
export type ServiceStatus = 'open' | 'in-progress' | 'completed' | 'cancelled';

export interface ServiceRequest {
  id: string;
  serialNo: string;           // AC unit serial number
  serviceNo: string;          // service ticket number, e.g. SRV0001
  complaintDate: string;      // ISO date
  customerName: string;
  mobile: string;
  area: string;
  townVillage: string;
  invoiceNumber: string;
  invoiceDate: string;        // ISO date
  modelNumber: string;
  complaintType: ComplaintType;
  attendedDate: string;       // ISO date, blank if not yet attended
  technicianId: string;
  technicianName: string;
  status: ServiceStatus;
}
