export interface StorageService<TData> {
  load(): Promise<void>;
  read(): TData;
  update(mutator: (data: TData) => void): void;
}
