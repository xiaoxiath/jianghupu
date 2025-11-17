export interface Item {
  name: string;
  description?: string;
  [key: string]: any; // Allow other properties
}