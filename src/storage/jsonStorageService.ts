import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Logger } from "../services/logger";
import type { StorageService } from "./storageService";

export class JsonStorageService<TData> implements StorageService<TData> {
  private data: TData;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly storagePath: string,
    private readonly createInitialData: () => TData,
    private readonly storageName = "storage",
    private readonly logger?: Logger
  ) {
    this.data = this.createInitialData();
  }

  async load() {
    const dir = path.dirname(this.storagePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
      this.logger?.info(`Created ${this.storageName} directory`, { dir });
    }

    if (!existsSync(this.storagePath)) {
      await this.persist();
      this.logger?.info(`Initialized empty ${this.storageName} file`, {
        storagePath: this.storagePath,
      });
      return;
    }

    const raw = await readFile(this.storagePath, "utf-8");
    if (!raw.trim()) {
      this.data = this.createInitialData();
      await this.persist();
      return;
    }

    this.data = JSON.parse(raw) as TData;
    this.logger?.info(`${this.storageName} loaded`, { storagePath: this.storagePath });
  }

  read(): TData {
    return this.data;
  }

  update(mutator: (data: TData) => void): void {
    mutator(this.data);
    this.queuePersist();
  }

  private queuePersist() {
    this.writeQueue = this.writeQueue.then(async () => {
      await this.persist();
    });
  }

  private async persist() {
    await writeFile(this.storagePath, JSON.stringify(this.data, null, 2), "utf-8");
    this.logger?.debug(`${this.storageName} persisted`, { storagePath: this.storagePath });
  }
}
