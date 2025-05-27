export type DataPart = 
  | { type: 'append-message'; message: string }
  | { type: 'vector-search-progress'; progress: string };
