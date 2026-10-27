export type Category = 'subscription' | 'message' | 'tip' | 'ppv';
export interface Creator {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  color: string;
  addedAt: string;
}
export interface Employee {
  id: string;
  name: string;
  role: string;
  color: string;
  hoursWorked: number;
  messagesSent: number;
  conversionRate: number;
}
export interface Fan {
  id: string;
  creatorId: string;
  name: string;
  username: string;
  avatar: string;
  joinedAt: string;
  status: 'paid' | 'free' | 'expired' | 'renewed';
  tags: string[];
  notes: string;
  unread: number;
}
export interface Transaction {
  id: string;
  creatorId: string;
  fanId: string;
  employeeId: string;
  date: string;
  category: Category;
  amount: number;
}
export interface Message {
  id: string;
  fanId: string;
  direction: 'in' | 'out';
  text: string;
  date: string;
  ppvAmount: number;
  image: string;
  saleId?: string;
}
export interface Campaign {
  id: string;
  creatorId: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  budget: number;
  clicks: number;
  conversions: number;
}
export interface Shift {
  id: string;
  employeeId: string;
  date: string;
  start: string;
  end: string;
}
export interface Script {
  id: string;
  title: string;
  content: string;
}
export interface SmartList {
  id: string;
  name: string;
  tag: string;
}
export interface TrackingLink {
  id: string;
  campaignId: string;
  label: string;
  url: string;
  clicks: number;
}
export interface ChartSeries {
  id: string;
  label: string;
  color: string;
}
export interface ChartPoint {
  id: string;
  date: string;
  values: Record<string, number>;
}
export interface ChartConfig {
  title: string;
  type: 'area' | 'line' | 'bar';
  series: ChartSeries[];
  points: ChartPoint[];
  manual: boolean;
  yMin: number | null;
  yMax: number | null;
}
export interface Override {
  value: number;
  change: number;
  color: string;
}
export interface Scenario {
  version: 1;
  id: string;
  name: string;
  creators: Creator[];
  employees: Employee[];
  fans: Fan[];
  transactions: Transaction[];
  messages: Message[];
  campaigns: Campaign[];
  shifts: Shift[];
  scripts: Script[];
  smartLists: SmartList[];
  links: TrackingLink[];
  charts: Record<string, ChartConfig>;
  overrides: Record<string, Override>;
  widgetOrder: string[];
  settings: { agencyName: string; currency: string; theme: 'dark' | 'light' };
}
export type Period =
  'Today' | 'Yesterday' | 'Last 7 days' | 'Last 30 days' | 'This Month' | 'Last Month' | 'Custom Date';
export type UpdateScenario = (recipe: (draft: Scenario) => void) => void;
